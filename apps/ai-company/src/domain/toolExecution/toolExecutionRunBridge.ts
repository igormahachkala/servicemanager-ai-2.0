/**
 * Tool Execution Run — Tool Dispatcher bridge (AI-COMPANY-113A).
 * Links Employee → Tool Dispatcher request → ToolExecutionRun.
 * No Cursor launch, no shell, no fake progress.
 */

import { DEFAULT_COMPANY_ID } from '../company/company'
import { DELEGATION_DECIDER_EMPLOYEE_ID } from '../delegationEngine'
import { getEmployeeWorkItemById } from '../employeeWorkQueue'
import { EMPLOYEE_ROUTE_IDS, resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import {
  dispatchToolRequest,
  dispatchToolRequestPlannedOnly,
  type DispatchToolRequestInput,
  type DispatchToolRequestOutcome,
  type ToolRequest as ToolDispatcherRequest,
} from '../toolDispatcher'
import { createToolExecutionRun } from './toolExecutionRunStorage'
import type { ToolExecutionRun } from './toolExecutionRunTypes'

export type CreateToolExecutionFromDispatcherRequestInput = {
  request: ToolDispatcherRequest
  employeeId: string
  workItemId: string
  companyId?: string
  delegationPlanId?: string | null
  workerLoopId?: string | null
  builderToolDecisionId?: string | null
  expectedResult?: string | null
  fileScope?: string[]
  checks?: string[]
}

export type BuilderCursorToolExecutionInput = {
  workItemId: string
  title: string
  instructions: string
  delegationPlanId?: string | null
  workerLoopId?: string | null
  builderToolDecisionId?: string | null
  expectedResult?: string | null
  fileScope?: string[]
  checks?: string[]
  companyId?: string
  decidedByEmployeeId?: string
  action?: string
  payload?: Record<string, unknown>
}

export type BuilderCursorToolExecutionOutcome = {
  run: ToolExecutionRun
  dispatch: DispatchToolRequestOutcome
}

function assertWorkItemBinding(input: {
  workItemId: string
  employeeId: string
  companyId: string
  delegationPlanId?: string | null
}): void {
  const workItem = getEmployeeWorkItemById(input.workItemId)
  if (!workItem) {
    throw new Error(`Work item ${input.workItemId} was not found.`)
  }
  if (workItem.employeeId !== input.employeeId) {
    throw new Error('Work item belongs to a different employee.')
  }
  if (workItem.companyId !== input.companyId) {
    throw new Error('Work item companyId mismatch.')
  }
  if (input.delegationPlanId && workItem.delegationPlanId !== input.delegationPlanId) {
    throw new Error('Work item delegationPlanId mismatch.')
  }
}

export function createToolExecutionFromDispatcherRequest(
  input: CreateToolExecutionFromDispatcherRequestInput,
): ToolExecutionRun {
  const companyId = input.companyId ?? DEFAULT_COMPANY_ID
  const employeeId = resolveCanonicalEmployeeId(input.employeeId)

  assertWorkItemBinding({
    workItemId: input.workItemId,
    employeeId,
    companyId,
    delegationPlanId: input.delegationPlanId,
  })

  return createToolExecutionRun({
    companyId,
    employeeId,
    toolId: input.request.toolId,
    toolRequestId: input.request.requestId,
    workItemId: input.workItemId,
    delegationPlanId: input.delegationPlanId ?? null,
    workerLoopId: input.workerLoopId ?? null,
    builderToolDecisionId: input.builderToolDecisionId ?? null,
    title: input.request.title,
    instructions: input.request.instructions,
    expectedResult: input.expectedResult,
    fileScope: input.fileScope,
    checks: input.checks,
    initialStatus: 'awaiting_owner',
  })
}

export function requestBuilderCursorToolExecution(
  input: BuilderCursorToolExecutionInput,
): BuilderCursorToolExecutionOutcome {
  const companyId = input.companyId ?? DEFAULT_COMPANY_ID
  const employeeId = resolveCanonicalEmployeeId(EMPLOYEE_ROUTE_IDS.builder)
  const decidedBy = resolveCanonicalEmployeeId(
    input.decidedByEmployeeId ?? DELEGATION_DECIDER_EMPLOYEE_ID,
  )

  assertWorkItemBinding({
    workItemId: input.workItemId,
    employeeId,
    companyId,
    delegationPlanId: input.delegationPlanId,
  })

  const dispatchInput: DispatchToolRequestInput = {
    toolId: 'cursor',
    action: input.action ?? 'handoff',
    title: input.title,
    instructions: input.instructions,
    requestedByEmployeeId: employeeId,
    decidedByEmployeeId: decidedBy,
    payload: {
      workItemId: input.workItemId,
      delegationPlanId: input.delegationPlanId ?? null,
      workerLoopId: input.workerLoopId ?? null,
      builderToolDecisionId: input.builderToolDecisionId ?? null,
      fileScope: input.fileScope ?? [],
      checks: input.checks ?? [],
      ...(input.payload ?? {}),
    },
    context: {
      companyId,
      source: 'manual',
    },
  }

  const dispatch = dispatchToolRequestPlannedOnly(dispatchInput)
  const run = createToolExecutionFromDispatcherRequest({
    request: dispatch.request,
    employeeId,
    workItemId: input.workItemId,
    companyId,
    delegationPlanId: input.delegationPlanId ?? null,
    workerLoopId: input.workerLoopId ?? null,
    builderToolDecisionId: input.builderToolDecisionId ?? null,
    expectedResult: input.expectedResult,
    fileScope: input.fileScope,
    checks: input.checks,
  })

  return { run, dispatch }
}

/**
 * @deprecated AI-COMPANY-113D — legacy mock_completed dispatch. Demo paths only.
 * Prefer dispatchToolRequestPlannedOnly + ToolExecutionRun for lifecycle V1.
 */
export function dispatchToolRequestLegacyMock(
  input: DispatchToolRequestInput,
): DispatchToolRequestOutcome {
  return dispatchToolRequest(input)
}
