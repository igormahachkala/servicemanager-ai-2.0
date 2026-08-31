/**
 * Ollama /api/generate caller — ported from agent-runner/src/executor.ts.
 *
 * Streaming (stream:true) is kept from the original for the reason recorded
 * there: Ollama sends headers and the first NDJSON chunk immediately, so a long
 * generation on a 30b model does not trip undici's ~300s headers timeout. The
 * wall clock stays bounded by AbortController.
 *
 * Ported off the runtime provider on purpose: ollamaProvider.execute uses
 * window.setTimeout (ollamaProvider.ts:198,310) and demands a nine-field
 * RuntimeExecutionRequest, neither of which a dispatcher task can honestly
 * supply. Plain setTimeout works in both the browser and node, so this is
 * testable without a DOM.
 *
 * Every failure is returned as a typed code — nothing is swallowed, and a
 * partial or empty generation is never passed off as an answer.
 */

import type { OllamaAnalysisErrorCode } from './ollamaAnalysisTypes'

/**
 * What the run cost, as Ollama itself reported it in the final chunk. Telemetry
 * for Cost Guard and load measurement — a local route is free in money but not
 * in time and hardware.
 */
export type OllamaGenerationMetrics = {
  promptTokens: number | null
  completionTokens: number | null
  generationDurationMs: number | null
  totalDurationMs: number | null
  tokensPerSecond: number | null
}

export type OllamaGenerateOutcome =
  | { ok: true; text: string; model: string; metrics: OllamaGenerationMetrics }
  | { ok: false; code: OllamaAnalysisErrorCode; message: string }

type OllamaStreamChunk = {
  response?: unknown
  model?: unknown
  done?: unknown
  error?: unknown
  eval_count?: unknown
  eval_duration?: unknown
  prompt_eval_count?: unknown
  total_duration?: unknown
}

type RawCounters = {
  promptTokens?: number
  completionTokens?: number
  generationNs?: number
  totalNs?: number
}

/**
 * Ollama reports durations in nanoseconds. A counter Ollama did not send stays
 * null — never a fabricated 0, which would read as "free" instead of "unknown".
 */
function toMetrics(raw: RawCounters): OllamaGenerationMetrics {
  const completionTokens = raw.completionTokens ?? null

  return {
    promptTokens: raw.promptTokens ?? null,
    completionTokens,
    generationDurationMs: raw.generationNs != null ? Math.round(raw.generationNs / 1e6) : null,
    totalDurationMs: raw.totalNs != null ? Math.round(raw.totalNs / 1e6) : null,
    tokensPerSecond:
      completionTokens != null && raw.generationNs
        ? Number((completionTokens / (raw.generationNs / 1e9)).toFixed(2))
        : null,
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : 'unknown error'
}

export async function callOllamaGenerate(input: {
  url: string
  model: string
  system: string
  prompt: string
  timeoutMs: number
  fetchImpl?: typeof fetch
}): Promise<OllamaGenerateOutcome> {
  const doFetch = input.fetchImpl ?? globalThis.fetch
  if (typeof doFetch !== 'function') {
    return { ok: false, code: 'OLLAMA_UNAVAILABLE', message: 'fetch is unavailable here' }
  }

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, input.timeoutMs)

  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined

  try {
    let response: Response
    try {
      response = await doFetch(input.url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: input.model,
          system: input.system,
          prompt: input.prompt,
          stream: true,
          think: false,
        }),
      })
    } catch (error) {
      if (timedOut) {
        return {
          ok: false,
          code: 'OLLAMA_TIMEOUT',
          message: `Analysis timed out after ${input.timeoutMs}ms`,
        }
      }
      return {
        ok: false,
        code: 'OLLAMA_UNAVAILABLE',
        message: `Ollama unreachable at ${input.url}: ${describeError(error)}`,
      }
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return {
        ok: false,
        code: 'OLLAMA_HTTP_ERROR',
        message: `Ollama HTTP ${response.status}${body ? ` — ${body.slice(0, 200)}` : ''}`,
      }
    }

    if (!response.body) {
      return { ok: false, code: 'OLLAMA_STREAM_ERROR', message: 'Ollama returned no body' }
    }

    reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let out = ''
    let model = input.model
    let done = false
    let streamError: string | null = null
    // Mutated inside consume(); an object keeps the counters out of the
    // control-flow narrowing that the loop below depends on.
    const counters: RawCounters = {}

    const parseLine = (line: string): OllamaStreamChunk | null => {
      const trimmed = line.trim()
      if (!trimmed) return null
      try {
        return JSON.parse(trimmed) as OllamaStreamChunk
      } catch {
        // Partial or garbled line — complete ones are reassembled via the buffer.
        return null
      }
    }

    const consume = (line: string): { done: boolean; error?: string } => {
      const chunk = parseLine(line)
      if (!chunk) return { done: false }
      if (typeof chunk.error === 'string' && chunk.error) return { done: true, error: chunk.error }
      if (typeof chunk.response === 'string') out += chunk.response
      if (typeof chunk.model === 'string' && chunk.model) model = chunk.model
      if (typeof chunk.prompt_eval_count === 'number') counters.promptTokens = chunk.prompt_eval_count
      if (typeof chunk.eval_count === 'number') counters.completionTokens = chunk.eval_count
      if (typeof chunk.eval_duration === 'number') counters.generationNs = chunk.eval_duration
      if (typeof chunk.total_duration === 'number') counters.totalNs = chunk.total_duration
      return { done: chunk.done === true }
    }

    while (!done) {
      const { value, done: streamEnded } = await reader.read()
      if (streamEnded) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl)
        buffer = buffer.slice(nl + 1)
        const step = consume(line)
        if (step.error) {
          streamError = step.error
          done = true
          break
        }
        if (step.done) {
          done = true
          break
        }
      }
    }

    // Trailing line that arrived without a final newline.
    if (!done && buffer.trim()) {
      const step = consume(buffer)
      if (step.error) streamError = step.error
    }

    if (streamError) {
      return {
        ok: false,
        code: 'OLLAMA_STREAM_ERROR',
        message: `Ollama stream error: ${streamError}`,
      }
    }

    const text = out.trim()
    if (!text) {
      return {
        ok: false,
        code: 'OLLAMA_EMPTY_RESPONSE',
        message: 'Ollama returned an empty response',
      }
    }

    return { ok: true, text, model, metrics: toMetrics(counters) }
  } catch (error) {
    if (timedOut) {
      return {
        ok: false,
        code: 'OLLAMA_TIMEOUT',
        message: `Analysis timed out after ${input.timeoutMs}ms`,
      }
    }
    return { ok: false, code: 'OLLAMA_STREAM_ERROR', message: describeError(error) }
  } finally {
    clearTimeout(timer)
    try {
      await reader?.cancel()
    } catch {
      // Reader cleanup must not mask the outcome above.
    }
  }
}
