/**
 * Autonomous Scheduler engine (AI-COMPANY-103B).
 * Manages queue order and launches Worker Loop — does not execute tasks itself.
 */

import { emitEvent } from '../events/eventStorage'
import { MAX_WORKER_EMPLOYEE_ID, runMaxWorkerLoopV1 } from '../maxWorkerLoop'
import { loadDeliveryTasks } from '../tasks/taskStorage'
import type { DeliveryTask } from '../tasks/task'
import {
  createAutonomousSchedulerQueueItemId,
  createAutonomousSchedulerSessionId,
  type AutonomousSchedulerQueueItem,
  type AutonomousSchedulerRunResult,
  type AutonomousSchedulerSession,
  type AutonomousSchedulerTaskPayload,
  type EnqueueAutonomousSchedulerTaskInput,
} from './autonomousScheduler'
import { selectNextAutonomousSchedulerItem } from './autonomousSchedulerPolicy'
import {
  getAutonomousSchedulerQueueItemById,
  getRunningAutonomousSchedulerSession,
  listAutonomousSchedulerQueueForEmployee,
  loadAutonomousSchedulerQueue,
  upsertAutonomousSchedulerQueueItem,
  upsertAutonomousSchedulerSession,
} from './autonomousSchedulerStorage'

export type RunAutonomousSchedulerInput = {
  employeeId: string
  /** Process only these queue item ids; default = all queued for employee. */
  queueItemIds?: string[]
  /** Stop session after first Worker Loop failure. Default: true (V1 safe). */
  stopOnFailure?: boolean
}

type WorkerLoopLaunchResult = {
  ok: boolean
  maxWorkerLoopId: string | null
  runtimeRunId: string | null
  errorMessage: string | null
}

function nowIso(): string {
  return new Date().toISOString()
}

function deliveryTaskToPayload(task: DeliveryTask): AutonomousSchedulerTaskPayload {
  return {
    taskText: task.description.trim() || task.title,
    title: task.title,
    projectId: task.projectId,
    workspaceId: task.workspaceId,
    priority: task.priority,
    expectedOutput: task.expectedOutput,
    sourceDeliveryTaskId: task.id,
  }
}

function normalizePayload(input: EnqueueAutonomousSchedulerTaskInput): {
  payload: AutonomousSchedulerTaskPayload
  priority: AutonomousSchedulerQueueItem['priority']
} {
  const priority = input.priority ?? 'medium'
  return {
    priority,
    payload: {
      taskText: input.taskText.trim(),
      title: input.title?.trim() || undefined,
      projectId: input.projectId,
      workspaceId: input.workspaceId,
      priority,
      expectedOutput: input.expectedOutput?.trim() || undefined,
      constraints: input.constraints?.trim() || undefined,
      mode: input.mode,
      modelMode: input.modelMode,
      sourceDeliveryTaskId: input.sourceDeliveryTaskId ?? null,
    },
  }
}

function emitSchedulerEvent(
  type: 'task.created' | 'task.completed' | 'runtime.failed',
  session: AutonomousSchedulerSession,
  item: AutonomousSchedulerQueueItem,
  message: string,
): void {
  emitEvent({
    type,
    sourceType: 'task',
    sourceId: item.id,
    employeeId: session.employeeId,
    workspaceId: item.payload.workspaceId,
    reportId: null,
    metadata: {
      title: item.payload.title ?? item.payload.taskText.slice(0, 80),
      message,
      sessionId: session.id,
      queueItemId: item.id,
      source: 'autonomous-scheduler',
    },
    severity: type === 'runtime.failed' ? 'warn' : 'info',
  })
}

async function launchWorkerLoopForEmployee(
  employeeId: string,
  payload: AutonomousSchedulerTaskPayload,
): Promise<WorkerLoopLaunchResult> {
  if (employeeId !== MAX_WORKER_EMPLOYEE_ID) {
    return {
      ok: false,
      maxWorkerLoopId: null,
      runtimeRunId: null,
      errorMessage: `V1 Autonomous Scheduler запускает Worker Loop только для ${MAX_WORKER_EMPLOYEE_ID}.`,
    }
  }

  const result = await runMaxWorkerLoopV1({
    taskText: payload.taskText,
    title: payload.title,
    projectId: payload.projectId,
    workspaceId: payload.workspaceId,
    priority: payload.priority,
    expectedOutput: payload.expectedOutput,
    constraints: payload.constraints,
    mode: payload.mode,
    modelMode: payload.modelMode,
  })

  if (result.loop.status === 'completed') {
    return {
      ok: true,
      maxWorkerLoopId: result.loop.id,
      runtimeRunId: result.loop.runtimeRunId,
      errorMessage: null,
    }
  }

  return {
    ok: false,
    maxWorkerLoopId: result.loop.id,
    runtimeRunId: result.loop.runtimeRunId,
    errorMessage: result.loop.errorMessage ?? `Worker Loop status: ${result.loop.status}`,
  }
}

