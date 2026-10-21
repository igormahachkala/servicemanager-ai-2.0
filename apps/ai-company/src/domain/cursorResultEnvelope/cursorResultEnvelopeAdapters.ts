/**
 * Unified Cursor Result Envelope — integration adapters (AI-COMPANY-110).
 * Pure mapping only — does not change Tool Dispatcher or ingest behavior.
 */

import type { ToolResult } from '../toolDispatcher/toolDispatcherTypes'
import type {
  CursorResultEnvelope,
  ExecutionResultEnvelope,
} from './cursorResultEnvelopeTypes'
import { serializeCursorResultEnvelope } from './cursorResultEnvelopeSerialization'

/**
 * Attach unified envelope to ToolResult.output without altering dispatch decisions.
 *
 * Takes the supertype so a LOCAL_OLLAMA_ANALYSIS envelope can be attached too.
 * The output key keeps its historical name — renaming it would break
 * readEnvelopeFromToolResult and every result already stored.
 */
export function mapEnvelopeToToolResultOutput(
  envelope: ExecutionResultEnvelope,
  base: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...base,
    cursorResultEnvelopeV110: JSON.parse(serializeCursorResultEnvelope(envelope)),
  }
}

/** Read unified envelope from ToolResult.output if present. */
export function readEnvelopeFromToolResult(
  result: Pick<ToolResult, 'output'>,
): CursorResultEnvelope | null {
  const output = result.output
  if (!output || typeof output !== 'object') return null
  const candidate = (output as Record<string, unknown>).cursorResultEnvelopeV110
  if (!candidate || typeof candidate !== 'object') return null
  return candidate as CursorResultEnvelope
}
