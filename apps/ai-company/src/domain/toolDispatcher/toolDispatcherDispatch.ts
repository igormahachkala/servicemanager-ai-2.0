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
 * MAX decides → dispatcher selects tool → returns mock ToolResult (V1).
 * Does not call Cursor API or adapter submit.
 */
export function dispatchToolRequest(
  input: DispatchToolRequestInput,
): DispatchToolRequestOutcome {
  const logs: ToolDispatcherLogEntry[] = [
    log('info', `Dispatch requested for tool=${input.toolId} action=${input.action}`),
  ]

  const entry = getToolDispatcherEntry(input.toolId)
  if (!entry) {
    const request = buildToolRequest(input)
    const result = buildFailedResult(request, `Unknown tool: ${input.toolId}`, logs)
    upsertToolDispatcherRequest(request)
    upsertToolDispatcherResult(result)
    return { request, result }
  }

  const availability = getToolStatus(input.toolId)
  if (availability === 'offline') {
    const request = buildToolRequest(input)
    logs.push(log('error', `Tool ${input.toolId} is offline`))
    const result = buildFailedResult(
      request,
      entry.statusReason ?? `Tool ${input.toolId} is offline`,
      logs,
    )
    upsertToolDispatcherRequest(request)
    upsertToolDispatcherResult(result)
    return { request, result }
  }

  if (availability === 'busy') {
    const request = buildToolRequest(input)
    logs.push(log('warn', `Tool ${input.toolId} is busy`))
    const result = buildFailedResult(
      request,
      entry.statusReason ?? `Tool ${input.toolId} is busy`,
      logs,
    )
    upsertToolDispatcherRequest(request)
    upsertToolDispatcherResult(result)
    return { request, result }
  }

  const capability = entry.capability
  if (!capability.supportedActions.includes(input.action)) {
    const request = buildToolRequest(input)
    logs.push(log('error', `Unsupported action: ${input.action}`))
    const result = buildFailedResult(
      request,
      `Action "${input.action}" not supported by ${input.toolId}`,
      logs,
    )
    upsertToolDispatcherRequest(request)
    upsertToolDispatcherResult(result)
    return { request, result }
  }

  if (!input.title.trim() || !input.instructions.trim()) {
    const request = buildToolRequest(input)
    const result = buildFailedResult(request, 'title and instructions are required', logs)
    upsertToolDispatcherRequest(request)
    upsertToolDispatcherResult(result)
    return { request, result }
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
