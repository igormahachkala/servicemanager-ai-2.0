import { createToolRequestApproval, type ToolRequest } from '../toolExecution/toolRequest'
import type { ToolExecution } from '../toolExecution/toolExecution'
import type { ToolNeedSignalSource, ToolRegistryEntryV1, ToolRegistryV1ToolId } from './toolRegistry'
import { resolveRequiresOwnerApproval } from './toolRegistry'
import { getToolRegistryV1EntryById } from './toolRegistryCatalog'

export const TOOL_REGISTRY_INVOKE_PHASES = [
  'planned',
  'approval_pending',
  'submitted',
  'running',
  'completed',
  'failed',
  'cancelled',
  'blocked_v1',
] as const

export type ToolRegistryInvokePhase = (typeof TOOL_REGISTRY_INVOKE_PHASES)[number]

export type ToolRegistryInvokeLogEntry = {
  at: string
  level: 'info' | 'warn' | 'error'
  message: string
  phase: ToolRegistryInvokePhase
}

export type ToolRegistryInvokeContext = {
  employeeId: string
  runtimeRunId: string | null
  maxWorkerLoopId: string | null
  workspaceId: string | null
  projectId: string | null
  taskId: string | null
}

export type ToolRegistryInvokePlan = {
  planId: string
  toolId: ToolRegistryV1ToolId
  entry: ToolRegistryEntryV1
  action: string
  input: Record<string, unknown>
  context: ToolRegistryInvokeContext
  needSignal: ToolNeedSignalSource
  needReason: string | null
  requiresOwnerApproval: boolean
  phase: ToolRegistryInvokePhase
  /** V1: always false — no adapter execution. */
  executionEnabled: false
  toolRequestDraft: ToolRequest | null
  logs: ToolRegistryInvokeLogEntry[]
  createdAt: string
}

export type ToolRegistryInvokeResult = {
  planId: string
  toolId: ToolRegistryV1ToolId
  phase: ToolRegistryInvokePhase
  ok: boolean
  output: Record<string, unknown> | null
  error: string | null
  toolExecutionId: string | null
  approvalId: string | null
  logs: ToolRegistryInvokeLogEntry[]
  finishedAt: string | null
}

function nowIso(): string {
  return new Date().toISOString()
}

function createPlanId(): string {
  return `treg-plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function appendLog(
  logs: ToolRegistryInvokeLogEntry[],
  level: ToolRegistryInvokeLogEntry['level'],
  phase: ToolRegistryInvokePhase,
  message: string,
): ToolRegistryInvokeLogEntry[] {
  return [...logs, { at: nowIso(), level, phase, message }]
}

function mapProviderForDraft(entry: ToolRegistryEntryV1): ToolRequest['provider'] {
  switch (entry.id) {
    case 'filesystem':
      return 'filesystem'
    case 'docker':
      return 'docker'
    case 'browser':
      return 'browser'
    case 'cursor-automation':
      return 'rest'
    case 'github':
      return 'github'
    default:
      return 'mock'
  }
}

/**
 * Plan a registry invoke — pure, no shell/docker/network.
 * V1 always ends in `blocked_v1` unless wired to mock gateway explicitly by caller.
 */
export function planToolRegistryInvoke(params: {
  toolId: ToolRegistryV1ToolId
  action: string
  input: Record<string, unknown>
  context: ToolRegistryInvokeContext
  needSignal: ToolNeedSignalSource
  needReason?: string | null
}): ToolRegistryInvokePlan {
  const entry = getToolRegistryV1EntryById(params.toolId)
  if (!entry) {
    throw new Error(`Unknown Tool Registry V1 id: ${params.toolId}`)
  }

  const requiresOwnerApproval = resolveRequiresOwnerApproval(entry)
  const createdAt = nowIso()
  let logs: ToolRegistryInvokeLogEntry[] = []
  logs = appendLog(logs, 'info', 'planned', `Planned ${entry.name} action "${params.action}"`)

  const toolRequestDraft: ToolRequest = {
    employeeId: params.context.employeeId,
    toolId: entry.registryToolId,
    provider: mapProviderForDraft(entry),
    action: params.action,
    arguments: {
      ...params.input,
      runtimeRunId: params.context.runtimeRunId,
      maxWorkerLoopId: params.context.maxWorkerLoopId,
      workspaceId: params.context.workspaceId,
      projectId: params.context.projectId,
      taskId: params.context.taskId,
      toolRegistryV1Id: entry.id,
    },
    approval: createToolRequestApproval(requiresOwnerApproval, null),
  }

  if (requiresOwnerApproval) {
    logs = appendLog(logs, 'warn', 'approval_pending', 'Owner approval required before execution (V2).')
  }

  logs = appendLog(logs, 'info', 'blocked_v1', 'V1 scaffold — real adapters disabled.')

  return {
    planId: createPlanId(),
    toolId: params.toolId,
    entry,
    action: params.action,
    input: params.input,
    context: params.context,
    needSignal: params.needSignal,
    needReason: params.needReason ?? null,
    requiresOwnerApproval,
    phase: 'blocked_v1',
    executionEnabled: false,
    toolRequestDraft,
    logs,
    createdAt,
  }
}

/** Map completed ToolExecution (mock or future real) back to registry result shape. */
export function buildToolRegistryInvokeResult(
  plan: Pick<ToolRegistryInvokePlan, 'planId' | 'toolId' | 'logs'>,
  execution: ToolExecution | null,
): ToolRegistryInvokeResult {
  if (!execution) {
    return {
      planId: plan.planId,
      toolId: plan.toolId,
      phase: 'blocked_v1',
      ok: false,
      output: null,
      error: 'V1 scaffold — execution not submitted.',
      toolExecutionId: null,
      approvalId: null,
      logs: plan.logs,
      finishedAt: null,
    }
  }

  const phase: ToolRegistryInvokePhase =
    execution.status === 'waiting_approval'
      ? 'approval_pending'
      : execution.status === 'running'
        ? 'running'
        : execution.status === 'completed'
          ? 'completed'
          : execution.status === 'failed'
            ? 'failed'
            : execution.status === 'cancelled'
              ? 'cancelled'
              : 'submitted'

  return {
    planId: plan.planId,
    toolId: plan.toolId,
    phase,
    ok: execution.status === 'completed' && Boolean(execution.response?.ok),
    output: execution.response?.output ?? null,
    error: execution.error,
    toolExecutionId: execution.id,
    approvalId: execution.request.approval.approvalId,
    logs: appendLog(
      plan.logs,
      execution.error ? 'error' : 'info',
      phase,
      `Execution ${execution.id} → ${execution.status}`,
    ),
    finishedAt: execution.finishedAt,
  }
}
