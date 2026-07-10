/**
 * Employee Work Queue V1 — per-employee task queue (AI-COMPANY-103A).
 *
 * Not Runtime Queue. Not browser Execution queue.
 * Each digital employee owns an ordered WorkItem queue in localStorage V1.
 */

import { DEFAULT_COMPANY_ID } from '../company/company'
import {
  parseWorkItemStructuredPayload,
  type WorkItemStructuredPayload,
} from './workItemStructuredPayload'

export type { WorkItemStructuredPayload, WorkItemTaskMode } from './workItemStructuredPayload'

export const EMPLOYEE_WORK_QUEUE_VERSION = 'v1' as const

export type EmployeeWorkQueueVersion = typeof EMPLOYEE_WORK_QUEUE_VERSION

export const WORK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

export type WorkPriority = (typeof WORK_PRIORITIES)[number]

export const WORK_ITEM_SOURCES = ['manual', 'chat', 'delegation'] as const

export type WorkItemSource = (typeof WORK_ITEM_SOURCES)[number]

export const WORK_STATUSES = [
  'pending',
  'scheduled',
  'in_progress',
  'blocked',
  'completed',
  'skipped',
  'cancelled',
] as const

export type WorkStatus = (typeof WORK_STATUSES)[number]

/** Who currently owns execution of the work item (employee, not Runtime worker). */
export type WorkItemCurrentOwner = {
  employeeId: string
  displayName: string | null
}

export type WorkItem = {
  id: string
  version: EmployeeWorkQueueVersion
  companyId: string
  /** Queue owner — canonical employee id (ag-max, ag-cto, …). */
  employeeId: string
  title: string
  summary: string | null
  taskText: string | null
  projectId: string | null
  workspaceId: string | null
  deliveryTaskId: string | null
  workerLoopId: string | null
  decisionPlanId: string | null
  /** Origin of the queue item — delegation bridge sets `delegation`. */
  source: WorkItemSource | null
  delegationPlanId: string | null
  priority: WorkPriority
  status: WorkStatus
  scheduledAt: string | null
  startedAt: string | null
  completedAt: string | null
  blockedReason: string | null
  currentOwner: WorkItemCurrentOwner
  queuePosition: number
  createdAt: string
  updatedAt: string
  /** Mobile complex task payload (109A) — optional, backward-compatible. */
  structuredPayload: WorkItemStructuredPayload | null
}

/** Aggregate view of one employee queue — built by listEmployeeWorkQueue(). */
export type EmployeeWorkQueue = {
  employeeId: string
  companyId: string
  items: WorkItem[]
  activeItem: WorkItem | null
  pendingCount: number
  blockedCount: number
  updatedAt: string
}

export type CreateEmployeeWorkItemInput = {
  employeeId: string
  title: string
  summary?: string | null
  taskText?: string | null
  projectId?: string | null
  workspaceId?: string | null
  deliveryTaskId?: string | null
  workerLoopId?: string | null
  decisionPlanId?: string | null
  source?: WorkItemSource | null
  delegationPlanId?: string | null
  priority?: WorkPriority
  scheduledAt?: string | null
  currentOwner?: WorkItemCurrentOwner | null
  companyId?: string | null
  structuredPayload?: WorkItemStructuredPayload | null
}

export type AssignEmployeeWorkItemInput = {
  workItemId: string
  /** Move to another employee queue when set. */
  employeeId?: string | null
  currentOwner?: WorkItemCurrentOwner | null
  priority?: WorkPriority
  scheduledAt?: string | null
  blockedReason?: string | null
  status?: Extract<WorkStatus, 'pending' | 'scheduled' | 'blocked'>
  workerLoopId?: string | null
  decisionPlanId?: string | null
}

export type CompleteEmployeeWorkItemInput = {
  workItemId: string
  completedAt?: string | null
}

export type SkipEmployeeWorkItemInput = {
  workItemId: string
  reason?: string | null
  completedAt?: string | null
}

export type ListEmployeeWorkQueueOptions = {
  includeTerminal?: boolean
}

const PRIORITY_RANK: Record<WorkPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const TERMINAL_STATUSES: WorkStatus[] = ['completed', 'skipped', 'cancelled']

