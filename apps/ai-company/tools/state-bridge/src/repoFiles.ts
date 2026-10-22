/**
 * Read-only access to the project's files for analysis tasks: the owner picks
 * files in the panel, the model gets their text in the prompt.
 *
 * Only text files under the repository root; no dot-directories, build output
 * or dependencies; no path escapes; size-capped. Never writes.
 */

import fs from 'node:fs'
import path from 'node:path'

export const MAX_FILE_BYTES = 200 * 1024
const INDEX_TTL_MS = 60_000
const MAX_INDEX_FILES = 50_000

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', 'out', 'coverage', '.git', '.next', '.turbo', '.cache',
  '.npm-cache', '.state', 'tmp', 'docs_pdf', 'vendor', '__pycache__', '.venv', 'venv',
])

const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.mdx', '.txt', '.css', '.scss',
  '.html', '.yml', '.yaml', '.toml', '.sql', '.prisma', '.py', '.sh', '.ps1', '.go', '.rs',
  '.java', '.kt', '.swift', '.vue', '.svelte', '.graphql', '.env.example', '.conf', '.ini', '.xml',
])

const SECRET_NAME = /(^\.env($|\.(?!example))|secret|\.pem$|\.key$|id_rsa|credentials)/i

function isTextFile(name: string): boolean {
  if (SECRET_NAME.test(name)) return false
  if (name.endsWith('.env.example')) return true
  return TEXT_EXT.has(path.extname(name).toLowerCase())
}

export type RepoFiles = {
  root: string
  search(query: string, limit?: number): string[]
  read(relPath: string): { path: string; content: string; truncated: boolean; bytes: number }
}

export function createRepoFiles(root: string): RepoFiles {
  const absRoot = path.resolve(root)
  let index: string[] = []
  let indexedAt = 0

  function walk(dir: string, rel: string, out: string[]): void {
    if (out.length >= MAX_INDEX_FILES) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env.example') {
        if (entry.isDirectory()) continue
      }
      const childRel = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        walk(path.join(dir, entry.name), childRel, out)
      } else if (entry.isFile() && isTextFile(entry.name)) {
        out.push(childRel)
      }
    }
  }

  function ensureIndex(): string[] {
    if (Date.now() - indexedAt > INDEX_TTL_MS) {
      const out: string[] = []
      walk(absRoot, '', out)
      index = out.sort()
      indexedAt = Date.now()
    }
    return index
  }

  function resolveInside(relPath: string): string {
    const cleaned = relPath.replace(/\\/g, '/').replace(/^\/+/, '')
    const abs = path.resolve(absRoot, cleaned)
    if (abs !== absRoot && !abs.startsWith(absRoot + path.sep)) throw new Error('path outside the repository')
    const parts = cleaned.split('/')
    if (parts.some((p) => SKIP_DIRS.has(p) || (p.startsWith('.') && p !== '.env.example'))) {
      throw new Error('path not allowed')
    }
    if (!isTextFile(parts[parts.length - 1] ?? '')) throw new Error('not a readable text file')
    return abs
  }

  return {
    root: absRoot,

    search(query, limit = 40) {
      const files = ensureIndex()
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
      if (terms.length === 0) return []
      const scored: Array<{ p: string; score: number }> = []
      for (const p of files) {
        const lower = p.toLowerCase()
        if (!terms.every((t) => lower.includes(t))) continue
        const base = lower.slice(lower.lastIndexOf('/') + 1)
        // file-name hits first, then shorter paths
        const score = (terms.every((t) => base.includes(t)) ? 0 : 1000) + p.length
        scored.push({ p, score })
      }
      return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((s) => s.p)
    },

    read(relPath) {
      const abs = resolveInside(relPath)
      const stat = fs.statSync(abs)
      if (!stat.isFile()) throw new Error('not a file')
      const fd = fs.openSync(abs, 'r')
      try {
        const size = Math.min(stat.size, MAX_FILE_BYTES)
        const buf = Buffer.alloc(size)
        fs.readSync(fd, buf, 0, size, 0)
        return {
          path: relPath.replace(/\\/g, '/').replace(/^\/+/, ''),
          content: buf.toString('utf8'),
          truncated: stat.size > MAX_FILE_BYTES,
          bytes: stat.size,
        }
      } finally {
        fs.closeSync(fd)
      }
    },
  }
}
