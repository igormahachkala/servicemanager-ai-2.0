/**
 * Employee Work Queue V1 — localStorage persistence + API (AI-COMPANY-103A).
 */

import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import { resolveEmployee } from '../../mission-control/data/conversation'
import {
  type AssignEmployeeWorkItemInput,
  type CompleteEmployeeWorkItemInput,
  type CreateEmployeeWorkItemInput,
  type EmployeeWorkQueue,
  type ListEmployeeWorkQueueOptions,
  type SkipEmployeeWorkItemInput,
  type WorkItem,
  EMPLOYEE_WORK_QUEUE_VERSION,
  buildDefaultCurrentOwner,
  buildEmployeeWorkQueue,
  createWorkItemId,
  isActiveWorkStatus,
  isTerminalWorkStatus,
  parseWorkItem,
  pickNextWorkItem,
  resolveInitialWorkStatus,
  sortWorkItems,
} from './employeeWorkQueue'
import { DEFAULT_COMPANY_ID } from '../company/company'

export const EMPLOYEE_WORK_QUEUE_STORAGE_KEY = 'ai-company-employee-work-queue'

export const EMPLOYEE_WORK_QUEUE_SYNC_EVENT = 'ai-company-employee-work-queue-sync'

function nowIso(): string {
  return new Date().toISOString()
}

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(EMPLOYEE_WORK_QUEUE_SYNC_EVENT))
}

function resolveOwnerDisplayName(employeeId: string): string | null {
  return resolveEmployee(employeeId)?.codename ?? null
}

function normalizeEmployeeId(raw: string): string {
  return resolveCanonicalEmployeeId(raw)
}

export function loadEmployeeWorkItems(): WorkItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(EMPLOYEE_WORK_QUEUE_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseWorkItem).filter((item): item is WorkItem => item !== null)
  } catch {
    return []
  }
}

export function saveEmployeeWorkItems(items: WorkItem[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(EMPLOYEE_WORK_QUEUE_STORAGE_KEY, JSON.stringify(items))
    emitSync()
  } catch {
    /* noop */
  }
}

export function getEmployeeWorkItemById(workItemId: string): WorkItem | null {
  return loadEmployeeWorkItems().find((item) => item.id === workItemId) ?? null
}

function upsertWorkItem(item: WorkItem): WorkItem {
  const items = loadEmployeeWorkItems()
  const index = items.findIndex((entry) => entry.id === item.id)
  if (index >= 0) {
    const next = [...items]
    next[index] = item
    saveEmployeeWorkItems(next)
    return item
  }
  saveEmployeeWorkItems([item, ...items])
  return item
}

function nextQueuePosition(employeeId: string): number {
  const queued = loadEmployeeWorkItems().filter(
    (item) =>
      item.employeeId === employeeId &&
      (item.status === 'pending' || item.status === 'scheduled' || item.status === 'blocked'),
  )
  if (queued.length === 0) return 1
  return Math.max(...queued.map((item) => item.queuePosition), 0) + 1
}

function reindexEmployeeQueue(employeeId: string): void {
  const items = loadEmployeeWorkItems()
  const queued = sortWorkItems(
    items.filter(
      (item) =>
        item.employeeId === employeeId &&
        (item.status === 'pending' || item.status === 'scheduled' || item.status === 'blocked'),
    ),
  )
  const positionMap = new Map(queued.map((item, index) => [item.id, index + 1]))
  const next = items.map((item) =>
    positionMap.has(item.id)
      ? { ...item, queuePosition: positionMap.get(item.id)!, updatedAt: nowIso() }
      : item,
  )
  saveEmployeeWorkItems(next)
}

function findInProgressItem(employeeId: string): WorkItem | null {
  return (
    loadEmployeeWorkItems().find(
      (item) => item.employeeId === employeeId && item.status === 'in_progress',
    ) ?? null
  )
}

export function createEmployeeWorkItem(input: CreateEmployeeWorkItemInput): WorkItem {
  const now = nowIso()
  const employeeId = normalizeEmployeeId(input.employeeId)
  const scheduledAt = input.scheduledAt ?? null
  const status = resolveInitialWorkStatus(scheduledAt)
  const currentOwner =
    input.currentOwner ?? buildDefaultCurrentOwner(employeeId, resolveOwnerDisplayName(employeeId))

  const item: WorkItem = {
    id: createWorkItemId(),
    version: EMPLOYEE_WORK_QUEUE_VERSION,
    companyId: input.companyId ?? DEFAULT_COMPANY_ID,
    employeeId,
    title: input.title.trim(),
    summary: input.summary?.trim() ?? null,
    taskText: input.taskText?.trim() ?? null,
    projectId: input.projectId ?? null,
    workspaceId: input.workspaceId ?? null,
    deliveryTaskId: input.deliveryTaskId ?? null,
    workerLoopId: input.workerLoopId ?? null,
    decisionPlanId: input.decisionPlanId ?? null,
    priority: input.priority ?? 'medium',
    status,
    scheduledAt,
    startedAt: null,
    completedAt: null,
    blockedReason: null,
    currentOwner,
    queuePosition: nextQueuePosition(employeeId),
    createdAt: now,
    updatedAt: now,
  }

  upsertWorkItem(item)
  reindexEmployeeQueue(employeeId)
  return getEmployeeWorkItemById(item.id) ?? item
}

