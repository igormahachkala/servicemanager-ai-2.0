/**
 * Employee Operating Day — snapshot from Workday + Journal + Work Queue (104B).
 */

import { listEmployeeDailyJournalEntries } from '../employeeDailyJournal'
import { listEmployeeWorkQueue } from '../employeeWorkQueue'
import { getPresenceByEmployeeId } from '../presence'
import { resolveEmployeeLabel } from '../presence/employeeLabel'
import {
  getTodayWorkdayForEmployee,
  getTodayDateKey,
  type EmployeeWorkday,
} from '../workday'
import type {
  EmployeeOperatingDayActions,
  EmployeeOperatingDayCurrentTask,
  EmployeeOperatingDaySnapshot,
  EmployeeOperatingDayStatus,
} from './employeeOperatingDay'

function isTodayIso(iso: string, dateKey: string): boolean {
  return iso.slice(0, 10) === dateKey
}

function computeJournalMetrics(employeeId: string, dateKey: string) {
  const entries = listEmployeeDailyJournalEntries({ employeeId, dateKey })
  const reportIds = new Set<string>()
  let consultationsCount = 0
  let decisionsCount = 0
  let workMs = 0

  for (const entry of entries) {
    consultationsCount += entry.consultations.length
    decisionsCount += entry.decisions.length
    for (const link of entry.reportLinks) {
      reportIds.add(link.reportId)
    }
    const start = Date.parse(entry.startedAt)
    const end = Date.parse(entry.finishedAt)
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      workMs += end - start
    }
  }

  return {
    entries,
    consultationsCount,
    decisionsCount,
    reportsCount: reportIds.size,
    journalWorkMs: workMs,
  }
}

function resolveStatus(
  workday: EmployeeWorkday | null,
  presenceStatus: string | null,
): EmployeeOperatingDayStatus {
  if (!workday?.startedAt) return 'not_started'
  if (workday.state === 'finished' || workday.finishedAt) return 'finished'
  if (presenceStatus === 'break') return 'paused'
  return 'active'
}

function buildActions(status: EmployeeOperatingDayStatus): EmployeeOperatingDayActions {
  return {
    canStart: status === 'not_started',
    canContinue: status === 'active',
    canFinish: status === 'active' || status === 'paused',
    canPause: status === 'active',
    canResume: status === 'paused',
  }
}

function buildCurrentTask(employeeId: string): EmployeeOperatingDayCurrentTask | null {
  const queue = listEmployeeWorkQueue(employeeId)
  const item = queue.activeItem ?? queue.items.find((entry) => entry.status === 'in_progress') ?? null
  if (!item) return null

  const params = new URLSearchParams()
  params.set('employee', employeeId)
  if (item.projectId) params.set('project', item.projectId)
  if (item.workspaceId) params.set('workspace', item.workspaceId)
  if (item.taskText) params.set('text', item.taskText)

  return {
    workItemId: item.id,
    title: item.title,
    status: item.status,
    summary: item.summary,
    href: `/ops/run-task?${params.toString()}`,
  }
}

function countQueueTasks(employeeId: string, dateKey: string) {
  const queue = listEmployeeWorkQueue(employeeId)
  const allQueue = listEmployeeWorkQueue(employeeId, { includeTerminal: true })
  const completedToday = allQueue.items.filter(
    (item) =>
      item.status === 'completed' &&
      item.completedAt &&
      isTodayIso(item.completedAt, dateKey),
  ).length
  const remaining = queue.pendingCount + (queue.activeItem ? 1 : 0) + queue.blockedCount

  return { completedToday, remaining }
}

function buildDaySummary(
  workday: EmployeeWorkday | null,
  journalEntries: ReturnType<typeof listEmployeeDailyJournalEntries>,
): string | null {
  if (workday?.summary) {
    const parts = [
      `${workday.summary.tasksCompleted} tasks`,
      `${workday.summary.reportsCreated} reports`,
      `${workday.summary.approvalsHandled} approvals`,
    ]
    return parts.join(' · ')
  }

  if (journalEntries.length === 0) return null
  return journalEntries
    .slice(0, 3)
    .map((entry) => entry.resultSummary.slice(0, 120))
    .join('\n\n')
}

function buildContinueHref(
  employeeId: string,
  currentTask: EmployeeOperatingDayCurrentTask | null,
): string | null {
  if (currentTask?.href) return currentTask.href
  return `/ops/run-task?employee=${encodeURIComponent(employeeId)}`
}

function computeWorkHoursMinutes(
  workday: EmployeeWorkday | null,
  journalWorkMs: number,
  now: Date,
): number {
  let totalMs = journalWorkMs

  if (workday?.startedAt && !workday.finishedAt) {
    const start = Date.parse(workday.startedAt)
    if (!Number.isNaN(start)) {
      totalMs = Math.max(totalMs, now.getTime() - start)
    }
  } else if (workday?.startedAt && workday.finishedAt) {
    const start = Date.parse(workday.startedAt)
    const end = Date.parse(workday.finishedAt)
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      totalMs = Math.max(totalMs, end - start)
    }
  }

  return Math.round(totalMs / 60000)
}

export function buildEmployeeOperatingDaySnapshot(
  employeeId: string,
  now: Date = new Date(),
): EmployeeOperatingDaySnapshot {
  const dateKey = getTodayDateKey()
  const workday = getTodayWorkdayForEmployee(employeeId)
  const presence = getPresenceByEmployeeId(employeeId)
  const label = resolveEmployeeLabel(employeeId)

  const { entries, consultationsCount, decisionsCount, reportsCount, journalWorkMs } =
    computeJournalMetrics(employeeId, dateKey)
  const { completedToday, remaining } = countQueueTasks(employeeId, dateKey)
  const currentTask = buildCurrentTask(employeeId)
  const status = resolveStatus(workday, presence?.status ?? null)

  return {
    version: 'v1',
    employeeId,
    employeeLabel: label.codename,
    dateKey,
    status,
    workdayStarted: Boolean(workday?.startedAt),
    startedAt: workday?.startedAt ?? null,
    finishedAt: workday?.finishedAt ?? null,
    tasksCompleted: Math.max(completedToday, entries.length),
    tasksRemaining: remaining,
    currentTask,
    workHoursMinutes: computeWorkHoursMinutes(workday, journalWorkMs, now),
    consultationsCount,
    decisionsCount,
    reportsCount,
    daySummary: buildDaySummary(workday, entries),
    actions: buildActions(status),
    continueHref: buildContinueHref(employeeId, currentTask),
  }
}
