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
  getToolCapability,
  isSafeToolAutoApproveEnabled,
  type DispatchToolRequestInput,
  type DispatchToolRequestOutcome,
  type ToolDispatcherToolId,
  type ToolRequest as ToolDispatcherRequest,
} from '../toolDispatcher'
import { approveToolExecutionRun, createToolExecutionRun } from './toolExecutionRunStorage'
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

export type RequestToolExecutionInput = BuilderCursorToolExecutionInput & {
  /** Defaults to 'cursor' — the historical behaviour of this entry point. */
  toolId?: ToolDispatcherToolId
}

/**
 * Default dispatcher action per tool. Cursor keeps 'handoff', the value this
 * entry point has always sent. Ollama's capability supports only 'analyze', so
 * without a per-tool default an ollama request would die in
 * validateDispatchInput — "Action handoff not supported by ollama" — before
 * reaching any branch. Exhaustive by type: a new dispatcher tool cannot be
 * added without deciding its action here.
 */
const DEFAULT_ACTION_BY_TOOL: Record<ToolDispatcherToolId, string> = {
  cursor: 'handoff',
  ollama: 'analyze',
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

  const run = createToolExecutionRun({
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

  // Honour capability.requiresOwnerApproval when autonomy is switched on.
  // The run still passes through awaiting_owner → approved, so history shows
  // who let it through and approveToolExecutionRun fires the executor exactly
  // as an Owner click would.
  const capability = getToolCapability(input.request.toolId)
  if (capability && !capability.requiresOwnerApproval && isSafeToolAutoApproveEnabled()) {
    return (
      approveToolExecutionRun(
        run.id,
        `Auto-approved: ${input.request.toolId} capability does not require Owner approval.`,
      ) ?? run
    )
  }

  return run
}

export function requestToolExecution(
  input: RequestToolExecutionInput,
): BuilderCursorToolExecutionOutcome {
  const toolId = input.toolId ?? 'cursor'
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
    toolId,
    action: input.action ?? DEFAULT_ACTION_BY_TOOL[toolId],
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
 * Cursor-shaped entry point, unchanged for its two callers
 * (manualCursorTaskFlowCreate, builderAutomationTaskFlowCreate). Kept as a thin
 * wrapper so the cursor path is provably the old one: same toolId, same action.
 */
export function requestBuilderCursorToolExecution(
  input: BuilderCursorToolExecutionInput,
): BuilderCursorToolExecutionOutcome {
  return requestToolExecution({ ...input, toolId: 'cursor' })
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
