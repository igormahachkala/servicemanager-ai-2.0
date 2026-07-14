/**
 * Unified Cursor Result Envelope — stable serialization (AI-COMPANY-110).
 */

import type { CursorResultEnvelope } from './cursorResultEnvelopeTypes'

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
export function serializeCursorResultEnvelope(envelope: CursorResultEnvelope): string {
  return JSON.stringify(sortValue(envelope))
}

export function cloneCursorResultEnvelope(envelope: CursorResultEnvelope): CursorResultEnvelope {
  return JSON.parse(serializeCursorResultEnvelope(envelope)) as CursorResultEnvelope
}
