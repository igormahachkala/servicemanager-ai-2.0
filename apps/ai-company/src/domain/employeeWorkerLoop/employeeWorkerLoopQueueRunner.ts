/**
 * Generic Employee Worker Loop — Work Queue bridge (AI-COMPANY-112G).
 */

import {
  assignEmployeeWorkItem,
  completeEmployeeWorkItem,
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
import { runEmployeeWorkerLoop } from './employeeWorkerLoopEngine'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'

export type EmployeeWorkQueueRunResult = {
  ok: boolean
  workItem: WorkItem | null
  loopId: string | null
  runtimeRunId: string | null
  errorMessage: string | null
}

export type EmployeeWorkQueueRunAllResult = {
  processed: number
  results: EmployeeWorkQueueRunResult[]
  stoppedEarly: boolean
}

async function runWorkerLoopForWorkItem(
  employeeId: string,
  item: WorkItem,
): Promise<EmployeeWorkQueueRunResult> {
  const taskText = item.taskText?.trim() || item.title
  const result = await runEmployeeWorkerLoop({
    employeeId,
    input: {
      taskText,
      title: item.title,
      projectId: item.projectId ?? AI_PHOTO_LAB_PROJECT_ID,
      workspaceId: item.workspaceId ?? AI_PHOTO_LAB_WORKSPACE_ID,
      priority: item.priority,
    },
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
    workItem: getUpdatedItem(employeeId, item.id),
    loopId: result.loop.id,
    runtimeRunId: result.loop.runtimeRunId,
    errorMessage: result.loop.errorMessage ?? `Worker Loop завершился: ${result.loop.status}`,
  }
}

function getUpdatedItem(employeeId: string, workItemId: string): WorkItem | null {
  return (
    listEmployeeWorkQueue(employeeId, { includeTerminal: true }).items.find(
      (item) => item.id === workItemId,
    ) ?? null
  )
}

export async function runEmployeeWorkQueueNextItem(
  employeeId: string,
): Promise<EmployeeWorkQueueRunResult> {
  const canonical = resolveCanonicalEmployeeId(employeeId)
  const queue = listEmployeeWorkQueue(canonical)

  if (queue.activeItem) {
    return {
      ok: false,
      workItem: queue.activeItem,
      loopId: queue.activeItem.workerLoopId,
      runtimeRunId: null,
      errorMessage: 'У сотрудника уже есть активная задача — завершите её перед следующей.',
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

  const started = startNextEmployeeWorkItem(canonical)
  if (!started) {
    return {
      ok: false,
      workItem: null,
      loopId: null,
      runtimeRunId: null,
      errorMessage: 'Не удалось взять следующую задачу из очереди.',
    }
  }

  return runWorkerLoopForWorkItem(canonical, started)
}

export async function runEmployeeWorkQueueAll(
  employeeId: string,
): Promise<EmployeeWorkQueueRunAllResult> {
  const canonical = resolveCanonicalEmployeeId(employeeId)
  const results: EmployeeWorkQueueRunResult[] = []
  let processed = 0

  while (true) {
    const queue = listEmployeeWorkQueue(canonical)
    if (queue.activeItem) break
    if (!pickNextWorkItem(queue.items)) break

    const result = await runEmployeeWorkQueueNextItem(canonical)
    results.push(result)
    if (!result.ok) {
      return { processed, results, stoppedEarly: true }
    }
    processed += 1
  }

  return { processed, results, stoppedEarly: false }
}
