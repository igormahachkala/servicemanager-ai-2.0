/**
 * Owner Home — company overview snapshot (AI-COMPANY-105A).
 * Aggregates real localStorage domains for /ops landing.
 */

import { loadApprovalStore } from '../approval/approvalStorage'
import { loadCursorAutomationOwnerApprovals } from '../cursorAutomation/cursorAutomationOwnerApproval'
import { loadCursorAutomationRuns } from '../cursorAutomation/cursorAutomationStorage'
import { listEmployeeDailyJournalEntries } from '../employeeDailyJournal'
import { loadEmployeeWorkItems } from '../employeeWorkQueue'
import { MAX_WORKER_EMPLOYEE_ID } from '../maxWorkerLoop'
import { buildJournalMemoryAndKnowledge } from '../morningReport/ownerMorningReportJournalSections'
import { loadPresenceRecords } from '../presence/presence'
import { isPresenceWorking } from '../presence/presenceStats'
import { loadRuntimeRuns } from '../runtime/runtimeOrchestrator'
import { getOperatingDayForEmployeeDate } from '../operatingDay/operatingDayStorage'
import { getTodayDateKey } from '../workday/workdayStorage'
import { resolveEmployee } from '../../mission-control/data/conversation'

export type OwnerHomeOperatingStatus = 'ready' | 'operating' | 'idle' | 'attention'

export type OwnerHomeCompanyStatus = {
  operatingStatus: OwnerHomeOperatingStatus
  isOperating: boolean
  activeEmployeesCount: number
  tasksInProgress: number
  tasksCompletedToday: number
  pendingOwnerDecisions: number
}

export type OwnerHomeCompletedTask = {
  id: string
  title: string
  employeeId: string
  employeeLabel: string
  completedAt: string
  reportHref: string | null
  reportTitle: string | null
}

export type OwnerHomeDecisionKind =
  | 'approval'
  | 'cursor_handoff'
  | 'knowledge_candidate'
  | 'blocked_task'

export type OwnerHomeDecisionItem = {
  id: string
  kind: OwnerHomeDecisionKind
  title: string
  detail: string | null
  href: string
  at: string | null
}

export type OwnerHomeNextAction = {
  id: string
  label: string
  description: string
  href: string
  primary: boolean
}

export type OwnerHomeSnapshot = {
  dateKey: string
  generatedAt: string
  companyStatus: OwnerHomeCompanyStatus
  completedTasks: OwnerHomeCompletedTask[]
  decisionItems: OwnerHomeDecisionItem[]
}

const CURSOR_ATTENTION_STATUSES = new Set([
  'approval_pending',
  'planned',
  'queued',
  'running',
])

function employeeLabel(employeeId: string): string {
  return resolveEmployee(employeeId)?.codename ?? employeeId
}

function isTodayIso(iso: string | null | undefined, dateKey: string): boolean {
  if (!iso) return false
  return iso.slice(0, 10) === dateKey
}

function buildCompletedTasks(dateKey: string): OwnerHomeCompletedTask[] {
  const journal = listEmployeeDailyJournalEntries({ dateKey, limit: 8 })
  const fromJournal: OwnerHomeCompletedTask[] = journal.map((entry) => {
    const report = entry.reportLinks[0] ?? null
    return {
      id: entry.id,
      title: entry.taskTitle?.trim() || entry.taskText.slice(0, 100),
      employeeId: entry.employeeId,
      employeeLabel: employeeLabel(entry.employeeId),
      completedAt: entry.finishedAt,
      reportHref: report?.href ?? null,
      reportTitle: report?.title ?? null,
    }
  })

  if (fromJournal.length >= 5) return fromJournal.slice(0, 5)

  const seen = new Set(fromJournal.map((item) => item.id))
  const queueCompleted = loadEmployeeWorkItems()
    .filter(
      (item) =>
        item.status === 'completed' &&
        item.completedAt &&
        isTodayIso(item.completedAt, dateKey) &&
        !seen.has(item.id),
    )
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, 5 - fromJournal.length)
    .map((item) => ({
      id: item.id,
      title: item.title,
      employeeId: item.employeeId,
      employeeLabel: employeeLabel(item.employeeId),
      completedAt: item.completedAt!,
      reportHref: null,
      reportTitle: null,
    }))

  return [...fromJournal, ...queueCompleted].slice(0, 5)
}

