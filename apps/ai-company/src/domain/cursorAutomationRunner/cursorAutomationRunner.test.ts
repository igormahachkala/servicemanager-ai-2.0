/**
 * Cursor Automation Runner + Builder Automation Flow — tests (AI-COMPANY-113).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { EMPLOYEE_ROUTE_IDS } from '../../mission-control/data/employeeIdResolver.ts'
import type { ExecutionRouteDecision } from '../cursorExecutionRoute/cursorExecutionRouteTypes.ts'
import { evaluateCursorExecutionDispatch } from '../cursorExecutionRoute/cursorExecutionRoutePreflight.ts'
import { buildCursorRoutePolicyInputFromDispatch } from '../cursorExecutionRoute/routePolicyFromDispatchInput.ts'
import type { DispatchToolRequestInput } from '../toolDispatcher/toolDispatcherTypes.ts'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes.ts'
import { createBuilderAutomationOwnerTask } from '../builderAutomationTaskFlow/builderAutomationTaskFlowCreate.ts'
import { approveAndDispatchBuilderAutomation } from '../builderAutomationTaskFlow/builderAutomationTaskFlowDispatch.ts'
import { buildBuilderAutomationFinalReport } from '../builderAutomationTaskFlow/builderAutomationTaskFlowFinalReport.ts'
import { buildBuilderAutomationTaskFlowMetadata } from '../builderAutomationTaskFlow/builderAutomationTaskFlowMetadata.ts'
import { projectBuilderAutomationTaskFlowSnapshot } from '../builderAutomationTaskFlow/builderAutomationTaskFlowState.ts'
import type { CreateBuilderAutomationOwnerTaskInput } from '../builderAutomationTaskFlow/builderAutomationTaskFlowTypes.ts'
import { createPendingAutomationEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeFactories.ts'
import { redactCursorAutomationSecret } from './cursorAutomationSecretRedaction.ts'
import { validateResultMarker } from './cursorAutomationResultMarker.ts'
import { runCursorAutomation } from './runCursorAutomation.ts'
import { createDefaultRunCursorAutomationDeps } from './cursorAutomationRunnerDefaultDeps.ts'
import { reconcileCursorAutomationResult } from './cursorAutomationReconciliation.ts'
import { createDefaultReconcileDeps } from './cursorAutomationRunnerDefaultDeps.ts'
import { readCursorAutomationRunnerMetadata } from './cursorAutomationRunnerMetadata.ts'

const WEBHOOK_URL = 'https://api2.cursor.sh/automations/webhook/test-uuid'
const WEBHOOK_KEY = 'crsr_test_secret_key_12345'
const COMPOSER_ID = 'bc-test-composer-001'

const nodeRouteConfig = {
  environment: 'dev' as const,
  automationWebhookAvailable: true,
  localBridgeAvailable: false,
  manualOperatorAvailable: false,
  expectedCostClassificationByRoute: undefined,
}

function webhookRouteDecision(overrides: Partial<ExecutionRouteDecision> = {}): ExecutionRouteDecision {
  return {
    selectedRoute: 'CURSOR_AUTOMATION_WEBHOOK',
    allowed: false,
    requiresOwnerApproval: true,
    costClassification: 'INCLUDED_IN_SUBSCRIPTION',
    reasonCode: 'OWNER_APPROVAL_REQUIRED',
    explanation: 'Webhook requires Owner approval.',
    alternatives: [],
    ...overrides,
  }
}

function fixtureRun(overrides: Partial<ToolExecutionRun> = {}): ToolExecutionRun {
  return {
    id: 'terun-auto-001',
    version: 'v1',
    companyId: 'company-default',
    employeeId: EMPLOYEE_ROUTE_IDS.builder,
    toolId: 'cursor',
    toolRequestId: 'td-req-auto-001',
    workItemId: 'wi-auto-001',
    delegationPlanId: 'dplan-auto-001',
    workerLoopId: null,
    builderToolDecisionId: null,
    legacyBuilderRunId: null,
    title: 'Autonomous Builder test',
    instructions: 'Create tmp/autonomous-builder-test.txt',
    expectedResult: 'File exists',
    fileScope: ['tmp/autonomous-builder-test.txt'],
    checks: ['npm --prefix apps/ai-company run build'],
    status: 'approved',
    createdAt: '2026-07-14T08:00:00.000Z',
    updatedAt: '2026-07-14T08:00:00.000Z',
    approvedAt: '2026-07-14T09:00:00.000Z',
    startedAt: null,
    completedAt: null,
    failedAt: null,
    result: null,
    error: null,
    history: [],
    ...overrides,
  }
}

function mockFetch(status: number, body: Record<string, unknown>): typeof fetch {
  return async () =>
    ({
      status,
      text: async () => JSON.stringify(body),
    }) as Response
}

function installStorageMock(): void {
  const data = new Map<string, string>()
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => data.delete(key),
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size
    },
  }

  ;(globalThis as { window?: Window; localStorage?: Storage }).window = {
    localStorage: storage as Storage,
    dispatchEvent: () => true,
    location: { origin: 'http://localhost:5173' },
  } as Window
  ;(globalThis as { localStorage?: Storage }).localStorage = storage as Storage
}

function baseCreateInput(
  overrides: Partial<CreateBuilderAutomationOwnerTaskInput> = {},
): CreateBuilderAutomationOwnerTaskInput {
  return {
    title: 'Autonomous Builder Cursor task',
    instruction: 'Create file tmp/autonomous-builder-test.txt with greeting text.',
    expectedResult: 'File exists with expected content.',
    repository: 'igor/servicemanager-ai-2.0',
    baseBranch: 'main',
    environment: 'dev',
    assignedEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
    fileScope: ['tmp/autonomous-builder-test.txt'],
    checks: ['npm --prefix apps/ai-company run test:domain', 'npm --prefix apps/ai-company run build'],
    ...overrides,
  }
}

describe('cursorAutomationRunner', () => {
  it('1. route policy selects CURSOR_AUTOMATION_WEBHOOK for autonomous Builder task', () => {
    const dispatchInput: DispatchToolRequestInput = {
      toolId: 'cursor',
      action: 'handoff',
      title: 'Task',
      instructions: 'Do work',
      requestedByEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
      decidedByEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
      payload: {
        eventDriven: true,
        requiresReliableCompletion: false,
        requiresAutomaticExecution: true,
        localBridgeAvailable: false,
        manualOperatorAvailable: false,
        automationWebhookAvailable: true,
        requiresCommitOrPullRequest: true,
        ownerApprovalGranted: false,
        environment: 'dev',
      },
      context: { companyId: 'company-default', source: 'manual' },
    }

    const policyInput = buildCursorRoutePolicyInputFromDispatch(dispatchInput, nodeRouteConfig)
    const decision = evaluateCursorExecutionDispatch(policyInput).routeDecision

    assert.equal(decision.selectedRoute, 'CURSOR_AUTOMATION_WEBHOOK')
    assert.equal(decision.requiresOwnerApproval, true)
  })

  it('2. missing Owner approval blocks runner', async () => {
    const runs: ToolExecutionRun[] = [fixtureRun({ status: 'awaiting_owner' })]
    const deps = createDefaultRunCursorAutomationDeps({
      upsertRun: (run) => {
        runs[0] = run
        return run
      },
      markQueued: () => runs[0],
      markRunning: () => runs[0],
      markFailed: () => runs[0],
      resolveWebhookConfig: () => ({ url: WEBHOOK_URL, apiKey: WEBHOOK_KEY, configKeys: { url: 'u', apiKey: 'k' } }),
      logEvent: () => {},
    })

    const outcome = await runCursorAutomation(
      {
        run: runs[0],
        routeDecision: webhookRouteDecision(),
        ownerApproved: false,
        repository: 'igor/servicemanager-ai-2.0',
        baseBranch: 'main',
      },
      deps,
    )

    assert.equal(outcome.ok, false)
    if (!outcome.ok) assert.equal(outcome.code, 'OWNER_APPROVAL_REQUIRED')
  })

  it('3. UNKNOWN_COST blocks runner', async () => {
    const run = fixtureRun()
    const deps = createDefaultRunCursorAutomationDeps({
      upsertRun: (r) => r,
      markQueued: () => run,
      markRunning: () => run,
      markFailed: () => run,
      resolveWebhookConfig: () => ({ url: WEBHOOK_URL, apiKey: WEBHOOK_KEY, configKeys: { url: 'u', apiKey: 'k' } }),
      logEvent: () => {},
    })

    const outcome = await runCursorAutomation(
      {
        run,
        routeDecision: webhookRouteDecision({
          allowed: true,
          costClassification: 'UNKNOWN_COST',
        }),
        ownerApproved: true,
        repository: 'igor/servicemanager-ai-2.0',
        baseBranch: 'main',
      },
      deps,
    )

    assert.equal(outcome.ok, false)
    if (!outcome.ok) assert.equal(outcome.code, 'COST_BLOCKED')
  })

  it('4. missing webhook config blocks runner', async () => {
    const run = fixtureRun()
    const deps = createDefaultRunCursorAutomationDeps({
      upsertRun: (r) => r,
      markQueued: () => run,
      markRunning: () => run,
      markFailed: () => run,
      resolveWebhookConfig: () => ({ url: null, apiKey: null, configKeys: { url: 'u', apiKey: 'k' } }),
      logEvent: () => {},
    })

    const outcome = await runCursorAutomation(
      {
        run,
        routeDecision: webhookRouteDecision({ allowed: true, requiresOwnerApproval: false }),
        ownerApproved: true,
        repository: 'igor/servicemanager-ai-2.0',
        baseBranch: 'main',
      },
      deps,
    )

    assert.equal(outcome.ok, false)
    if (!outcome.ok) assert.equal(outcome.code, 'WEBHOOK_CONFIG_MISSING')
  })

  it('5. HTTP 401 → transport failure', async () => {
    let failed = false
    const run = fixtureRun()
    const deps = createDefaultRunCursorAutomationDeps({
      upsertRun: (r) => r,
      markQueued: () => run,
      markRunning: () => run,
      markFailed: () => {
        failed = true
        return { ...run, status: 'failed' }
      },
      resolveWebhookConfig: () => ({ url: WEBHOOK_URL, apiKey: WEBHOOK_KEY, configKeys: { url: 'u', apiKey: 'k' } }),
      fetchImpl: mockFetch(401, { code: 'error', message: 'Invalid API key' }),
      logEvent: () => {},
    })

    const outcome = await runCursorAutomation(
      {
        run,
        routeDecision: webhookRouteDecision({ allowed: true, requiresOwnerApproval: false }),
        ownerApproved: true,
        repository: 'igor/servicemanager-ai-2.0',
        baseBranch: 'main',
      },
      deps,
    )

    assert.equal(outcome.ok, false)
    if (!outcome.ok) assert.equal(outcome.code, 'TRANSPORT_UNAUTHORIZED')
    assert.equal(failed, true)
  })

  it('6. HTTP 400 → structured failure', async () => {
    const run = fixtureRun()
    const deps = createDefaultRunCursorAutomationDeps({
      upsertRun: (r) => r,
      markQueued: () => run,
      markRunning: () => run,
      markFailed: () => ({ ...run, status: 'failed' }),
      resolveWebhookConfig: () => ({ url: WEBHOOK_URL, apiKey: WEBHOOK_KEY, configKeys: { url: 'u', apiKey: 'k' } }),
      fetchImpl: mockFetch(400, { success: false, error: 'Automation disabled' }),
      logEvent: () => {},
    })

    const outcome = await runCursorAutomation(
      {
        run,
        routeDecision: webhookRouteDecision({ allowed: true, requiresOwnerApproval: false }),
        ownerApproved: true,
        repository: 'igor/servicemanager-ai-2.0',
        baseBranch: 'main',
      },
      deps,
    )

    assert.equal(outcome.ok, false)
    if (!outcome.ok) assert.equal(outcome.code, 'TRANSPORT_BAD_REQUEST')
  })

  it('7. HTTP 500 → retryable transport failure', async () => {
    const run = fixtureRun()
    const deps = createDefaultRunCursorAutomationDeps({
      upsertRun: (r) => r,
      markQueued: () => run,
      markRunning: () => run,
      markFailed: () => ({ ...run, status: 'failed' }),
      resolveWebhookConfig: () => ({ url: WEBHOOK_URL, apiKey: WEBHOOK_KEY, configKeys: { url: 'u', apiKey: 'k' } }),
      fetchImpl: mockFetch(500, { code: 'internal', message: 'Error' }),
      logEvent: () => {},
    })

    const outcome = await runCursorAutomation(
      {
        run,
        routeDecision: webhookRouteDecision({ allowed: true, requiresOwnerApproval: false }),
        ownerApproved: true,
        repository: 'igor/servicemanager-ai-2.0',
        baseBranch: 'main',
      },
      deps,
    )

    assert.equal(outcome.ok, false)
    if (!outcome.ok) {
      assert.equal(outcome.code, 'TRANSPORT_SERVER_ERROR')
      assert.equal(outcome.retryable, true)
    }
  })

  it('8. HTTP 200 + backgroundComposerId → DISPATCHED + RESULT_PENDING', async () => {
    let persisted: ToolExecutionRun | null = null
    const run = fixtureRun()
    const deps = createDefaultRunCursorAutomationDeps({
      upsertRun: (r) => {
        persisted = r
        return r
      },
      markQueued: () => ({ ...run, status: 'queued' }),
      markRunning: () => ({ ...run, status: 'running' }),
      markFailed: () => run,
      resolveWebhookConfig: () => ({ url: WEBHOOK_URL, apiKey: WEBHOOK_KEY, configKeys: { url: 'u', apiKey: 'k' } }),
      fetchImpl: mockFetch(200, { success: true, backgroundComposerId: COMPOSER_ID }),
      logEvent: () => {},
    })

    const outcome = await runCursorAutomation(
      {
        run,
        routeDecision: webhookRouteDecision({ allowed: true, requiresOwnerApproval: false }),
        ownerApproved: true,
        repository: 'igor/servicemanager-ai-2.0',
        baseBranch: 'main',
      },
      deps,
    )

    assert.equal(outcome.ok, true)
    if (outcome.ok) {
      assert.equal(outcome.envelope.transportStatus, 'DISPATCHED')
      assert.equal(outcome.envelope.executionStatus, 'RESULT_PENDING')
      assert.equal(outcome.backgroundComposerId, COMPOSER_ID)
      assert.equal(persisted?.status, 'running')
    }
  })

  it('9. HTTP 200 without backgroundComposerId → invalid response failure', async () => {
    const run = fixtureRun()
    const deps = createDefaultRunCursorAutomationDeps({
      upsertRun: (r) => r,
      markQueued: () => run,
      markRunning: () => run,
      markFailed: () => ({ ...run, status: 'failed' }),
      resolveWebhookConfig: () => ({ url: WEBHOOK_URL, apiKey: WEBHOOK_KEY, configKeys: { url: 'u', apiKey: 'k' } }),
      fetchImpl: mockFetch(200, { success: true }),
      logEvent: () => {},
    })

    const outcome = await runCursorAutomation(
      {
        run,
        routeDecision: webhookRouteDecision({ allowed: true, requiresOwnerApproval: false }),
        ownerApproved: true,
        repository: 'igor/servicemanager-ai-2.0',
        baseBranch: 'main',
      },
      deps,
    )

    assert.equal(outcome.ok, false)
    if (!outcome.ok) assert.equal(outcome.code, 'INVALID_WEBHOOK_RESPONSE')
  })

  it('10. duplicate business task does not start second enqueue', async () => {
    let fetchCount = 0
    const run = fixtureRun({
      result: {
        plannedOnly: false,
        output: {
          cursorAutomationRunner: {
            version: 'v1',
            repository: 'igor/servicemanager-ai-2.0',
            baseBranch: 'main',
            environment: 'dev',
            idempotencyKey: 'builder-automation:terun-auto-001:enqueue',
            dispatchPhase: 'RESULT_PENDING',
            ownerApprovedAt: null,
            dispatchedAt: '2026-07-14T09:00:00.000Z',
            reconciliationStartedAt: null,
            reconciliationLastCheckedAt: null,
            reconciliationPollCount: 0,
            resultMarkerPath: 'tmp/ai-company-results/terun-auto-001.json',
            branchPrefix: 'cursor/',
            attempts: [
              {
                id: 'caa-1',
                idempotencyKey: 'builder-automation:terun-auto-001:enqueue',
                attemptNumber: 1,
                startedAt: '2026-07-14T09:00:00.000Z',
                finishedAt: '2026-07-14T09:00:01.000Z',
                httpStatus: 200,
                backgroundComposerId: COMPOSER_ID,
                transportStatus: 'DISPATCHED',
                errorMessage: null,
              },
            ],
            timeoutAt: null,
            timeoutReason: null,
          },
        },
        deliveryMode: 'cursor_v1',
        cursorAutomationTaskId: null,
        registryInvokePlanId: null,
        receivedAt: null,
      },
    })

    const deps = createDefaultRunCursorAutomationDeps({
      upsertRun: (r) => r,
      markQueued: () => run,
      markRunning: () => run,
      markFailed: () => run,
      resolveWebhookConfig: () => ({ url: WEBHOOK_URL, apiKey: WEBHOOK_KEY, configKeys: { url: 'u', apiKey: 'k' } }),
      fetchImpl: async () => {
        fetchCount += 1
        return { status: 200, text: async () => JSON.stringify({ success: true, backgroundComposerId: 'x' }) } as Response
      },
      logEvent: () => {},
    })

    const outcome = await runCursorAutomation(
      {
        run,
        routeDecision: webhookRouteDecision({ allowed: true, requiresOwnerApproval: false }),
        ownerApproved: true,
        repository: 'igor/servicemanager-ai-2.0',
        baseBranch: 'main',
      },
      deps,
    )

    assert.equal(outcome.ok, false)
    if (!outcome.ok) assert.equal(outcome.code, 'DUPLICATE_DISPATCH_BLOCKED')
    assert.equal(fetchCount, 0)
  })

  it('11. retry creates new attempt', async () => {
    let persisted: ToolExecutionRun | null = null
    const run = fixtureRun({
      result: {
        plannedOnly: false,
        output: {
          cursorAutomationRunner: {
            version: 'v1',
            repository: 'igor/servicemanager-ai-2.0',
            baseBranch: 'main',
            environment: 'dev',
            idempotencyKey: 'builder-automation:terun-auto-001:enqueue',
            dispatchPhase: 'TRANSPORT_FAILED',
            ownerApprovedAt: null,
            dispatchedAt: null,
            reconciliationStartedAt: null,
            reconciliationLastCheckedAt: null,
            reconciliationPollCount: 0,
            resultMarkerPath: 'tmp/ai-company-results/terun-auto-001.json',
            branchPrefix: 'cursor/',
            attempts: [
              {
                id: 'caa-1',
                idempotencyKey: 'builder-automation:terun-auto-001:enqueue',
                attemptNumber: 1,
                startedAt: '2026-07-14T09:00:00.000Z',
                finishedAt: '2026-07-14T09:00:01.000Z',
                httpStatus: 500,
                backgroundComposerId: null,
                transportStatus: 'TRANSPORT_FAILED',
                errorMessage: 'server error',
              },
            ],
            timeoutAt: null,
            timeoutReason: null,
          },
        },
        deliveryMode: 'cursor_v1',
        cursorAutomationTaskId: null,
        registryInvokePlanId: null,
        receivedAt: null,
      },
    })

    const deps = createDefaultRunCursorAutomationDeps({
      upsertRun: (r) => {
        persisted = r
        return r
      },
      markQueued: () => ({ ...run, status: 'queued' }),
      markRunning: () => ({ ...run, status: 'running' }),
      markFailed: () => run,
      resolveWebhookConfig: () => ({ url: WEBHOOK_URL, apiKey: WEBHOOK_KEY, configKeys: { url: 'u', apiKey: 'k' } }),
      fetchImpl: mockFetch(200, { success: true, backgroundComposerId: 'bc-retry-002' }),
      logEvent: () => {},
    })

    const outcome = await runCursorAutomation(
      {
        run,
        routeDecision: webhookRouteDecision({ allowed: true, requiresOwnerApproval: false }),
        ownerApproved: true,
        repository: 'igor/servicemanager-ai-2.0',
        baseBranch: 'main',
        isRetry: true,
      },
      deps,
    )

    assert.equal(outcome.ok, true)
    const metadata = persisted ? readCursorAutomationRunnerMetadata(persisted) : null
    assert.equal(metadata?.attempts.length, 2)
    assert.notEqual(metadata?.attempts[1].idempotencyKey, metadata?.attempts[0].idempotencyKey)
  })

  it('12. secret redaction removes webhook key from logs', () => {
    const redacted = redactCursorAutomationSecret(
      `Authorization: Bearer ${WEBHOOK_KEY} failed`,
      WEBHOOK_KEY,
    )
    assert.ok(!redacted.includes(WEBHOOK_KEY))
    assert.match(redacted, /REDACTED/)
  })

  it('13. pending envelope is correct', () => {
    const envelope = createPendingAutomationEnvelope({
      toolExecutionRunId: 'terun-auto-001',
      backgroundComposerId: COMPOSER_ID,
    })
    assert.equal(envelope.route, 'CURSOR_AUTOMATION_WEBHOOK')
    assert.equal(envelope.transportStatus, 'DISPATCHED')
    assert.equal(envelope.executionStatus, 'RESULT_PENDING')
    assert.equal(envelope.metadata.enqueueOnly, true)
  })

  it('14. backgroundComposerId stored as externalCorrelationId', async () => {
    const run = fixtureRun()
    const deps = createDefaultRunCursorAutomationDeps({
      upsertRun: (r) => r,
      markQueued: () => ({ ...run, status: 'queued' }),
      markRunning: () => ({ ...run, status: 'running' }),
      markFailed: () => run,
      resolveWebhookConfig: () => ({ url: WEBHOOK_URL, apiKey: WEBHOOK_KEY, configKeys: { url: 'u', apiKey: 'k' } }),
      fetchImpl: mockFetch(200, { success: true, backgroundComposerId: COMPOSER_ID }),
      logEvent: () => {},
    })

    const outcome = await runCursorAutomation(
      {
        run,
        routeDecision: webhookRouteDecision({ allowed: true, requiresOwnerApproval: false }),
        ownerApproved: true,
        repository: 'igor/servicemanager-ai-2.0',
        baseBranch: 'main',
      },
      deps,
    )

    assert.equal(outcome.ok, true)
    if (outcome.ok) {
      assert.equal(outcome.envelope.externalCorrelationId, COMPOSER_ID)
      assert.equal(outcome.attempt.backgroundComposerId, COMPOSER_ID)
    }
  })

  it('15. result marker success → REVIEW_REQUIRED via reconciliation', async () => {
    const marker = {
      toolExecutionRunId: 'terun-auto-001',
      status: 'SUCCEEDED',
      summary: 'Created test file',
      branch: 'cursor/autonomous-001',
      commitSha: 'abc1234567890',
      pullRequestUrl: 'https://github.com/org/repo/pull/1',
      changedFiles: ['tmp/autonomous-builder-test.txt'],
      checks: [{ name: 'build', status: 'PASSED' }],
      errors: [],
      finishedAt: '2026-07-14T10:00:00.000Z',
    }

    const run = fixtureRun({
      status: 'running',
      result: {
        plannedOnly: false,
        output: {
          cursorAutomationRunner: {
            version: 'v1',
            repository: 'igor/servicemanager-ai-2.0',
            baseBranch: 'main',
            environment: 'dev',
            idempotencyKey: 'builder-automation:terun-auto-001:enqueue',
            dispatchPhase: 'RESULT_PENDING',
            ownerApprovedAt: '2026-07-14T09:00:00.000Z',
            dispatchedAt: '2026-07-14T09:00:00.000Z',
            reconciliationStartedAt: '2026-07-14T09:00:00.000Z',
            reconciliationLastCheckedAt: null,
            reconciliationPollCount: 0,
            resultMarkerPath: 'tmp/ai-company-results/terun-auto-001.json',
            branchPrefix: 'cursor/',
            attempts: [
              {
                id: 'caa-1',
                idempotencyKey: 'builder-automation:terun-auto-001:enqueue',
                attemptNumber: 1,
                startedAt: '2026-07-14T09:00:00.000Z',
                finishedAt: '2026-07-14T09:00:01.000Z',
                httpStatus: 200,
                backgroundComposerId: COMPOSER_ID,
                transportStatus: 'DISPATCHED',
                errorMessage: null,
              },
            ],
            timeoutAt: '2099-01-01T00:00:00.000Z',
            timeoutReason: null,
          },
          cursorResultEnvelopeV110: createPendingAutomationEnvelope({
            toolExecutionRunId: 'terun-auto-001',
            backgroundComposerId: COMPOSER_ID,
          }),
        },
        deliveryMode: 'cursor_v1',
        cursorAutomationTaskId: null,
        registryInvokePlanId: null,
        receivedAt: null,
      },
    })

    let reviewCreated = false
    const deps = createDefaultReconcileDeps({
      getRun: () => run,
      upsertRun: (r) => r,
      recordResult: (input) => ({
        ...run,
        status: 'awaiting_employee_review',
        result: { ...run.result!, output: input.output },
      }),
      failRun: () => run,
      readResultMarker: async () => marker,
      resolveEvidence: async () => ({
        branchExists: true,
        commitExists: true,
        pullRequestValid: true,
      }),
      createReview: (input) => {
        reviewCreated = true
        return {
          id: 'review-001',
          ...input,
          status: 'awaiting_employee_review',
          createdAt: '2026-07-14T10:00:00.000Z',
          updatedAt: '2026-07-14T10:00:00.000Z',
          history: [],
        }
      },
      logEvent: () => {},
      now: () => Date.parse('2026-07-14T10:05:00.000Z'),
    })

    const outcome = await reconcileCursorAutomationResult({ runId: run.id, pollIntervalMs: 0 }, deps)
    assert.equal(outcome.ok, true)
    if (outcome.ok) {
      assert.equal(outcome.status, 'DISCOVERED')
      assert.equal(outcome.envelope.executionStatus, 'SUCCEEDED')
      assert.equal(outcome.envelope.reviewStatus, 'PENDING')
      assert.equal(reviewCreated, true)
    }
  })

  it('16. result marker failed → FAILED execution status', async () => {
    const marker = {
      toolExecutionRunId: 'terun-auto-001',
      status: 'FAILED',
      summary: 'Could not complete task',
      branch: 'cursor/autonomous-001',
      commitSha: 'abc1234567890',
      pullRequestUrl: null,
      changedFiles: [],
      checks: [],
      errors: [{ code: 'TASK_FAILED', message: 'Agent failed' }],
      finishedAt: '2026-07-14T10:00:00.000Z',
    }

    const run = fixtureRun({
      status: 'running',
      result: {
        plannedOnly: false,
        output: {
          cursorAutomationRunner: {
            version: 'v1',
            repository: 'igor/servicemanager-ai-2.0',
            baseBranch: 'main',
            environment: 'dev',
            idempotencyKey: 'builder-automation:terun-auto-001:enqueue',
            dispatchPhase: 'RESULT_PENDING',
            ownerApprovedAt: null,
            dispatchedAt: '2026-07-14T09:00:00.000Z',
            reconciliationStartedAt: '2026-07-14T09:00:00.000Z',
            reconciliationLastCheckedAt: null,
            reconciliationPollCount: 0,
            resultMarkerPath: 'tmp/ai-company-results/terun-auto-001.json',
            branchPrefix: 'cursor/',
            attempts: [],
            timeoutAt: '2099-01-01T00:00:00.000Z',
            timeoutReason: null,
          },
        },
        deliveryMode: 'cursor_v1',
        cursorAutomationTaskId: null,
        registryInvokePlanId: null,
        receivedAt: null,
      },
    })

    const deps = createDefaultReconcileDeps({
      getRun: () => run,
      upsertRun: (r) => r,
      recordResult: () => run,
      failRun: () => ({ ...run, status: 'failed' }),
      readResultMarker: async () => marker,
      resolveEvidence: async () => ({
        branchExists: true,
        commitExists: true,
        pullRequestValid: false,
      }),
      logEvent: () => {},
      now: () => Date.parse('2026-07-14T10:05:00.000Z'),
    })

    const outcome = await reconcileCursorAutomationResult({ runId: run.id, pollIntervalMs: 0 }, deps)
    assert.equal(outcome.ok, true)
    if (outcome.ok) assert.equal(outcome.status, 'FAILED')
  })

  it('17. invalid result marker rejected', async () => {
    const validation = validateResultMarker({
      marker: {
        toolExecutionRunId: 'terun-auto-001',
        status: 'SUCCEEDED',
        summary: '',
        branch: 'cursor/x',
        commitSha: 'bad',
        pullRequestUrl: null,
        changedFiles: [],
        checks: [],
        errors: [],
        finishedAt: 'not-a-date',
      },
      expectedRunId: 'terun-auto-001',
      evidence: { branchExists: true, commitExists: false, pullRequestValid: false },
    })
    assert.equal(validation.ok, false)
  })

  it('18. wrong toolExecutionRunId rejected', async () => {
    const run = fixtureRun({
      status: 'running',
      result: {
        plannedOnly: false,
        output: {
          cursorAutomationRunner: {
            version: 'v1',
            repository: 'igor/servicemanager-ai-2.0',
            baseBranch: 'main',
            environment: 'dev',
            idempotencyKey: 'builder-automation:terun-auto-001:enqueue',
            dispatchPhase: 'RESULT_PENDING',
            ownerApprovedAt: null,
            dispatchedAt: '2026-07-14T09:00:00.000Z',
            reconciliationStartedAt: '2026-07-14T09:00:00.000Z',
            reconciliationLastCheckedAt: null,
            reconciliationPollCount: 0,
            resultMarkerPath: 'tmp/ai-company-results/terun-auto-001.json',
            branchPrefix: 'cursor/',
            attempts: [],
            timeoutAt: '2099-01-01T00:00:00.000Z',
            timeoutReason: null,
          },
        },
        deliveryMode: 'cursor_v1',
        cursorAutomationTaskId: null,
        registryInvokePlanId: null,
        receivedAt: null,
      },
    })
    const deps = createDefaultReconcileDeps({
      getRun: () => run,
      upsertRun: (r) => r,
      recordResult: () => run,
      failRun: () => run,
      readResultMarker: async () => ({
        toolExecutionRunId: 'other-run',
        status: 'SUCCEEDED',
        summary: 'ok',
        branch: 'cursor/x',
        commitSha: 'abc1234567890',
        pullRequestUrl: null,
        changedFiles: [],
        checks: [],
        errors: [],
        finishedAt: '2026-07-14T10:00:00.000Z',
      }),
      resolveEvidence: async () => ({
        branchExists: true,
        commitExists: true,
        pullRequestValid: false,
      }),
      logEvent: () => {},
      now: () => Date.now(),
    })

    const outcome = await reconcileCursorAutomationResult(
      { runId: run.id, pollIntervalMs: 0 },
      deps,
    )
    assert.equal(outcome.ok, false)
    if (!outcome.ok) assert.equal(outcome.code, 'RUN_ID_MISMATCH')
  })

  it('19. missing commit evidence does not allow SUCCEEDED', () => {
    const validation = validateResultMarker({
      marker: {
        toolExecutionRunId: 'terun-auto-001',
        status: 'SUCCEEDED',
        summary: 'done',
        branch: 'cursor/x',
        commitSha: 'abc1234567890',
        pullRequestUrl: null,
        changedFiles: ['a.txt'],
        checks: [],
        errors: [],
        finishedAt: '2026-07-14T10:00:00.000Z',
      },
      expectedRunId: 'terun-auto-001',
      evidence: { branchExists: true, commitExists: false, pullRequestValid: false },
    })
    assert.equal(validation.ok, false)
  })

  it('20. timeout → TIMED_OUT', async () => {
    const run = fixtureRun({
      status: 'running',
      result: {
        plannedOnly: false,
        output: {
          cursorAutomationRunner: {
            version: 'v1',
            repository: 'igor/servicemanager-ai-2.0',
            baseBranch: 'main',
            environment: 'dev',
            idempotencyKey: 'builder-automation:terun-auto-001:enqueue',
            dispatchPhase: 'RESULT_PENDING',
            ownerApprovedAt: null,
            dispatchedAt: '2026-07-14T09:00:00.000Z',
            reconciliationStartedAt: '2026-07-14T09:00:00.000Z',
            reconciliationLastCheckedAt: null,
            reconciliationPollCount: 0,
            resultMarkerPath: 'tmp/ai-company-results/terun-auto-001.json',
            branchPrefix: 'cursor/',
            attempts: [],
            timeoutAt: '2026-07-14T09:30:00.000Z',
            timeoutReason: null,
          },
        },
        deliveryMode: 'cursor_v1',
        cursorAutomationTaskId: null,
        registryInvokePlanId: null,
        receivedAt: null,
      },
    })

    const deps = createDefaultReconcileDeps({
      getRun: () => run,
      upsertRun: (r) => r,
      recordResult: () => run,
      failRun: () => ({ ...run, status: 'failed' }),
      readResultMarker: async () => null,
      resolveEvidence: async () => ({
        branchExists: false,
        commitExists: false,
        pullRequestValid: false,
      }),
      logEvent: () => {},
      now: () => Date.parse('2026-07-14T10:00:00.000Z'),
    })

    const outcome = await reconcileCursorAutomationResult({ runId: run.id, pollIntervalMs: 0 }, deps)
    assert.equal(outcome.ok, true)
    if (outcome.ok) {
      assert.equal(outcome.status, 'TIMED_OUT')
      assert.equal(outcome.envelope.executionStatus, 'TIMED_OUT')
    }
  })

  it('21. Builder review starts only after evidence', () => {
    const metadata = buildBuilderAutomationTaskFlowMetadata({
      repository: 'igor/servicemanager-ai-2.0',
      baseBranch: 'main',
      requiresRepositoryWrite: true,
      requiresCommitOrPullRequest: true,
      environment: 'dev',
      assignedEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
    })
    metadata.dispatchedAt = '2026-07-14T09:00:00.000Z'

    const snapshot = projectBuilderAutomationTaskFlowSnapshot({
      run: fixtureRun({
        status: 'running',
        result: {
          plannedOnly: false,
          output: {
            builderAutomationTaskFlow: metadata,
            cursorResultEnvelopeV110: createPendingAutomationEnvelope({
              toolExecutionRunId: 'terun-auto-001',
              backgroundComposerId: COMPOSER_ID,
            }),
            cursorAutomationRunner: {
              version: 'v1',
              repository: 'igor/servicemanager-ai-2.0',
              baseBranch: 'main',
              environment: 'dev',
              idempotencyKey: 'builder-automation:terun-auto-001:enqueue',
              dispatchPhase: 'RESULT_PENDING',
              ownerApprovedAt: metadata.ownerApprovedAt,
              dispatchedAt: metadata.dispatchedAt,
              reconciliationStartedAt: null,
              reconciliationLastCheckedAt: null,
              reconciliationPollCount: 0,
              resultMarkerPath: 'tmp/ai-company-results/terun-auto-001.json',
              branchPrefix: 'cursor/',
              attempts: [],
              timeoutAt: null,
              timeoutReason: null,
            },
          },
          deliveryMode: 'cursor_v1',
          cursorAutomationTaskId: null,
          registryInvokePlanId: null,
          receivedAt: null,
        },
      }),
    })

    assert.equal(snapshot.canBuilderReview, false)
    assert.notEqual(snapshot.uiState, 'awaiting_builder_review')
  })

  it('22. MAX review unavailable before Builder review', () => {
    const snapshot = projectBuilderAutomationTaskFlowSnapshot({
      run: fixtureRun({ delegationPlanId: null }),
    })
    assert.equal(snapshot.canMaxReview, false)
  })
})

describe('builderAutomationTaskFlow integration', () => {
  it('23. create + approve dispatch stores autonomous flow metadata', async () => {
    installStorageMock()

    const created = createBuilderAutomationOwnerTask(baseCreateInput())
    assert.equal(created.ok, true)
    if (!created.ok) return

    assert.equal(created.routeDecision.selectedRoute, 'CURSOR_AUTOMATION_WEBHOOK')
    assert.equal(created.snapshot.uiState, 'awaiting_owner_approval')

    const dispatched = await approveAndDispatchBuilderAutomation(created.run.id, {
      resolveWebhookConfig: () => ({
        url: WEBHOOK_URL,
        apiKey: WEBHOOK_KEY,
        configKeys: { url: 'u', apiKey: 'k' },
      }),
      fetchImpl: mockFetch(200, { success: true, backgroundComposerId: COMPOSER_ID }),
      logEvent: () => {},
    })
    assert.equal(dispatched.ok, true)
    if (dispatched.ok) {
      assert.ok(dispatched.backgroundComposerId)
      assert.match(dispatched.snapshot.uiState, /waiting|dispatch/)
    }
  })

  it('24. final report projects autonomous route without manual import', () => {
    const metadata = buildBuilderAutomationTaskFlowMetadata({
      repository: 'igor/servicemanager-ai-2.0',
      baseBranch: 'main',
      requiresRepositoryWrite: true,
      requiresCommitOrPullRequest: true,
      environment: 'dev',
      assignedEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
    })
    metadata.ownerApprovedAt = '2026-07-14T09:00:00.000Z'
    metadata.dispatchedAt = '2026-07-14T09:01:00.000Z'

    const snapshot = projectBuilderAutomationTaskFlowSnapshot({
      run: fixtureRun({
        status: 'running',
        result: {
          plannedOnly: false,
          output: {
            builderAutomationTaskFlow: metadata,
            executionRoute: 'CURSOR_AUTOMATION_WEBHOOK',
          },
          deliveryMode: 'cursor_v1',
          cursorAutomationTaskId: null,
          registryInvokePlanId: null,
          receivedAt: null,
        },
      }),
    })

    const report = buildBuilderAutomationFinalReport(snapshot)
    assert.equal(report.executionRoute, 'CURSOR_AUTOMATION_WEBHOOK')
    assert.match(report.nextRecommendedAction, /Wait|Builder/i)
  })
})
