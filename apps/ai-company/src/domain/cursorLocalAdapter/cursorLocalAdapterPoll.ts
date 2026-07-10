/**
 * Poll Cursor local task outbox (AI-COMPANY-113C).
 */

import type { CursorLocalPollResult } from './cursorLocalAdapterTypes'
import {
  getCursorLocalResultEnvelope,
  getCursorLocalTaskEnvelope,
} from './cursorLocalAdapterStorage'

export function pollCursorLocalTask(envelopeId: string): CursorLocalPollResult {
  const envelope = getCursorLocalTaskEnvelope(envelopeId)
  if (!envelope) {
    return {
      status: 'not_found',
      reason: `Envelope ${envelopeId} was not found.`,
      envelopeId,
    }
  }

  const result = getCursorLocalResultEnvelope(envelopeId)
  if (result) {
    return {
      status: 'ready',
      reason: null,
      envelopeId,
    }
  }

  return {
    status: 'pending',
    reason: 'Awaiting outbox result — Owner must record result in AI Company or place outbox files.',
    envelopeId,
  }
}
