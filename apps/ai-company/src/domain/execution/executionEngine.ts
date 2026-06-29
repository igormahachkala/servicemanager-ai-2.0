import { getDeliveryTaskById, loadDeliveryTasks } from '../tasks/taskStorage'
import type { DeliveryTaskPriority } from '../tasks/task'
import {
  isActiveExecutionStatus,
  isTerminalExecutionStatus,
  parseExecution,
  sortExecutions,
  type Execution,
  type ExecutionPriority,
  type ExecutionQueueScope,
  type ExecutionStats,
  type ExecutionStatus,
} from './execution'

const STORAGE_KEY = 'ai-company-executions'
const SEED_FLAG_KEY = 'ai-company-executions-seeded'

function priorityFromTask(priority: DeliveryTaskPriority): ExecutionPriority {
  return priority
}

function nowIso(): string {
  return new Date().toISOString()
}

function startOfToday(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

export function loadExecutions(): Execution[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseExecution).filter((item): item is Execution => item !== null)
  } catch {
    return []
  }
}

export function saveExecutions(items: Execution[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* noop */
  }
}

export function getExecutionById(id: string): Execution | null {
  return loadExecutions().find((item) => item.id === id) ?? null
}

function upsertExecution(item: Execution): Execution {
  const items = loadExecutions()
  const index = items.findIndex((entry) => entry.id === item.id)
  if (index >= 0) {
    const next = [...items]
    next[index] = item
    saveExecutions(next)
    return item
  }
  saveExecutions([item, ...items])
  return item
}

function nextQueuePosition(employeeId: string): number {
  const queued = loadExecutions().filter(
    (item) => item.employeeId === employeeId && item.status === 'queued',
  )
  if (queued.length === 0) return 1
  return Math.max(...queued.map((item) => item.queuePosition)) + 1
}

function reindexEmployeeQueue(employeeId: string): void {
  const items = loadExecutions()
  const queued = sortExecutions(
    items.filter((item) => item.employeeId === employeeId && item.status === 'queued'),
  )
  const positionMap = new Map(queued.map((item, index) => [item.id, index + 1]))
  const next = items.map((item) =>
    positionMap.has(item.id)
      ? { ...item, queuePosition: positionMap.get(item.id)!, updatedAt: nowIso() }
      : item,
  )
  saveExecutions(next)
}

function filterByScope(items: Execution[], scope: ExecutionQueueScope): Execution[] {
  switch (scope.kind) {
    case 'company':
      return items
    case 'employee':
      return items.filter((item) => item.employeeId === scope.employeeId)
    case 'project':
      return items.filter((item) => item.projectId === scope.projectId)
    case 'workspace':
      return items.filter((item) => item.workspaceId === scope.workspaceId)
  }
}

export function getExecutionQueue(scope: ExecutionQueueScope): Execution[] {
  return sortExecutions(filterByScope(loadExecutions(), scope))
}

export function computeExecutionStats(scope: ExecutionQueueScope = { kind: 'company' }): ExecutionStats {
  const items = filterByScope(loadExecutions(), scope)
  const todayStart = startOfToday().getTime()

  return {
    currentQueue: items.filter(
      (item) => item.status === 'queued' || item.status === 'preparing',
    ).length,
    runningNow: items.filter(
      (item) =>
        item.status === 'running' ||
        item.status === 'preparing' ||
        item.status === 'waiting_approval' ||
        item.status === 'review',
    ).length,
    completedToday: items.filter(
      (item) =>
        item.status === 'completed' &&
        item.finishedAt !== null &&
        new Date(item.finishedAt).getTime() >= todayStart,
    ).length,
    failed: items.filter((item) => item.status === 'failed').length,
  }
}

