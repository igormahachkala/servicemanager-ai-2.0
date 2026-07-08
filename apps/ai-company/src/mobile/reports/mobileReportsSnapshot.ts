/**
 * Mobile Reports V1 — aggregates real local data for Owner mobile reports.
 */

import { listEmployeeDailyJournalEntries, type EmployeeDailyJournalEntry } from '../../domain/employeeDailyJournal'
import { buildOwnerMorningReportSnapshot, type OwnerMorningReportSnapshot } from '../../domain/morningReport'
import {
  loadEmployeeOperatingDaySummaries,
  type EmployeeOperatingDaySummary,
} from '../../domain/operatingDaySummary'
import { getReportById, loadReports } from '../../domain/reports/reportStorage'
import type { Report } from '../../domain/reports/report'
import { loadMaxWorkerLoopRecords } from '../../domain/maxWorkerLoop'
import { resolveEmployee } from '../../mission-control/data/conversation'
import {
  mobileMaxHref,
  mobileRuntimeLoopHref,
  mobileRuntimeRunHref,
} from '../navigation/mobileHrefResolver'

export type MobileReportKind =
  | 'morning_report'
  | 'runtime_report'
  | 'operating_day_summary'
  | 'journal_report'

export type MobileReportStatusTone = 'default' | 'success' | 'warning' | 'info' | 'error'

export type MobileReportListItem = {
  id: string
  kind: MobileReportKind
  title: string
  employeeId: string | null
  employeeLabel: string
  taskTitle: string | null
  summary: string
  status: string
  statusTone: MobileReportStatusTone
  at: string
}

export type MobileReportLink = {
  label: string
  href: string
}

export type MobileReportDetail = {
  id: string
  kind: MobileReportKind
  title: string
  employeeId: string | null
  employeeLabel: string
  dateLabel: string
  taskTitle: string | null
  taskText: string | null
  summary: string
  findings: string[]
  risks: string[]
  recommendations: string[]
  modelsUsed: string[]
  toolsUsed: string[]
  consultations: string[]
  links: MobileReportLink[]
  status: string
  statusTone: MobileReportStatusTone
  morningSnapshot?: OwnerMorningReportSnapshot
  runtimeReport?: Report
  operatingDaySummary?: EmployeeOperatingDaySummary
  journalEntry?: EmployeeDailyJournalEntry
}

export type MobileReportsSnapshot = {
  generatedAt: string
  morningReport: OwnerMorningReportSnapshot | null
  items: MobileReportListItem[]
}

export const MOBILE_MORNING_REPORT_ID = 'morning-report'

function employeeLabel(employeeId: string | null): string {
  if (!employeeId) return '—'
  return resolveEmployee(employeeId)?.codename ?? employeeId
}

