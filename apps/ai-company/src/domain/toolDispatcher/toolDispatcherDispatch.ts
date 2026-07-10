/**
 * Tool Dispatcher — dispatch API (AI-COMPANY-111B).
 * V1: mock ToolResult via Cursor Automation domain — no real Cursor launch.
 */

import { planCursorAutomationHandoff } from '../toolRegistry/toolRegistryCursorAutomationBridge'
import { buildToolDispatcherEndpointUrl } from './toolDispatcherConfig'
import { getToolCapability, getToolDispatcherEntry, getToolStatus } from './toolDispatcherRegistry'
import {
  createToolDispatcherRequestId,
  upsertToolDispatcherRequest,
  upsertToolDispatcherResult,
} from './toolDispatcherStorage'
import type {
  DispatchToolRequestInput,
  DispatchToolRequestOutcome,
  ToolDispatcherLogEntry,
  ToolRequest,
  ToolRequestContext,
  ToolResult,
} from './toolDispatcherTypes'

function nowIso(): string {
  return new Date().toISOString()
}

function log(level: ToolDispatcherLogEntry['level'], message: string): ToolDispatcherLogEntry {
  return { at: nowIso(), level, message }
}

function defaultContext(partial?: Partial<ToolRequestContext>): ToolRequestContext {
  return {
    companyId: partial?.companyId ?? null,
    workspaceId: partial?.workspaceId ?? null,
    projectId: partial?.projectId ?? null,
    runtimeRunId: partial?.runtimeRunId ?? null,
    maxWorkerLoopId: partial?.maxWorkerLoopId ?? null,
    chatId: partial?.chatId ?? null,
    source: partial?.source ?? 'manual',
  }
}

function buildToolRequest(input: DispatchToolRequestInput): ToolRequest {
  return {
    requestId: createToolDispatcherRequestId(),
    toolId: input.toolId,
    action: input.action,
    title: input.title.trim(),
    instructions: input.instructions.trim(),
    requestedByEmployeeId: input.requestedByEmployeeId,
    decidedByEmployeeId: input.decidedByEmployeeId,
    payload: input.payload ?? {},
    context: defaultContext(input.context),
    createdAt: nowIso(),
  }
}

function buildFailedResult(
  request: ToolRequest,
  error: string,
  logs: ToolDispatcherLogEntry[],
): ToolResult {
  return {
    requestId: request.requestId,
    toolId: request.toolId,
    status: 'failed',
    ok: false,
    deliveryMode: 'mock_v1',
    output: null,
    error,
    cursorAutomationTaskId: null,
    registryInvokePlanId: null,
    finishedAt: nowIso(),
    logs,
  }
}

function validateDispatchInput(
  input: DispatchToolRequestInput,
  logs: ToolDispatcherLogEntry[],
):
  | { ok: true; entry: NonNullable<ReturnType<typeof getToolDispatcherEntry>> }
  | { ok: false; request: ToolRequest; result: ToolResult } {
  const entry = getToolDispatcherEntry(input.toolId)
  if (!entry) {
    const request = buildToolRequest(input)
    return {
      ok: false,
      request,
      result: buildFailedResult(request, `Unknown tool: ${input.toolId}`, logs),
    }
  }

  const availability = getToolStatus(input.toolId)
  if (availability === 'offline') {
    const request = buildToolRequest(input)
    logs.push(log('error', `Tool ${input.toolId} is offline`))
    return {
      ok: false,
      request,
      result: buildFailedResult(
        request,
        entry.statusReason ?? `Tool ${input.toolId} is offline`,
        logs,
      ),
    }
  }

  if (availability === 'busy') {
    const request = buildToolRequest(input)
    logs.push(log('warn', `Tool ${input.toolId} is busy`))
    return {
      ok: false,
      request,
      result: buildFailedResult(
        request,
        entry.statusReason ?? `Tool ${input.toolId} is busy`,
        logs,
      ),
    }
  }

  const capability = entry.capability
  if (!capability.supportedActions.includes(input.action)) {
    const request = buildToolRequest(input)
    logs.push(log('error', `Unsupported action: ${input.action}`))
    return {
      ok: false,
      request,
      result: buildFailedResult(
        request,
        `Action "${input.action}" not supported by ${input.toolId}`,
        logs,
      ),
    }
  }

  if (!input.title.trim() || !input.instructions.trim()) {
    const request = buildToolRequest(input)
    return {
      ok: false,
      request,
      result: buildFailedResult(request, 'title and instructions are required', logs),
    }
  }

  return { ok: true, entry }
}

