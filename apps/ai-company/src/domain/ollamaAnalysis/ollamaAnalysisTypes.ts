/**
 * Local Ollama analysis — domain types (route LOCAL_OLLAMA_ANALYSIS).
 */

import type { ExecutionResultEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeTypes'

/** Won the blind coder benchmark (scripts/output/ollama-coder-quality-blind-2.json). */
export const OLLAMA_ANALYSIS_DEFAULT_MODEL = 'qwen3-coder:30b'

/** Wall-clock bound for one analysis, enforced by AbortController. */
export const OLLAMA_ANALYSIS_TIMEOUT_MS = 300_000

export const OLLAMA_ANALYSIS_ERROR_CODES = [
  'OLLAMA_UNAVAILABLE',
  'OLLAMA_HTTP_ERROR',
  'OLLAMA_STREAM_ERROR',
  'OLLAMA_EMPTY_RESPONSE',
  'OLLAMA_TIMEOUT',
] as const

export type OllamaAnalysisErrorCode = (typeof OLLAMA_ANALYSIS_ERROR_CODES)[number]

export type OllamaAnalysisRequest = {
  /** Canonical owner of the result — never the dispatcher requestId. */
  toolExecutionRunId: string
  title: string
  instructions: string
  /** Overrides the default model; falsy falls back to config, then the constant. */
  model?: string | null
  timeoutMs?: number | null
  /** Injected by tests — production passes nothing and uses global fetch. */
  fetchImpl?: typeof fetch
}

export type OllamaAnalysisOutcome =
  | { ok: true; envelope: ExecutionResultEnvelope; model: string; text: string }
  | {
      ok: false
      code: OllamaAnalysisErrorCode
      message: string
      model: string
      startedAt: string
      failedAt: string
    }
