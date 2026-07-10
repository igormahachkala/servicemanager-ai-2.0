/**
 * MAX Workspace — Employee Work Queue actions (AI-COMPANY-103D-1).
 * Bridges Work Queue → Worker Loop without Runtime orchestrator changes.
 * MAX-specific wrappers delegate to generic employee queue runner (112G).
 */

import { createEmployeeWorkItem, type WorkItem } from '../employeeWorkQueue'
import {
  AI_PHOTO_LAB_PROJECT_ID,
  AI_PHOTO_LAB_WORKSPACE_ID,
} from '../projects/aiPhotoLabIds'
import { MAX_WORKER_EMPLOYEE_ID } from '../maxWorkerLoop'
import {
  runEmployeeWorkQueueAll,
  runEmployeeWorkQueueNextItem,
  type EmployeeWorkQueueRunAllResult,
  type EmployeeWorkQueueRunResult,
} from '../employeeWorkerLoop'

export type MaxWorkQueueRunResult = EmployeeWorkQueueRunResult
export type MaxWorkQueueRunAllResult = EmployeeWorkQueueRunAllResult

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

export async function runMaxEmployeeWorkQueueNextItem(): Promise<MaxWorkQueueRunResult> {
  return runEmployeeWorkQueueNextItem(MAX_WORKER_EMPLOYEE_ID)
}

export async function runMaxEmployeeWorkQueueAll(): Promise<MaxWorkQueueRunAllResult> {
  return runEmployeeWorkQueueAll(MAX_WORKER_EMPLOYEE_ID)
}
