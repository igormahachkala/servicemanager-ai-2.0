/**
 * Demo seed — creates a real MAX work queue item via domain API (AI-COMPANY-108B).
 */

import { createEmployeeWorkItem, type WorkItem } from '../../domain/employeeWorkQueue'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import type { WorkPriority } from '../../domain/employeeWorkQueue'

export const MOBILE_DEMO_TASK = {
  title: 'Demo: краткий статус AI Company',
  taskText:
    'Дай Owner краткий статус AI Company (3–5 пунктов): очередь MAX, последний результат, что требует внимания. Без tool calls — только reasoning и отчёт.',
  expectedOutput: 'Краткий structured report для Owner demo.',
  priority: 'medium' as WorkPriority,
} as const

export function seedMobileDemoWorkItem(): WorkItem {
  return createEmployeeWorkItem({
    employeeId: MAX_WORKER_EMPLOYEE_ID,
    title: MOBILE_DEMO_TASK.title,
    taskText: MOBILE_DEMO_TASK.taskText,
    summary: MOBILE_DEMO_TASK.expectedOutput,
    priority: MOBILE_DEMO_TASK.priority,
  })
}
