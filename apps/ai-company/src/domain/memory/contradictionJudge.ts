import type { MemoryConflict } from './memoryReconciliation'

export type ContradictionVerdict = { contradicts: boolean; duplicate: boolean }

/**
 * Judges whether two same-subject memories actually CONTRADICT, are DUPLICATES, or
 * merely coexist. The real judge is model-backed (frontier/local) — this interface
 * lets it plug in. reconcileMemory() surfaces the candidates; the judge decides.
 */
export interface ContradictionJudge {
  judge(a: string, b: string): Promise<ContradictionVerdict>
}

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-zа-яё0-9]{3,}/gi) ?? [])
}
function jaccard(a: string, b: string): number {
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / (ta.size + tb.size - inter)
}

/**
 * Deterministic, offline default. Deliberately CONSERVATIVE: it only asserts
 * `duplicate` for near-identical text and never asserts `contradicts` (semantic
 * contradiction needs a model). Keeps the pipeline working with zero config; swap in
 * an LLM-backed judge for real contradiction detection via the same interface.
 */
export class HeuristicContradictionJudge implements ContradictionJudge {
  private readonly duplicateThreshold: number
  constructor(duplicateThreshold = 0.9) {
    this.duplicateThreshold = duplicateThreshold
  }
  async judge(a: string, b: string): Promise<ContradictionVerdict> {
    return { contradicts: false, duplicate: jaccard(a, b) >= this.duplicateThreshold }
  }
}

/** Scriptable judge for tests / fixtures. */
export class ScriptedContradictionJudge implements ContradictionJudge {
  private readonly fn: (a: string, b: string) => ContradictionVerdict
  constructor(fn: (a: string, b: string) => ContradictionVerdict) {
    this.fn = fn
  }
  async judge(a: string, b: string): Promise<ContradictionVerdict> {
    return this.fn(a, b)
  }
}

/** Classify reconcile conflicts by per-conflict verdict (verdicts keyed by existingId). */
export function partitionConflictsByVerdict(
  conflicts: MemoryConflict[],
  verdicts: Record<string, ContradictionVerdict>,
): { contradictingIds: string[]; duplicateIds: string[]; coexistingIds: string[] } {
  const contradictingIds: string[] = []
  const duplicateIds: string[] = []
  const coexistingIds: string[] = []
  for (const c of conflicts) {
    const v = verdicts[c.existingId]
    if (v?.duplicate) duplicateIds.push(c.existingId)
    else if (v?.contradicts) contradictingIds.push(c.existingId)
    else coexistingIds.push(c.existingId)
  }
  return { contradictingIds, duplicateIds, coexistingIds }
}
