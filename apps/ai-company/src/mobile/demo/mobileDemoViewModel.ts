/**
 * Mobile Demo checklist — derived from real localStorage domains (AI-COMPANY-108B).
 */

import { loadApprovalStore } from '../../domain/approval/approvalStorage'
import { listEmployeeDailyJournalEntries } from '../../domain/employeeDailyJournal'
import { loadEmployeeWorkItems, type WorkItem } from '../../domain/employeeWorkQueue'
import {
  loadMaxWorkerLoopRecords,
  MAX_WORKER_EMPLOYEE_ID,
  type MaxWorkerLoopRecord,
} from '../../domain/maxWorkerLoop'
import { buildOwnerHomeSnapshot } from '../../domain/ownerHome'
import { loadReports } from '../../domain/reports/reportStorage'
import { MOBILE_PATHS, mobileReportHref, mobileRuntimeLoopHref } from '../navigation/mobileHrefResolver'
import {
  MOBILE_DEMO_STEP_IDS,
  type MobileDemoStepId,
  type MobileDemoStepStatus,
} from './mobileDemoScenario'
import type { MobileDemoSession } from './mobileDemoStorage'
import { startMobileDemoSession } from './mobileDemoStorage'
import { resetMobileDemoRuntimeData } from './mobileDemoReset'
import { seedMobileDemoWorkItem } from './mobileDemoSeed'

export type MobileDemoStepView = {
  id: MobileDemoStepId
  order: number
  status: MobileDemoStepStatus
  href: string
  detail: string | null
}

export type MobileDemoChecklistView = {
  steps: MobileDemoStepView[]
  completedCount: number
  totalCount: number
  progressPercent: number
  currentStepId: MobileDemoStepId | null
  isComplete: boolean
  demoWorkItem: WorkItem | null
  demoLoop: MaxWorkerLoopRecord | null
  demoReportHref: string | null
}

function isAfterSession(iso: string | null | undefined, sessionStartedAt: string): boolean {
  if (!iso) return false
  const value = Date.parse(iso)
  const start = Date.parse(sessionStartedAt)
  if (Number.isNaN(value) || Number.isNaN(start)) return false
  return value >= start
}

function routeVisited(session: MobileDemoSession, prefix: string): boolean {
  return session.visitedRoutes.some((route) => route === prefix || route.startsWith(`${prefix}/`))
}

function findDemoWorkItem(session: MobileDemoSession): WorkItem | null {
  return (
    loadEmployeeWorkItems()
      .filter(
        (item) =>
          item.employeeId === MAX_WORKER_EMPLOYEE_ID &&
          isAfterSession(item.createdAt, session.startedAt),
      )
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null
  )
}

function findDemoLoop(session: MobileDemoSession, workItem: WorkItem | null): MaxWorkerLoopRecord | null {
  if (workItem?.workerLoopId) {
    const linked = loadMaxWorkerLoopRecords().find((item) => item.id === workItem.workerLoopId)
    if (linked) return linked
  }
  return (
    loadMaxWorkerLoopRecords()
      .filter((item) => isAfterSession(item.createdAt, session.startedAt))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null
  )
}

function findDemoReportHref(session: MobileDemoSession, loop: MaxWorkerLoopRecord | null): string | null {
  if (loop?.reportId) {
    return mobileReportHref(`runtime:${loop.reportId}`)
  }
  const report = loadReports()
    .filter((item) => isAfterSession(item.createdAt, session.startedAt))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
  return report ? mobileReportHref(report.id) : null
}

function hasDemoJournal(session: MobileDemoSession): boolean {
  return listEmployeeDailyJournalEntries({ employeeId: MAX_WORKER_EMPLOYEE_ID, limit: 20 }).some(
    (entry) => isAfterSession(entry.finishedAt, session.startedAt),
  )
}

function hasDemoOwnerDecision(session: MobileDemoSession): boolean {
  const approvals = loadApprovalStore().approvals.filter((item) =>
    isAfterSession(item.createdAt, session.startedAt),
  )
  if (approvals.length > 0) return true
  if (routeVisited(session, MOBILE_PATHS.decisions) && hasDemoJournal(session)) return true
  const snapshot = buildOwnerHomeSnapshot()
  return snapshot.decisionItems.some((item) => isAfterSession(item.at, session.startedAt))
}

