/**
 * Context loader: read the selected files safely and assemble a bounded code
 * context. Enforces policy (allowlist/denylist/traversal), per-file and total
 * byte budgets, binary sniffing, and redacts secrets from content before it can
 * reach the model or the manifest. Read-only.
 */

import { promises as fs } from 'fs'

import { isReadable, looksBinary, resolveSafe } from './codePolicy'
import { redact } from './redact'

export interface LoadedFile {
  path: string
  content: string
  bytes: number
  truncated: boolean
}

export interface SkippedFile {
  path: string
  reason: string
}

export interface LoadedContext {
  files: LoadedFile[]
  skipped: SkippedFile[]
  totalBytes: number
}

export interface LoadLimits {
  maxFileBytes: number
  maxContextBytes: number
}

export type ReadResult =
  | { ok: true; content: string; bytes: number; truncated: boolean }
  | { ok: false; reason: string }

/** Read a single file safely (policy + traversal + binary + redact + cap).
 *  Used by the context planner for fine-grained full-vs-summary control. */
export async function readFileSafe(
  root: string,
  rel: string,
  maxFileBytes: number,
  extraSecrets: string[] = [],
): Promise<ReadResult> {
  const gate = isReadable(rel)
  if (!gate.ok) return { ok: false, reason: gate.reason || 'not-readable' }
  const abs = resolveSafe(root, rel)
  if (!abs) return { ok: false, reason: 'path-traversal' }

  let buf: Buffer
  try {
    buf = await fs.readFile(abs)
  } catch {
    return { ok: false, reason: 'read-error' }
  }
  if (looksBinary(buf)) return { ok: false, reason: 'binary-content' }

  const truncated = buf.length > maxFileBytes
  const slice = truncated ? buf.subarray(0, maxFileBytes) : buf
  const content = redact(slice.toString('utf8'), extraSecrets)
  return { ok: true, content, bytes: Buffer.byteLength(content, 'utf8'), truncated }
}

export async function loadContext(
  root: string,
  relPaths: string[],
  limits: LoadLimits,
  extraSecrets: string[] = [],
): Promise<LoadedContext> {
  const files: LoadedFile[] = []
  const skipped: SkippedFile[] = []
  let totalBytes = 0

  for (const rel of relPaths) {
    const gate = isReadable(rel)
    if (!gate.ok) {
      skipped.push({ path: rel, reason: gate.reason || 'not-readable' })
      continue
    }

    const abs = resolveSafe(root, rel)
    if (!abs) {
      skipped.push({ path: rel, reason: 'path-traversal' })
      continue
    }

    let buf: Buffer
    try {
      buf = await fs.readFile(abs)
    } catch {
      skipped.push({ path: rel, reason: 'read-error' })
      continue
    }

    if (looksBinary(buf)) {
      skipped.push({ path: rel, reason: 'binary-content' })
      continue
    }

    const truncated = buf.length > limits.maxFileBytes
    const slice = truncated ? buf.subarray(0, limits.maxFileBytes) : buf
    const content = redact(slice.toString('utf8'), extraSecrets)
    const bytes = Buffer.byteLength(content, 'utf8')

    if (totalBytes + bytes > limits.maxContextBytes) {
      skipped.push({ path: rel, reason: 'context-budget' })
      continue
    }

    files.push({ path: rel, content, bytes, truncated })
    totalBytes += bytes
  }

  return { files, skipped, totalBytes }
}