function formatDateLabel(iso: string): string {
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return iso
  return new Date(parsed).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function reportStatusTone(status: string): MobileReportStatusTone {
  if (status === 'published' || status === 'reviewed') return 'success'
  if (status === 'draft') return 'warning'
  if (status === 'archived') return 'default'
  return 'info'
}

function morningReportHasContent(snapshot: OwnerMorningReportSnapshot): boolean {
  return (
    snapshot.stats.journalEntries > 0 ||
    snapshot.stats.reportsCreated > 0 ||
    snapshot.stats.loopsCompleted > 0 ||
    snapshot.completedTasks.length > 0 ||
    snapshot.whatMaxDid.length > 0
  )
}

function buildMorningListItem(snapshot: OwnerMorningReportSnapshot): MobileReportListItem {
  return {
    id: MOBILE_MORNING_REPORT_ID,
    kind: 'morning_report',
    title: 'Утренний отчёт',
    employeeId: null,
    employeeLabel: snapshot.employeeLabel,
    taskTitle: null,
    summary: snapshot.summary,
    status: snapshot.operatingDayState,
    statusTone: snapshot.operatingDayState === 'finished' ? 'success' : 'info',
    at: snapshot.generatedAt,
  }
}

function buildRuntimeListItem(report: Report): MobileReportListItem {
  const summary = report.runtimeBody?.briefSummary?.trim() || report.summary
  return {
    id: `runtime:${report.id}`,
    kind: 'runtime_report',
    title: report.title,
    employeeId: report.employeeId,
    employeeLabel: employeeLabel(report.employeeId),
    taskTitle: report.title,
    summary,
    status: report.status,
    statusTone: reportStatusTone(report.status),
    at: report.updatedAt || report.createdAt,
  }
}

function buildOperatingDayListItem(summary: EmployeeOperatingDaySummary): MobileReportListItem {
  const headline =
    summary.nextDayRecommendations[0] ??
    summary.tasksCompleted[0]?.title ??
    `Завершено задач: ${summary.tasksCompletedCount}`
  return {
    id: `ods:${summary.id}`,
    kind: 'operating_day_summary',
    title: `Итог дня · ${employeeLabel(summary.employeeId)}`,
    employeeId: summary.employeeId,
    employeeLabel: employeeLabel(summary.employeeId),
    taskTitle: summary.tasksCompleted[0]?.title ?? null,
    summary: headline,
    status: summary.morningReportEligible ? 'ready' : 'draft',
    statusTone: summary.tasksCompletedCount > 0 ? 'success' : 'default',
    at: summary.finishedAt || summary.generatedAt,
  }
}

function buildJournalListItem(entry: EmployeeDailyJournalEntry): MobileReportListItem {
  const link = entry.reportLinks[0]
  return {
    id: `journal:${entry.id}`,
    kind: 'journal_report',
    title: link?.title ?? entry.taskTitle ?? 'Journal',
    employeeId: entry.employeeId,
    employeeLabel: employeeLabel(entry.employeeId),
    taskTitle: entry.taskTitle,
    summary: entry.resultSummary || entry.workSummary || link?.summary || entry.taskText.slice(0, 160),
    status: 'completed',
    statusTone: 'success',
    at: entry.finishedAt,
  }
}

export function buildMobileReportsSnapshot(now: Date = new Date()): MobileReportsSnapshot {
  const morningReport = buildOwnerMorningReportSnapshot(now)
  const runtimeReports = loadReports()
  const operatingSummaries = loadEmployeeOperatingDaySummaries()
  const journalEntries = listEmployeeDailyJournalEntries({ limit: 40 })
  const runtimeIds = new Set(runtimeReports.map((item) => item.id))

  const items: MobileReportListItem[] = []

  if (morningReportHasContent(morningReport)) {
    items.push(buildMorningListItem(morningReport))
  }

  for (const report of [...runtimeReports].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    items.push(buildRuntimeListItem(report))
  }

  for (const summary of [...operatingSummaries].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))) {
    items.push(buildOperatingDayListItem(summary))
  }

  for (const entry of journalEntries) {
    const linkedReportId = entry.reportLinks[0]?.reportId
    if (linkedReportId && runtimeIds.has(linkedReportId)) continue
    if (!entry.resultSummary && !entry.workSummary && entry.reportLinks.length === 0) continue
    items.push(buildJournalListItem(entry))
  }

  const deduped = items.filter((item, index, array) => array.findIndex((x) => x.id === item.id) === index)
  deduped.sort((a, b) => {
    if (a.kind === 'morning_report') return -1
    if (b.kind === 'morning_report') return 1
    return b.at.localeCompare(a.at)
  })

  return {
    generatedAt: now.toISOString(),
    morningReport: morningReportHasContent(morningReport) ? morningReport : null,
    items: deduped,
  }
}

function buildRuntimeDetail(report: Report): MobileReportDetail {
  const body = report.runtimeBody
  const loops = loadMaxWorkerLoopRecords().filter((item) => item.reportId === report.id)
  const links: MobileReportLink[] = []
  if (loops[0]?.id) {
    links.push({
      label: 'MAX Worker Loop',
      href: mobileMaxHref(report.employeeId ?? 'ag-max'),
    })
  }
  if (loops[0]?.runtimeRunId) {
    links.push({
      label: 'Runtime Run',
      href: mobileRuntimeRunHref(loops[0].runtimeRunId),
    })
  }

  return {
    id: `runtime:${report.id}`,
    kind: 'runtime_report',
    title: report.title,
    employeeId: report.employeeId,
    employeeLabel: employeeLabel(report.employeeId),
    dateLabel: formatDateLabel(report.updatedAt || report.createdAt),
    taskTitle: report.title,
    taskText: body?.briefSummary ?? report.summary,
    summary: body?.briefSummary ?? report.summary,
    findings: body?.found.length ? body.found : report.findings,
    risks: body?.risks.length ? body.risks.map((item) => `[${item.severity}] ${item.message}`) : report.risks,
    recommendations: body?.recommendations.length ? body.recommendations : report.recommendations,
    modelsUsed: [],
    toolsUsed: body?.checked ?? [],
    consultations: [],
    links,
    status: report.status,
    statusTone: reportStatusTone(report.status),
    runtimeReport: report,
  }
}

function buildOperatingDayDetail(summary: EmployeeOperatingDaySummary): MobileReportDetail {
  const links: MobileReportLink[] = []
  for (const report of summary.reportsCreated) {
    if (report.href) links.push({ label: report.title, href: report.href })
  }
  for (const loopId of summary.workerLoopIds) {
    links.push({
      label: `Worker Loop ${loopId.slice(0, 8)}…`,
      href: mobileRuntimeLoopHref(loopId),
    })
  }

  return {
    id: `ods:${summary.id}`,
    kind: 'operating_day_summary',
    title: `Итог дня · ${employeeLabel(summary.employeeId)}`,
    employeeId: summary.employeeId,
    employeeLabel: employeeLabel(summary.employeeId),
    dateLabel: formatDateLabel(summary.finishedAt || summary.generatedAt),
    taskTitle: summary.tasksCompleted[0]?.title ?? null,
    taskText: null,
    summary: summary.nextDayRecommendations[0] ?? `Завершено: ${summary.tasksCompletedCount}`,
    findings: summary.tasksCompleted.map((item) => item.title),
    risks: summary.difficulties.map((item) => item.summary),
    recommendations: summary.nextDayRecommendations,
    modelsUsed: summary.modelsUsed.map((item) => `${item.label} (${item.usageCount})`),
    toolsUsed: summary.toolsUsed.map((item) => `${item.label} (${item.usageCount})`),
    consultations: summary.consultations.map(
      (item) => `${item.peerDisplayName ?? item.peerEmployeeId}: ${item.outcome ?? item.reason ?? ''}`.trim(),
    ),
    links,
    status: summary.morningReportEligible ? 'ready' : 'draft',
    statusTone: summary.tasksCompletedCount > 0 ? 'success' : 'default',
    operatingDaySummary: summary,
  }
}

