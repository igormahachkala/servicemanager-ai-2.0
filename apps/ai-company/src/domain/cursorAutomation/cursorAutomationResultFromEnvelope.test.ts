import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCursorAutomationResultFromEnvelope } from './cursorAutomationResultFromEnvelope'
import type { CursorResultEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeTypes'

function envelope(overrides: Partial<CursorResultEnvelope> = {}): CursorResultEnvelope {
  const base = {
    toolExecutionRunId: 'run-1',
    route: 'cursor_webhook',
    transportStatus: 'DISPATCHED',
    executionStatus: 'SUCCEEDED',
    reviewStatus: 'PENDING',
    summary: 'Add /health endpoint',
    branch: 'ai/task-health',
    commitSha: 'abcdef1234567890',
    pullRequestUrl: 'https://github.com/acme/repo/pull/42',
    changedFiles: ['server/health.js', 'server/index.js'],
    checks: [
      { name: 'test', status: 'passed', outputSummary: null },
      { name: 'lint', status: 'passed', outputSummary: null },
    ],
    artifacts: [],
    errors: [],
    externalCorrelationId: null,
    startedAt: null,
    finishedAt: null,
    metadata: {},
  }
  return { ...base, ...overrides } as unknown as CursorResultEnvelope
}

test('maps a successful envelope to a passed result', () => {
  const r = buildCursorAutomationResultFromEnvelope(envelope(), { baseBranch: 'develop' })
  assert.equal(r.report.buildStatus, 'passed')
  assert.equal(r.pullRequest.url, 'https://github.com/acme/repo/pull/42')
  assert.equal(r.pullRequest.branch, 'ai/task-health')
  assert.equal(r.pullRequest.baseBranch, 'develop')
  assert.equal(r.pullRequest.state, 'open')
  assert.deepEqual(r.report.checksRun, ['test', 'lint'])
  assert.deepEqual(r.artifacts.changedFiles, ['server/health.js', 'server/index.js'])
  assert.equal(r.report.summary, 'Add /health endpoint')
  assert.match(r.artifacts.commitMessageHint, /^commit abcdef1234/)
})

test('failed execution status yields failed build', () => {
  assert.equal(
    buildCursorAutomationResultFromEnvelope(envelope({ executionStatus: 'FAILED' })).report.buildStatus,
    'failed',
  )
})

test('a failing check yields failed build even when status succeeded', () => {
  assert.equal(
    buildCursorAutomationResultFromEnvelope(
      envelope({ checks: [{ name: 'test', status: 'failed', outputSummary: 'boom' }] as CursorResultEnvelope['checks'] }),
    ).report.buildStatus,
    'failed',
  )
})

test('pending / timed-out yields unknown build', () => {
  assert.equal(
    buildCursorAutomationResultFromEnvelope(envelope({ executionStatus: 'TIMED_OUT' })).report.buildStatus,
    'unknown',
  )
})

test('no pull request -> draft state, empty url, default base branch main', () => {
  const r = buildCursorAutomationResultFromEnvelope(
    envelope({ pullRequestUrl: null, branch: null, summary: null, commitSha: null }),
  )
  assert.equal(r.pullRequest.state, 'draft')
  assert.equal(r.pullRequest.url, '')
  assert.equal(r.pullRequest.baseBranch, 'main')
  assert.equal(r.pullRequest.title, 'Cursor automation result')
  assert.equal(r.artifacts.commitMessageHint, 'Cursor automation result')
})

import { resolveActualResultFromToolResult } from './cursorAutomationResultFromEnvelope'

function toolResult(env: unknown): Record<string, unknown> {
  return {
    requestId: 'req-1',
    toolId: 'cursor_automation',
    status: 'succeeded',
    ok: true,
    deliveryMode: 'planned_v1',
    output: env ? { cursorResultEnvelopeV110: env } : null,
    error: null,
    cursorAutomationTaskId: null,
    registryInvokePlanId: null,
    finishedAt: '2026-01-01T00:00:00.000Z',
    logs: [],
  }
}

test('resolve returns mapped result for a terminal (succeeded) envelope', () => {
  const r = resolveActualResultFromToolResult(toolResult(envelope()) as never)
  assert.equal(r?.report.buildStatus, 'passed')
  assert.equal(r?.pullRequest.url, 'https://github.com/acme/repo/pull/42')
})

test('resolve returns null while pending', () => {
  const r = resolveActualResultFromToolResult(toolResult(envelope({ executionStatus: 'RESULT_PENDING' })) as never)
  assert.equal(r, null)
})

test('resolve returns null when there is no envelope or no result', () => {
  assert.equal(resolveActualResultFromToolResult(toolResult(null) as never), null)
  assert.equal(resolveActualResultFromToolResult(null), null)
})

test('accepts a stored ToolExecutionRun result (only output is read)', async () => {
  const { resolveActualResultFromToolResult } = await import('./cursorAutomationResultFromEnvelope')
  const storedRunResult = {
    plannedOnly: false,
    output: { cursorResultEnvelopeV110: envelope() },
    deliveryMode: 'cursor_v1' as const,
    cursorAutomationTaskId: null,
    registryInvokePlanId: null,
    receivedAt: null,
  }
  const r = resolveActualResultFromToolResult(storedRunResult, { baseBranch: 'main' })
  assert.ok(r)
  assert.equal(r.pullRequest.url, 'https://github.com/acme/repo/pull/42')
})
