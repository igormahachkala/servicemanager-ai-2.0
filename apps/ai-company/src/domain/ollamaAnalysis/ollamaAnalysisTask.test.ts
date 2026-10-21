import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { createAnalysisResultEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeFactories.ts'
import { mapEnvelopeToToolResultOutput } from '../cursorResultEnvelope/cursorResultEnvelopeAdapters.ts'
import { recordToolExecutionResult, approveToolExecutionRun, getToolExecutionRun, markToolExecutionQueued, markToolExecutionRunning } from '../toolExecution/toolExecutionRunStorage.ts'
import { parseAnalysisBlocks } from './ollamaAnalysisSections.ts'
import {
  buildOllamaAnalysisView,
  createOllamaAnalysisTask,
  listOllamaAnalysisRuns,
} from './ollamaAnalysisTask.ts'

function installStorageMock(): void {
  const data = new Map<string, string>()
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    },
  }
  ;(globalThis as Record<string, unknown>).window = {
    localStorage: storage,
    dispatchEvent: () => true,
    location: { origin: 'http://localhost:5174' },
  }
  ;(globalThis as Record<string, unknown>).localStorage = storage
}

const ANSWER = [
  'Short intro line.',
  'Problem: the dispatcher ignores the flag',
  'in two places.',
  'Risk: High — runs wait forever',
  'Recommendation: honour the capability',
  'Effort: Low',
].join('\n')

describe('parseAnalysisBlocks', () => {
  it('keeps order, case, multi-line content and the preamble', () => {
    const { preamble, blocks } = parseAnalysisBlocks(ANSWER)
    assert.equal(preamble, 'Short intro line.')
    assert.deepEqual(
      blocks.map((b) => b.label),
      ['Problem', 'Risk', 'Recommendation', 'Effort'],
    )
    assert.equal(blocks[0].content, 'the dispatcher ignores the flag\nin two places.')
  })

  it('an answer without labels is all preamble', () => {
    assert.deepEqual(parseAnalysisBlocks('just prose'), { preamble: 'just prose', blocks: [] })
  })
})

describe('createOllamaAnalysisTask + view', () => {
  before(() => {
    installStorageMock()
    delete process.env.AI_COMPANY_AUTO_APPROVE_SAFE_TOOLS
  })

  it('rejects an empty title or instructions', () => {
    assert.throws(() => createOllamaAnalysisTask({ title: ' ', instructions: 'x' }))
    assert.throws(() => createOllamaAnalysisTask({ title: 'x', instructions: '' }))
  })

  it('creates an ollama run that waits for the Owner and is listed', () => {
    const run = createOllamaAnalysisTask({ title: 'Audit', instructions: 'Check the dispatcher' })
    assert.equal(run.toolId, 'ollama')
    assert.equal(run.status, 'awaiting_owner')
    assert.ok(listOllamaAnalysisRuns().some((r) => r.id === run.id))
    const view = buildOllamaAnalysisView(run)
    assert.equal(view.phase, 'waiting_owner')
    assert.equal(view.canApprove, true)
    assert.equal(view.envelope, null)
  })

  it('reads sections, model and metrics from a recorded result', () => {
    const run = createOllamaAnalysisTask({ title: 'Audit 2', instructions: 'Check again' })
    // Move to running without triggering the detached executor: approve fires
    // it, so patch the lifecycle step by step via storage helpers instead.
    approveToolExecutionRun(run.id)
    markToolExecutionQueued(run.id)
    markToolExecutionRunning(run.id)
    const envelope = createAnalysisResultEnvelope({
      toolExecutionRunId: run.id,
      summary: ANSWER,
      metadata: {
        analysisModel: 'qwen3-coder:30b',
        sectionsValidated: true,
        analysisSections: { missing: [], empty: [] },
        analysisMetrics: { promptTokens: 10, completionTokens: 40, generationDurationMs: 500, totalDurationMs: 900, tokensPerSecond: 80 },
      },
    })
    recordToolExecutionResult({
      runId: run.id,
      output: mapEnvelopeToToolResultOutput(envelope),
      deliveryMode: 'local_analysis_v1',
      plannedOnly: false,
    })
    const stored = getToolExecutionRun(run.id)
    assert.ok(stored)
    const view = buildOllamaAnalysisView(stored)
    assert.equal(view.phase, 'done')
    assert.equal(view.model, 'qwen3-coder:30b')
    assert.equal(view.sectionsValidated, true)
    assert.equal(view.metrics?.tokensPerSecond, 80)
    assert.equal(view.blocks.length, 4)
    assert.equal(view.canAccept, true)
  })
})
