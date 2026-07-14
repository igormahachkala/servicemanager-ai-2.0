/**
 * Manual Cloud Agent result import — unit tests (AI-COMPANY-111).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { EmployeeToolReview } from '../employeeToolReview/employeeToolReviewTypes.ts'
import type {
  RecordToolExecutionResultInput,
  ToolExecutionRun,
  ToolExecutionRunStatus,
} from '../toolExecution/toolExecutionRunTypes.ts'
import {
  importManualCloudAgentResult,
  type ManualCloudAgentImportDeps,
} from './importManualCloudAgentResult.ts'
import type { ManualCloudAgentImportInput } from './manualCloudAgentImportTypes.ts'

const RUN_ID = 'terun-manual-001'
const FINISHED_AT = '2026-07-14T10:00:00.000Z'
const STARTED_AT = '2026-07-14T09:00:00.000Z'
const VALID_SHA = 'abc1234567890'
const VALID_PR = 'https://github.com/org/repo/pull/42'

function baseRun(overrides: Partial<ToolExecutionRun> = {}): ToolExecutionRun {
  return {
    id: RUN_ID,
    version: 'v1',
    companyId: 'company-default',
    employeeId: 'ag-builder',
    toolId: 'cursor',
    toolRequestId: 'td-req-001',
    workItemId: 'wi-001',
    delegationPlanId: null,
    workerLoopId: null,
    builderToolDecisionId: null,
    legacyBuilderRunId: null,
    title: 'Manual agent task',
    instructions: 'Implement feature',
    expectedResult: 'Feature implemented',
    fileScope: ['src/a.ts'],
    checks: ['npm run build'],
    status: 'running',
    createdAt: STARTED_AT,
    updatedAt: STARTED_AT,
    approvedAt: STARTED_AT,
    startedAt: STARTED_AT,
    completedAt: null,
    failedAt: null,
    result: {
      plannedOnly: true,
      output: { executionRoute: 'MANUAL_CLOUD_AGENT' },
      deliveryMode: 'cursor_v1',
      cursorAutomationTaskId: null,
      registryInvokePlanId: null,
      receivedAt: null,
    },
    error: null,
    history: [],
    ...overrides,
  }
}

function baseImportInput(
  overrides: Partial<ManualCloudAgentImportInput> = {},
): ManualCloudAgentImportInput {
  return {
    toolExecutionRunId: RUN_ID,
    branch: 'feature/manual-import',
    commitSha: VALID_SHA,
    pullRequestUrl: VALID_PR,
    summary: 'Manual Cloud Agent completed work',
    changedFiles: ['src/a.ts', 'src/a.ts', ' src/b.ts '],
    checks: [
      { name: 'build', status: 'PASSED', details: 'ok' },
      { name: 'lint', status: 'SKIPPED' },
    ],
    artifacts: [{ type: 'pull_request', reference: VALID_PR, description: 'Draft PR' }],
    errors: [],
    startedAt: STARTED_AT,
    finishedAt: FINISHED_AT,
    finalStatus: 'SUCCEEDED',
    ...overrides,
  }
}

function createMemoryDeps(initialRun: ToolExecutionRun): {
  deps: ManualCloudAgentImportDeps
  getStoredRun: () => ToolExecutionRun | undefined
  getStoredReview: () => EmployeeToolReview | undefined
} {
  const runs = new Map<string, ToolExecutionRun>([[initialRun.id, initialRun]])
  const reviews = new Map<string, EmployeeToolReview>()

  const deps: ManualCloudAgentImportDeps = {
    getRun: (id) => runs.get(id) ?? null,
    upsertRun: (run) => {
      runs.set(run.id, run)
      return run
    },
    resolveRoute: (run) => {
      const route = run.result?.output?.executionRoute
      return route === 'MANUAL_CLOUD_AGENT' ||
        route === 'LOCAL_CURSOR_BRIDGE' ||
        route === 'CURSOR_AUTOMATION_WEBHOOK'
        ? route
        : null
    },
    markQueued: (runId, message) => {
      const run = runs.get(runId)
      if (!run || run.status !== 'approved') return null
      const next = { ...run, status: 'queued' as const, history: run.history }
      runs.set(runId, next)
      return next
    },
    markRunning: (runId, message) => {
      const run = runs.get(runId)
      if (!run || run.status !== 'queued') return null
      const next = {
        ...run,
        status: 'running' as const,
        startedAt: FINISHED_AT,
        history: run.history,
      }
      runs.set(runId, next)
      return next
    },
    recordResult: (input: RecordToolExecutionResultInput) => {
      const run = runs.get(input.runId)
      if (!run || run.status !== 'running') return null
      const next: ToolExecutionRun = {
        ...run,
        status: 'awaiting_employee_review',
        result: {
          plannedOnly: false,
          output: input.output,
          deliveryMode: input.deliveryMode ?? 'cursor_v1',
          cursorAutomationTaskId: input.cursorAutomationTaskId ?? null,
          registryInvokePlanId: input.registryInvokePlanId ?? null,
          receivedAt: FINISHED_AT,
        },
      }
      runs.set(run.id, next)
      return next
    },
    getReviewByRunId: (runId) => reviews.get(runId) ?? null,
    createReview: (input) => {
      const review: EmployeeToolReview = {
        id: 'etr-manual-001',
        version: 'v1',
        companyId: input.companyId,
        employeeId: input.employeeId,
        reviewerEmployeeId: input.reviewerEmployeeId,
        toolExecutionRunId: input.toolExecutionRunId,
        workItemId: input.workItemId,
        delegationPlanId: input.delegationPlanId ?? null,
        envelope: input.envelope,
        evaluation: input.evaluation,
        status: 'awaiting_employee_review',
        reworkReason: null,
        reworkEnvelopeId: null,
        delegationReviewId: null,
        reportId: null,
        createdAt: FINISHED_AT,
        updatedAt: FINISHED_AT,
        history: [],
      }
      reviews.set(input.toolExecutionRunId, review)
      return review
    },
    postReviewCard: () => undefined,
    logEvent: () => undefined,
  }

  return {
    deps,
    getStoredRun: () => runs.get(RUN_ID),
    getStoredReview: () => reviews.get(RUN_ID),
  }
}

describe('manualCloudAgentImport', () => {
  it('1. successful import with branch + commit + PR', () => {
    const { deps } = createMemoryDeps(baseRun())
    const outcome = importManualCloudAgentResult(baseImportInput(), deps)
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    assert.equal(outcome.envelope.branch, 'feature/manual-import')
    assert.equal(outcome.envelope.commitSha, VALID_SHA)
    assert.equal(outcome.envelope.pullRequestUrl, VALID_PR)
    assert.equal(outcome.reasonCode, 'IMPORT_REQUIRES_REVIEW')
  })

  it('2. successful import with commit only', () => {
    const { deps } = createMemoryDeps(baseRun())
    const outcome = importManualCloudAgentResult(
      baseImportInput({ branch: null, pullRequestUrl: null }),
      deps,
    )
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    assert.equal(outcome.envelope.commitSha, VALID_SHA)
    assert.equal(outcome.envelope.pullRequestUrl, null)
  })

  it('3. failed execution import', () => {
    const { deps, getStoredRun } = createMemoryDeps(baseRun())
    const outcome = importManualCloudAgentResult(
      baseImportInput({
        finalStatus: 'FAILED',
        summary: 'Agent failed checks',
        errors: [{ code: 'BUILD_FAILED', message: 'tsc error' }],
        branch: null,
        commitSha: null,
        pullRequestUrl: null,
        changedFiles: [],
        checks: [],
      }),
      deps,
    )
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    assert.equal(outcome.envelope.executionStatus, 'FAILED')
    assert.equal(outcome.envelope.reviewStatus, 'NOT_REQUIRED')
    assert.equal(getStoredRun()?.status, 'failed')
    assert.equal(outcome.review, null)
  })

  it('4. cancelled import', () => {
    const { deps, getStoredRun } = createMemoryDeps(baseRun())
    const outcome = importManualCloudAgentResult(
      baseImportInput({
        finalStatus: 'CANCELLED',
        summary: 'Owner cancelled manual run',
        branch: null,
        commitSha: null,
        pullRequestUrl: null,
        changedFiles: [],
      }),
      deps,
    )
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    assert.equal(outcome.envelope.executionStatus, 'CANCELLED')
    assert.equal(getStoredRun()?.status, 'cancelled')
  })

  it('5. timed out import', () => {
    const { deps, getStoredRun } = createMemoryDeps(baseRun())
    const outcome = importManualCloudAgentResult(
      baseImportInput({
        finalStatus: 'TIMED_OUT',
        summary: 'Reconciliation timeout',
        errors: [{ code: 'TIMEOUT', message: 'No PR found' }],
        branch: null,
        commitSha: null,
        pullRequestUrl: null,
        changedFiles: [],
      }),
      deps,
    )
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    assert.equal(outcome.envelope.executionStatus, 'TIMED_OUT')
    assert.equal(getStoredRun()?.status, 'failed')
  })

  it('6. missing ToolExecutionRun', () => {
    const { deps } = createMemoryDeps(baseRun())
    const outcome = importManualCloudAgentResult(
      baseImportInput({ toolExecutionRunId: 'missing-run' }),
      deps,
    )
    assert.equal(outcome.ok, false)
    if (outcome.ok) return
    assert.equal(outcome.reasonCode, 'TOOL_EXECUTION_RUN_NOT_FOUND')
  })

  it('7. wrong route', () => {
    const { deps } = createMemoryDeps(
      baseRun({
        result: {
          plannedOnly: true,
          output: { executionRoute: 'LOCAL_CURSOR_BRIDGE' },
          deliveryMode: 'cursor_v1',
          cursorAutomationTaskId: null,
          registryInvokePlanId: null,
          receivedAt: null,
        },
      }),
    )
    const outcome = importManualCloudAgentResult(baseImportInput(), deps)
    assert.equal(outcome.ok, false)
    if (outcome.ok) return
    assert.equal(outcome.reasonCode, 'ROUTE_MISMATCH')
  })

  it('8. already terminal run', () => {
    const { deps } = createMemoryDeps(baseRun({ status: 'failed' }))
    const outcome = importManualCloudAgentResult(baseImportInput(), deps)
    assert.equal(outcome.ok, false)
    if (outcome.ok) return
    assert.equal(outcome.reasonCode, 'RUN_ALREADY_TERMINAL')
  })

  it('9. duplicate import', () => {
    const { deps } = createMemoryDeps(
      baseRun({
        status: 'awaiting_employee_review',
        result: {
          plannedOnly: false,
          output: { cursorResultEnvelopeV110: { route: 'MANUAL_CLOUD_AGENT' } },
          deliveryMode: 'cursor_v1',
          cursorAutomationTaskId: null,
          registryInvokePlanId: null,
          receivedAt: FINISHED_AT,
        },
      }),
    )
    const outcome = importManualCloudAgentResult(baseImportInput(), deps)
    assert.equal(outcome.ok, false)
    if (outcome.ok) return
    assert.equal(outcome.reasonCode, 'RESULT_ALREADY_IMPORTED')
    assert.equal(outcome.existingResultRef, FINISHED_AT)
  })

  it('10. invalid commit SHA', () => {
    const { deps } = createMemoryDeps(baseRun())
    const outcome = importManualCloudAgentResult(
      baseImportInput({ commitSha: 'not-a-sha' }),
      deps,
    )
    assert.equal(outcome.ok, false)
    if (outcome.ok) return
    assert.equal(outcome.reasonCode, 'INVALID_COMMIT_SHA')
  })

  it('11. invalid PR URL', () => {
    const { deps } = createMemoryDeps(baseRun())
    const outcome = importManualCloudAgentResult(
      baseImportInput({ pullRequestUrl: 'https://example.com/not-a-pr' }),
      deps,
    )
    assert.equal(outcome.ok, false)
    if (outcome.ok) return
    assert.equal(outcome.reasonCode, 'INVALID_PULL_REQUEST_URL')
  })

  it('12. SUCCEEDED without evidence', () => {
    const { deps } = createMemoryDeps(baseRun())
    const outcome = importManualCloudAgentResult(
      baseImportInput({
        summary: '',
        branch: null,
        commitSha: null,
        pullRequestUrl: null,
        changedFiles: [],
      }),
      deps,
    )
    assert.equal(outcome.ok, false)
    if (outcome.ok) return
    assert.equal(outcome.reasonCode, 'EXECUTION_EVIDENCE_REQUIRED')
  })

  it('13. duplicate changedFiles normalized', () => {
    const { deps } = createMemoryDeps(baseRun())
    const outcome = importManualCloudAgentResult(
      baseImportInput({ changedFiles: ['src/a.ts', 'src/a.ts', 'src/b.ts'] }),
      deps,
    )
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    assert.deepEqual(outcome.envelope.changedFiles, ['src/a.ts', 'src/b.ts'])
  })

  it('14. checks preserved', () => {
    const { deps } = createMemoryDeps(baseRun())
    const outcome = importManualCloudAgentResult(baseImportInput(), deps)
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    assert.equal(outcome.envelope.checks.length, 2)
    assert.equal(outcome.envelope.checks[0]?.status, 'passed')
    assert.equal(outcome.envelope.checks[1]?.status, 'skipped')
  })

  it('15. errors preserved on failed import', () => {
    const { deps } = createMemoryDeps(baseRun())
    const outcome = importManualCloudAgentResult(
      baseImportInput({
        finalStatus: 'FAILED',
        summary: 'Failed run',
        errors: [{ code: 'CURSOR_ERROR', message: 'Agent crashed', details: { exit: 1 } }],
        branch: null,
        commitSha: null,
        pullRequestUrl: null,
        changedFiles: [],
        checks: [],
      }),
      deps,
    )
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    assert.equal(outcome.envelope.errors[0]?.code, 'CURSOR_ERROR')
    assert.equal(outcome.envelope.errors[0]?.message, 'Agent crashed')
  })

  it('16. review status becomes PENDING on success', () => {
    const { deps } = createMemoryDeps(baseRun())
    const outcome = importManualCloudAgentResult(baseImportInput(), deps)
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    assert.equal(outcome.envelope.reviewStatus, 'PENDING')
  })

  it('17. ToolExecutionRun becomes awaiting_employee_review on success', () => {
    const { deps, getStoredRun } = createMemoryDeps(baseRun())
    const outcome = importManualCloudAgentResult(baseImportInput(), deps)
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    assert.equal(getStoredRun()?.status, 'awaiting_employee_review')
    assert.equal(outcome.reasonCode, 'IMPORT_REQUIRES_REVIEW')
  })

  it('18. no fake success on failed import', () => {
    const { deps } = createMemoryDeps(baseRun())
    const outcome = importManualCloudAgentResult(
      baseImportInput({
        finalStatus: 'FAILED',
        summary: 'Build failed',
        errors: [{ code: 'BUILD', message: 'failed' }],
        branch: null,
        commitSha: null,
        pullRequestUrl: null,
        changedFiles: [],
        checks: [],
      }),
      deps,
    )
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    assert.notEqual(outcome.envelope.executionStatus, 'SUCCEEDED')
    assert.notEqual(outcome.envelope.reviewStatus, 'APPROVED')
    assert.equal(outcome.review, null)
  })

  it('19. creates builder review on success without auto-approval', () => {
    const { deps, getStoredReview } = createMemoryDeps(baseRun())
    const outcome = importManualCloudAgentResult(baseImportInput(), deps)
    assert.equal(outcome.ok, true)
    if (!outcome.ok) return
    const review = getStoredReview()
    assert.ok(review)
    assert.equal(review?.status, 'awaiting_employee_review')
    assert.equal(review?.envelope.status, 'completed')
  })
})
