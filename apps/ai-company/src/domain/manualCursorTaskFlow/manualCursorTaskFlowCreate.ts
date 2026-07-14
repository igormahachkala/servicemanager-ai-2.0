/**
 * Manual Cursor Task Flow — create Owner task (AI-COMPANY-112).
 */

import { DEFAULT_COMPANY_ID } from '../company/company'
import { DELEGATION_DECIDER_EMPLOYEE_ID } from '../delegationEngine'
import {
  approveDelegationPlan,
  createDelegationPlan,
  markDelegationPlanDelegated,
} from '../delegationPlan/delegationPlanStorage'
import { createEmployeeWorkItem } from '../employeeWorkQueue/employeeWorkQueueStorage'
import { EMPLOYEE_ROUTE_IDS } from '../../mission-control/data/employeeIdResolver'
import { requestBuilderCursorToolExecution } from '../toolExecution/toolExecutionRunBridge'
import { upsertToolExecutionRun } from '../toolExecution/toolExecutionRunStorage'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'
import {
  buildManualCursorTaskFlowMetadata,
  mergeRunOutput,
  patchManualCursorTaskFlowMetadata,
  readRouteDecisionFromRunOutput,
} from './manualCursorTaskFlowMetadata'
import { projectManualCursorTaskFlowSnapshot, toRouteDecisionView } from './manualCursorTaskFlowState'
import type {
  CreateManualCursorOwnerTaskInput,
  CreateManualCursorOwnerTaskOutcome,
} from './manualCursorTaskFlowTypes'
import { validateCreateManualCursorOwnerTaskInput } from './manualCursorTaskFlowValidation'

function attachCreateArtifacts(
  run: ToolExecutionRun,
  input: CreateManualCursorOwnerTaskInput,
  dispatchOutput: Record<string, unknown> | null,
): ToolExecutionRun {
  const now = new Date().toISOString()
  const metadata = buildManualCursorTaskFlowMetadata({
    repository: input.repository,
    baseBranch: input.baseBranch,
    requiresRepositoryWrite: input.requiresRepositoryWrite,
    requiresCommitOrPullRequest: input.requiresCommitOrPullRequest,
    requiresReliableCompletion: input.requiresReliableCompletion,
    environment: input.environment,
    assignedEmployeeId: input.assignedEmployeeId,
  }, now)

  const routeDecision = dispatchOutput && typeof dispatchOutput === 'object'
    ? (dispatchOutput.routeDecision as Record<string, unknown> | undefined)
    : undefined

  const outputPatch = patchManualCursorTaskFlowMetadata(metadata, {
    ...(dispatchOutput ?? {}),
    executionRoute: 'MANUAL_CLOUD_AGENT',
    routeDecision,
  })

  return upsertToolExecutionRun({
    ...run,
    result: mergeRunOutput(run, outputPatch, true),
    updatedAt: now,
  })
}

