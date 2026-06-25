export const EXECUTION_STATUSES = [
  'queued',
  'preparing',
  'waiting_approval',
  'running',
  'review',
  'completed',
  'failed',
  'cancelled',
] as const

export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number]

export const EXECUTION_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

export type ExecutionPriority = (typeof EXECUTION_PRIORITIES)[number]

export type Execution = {
  id: string
  employeeId: string
  projectId: string | null
  workspaceId: string | null
  taskId: string
  runtimeRunId: string | null
  status: ExecutionStatus
  priority: ExecutionPriority
  queuePosition: number
  startedAt: string | null
  finishedAt: string | null
  estimatedDuration: number
  createdAt: string
  updatedAt: string
}

export type ExecutionQueueScope =
  | { kind: 'company' }
  | { kind: 'employee'; employeeId: string }
  | { kind: 'project'; projectId: string }
  | { kind: 'workspace'; workspaceId: string }

export type ExecutionStats = {
  currentQueue: number
  runningNow: number
  completedToday: number
  failed: number
}

const PRIORITY_RANK: Record<ExecutionPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStatus(value: unknown): ExecutionStatus {
  if (typeof value === 'string' && EXECUTION_STATUSES.includes(value as ExecutionStatus)) {
    return value as ExecutionStatus
  }
  return 'queued'
}

function parsePriority(value: unknown): ExecutionPriority {
  if (typeof value === 'string' && EXECUTION_PRIORITIES.includes(value as ExecutionPriority)) {
    return value as ExecutionPriority
  }
  return 'medium'
}

export function parseExecution(value: unknown): Execution | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.taskId !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    employeeId: value.employeeId,
    projectId: typeof value.projectId === 'string' ? value.projectId : null,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    taskId: value.taskId,
    runtimeRunId: typeof value.runtimeRunId === 'string' ? value.runtimeRunId : null,
    status: parseStatus(value.status),
    priority: parsePriority(value.priority),
    queuePosition: typeof value.queuePosition === 'number' ? value.queuePosition : 0,
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : null,
    finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : null,
    estimatedDuration: typeof value.estimatedDuration === 'number' ? value.estimatedDuration : 60,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function isActiveExecutionStatus(status: ExecutionStatus): boolean {
  return (
    status === 'queued' ||
    status === 'preparing' ||
    status === 'waiting_approval' ||
    status === 'running' ||
    status === 'review'
  )
}

export function isTerminalExecutionStatus(status: ExecutionStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

export function compareExecutions(a: Execution, b: Execution): number {
  if (a.queuePosition !== b.queuePosition) return a.queuePosition - b.queuePosition
  const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  if (priorityDiff !== 0) return priorityDiff
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

export function sortExecutions(items: Execution[]): Execution[] {
  return [...items].sort(compareExecutions)
}