function stepCompleted(
  stepId: MobileDemoStepId,
  session: MobileDemoSession,
  workItem: WorkItem | null,
  loop: MaxWorkerLoopRecord | null,
  reportHref: string | null,
): boolean {
  switch (stepId) {
    case 'today':
      return routeVisited(session, MOBILE_PATHS.today)
    case 'assign_task':
      return workItem !== null
    case 'max_executes':
      return (
        loop !== null &&
        (loop.status === 'running' ||
          loop.status === 'queued' ||
          loop.status === 'waiting_approval' ||
          loop.status === 'completed')
      )
    case 'runtime_live':
      return (
        routeVisited(session, MOBILE_PATHS.runtime) &&
        loop !== null &&
        loop.status !== 'queued'
      )
    case 'report':
      return reportHref !== null || hasDemoJournal(session)
    case 'owner_decision':
      return hasDemoOwnerDecision(session)
    case 'company_updated': {
      const snapshot = buildOwnerHomeSnapshot()
      return (
        hasDemoJournal(session) ||
        snapshot.completedTasks.some((task) => isAfterSession(task.completedAt, session.startedAt))
      )
    }
    default:
      return false
  }
}

function stepHref(
  stepId: MobileDemoStepId,
  _workItem: WorkItem | null,
  loop: MaxWorkerLoopRecord | null,
  reportHref: string | null,
): string {
  switch (stepId) {
    case 'today':
      return MOBILE_PATHS.today
    case 'assign_task':
      return MOBILE_PATHS.tasksNewMax
    case 'max_executes':
      return MOBILE_PATHS.max
    case 'runtime_live':
      return loop ? mobileRuntimeLoopHref(loop.id) : MOBILE_PATHS.runtime
    case 'report':
      return reportHref ?? MOBILE_PATHS.reports
    case 'owner_decision':
      return MOBILE_PATHS.decisions
    case 'company_updated':
      return MOBILE_PATHS.today
    default:
      return MOBILE_PATHS.today
  }
}

function stepDetail(
  stepId: MobileDemoStepId,
  workItem: WorkItem | null,
  loop: MaxWorkerLoopRecord | null,
): string | null {
  switch (stepId) {
    case 'assign_task':
      return workItem?.title ?? null
    case 'max_executes':
      if (!loop) return null
      return loop.input.title?.trim() || loop.input.taskText.slice(0, 80)
    case 'report':
      return loop?.reportId ? `runtime:${loop.reportId}` : null
    default:
      return null
  }
}

export function buildMobileDemoChecklist(session: MobileDemoSession | null): MobileDemoChecklistView | null {
  if (!session) return null

  const workItem = findDemoWorkItem(session)
  const loop = findDemoLoop(session, workItem)
  const reportHref = findDemoReportHref(session, loop)

  const completion = MOBILE_DEMO_STEP_IDS.map((stepId) =>
    stepCompleted(stepId, session, workItem, loop, reportHref),
  )

  const firstPendingIndex = completion.findIndex((done) => !done)
  const currentStepId =
    firstPendingIndex >= 0 ? MOBILE_DEMO_STEP_IDS[firstPendingIndex]! : MOBILE_DEMO_STEP_IDS.at(-1)!

  const steps: MobileDemoStepView[] = MOBILE_DEMO_STEP_IDS.map((stepId, index) => {
    const done = completion[index]!
    let status: MobileDemoStepStatus = 'pending'
    if (done) status = 'completed'
    else if (stepId === currentStepId) status = 'current'

    return {
      id: stepId,
      order: index + 1,
      status,
      href: stepHref(stepId, workItem, loop, reportHref),
      detail: stepDetail(stepId, workItem, loop),
    }
  })

  const completedCount = completion.filter(Boolean).length

  return {
    steps,
    completedCount,
    totalCount: MOBILE_DEMO_STEP_IDS.length,
    progressPercent: Math.round((completedCount / MOBILE_DEMO_STEP_IDS.length) * 100),
    currentStepId: firstPendingIndex >= 0 ? currentStepId : null,
    isComplete: completedCount === MOBILE_DEMO_STEP_IDS.length,
    demoWorkItem: workItem,
    demoLoop: loop,
    demoReportHref: reportHref,
  }
}

export function prepareMobileDemoScenario(): MobileDemoSession {
  resetMobileDemoRuntimeData()
  const session = startMobileDemoSession()
  seedMobileDemoWorkItem()
  return session
}