export function createManualCursorOwnerTask(
  rawInput: CreateManualCursorOwnerTaskInput,
): CreateManualCursorOwnerTaskOutcome {
  const validated = validateCreateManualCursorOwnerTaskInput(rawInput)
  if (!validated.ok) {
    const code = validated.message.includes('DEV-only') ? 'PRODUCTION_BLOCKED' : 'VALIDATION_FAILED'
    return { ok: false, code, message: validated.message }
  }

  const input = validated.input

  const delegationPlan = createDelegationPlan({
    companyId: DEFAULT_COMPANY_ID,
    originEmployeeId: DELEGATION_DECIDER_EMPLOYEE_ID,
    recommendedEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
    recommendedEmployeeCodename: 'Builder',
    recommendedEmployeeRole: 'Implementation Engineer',
    taskTitle: input.title,
    taskText: input.instruction,
    structuredPayload: {
      enginePlanId: 'manual-cursor-task-flow-v1',
      evaluationVersion: 'v1',
      category: 'general',
      taskId: null,
      reasonCode: 'general_max',
      reasonHeadline: 'Owner manual Cursor task',
      reasonSummary: 'Owner created a DEV-only manual Cloud Agent task for Builder.',
      matchedTaskSignals: ['manual_cursor_task_flow'],
      conversationHints: [],
      workingMemoryHints: [],
      technicalRationale: ['MANUAL_CLOUD_AGENT happy path V1'],
    },
    confidence: 0.9,
    ownerExplanation: 'Owner поставил задачу Builder для ручного запуска в Cursor Cloud Agent.',
    rationale: ['DEV-only manual Cursor flow', 'Requires Owner approval before execution'],
    alternatives: [],
    matchedSignals: ['manual_cursor_task_flow'],
    risk: 'low',
    requiresOwnerApproval: false,
  })

  const approvedPlan = approveDelegationPlan(delegationPlan.id)
  if (!approvedPlan) {
    return { ok: false, code: 'DISPATCH_FAILED', message: 'Could not approve delegation plan.' }
  }

  const workItem = createEmployeeWorkItem({
    employeeId: EMPLOYEE_ROUTE_IDS.builder,
    title: input.title,
    summary: input.expectedResult,
    taskText: input.instruction,
    priority: 'high',
    source: 'delegation',
    delegationPlanId: approvedPlan.id,
    structuredPayload: {
      version: 'v1',
      mode: 'complex',
      objective: input.title,
      expectedResult: input.expectedResult,
      constraints: `Repository: ${input.repository}; Base: ${input.baseBranch}; DEV-only manual Cursor flow`,
      needsReport: true,
    },
  })

  const delegatedPlan = markDelegationPlanDelegated(approvedPlan.id, workItem.id)
  if (!delegatedPlan) {
    return { ok: false, code: 'DISPATCH_FAILED', message: 'Could not mark delegation plan delegated.' }
  }

  const instructions = [
    input.instruction,
    '',
    `Repository: ${input.repository}`,
    `Base branch: ${input.baseBranch}`,
    `Expected result: ${input.expectedResult}`,
    `File scope: ${input.fileScope?.join(', ') ?? 'tmp/first-real-ai-company-task.txt'}`,
    `Checks: ${input.checks?.join(' · ') ?? 'npm test/build'}`,
  ].join('\n')

  const { run, dispatch } = requestBuilderCursorToolExecution({
    workItemId: workItem.id,
    title: input.title,
    instructions,
    delegationPlanId: delegatedPlan.id,
    expectedResult: input.expectedResult,
    fileScope: input.fileScope,
    checks: input.checks,
    action: 'handoff',
    payload: {
      environment: input.environment,
      repository: input.repository,
      baseBranch: input.baseBranch,
      requiresRepositoryWrite: input.requiresRepositoryWrite,
      requiresCommitOrPullRequest: input.requiresCommitOrPullRequest,
      requiresReliableCompletion: input.requiresReliableCompletion,
      localBridgeAvailable: false,
      manualOperatorAvailable: true,
      ownerApprovalGranted: false,
      manualOnly: true,
      manualCursorTaskFlow: true,
    },
  })

  const dispatchOutput =
    dispatch.result.output && typeof dispatch.result.output === 'object'
      ? (dispatch.result.output as Record<string, unknown>)
      : null

  const persisted = attachCreateArtifacts(run, input, dispatchOutput)
  const routeDecision = readRouteDecisionFromRunOutput(persisted)

  if (routeDecision?.selectedRoute !== 'MANUAL_CLOUD_AGENT') {
    return {
      ok: false,
      code: 'ROUTE_NOT_MANUAL',
      message: `Expected MANUAL_CLOUD_AGENT route, got ${routeDecision?.selectedRoute ?? 'unknown'}.`,
    }
  }

  const snapshot = projectManualCursorTaskFlowSnapshot({ run: persisted, routeDecision })

  return {
    ok: true,
    run: persisted,
    workItemId: workItem.id,
    delegationPlanId: delegatedPlan.id,
    routeDecision: toRouteDecisionView(routeDecision)!,
    snapshot,
  }
}
