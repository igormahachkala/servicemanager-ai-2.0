/**
 * Autonomous Scheduler V1 — queue + session model for digital employees (AI-COMPANY-103B).
 * Scheduler manages work order only; Worker Loop executes tasks.
 */

import type { MaxWorkerLoopInput } from '../maxWorkerLoop'

export const AUTONOMOUS_SCHEDULER_VERSION = 'v1' as const

export const AUTONOMOUS_SCHEDULER_SELECTION_POLICIES = ['priority_fifo'] as const

export type AutonomousSchedulerSelectionPolicyId =
  (typeof AUTONOMOUS_SCHEDULER_SELECTION_POLICIES)[number]

export const AUTONOMOUS_SCHEDULER_QUEUE_STATUSES = [
  'queued',
  'selected',
  'running',
  'completed',
  'failed',
  'skipped',
  'cancelled',
] as const

export type AutonomousSchedulerQueueStatus = (typeof AUTONOMOUS_SCHEDULER_QUEUE_STATUSES)[number]

export const AUTONOMOUS_SCHEDULER_SESSION_STATUSES = [
  'idle',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const

export type AutonomousSchedulerSessionStatus =
  (typeof AUTONOMOUS_SCHEDULER_SESSION_STATUSES)[number]

/** Task payload enqueued for Worker Loop — aligned with MaxWorkerLoopInput. */
export type AutonomousSchedulerTaskPayload = Pick<
  MaxWorkerLoopInput,
  | 'taskText'
  | 'title'
  | 'projectId'
  | 'workspaceId'
  | 'priority'
  | 'expectedOutput'
  | 'constraints'
  | 'mode'
  | 'modelMode'
> & {
  /** Optional link to Delivery Task backlog item. */
  sourceDeliveryTaskId?: string | null
}

export type AutonomousSchedulerQueueItem = {
  id: string
  version: typeof AUTONOMOUS_SCHEDULER_VERSION
  employeeId: string
  sessionId: string | null
  payload: AutonomousSchedulerTaskPayload
  priority: NonNullable<AutonomousSchedulerTaskPayload['priority']>
  status: AutonomousSchedulerQueueStatus
  selectionReason: string | null
  enqueuedAt: string
  selectedAt: string | null
  startedAt: string | null
  finishedAt: string | null
  maxWorkerLoopId: string | null
  runtimeRunId: string | null
  errorMessage: string | null
  sortOrder: number
}

export type AutonomousSchedulerSession = {
  id: string
  version: typeof AUTONOMOUS_SCHEDULER_VERSION
  employeeId: string
  status: AutonomousSchedulerSessionStatus
  selectionPolicyId: AutonomousSchedulerSelectionPolicyId
  currentQueueItemId: string | null
  queueItemIds: string[]
  completedCount: number
  failedCount: number
  skippedCount: number
  createdAt: string
  updatedAt: string
  finishedAt: string | null
  lastErrorMessage: string | null
}

export type AutonomousSchedulerSelection = {
  item: AutonomousSchedulerQueueItem
  reason: string
}

export type EnqueueAutonomousSchedulerTaskInput = AutonomousSchedulerTaskPayload & {
  priority?: AutonomousSchedulerQueueItem['priority']
  sortOrder?: number
}

export type AutonomousSchedulerRunResult = {
  session: AutonomousSchedulerSession
  processedItems: AutonomousSchedulerQueueItem[]
  remainingQueuedCount: number
}

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parsePriority(value: unknown): AutonomousSchedulerQueueItem['priority'] {
  if (typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value)) {
    return value as AutonomousSchedulerQueueItem['priority']
  }
  return 'medium'
}

function parseQueueStatus(value: unknown): AutonomousSchedulerQueueStatus {
  if (
    typeof value === 'string' &&
    (AUTONOMOUS_SCHEDULER_QUEUE_STATUSES as readonly string[]).includes(value)
  ) {
    return value as AutonomousSchedulerQueueStatus
  }
  return 'queued'
}

