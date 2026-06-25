export type DeliveryTaskStatus = 'backlog' | 'in_progress' | 'review' | 'done' | 'blocked'

export type DeliveryTaskPriority = 'low' | 'medium' | 'high' | 'critical'

export type DeliveryTask = {
  id: string
  projectId: string
  workspaceId: string
  title: string
  description: string
  assigneeId: string
  priority: DeliveryTaskPriority
  status: DeliveryTaskStatus
  expectedOutput: string
  createdAt: string
  updatedAt: string
}

export type CreateDeliveryTaskInput = {
  id?: string
  projectId: string
  workspaceId: string
  title: string
  description?: string
  assigneeId: string
  priority?: DeliveryTaskPriority
  status?: DeliveryTaskStatus
  expectedOutput: string
}

const TASK_STATUSES: DeliveryTaskStatus[] = ['backlog', 'in_progress', 'review', 'done', 'blocked']
const TASK_PRIORITIES: DeliveryTaskPriority[] = ['low', 'medium', 'high', 'critical']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStatus(value: unknown): DeliveryTaskStatus {
  if (typeof value === 'string' && TASK_STATUSES.includes(value as DeliveryTaskStatus)) {
    return value as DeliveryTaskStatus
  }
  return 'backlog'
}

function parsePriority(value: unknown): DeliveryTaskPriority {
  if (typeof value === 'string' && TASK_PRIORITIES.includes(value as DeliveryTaskPriority)) {
    return value as DeliveryTaskPriority
  }
  return 'medium'
}

export function parseDeliveryTask(value: unknown): DeliveryTask | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.projectId !== 'string' ||
    typeof value.workspaceId !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.assigneeId !== 'string' ||
    typeof value.expectedOutput !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    projectId: value.projectId,
    workspaceId: value.workspaceId,
    title: value.title,
    description: typeof value.description === 'string' ? value.description : '',
    assigneeId: value.assigneeId,
    priority: parsePriority(value.priority),
    status: parseStatus(value.status),
    expectedOutput: value.expectedOutput,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

export function createDeliveryTask(input: CreateDeliveryTaskInput): DeliveryTask {
  const now = new Date().toISOString()
  return {
    id: input.id ?? `task-${Date.now()}`,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    title: input.title.trim(),
    description: (input.description ?? '').trim(),
    assigneeId: input.assigneeId,
    priority: input.priority ?? 'medium',
    status: input.status ?? 'backlog',
    expectedOutput: input.expectedOutput.trim(),
    createdAt: now,
    updatedAt: now,
  }
}

export { TASK_PRIORITIES, TASK_STATUSES }
