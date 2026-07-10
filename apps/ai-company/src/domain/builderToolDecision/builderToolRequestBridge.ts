/**
 * Builder → Tool Dispatcher bridge (AI-COMPANY-113B).
 * Registers request only — no Cursor API, no mock completion, no shell.
 */

import { BUILDER_EMPLOYEE_ID } from '../mobileEmployee/mobileEmployeeRegistry'
import {
  createToolDispatcherRequestId,
  upsertToolDispatcherRequest,
  upsertToolDispatcherResult,
} from '../toolDispatcher/toolDispatcherStorage'
import { getToolCapability, getToolStatus } from '../toolDispatcher/toolDispatcherRegistry'
import type { ToolRequest, ToolResult } from '../toolDispatcher/toolDispatcherTypes'
import type { BuilderToolDecision } from './builderToolDecisionTypes'
import { upsertBuilderToolDecision } from './builderToolDecisionStorage'
import {
  createBuilderToolExecutionRun,
  type CreateBuilderToolExecutionRunInput,
} from './builderToolExecutionRun'

function nowIso(): string {
  return new Date().toISOString()
}

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
  executionRun: ReturnType<typeof createBuilderToolExecutionRun>
}

function buildAwaitingOwnerResult(request: ToolRequest): ToolResult {
  return {
    requestId: request.requestId,
    toolId: request.toolId,
    status: 'accepted',
    ok: true,
    deliveryMode: 'mock_v1',
    output: {
      plannedOnly: true,
      awaitingOwner: true,
      builderToolDecisionId: request.payload.builderToolDecisionId ?? null,
      note: 'Builder Tool Request V1 — awaiting Owner approval before adapter launch.',
    },
    error: null,
    cursorAutomationTaskId: null,
    registryInvokePlanId: null,
    finishedAt: nowIso(),
    logs: [
      {
        at: nowIso(),
        level: 'info',
        message: 'Tool Dispatcher registered Builder Cursor request — no execution (113B).',
      },
    ],
  }
}

/**
 * Builder requests Cursor via Tool Dispatcher.
 * Creates ToolExecutionRun (awaiting_owner) — Cursor is NOT launched.
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

  const capability = getToolCapability('cursor')
  if (!capability) {
    throw new Error('Cursor tool is not registered in Tool Dispatcher.')
  }
  if (getToolStatus('cursor') === 'offline') {
    throw new Error('Cursor tool is offline in Tool Dispatcher registry.')
  }

  const savedDecision = upsertBuilderToolDecision(input.decision)
  const requestId = createToolDispatcherRequestId()
  const instructions = [
    input.decision.reason,
    '',
    `Expected result: ${input.decision.expectedResult}`,
    input.decision.fileScope.length > 0
      ? `File scope: ${input.decision.fileScope.join(', ')}`
      : 'File scope: to be confirmed with Owner',
    `Checks: ${input.decision.checks.join(' · ')}`,
  ].join('\n')

  const toolRequest: ToolRequest = {
    requestId,
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
      companyId: null,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      runtimeRunId: null,
      maxWorkerLoopId: input.workerLoopId,
      chatId: null,
      source: 'runtime',
    },
    createdAt: nowIso(),
  }

  upsertToolDispatcherRequest(toolRequest)
  upsertToolDispatcherResult(buildAwaitingOwnerResult(toolRequest))

  const executionRun = createBuilderToolExecutionRun({
    decision: savedDecision,
    toolDispatcherRequestId: requestId,
    taskTitle: input.taskTitle,
  } satisfies CreateBuilderToolExecutionRunInput)

  return { decision: savedDecision, toolRequest, executionRun }
}
