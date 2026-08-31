/**
 * Unified Cursor Result Envelope — stable serialization (AI-COMPANY-110).
 */

import type {
  CursorResultEnvelope,
  ExecutionResultEnvelope,
} from './cursorResultEnvelopeTypes'

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue)
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortValue(record[key])
    }
    return sorted
  }
  return value
}

/** Deterministic JSON for tests and persistence comparisons. */
/**
 * Accepts the supertype: serialization is route-blind, and a LOCAL_OLLAMA_ANALYSIS
 * envelope has to reach ToolExecutionRun.result the same way a Cursor one does.
 * Widening a parameter accepts strictly more, so every existing caller is
 * unaffected.
 */
export function serializeCursorResultEnvelope(envelope: ExecutionResultEnvelope): string {
  return JSON.stringify(sortValue(envelope))
}

export function cloneCursorResultEnvelope(envelope: CursorResultEnvelope): CursorResultEnvelope {
  return JSON.parse(serializeCursorResultEnvelope(envelope)) as CursorResultEnvelope
}
