import type { MemoryEntry } from './memoryEntry'
import type { MemoryReconciliation } from './memoryReconciliation'

export const SUPERSEDED_TAG = 'superseded'
export const STALE_TAG = 'stale'
export function supersededByTag(id: string): string {
  return `superseded-by:${id}`
}

function withTags(entry: MemoryEntry, stamp: string, ...tags: string[]): MemoryEntry {
  return { ...entry, tags: [...new Set([...entry.tags, ...tags])], updatedAt: stamp }
}

/**
 * Apply a reconciliation decision NON-DESTRUCTIVELY. Nothing is deleted:
 * - superseded existing entries get `superseded` + `superseded-by:<incomingId>`;
 * - a stale incoming (beaten by a stronger existing) gets `stale` + `superseded-by:<winnerId>`.
 * Returns fresh arrays; the caller persists them (storage stays out of this pure step).
 */
export function applyReconciliation(
  incoming: MemoryEntry,
  existing: MemoryEntry[],
  decision: MemoryReconciliation,
  now?: string,
): { incoming: MemoryEntry; updatedExisting: MemoryEntry[] } {
  const stamp = now ?? incoming.updatedAt
  const superseded = new Set(decision.supersededExistingIds)

  const updatedExisting = existing.map((e) =>
    superseded.has(e.id) ? withTags(e, stamp, SUPERSEDED_TAG, supersededByTag(incoming.id)) : e,
  )

  const incomingOut =
    !decision.incomingIsCurrent && decision.supersededByExistingId
      ? withTags(incoming, stamp, STALE_TAG, supersededByTag(decision.supersededByExistingId))
      : incoming

  return { incoming: incomingOut, updatedExisting }
}
