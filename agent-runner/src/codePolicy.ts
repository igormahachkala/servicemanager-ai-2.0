/**
 * Code-access policy for the V1 context loader.
 *
 * Enforces WHERE the runner may read from (allowlist) and WHAT it must never
 * read (denylist: secrets, env files, keys, vendored/build dirs, binaries),
 * plus path-traversal protection. Read-only; this module never writes or execs.
 */

import { resolve, sep, extname, basename } from 'path'

/** Directories (relative to CODE_ROOT) the runner may read from. */
export const ALLOWED_DIRS = ['backend/src', 'web/src']

/** Individual extra files allowed outside the allowed dirs. */
export const ALLOWED_FILES = ['backend/prisma/schema.prisma']

/** Directory names that are never descended into. */
export const DENY_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', 'build', '.next'])

/** Filename / path patterns that must never be read. */
const DENY_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\..*)?$/i, // .env, .env.docker, .env.local ...
  /\.pem$/i,
  /\.key$/i,
  /(^|\/)id_rsa/i,
  /secret/i,
  /credential/i,
  /\.p12$/i,
  /\.pfx$/i,
  /(^|\/)\.git(\/|$)/i,
]

/** Binary / non-text extensions to skip. */
const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.svg',
  '.pdf', '.zip', '.gz', '.tar', '.tgz', '.7z', '.rar',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp4', '.mov', '.avi', '.mp3', '.wav',
  '.lock', '.wasm', '.node', '.bin', '.exe', '.dll', '.so', '.dylib',
])

const norm = (p: string) => p.split(sep).join('/')

/** Resolve `rel` under `root`, returning the absolute path only if it stays
 *  inside `root` (defeats `..` traversal and absolute-path injection). */
export function resolveSafe(root: string, rel: string): string | null {
  const rootAbs = resolve(root)
  const abs = resolve(rootAbs, rel)
  if (abs !== rootAbs && !abs.startsWith(rootAbs + sep)) return null
  return abs
}

/** True if a relative path sits within an allowed dir / allowed file. */
export function isWithinAllowed(relPath: string): boolean {
  const rel = norm(relPath)
  if (ALLOWED_FILES.includes(rel)) return true
  return ALLOWED_DIRS.some((d) => rel === d || rel.startsWith(d + '/'))
}

/** True if a relative path matches a denylist pattern. */
export function isDenied(relPath: string): boolean {
  const rel = norm(relPath)
  return DENY_PATTERNS.some((re) => re.test(rel))
}

export function isDenyDir(name: string): boolean {
  return DENY_DIRS.has(name)
}

export function isBinaryName(relPath: string): boolean {
  return BINARY_EXT.has(extname(relPath).toLowerCase())
}

/** Content-level binary sniff: NUL byte in the sampled head. */
export function looksBinary(sample: Buffer): boolean {
  const n = Math.min(sample.length, 4096)
  for (let i = 0; i < n; i++) if (sample[i] === 0) return true
  return false
}

/** Single gate used by the loader: allowed location, not denied, not binary. */
export function isReadable(relPath: string): { ok: boolean; reason?: string } {
  if (!isWithinAllowed(relPath)) return { ok: false, reason: 'outside-allowlist' }
  if (isDenied(relPath)) return { ok: false, reason: 'denylist' }
  if (isBinaryName(relPath)) return { ok: false, reason: 'binary' }
  if (basename(relPath).startsWith('.')) return { ok: false, reason: 'dotfile' }
  return { ok: true }
}
