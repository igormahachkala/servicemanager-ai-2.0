/**
 * Fast Context Mode planner.
 *
 * Given a task it: (1) detects the module via profiles, (2) uses the cached
 * project index to pick candidate files without reading them, (3) ranks them
 * (anchors → core types → relevance), (4) loads the top files FULLY within the
 * byte budget and represents the rest as cached SUMMARIES, reading full content
 * only when needed. Read-only over CODE_ROOT; the only writes are the JSON
 * caches under agent-runner/.cache/.
 */

import type { Config } from './config'
import type { AgentTask } from './smaClient'
import type { LoadedFile, LoadedContext, SkippedFile } from './contextLoader'
import { readFileSafe } from './contextLoader'
import { loadOrBuildIndex, type FileType } from './projectIndex'
import { profileForText, isAnchor, type ModuleProfile } from './moduleProfiles'
import { FileSummaryCache, renderSummary } from './fileSummaryCache'
import { selectFiles } from './fileSelector'

export interface PlannedSummary {
  path: string
  content: string
  fromCache: boolean
}

export interface ContextPlan {
  profileId: string | null
  selectionMode: 'profile' | 'token' | 'none'
  candidates: number
  fullFiles: LoadedFile[]
  summaryFiles: PlannedSummary[]
  skipped: SkippedFile[]
  planMs: number
  indexFromCache: boolean
  cacheHits: number
  cacheMisses: number
}

const TYPE_RANK: Record<FileType, number> = {
  controller: 5, service: 5, module: 5, policy: 4, util: 4, other: 3, dto: 2, test: 1,
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-zа-я0-9_]{3,}/giu) || []).map((t) => t.toLowerCase())
}

export async function planContext(config: Config, task: AgentTask, secrets: string[]): Promise<ContextPlan> {
  const t0 = Date.now()
  const text = `${task.title}\n${task.prompt}`
  const tokens = tokenize(text)

  const { index, fromCache } = await loadOrBuildIndex(config.codeRoot, config.projectIndexPath)
  const profile = config.enableModuleProfiles ? profileForText(text) : null

  // 1) candidate paths
  let candidatePaths: string[]
  let selectionMode: ContextPlan['selectionMode']
  if (profile) {
    const inModule = index.files.filter((f) => profile.includes(f.path))
    candidatePaths = rankByProfile(inModule.map((f) => f.path), profile, index, tokens)
    selectionMode = 'profile'
  } else {
    const sel = await selectFiles(config.codeRoot, task, config.maxContextFiles)
    candidatePaths = sel.selected
    selectionMode = sel.mode === 'none' ? 'none' : 'token'
  }

  const candidates = candidatePaths.length
  candidatePaths = candidatePaths.slice(0, config.maxContextFiles)

  // 2) load: full until byte budget, then summary-only
  const cache = new FileSummaryCache(config.fileSummaryCachePath, config.enableSummaryCache)
  await cache.load()

  const fullFiles: LoadedFile[] = []
  const summaryFiles: PlannedSummary[] = []
  const skipped: SkippedFile[] = []
  let fullBytes = 0

  for (const rel of candidatePaths) {
    const read = await readFileSafe(config.codeRoot, rel, config.maxFileBytes, secrets)
    if (!read.ok) {
      skipped.push({ path: rel, reason: read.reason })
      continue
    }
    const fitsFull = fullBytes + read.bytes <= config.maxContextBytes
    if (fitsFull) {
      fullFiles.push({ path: rel, content: read.content, bytes: read.bytes, truncated: read.truncated })
      fullBytes += read.bytes
    } else {
      const { summary, fromCache: hit } = cache.summarize(rel, read.content)
      summaryFiles.push({ path: rel, content: renderSummary(summary), fromCache: hit })
    }
  }

  await cache.save()

  return {
    profileId: profile?.id ?? null,
    selectionMode,
    candidates,
    fullFiles,
    summaryFiles,
    skipped,
    planMs: Date.now() - t0,
    indexFromCache: fromCache,
    cacheHits: cache.hits,
    cacheMisses: cache.misses,
  }
}

/** Convert a plan into a LoadedContext for the prompt builder (full files +
 *  summary-only files rendered as compact context entries). */
export function planToContext(plan: ContextPlan): LoadedContext {
  const summaryAsFiles: LoadedFile[] = plan.summaryFiles.map((s) => ({
    path: s.path,
    content: s.content,
    bytes: Buffer.byteLength(s.content, 'utf8'),
    truncated: false,
  }))
  const files = [...plan.fullFiles, ...summaryAsFiles]
  const totalBytes = files.reduce((n, f) => n + f.bytes, 0)
  return { files, skipped: plan.skipped, totalBytes }
}

function rankByProfile(paths: string[], profile: ModuleProfile, index: { files: { path: string; type: FileType }[] }, tokens: string[]): string[] {
  const typeByPath = new Map(index.files.map((f) => [f.path, f.type]))
  const score = (rel: string): number => {
    let s = 0
    if (isAnchor(profile, rel)) s += 100
    s += (TYPE_RANK[typeByPath.get(rel) || 'other'] || 3) * 10
    const low = rel.toLowerCase()
    for (const t of tokens) if (low.includes(t)) s += 1
    return s
  }
  return [...paths].sort((a, b) => score(b) - score(a) || a.localeCompare(b))
}
