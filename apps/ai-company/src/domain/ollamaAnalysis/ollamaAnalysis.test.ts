/**
 * Local Ollama analysis — unit tests (block 2 of the LOCAL_OLLAMA_ANALYSIS route).
 *
 * fetch is injected in every case: no test may reach a live Ollama, so the suite
 * stays deterministic whether or not :11434 is up.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { runOllamaAnalysis } from '../ollamaAnalysis/ollamaAnalysisRunner.ts'
import { OLLAMA_ANALYSIS_DEFAULT_MODEL } from '../ollamaAnalysis/ollamaAnalysisTypes.ts'

/** Ollama streams NDJSON — one JSON object per line. */
function ndjsonResponse(lines: string[], status = 200): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(`${line}\n`))
      controller.close()
    },
  })
  return new Response(stream, { status })
}

function successStream(): string[] {
  return [
    JSON.stringify({ model: 'qwen3-coder:30b', response: 'Problem: the switch has no ollama arm.\n' }),
    JSON.stringify({ model: 'qwen3-coder:30b', response: 'Risk: every dispatch fails. Medium.\n' }),
    JSON.stringify({ model: 'qwen3-coder:30b', response: 'Recommendation: add the branch.' }),
    // Ollama reports the counters on the final chunk, durations in nanoseconds.
    JSON.stringify({
      model: 'qwen3-coder:30b',
      done: true,
      prompt_eval_count: 220,
      eval_count: 120,
      eval_duration: 2_000_000_000,
      total_duration: 6_900_000_000,
    }),
  ]
}

function baseRequest(overrides: Record<string, unknown> = {}) {
  return {
    toolExecutionRunId: 'run-ollama-001',
    title: 'Analyze the dispatcher',
    instructions: 'Read toolDispatcherDispatch.ts and report problems',
    ...overrides,
  }
}

