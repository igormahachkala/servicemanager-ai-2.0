/**
 * Ollama analysis sync — the link from an approved ToolExecutionRun to the
 * runner (block 4b).
 *
 * fetch is injected everywhere: no test reaches a live Ollama. The run store is
 * backed by a localStorage mock, so the guarded transitions are exercised for
 * real rather than stubbed.
 */

import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'

import { EMPLOYEE_ROUTE_IDS, resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver.ts'
import { createEmployeeWorkItem } from '../employeeWorkQueue/employeeWorkQueueStorage.ts'
import { requestToolExecution } from '../toolExecution/toolExecutionRunBridge.ts'
import {
  approveToolExecutionRun,
  getToolExecutionRun,
} from '../toolExecution/toolExecutionRunStorage.ts'
import { queueToolExecutionRunForOllamaAnalysis } from './ollamaAnalysisSync.ts'

function installStorageMock(): void {
  const data = new Map<string, string>()
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size
    },
  }

  ;(globalThis as { window?: Window; localStorage?: Storage }).window = {
    localStorage: storage as Storage,
    dispatchEvent: () => true,
    location: { origin: 'http://localhost:5174' },
  } as unknown as Window
  ;(globalThis as { localStorage?: Storage }).localStorage = storage as Storage
}

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

function answerStream(answer: string): string[] {
  return [
    JSON.stringify({ model: 'qwen3-coder:30b', response: answer }),
    JSON.stringify({ model: 'qwen3-coder:30b', done: true, eval_count: 10, eval_duration: 1e9 }),
  ]
}

const VALID_ANSWER =
  'Problem: the operator is wrong.\nRisk: high.\nRecommendation: use +.\nEffort: Low'
const OFF_FORMAT_ANSWER = 'Problem: the operator is wrong.\nRisk: high.\nEffort: Low'

let workItemId = ''

/**
 * A fresh ollama run, already approved, ready for the sync to pick up.
 *
 * approveToolExecutionRun fires the ollama branch detached and WITHOUT a
 * fetchImpl. It never reaches a real request: queueToolExecutionRunForOllama
 * Analysis moves the run approved -> queued -> running synchronously, before its
 * first await, while the branch's dynamic import can only resolve on a later
 * tick — so the detached call always finds a run that is no longer `approved`
 * and bails. Keep those transitions ahead of the first await, or this test
 * starts talking to a live model. OLLAMA_BASE_URL below is the second line of
 * defence.
 */
function approvedOllamaRunId(): string {
  const { run } = requestToolExecution({
    workItemId,
    title: 'Review a helper',
    instructions: 'function sum(a, b) { return a - b }',
    companyId: 'company-default',
    toolId: 'ollama',
  })
  approveToolExecutionRun(run.id, 'Approved for the test.')
  return run.id
}

describe('queueToolExecutionRunForOllamaAnalysis', () => {
  const originalBaseUrl = process.env.OLLAMA_BASE_URL

  before(() => {
    installStorageMock()
    // Without this the mocked window.location.origin would aim any stray
    // request at the dev server on :5174, which proxies to a real Ollama.
    // A closed port keeps an accidental call local and instant.
    process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:1'
    const workItem = createEmployeeWorkItem({
      employeeId: resolveCanonicalEmployeeId(EMPLOYEE_ROUTE_IDS.builder),
      title: 'Sync test work item',
      companyId: 'company-default',
    })
    workItemId = workItem.id
  })

  after(() => {
    if (originalBaseUrl === undefined) delete process.env.OLLAMA_BASE_URL
    else process.env.OLLAMA_BASE_URL = originalBaseUrl
  })

  it('a valid answer walks the run to awaiting_employee_review with the envelope', async () => {
    const runId = approvedOllamaRunId()

    const outcome = await queueToolExecutionRunForOllamaAnalysis(runId, {
      fetchImpl: async () => ndjsonResponse(answerStream(VALID_ANSWER)),
    })

    assert.equal(outcome.ok, true)

    const run = getToolExecutionRun(runId)
    assert.equal(run?.status, 'awaiting_employee_review')
    assert.equal(run?.result?.deliveryMode, 'local_analysis_v1')

    const envelope = (run?.result?.output as Record<string, unknown>)
      .cursorResultEnvelopeV110 as Record<string, unknown>
    assert.equal(envelope.route, 'LOCAL_OLLAMA_ANALYSIS')
    assert.equal(envelope.executionStatus, 'SUCCEEDED')
    assert.equal(envelope.summary, VALID_ANSWER)
  })

  it('an off-format answer fails the run but keeps the evidence', async () => {
    const runId = approvedOllamaRunId()

    const outcome = await queueToolExecutionRunForOllamaAnalysis(runId, {
      fetchImpl: async () => ndjsonResponse(answerStream(OFF_FORMAT_ANSWER)),
    })

    assert.equal(outcome.ok, false)
    assert.match(outcome.error ?? '', /OLLAMA_SECTIONS_INVALID/)

    const run = getToolExecutionRun(runId)
    assert.equal(run?.status, 'failed')
    assert.match(run?.error ?? '', /OLLAMA_SECTIONS_INVALID/)

    // Evidence survived the failure: awaiting_employee_review is not terminal,
    // so recording the envelope first and failing second both landed.
    const envelope = (run?.result?.output as Record<string, unknown>)
      .cursorResultEnvelopeV110 as Record<string, unknown>
    assert.equal(envelope.executionStatus, 'FAILED')
    assert.equal(envelope.transportStatus, 'DISPATCHED')
    assert.equal(envelope.summary, OFF_FORMAT_ANSWER)
  })

  it('a transport failure fails the run with no result at all', async () => {
    const runId = approvedOllamaRunId()

    const outcome = await queueToolExecutionRunForOllamaAnalysis(runId, {
      fetchImpl: async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:11434')
      },
    })

    assert.equal(outcome.ok, false)
    assert.match(outcome.error ?? '', /OLLAMA_UNAVAILABLE/)

    const run = getToolExecutionRun(runId)
    assert.equal(run?.status, 'failed')
    assert.equal(run?.result, null)
  })

  it('a run that is not approved is left untouched', async () => {
    const { run } = requestToolExecution({
      workItemId,
      title: 'Not approved yet',
      instructions: 'anything',
      companyId: 'company-default',
      toolId: 'ollama',
    })

    const outcome = await queueToolExecutionRunForOllamaAnalysis(run.id, {
      fetchImpl: async () => ndjsonResponse(answerStream(VALID_ANSWER)),
    })

    assert.equal(outcome.ok, false)
    assert.match(outcome.error ?? '', /must be approved/)
    assert.equal(getToolExecutionRun(run.id)?.status, 'awaiting_owner')
  })

  it('a cursor run is refused — this link is ollama-only', async () => {
    const { run } = requestToolExecution({
      workItemId,
      title: 'Cursor work',
      instructions: 'anything',
      companyId: 'company-default',
    })
    // Deliberately not approved: approving a cursor run would fire the Cursor
    // bridge branch at toolExecutionRunStorage.ts:268 and reach for a real
    // bridge. The toolId guard runs before the status guard, so this still
    // proves the ollama-only check rather than the approval check.

    const outcome = await queueToolExecutionRunForOllamaAnalysis(run.id, {
      fetchImpl: async () => ndjsonResponse(answerStream(VALID_ANSWER)),
    })

    assert.equal(outcome.ok, false)
    assert.match(outcome.error ?? '', /not an ollama run/)
  })
})
