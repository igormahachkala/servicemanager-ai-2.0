/**
 * File summary cache: a per-file short description keyed by content hash.
 * If the file is unchanged (same hash) the cached summary is reused, so the
 * agent does not re-derive structure every task.
 *
 * Summaries are produced by a DETERMINISTIC heuristic (no model needed): role,
 * key exported symbols, and light risk flags. Persisted as JSON under
 * agent-runner/.cache/. The only write is that cache file.
 */

import { promises as fs } from 'fs'
import { createHash } from 'crypto'
import { dirname } from 'path'

import { classifyType, moduleOf } from './projectIndex'

export interface FileSummary {
  path: string
  hash: string
  role: string
  symbols: string[]
  risks: string[]
  lines: number
}

export interface SummaryCacheData {
  version: number
  entries: Record<string, FileSummary> // key: path
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

export class FileSummaryCache {
  private data: SummaryCacheData = { version: 1, entries: {} }
  private dirty = false
  hits = 0
  misses = 0

  constructor(private readonly cachePath: string, private readonly enabled: boolean) {}

  async load(): Promise<void> {
    if (!this.enabled) return
    try {
      const raw = await fs.readFile(this.cachePath, 'utf8')
      const parsed = JSON.parse(raw) as SummaryCacheData
      if (parsed?.entries) this.data = parsed
    } catch {
      /* no cache yet */
    }
  }

  /** Return a summary, reusing cache when hash matches, else compute + store. */
  summarize(path: string, content: string): { summary: FileSummary; fromCache: boolean } {
    const hash = hashContent(content)
    const cached = this.data.entries[path]
    if (this.enabled && cached && cached.hash === hash) {
      this.hits += 1
      return { summary: cached, fromCache: true }
    }
    this.misses += 1
    const summary = summarize(path, content, hash)
    if (this.enabled) {
      this.data.entries[path] = summary
      this.dirty = true
    }
    return { summary, fromCache: false }
  }

  async save(): Promise<void> {
    if (!this.enabled || !this.dirty) return
    await fs.mkdir(dirname(this.cachePath), { recursive: true })
    await fs.writeFile(this.cachePath, JSON.stringify(this.data, null, 2), 'utf8')
    this.dirty = false
  }
}

/** Deterministic heuristic summary — no model, no network. */
export function summarize(path: string, content: string, hash: string): FileSummary {
  const type = classifyType(path)
  const mod = moduleOf(path)
  const lines = content.split('\n').length

  const symbols = new Set<string>()
  const reExport = /export\s+(?:default\s+)?(?:abstract\s+)?(class|function|const|interface|type|enum)\s+([A-Za-z0-9_]+)/g
  let m: RegExpExecArray | null
  while ((m = reExport.exec(content))) symbols.add(`${m[1]} ${m[2]}`)
  for (const dec of ['@Controller', '@Injectable', '@Module', '@Entity']) {
    if (content.includes(dec)) symbols.add(dec)
  }

  const risks: string[] = []
  const prismaCalls = (content.match(/prisma\.\w+\./g) || []).length
  const mentionsCompany = /companyId/.test(content)
  if ((type === 'service' || type === 'controller') && prismaCalls > 0 && !mentionsCompany) {
    risks.push('DB access without visible companyId scoping')
  }
  if (type === 'controller' && prismaCalls > 0) risks.push('direct DB access in controller (business logic leak)')
  if (prismaCalls >= 12) risks.push(`heavy DB usage (${prismaCalls} prisma calls)`)
  if ((content.match(/:\s*any\b/g) || []).length >= 10) risks.push('many `any` types')
  if (lines >= 400) risks.push(`large file (${lines} lines)`)

  return {
    path,
    hash,
    role: `${type} in module "${mod}"`,
    symbols: [...symbols].slice(0, 12),
    risks,
    lines,
  }
}

/** Render a compact summary block for inclusion in the prompt context. */
export function renderSummary(s: FileSummary): string {
  const lines = [
    `// CACHED SUMMARY — ${s.path}`,
    `// role: ${s.role}; lines: ${s.lines}`,
  ]
  if (s.symbols.length) lines.push(`// symbols: ${s.symbols.join(', ')}`)
  if (s.risks.length) lines.push(`// risk flags: ${s.risks.join('; ')}`)
  return lines.join('\n')
}