function buildJournalDetail(entry: EmployeeDailyJournalEntry): MobileReportDetail {
  const link = entry.reportLinks[0]
  const links: MobileReportLink[] = []
  if (link?.href) links.push({ label: link.title, href: link.href })
  if (entry.maxWorkerLoopId) {
    links.push({
      label: 'MAX Worker Loop',
      href: mobileRuntimeLoopHref(entry.maxWorkerLoopId),
    })
  }
  if (entry.runtimeRunId) {
    links.push({
      label: 'Runtime Run',
      href: mobileRuntimeRunHref(entry.runtimeRunId),
    })
  }

  return {
    id: `journal:${entry.id}`,
    kind: 'journal_report',
    title: link?.title ?? entry.taskTitle ?? 'Journal',
    employeeId: entry.employeeId,
    employeeLabel: employeeLabel(entry.employeeId),
    dateLabel: formatDateLabel(entry.finishedAt),
    taskTitle: entry.taskTitle,
    taskText: entry.taskText,
    summary: entry.resultSummary || entry.workSummary,
    findings: entry.decisions.map((item) => item.summary),
    risks: [],
    recommendations: [],
    modelsUsed: entry.modelsUsed.map((item) => item.label),
    toolsUsed: entry.toolsUsed.map((item) => item.label),
    consultations: entry.consultations.map(
      (item) => `${item.peerDisplayName ?? item.peerEmployeeId}: ${item.outcome ?? item.reason ?? ''}`.trim(),
    ),
    links,
    status: 'completed',
    statusTone: 'success',
    journalEntry: entry,
  }
}

function buildMorningDetail(snapshot: OwnerMorningReportSnapshot): MobileReportDetail {
  return {
    id: MOBILE_MORNING_REPORT_ID,
    kind: 'morning_report',
    title: 'Утренний отчёт',
    employeeId: null,
    employeeLabel: snapshot.employeeLabel,
    dateLabel: formatDateLabel(snapshot.generatedAt),
    taskTitle: null,
    taskText: null,
    summary: snapshot.summary,
    findings: snapshot.whatDiscovered.map((item) => item.headline),
    risks: snapshot.blockedTasks.map((item) => item.headline),
    recommendations: snapshot.employeeRecommendations.map((item) => item.headline),
    modelsUsed: snapshot.modelsUsed.map((item) => item.headline),
    toolsUsed: snapshot.toolsUsed.map((item) => item.headline),
    consultations: snapshot.consultations.map((item) => item.headline),
    links: snapshot.reportsCreated
      .filter((item) => item.href)
      .map((item) => ({ label: item.headline, href: item.href! })),
    status: snapshot.operatingDayState,
    statusTone: snapshot.operatingDayState === 'finished' ? 'success' : 'info',
    morningSnapshot: snapshot,
  }
}

export function resolveMobileReportDetail(id: string): MobileReportDetail | null {
  if (id === MOBILE_MORNING_REPORT_ID) {
    const snapshot = buildOwnerMorningReportSnapshot()
    if (!morningReportHasContent(snapshot)) return null
    return buildMorningDetail(snapshot)
  }

  if (id.startsWith('runtime:')) {
    const reportId = id.slice('runtime:'.length)
    const report = getReportById(reportId)
    return report ? buildRuntimeDetail(report) : null
  }

  if (id.startsWith('ods:')) {
    const summaryId = id.slice('ods:'.length)
    const summary = loadEmployeeOperatingDaySummaries().find((item) => item.id === summaryId)
    return summary ? buildOperatingDayDetail(summary) : null
  }

  if (id.startsWith('journal:')) {
    const entryId = id.slice('journal:'.length)
    const entry = listEmployeeDailyJournalEntries({ limit: 200 }).find((item) => item.id === entryId)
    return entry ? buildJournalDetail(entry) : null
  }

  return null
}

export function findMobileReportListItem(id: string, snapshot?: MobileReportsSnapshot): MobileReportListItem | null {
  const data = snapshot ?? buildMobileReportsSnapshot()
  return data.items.find((item) => item.id === id) ?? null
}
