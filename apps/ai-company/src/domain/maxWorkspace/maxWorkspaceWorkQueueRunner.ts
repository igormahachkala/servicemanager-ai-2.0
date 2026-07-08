/**
 * MAX Workspace — Employee Work Queue actions (AI-COMPANY-103D-1).
 * Bridges Work Queue → MAX Worker Loop without Runtime orchestrator changes.
 */

import {
  assignEmployeeWorkItem,
  completeEmployeeWorkItem,
  createEmployeeWorkItem,
  listEmployeeWorkQueue,
  pickNextWorkItem,
  skipEmployeeWorkItem,
  startNextEmployeeWorkItem,
  type WorkItem,
} from '../employeeWorkQueue'
import {
  AI_PHOTO_LAB_PROJECT_ID,
  AI_PHOTO_LAB_WORKSPACE_ID,
} from '../projects/aiPhotoLabIds'
import { MAX_WORKER_EMPLOYEE_ID, runMaxWorkerLoopV1 } from '../maxWorkerLoop'

export type MaxWorkQueueRunResult = {
  ok: boolean
  workItem: WorkItem | null
  loopId: string | null
  runtimeRunId: string | null
  errorMessage: string | null
}

export type MaxWorkQueueRunAllResult = {
  processed: number
  results: MaxWorkQueueRunResult[]
  stoppedEarly: boolean
}

const TEST_WORK_ITEM = {
  title: 'Тест · архитектурный обзор очереди MAX',
  taskText:
    'Проверить архитектуру Employee Work Queue и интеграцию с MAX Worker Loop: domain-границы, consult_peer, multi-tenant invariants.',
  summary: 'Demo-задача для ручной проверки очереди на рабочем месте MAX.',
  priority: 'high' as const,
}

export function seedMaxEmployeeTestWorkItem(): WorkItem {
  return createEmployeeWorkItem({
    employeeId: MAX_WORKER_EMPLOYEE_ID,
    title: TEST_WORK_ITEM.title,
    taskText: TEST_WORK_ITEM.taskText,
    summary: TEST_WORK_ITEM.summary,
    priority: TEST_WORK_ITEM.priority,
    projectId: AI_PHOTO_LAB_PROJECT_ID,
    workspaceId: AI_PHOTO_LAB_WORKSPACE_ID,
  })
}

async function runWorkerLoopForWorkItem(item: WorkItem): Promise<MaxWorkQueueRunResult> {
  const taskText = item.taskText?.trim() || item.title
  const result = await runMaxWorkerLoopV1({
    taskText,
    title: item.title,
    projectId: item.projectId ?? AI_PHOTO_LAB_PROJECT_ID,
    workspaceId: item.workspaceId ?? AI_PHOTO_LAB_WORKSPACE_ID,
    priority: item.priority,
  })

  assignEmployeeWorkItem({
    workItemId: item.id,
    workerLoopId: result.loop.id,
    decisionPlanId: result.loop.decisionPlan?.id ?? null,
  })

  if (result.loop.status === 'completed') {
    const completed = completeEmployeeWorkItem({
      workItemId: item.id,
      completedAt: result.loop.finishedAt ?? new Date().toISOString(),
    })
    return {
      ok: true,
      workItem: completed,
      loopId: result.loop.id,
      runtimeRunId: result.loop.runtimeRunId,
      errorMessage: null,
    }
  }

  skipEmployeeWorkItem({
    workItemId: item.id,
    reason: result.loop.errorMessage ?? `Worker Loop: ${result.loop.status}`,
  })

  return {
    ok: false,
    workItem: getUpdatedItem(item.id),
    loopId: result.loop.id,
    runtimeRunId: result.loop.runtimeRunId,
    errorMessage: result.loop.errorMessage ?? `Worker Loop завершился: ${result.loop.status}`,
  }
}

function getUpdatedItem(workItemId: string): WorkItem | null {
  return listEmployeeWorkQueue(MAX_WORKER_EMPLOYEE_ID, { includeTerminal: true }).items.find(
    (item) => item.id === workItemId,
  ) ?? null
}

export async function runMaxEmployeeWorkQueueNextItem(): Promise<MaxWorkQueueRunResult> {
  const queue = listEmployeeWorkQueue(MAX_WORKER_EMPLOYEE_ID)
  if (queue.activeItem) {
    return {
      ok: false,
      workItem: queue.activeItem,
      loopId: queue.activeItem.workerLoopId,
      runtimeRunId: null,
      errorMessage: 'У MAX уже есть активная задача — завершите её перед следующей.',
    }
  }

  const nextPending = pickNextWorkItem(queue.items)
  if (!nextPending) {
    return {
      ok: false,
      workItem: null,
      loopId: null,
      runtimeRunId: null,
      errorMessage: 'Очередь пуста — добавьте задачу.',
    }
  }

  const started = startNextEmployeeWorkItem(MAX_WORKER_EMPLOYEE_ID)
  if (!started) {
    return {
      ok: false,
      workItem: null,
      loopId: null,
      runtimeRunId: null,
      errorMessage: 'Не удалось взять следующую задачу из очереди.',
    }
  }

  return runWorkerLoopForWorkItem(started)
}

export async function runMaxEmployeeWorkQueueAll(): Promise<MaxWorkQueueRunAllResult> {
  const results: MaxWorkQueueRunResult[] = []
  let processed = 0

  while (true) {
    const queue = listEmployeeWorkQueue(MAX_WORKER_EMPLOYEE_ID)
    if (queue.activeItem) break
    if (!pickNextWorkItem(queue.items)) break

    const result = await runMaxEmployeeWorkQueueNextItem()
    results.push(result)
    if (!result.ok) {
      return { processed, results, stoppedEarly: true }
    }
    processed += 1
  }

  return { processed, results, stoppedEarly: false }
}
