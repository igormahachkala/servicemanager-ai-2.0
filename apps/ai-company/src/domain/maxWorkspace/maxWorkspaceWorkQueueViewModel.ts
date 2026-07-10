/**
 * MAX Workspace — Employee Work Queue view model (AI-COMPANY-103D-1).
 */

import {
  listEmployeeWorkQueue,
  pickNextWorkItem,
  type EmployeeWorkQueue,
  type WorkItem,
  type WorkPriority,
  type WorkStatus,
} from '../employeeWorkQueue'
import { MAX_WORKER_EMPLOYEE_ID } from '../maxWorkerLoop'

export type MaxWorkspaceWorkQueueItemView = {
  id: string
  title: string
  summary: string | null
  priority: WorkPriority
  status: WorkStatus
  scheduledAt: string | null
  startedAt: string | null
  completedAt: string | null
  blockedReason: string | null
  workerLoopId: string | null
  queuePosition: number
  isActive: boolean
}

export type MaxWorkspaceWorkQueueSuggestedAction = {
  kind: 'empty' | 'start_next' | 'wait_active' | 'wait_scheduled' | 'blocked' | 'run_all'
  title: string
  detail: string | null
  targetWorkItemId: string | null
}

export type MaxWorkspaceWorkQueueView = {
  employeeId: string
  isEmpty: boolean
  pendingCount: number
  blockedCount: number
  activeItem: MaxWorkspaceWorkQueueItemView | null
  pendingItems: MaxWorkspaceWorkQueueItemView[]
  nextSuggestedAction: MaxWorkspaceWorkQueueSuggestedAction
  updatedAt: string
}

function mapWorkItem(item: WorkItem, activeItemId: string | null): MaxWorkspaceWorkQueueItemView {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    priority: item.priority,
    status: item.status,
    scheduledAt: item.scheduledAt,
    startedAt: item.startedAt,
    completedAt: item.completedAt,
    blockedReason: item.blockedReason,
    workerLoopId: item.workerLoopId,
    queuePosition: item.queuePosition,
    isActive: item.id === activeItemId,
  }
}

function resolveNextSuggestedAction(queue: EmployeeWorkQueue): MaxWorkspaceWorkQueueSuggestedAction {
  if (queue.activeItem) {
    return {
      kind: 'wait_active',
      title: `Сначала завершите текущую задачу: «${queue.activeItem.title}»`,
      detail: queue.activeItem.startedAt
        ? `В работе с ${new Date(queue.activeItem.startedAt).toLocaleString('ru-RU')}`
        : 'Задача уже в работе — дождитесь Worker Loop или завершите item.',
      targetWorkItemId: queue.activeItem.id,
    }
  }

  if (queue.blockedCount > 0) {
    const blocked = queue.items.find((item) => item.status === 'blocked')
    return {
      kind: 'blocked',
      title: 'Разблокируйте задачи перед запуском очереди',
      detail: blocked?.blockedReason ?? `${queue.blockedCount} заблокированных задач`,
      targetWorkItemId: blocked?.id ?? null,
    }
  }

  const next = pickNextWorkItem(queue.items)
  if (!next) {
    return {
      kind: 'empty',
      title: 'Добавьте задачу в очередь или запустите Run Task',
      detail: null,
      targetWorkItemId: null,
    }
  }

  if (next.status === 'scheduled' && next.scheduledAt) {
    const at = Date.parse(next.scheduledAt)
    if (!Number.isNaN(at) && at > Date.now()) {
      return {
        kind: 'wait_scheduled',
        title: `Следующая задача запланирована: «${next.title}»`,
        detail: new Date(next.scheduledAt).toLocaleString('ru-RU'),
        targetWorkItemId: next.id,
      }
    }
  }

  if (queue.pendingCount > 1) {
    return {
      kind: 'run_all',
      title: `Запустить следующую: «${next.title}»`,
      detail: `В очереди ${queue.pendingCount} задач — можно запустить всю очередь подряд.`,
      targetWorkItemId: next.id,
    }
  }

  return {
    kind: 'start_next',
    title: `Запустить: «${next.title}»`,
    detail: next.summary ?? next.taskText?.slice(0, 160) ?? null,
    targetWorkItemId: next.id,
  }
}

export function buildMaxWorkspaceWorkQueueView(
  employeeId: string = MAX_WORKER_EMPLOYEE_ID,
): MaxWorkspaceWorkQueueView {
  const queue = listEmployeeWorkQueue(employeeId)
  const activeId = queue.activeItem?.id ?? null
  const pendingItems = queue.items
    .filter((item) => item.status !== 'in_progress')
    .map((item) => mapWorkItem(item, activeId))

  return {
    employeeId,
    isEmpty: queue.items.length === 0,
    pendingCount: queue.pendingCount,
    blockedCount: queue.blockedCount,
    activeItem: queue.activeItem ? mapWorkItem(queue.activeItem, activeId) : null,
    pendingItems,
    nextSuggestedAction: resolveNextSuggestedAction(queue),
    updatedAt: queue.updatedAt,
  }
}