export function createWorkItemId(): string {
  return `ewq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function isTerminalWorkStatus(status: WorkStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

export function isActiveWorkStatus(status: WorkStatus): boolean {
  return !isTerminalWorkStatus(status)
}

export function resolveInitialWorkStatus(scheduledAt: string | null, now = new Date()): WorkStatus {
  if (!scheduledAt) return 'pending'
  const at = Date.parse(scheduledAt)
  if (Number.isNaN(at)) return 'pending'
  return at > now.getTime() ? 'scheduled' : 'pending'
}

export function compareWorkItems(a: WorkItem, b: WorkItem): number {
  if (a.queuePosition !== b.queuePosition) return a.queuePosition - b.queuePosition
  const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  if (priorityDiff !== 0) return priorityDiff
  const scheduledA = a.scheduledAt ? Date.parse(a.scheduledAt) : 0
  const scheduledB = b.scheduledAt ? Date.parse(b.scheduledAt) : 0
  if (scheduledA !== scheduledB) return scheduledA - scheduledB
  return Date.parse(a.createdAt) - Date.parse(b.createdAt)
}

export function sortWorkItems(items: WorkItem[]): WorkItem[] {
  return [...items].sort(compareWorkItems)
}

export function pickNextWorkItem(items: WorkItem[], now = new Date()): WorkItem | null {
  const nowMs = now.getTime()
  const candidates = items.filter((item) => {
    if (item.status !== 'pending' && item.status !== 'scheduled') return false
    if (item.status === 'scheduled' && item.scheduledAt) {
      const at = Date.parse(item.scheduledAt)
      if (!Number.isNaN(at) && at > nowMs) return false
    }
    return true
  })
  return sortWorkItems(candidates)[0] ?? null
}

export function buildDefaultCurrentOwner(employeeId: string, displayName?: string | null): WorkItemCurrentOwner {
  return {
    employeeId,
    displayName: displayName ?? null,
  }
}

export function buildEmployeeWorkQueue(
  employeeId: string,
  items: WorkItem[],
  companyId: string = DEFAULT_COMPANY_ID,
): EmployeeWorkQueue {
  const active = items.filter((item) => item.employeeId === employeeId)
  const sorted = sortWorkItems(active.filter((item) => isActiveWorkStatus(item.status)))
  const activeItem = active.find((item) => item.status === 'in_progress') ?? null
  const pendingCount = active.filter(
    (item) => item.status === 'pending' || item.status === 'scheduled',
  ).length
  const blockedCount = active.filter((item) => item.status === 'blocked').length
  const updatedAt =
    active
      .map((item) => item.updatedAt)
      .sort()
      .at(-1) ?? new Date().toISOString()

  return {
    employeeId,
    companyId,
    items: sorted,
    activeItem,
    pendingCount,
    blockedCount,
    updatedAt,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null
}

function parseCurrentOwner(value: unknown): WorkItemCurrentOwner | null {
  if (!isRecord(value) || typeof value.employeeId !== 'string') return null
  return {
    employeeId: value.employeeId,
    displayName: typeof value.displayName === 'string' ? value.displayName : null,
  }
}

export function parseWorkItem(value: unknown): WorkItem | null {
  if (!isRecord(value)) return null
  const status = parseEnum(value.status, WORK_STATUSES)
  const priority = parseEnum(value.priority, WORK_PRIORITIES)
  const currentOwner = parseCurrentOwner(value.currentOwner)
  if (
    value.version !== EMPLOYEE_WORK_QUEUE_VERSION ||
    typeof value.id !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.title !== 'string' ||
    !status ||
    !priority ||
    !currentOwner ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    id: value.id,
    version: EMPLOYEE_WORK_QUEUE_VERSION,
    companyId: typeof value.companyId === 'string' ? value.companyId : DEFAULT_COMPANY_ID,
    employeeId: value.employeeId,
    title: value.title,
    summary: typeof value.summary === 'string' ? value.summary : null,
    taskText: typeof value.taskText === 'string' ? value.taskText : null,
    projectId: typeof value.projectId === 'string' ? value.projectId : null,
    workspaceId: typeof value.workspaceId === 'string' ? value.workspaceId : null,
    deliveryTaskId: typeof value.deliveryTaskId === 'string' ? value.deliveryTaskId : null,
    workerLoopId: typeof value.workerLoopId === 'string' ? value.workerLoopId : null,
    decisionPlanId: typeof value.decisionPlanId === 'string' ? value.decisionPlanId : null,
    source: parseEnum(value.source, WORK_ITEM_SOURCES),
    delegationPlanId: typeof value.delegationPlanId === 'string' ? value.delegationPlanId : null,
    priority,
    status,
    scheduledAt: typeof value.scheduledAt === 'string' ? value.scheduledAt : null,
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : null,
    completedAt: typeof value.completedAt === 'string' ? value.completedAt : null,
    blockedReason: typeof value.blockedReason === 'string' ? value.blockedReason : null,
    currentOwner,
    queuePosition: typeof value.queuePosition === 'number' ? value.queuePosition : 0,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    structuredPayload: parseWorkItemStructuredPayload(value.structuredPayload),
  }
}
