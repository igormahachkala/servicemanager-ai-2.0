import type { MemoryEntry, MemorySource } from './memoryEntry'

/**
 * Memory reconciliation — deterministic contradiction/staleness control for
 * digital-employee memory (Digital DNA). Non-destructive: it never deletes; it
 * decides which overlapping same-subject entries a new memory SUPERSEDES, by
 * source authority (human-originated > machine-derived) then recency.
 *
 * This is the deterministic half. Semantic contradiction judgment ("do these two
 * facts actually conflict, or merely co-exist?") is a model-layer step that plugs
 * into the same decision via the `conflicts` output.
 */

// Human/owner-originated sources outrank machine-derived ones (North Star: user > agent).
const SOURCE_AUTHORITY: Record<MemorySource, number> = {
  manual: 5,
  conversation: 4,
  discussion: 4,
  document: 3,
  task: 2,
  run: 2,
  workspace: 1,
  system: 1,
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'are', 'was',
  'и', 'на', 'по', 'для', 'что', 'это', 'как',
])

function tokens(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-zа-яё0-9]{3,}/gi) ?? []).filter((t) => !STOPWORDS.has(t)))
}

/** Jaccard overlap over title+summary+content+tags. 0..1. */
export function memorySimilarity(a: MemoryEntry, b: MemoryEntry): number {
  const ta = tokens(`${a.title} ${a.summary} ${a.content} ${a.tags.join(' ')}`)
  const tb = tokens(`${b.title} ${b.summary} ${b.content} ${b.tags.join(' ')}`)
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / (ta.size + tb.size - inter)
}

function authority(source: MemorySource): number {
  return SOURCE_AUTHORITY[source] ?? 1
}

/** True when `challenger` should supersede `incumbent`: authority first, then recency. */
function winsOver(challenger: MemoryEntry, incumbent: MemoryEntry): boolean {
  const ca = authority(challenger.source)
  const ia = authority(incumbent.source)
  if (ca !== ia) return ca > ia
  return challenger.createdAt >= incumbent.createdAt
}

export type MemoryConflict = { existingId: string; similarity: number }

export type MemoryReconciliation = {
  /** Same-subject overlapping entries above threshold — candidates for a real contradiction check. */
  conflicts: MemoryConflict[]
  /** Existing entries the incoming memory supersedes (mark stale, keep for history). */
  supersededExistingIds: string[]
  /** False when a stronger existing entry supersedes the incoming (incoming is itself stale). */
  incomingIsCurrent: boolean
  /** Set when incomingIsCurrent is false: the existing entry that wins. */
  supersededByExistingId: string | null
}

export type ReconcileOptions = {
  /** Minimum Jaccard similarity to treat two entries as the same subject. Default 0.4. */
  similarityThreshold?: number
}

/**
 * Reconcile an incoming memory against an employee's existing memories.
 * Compares only same-type, same-workspace entries — a conflict lives within a subject scope.
 */
export function reconcileMemory(
  incoming: MemoryEntry,
  existing: MemoryEntry[],
  options: ReconcileOptions = {},
): MemoryReconciliation {
  const threshold = options.similarityThreshold ?? 0.4
  const conflicts: MemoryConflict[] = []
  const supersededExistingIds: string[] = []
  let incomingIsCurrent = true
  let supersededByExistingId: string | null = null

  for (const entry of existing) {
    if (entry.id === incoming.id) continue
    if (entry.type !== incoming.type) continue
    if ((entry.workspaceId ?? null) !== (incoming.workspaceId ?? null)) continue

    const sim = memorySimilarity(incoming, entry)
    if (sim < threshold) continue

    conflicts.push({ existingId: entry.id, similarity: Number(sim.toFixed(3)) })

    if (winsOver(incoming, entry)) {
      supersededExistingIds.push(entry.id)
    } else {
      incomingIsCurrent = false
      if (!supersededByExistingId) supersededByExistingId = entry.id
    }
  }

  return { conflicts, supersededExistingIds, incomingIsCurrent, supersededByExistingId }
}