function buildPlannedResult(request: ToolRequest, logs: ToolDispatcherLogEntry[]): ToolResult {
  const capability = getToolCapability(request.toolId)
  const submitUrl = capability
    ? buildToolDispatcherEndpointUrl(capability.endpoint, 'submit')
    : null
  const statusUrl = capability
    ? buildToolDispatcherEndpointUrl(capability.endpoint, 'status')
    : null

  logs.push(
    log(
      'info',
      'Tool Dispatcher lifecycle V1 — planned only, awaiting Owner approval (no Cursor launch)',
    ),
  )

  return {
    requestId: request.requestId,
    toolId: request.toolId,
    status: 'planned',
    ok: true,
    deliveryMode: 'planned_v1',
    output: {
      plannedOnly: true,
      lifecycleStatus: 'awaiting_owner',
      registryToolId: capability?.registryToolId ?? null,
      endpointConfigKey: capability?.endpoint.configKey ?? null,
      submitUrl,
      statusUrl,
      workItemId:
        typeof request.payload.workItemId === 'string' ? request.payload.workItemId : null,
    },
    error: null,
    cursorAutomationTaskId: null,
    registryInvokePlanId: null,
    finishedAt: nowIso(),
    logs,
  }
}

function dispatchCursorMock(request: ToolRequest): ToolResult {
  const logs: ToolDispatcherLogEntry[] = [
    log('info', 'Tool Dispatcher V1 — mock dispatch for Cursor (no API launch)'),
  ]

  const capability = getToolCapability('cursor')
  if (!capability) {
    return buildFailedResult(request, 'Cursor capability not registered', logs)
  }

  const submitUrl = buildToolDispatcherEndpointUrl(capability.endpoint, 'submit')
  const statusUrl = buildToolDispatcherEndpointUrl(capability.endpoint, 'status')
  logs.push(
    log('info', `Endpoint config: submit=${submitUrl ?? 'n/a'}, status=${statusUrl ?? 'n/a'}`),
  )

  const { task, invokePlan } = planCursorAutomationHandoff({
    title: request.title,
    instructions: request.instructions,
    requestedByEmployeeId: request.requestedByEmployeeId,
    runtimeRunId: request.context.runtimeRunId,
    maxWorkerLoopId: request.context.maxWorkerLoopId,
    projectId: request.context.projectId,
    workspaceId: request.context.workspaceId,
    needReason: `Tool Dispatcher mock — decided by ${request.decidedByEmployeeId}`,
  })

  logs.push(log('info', `Planned Cursor Automation task ${task.id} (status=${task.status})`))
  logs.push(log('info', `Tool Registry invoke plan ${invokePlan.planId} — phase=${invokePlan.phase}`))

  return {
    requestId: request.requestId,
    toolId: 'cursor',
    status: 'mock_completed',
    ok: true,
    deliveryMode: 'mock_v1',
    output: {
      plannedOnly: true,
      cursorAutomationTaskId: task.id,
      registryInvokePlanId: invokePlan.planId,
      registryInvokePhase: invokePlan.phase,
      registryToolId: capability.registryToolId,
      endpointConfigKey: capability.endpoint.configKey,
      submitUrl,
      statusUrl,
      taskStatus: task.status,
      requiresOwnerApproval: task.requiresOwnerApproval,
    },
    error: null,
    cursorAutomationTaskId: task.id,
    registryInvokePlanId: invokePlan.planId,
    finishedAt: nowIso(),
    logs,
  }
}

/**
 * Lifecycle V1 — persist request + planned result only.
 * Does not return mock_completed, does not plan Cursor Automation, does not launch Cursor.
 */
export function dispatchToolRequestPlannedOnly(
  input: DispatchToolRequestInput,
): DispatchToolRequestOutcome {
  const logs: ToolDispatcherLogEntry[] = [
    log('info', `Planned dispatch for tool=${input.toolId} action=${input.action}`),
  ]

  const validated = validateDispatchInput(input, logs)
  if (!validated.ok) {
    upsertToolDispatcherRequest(validated.request)
    upsertToolDispatcherResult(validated.result)
    return { request: validated.request, result: validated.result }
  }

  const request = buildToolRequest(input)
  upsertToolDispatcherRequest(request)
  const result = buildPlannedResult(request, logs)
  upsertToolDispatcherResult(result)
  return { request, result }
}

/**
 * Legacy mock dispatch — returns mock_completed via Cursor Automation planning.
 * Prefer dispatchToolRequestPlannedOnly + ToolExecutionRun for lifecycle V1.
 */
export function dispatchToolRequest(
  input: DispatchToolRequestInput,
): DispatchToolRequestOutcome {
  const logs: ToolDispatcherLogEntry[] = [
    log('info', `Dispatch requested for tool=${input.toolId} action=${input.action}`),
  ]

  const validated = validateDispatchInput(input, logs)
  if (!validated.ok) {
    upsertToolDispatcherRequest(validated.request)
    upsertToolDispatcherResult(validated.result)
    return { request: validated.request, result: validated.result }
  }

  const request = buildToolRequest(input)
  upsertToolDispatcherRequest(request)

  let result: ToolResult
  switch (input.toolId) {
    case 'cursor':
      result = dispatchCursorMock(request)
      break
    default:
      result = buildFailedResult(request, `No dispatcher handler for ${input.toolId}`, logs)
  }

  upsertToolDispatcherResult(result)
  return { request, result }
}
