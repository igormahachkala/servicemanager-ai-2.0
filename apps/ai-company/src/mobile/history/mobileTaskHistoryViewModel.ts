/**
 * Mobile Task History — aggregates Work Queue, Journal, Reports, Operating Day Summary (109B).
 */

import { listEmployeeDailyJournalEntries, type EmployeeDailyJournalEntry } from '../../domain/employeeDailyJournal'
import {
  loadEmployeeWorkItems,
  sortWorkItems,
  type WorkItem,
  type WorkStatus,
} from '../../domain/employeeWorkQueue'
import { loadMaxWorkerLoopRecords, type MaxWorkerLoopRecord } from '../../domain/maxWorkerLoop'
import {
  loadEmployeeOperatingDaySummaries,
  type OperatingDaySummaryTaskCompleted,
} from '../../domain/operatingDaySummary'
import { loadReports } from '../../domain/reports/reportStorage'
import type { Report } from '../../domain/reports/report'
import { resolveEmployee } from '../../mission-control/data/conversation'
import {
  mobileReportHref,
  mobileRuntimeLoopHref,
  mobileRuntimeRunHref,
  resolveMobileHref,
} from '../navigation/mobileHrefResolver'
import {
  classifyMobileTaskHistoryGroup,
  MOBILE_TASK_HISTORY_GROUP_IDS,
  type MobileTaskHistoryGroupId,
} from './mobileTaskHistoryTypes'

export type MobileTaskHistoryStatusTone = 'default' | 'success' | 'warning' | 'error' | 'info'

export type MobileTaskHistoryItem = {
  id: string
  title: string
  employeeId: string
  employeeLabel: string
  status: WorkStatus | 'journal' | 'report' | 'summary'
  statusLabelKey: WorkStatus | 'journal' | 'report' | 'summary'
  statusTone: MobileTaskHistoryStatusTone
  isCompleted: boolean
  isError: boolean
  timeIso: string
  resultPreview: string | null
  reportHref: string | null
  reportTitle: string | null
  runtimeHref: string | null
  groupId: MobileTaskHistoryGroupId
  source: 'work_queue' | 'journal' | 'operating_day' | 'report'
}

export type MobileTaskHistoryGroupView = {
  id: MobileTaskHistoryGroupId
  totalCount: number
  completedCount: number
  errorCount: number
  recentItems: MobileTaskHistoryItem[]
  lastReportHref: string | null
  lastReportTitle: string | null
  items: MobileTaskHistoryItem[]
}

export type MobileTaskHistorySnapshot = {
  generatedAt: string
  groups: MobileTaskHistoryGroupView[]
  totalItems: number
  isEmpty: boolean
}

function employeeLabel(employeeId: string): string {
  return resolveEmployee(employeeId)?.codename ?? employeeId
}

function workStatusTone(status: WorkStatus): MobileTaskHistoryStatusTone {
  if (status === 'completed') return 'success'
  if (status === 'in_progress') return 'info'
  if (status === 'blocked' || status === 'skipped' || status === 'cancelled') return 'error'
  if (status === 'scheduled') return 'warning'
  return 'default'
}

function isErrorStatus(status: WorkStatus): boolean {
  return status === 'blocked' || status === 'skipped' || status === 'cancelled'
}

function resolveWorkTimeIso(item: WorkItem): string {
  if (item.completedAt) return item.completedAt
  if (item.startedAt) return item.startedAt
  return item.updatedAt ?? item.createdAt
}

function resolveRuntimeHref(
  loop: MaxWorkerLoopRecord | null,
  runtimeRunId: string | null,
): string | null {
  if (runtimeRunId) return mobileRuntimeRunHref(runtimeRunId)
  if (loop?.runtimeRunId) return mobileRuntimeRunHref(loop.runtimeRunId)
  if (loop?.id) return mobileRuntimeLoopHref(loop.id)
  return null
}

