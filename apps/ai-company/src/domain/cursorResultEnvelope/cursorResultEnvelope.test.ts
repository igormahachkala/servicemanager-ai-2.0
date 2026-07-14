/**
 * Unified Cursor Result Envelope — unit tests (AI-COMPANY-110).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyBuilderReview,
  applyMaxReview,
  createPendingAutomationEnvelope,
  createTransportFailureEnvelope,
  normalizeLocalBridgeResult,
  normalizeManualCloudAgentResult,
  serializeCursorResultEnvelope,
  validateCursorResultEnvelope,
  cloneCursorResultEnvelope,
} from './index.ts'

const RUN_ID = 'terun-test-001'
const FINISHED_AT = '2026-07-14T10:00:00.000Z'
const STARTED_AT = '2026-07-14T09:00:00.000Z'
const VALID_SHA = 'abc1234567890'
const VALID_PR = 'https://github.com/org/repo/pull/42'

describe('cursorResultEnvelope', () => {
  it('1. webhook HTTP 200 → DISPATCHED + RESULT_PENDING', () => {
    const envelope = createPendingAutomationEnvelope({
      toolExecutionRunId: RUN_ID,
      backgroundComposerId: 'bc-smoke-001',
      startedAt: STARTED_AT,
    })
    assert.equal(envelope.transportStatus, 'DISPATCHED')
    assert.equal(envelope.executionStatus, 'RESULT_PENDING')
    assert.equal(envelope.route, 'CURSOR_AUTOMATION_WEBHOOK')
    assert.equal(envelope.finishedAt, null)
  })

  it('2. backgroundComposerId → externalCorrelationId', () => {
    const envelope = createPendingAutomationEnvelope({
      toolExecutionRunId: RUN_ID,
      backgroundComposerId: 'bc-smoke-001',
    })
    assert.equal(envelope.externalCorrelationId, 'bc-smoke-001')
    assert.equal(
      (envelope as Record<string, unknown>).backgroundComposerId,
      undefined,
    )
  })

  it('3. webhook enqueue cannot be SUCCEEDED from factory', () => {
    const envelope = createPendingAutomationEnvelope({ toolExecutionRunId: RUN_ID })
    assert.notEqual(envelope.executionStatus, 'SUCCEEDED')
    const validation = validateCursorResultEnvelope({
      ...envelope,
      executionStatus: 'SUCCEEDED',
      finishedAt: FINISHED_AT,
      summary: 'fake success without factory path',
    })
    assert.equal(validation.ok, false)
  })

  it('4. local bridge success normalization', () => {
    const envelope = normalizeLocalBridgeResult({
      toolExecutionRunId: RUN_ID,
      result: {
        runId: RUN_ID,
        status: 'completed',
        summary: 'Updated mobile CSS',
        changedFiles: ['apps/ai-company/src/mobile/foo.css'],
        checks: ['npm run build'],
        commit: null,
        pullRequest: null,
        warnings: [],
        errors: [],
        completedAt: FINISHED_AT,
      },
    })
    assert.equal(envelope.route, 'LOCAL_CURSOR_BRIDGE')
    assert.equal(envelope.executionStatus, 'SUCCEEDED')
    assert.equal(envelope.transportStatus, 'DISPATCHED')
    assert.equal(envelope.reviewStatus, 'PENDING')
    assert.equal(validateCursorResultEnvelope(envelope).ok, true)
  })

  it('5. local bridge failure normalization', () => {
    const envelope = normalizeLocalBridgeResult({
      toolExecutionRunId: RUN_ID,
      result: {
        runId: RUN_ID,
        status: 'failed',
        summary: 'Build failed',
        changedFiles: [],
        checks: [],
        commit: null,
        pullRequest: null,
        warnings: [],
        errors: ['tsc error'],
        completedAt: FINISHED_AT,
      },
    })
    assert.equal(envelope.executionStatus, 'FAILED')
    assert.equal(envelope.errors.length, 1)
    assert.equal(validateCursorResultEnvelope(envelope).ok, true)
  })

  it('6. manual cloud agent branch/commit/PR normalization', () => {
    const envelope = normalizeManualCloudAgentResult({
      toolExecutionRunId: RUN_ID,
      summary: 'Feature branch ready',
      branch: 'feature/cursor-manual',
      commitSha: VALID_SHA,
      pullRequestUrl: VALID_PR,
      changedFiles: ['src/a.ts'],
      checks: [{ name: 'build', status: 'passed', outputSummary: 'ok' }],
      finishedAt: FINISHED_AT,
      startedAt: STARTED_AT,
    })
    assert.equal(envelope.route, 'MANUAL_CLOUD_AGENT')
    assert.equal(envelope.branch, 'feature/cursor-manual')
    assert.equal(envelope.commitSha, VALID_SHA)
    assert.equal(envelope.pullRequestUrl, VALID_PR)
    assert.equal(envelope.executionStatus, 'SUCCEEDED')
    assert.equal(validateCursorResultEnvelope(envelope).ok, true)
  })

  it('7. transport failure envelope', () => {
    const envelope = createTransportFailureEnvelope({
      toolExecutionRunId: RUN_ID,
      route: 'CURSOR_AUTOMATION_WEBHOOK',
      errors: [
        {
          code: 'WEBHOOK_401',
          message: 'Unauthorized',
          source: 'transport',
          terminal: true,
        },
      ],
      finishedAt: FINISHED_AT,
    })
    assert.equal(envelope.transportStatus, 'TRANSPORT_FAILED')
    assert.equal(envelope.executionStatus, 'FAILED')
    assert.equal(validateCursorResultEnvelope(envelope).ok, true)
  })

  it('8. execution success + review pending', () => {
    const base = normalizeManualCloudAgentResult({
      toolExecutionRunId: RUN_ID,
      summary: 'Done',
      branch: 'feature/x',
      commitSha: VALID_SHA,
      changedFiles: ['a.ts'],
      finishedAt: FINISHED_AT,
    })
    assert.equal(base.executionStatus, 'SUCCEEDED')
    assert.equal(base.reviewStatus, 'PENDING')
  })

  it('9. execution success + review rejected', () => {
    const base = normalizeManualCloudAgentResult({
      toolExecutionRunId: RUN_ID,
      summary: 'Done',
      branch: 'feature/x',
      commitSha: VALID_SHA,
      changedFiles: ['a.ts'],
      finishedAt: FINISHED_AT,
    })
    const reviewed = applyBuilderReview(base, { decision: 'REJECTED', notes: 'Needs tests' })
    assert.equal(reviewed.executionStatus, 'SUCCEEDED')
    assert.equal(reviewed.reviewStatus, 'REJECTED')
  })

  it('10. missing finishedAt for SUCCEEDED rejected', () => {
    const envelope = normalizeManualCloudAgentResult({
      toolExecutionRunId: RUN_ID,
      summary: 'Done',
      branch: 'feature/x',
      commitSha: VALID_SHA,
      changedFiles: ['a.ts'],
      finishedAt: FINISHED_AT,
    })
    const invalid = { ...envelope, finishedAt: null }
    const validation = validateCursorResultEnvelope(invalid)
    assert.equal(validation.ok, false)
    assert.ok(
      validation.ok === false &&
        validation.issues.some((issue) => issue.code === 'succeeded_missing_finished_at'),
    )
  })

  it('11. invalid commit SHA rejected', () => {
    const envelope = normalizeManualCloudAgentResult({
      toolExecutionRunId: RUN_ID,
      summary: 'Done',
      branch: 'feature/x',
      commitSha: VALID_SHA,
      changedFiles: ['a.ts'],
      status: 'partial',
    })
    const invalid = {
      ...envelope,
      executionStatus: 'SUCCEEDED' as const,
      commitSha: 'not-a-sha!',
      finishedAt: FINISHED_AT,
    }
    const validation = validateCursorResultEnvelope(invalid)
    assert.equal(validation.ok, false)
  })

  it('12. invalid PR URL rejected', () => {
    const envelope = normalizeManualCloudAgentResult({
      toolExecutionRunId: RUN_ID,
      summary: 'Done',
      branch: 'feature/x',
      commitSha: VALID_SHA,
      changedFiles: ['a.ts'],
      status: 'partial',
    })
    const invalid = {
      ...envelope,
      executionStatus: 'SUCCEEDED' as const,
      pullRequestUrl: 'https://example.com/not-a-pr',
      finishedAt: FINISHED_AT,
    }
    const validation = validateCursorResultEnvelope(invalid)
    assert.equal(validation.ok, false)
  })

  it('13. errors preserved', () => {
    const envelope = createTransportFailureEnvelope({
      toolExecutionRunId: RUN_ID,
      route: 'LOCAL_CURSOR_BRIDGE',
      errors: [
        {
          code: 'BRIDGE_OFFLINE',
          message: 'Bridge unreachable',
          source: 'transport',
          terminal: true,
        },
      ],
      finishedAt: FINISHED_AT,
    })
    assert.equal(envelope.errors[0]?.code, 'BRIDGE_OFFLINE')
    assert.equal(envelope.errors[0]?.message, 'Bridge unreachable')
  })

  it('14. metadata preserved', () => {
    const envelope = createPendingAutomationEnvelope({
      toolExecutionRunId: RUN_ID,
      metadata: { smokeTest: true, attempt: 1 },
    })
    assert.deepEqual(envelope.metadata.smokeTest, true)
    assert.deepEqual(envelope.metadata.attempt, 1)
  })

  it('15. envelope serialization stable', () => {
    const envelope = normalizeManualCloudAgentResult({
      toolExecutionRunId: RUN_ID,
      summary: 'Done',
      branch: 'feature/x',
      commitSha: VALID_SHA,
      changedFiles: ['b.ts', 'a.ts'],
      finishedAt: FINISHED_AT,
      metadata: { z: 1, a: 2 },
    })
    const roundTrip = cloneCursorResultEnvelope(envelope)
    assert.equal(serializeCursorResultEnvelope(envelope), serializeCursorResultEnvelope(roundTrip))
  })

  it('16. MAX review does not rewrite execution success', () => {
    const base = normalizeManualCloudAgentResult({
      toolExecutionRunId: RUN_ID,
      summary: 'Done',
      branch: 'feature/x',
      commitSha: VALID_SHA,
      changedFiles: ['a.ts'],
      finishedAt: FINISHED_AT,
    })
    const reviewed = applyMaxReview(base, { decision: 'APPROVED' })
    assert.equal(reviewed.executionStatus, 'SUCCEEDED')
    assert.equal(reviewed.reviewStatus, 'APPROVED')
  })
})
