import { AI_PHOTO_LAB_PROJECT_ID, AI_PHOTO_LAB_WORKSPACE_ID } from '../projects/aiPhotoLabIds'
import { loadDeliveryTasks } from '../tasks/taskStorage'
import type { Execution } from './execution'
import {
  isExecutionsSeeded,
  loadExecutions,
  markExecutionsSeeded,
  upsertExecutions,
} from './executionEngine'

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600000).toISOString()
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60000).toISOString()
}

const RUNTIME_BY_TASK: Record<string, string> = {
  'task-apl-002': 'run-apl-devops-deploy-checklist',
  'task-apl-005': 'run-apl-max-code-audit',
  'task-apl-010': 'run-apl-qa-checklist',
  'task-apl-011': 'run-apl-devops-deploy-checklist',
  'task-apl-013': 'run-apl-atlas-arch-review',
}

const STATUS_BY_TASK: Record<string, Execution['status']> = {
  'task-apl-001': 'preparing',
  'task-apl-002': 'running',
  'task-apl-003': 'queued',
  'task-apl-004': 'queued',
  'task-apl-005': 'running',
  'task-apl-006': 'queued',
  'task-apl-007': 'queued',
  'task-apl-008': 'queued',
  'task-apl-009': 'queued',
  'task-apl-010': 'review',
  'task-apl-011': 'waiting_approval',
  'task-apl-012': 'queued',
  'task-apl-013': 'review',
}

function buildSeedExecution(task: ReturnType<typeof loadDeliveryTasks>[number], index: number): Execution {
  const status = STATUS_BY_TASK[task.id] ?? 'queued'
  const now = new Date().toISOString()
  const started = status === 'queued' ? null : minutesAgo(30 + index * 5)

  return {
    id: `exec-${task.id}`,
    employeeId: task.assigneeId,
    projectId: task.projectId,
    workspaceId: task.workspaceId,
    taskId: task.id,
    runtimeRunId: RUNTIME_BY_TASK[task.id] ?? null,
    status,
    priority: task.priority,
    queuePosition: status === 'queued' ? index + 1 : 0,
    startedAt: started,
    finishedAt: null,
    estimatedDuration: task.priority === 'critical' ? 45 : task.priority === 'high' ? 90 : 120,
    createdAt: hoursAgo(8),
    updatedAt: now,
  }
}

/** Seed executions from delivery tasks — connects tasks to runtime runs. */
export function ensureSeedExecutions(): Execution[] {
  const photoLabTasks = loadDeliveryTasks().filter(
    (item) => item.projectId === AI_PHOTO_LAB_PROJECT_ID,
  )

  if (photoLabTasks.length > 0) {
    let queueIndex = 0
    const seeds = photoLabTasks.map((task) => {
      const status = STATUS_BY_TASK[task.id] ?? 'queued'
      return buildSeedExecution(task, status === 'queued' ? queueIndex++ : 0)
    })
    upsertExecutions(seeds)
  }

  if (!isExecutionsSeeded()) {
    const completed: Execution = {
      id: 'exec-apl-completed-demo',
      employeeId: 'ag-qa',
      projectId: AI_PHOTO_LAB_PROJECT_ID,
      workspaceId: AI_PHOTO_LAB_WORKSPACE_ID,
      taskId: 'task-apl-demo-complete',
      runtimeRunId: 'run-apl-qa-checklist',
      status: 'completed',
      priority: 'high',
      queuePosition: 0,
      startedAt: hoursAgo(6),
      finishedAt: hoursAgo(4),
      estimatedDuration: 60,
      createdAt: hoursAgo(8),
      updatedAt: hoursAgo(4),
    }
    upsertExecutions([completed])
    markExecutionsSeeded()
  }

  return loadExecutions()
}