export function enqueueTask(taskId: string): Execution | null {
  const task = getDeliveryTaskById(taskId)
  if (!task) return null

  const existing = loadExecutions().find(
    (item) => item.taskId === taskId && isActiveExecutionStatus(item.status),
  )
  if (existing) return existing

  const now = nowIso()
  const created: Execution = {
    id: `exec-${taskId}`,
    employeeId: task.assigneeId,
    projectId: task.projectId,
    workspaceId: task.workspaceId,
    taskId: task.id,
    runtimeRunId: null,
    status: 'queued',
    priority: priorityFromTask(task.priority),
    queuePosition: nextQueuePosition(task.assigneeId),
    startedAt: null,
    finishedAt: null,
    estimatedDuration: task.priority === 'critical' ? 45 : task.priority === 'high' ? 90 : 120,
    createdAt: now,
    updatedAt: now,
  }

  return upsertExecution(created)
}

function patchExecution(
  id: string,
  patch: Partial<
    Pick<
      Execution,
      'status' | 'runtimeRunId' | 'startedAt' | 'finishedAt' | 'queuePosition' | 'priority'
    >
  >,
): Execution | null {
  const current = getExecutionById(id)
  if (!current) return null

  const updated: Execution = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
  }
  upsertExecution(updated)
  if (patch.status === 'cancelled' || patch.status === 'completed' || patch.status === 'failed') {
    reindexEmployeeQueue(updated.employeeId)
  }
  return updated
}

export function cancelExecution(id: string): Execution | null {
  const current = getExecutionById(id)
  if (!current || isTerminalExecutionStatus(current.status)) return null
  return patchExecution(id, {
    status: 'cancelled',
    finishedAt: nowIso(),
    queuePosition: 0,
  })
}

export function retryExecution(id: string): Execution | null {
  const current = getExecutionById(id)
  if (!current || (current.status !== 'failed' && current.status !== 'cancelled')) return null

  return patchExecution(id, {
    status: 'queued',
    queuePosition: nextQueuePosition(current.employeeId),
    startedAt: null,
    finishedAt: null,
  })
}

export function completeExecution(id: string): Execution | null {
  const current = getExecutionById(id)
  if (!current || isTerminalExecutionStatus(current.status)) return null
  return patchExecution(id, {
    status: 'completed',
    finishedAt: nowIso(),
    queuePosition: 0,
  })
}

export function linkRuntimeRun(executionId: string, runtimeRunId: string): Execution | null {
  return patchExecution(executionId, { runtimeRunId })
}

export function markExecutionRunning(executionId: string, runtimeRunId: string): Execution | null {
  return patchExecution(executionId, {
    status: 'running',
    runtimeRunId: runtimeRunId || undefined,
    startedAt: nowIso(),
  })
}

export function markExecutionFailed(executionId: string): Execution | null {
  return patchExecution(executionId, {
    status: 'failed',
    finishedAt: nowIso(),
    queuePosition: 0,
  })
}

export function upsertExecutions(items: Execution[]): void {
  const current = loadExecutions()
  const next = [...current]
  for (const item of items) {
    const index = next.findIndex((entry) => entry.id === item.id)
    if (index >= 0) next[index] = item
    else next.push(item)
  }
  saveExecutions(next)
}

export function isExecutionsSeeded(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(SEED_FLAG_KEY) === '1'
}

export function markExecutionsSeeded(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SEED_FLAG_KEY, '1')
  } catch {
    /* noop */
  }
}

export function taskTitle(taskId: string): string {
  return getDeliveryTaskById(taskId)?.title ?? taskId
}

export function buildExecutionTimeline(execution: Execution): Array<{
  id: string
  status: ExecutionStatus
  label: string
  at: string | null
  done: boolean
}> {
  const steps: ExecutionStatus[] = [
    'queued',
    'preparing',
    'running',
    'waiting_approval',
    'review',
    'completed',
  ]
  const order = steps.indexOf(
    execution.status === 'failed' || execution.status === 'cancelled'
      ? 'running'
      : execution.status,
  )

  return steps.map((status, index) => ({
    id: `${execution.id}-${status}`,
    status,
    label: status,
    at:
      index === 0
        ? execution.createdAt
        : index <= order
          ? execution.startedAt ?? execution.updatedAt
          : null,
    done: index <= order && execution.status !== 'failed' && execution.status !== 'cancelled',
  }))
}

export { STORAGE_KEY, loadDeliveryTasks }