function patchQueueItem(
  item: AutonomousSchedulerQueueItem,
  patch: Partial<AutonomousSchedulerQueueItem>,
): AutonomousSchedulerQueueItem {
  return upsertAutonomousSchedulerQueueItem({ ...item, ...patch })
}

function patchSession(
  session: AutonomousSchedulerSession,
  patch: Partial<AutonomousSchedulerSession>,
): AutonomousSchedulerSession {
  const updated = {
    ...session,
    ...patch,
    updatedAt: nowIso(),
  }
  return upsertAutonomousSchedulerSession(updated)
}

/** Enqueue one or more tasks for an employee. */
export function enqueueAutonomousSchedulerTasks(
  employeeId: string,
  tasks: EnqueueAutonomousSchedulerTaskInput[],
): AutonomousSchedulerQueueItem[] {
  const existing = loadAutonomousSchedulerQueue()
  const baseOrder = existing.filter((item) => item.employeeId === employeeId).length
  const now = nowIso()

  return tasks.map((task, index) => {
    const { payload, priority } = normalizePayload(task)
    const item: AutonomousSchedulerQueueItem = {
      id: createAutonomousSchedulerQueueItemId(),
      version: 'v1',
      employeeId,
      sessionId: null,
      payload,
      priority,
      status: 'queued',
      selectionReason: null,
      enqueuedAt: now,
      selectedAt: null,
      startedAt: null,
      finishedAt: null,
      maxWorkerLoopId: null,
      runtimeRunId: null,
      errorMessage: null,
      sortOrder: task.sortOrder ?? baseOrder + index,
    }
    return upsertAutonomousSchedulerQueueItem(item)
  })
}

/** Build queue items from Delivery Task backlog (backlog + in_progress). */
export function enqueueAutonomousSchedulerFromDeliveryTasks(
  employeeId: string,
): AutonomousSchedulerQueueItem[] {
  const tasks = loadDeliveryTasks().filter(
    (task) =>
      task.assigneeId === employeeId &&
      (task.status === 'backlog' || task.status === 'in_progress'),
  )

  const alreadyQueued = new Set(
    loadAutonomousSchedulerQueue()
      .filter((item) => item.employeeId === employeeId && item.status === 'queued')
      .map((item) => item.payload.sourceDeliveryTaskId)
      .filter((id): id is string => Boolean(id)),
  )

  const toEnqueue = tasks
    .filter((task) => !alreadyQueued.has(task.id))
    .map((task) => ({
      ...deliveryTaskToPayload(task),
      priority: task.priority,
    }))

  return enqueueAutonomousSchedulerTasks(employeeId, toEnqueue)
}

/** Read employee queue — default: queued items only. */
export function getAutonomousSchedulerQueue(
  employeeId: string,
  options?: { includeNonQueued?: boolean },
): AutonomousSchedulerQueueItem[] {
  if (options?.includeNonQueued) {
    return listAutonomousSchedulerQueueForEmployee(employeeId)
  }
  return listAutonomousSchedulerQueueForEmployee(employeeId, { statuses: ['queued'] })
}

/**
 * Run scheduler session: pick next → Worker Loop → repeat until queue empty.
 * Scheduler never executes reasoning — only order + launch.
 */
