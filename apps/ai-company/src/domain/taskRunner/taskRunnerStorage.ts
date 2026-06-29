import type { DeliveryTaskPriority } from '../tasks/task'
import type { TaskRunnerMode } from './taskRunnerTemplates'

const STORAGE_KEY = 'ai-company-task-runner-history'

export type TaskRunnerStatus =
  | 'running'
  | 'completed'
  | 'failed'
  | 'waiting_approval'
  | 'cancelled'

export type TaskRunnerRecord = {
  id: string
  title: string
  taskText: string
  mode: TaskRunnerMode
  employeeId: string
  projectId: string
  workspaceId: string
  priority: DeliveryTaskPriority
  expectedOutput: string
  constraints: string
  deliveryTaskId: string
  executionId: string | null
  runtimeRunId: string
  reportId: string | null
  status: TaskRunnerStatus
  createdAt: string
  finishedAt: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStatus(value: unknown): TaskRunnerStatus {
  const statuses: TaskRunnerStatus[] = [
    'running',
    'completed',
    'failed',
    'waiting_approval',
    'cancelled',
  ]
  return typeof value === 'string' && statuses.includes(value as TaskRunnerStatus)
    ? (value as TaskRunnerStatus)
    : 'running'
}

function parsePriority(value: unknown): DeliveryTaskPriority {
  const priorities: DeliveryTaskPriority[] = ['low', 'medium', 'high', 'critical']
  return typeof value === 'string' && priorities.includes(value as DeliveryTaskPriority)
    ? (value as DeliveryTaskPriority)
    : 'medium'
}

function parseMode(value: unknown): TaskRunnerMode {
  const modes: TaskRunnerMode[] = [
    'planning',
    'architecture',
    'technical_audit',
    'qa_review',
    'devops_plan',
    'handoff_preparation',
    'documentation',
    'product_review',
  ]
  return typeof value === 'string' && modes.includes(value as TaskRunnerMode)
    ? (value as TaskRunnerMode)
    : 'planning'
}

export function parseTaskRunnerRecord(value: unknown): TaskRunnerRecord | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.taskText !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.projectId !== 'string' ||
    typeof value.workspaceId !== 'string' ||
    typeof value.deliveryTaskId !== 'string' ||
    typeof value.runtimeRunId !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    title: value.title,
    taskText: value.taskText,
    mode: parseMode(value.mode),
    employeeId: value.employeeId,
    projectId: value.projectId,
    workspaceId: value.workspaceId,
    priority: parsePriority(value.priority),
    expectedOutput: typeof value.expectedOutput === 'string' ? value.expectedOutput : '',
    constraints: typeof value.constraints === 'string' ? value.constraints : '',
    deliveryTaskId: value.deliveryTaskId,
    executionId: typeof value.executionId === 'string' ? value.executionId : null,
    runtimeRunId: value.runtimeRunId,
    reportId: typeof value.reportId === 'string' ? value.reportId : null,
    status: parseStatus(value.status),
    createdAt: value.createdAt,
    finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : null,
  }
}

export function loadTaskRunnerHistory(): TaskRunnerRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(parseTaskRunnerRecord)
      .filter((item): item is TaskRunnerRecord => item !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch {
    return []
  }
}

export function saveTaskRunnerHistory(items: TaskRunnerRecord[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* noop */
  }
}

export function appendTaskRunnerRecord(record: TaskRunnerRecord): TaskRunnerRecord {
  saveTaskRunnerHistory([record, ...loadTaskRunnerHistory().filter((item) => item.id !== record.id)])
  return record
}

export function getTaskRunnerRecordByRunId(runtimeRunId: string): TaskRunnerRecord | null {
  return loadTaskRunnerHistory().find((item) => item.runtimeRunId === runtimeRunId) ?? null
}

export { STORAGE_KEY }
