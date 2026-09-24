/**
 * Project index: a cached map of the codebase so the agent does not re-discover
 * structure on every task. Records, per file: module, type, size, and resolved
 * relative imports (edges). Persisted as JSON under agent-runner/.cache/.
 *
 * Read-only over CODE_ROOT; the only write is the JSON index inside the cache.
 */

import { promises as fs } from 'fs'
import { dirname, basename } from 'path'

import { listAllowedFiles } from './fileSelector'
import { resolveSafe } from './codePolicy'

export type FileType = 'controller' | 'service' | 'module' | 'dto' | 'util' | 'policy' | 'test' | 'other'

export interface IndexedFile {
  path: string
  module: string
  type: FileType
  bytes: number
  imports: string[]
}

export interface ProjectIndex {
  root: string
  builtAt: string
  fileCount: number
  modules: Record<string, { files: number; byType: Partial<Record<FileType, number>> }>
  files: IndexedFile[]
}

export function classifyType(rel: string): FileType {
  const base = basename(rel)
  if (/\.(spec|test)\.tsx?$/.test(base)) return 'test'
  if (/\.controller\.tsx?$/.test(base)) return 'controller'
  if (/\.service\.tsx?$/.test(base)) return 'service'
  if (/\.module\.tsx?$/.test(base)) return 'module'
  if (/(^|\/)dto\//.test(rel) || /\.dto\.tsx?$/.test(base)) return 'dto'
  if (/policy/i.test(rel)) return 'policy'
  if (/util/i.test(base)) return 'util'
  return 'other'
}

export function moduleOf(rel: string): string {
  const m = rel.match(/^backend\/src\/([^/]+)\//)
  if (m) return m[1]
  if (rel === 'backend/prisma/schema.prisma') return 'prisma'
  const w = rel.match(/^web\/src\/([^/]+)\//)
  if (w) return `web-${w[1]}`
  return 'other'
}

const REL_IMPORT = /(?:from|import|require\()\s*['"](\.[^'"]+)['"]/g

/** Resolve a relative import specifier to a known repo-relative path. */
function resolveImport(fromRel: string, spec: string, known: Set<string>): string | null {
  const baseDir = dirname(fromRel)
  const joined = normalizeJoin(baseDir, spec)
  const candidates = [
    joined,
    `${joined}.ts`,
    `${joined}.tsx`,
    `${joined}/index.ts`,
    `${joined}/index.tsx`,
  ]
  for (const c of candidates) if (known.has(c)) return c
  return null
}

function normalizeJoin(baseDir: string, spec: string): string {
  const parts = `${baseDir}/${spec}`.split('/')
  const out: string[] = []
  for (const p of parts) {
    if (p === '' || p === '.') continue
    if (p === '..') out.pop()
    else out.push(p)
  }
  return out.join('/')
}

export async function buildIndex(root: string): Promise<ProjectIndex> {
  const files = await listAllowedFiles(root)
  const known = new Set(files)
  const indexed: IndexedFile[] = []

  for (const rel of files) {
    const abs = resolveSafe(root, rel)
    if (!abs) continue
    let content = ''
    let bytes = 0
    try {
      const buf = await fs.readFile(abs)
      bytes = buf.length
      content = buf.toString('utf8')
    } catch {
      continue
    }
    const imports = new Set<string>()
    let m: RegExpExecArray | null
    REL_IMPORT.lastIndex = 0
    while ((m = REL_IMPORT.exec(content))) {
      const resolved = resolveImport(rel, m[1], known)
      if (resolved) imports.add(resolved)
    }
    indexed.push({ path: rel, module: moduleOf(rel), type: classifyType(rel), bytes, imports: [...imports] })
  }

  const modules: ProjectIndex['modules'] = {}
  for (const f of indexed) {
    const mod = (modules[f.module] ||= { files: 0, byType: {} })
    mod.files += 1
    mod.byType[f.type] = (mod.byType[f.type] || 0) + 1
  }

  return { root, builtAt: new Date().toISOString(), fileCount: indexed.length, modules, files: indexed }
}

export async function loadOrBuildIndex(root: string, indexPath: string): Promise<{ index: ProjectIndex; fromCache: boolean }> {
  try {
    const raw = await fs.readFile(indexPath, 'utf8')
    const idx = JSON.parse(raw) as ProjectIndex
    if (idx.root === root && Array.isArray(idx.files)) return { index: idx, fromCache: true }
  } catch {
    /* not cached / unreadable — rebuild */
  }
  const index = await buildIndex(root)
  await saveIndex(index, indexPath)
  return { index, fromCache: false }
}

async function saveIndex(index: ProjectIndex, indexPath: string): Promise<void> {
  await fs.mkdir(dirname(indexPath), { recursive: true })
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8')
}