function buildDecisionItems(dateKey: string): OwnerHomeDecisionItem[] {
  const items: OwnerHomeDecisionItem[] = []

  const { approvals } = loadApprovalStore()
  for (const approval of approvals.filter((item) => item.status === 'pending').slice(0, 6)) {
    items.push({
      id: `approval-${approval.id}`,
      kind: 'approval',
      title: approval.title,
      detail: approval.description ?? null,
      href: `/ops/approvals/${encodeURIComponent(approval.id)}`,
      at: approval.createdAt,
    })
  }

  for (const run of loadCursorAutomationRuns()) {
    if (!CURSOR_ATTENTION_STATUSES.has(run.status)) continue
    items.push({
      id: `cursor-${run.id}`,
      kind: 'cursor_handoff',
      title: run.title,
      detail: run.instructions.slice(0, 160) || run.status,
      href: run.runtimeRunId
        ? `/ops/runtime/runs/${encodeURIComponent(run.runtimeRunId)}`
        : '/ops/handoffs',
      at: run.updatedAt ?? run.createdAt,
    })
  }

  for (const record of loadCursorAutomationOwnerApprovals().filter(
    (item) => item.status === 'pending',
  )) {
    items.push({
      id: `cursor-approval-${record.id}`,
      kind: 'cursor_handoff',
      title: 'Cursor Automation — ждёт Owner Approval',
      detail: record.handoffId ? `Handoff ${record.handoffId}` : null,
      href: record.maxWorkerLoopId
        ? `/ops/employees/${encodeURIComponent(MAX_WORKER_EMPLOYEE_ID)}/workspace`
        : '/ops/approvals',
      at: record.createdAt,
    })
  }

  const journalToday = listEmployeeDailyJournalEntries({ dateKey, limit: 20 })
  const { knowledge } = buildJournalMemoryAndKnowledge(journalToday)
  for (const candidate of knowledge.slice(0, 4)) {
    items.push({
      id: candidate.id,
      kind: 'knowledge_candidate',
      title: candidate.headline,
      detail: candidate.detail,
      href: candidate.href ?? '/ops/knowledge',
      at: candidate.at,
    })
  }

  for (const item of loadEmployeeWorkItems().filter((entry) => entry.status === 'blocked')) {
    items.push({
      id: `blocked-${item.id}`,
      kind: 'blocked_task',
      title: item.title,
      detail: item.blockedReason ?? null,
      href: `/ops/employees/${encodeURIComponent(item.employeeId)}/workspace`,
      at: item.updatedAt,
    })
  }

  return items.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '')).slice(0, 12)
}

export function buildOwnerHomeSnapshot(now: Date = new Date()): OwnerHomeSnapshot {
  const dateKey = getTodayDateKey(now)
  const presence = loadPresenceRecords().filter((item) => item.employeeId !== 'owner')
  const activeEmployeesCount = presence.filter((item) => isPresenceWorking(item.status)).length

  const workItems = loadEmployeeWorkItems()
  const tasksInProgress =
    workItems.filter((item) => item.status === 'in_progress').length +
    loadRuntimeRuns().filter((run) => run.status === 'running').length

  const tasksCompletedToday = workItems.filter(
    (item) => item.status === 'completed' && isTodayIso(item.completedAt, dateKey),
  ).length

  const decisionItems = buildDecisionItems(dateKey)
  const pendingOwnerDecisions = decisionItems.length

  const journalToday = listEmployeeDailyJournalEntries({ dateKey, limit: 1 })
  const maxOperatingDay = getOperatingDayForEmployeeDate(MAX_WORKER_EMPLOYEE_ID, dateKey)
  const operatingDayNotStarted = !maxOperatingDay || maxOperatingDay.state === 'not_started'
  const isFirstRunReady =
    activeEmployeesCount === 0 &&
    tasksInProgress === 0 &&
    tasksCompletedToday === 0 &&
    journalToday.length === 0 &&
    workItems.length === 0 &&
    operatingDayNotStarted &&
    pendingOwnerDecisions === 0

  const isOperating = !isFirstRunReady && (activeEmployeesCount > 0 || tasksInProgress > 0)
  let operatingStatus: OwnerHomeOperatingStatus = 'idle'
  if (isFirstRunReady) {
    operatingStatus = 'ready'
  } else if (decisionItems.some((item) => item.kind === 'blocked_task' || item.kind === 'approval')) {
    operatingStatus = 'attention'
  } else if (isOperating) {
    operatingStatus = 'operating'
  }

  return {
    dateKey,
    generatedAt: now.toISOString(),
    companyStatus: {
      operatingStatus,
      isOperating,
      activeEmployeesCount,
      tasksInProgress,
      tasksCompletedToday,
      pendingOwnerDecisions,
    },
    completedTasks: buildCompletedTasks(dateKey),
    decisionItems,
  }
}
