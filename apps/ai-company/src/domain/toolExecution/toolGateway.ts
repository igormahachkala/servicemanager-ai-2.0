import { appendAuditEvent } from '../audit/auditStorage'
import { DEFAULT_COMPANY_ID } from '../company/company'
import { emitEvent } from '../events/eventStorage'
import { ensureSeedReports, loadReports, saveReports } from '../reports/reportStorage'
import type { Report } from '../reports/report'
import type { ToolExecution } from './toolExecution'
import { createMockToolResponse } from './toolResponse'
import type { ToolRequest } from './toolRequest'
import {
  getToolExecutionById,
  initializeToolExecutionEngine,
  loadToolExecutions,
  upsertToolExecution,
} from './toolExecutionStorage'

const MOCK_EXECUTION_DELAY_MS = 450

function nowIso(): string {
  return new Date().toISOString()
}

function createExecutionId(): string {
  return `toolx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function executionSummary(execution: ToolExecution): string {
  return `${execution.request.employeeId} · ${execution.request.provider}:${execution.request.action}`
}

function appendExecutionReport(execution: ToolExecution): void {
  ensureSeedReports()
  const reports = loadReports()

  const report: Report = {
    id: `report-toolx-${execution.id}`,
    companyId: DEFAULT_COMPANY_ID,
    title: `Tool Execution ${execution.id}`,
    type: 'operations',
    employeeId: execution.request.employeeId,
    workspaceId: null,
    summary: `Tool execution via single gateway (${execution.request.provider}) finished with status ${execution.status}.`,
    findings: [
      `Action: ${execution.request.action}`,
      `Tool: ${execution.request.toolId}`,
      `Provider: ${execution.request.provider} (mock only)`,
    ],
    risks:
      execution.status === 'failed'
        ? ['Execution failed in mock provider. Runtime action was not performed.']
        : [],
    recommendations:
      execution.status === 'failed'
        ? ['Review request arguments and retry through approval flow.']
        : ['No follow-up required for successful mock execution.'],
    evidence: [
      {
        id: `ev-${execution.id}`,
        label: 'Gateway output',
        kind: 'quote',
        value: JSON.stringify(execution.response?.output ?? {}, null, 2),
      },
    ],
    status: 'published',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }

  saveReports([report, ...reports])
}

function updateExecution(execution: ToolExecution, patch: Partial<ToolExecution>): ToolExecution {
  const next: ToolExecution = {
    ...execution,
    ...patch,
    updatedAt: nowIso(),
  }
  upsertToolExecution(next)
  return next
}

function runMockExecution(executionId: string): void {
  window.setTimeout(() => {
    const execution = getToolExecutionById(executionId)
    if (!execution) return
    if (execution.status !== 'approved') return

    const running = updateExecution(execution, {
      status: 'running',
      startedAt: nowIso(),
      error: null,
    })

    appendAuditEvent({
      actorType: 'employee',
      actorId: running.request.employeeId,
      action: 'invoke',
      targetType: 'tool',
      targetId: running.request.toolId,
      workspaceId: null,
      metadata: {
        executionId: running.id,
        phase: 'running',
        provider: running.request.provider,
      },
    })

    emitEvent({
      type: 'runtime.started',
      sourceType: 'tool',
      sourceId: running.request.toolId,
      employeeId: running.request.employeeId,
      workspaceId: null,
      reportId: null,
      metadata: {
        executionId: running.id,
        summary: executionSummary(running),
        mock: true,
      },
      severity: 'info',
    })

    const forceError = Boolean(running.request.arguments.fail)
    const response = createMockToolResponse({
      requestId: running.id,
      employeeId: running.request.employeeId,
      action: running.request.action,
      provider: running.request.provider,
      args: running.request.arguments,
      forceError,
    })

    const finished = updateExecution(running, {
      status: response.ok ? 'completed' : 'failed',
      finishedAt: nowIso(),
      response,
      error: response.error,
    })

    appendAuditEvent({
      actorType: 'employee',
      actorId: finished.request.employeeId,
      action: response.ok ? 'review' : 'reject',
      targetType: 'run',
      targetId: finished.id,
      workspaceId: null,
      metadata: {
        provider: finished.request.provider,
        success: response.ok,
        mock: true,
      },
    })

    emitEvent({
      type: 'run.completed',
      sourceType: 'run',
      sourceId: finished.id,
      employeeId: finished.request.employeeId,
      workspaceId: null,
      reportId: `report-toolx-${finished.id}`,
      metadata: {
        summary: executionSummary(finished),
        ok: response.ok,
        elapsedMs: response.elapsedMs,
      },
      severity: response.ok ? 'success' : 'error',
    })

    appendExecutionReport(finished)
  }, MOCK_EXECUTION_DELAY_MS)
}

function createInitialExecution(request: ToolRequest): ToolExecution {
  const createdAt = nowIso()
  const requiresApproval = request.approval.required

  return {
    id: createExecutionId(),
    request,
    status: requiresApproval ? 'waiting_approval' : 'approved',
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    finishedAt: null,
    approvalDecisionAt: null,
    cancelledAt: null,
    response: null,
    error: null,
  }
}

export function submitToolRequest(request: ToolRequest): ToolExecution {
  initializeToolExecutionEngine()
  const execution = createInitialExecution(request)
  upsertToolExecution(execution)

  appendAuditEvent({
    actorType: 'employee',
    actorId: request.employeeId,
    action: 'create',
    targetType: 'tool',
    targetId: request.toolId,
    workspaceId: null,
    metadata: {
      executionId: execution.id,
      provider: request.provider,
      action: request.action,
      mock: true,
    },
  })

  if (request.approval.required) {
    emitEvent({
      type: 'approval.requested',
      sourceType: 'approval',
      sourceId: request.approval.approvalId ?? `${execution.id}-approval`,
      employeeId: request.employeeId,
      workspaceId: null,
      reportId: null,
      metadata: {
        executionId: execution.id,
        summary: executionSummary(execution),
      },
      severity: 'warn',
    })
  } else {
    runMockExecution(execution.id)
  }

  return execution
}

export function submitToolRequestFromRuntime(request: ToolRequest): ToolExecution {
  return submitToolRequest(request)
}

export function approveToolRequest(executionId: string, actorId = 'owner'): ToolExecution | null {
  const current = getToolExecutionById(executionId)
  if (!current || current.status !== 'waiting_approval') return null

  const next = updateExecution(current, {
    status: 'approved',
    approvalDecisionAt: nowIso(),
    request: {
      ...current.request,
      approval: {
        ...current.request.approval,
        status: 'approved',
      },
    },
  })

  appendAuditEvent({
    actorType: 'owner',
    actorId,
    action: 'approve',
    targetType: 'approval',
    targetId: current.request.approval.approvalId ?? `${current.id}-approval`,
    workspaceId: null,
    metadata: {
      executionId: current.id,
      summary: executionSummary(current),
    },
  })

  emitEvent({
    type: 'approval.granted',
    sourceType: 'approval',
    sourceId: current.request.approval.approvalId ?? `${current.id}-approval`,
    employeeId: current.request.employeeId,
    workspaceId: null,
    reportId: null,
    metadata: {
      executionId: current.id,
      actorId,
      summary: executionSummary(current),
    },
    severity: 'success',
  })

  runMockExecution(next.id)
  return next
}

export function rejectToolRequest(
  executionId: string,
  actorId = 'owner',
  reason = 'Rejected by owner',
): ToolExecution | null {
  const current = getToolExecutionById(executionId)
  if (!current || current.status !== 'waiting_approval') return null

  const next = updateExecution(current, {
    status: 'cancelled',
    approvalDecisionAt: nowIso(),
    cancelledAt: nowIso(),
    request: {
      ...current.request,
      approval: {
        ...current.request.approval,
        status: 'rejected',
      },
    },
    error: reason,
  })

  appendAuditEvent({
    actorType: 'owner',
    actorId,
    action: 'reject',
    targetType: 'approval',
    targetId: current.request.approval.approvalId ?? `${current.id}-approval`,
    workspaceId: null,
    metadata: {
      executionId: current.id,
      reason,
    },
  })

  emitEvent({
    type: 'approval.rejected',
    sourceType: 'approval',
    sourceId: current.request.approval.approvalId ?? `${current.id}-approval`,
    employeeId: current.request.employeeId,
    workspaceId: null,
    reportId: null,
    metadata: {
      executionId: current.id,
      actorId,
      reason,
    },
    severity: 'warn',
  })

  return next
}

export function cancelToolRequest(executionId: string, actorId = 'owner'): ToolExecution | null {
  const current = getToolExecutionById(executionId)
  if (!current) return null
  if (
    current.status === 'completed' ||
    current.status === 'failed' ||
    current.status === 'cancelled'
  ) {
    return null
  }

  const next = updateExecution(current, {
    status: 'cancelled',
    cancelledAt: nowIso(),
    finishedAt: current.finishedAt ?? nowIso(),
    error: 'Cancelled manually',
  })

  appendAuditEvent({
    actorType: 'owner',
    actorId,
    action: 'delete',
    targetType: 'run',
    targetId: current.id,
    workspaceId: null,
    metadata: {
      executionId: current.id,
      summary: executionSummary(current),
    },
  })

  return next
}

export function listToolExecutions(): ToolExecution[] {
  initializeToolExecutionEngine()
  return loadToolExecutions()
}

export function listToolExecutionsForRun(runId: string): ToolExecution[] {
  initializeToolExecutionEngine()
  return loadToolExecutions().filter(
    (item) => item.request.arguments.runId === runId,
  )
}
