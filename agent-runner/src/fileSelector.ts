/**
 * File selection: turn a task (title + prompt) into a bounded, PRIORITY-ranked
 * list of relative file paths to load as code context. Read-only directory walk
 * within the allowlist; never reads file contents (that's the loader's job).
 *
 * Priority tiers (highest first) ensure the core files of a module
 * (controller/service/module, then policy/access/workflow/utils) win over
 * DTO/types, and tests (spec/test) are deprioritised so they cannot crowd out
 * the main logic within the file/byte budget.
 */

import { promises as fs } from 'fs'
import { join, sep, basename } from 'path'

import { ALLOWED_DIRS, ALLOWED_FILES, isDenyDir, isReadable } from './codePolicy'

const norm = (p: string) => p.split(sep).join('/')

interface KeywordGroup {
  keys: string[]
  match: (rel: string) => boolean
}

const startsWithAny = (rel: string, prefixes: string[]) => prefixes.some((p) => rel.startsWith(p))

const KEYWORD_GROUPS: KeywordGroup[] = [
  {
    keys: ['tickets', 'ticket', 'заявк', 'заявка', 'заявки'],
    match: (r) =>
      startsWithAny(r, ['backend/src/tickets/', 'backend/src/workflow/']) ||
      /^web\/src\/mobile\/MobileTicket/.test(r) ||
      /^web\/src\/views\/.*Ticket/.test(r),
  },
  { keys: ['auth', 'login', 'jwt', 'token', 'авториз', 'логин'], match: (r) => r.startsWith('backend/src/auth/') },
  {
    keys: ['permissions', 'permission', 'roles', 'role', 'guard', 'права', 'роли', 'политик', 'policy'],
    match: (r) => startsWithAny(r, ['backend/src/common/', 'backend/src/policy/']),
  },
  {
    keys: ['analytics', 'аналитик', 'метрик', 'metrics'],
    match: (r) => r.startsWith('backend/src/analytics/') || /^web\/src\/views\/.*Analytics/.test(r),
  },
  { keys: ['mobile', 'мобильн'], match: (r) => r.startsWith('web/src/mobile/') },
]

export type PriorityTier = 'highest' | 'high' | 'normal' | 'medium' | 'low'

export interface SelectedFile {
  path: string
  tier: PriorityTier
  rank: number
  score: number
}

export interface SelectionResult {
  selected: string[]
  details: SelectedFile[]
  matchedGroups: string[]
  mode: 'keyword' | 'token' | 'none'
  totalCandidates: number
}

/** Rank by tier; higher rank = loaded first / kept under budget. */
const TIER_RANK: Record<PriorityTier, number> = { highest: 5, high: 4, normal: 3, medium: 2, low: 1 }

export function priorityOf(rel: string): { tier: PriorityTier; rank: number } {
  const base = basename(rel)
  // tests are always lowest, even if the name also matches utils/access/etc.
  if (/\.(spec|test)\.tsx?$/.test(base)) return tier('low')
  if (/\.(controller|service|module)\.tsx?$/.test(base)) return tier('highest')
  if (/(policy|access|workflow|utils)/i.test(base) && /\.tsx?$/.test(base)) return tier('high')
  if (/(^|\/)(dto|types)\//.test(rel) || /\.(dto|types)\.tsx?$/.test(base)) return tier('medium')
  return tier('normal')
}

function tier(t: PriorityTier): { tier: PriorityTier; rank: number } {
  return { tier: t, rank: TIER_RANK[t] }
}

/** Recursively list readable relative files under the allowlist. */
export async function listAllowedFiles(root: string): Promise<string[]> {
  const out: string[] = []

  async function walk(relDir: string) {
    let entries
    try {
      entries = await fs.readdir(join(root, relDir), { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (isDenyDir(e.name)) continue
        await walk(relDir ? `${relDir}/${e.name}` : e.name)
      } else if (e.isFile()) {
        const rel = relDir ? `${relDir}/${e.name}` : e.name
        if (isReadable(rel).ok) out.push(norm(rel))
      }
    }
  }

  for (const d of ALLOWED_DIRS) await walk(d)
  for (const f of ALLOWED_FILES) {
    try {
      const st = await fs.stat(join(root, f))
      if (st.isFile() && isReadable(f).ok) out.push(norm(f))
    } catch {
      /* missing optional file */
    }
  }
  return out
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-zа-я0-9_]{3,}/giu) || []).map((t) => t.toLowerCase())
}

function scorePath(rel: string, tokens: string[]): number {
  const low = rel.toLowerCase()
  let score = 0
  for (const t of tokens) if (low.includes(t)) score += 1
  return score
}

function toDetails(paths: string[], tokens: string[]): SelectedFile[] {
  return paths.map((path) => {
    const { tier: t, rank } = priorityOf(path)
    return { path, tier: t, rank, score: scorePath(path, tokens) }
  })
}

/** Select up to `maxFiles` relative paths most relevant to the task. */
export async function selectFiles(
  root: string,
  task: { title: string; prompt: string },
  maxFiles: number,
): Promise<SelectionResult> {
  const all = await listAllowedFiles(root)
  const text = `${task.title}\n${task.prompt}`.toLowerCase()
  const tokens = tokenize(text)

  // 1) keyword groups
  const matchedGroups: string[] = []
  const keywordHits = new Set<string>()
  for (const g of KEYWORD_GROUPS) {
    if (g.keys.some((k) => text.includes(k))) {
      matchedGroups.push(g.keys[0])
      for (const rel of all) if (g.match(rel)) keywordHits.add(rel)
    }
  }

  if (keywordHits.size > 0) {
    const ranked = toDetails([...keywordHits], tokens).sort(cmpByPriorityThenScore)
    const top = ranked.slice(0, maxFiles)
    return {
      selected: top.map((d) => d.path),
      details: top,
      matchedGroups,
      mode: 'keyword',
      totalCandidates: keywordHits.size,
    }
  }

  // 2) fallback: token/path matching, then priority as tiebreaker
  const scored = toDetails(all, tokens)
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score || b.rank - a.rank || a.path.localeCompare(b.path))

  if (scored.length > 0) {
    const top = scored.slice(0, maxFiles)
    return { selected: top.map((d) => d.path), details: top, matchedGroups, mode: 'token', totalCandidates: scored.length }
  }

  return { selected: [], details: [], matchedGroups, mode: 'none', totalCandidates: 0 }
}

/** Module-analysis ordering: priority tier first, then task relevance, then path. */
function cmpByPriorityThenScore(a: SelectedFile, b: SelectedFile): number {
  return b.rank - a.rank || b.score - a.score || a.path.localeCompare(b.path)
}