export function assignEmployeeWorkItem(input: AssignEmployeeWorkItemInput): WorkItem | null {
  const existing = getEmployeeWorkItemById(input.workItemId)
  if (!existing || isTerminalWorkStatus(existing.status)) return null

  const previousEmployeeId = existing.employeeId
  const nextEmployeeId = input.employeeId ? normalizeEmployeeId(input.employeeId) : existing.employeeId
  const now = nowIso()

  let next: WorkItem = {
    ...existing,
    employeeId: nextEmployeeId,
    updatedAt: now,
  }

  if (input.priority !== undefined) next = { ...next, priority: input.priority }
  if (input.scheduledAt !== undefined) {
    next = {
      ...next,
      scheduledAt: input.scheduledAt,
      status:
        input.status ??
        (input.scheduledAt ? resolveInitialWorkStatus(input.scheduledAt) : next.status),
    }
  }
  if (input.status !== undefined) next = { ...next, status: input.status }
  if (input.blockedReason !== undefined) {
    next = {
      ...next,
      blockedReason: input.blockedReason,
      status: input.blockedReason ? 'blocked' : next.status === 'blocked' ? 'pending' : next.status,
    }
  }
  if (input.currentOwner !== undefined && input.currentOwner) {
    next = { ...next, currentOwner: input.currentOwner }
  } else if (nextEmployeeId !== previousEmployeeId) {
    next = {
      ...next,
      currentOwner: buildDefaultCurrentOwner(nextEmployeeId, resolveOwnerDisplayName(nextEmployeeId)),
    }
  }

  if (nextEmployeeId !== previousEmployeeId) {
    next = { ...next, queuePosition: nextQueuePosition(nextEmployeeId) }
  }

  upsertWorkItem(next)
  if (nextEmployeeId !== previousEmployeeId) {
    reindexEmployeeQueue(previousEmployeeId)
  }
  reindexEmployeeQueue(nextEmployeeId)
  return getEmployeeWorkItemById(next.id)
}

export function startNextEmployeeWorkItem(employeeId: string): WorkItem | null {
  const canonicalId = normalizeEmployeeId(employeeId)
  const inProgress = findInProgressItem(canonicalId)
  if (inProgress) return inProgress

  const items = loadEmployeeWorkItems().filter((item) => item.employeeId === canonicalId)
  const next = pickNextWorkItem(items)
  if (!next) return null

  const now = nowIso()
  const started: WorkItem = {
    ...next,
    status: 'in_progress',
    startedAt: now,
    blockedReason: null,
    currentOwner: buildDefaultCurrentOwner(canonicalId, resolveOwnerDisplayName(canonicalId)),
    updatedAt: now,
  }

  upsertWorkItem(started)
  reindexEmployeeQueue(canonicalId)
  return getEmployeeWorkItemById(started.id)
}

export function completeEmployeeWorkItem(input: CompleteEmployeeWorkItemInput): WorkItem | null {
  const existing = getEmployeeWorkItemById(input.workItemId)
  if (!existing || isTerminalWorkStatus(existing.status)) return null

  const now = input.completedAt ?? nowIso()
  const completed: WorkItem = {
    ...existing,
    status: 'completed',
    completedAt: now,
    blockedReason: null,
    queuePosition: 0,
    updatedAt: now,
  }

  upsertWorkItem(completed)
  reindexEmployeeQueue(existing.employeeId)
  return getEmployeeWorkItemById(completed.id)
}

export function skipEmployeeWorkItem(input: SkipEmployeeWorkItemInput): WorkItem | null {
  const existing = getEmployeeWorkItemById(input.workItemId)
  if (!existing || isTerminalWorkStatus(existing.status)) return null

  const now = input.completedAt ?? nowIso()
  const skipped: WorkItem = {
    ...existing,
    status: 'skipped',
    completedAt: now,
    blockedReason: input.reason?.trim() ?? existing.blockedReason,
    queuePosition: 0,
    updatedAt: now,
  }

  upsertWorkItem(skipped)
  reindexEmployeeQueue(existing.employeeId)
  return getEmployeeWorkItemById(skipped.id)
}

export function listEmployeeWorkQueue(
  employeeId: string,
  options: ListEmployeeWorkQueueOptions = {},
): EmployeeWorkQueue {
  const canonicalId = normalizeEmployeeId(employeeId)
  const all = loadEmployeeWorkItems().filter((item) => item.employeeId === canonicalId)
  const items = options.includeTerminal ? all : all.filter((item) => isActiveWorkStatus(item.status))
  const companyId = items[0]?.companyId ?? DEFAULT_COMPANY_ID
  return buildEmployeeWorkQueue(canonicalId, items, companyId)
}

export function clearEmployeeWorkQueue(employeeId?: string): void {
  if (!employeeId) {
    saveEmployeeWorkItems([])
    return
  }
  const canonicalId = normalizeEmployeeId(employeeId)
  saveEmployeeWorkItems(loadEmployeeWorkItems().filter((item) => item.employeeId !== canonicalId))
}
