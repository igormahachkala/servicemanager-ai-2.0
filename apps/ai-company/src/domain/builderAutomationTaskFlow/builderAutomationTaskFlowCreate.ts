/**
 * Builder Automation Task Flow — create Owner task (AI-COMPANY-113).
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
import { assignToolExecutionRunExecutionRoute } from '../manualCloudAgentImport/toolExecutionRunExecutionRoute'
import { requestBuilderCursorToolExecution } from '../toolExecution/toolExecutionRunBridge'
import { upsertToolExecutionRun } from '../toolExecution/toolExecutionRunStorage'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'
import {
  buildBuilderAutomationTaskFlowMetadata,
  mergeRunOutput,
  patchBuilderAutomationTaskFlowMetadata,
  readRouteDecisionFromRunOutput,
} from './builderAutomationTaskFlowMetadata'
import { projectBuilderAutomationTaskFlowSnapshot, toRouteDecisionView } from './builderAutomationTaskFlowState'
import type {
  CreateBuilderAutomationOwnerTaskInput,
  CreateBuilderAutomationOwnerTaskOutcome,
} from './builderAutomationTaskFlowTypes'
import { validateCreateBuilderAutomationOwnerTaskInput } from './builderAutomationTaskFlowValidation'

function attachCreateArtifacts(
  run: ToolExecutionRun,
  input: CreateBuilderAutomationOwnerTaskInput,
  dispatchOutput: Record<string, unknown> | null,
): ToolExecutionRun {
  const now = new Date().toISOString()
  const metadata = buildBuilderAutomationTaskFlowMetadata({
    repository: input.repository,
    baseBranch: input.baseBranch,
    requiresRepositoryWrite: input.requiresRepositoryWrite ?? true,
    requiresCommitOrPullRequest: input.requiresCommitOrPullRequest ?? true,
    environment: 'dev',
    assignedEmployeeId: input.assignedEmployeeId ?? EMPLOYEE_ROUTE_IDS.builder,
  }, now)

  const routeDecision =
    dispatchOutput && typeof dispatchOutput === 'object'
      ? (dispatchOutput.routeDecision as Record<string, unknown> | undefined)
      : undefined

  const outputPatch = patchBuilderAutomationTaskFlowMetadata(metadata, {
    ...(dispatchOutput ?? {}),
    executionRoute: 'CURSOR_AUTOMATION_WEBHOOK',
    routeDecision,
  })

  return upsertToolExecutionRun({
    ...run,
    result: mergeRunOutput(run, outputPatch, true),
    updatedAt: now,
  })
}

export function createBuilderAutomationOwnerTask(
  rawInput: CreateBuilderAutomationOwnerTaskInput,
): CreateBuilderAutomationOwnerTaskOutcome {
  const validated = validateCreateBuilderAutomationOwnerTaskInput(rawInput)
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
      enginePlanId: 'builder-automation-task-flow-v1',
      evaluationVersion: 'v1',
      category: 'general',
      taskId: null,
      reasonCode: 'general_max',
      reasonHeadline: 'Owner autonomous Builder Cursor Automation task',
      reasonSummary: 'Owner created a DEV-only autonomous Builder task via Cursor Automation Webhook.',
      matchedTaskSignals: ['builder_automation_task_flow'],
      conversationHints: [],
      workingMemoryHints: [],
      technicalRationale: ['CURSOR_AUTOMATION_WEBHOOK autonomous path V1'],
    },
    confidence: 0.9,
    ownerExplanation:
      'Owner поставил задачу Builder для автономного запуска через Cursor Automations Webhook.',
    rationale: ['DEV-only autonomous Builder flow', 'Requires Owner approval before dispatch'],
    alternatives: [],
    matchedSignals: ['builder_automation_task_flow'],
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
      constraints: `Repository: ${input.repository}; Base: ${input.baseBranch}; DEV-only autonomous Builder flow`,
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
    `File scope: ${input.fileScope?.join(', ') ?? 'tmp/autonomous-builder-test.txt'}`,
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
      requiresReliableCompletion: false,
      requiresAutomaticExecution: true,
      eventDriven: true,
      localBridgeAvailable: false,
      manualOperatorAvailable: false,
      automationWebhookAvailable: true,
      ownerApprovalGranted: false,
      builderAutomationTaskFlow: true,
      constraints: input.constraints,
    },
  })

  const dispatchOutput =
    dispatch.result.output && typeof dispatch.result.output === 'object'
      ? (dispatch.result.output as Record<string, unknown>)
      : null

  const persisted = attachCreateArtifacts(run, input, dispatchOutput)
  const routeDecision = readRouteDecisionFromRunOutput(persisted)

  if (routeDecision?.selectedRoute !== 'CURSOR_AUTOMATION_WEBHOOK') {
    return {
      ok: false,
      code: 'ROUTE_NOT_WEBHOOK',
      message: `Expected CURSOR_AUTOMATION_WEBHOOK route, got ${routeDecision?.selectedRoute ?? 'unknown'}.`,
    }
  }

  const routed = assignToolExecutionRunExecutionRoute(persisted.id, 'CURSOR_AUTOMATION_WEBHOOK') ?? persisted
  const snapshot = projectBuilderAutomationTaskFlowSnapshot({ run: routed, routeDecision })

  return {
    ok: true,
    run: routed,
    workItemId: workItem.id,
    delegationPlanId: delegatedPlan.id,
    routeDecision: toRouteDecisionView(routeDecision)!,
    snapshot,
  }
}
