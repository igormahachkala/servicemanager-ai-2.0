import {
  computeToolExecutionStats,
  type ToolExecution,
  type ToolExecutionStats,
} from './toolExecution'
import {
  TOOL_EXECUTION_PROVIDERS,
  createToolRequestApproval,
  type ToolExecutionProvider,
  type ToolRequest,
  type ToolRequestApprovalStatus,
} from './toolRequest'

const STORAGE_KEY = 'ai-company-tool-executions'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseProvider(value: unknown): ToolExecutionProvider | null {
  return typeof value === 'string' && (TOOL_EXECUTION_PROVIDERS as readonly string[]).includes(value)
    ? (value as ToolExecutionProvider)
    : null
}

function parseApprovalStatus(value: unknown): ToolRequestApprovalStatus {
  return value === 'approved' || value === 'rejected' || value === 'pending' || value === 'none'
    ? value
    : 'none'
}

function parseToolRequest(value: unknown): ToolRequest | null {
  if (!isRecord(value)) return null
  const provider = parseProvider(value.provider)

  if (
    typeof value.employeeId !== 'string' ||
    typeof value.toolId !== 'string' ||
    !provider ||
    typeof value.action !== 'string' ||
    !isRecord(value.arguments)
  ) {
    return null
  }

  const approval = isRecord(value.approval)
    ? {
        required: Boolean(value.approval.required),
        approvalId: typeof value.approval.approvalId === 'string' ? value.approval.approvalId : null,
        status: parseApprovalStatus(value.approval.status),
      }
    : createToolRequestApproval(false)

  return {
    employeeId: value.employeeId,
    toolId: value.toolId,
    provider,
    action: value.action,
    arguments: value.arguments,
    approval,
  }
}

function parseToolExecution(value: unknown): ToolExecution | null {
  if (!isRecord(value)) return null
  const request = parseToolRequest(value.request)
  if (!request) return null

  const status =
    value.status === 'created' ||
    value.status === 'waiting_approval' ||
    value.status === 'approved' ||
    value.status === 'running' ||
    value.status === 'completed' ||
    value.status === 'failed' ||
    value.status === 'cancelled'
      ? value.status
      : null

  if (
    !status ||
    typeof value.id !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    request,
    status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : null,
    finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : null,
    approvalDecisionAt: typeof value.approvalDecisionAt === 'string' ? value.approvalDecisionAt : null,
    cancelledAt: typeof value.cancelledAt === 'string' ? value.cancelledAt : null,
    response: isRecord(value.response)
      ? {
          ok: Boolean(value.response.ok),
          output: isRecord(value.response.output) ? value.response.output : {},
          error: typeof value.response.error === 'string' ? value.response.error : null,
          elapsedMs: typeof value.response.elapsedMs === 'number' ? value.response.elapsedMs : 0,
          completedAt:
            typeof value.response.completedAt === 'string'
              ? value.response.completedAt
              : new Date().toISOString(),
          mock: true,
        }
      : null,
    error: typeof value.error === 'string' ? value.error : null,
  }
}

export function loadToolExecutions(): ToolExecution[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map(parseToolExecution)
      .filter((item): item is ToolExecution => item !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch {
    return []
  }
}

export function saveToolExecutions(executions: ToolExecution[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(executions))
  } catch {
    /* noop */
  }
}

export function getToolExecutionById(id: string): ToolExecution | null {
  return loadToolExecutions().find((item) => item.id === id) ?? null
}

export function upsertToolExecution(execution: ToolExecution): ToolExecution[] {
  const list = loadToolExecutions()
  const next = [execution, ...list.filter((item) => item.id !== execution.id)]
  saveToolExecutions(next)
  return next
}

export function removeToolExecution(id: string): ToolExecution[] {
  const next = loadToolExecutions().filter((item) => item.id !== id)
  saveToolExecutions(next)
  return next
}

export function getToolExecutionStats(): ToolExecutionStats {
  return computeToolExecutionStats(loadToolExecutions())
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600000).toISOString()
}

function makeSeedExecution(params: {
  id: string
  employeeId: string
  toolId: string
  action: string
  status: ToolExecution['status']
  createdHoursAgo: number
  approvalRequired: boolean
  approvalStatus: ToolRequest['approval']['status']
  output: Record<string, unknown>
  error?: string
}): ToolExecution {
  const createdAt = hoursAgo(params.createdHoursAgo)
  const updatedAt = hoursAgo(Math.max(0, params.createdHoursAgo - 1))

  return {
    id: params.id,
    request: {
      employeeId: params.employeeId,
      toolId: params.toolId,
      provider: 'mock',
      action: params.action,
      arguments: { seed: true },
      approval: createToolRequestApproval(
        params.approvalRequired,
        params.approvalRequired ? `${params.id}-approval` : null,
        params.approvalStatus,
      ),
    },
    status: params.status,
    createdAt,
    updatedAt,
    startedAt:
      params.status === 'running' || params.status === 'completed' || params.status === 'failed'
        ? updatedAt
        : null,
    finishedAt:
      params.status === 'completed' || params.status === 'failed' || params.status === 'cancelled'
        ? updatedAt
        : null,
    approvalDecisionAt:
      params.approvalStatus === 'approved' || params.approvalStatus === 'rejected' ? updatedAt : null,
    cancelledAt: params.status === 'cancelled' ? updatedAt : null,
    response:
      params.status === 'completed' || params.status === 'failed'
        ? {
            ok: params.status === 'completed',
            output: params.output,
            error: params.error ?? null,
            elapsedMs: 900,
            completedAt: updatedAt,
            mock: true,
          }
        : null,
    error: params.error ?? null,
  }
}

function seedToolExecutions(): ToolExecution[] {
  return [
    makeSeedExecution({
      id: 'toolx-001',
      employeeId: 'ag-cto',
      toolId: 'tool-github',
      action: 'analyze_pr',
      status: 'completed',
      createdHoursAgo: 18,
      approvalRequired: true,
      approvalStatus: 'approved',
      output: { summary: 'PR analyzed with mock provider' },
    }),
    makeSeedExecution({
      id: 'toolx-002',
      employeeId: 'ag-devops',
      toolId: 'tool-docker',
      action: 'build_local_image',
      status: 'waiting_approval',
      createdHoursAgo: 6,
      approvalRequired: true,
      approvalStatus: 'pending',
      output: {},
    }),
  ]
}

export function initializeToolExecutionEngine(): void {
  if (loadToolExecutions().length > 0) return
  saveToolExecutions(seedToolExecutions())
}