function resolveReportFromJournal(entry: EmployeeDailyJournalEntry | null): {
  href: string | null
  title: string | null
} {
  const link = entry?.reportLinks[0]
  if (!link) return { href: null, title: null }
  return {
    href: resolveMobileHref(link.href),
    title: link.title,
  }
}

function mapWorkItem(
  item: WorkItem,
  journalEntry: EmployeeDailyJournalEntry | null,
  loop: MaxWorkerLoopRecord | null,
): MobileTaskHistoryItem {
  const report = resolveReportFromJournal(journalEntry)
  const groupId = classifyMobileTaskHistoryGroup({
    title: item.title,
    taskText: item.taskText,
    summary: item.summary,
    workStatus: item.status,
  })

  return {
    id: `work:${item.id}`,
    title: item.title,
    employeeId: item.employeeId,
    employeeLabel: employeeLabel(item.employeeId),
    status: item.status,
    statusLabelKey: item.status,
    statusTone: workStatusTone(item.status),
    isCompleted: item.status === 'completed',
    isError: isErrorStatus(item.status),
    timeIso: resolveWorkTimeIso(item),
    resultPreview: journalEntry?.resultSummary ?? item.summary,
    reportHref: report.href,
    reportTitle: report.title,
    runtimeHref: resolveRuntimeHref(loop, journalEntry?.runtimeRunId ?? null),
    groupId,
    source: 'work_queue',
  }
}

function mapJournalEntry(
  entry: EmployeeDailyJournalEntry,
  loop: MaxWorkerLoopRecord | null,
): MobileTaskHistoryItem {
  const report = resolveReportFromJournal(entry)
  const groupId = classifyMobileTaskHistoryGroup({
    title: entry.taskTitle ?? entry.taskText.slice(0, 120),
    taskText: entry.taskText,
    summary: entry.resultSummary,
  })

  return {
    id: `journal:${entry.id}`,
    title: entry.taskTitle?.trim() || entry.taskText.slice(0, 120),
    employeeId: entry.employeeId,
    employeeLabel: employeeLabel(entry.employeeId),
    status: 'journal',
    statusLabelKey: 'journal',
    statusTone: 'success',
    isCompleted: true,
    isError: false,
    timeIso: entry.finishedAt,
    resultPreview: entry.resultSummary,
    reportHref: report.href,
    reportTitle: report.title,
    runtimeHref: resolveRuntimeHref(loop, entry.runtimeRunId),
    groupId,
    source: 'journal',
  }
}

function mapOperatingDayTask(
  task: OperatingDaySummaryTaskCompleted,
  employeeId: string,
): MobileTaskHistoryItem {
  const groupId = classifyMobileTaskHistoryGroup({ title: task.title })
  const reportHref = task.reportId ? resolveMobileHref(mobileReportHref(task.reportId)) : null

  return {
    id: `ods:${task.workItemId ?? task.journalEntryId ?? task.title}:${task.finishedAt}`,
    title: task.title,
    employeeId,
    employeeLabel: employeeLabel(employeeId),
    status: 'summary',
    statusLabelKey: 'summary',
    statusTone: 'success',
    isCompleted: true,
    isError: false,
    timeIso: task.finishedAt,
    resultPreview: null,
    reportHref,
    reportTitle: task.reportId ? task.title : null,
    runtimeHref: task.runtimeRunId ? mobileRuntimeRunHref(task.runtimeRunId) : null,
    groupId,
    source: 'operating_day',
  }
}

function mapReport(report: Report): MobileTaskHistoryItem {
  const groupId = classifyMobileTaskHistoryGroup({
    title: report.title,
    summary: report.summary,
    reportType: report.type,
  })

  return {
    id: `report:${report.id}`,
    title: report.title,
    employeeId: report.employeeId ?? 'unknown',
    employeeLabel: report.employeeId ? employeeLabel(report.employeeId) : '—',
    status: 'report',
    statusLabelKey: 'report',
    statusTone: report.status === 'published' || report.status === 'reviewed' ? 'success' : 'default',
    isCompleted: true,
    isError: false,
    timeIso: report.updatedAt ?? report.createdAt,
    resultPreview: report.summary,
    reportHref: resolveMobileHref(mobileReportHref(report.id)),
    reportTitle: report.title,
    runtimeHref: null,
    groupId,
    source: 'report',
  }
}

