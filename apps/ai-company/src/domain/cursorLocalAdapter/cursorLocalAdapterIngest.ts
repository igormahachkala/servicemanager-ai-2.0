/**
 * Ingest Cursor local outbox result (AI-COMPANY-113C).
 */

import {
  assertCursorLocalPayloadSafe,
  sanitizeCursorLocalText,
} from './cursorLocalAdapterSecurity'
import type { CursorLocalResultEnvelope, CursorLocalResultMetadata } from './cursorLocalAdapterTypes'
import {
  getCursorLocalResultEnvelope,
  getCursorLocalTaskEnvelope,
  saveCursorLocalResultEnvelope,
} from './cursorLocalAdapterStorage'

export type IngestCursorLocalResultInput = {
  envelopeId: string
  resultMarkdown: string
  recordedBy?: CursorLocalResultMetadata['recordedBy']
  checksPassed?: boolean | null
  summary?: string | null
}

export function ingestCursorLocalResult(
  input: IngestCursorLocalResultInput,
): CursorLocalResultEnvelope | null {
  const envelope = getCursorLocalTaskEnvelope(input.envelopeId)
  if (!envelope) return null

  const body = sanitizeCursorLocalText(input.resultMarkdown.trim())
  if (!body) return null

  assertCursorLocalPayloadSafe({ resultMarkdown: body })

  const now = new Date().toISOString()
  const metadata: CursorLocalResultMetadata = {
    envelopeId: input.envelopeId,
    recordedAt: now,
    recordedBy: input.recordedBy ?? 'owner',
    checksPassed: input.checksPassed ?? null,
    summary: input.summary ? sanitizeCursorLocalText(input.summary) : null,
  }

  assertCursorLocalPayloadSafe({ metadata: JSON.stringify(metadata) })

  const result: CursorLocalResultEnvelope = {
    envelopeId: input.envelopeId,
    resultMarkdown: body,
    metadata,
    ingestedAt: now,
  }

  return saveCursorLocalResultEnvelope(result)
}

export function readIngestedCursorLocalResult(envelopeId: string): CursorLocalResultEnvelope | null {
  return getCursorLocalResultEnvelope(envelopeId)
}