export async function runAutonomousSchedulerSession(
  input: RunAutonomousSchedulerInput,
): Promise<AutonomousSchedulerRunResult> {
  const stopOnFailure = input.stopOnFailure !== false

  const running = getRunningAutonomousSchedulerSession(input.employeeId)
  if (running) {
    throw new Error(
      `Autonomous Scheduler уже выполняется для ${input.employeeId} (session ${running.id}).`,
    )
  }

  let queued = getAutonomousSchedulerQueue(input.employeeId)
  if (input.queueItemIds?.length) {
    const allowed = new Set(input.queueItemIds)
    queued = queued.filter((item) => allowed.has(item.id))
  }

  if (queued.length === 0) {
    const idleSession: AutonomousSchedulerSession = upsertAutonomousSchedulerSession({
      id: createAutonomousSchedulerSessionId(),
      version: 'v1',
      employeeId: input.employeeId,
      status: 'completed',
      selectionPolicyId: 'priority_fifo',
      currentQueueItemId: null,
      queueItemIds: [],
      completedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      finishedAt: nowIso(),
      lastErrorMessage: null,
    })
    return {
      session: idleSession,
      processedItems: [],
      remainingQueuedCount: 0,
    }
  }

  let session = upsertAutonomousSchedulerSession({
    id: createAutonomousSchedulerSessionId(),
    version: 'v1',
    employeeId: input.employeeId,
    status: 'running',
    selectionPolicyId: 'priority_fifo',
    currentQueueItemId: null,
    queueItemIds: queued.map((item) => item.id),
    completedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    finishedAt: null,
    lastErrorMessage: null,
  })

  const processedItems: AutonomousSchedulerQueueItem[] = []

  for (const item of queued) {
    patchQueueItem(getAutonomousSchedulerQueueItemById(item.id) ?? item, {
      sessionId: session.id,
    })
  }

  while (true) {
    const pending = listAutonomousSchedulerQueueForEmployee(input.employeeId, {
      sessionId: session.id,
      statuses: ['queued'],
    })
    const selection = selectNextAutonomousSchedulerItem(pending, session.selectionPolicyId)
    if (!selection) break

    const selectedAt = nowIso()
    let current = patchQueueItem(selection.item, {
      status: 'selected',
      selectionReason: selection.reason,
      selectedAt,
      sessionId: session.id,
    })

    session = patchSession(session, {
      currentQueueItemId: current.id,
    })

    emitSchedulerEvent(
      'task.created',
      session,
      current,
      `Scheduler выбрал задачу: ${selection.reason}`,
    )

    const startedAt = nowIso()
    current = patchQueueItem(current, {
      status: 'running',
      startedAt,
    })

    const launch = await launchWorkerLoopForEmployee(input.employeeId, current.payload)
    const finishedAt = nowIso()

    if (launch.ok) {
      current = patchQueueItem(current, {
        status: 'completed',
        finishedAt,
        maxWorkerLoopId: launch.maxWorkerLoopId,
        runtimeRunId: launch.runtimeRunId,
        errorMessage: null,
      })
      session = patchSession(session, {
        completedCount: session.completedCount + 1,
        currentQueueItemId: null,
      })
      emitSchedulerEvent(
        'task.completed',
        session,
        current,
        'Worker Loop завершён — Scheduler берёт следующую задачу.',
      )
    } else {
      current = patchQueueItem(current, {
        status: 'failed',
        finishedAt,
        maxWorkerLoopId: launch.maxWorkerLoopId,
        runtimeRunId: launch.runtimeRunId,
        errorMessage: launch.errorMessage,
      })
      session = patchSession(session, {
        failedCount: session.failedCount + 1,
        currentQueueItemId: null,
        lastErrorMessage: launch.errorMessage,
      })
      emitSchedulerEvent(
        'runtime.failed',
        session,
        current,
        launch.errorMessage ?? 'Worker Loop failed',
      )

      processedItems.push(current)

      if (stopOnFailure) {
        session = patchSession(session, {
          status: 'failed',
          finishedAt: nowIso(),
        })
        return {
          session,
          processedItems,
          remainingQueuedCount: listAutonomousSchedulerQueueForEmployee(input.employeeId, {
            statuses: ['queued'],
          }).length,
        }
      }
      continue
    }

    processedItems.push(current)
  }

  session = patchSession(session, {
    status: 'completed',
    finishedAt: nowIso(),
    currentQueueItemId: null,
  })

  return {
    session,
    processedItems,
    remainingQueuedCount: listAutonomousSchedulerQueueForEmployee(input.employeeId, {
      statuses: ['queued'],
    }).length,
  }
}

export {
  getAutonomousSchedulerQueueItemById,
  getAutonomousSchedulerSessionById,
  getRunningAutonomousSchedulerSession,
  listAutonomousSchedulerQueueForEmployee,
  loadAutonomousSchedulerQueue,
  loadAutonomousSchedulerSessions,
} from './autonomousSchedulerStorage'

export { selectNextAutonomousSchedulerItem, sortAutonomousSchedulerQueue } from './autonomousSchedulerPolicy'