function buildHistoryItems(): MobileTaskHistoryItem[] {
  const journalEntries = listEmployeeDailyJournalEntries()
  const loops = loadMaxWorkerLoopRecords()
  const loopById = new Map(loops.map((loop) => [loop.id, loop]))
  const workItems = sortWorkItems(loadEmployeeWorkItems())
  const reports = loadReports()

  const items: MobileTaskHistoryItem[] = []
  const seenWorkIds = new Set<string>()
  const seenJournalIds = new Set<string>()
  const seenReportIds = new Set<string>()

  for (const workItem of workItems) {
    seenWorkIds.add(workItem.id)
    const journalEntry =
      journalEntries.find(
        (entry) =>
          entry.taskId === workItem.id ||
          (workItem.workerLoopId && entry.maxWorkerLoopId === workItem.workerLoopId),
      ) ?? null
    const loop = workItem.workerLoopId ? (loopById.get(workItem.workerLoopId) ?? null) : null
    const mapped = mapWorkItem(workItem, journalEntry, loop)
    items.push(mapped)
    if (journalEntry) seenJournalIds.add(journalEntry.id)
    for (const link of journalEntry?.reportLinks ?? []) {
      seenReportIds.add(link.reportId)
    }
  }

  for (const entry of journalEntries) {
    if (entry.taskId && seenWorkIds.has(entry.taskId)) continue
    if (seenJournalIds.has(entry.id)) continue
    seenJournalIds.add(entry.id)
    const loop = entry.maxWorkerLoopId ? (loopById.get(entry.maxWorkerLoopId) ?? null) : null
    items.push(mapJournalEntry(entry, loop))
    for (const link of entry.reportLinks) {
      seenReportIds.add(link.reportId)
    }
  }

  for (const summary of loadEmployeeOperatingDaySummaries()) {
    for (const task of summary.tasksCompleted) {
      if (task.workItemId && seenWorkIds.has(task.workItemId)) continue
      items.push(mapOperatingDayTask(task, summary.employeeId))
      if (task.reportId) seenReportIds.add(task.reportId)
    }
  }

  for (const report of reports) {
    if (seenReportIds.has(report.id)) continue
    items.push(mapReport(report))
  }

  return items.sort((a, b) => Date.parse(b.timeIso) - Date.parse(a.timeIso))
}

function buildGroupView(id: MobileTaskHistoryGroupId, items: MobileTaskHistoryItem[]): MobileTaskHistoryGroupView {
  const groupItems = items.filter((item) => item.groupId === id)
  const withReport = groupItems.filter((item) => item.reportHref)
  const lastReport = withReport[0] ?? null

  return {
    id,
    totalCount: groupItems.length,
    completedCount: groupItems.filter((item) => item.isCompleted).length,
    errorCount: groupItems.filter((item) => item.isError).length,
    recentItems: groupItems.slice(0, 3),
    lastReportHref: lastReport?.reportHref ?? null,
    lastReportTitle: lastReport?.reportTitle ?? lastReport?.title ?? null,
    items: groupItems,
  }
}

export function buildMobileTaskHistorySnapshot(): MobileTaskHistorySnapshot {
  const items = buildHistoryItems()
  const groups = MOBILE_TASK_HISTORY_GROUP_IDS.map((id) => buildGroupView(id, items))

  return {
    generatedAt: new Date().toISOString(),
    groups,
    totalItems: items.length,
    isEmpty: items.length === 0,
  }
}

export function findMobileTaskHistoryGroup(
  snapshot: MobileTaskHistorySnapshot,
  groupId: MobileTaskHistoryGroupId | null,
): MobileTaskHistoryGroupView | null {
  if (!groupId) return null
  return snapshot.groups.find((group) => group.id === groupId) ?? null
}
