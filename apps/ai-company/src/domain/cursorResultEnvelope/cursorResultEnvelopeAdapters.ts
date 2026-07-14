/**
 * Unified Cursor Result Envelope — integration adapters (AI-COMPANY-110).
 * Pure mapping only — does not change Tool Dispatcher or ingest behavior.
 */

import type { ToolResult } from '../toolDispatcher/toolDispatcherTypes'
import type { CursorResultEnvelope } from './cursorResultEnvelopeTypes'
import { serializeCursorResultEnvelope } from './cursorResultEnvelopeSerialization'

/** Attach unified envelope to ToolResult.output without altering dispatch decisions. */
export function mapEnvelopeToToolResultOutput(
  envelope: CursorResultEnvelope,
  base: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...base,
    cursorResultEnvelopeV110: JSON.parse(serializeCursorResultEnvelope(envelope)),
  }
}

/** Read unified envelope from ToolResult.output if present. */
export function readEnvelopeFromToolResult(result: ToolResult): CursorResultEnvelope | null {
  const output = result.output
  if (!output || typeof output !== 'object') return null
  const candidate = (output as Record<string, unknown>).cursorResultEnvelopeV110
  if (!candidate || typeof candidate !== 'object') return null
  return candidate as CursorResultEnvelope
}