function parseSessionStatus(value: unknown): AutonomousSchedulerSessionStatus {
  if (
    typeof value === 'string' &&
    (AUTONOMOUS_SCHEDULER_SESSION_STATUSES as readonly string[]).includes(value)
  ) {
    return value as AutonomousSchedulerSessionStatus
  }
  return 'idle'
}

function parsePayload(value: unknown): AutonomousSchedulerTaskPayload | null {
  if (!isRecord(value) || typeof value.taskText !== 'string') return null
  if (typeof value.projectId !== 'string' || typeof value.workspaceId !== 'string') return null
  return {
    taskText: value.taskText,
    title: typeof value.title === 'string' ? value.title : undefined,
    projectId: value.projectId,
    workspaceId: value.workspaceId,
    priority: parsePriority(value.priority),
    expectedOutput: typeof value.expectedOutput === 'string' ? value.expectedOutput : undefined,
    constraints: typeof value.constraints === 'string' ? value.constraints : undefined,
    mode:
      value.mode === 'technical_audit' ||
      value.mode === 'handoff_preparation' ||
      value.mode === 'documentation'
        ? value.mode
        : undefined,
    modelMode:
      value.modelMode === 'coding' || value.modelMode === 'deep' || value.modelMode === 'fast'
        ? value.modelMode
        : undefined,
    sourceDeliveryTaskId:
      typeof value.sourceDeliveryTaskId === 'string' ? value.sourceDeliveryTaskId : null,
  }
}

export function parseAutonomousSchedulerQueueItem(value: unknown): AutonomousSchedulerQueueItem | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.employeeId !== 'string') return null
  const payload = parsePayload(value.payload)
  if (!payload) return null

  return {
    id: value.id,
    version: AUTONOMOUS_SCHEDULER_VERSION,
    employeeId: value.employeeId,
    sessionId: typeof value.sessionId === 'string' ? value.sessionId : null,
    payload,
    priority: parsePriority(value.priority),
    status: parseQueueStatus(value.status),
    selectionReason: typeof value.selectionReason === 'string' ? value.selectionReason : null,
    enqueuedAt: typeof value.enqueuedAt === 'string' ? value.enqueuedAt : new Date().toISOString(),
    selectedAt: typeof value.selectedAt === 'string' ? value.selectedAt : null,
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : null,
    finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : null,
    maxWorkerLoopId: typeof value.maxWorkerLoopId === 'string' ? value.maxWorkerLoopId : null,
    runtimeRunId: typeof value.runtimeRunId === 'string' ? value.runtimeRunId : null,
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
    sortOrder: typeof value.sortOrder === 'number' ? value.sortOrder : 0,
  }
}

export function parseAutonomousSchedulerSession(value: unknown): AutonomousSchedulerSession | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.employeeId !== 'string') return null
  const queueItemIds = Array.isArray(value.queueItemIds)
    ? value.queueItemIds.filter((item): item is string => typeof item === 'string')
    : []

  const policy =
    typeof value.selectionPolicyId === 'string' &&
    (AUTONOMOUS_SCHEDULER_SELECTION_POLICIES as readonly string[]).includes(value.selectionPolicyId)
      ? (value.selectionPolicyId as AutonomousSchedulerSelectionPolicyId)
      : 'priority_fifo'

  return {
    id: value.id,
    version: AUTONOMOUS_SCHEDULER_VERSION,
    employeeId: value.employeeId,
    status: parseSessionStatus(value.status),
    selectionPolicyId: policy,
    currentQueueItemId:
      typeof value.currentQueueItemId === 'string' ? value.currentQueueItemId : null,
    queueItemIds,
    completedCount: typeof value.completedCount === 'number' ? value.completedCount : 0,
    failedCount: typeof value.failedCount === 'number' ? value.failedCount : 0,
    skippedCount: typeof value.skippedCount === 'number' ? value.skippedCount : 0,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : null,
    lastErrorMessage: typeof value.lastErrorMessage === 'string' ? value.lastErrorMessage : null,
  }
}

export function createAutonomousSchedulerQueueItemId(): string {
  return `asq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function createAutonomousSchedulerSessionId(): string {
  return `ass-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}
