/**
 * Builder → Tool Dispatcher bridge (AI-COMPANY-113B / 113D).
 * Registers request only — creates canonical ToolExecutionRun, no Cursor launch.
 */

import { DEFAULT_COMPANY_ID } from '../company/company'
import { BUILDER_EMPLOYEE_ID } from '../mobileEmployee/mobileEmployeeRegistry'
import { dispatchToolRequestPlannedOnly } from '../toolDispatcher/toolDispatcherDispatch'
import type { ToolRequest } from '../toolDispatcher/toolDispatcherTypes'
import { createToolExecutionFromDispatcherRequest } from '../toolExecution/toolExecutionRunBridge'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'
import type { BuilderToolDecision } from './builderToolDecisionTypes'
import { upsertBuilderToolDecision } from './builderToolDecisionStorage'

export type SubmitBuilderCursorToolRequestInput = {
  decision: BuilderToolDecision
  taskTitle: string
  projectId: string | null
  workspaceId: string | null
  workerLoopId: string
}

export type SubmitBuilderCursorToolRequestOutcome = {
  decision: BuilderToolDecision
  toolRequest: ToolRequest
  executionRun: ToolExecutionRun
}

/**
 * Builder requests Cursor via Tool Dispatcher.
 * Creates canonical ToolExecutionRun (awaiting_owner) — Cursor is NOT launched.
 */
export function submitBuilderCursorToolRequest(
  input: SubmitBuilderCursorToolRequestInput,
): SubmitBuilderCursorToolRequestOutcome {
  if (input.decision.employeeId !== BUILDER_EMPLOYEE_ID) {
    throw new Error('Only Builder may submit Cursor tool requests (113B).')
  }
  if (!input.decision.toolRequired || input.decision.recommendedToolId !== 'cursor') {
    throw new Error('Builder tool decision does not require Cursor.')
  }

  const savedDecision = upsertBuilderToolDecision(input.decision)
  const instructions = [
    savedDecision.reason,
    '',
    `Expected result: ${savedDecision.expectedResult}`,
    savedDecision.fileScope.length > 0
      ? `File scope: ${savedDecision.fileScope.join(', ')}`
      : 'File scope: to be confirmed with Owner',
    `Checks: ${savedDecision.checks.join(' · ')}`,
  ].join('\n')

  const dispatch = dispatchToolRequestPlannedOnly({
    toolId: 'cursor',
    action: 'code_change',
    title: input.taskTitle.trim() || 'Builder — Cursor code change',
    instructions,
    requestedByEmployeeId: BUILDER_EMPLOYEE_ID,
    decidedByEmployeeId: BUILDER_EMPLOYEE_ID,
    payload: {
      builderToolDecisionId: savedDecision.id,
      workItemId: savedDecision.workItemId,
      workerLoopId: input.workerLoopId,
      fileScope: savedDecision.fileScope,
      expectedResult: savedDecision.expectedResult,
      checks: savedDecision.checks,
      risk: savedDecision.risk,
      confidence: savedDecision.confidence,
      awaitingOwner: true,
    },
    context: {
      companyId: DEFAULT_COMPANY_ID,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      runtimeRunId: null,
      maxWorkerLoopId: input.workerLoopId,
      chatId: null,
      source: 'runtime',
    },
  })

  const executionRun = createToolExecutionFromDispatcherRequest({
    request: dispatch.request,
    employeeId: BUILDER_EMPLOYEE_ID,
    workItemId: savedDecision.workItemId,
    companyId: DEFAULT_COMPANY_ID,
    delegationPlanId: savedDecision.decisionPlanId,
    workerLoopId: input.workerLoopId,
    builderToolDecisionId: savedDecision.id,
    expectedResult: savedDecision.expectedResult,
    fileScope: savedDecision.fileScope,
    checks: savedDecision.checks,
  })

  return { decision: savedDecision, toolRequest: dispatch.request, executionRun }
}
