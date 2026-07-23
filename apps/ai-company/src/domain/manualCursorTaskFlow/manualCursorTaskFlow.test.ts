/**
 * Manual Cursor Task Flow — unit tests (AI-COMPANY-112).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { EMPLOYEE_ROUTE_IDS } from '../../mission-control/data/employeeIdResolver.ts'
import type { ExecutionRouteDecision } from '../cursorExecutionRoute/cursorExecutionRouteTypes.ts'
import { evaluateCursorExecutionDispatch } from '../cursorExecutionRoute/cursorExecutionRoutePreflight.ts'
import { buildCursorRoutePolicyInputFromDispatch } from '../cursorExecutionRoute/routePolicyFromDispatchInput.ts'
import type { DispatchToolRequestInput } from '../toolDispatcher/toolDispatcherTypes.ts'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes.ts'
import { approveManualCursorOwnerExecution } from './manualCursorTaskFlowApproval.ts'
import { createManualCursorOwnerTask } from './manualCursorTaskFlowCreate.ts'
import { buildManualCursorFinalReport } from './manualCursorTaskFinalReport.ts'
import { buildManualCursorTaskFlowMetadata } from './manualCursorTaskFlowMetadata.ts'
import {
  cursorTaskPackageContainsSecrets,
  generateCursorTaskPackageText,
} from './manualCursorTaskPackage.ts'
import { projectManualCursorTaskFlowSnapshot } from './manualCursorTaskFlowState.ts'
import {
  isProductionEnvironmentBlocked,
  validateCreateManualCursorOwnerTaskInput,
} from './manualCursorTaskFlowValidation.ts'
import { validateManualCloudAgentImportInput } from '../manualCloudAgentImport/manualCloudAgentImportValidation.ts'
import type { EmployeeToolReviewEvaluation } from '../employeeToolReview/employeeToolReviewTypes.ts'
import type { CreateManualCursorOwnerTaskInput } from './manualCursorTaskFlowTypes.ts'

const baseEvaluation: EmployeeToolReviewEvaluation = {
  fileScopeOk: true,
  outOfScopeFiles: [],
  checksOutcome: 'passed',
  checksPassed: true,
  checkAssessments: [],
  expectedResultAligned: true,
  hasErrors: false,
  hasUnfinished: false,
  notes: [],
}

const legacyEnvelope = {
  version: 'v1' as const,
  toolExecutionRunId: 'terun-flow-001',
  workItemId: 'wi-flow-001',
  employeeId: EMPLOYEE_ROUTE_IDS.builder,
  status: 'completed' as const,
  summary: 'Done',
  changedFiles: ['tmp/first-real-ai-company-task.txt'],
  checks: [],
  commit: null,
  pullRequest: null,
  warnings: [],
  errors: [],
  assumptions: [],
  unfinishedItems: [],
  completedAt: '2026-07-14T10:00:00.000Z',
}

const nodeRouteConfig = {
  environment: 'dev' as const,
  automationWebhookAvailable: false,
  localBridgeAvailable: false,
  manualOperatorAvailable: true,
  expectedCostClassificationByRoute: undefined,
}

function baseCreateInput(
  overrides: Partial<CreateManualCursorOwnerTaskInput> = {},
): CreateManualCursorOwnerTaskInput {
  return {
    title: 'First real AI Company task',
    instruction: 'Create file tmp/first-real-ai-company-task.txt with greeting text.',
    expectedResult: 'File exists with expected content.',
    repository: 'igor/servicemanager-ai-2.0',
    baseBranch: 'main',
    requiresRepositoryWrite: true,
    requiresCommitOrPullRequest: true,
    requiresReliableCompletion: true,
    environment: 'dev',
    assignedEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
    fileScope: ['tmp/first-real-ai-company-task.txt'],
    checks: ['npm --prefix apps/ai-company run test:domain', 'npm --prefix apps/ai-company run build'],
    ...overrides,
  }
}

function fixtureRun(overrides: Partial<ToolExecutionRun> = {}): ToolExecutionRun {
  const metadata = buildManualCursorTaskFlowMetadata({
    repository: 'igor/servicemanager-ai-2.0',
    baseBranch: 'main',
    requiresRepositoryWrite: true,
    requiresCommitOrPullRequest: true,
    requiresReliableCompletion: true,
    environment: 'dev',
    assignedEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
  })

  return {
    id: 'terun-flow-001',
    version: 'v1',
    companyId: 'company-default',
    employeeId: EMPLOYEE_ROUTE_IDS.builder,
    toolId: 'cursor',
    toolRequestId: 'td-req-flow-001',
    workItemId: 'wi-flow-001',
    delegationPlanId: 'dplan-flow-001',
    workerLoopId: null,
    builderToolDecisionId: null,
    legacyBuilderRunId: null,
    title: 'First real AI Company task',
    instructions: 'Create tmp/first-real-ai-company-task.txt',
    expectedResult: 'File exists',
    fileScope: ['tmp/first-real-ai-company-task.txt'],
    checks: ['npm --prefix apps/ai-company run build'],
    status: 'awaiting_owner',
    createdAt: '2026-07-14T08:00:00.000Z',
    updatedAt: '2026-07-14T08:00:00.000Z',
    approvedAt: null,
    startedAt: null,
    completedAt: null,
    failedAt: null,
    result: {
      plannedOnly: true,
      output: {
        executionRoute: 'MANUAL_CLOUD_AGENT',
        manualCursorTaskFlow: metadata,
        routeDecision: {
          selectedRoute: 'MANUAL_CLOUD_AGENT',
          allowed: false,
          requiresOwnerApproval: true,
          costClassification: 'INCLUDED_IN_SUBSCRIPTION',
          reasonCode: 'OWNER_APPROVAL_REQUIRED',
          explanation: 'Manual Cloud Agent requires Owner approval.',
          alternatives: [],
        },
      },
      deliveryMode: 'planned_v1',
      cursorAutomationTaskId: null,
      registryInvokePlanId: null,
      receivedAt: null,
    },
    error: null,
    history: [],
    ...overrides,
  }
}

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
    location: { origin: 'http://localhost:5173' },
  } as Window
  ;(globalThis as { localStorage?: Storage }).localStorage = storage as Storage
}

describe('manualCursorTaskFlow', () => {
  it('1. create task policy selects MANUAL_CLOUD_AGENT', () => {
    const dispatchInput: DispatchToolRequestInput = {
      toolId: 'cursor',
      action: 'code_change',
      title: 'Task',
      instructions: 'Do work',
      requestedByEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
      decidedByEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
      payload: {
        localBridgeAvailable: false,
        manualOperatorAvailable: true,
        requiresCommitOrPullRequest: true,
        ownerApprovalGranted: false,
        environment: 'dev',
      },
      context: { companyId: 'company-default', source: 'manual' },
    }

    const policyInput = buildCursorRoutePolicyInputFromDispatch(dispatchInput, nodeRouteConfig)
    const decision = evaluateCursorExecutionDispatch(policyInput).routeDecision

    assert.equal(decision.selectedRoute, 'MANUAL_CLOUD_AGENT')
    assert.equal(decision.requiresOwnerApproval, true)
  })

  it('2. approval required before task package', () => {
    const snapshot = projectManualCursorTaskFlowSnapshot({ run: fixtureRun() })
    assert.equal(snapshot.uiState, 'awaiting_owner_approval')
    assert.equal(snapshot.taskPackage, null)
    assert.equal(snapshot.canApprove, true)
  })

  it('3. no approval → package unavailable', () => {
    const snapshot = projectManualCursorTaskFlowSnapshot({
      run: fixtureRun({ status: 'awaiting_owner' }),
    })
    assert.equal(snapshot.taskPackage, null)
  })

  it('4. approval → package generated', () => {
    const metadata = buildManualCursorTaskFlowMetadata({
      repository: 'igor/servicemanager-ai-2.0',
      baseBranch: 'main',
      requiresRepositoryWrite: true,
      requiresCommitOrPullRequest: true,
      requiresReliableCompletion: true,
      environment: 'dev',
      assignedEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
    })
    metadata.ownerApprovedAt = '2026-07-14T09:00:00.000Z'
    metadata.taskPackageGeneratedAt = metadata.ownerApprovedAt

    const run = fixtureRun({
      status: 'approved',
      approvedAt: metadata.ownerApprovedAt,
      result: {
        plannedOnly: true,
        output: {
          executionRoute: 'MANUAL_CLOUD_AGENT',
          manualCursorTaskFlow: metadata,
        },
        deliveryMode: 'planned_v1',
        cursorAutomationTaskId: null,
        registryInvokePlanId: null,
        receivedAt: null,
      },
    })

    const snapshot = projectManualCursorTaskFlowSnapshot({ run })
    assert.ok(snapshot.taskPackage)
    assert.match(snapshot.taskPackage!, /AI COMPANY TASK/)
  })

  it('5. package contains task ID/repo/branch/instructions/checks', () => {
    const metadata = buildManualCursorTaskFlowMetadata({
      repository: 'igor/servicemanager-ai-2.0',
      baseBranch: 'main',
      requiresRepositoryWrite: true,
      requiresCommitOrPullRequest: true,
      requiresReliableCompletion: true,
      environment: 'dev',
      assignedEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
    })
    metadata.ownerApprovedAt = '2026-07-14T09:00:00.000Z'

    const run = fixtureRun({ status: 'approved' })
    const text = generateCursorTaskPackageText(run, metadata)

    assert.match(text, /terun-flow-001/)
    assert.match(text, /igor\/servicemanager-ai-2.0/)
    assert.match(text, /main/)
    assert.match(text, /tmp\/first-real-ai-company-task.txt/)
    assert.match(text, /npm --prefix apps\/ai-company run build/)
  })

  it('6. package contains no secrets', () => {
    const metadata = buildManualCursorTaskFlowMetadata({
      repository: 'igor/servicemanager-ai-2.0',
      baseBranch: 'main',
      requiresRepositoryWrite: true,
      requiresCommitOrPullRequest: true,
      requiresReliableCompletion: true,
      environment: 'dev',
      assignedEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
    })
    const text = generateCursorTaskPackageText(fixtureRun(), metadata)
    assert.equal(cursorTaskPackageContainsSecrets(text), false)
  })

  it('7. valid import projects awaiting Builder Review state', () => {
    const run = fixtureRun({
      status: 'awaiting_employee_review',
      result: {
        plannedOnly: false,
        output: {
          cursorResultEnvelopeV110: {
            toolExecutionRunId: 'terun-flow-001',
            route: 'MANUAL_CLOUD_AGENT',
            transportStatus: 'DISPATCHED',
            executionStatus: 'SUCCEEDED',
            reviewStatus: 'PENDING',
            summary: 'Done',
            changedFiles: ['tmp/first-real-ai-company-task.txt'],
            checks: [],
            artifacts: [],
            errors: [],
            startedAt: '2026-07-14T09:00:00.000Z',
            finishedAt: '2026-07-14T10:00:00.000Z',
          },
        },
        deliveryMode: 'cursor_v1',
        cursorAutomationTaskId: null,
        registryInvokePlanId: null,
        receivedAt: '2026-07-14T10:00:00.000Z',
      },
    })

    const snapshot = projectManualCursorTaskFlowSnapshot({
      run,
      builderReview: {
        id: 'etr-001',
        version: 'v1',
        companyId: 'company-default',
        employeeId: EMPLOYEE_ROUTE_IDS.builder,
        reviewerEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
        toolExecutionRunId: run.id,
        workItemId: run.workItemId,
        delegationPlanId: run.delegationPlanId,
        envelope: legacyEnvelope,
        evaluation: baseEvaluation,
        status: 'awaiting_employee_review',
        reworkReason: null,
        reworkEnvelopeId: null,
        delegationReviewId: null,
        reportId: null,
        createdAt: '2026-07-14T10:00:00.000Z',
        updatedAt: '2026-07-14T10:00:00.000Z',
        history: [],
      },
    })

    assert.equal(snapshot.uiState, 'awaiting_builder_review')
    assert.equal(snapshot.envelope?.reviewStatus, 'PENDING')
  })

  it('8. invalid commit SHA displayed via import validation', () => {
    const validated = validateManualCloudAgentImportInput({
      toolExecutionRunId: 'terun-flow-001',
      branch: null,
      commitSha: 'not-a-sha',
      pullRequestUrl: null,
      summary: 'Done',
      changedFiles: [],
      checks: [],
      artifacts: [],
      errors: [],
      startedAt: null,
      finishedAt: '2026-07-14T10:00:00.000Z',
      finalStatus: 'SUCCEEDED',
    })
    assert.equal(validated.ok, false)
    if (validated.ok) return
    assert.equal(validated.reasonCode, 'INVALID_COMMIT_SHA')
  })

  it('9. duplicate import reason code exists in import contract', () => {
    const validated = validateManualCloudAgentImportInput({
      toolExecutionRunId: 'terun-flow-001',
      branch: 'cursor/test',
      commitSha: 'abc1234567890',
      pullRequestUrl: 'https://github.com/org/repo/pull/1',
      summary: 'Done',
      changedFiles: ['a.ts'],
      checks: [],
      artifacts: [],
      errors: [],
      startedAt: null,
      finishedAt: '2026-07-14T10:00:00.000Z',
      finalStatus: 'SUCCEEDED',
    })
    assert.equal(validated.ok, true)
  })

  it('10. failed result → failed state without fake review success', () => {
    const snapshot = projectManualCursorTaskFlowSnapshot({
      run: fixtureRun({ status: 'failed', error: 'Build failed' }),
    })
    assert.equal(snapshot.uiState, 'failed')
    assert.equal(snapshot.canBuilderReview, false)
    assert.equal(snapshot.canMaxReview, false)
  })

  it('11. Builder rejected → execution can succeed in report warning', () => {
    const run = fixtureRun({
      status: 'awaiting_employee_review',
      result: {
        plannedOnly: false,
        output: {
          cursorResultEnvelopeV110: {
            toolExecutionRunId: 'terun-flow-001',
            route: 'MANUAL_CLOUD_AGENT',
            transportStatus: 'DISPATCHED',
            executionStatus: 'SUCCEEDED',
            reviewStatus: 'PENDING',
            summary: 'Done',
            changedFiles: [],
            checks: [],
            artifacts: [],
            errors: [],
            startedAt: '2026-07-14T09:00:00.000Z',
            finishedAt: '2026-07-14T10:00:00.000Z',
          },
        },
        deliveryMode: 'cursor_v1',
        cursorAutomationTaskId: null,
        registryInvokePlanId: null,
        receivedAt: '2026-07-14T10:00:00.000Z',
      },
    })

    const snapshot = projectManualCursorTaskFlowSnapshot({
      run,
      builderReview: {
        id: 'etr-001',
        version: 'v1',
        companyId: 'company-default',
        employeeId: EMPLOYEE_ROUTE_IDS.builder,
        reviewerEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
        toolExecutionRunId: run.id,
        workItemId: run.workItemId,
        delegationPlanId: run.delegationPlanId,
        envelope: legacyEnvelope,
        evaluation: { ...baseEvaluation, checksOutcome: 'failed', checksPassed: false },
        status: 'rejected',
        reworkReason: null,
        reworkEnvelopeId: null,
        delegationReviewId: null,
        reportId: null,
        createdAt: '2026-07-14T10:00:00.000Z',
        updatedAt: '2026-07-14T10:00:00.000Z',
        history: [],
      },
    })

    const report = buildManualCursorFinalReport(snapshot)
    assert.equal(report.executionStatus, 'SUCCEEDED')
    assert.equal(report.builderReviewDecision, 'rejected')
    assert.ok(report.warnings.some((item) => item.includes('not a business success')))
  })

  it('12. MAX review unavailable before Builder handoff', () => {
    const run = fixtureRun({ status: 'awaiting_employee_review' })
    const snapshot = projectManualCursorTaskFlowSnapshot({
      run,
      builderReview: {
        id: 'etr-001',
        version: 'v1',
        companyId: 'company-default',
        employeeId: EMPLOYEE_ROUTE_IDS.builder,
        reviewerEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
        toolExecutionRunId: run.id,
        workItemId: run.workItemId,
        delegationPlanId: run.delegationPlanId,
        envelope: legacyEnvelope,
        evaluation: baseEvaluation,
        status: 'awaiting_employee_review',
        reworkReason: null,
        reworkEnvelopeId: null,
        delegationReviewId: null,
        reportId: null,
        createdAt: '2026-07-14T10:00:00.000Z',
        updatedAt: '2026-07-14T10:00:00.000Z',
        history: [],
      },
    })

    assert.equal(snapshot.canMaxReview, false)
  })

  it('13. final report not completed until MAX accepts', () => {
    const run = fixtureRun({ status: 'accepted' })
    const snapshot = projectManualCursorTaskFlowSnapshot({
      run,
      builderReview: {
        id: 'etr-001',
        version: 'v1',
        companyId: 'company-default',
        employeeId: EMPLOYEE_ROUTE_IDS.builder,
        reviewerEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
        toolExecutionRunId: run.id,
        workItemId: run.workItemId,
        delegationPlanId: run.delegationPlanId,
        envelope: legacyEnvelope,
        evaluation: baseEvaluation,
        status: 'sent_to_max',
        reworkReason: null,
        reworkEnvelopeId: null,
        delegationReviewId: 'drev-001',
        reportId: 'rep-001',
        createdAt: '2026-07-14T10:00:00.000Z',
        updatedAt: '2026-07-14T10:00:00.000Z',
        history: [],
      },
      maxReview: {
        id: 'drev-001',
        version: 'v1',
        companyId: 'company-default',
        status: 'awaiting_review',
        delegationPlanId: run.delegationPlanId!,
        builderEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
        reviewerEmployeeId: 'ag-max',
        builderWorkItemId: run.workItemId,
        reworkWorkItemId: null,
        parentReviewId: null,
        reportId: 'rep-001',
        taskTitle: run.title,
        taskText: run.instructions,
        reworkNotes: null,
        createdAt: '2026-07-14T10:00:00.000Z',
        updatedAt: '2026-07-14T10:00:00.000Z',
        completedAt: null,
        acceptedAt: null,
        reworkRequestedAt: null,
        history: [],
      },
    })

    const report = buildManualCursorFinalReport(snapshot)
    assert.equal(report.completed, false)
    assert.equal(report.maxReviewDecision, 'pending')
  })

  it('14. DEV only environment accepted', () => {
    const validated = validateCreateManualCursorOwnerTaskInput(baseCreateInput())
    assert.equal(validated.ok, true)
  })

  it('15. production request blocked', () => {
    assert.equal(isProductionEnvironmentBlocked('production'), true)
    assert.equal(isProductionEnvironmentBlocked('stage'), true)

    const blocked = validateCreateManualCursorOwnerTaskInput({
      ...baseCreateInput(),
      environment: 'production' as 'dev',
    })
    assert.equal(blocked.ok, false)
  })

  it('16. cost guard decision visible in route view', () => {
    const decision: ExecutionRouteDecision = {
      selectedRoute: 'MANUAL_CLOUD_AGENT',
      allowed: false,
      requiresOwnerApproval: true,
      costClassification: 'INCLUDED_IN_SUBSCRIPTION',
      reasonCode: 'OWNER_APPROVAL_REQUIRED',
      explanation: 'Owner must approve manual Cloud Agent.',
      alternatives: [],
    }
    const snapshot = projectManualCursorTaskFlowSnapshot({
      run: fixtureRun(),
      routeDecision: decision,
    })
    assert.equal(snapshot.routeDecision?.costClassification, 'INCLUDED_IN_SUBSCRIPTION')
  })

  it('17. route reason visible', () => {
    const snapshot = projectManualCursorTaskFlowSnapshot({ run: fixtureRun() })
    assert.equal(snapshot.routeDecision?.reasonCode, 'OWNER_APPROVAL_REQUIRED')
    assert.match(snapshot.routeDecision?.explanation ?? '', /Owner/)
  })
})

describe('manualCursorTaskFlow storage integration', () => {
  it('18. create + approve end-to-end in mocked storage', () => {
    installStorageMock()

    const created = createManualCursorOwnerTask(baseCreateInput())
    assert.equal(created.ok, true)
    if (!created.ok) return

    assert.equal(created.routeDecision.selectedRoute, 'MANUAL_CLOUD_AGENT')
    assert.equal(created.run.status, 'awaiting_owner')

    const approved = approveManualCursorOwnerExecution(created.run.id)
    assert.equal(approved.ok, true)
    if (!approved.ok) return

    assert.match(approved.taskPackage, /AI COMPANY TASK/)
    assert.equal(approved.snapshot.uiState, 'waiting_for_cursor_result')
  })
})