describe('runOllamaAnalysis', () => {
  it('packs a successful generation into a LOCAL_OLLAMA_ANALYSIS envelope', async () => {
    const outcome = await runOllamaAnalysis(
      baseRequest({ fetchImpl: async () => ndjsonResponse(successStream()) }),
    )

    assert.equal(outcome.ok, true)
    if (!outcome.ok) return

    assert.equal(outcome.envelope.route, 'LOCAL_OLLAMA_ANALYSIS')
    assert.equal(outcome.envelope.executionStatus, 'SUCCEEDED')
    assert.equal(outcome.envelope.transportStatus, 'DISPATCHED')
    assert.equal(outcome.envelope.toolExecutionRunId, 'run-ollama-001')
    assert.equal(outcome.envelope.metadata.transport, 'local_ollama_analysis')
    assert.equal(outcome.envelope.metadata.analysisModel, 'qwen3-coder:30b')
    // Block 3 has not run — the envelope must say so rather than imply validation.
    assert.equal(outcome.envelope.metadata.sectionsValidated, false)

    // Every chunk is concatenated, in order.
    assert.match(outcome.text, /^Problem: /)
    assert.match(outcome.text, /Recommendation: add the branch\.$/)
    assert.equal(outcome.envelope.summary, outcome.text)
    assert.ok(outcome.envelope.finishedAt)
  })

  it('carries the model metrics into the envelope', async () => {
    const outcome = await runOllamaAnalysis(
      baseRequest({ fetchImpl: async () => ndjsonResponse(successStream()) }),
    )

    assert.equal(outcome.ok, true)
    if (!outcome.ok) return

    assert.deepEqual(outcome.envelope.metadata.analysisMetrics, {
      promptTokens: 220,
      completionTokens: 120,
      // 120 tokens over 2s of generation.
      tokensPerSecond: 60,
      generationDurationMs: 2000,
      totalDurationMs: 6900,
    })
  })

  it('reports a counter Ollama omitted as null, never as zero', async () => {
    const outcome = await runOllamaAnalysis(
      baseRequest({
        fetchImpl: async () =>
          ndjsonResponse([
            JSON.stringify({ model: 'qwen3-coder:30b', response: 'Problem: something.' }),
            JSON.stringify({ model: 'qwen3-coder:30b', done: true }),
          ]),
      }),
    )

    assert.equal(outcome.ok, true)
    if (!outcome.ok) return

    // Unknown cost must not read as free cost.
    assert.deepEqual(outcome.envelope.metadata.analysisMetrics, {
      promptTokens: null,
      completionTokens: null,
      tokensPerSecond: null,
      generationDurationMs: null,
      totalDurationMs: null,
    })
  })

  it('reports an unreachable Ollama instead of an empty success', async () => {
    const outcome = await runOllamaAnalysis(
      baseRequest({
        fetchImpl: async () => {
          throw new Error('connect ECONNREFUSED 127.0.0.1:11434')
        },
      }),
    )

    assert.equal(outcome.ok, false)
    if (outcome.ok) return

    assert.equal(outcome.code, 'OLLAMA_UNAVAILABLE')
    assert.match(outcome.message, /ECONNREFUSED/)
    assert.ok(!('envelope' in outcome), 'a failed run must not carry an envelope')
  })

  it('reports a non-2xx response as an HTTP error', async () => {
    const outcome = await runOllamaAnalysis(
      baseRequest({
        fetchImpl: async () => new Response('model not loaded', { status: 500 }),
      }),
    )

    assert.equal(outcome.ok, false)
    if (outcome.ok) return
    assert.equal(outcome.code, 'OLLAMA_HTTP_ERROR')
    assert.match(outcome.message, /HTTP 500/)
  })

  it('an empty generation is not SUCCEEDED', async () => {
    const outcome = await runOllamaAnalysis(
      baseRequest({
        fetchImpl: async () =>
          ndjsonResponse([
            JSON.stringify({ model: 'qwen3-coder:30b', response: '   ' }),
            JSON.stringify({ model: 'qwen3-coder:30b', done: true }),
          ]),
      }),
    )

    assert.equal(outcome.ok, false)
    if (outcome.ok) return
    assert.equal(outcome.code, 'OLLAMA_EMPTY_RESPONSE')
  })

  it('surfaces an error carried inside the stream', async () => {
    const outcome = await runOllamaAnalysis(
      baseRequest({
        fetchImpl: async () =>
          ndjsonResponse([JSON.stringify({ error: 'model "qwen3-coder:30b" not found' })]),
      }),
    )

    assert.equal(outcome.ok, false)
    if (outcome.ok) return
    assert.equal(outcome.code, 'OLLAMA_STREAM_ERROR')
    assert.match(outcome.message, /not found/)
  })

  it('aborts on timeout with an explicit code', async () => {
    const outcome = await runOllamaAnalysis(
      baseRequest({
        timeoutMs: 5,
        fetchImpl: (_url: string | URL | Request, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
          }),
      }),
    )

    assert.equal(outcome.ok, false)
    if (outcome.ok) return
    assert.equal(outcome.code, 'OLLAMA_TIMEOUT')
    assert.match(outcome.message, /timed out after 5ms/)
  })

  it('defaults to qwen3-coder:30b and honours an explicit model', async () => {
    const sentModels: string[] = []
    const capturingFetch = async (_url: string | URL | Request, init?: RequestInit) => {
      sentModels.push(JSON.parse(String(init?.body)).model)
      return ndjsonResponse(successStream())
    }

    await runOllamaAnalysis(baseRequest({ fetchImpl: capturingFetch }))
    await runOllamaAnalysis(baseRequest({ fetchImpl: capturingFetch, model: 'deepseek-r1:8b' }))

    assert.deepEqual(sentModels, [OLLAMA_ANALYSIS_DEFAULT_MODEL, 'deepseek-r1:8b'])
    assert.equal(OLLAMA_ANALYSIS_DEFAULT_MODEL, 'qwen3-coder:30b')
  })

  it('sends the audit system prompt and the task, and asks Ollama to stream', async () => {
    let body: Record<string, unknown> = {}
    await runOllamaAnalysis(
      baseRequest({
        fetchImpl: async (_url: string | URL | Request, init?: RequestInit) => {
          body = JSON.parse(String(init?.body))
          return ndjsonResponse(successStream())
        },
      }),
    )

    assert.equal(body.stream, true)
    assert.match(String(body.system), /Problem: /)
    assert.match(String(body.system), /READ-ONLY/)
    assert.match(String(body.prompt), /Analyze the dispatcher/)
    // No filesystem context layer yet — the prompt must not pretend otherwise.
    assert.match(String(body.prompt), /PROJECT CONTEXT: none was provided/)
  })
})
