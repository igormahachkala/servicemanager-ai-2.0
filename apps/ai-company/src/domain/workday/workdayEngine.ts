import { recordOperatingDaySummaryOnWorkdayFinish } from '../operatingDaySummary'
import { loadApprovalStore } from '../approval/approvalStorage'
import { DEFAULT_COMPANY_ID } from '../company/company'
import { emitEvent } from '../events/eventStorage'
import { listHandoffs } from '../handoff'
import { getAssignmentsForEmployee } from '../knowledge/knowledgeStorage'
import { loadNotifications } from '../notifications/notificationStorage'
import {
  appendWorkdayEvent,
  getPresenceByEmployeeId,
  upsertPresence,
} from '../presence'
import { resolveEmployeeLabel } from '../presence/employeeLabel'
import { getKnowledgeById } from '../knowledge/knowledgeStorage'
import { loadReports } from '../reports/reportStorage'
import { loadDeliveryTasks } from '../tasks/taskStorage'
import { agents } from '../../mission-control/data/mock'
import { loadCustomEmployees } from '../../mission-control/data/customEmployees'
import type {
  EmployeeWorkday,
  WorkdayAgendaItem,
  WorkdayCompanyDashboard,
  WorkdayDailySummary,
  WorkdayDashboardBucket,
  WorkdayDashboardEntry,
  WorkdaySummary,
} from './workday'
import {
  WORKDAY_PHASES,
  nextWorkdayPhase,
  scheduledDayStartIso,
  workdayPhaseIndex,
  type WorkdayPhase,
} from './workdayPhase'
import {
  isWorkdayActive,
  isWorkdayBlocked,
  isWorkdayIdle,
  phaseForPresence,
  stateForPhase,
  type WorkdayState,
} from './workdayState'
import {
  createEmptyWorkday,
  getTodayDateKey,
  getTodayWorkdayForEmployee,
  loadWorkdays,
  upsertWorkday,
} from './workdayStorage'

const SEED_KEY = 'ai-company-workday-seeded-v1'

function listEmployeeIds(): string[] {
  const ids = new Set<string>()
  agents.forEach((agent) => ids.add(agent.id))
  loadCustomEmployees().forEach((employee) => ids.add(employee.id))
  return [...ids]
}

function appendPhaseLog(
  workday: EmployeeWorkday,
  phase: WorkdayPhase,
  state: WorkdayState,
  note?: string,
): EmployeeWorkday {
  return {
    ...workday,
    phaseLog: [{ phase, state, at: new Date().toISOString(), note }, ...workday.phaseLog].slice(
      0,
      40,
    ),
  }
}

function buildAgendaForEmployee(employeeId: string): WorkdayAgendaItem[] {
  const items: WorkdayAgendaItem[] = []
  const tasks = loadDeliveryTasks().filter(
    (task) => task.assigneeId === employeeId && task.status !== 'done',
  )
  tasks.slice(0, 4).forEach((task) => {
    items.push({
      id: `agenda-task-${task.id}`,
      label: task.title,
      source: 'task',
      sourceId: task.id,
      completed: task.status === 'done',
    })
  })

  loadApprovalStore()
    .approvals.filter((item) => item.status === 'pending' && item.employeeId === employeeId)
    .slice(0, 2)
    .forEach((item) => {
      items.push({
        id: `agenda-approval-${item.id}`,
        label: item.title,
        source: 'approval',
        sourceId: item.id,
        completed: false,
      })
    })

  loadNotifications()
    .filter((item) => item.employeeId === employeeId && !item.read)
    .slice(0, 2)
    .forEach((item) => {
      items.push({
        id: `agenda-notif-${item.id}`,
        label: item.title,
        source: 'notification',
        sourceId: item.id,
        completed: false,
      })
    })

  getAssignmentsForEmployee(employeeId)
    .slice(0, 2)
    .forEach((item) => {
      const knowledge = item.knowledgeId ? getKnowledgeById(item.knowledgeId) : null
      items.push({
        id: `agenda-knowledge-${item.id}`,
        label: knowledge?.title ?? item.note ?? 'Read assigned knowledge',
        source: 'knowledge',
        sourceId: item.knowledgeId,
        completed: item.status === 'completed',
      })
    })

  listHandoffs()
    .filter((item) => item.employeeId === employeeId && item.status !== 'accepted')
    .slice(0, 1)
    .forEach((item) => {
      items.push({
        id: `agenda-handoff-${item.id}`,
        label: item.title,
        source: 'handoff',
        sourceId: item.id,
        completed: false,
      })
    })

  items.push({
    id: `agenda-sprint-${employeeId}`,
    label: 'Review sprint board and commitments',
    source: 'sprint',
    sourceId: null,
    completed: false,
  })

  return items
}

function detectBlockedReason(employeeId: string): string | null {
  const blockedTask = loadDeliveryTasks().find(
    (task) => task.assigneeId === employeeId && task.status === 'blocked',
  )
  if (blockedTask) return blockedTask.title

  const pendingApproval = loadApprovalStore().approvals.find(
    (item) => item.status === 'pending' && item.employeeId === employeeId,
  )
  if (pendingApproval) return pendingApproval.title

  const returnedHandoff = listHandoffs().find(
    (item) => item.employeeId === employeeId && item.status === 'returned',
  )
  if (returnedHandoff) return returnedHandoff.title

  return null
}

function computeSummary(workday: EmployeeWorkday): WorkdaySummary {
  const tasks = loadDeliveryTasks().filter((task) => task.assigneeId === workday.employeeId)
  const reports = loadReports().filter((item) => item.employeeId === workday.employeeId)
  const todayStart = new Date(`${workday.date}T00:00:00`)
  const reportsToday = reports.filter((item) => new Date(item.createdAt) >= todayStart).length

  return {
    tasksCompleted: tasks.filter((item) => item.status === 'done').length,
    reportsCreated: reportsToday,
    approvalsHandled: loadApprovalStore().approvals.filter(
      (item) =>
        item.employeeId === workday.employeeId &&
        item.status !== 'pending' &&
        new Date(item.updatedAt) >= todayStart,
    ).length,
    knowledgeRead: workday.agendaItems.filter(
      (item) => item.source === 'knowledge' && item.completed,
    ).length,
    notificationsChecked: workday.agendaItems.filter(
      (item) => item.source === 'notification' && item.completed,
    ).length,
    phasesCompleted: workdayPhaseIndex(workday.phase),
    totalPhases: WORKDAY_PHASES.length,
    agendaCompleted: workday.agendaItems.filter((item) => item.completed).length,
    agendaTotal: workday.agendaItems.length,
  }
}

function syncWorkdayFromPresence(workday: EmployeeWorkday): EmployeeWorkday {
  if (workday.state === 'finished') return workday

  const presence = getPresenceByEmployeeId(workday.employeeId)
  const blockedReason = detectBlockedReason(workday.employeeId)
  let next = { ...workday, blockedReason }

  if (!presence || presence.status === 'offline') {
    if (!next.startedAt) {
      return { ...next, phase: 'day_start', state: 'starting', idleSince: null }
    }
    return next
  }

  if (!next.startedAt) {
    next = {
      ...next,
      startedAt: presence.startedAt ?? new Date().toISOString(),
      phase: 'agenda',
      state: 'planning',
    }
  }

  const phase = phaseForPresence(presence.status)
  const state = blockedReason ? 'waiting' : stateForPhase(phase)

  next = {
    ...next,
    phase,
    state,
    idleSince:
      state === 'waiting' && !blockedReason ? (next.idleSince ?? new Date().toISOString()) : null,
  }

  if (next.agendaItems.length === 0) {
    next.agendaItems = buildAgendaForEmployee(next.employeeId)
  }

  return next
}

function classifyBucket(workday: EmployeeWorkday): WorkdayDashboardBucket {
  if (workday.state === 'finished') return 'finished'
  if (!workday.startedAt) return 'notStarted'
  if (isWorkdayBlocked(workday.blockedReason)) return 'blocked'
  if (isWorkdayIdle(workday.state, workday.blockedReason)) return 'idle'
  if (isWorkdayActive(workday.state)) return 'started'
  return 'notStarted'
}

function toDashboardEntry(workday: EmployeeWorkday): WorkdayDashboardEntry {
  const label = resolveEmployeeLabel(workday.employeeId)
  return {
    workday,
    bucket: classifyBucket(workday),
    employeeName: label.name,
    employeeCodename: label.codename,
  }
}

export function getTodayWorkdays(): EmployeeWorkday[] {
  const date = getTodayDateKey()
  return loadWorkdays().filter((item) => item.date === date)
}

export function syncWorkdaysFromPlatform(): EmployeeWorkday[] {
  const date = getTodayDateKey()
  const companyId = DEFAULT_COMPANY_ID
  const synced = listEmployeeIds().map((employeeId) => {
    const existing = getTodayWorkdayForEmployee(employeeId)
    const base = existing ?? createEmptyWorkday({ employeeId, companyId, date })
    return syncWorkdayFromPresence(base)
  })

  synced.forEach((item) => upsertWorkday(item))
  return synced
}

export function startWorkday(employeeId: string): EmployeeWorkday {
  const date = getTodayDateKey()
  const existing = getTodayWorkdayForEmployee(employeeId)
  const base =
    existing ?? createEmptyWorkday({ employeeId, companyId: DEFAULT_COMPANY_ID, date })

  const now = new Date().toISOString()
  let next = appendPhaseLog(
    {
      ...base,
      startedAt: now,
      phase: 'agenda',
      state: 'planning',
      agendaItems: buildAgendaForEmployee(employeeId),
      blockedReason: detectBlockedReason(employeeId),
    },
    'agenda',
    'planning',
    'Workday started',
  )

  next = upsertWorkday(next)

  upsertPresence({
    employeeId,
    status: 'available',
    activity: 'Starting workday — planning agenda',
    startedAt: now,
  })

  appendWorkdayEvent({
    employeeId,
    type: 'work_started',
    label: 'Digital workday started',
    startedAt: now,
    currentProjectId: null,
    currentTaskId: null,
  })

  emitEvent({
    type: 'workday.started',
    sourceType: 'employee',
    sourceId: employeeId,
    employeeId,
    workspaceId: null,
    reportId: null,
    metadata: {
      message: `${resolveEmployeeLabel(employeeId).codename} started the workday`,
      phase: next.phase,
    },
    severity: 'info',
  })

  return next
}

export function advanceWorkdayPhase(employeeId: string): EmployeeWorkday {
  const existing = getTodayWorkdayForEmployee(employeeId)
  if (!existing) return startWorkday(employeeId)
  if (existing.state === 'finished') return existing

  const nextPhase = nextWorkdayPhase(existing.phase) ?? 'finish_day'
  const nextState = stateForPhase(nextPhase)
  let next = appendPhaseLog(
    {
      ...existing,
      phase: nextPhase,
      state: nextState,
      blockedReason: detectBlockedReason(employeeId),
    },
    nextPhase,
    nextState,
  )

  if (nextPhase === 'finish_day') {
    next = finishWorkday(employeeId, next)
    return next
  }

  next = upsertWorkday(next)

  emitEvent({
    type: 'workday.phase_changed',
    sourceType: 'employee',
    sourceId: employeeId,
    employeeId,
    workspaceId: null,
    reportId: null,
    metadata: {
      message: `${resolveEmployeeLabel(employeeId).codename} moved to ${nextPhase}`,
      phase: nextPhase,
      state: nextState,
    },
    severity: 'info',
  })

  return next
}

export function finishWorkday(employeeId: string, draft?: EmployeeWorkday): EmployeeWorkday {
  const existing = draft ?? getTodayWorkdayForEmployee(employeeId)
  if (!existing) return startWorkday(employeeId)

  const now = new Date().toISOString()
  const summary = computeSummary(existing)
  let next = appendPhaseLog(
    {
      ...existing,
      phase: 'finish_day',
      state: 'finished',
      finishedAt: now,
      summary,
      blockedReason: null,
      idleSince: null,
    },
    'finish_day',
    'finished',
    'Workday finished',
  )

  next = upsertWorkday(next)
  recordOperatingDaySummaryOnWorkdayFinish(next)

  upsertPresence({
    employeeId,
    status: 'offline',
    activity: 'Workday finished',
    startedAt: now,
  })

  appendWorkdayEvent({
    employeeId,
    type: 'work_finished',
    label: 'Digital workday finished',
    startedAt: now,
    currentProjectId: null,
    currentTaskId: null,
  })

  emitEvent({
    type: 'workday.finished',
    sourceType: 'employee',
    sourceId: employeeId,
    employeeId,
    workspaceId: null,
    reportId: null,
    metadata: {
      message: `${resolveEmployeeLabel(employeeId).codename} finished the workday`,
      tasksCompleted: summary.tasksCompleted,
      reportsCreated: summary.reportsCreated,
    },
    severity: 'success',
  })

  return next
}

export function getCompanyWorkdayDashboard(): WorkdayCompanyDashboard {
  const workdays = syncWorkdaysFromPlatform()
  const entries = workdays.map(toDashboardEntry)
  const date = getTodayDateKey()
  const tasksInProgress = loadDeliveryTasks().filter((item) => item.status === 'in_progress').length
  const reportsToday = loadReports().filter((item) => {
    const start = new Date(`${date}T00:00:00`)
    return new Date(item.createdAt) >= start
  }).length

  const started = entries.filter((item) => item.bucket === 'started')
  const idle = entries.filter((item) => item.bucket === 'idle')
  const blocked = entries.filter((item) => item.bucket === 'blocked')
  const finished = entries.filter((item) => item.bucket === 'finished')
  const notStarted = entries.filter((item) => item.bucket === 'notStarted')

  const avgPhasesCompleted =
    workdays.length === 0
      ? 0
      : Math.round(
          workdays.reduce((sum, item) => sum + workdayPhaseIndex(item.phase), 0) / workdays.length,
        )

  const summary: WorkdayDailySummary = {
    totalEmployees: entries.length,
    startedCount: started.length,
    idleCount: idle.length,
    blockedCount: blocked.length,
    finishedCount: finished.length,
    notStartedCount: notStarted.length,
    avgPhasesCompleted,
    reportsToday,
    tasksInProgress,
  }

  return {
    date,
    scheduledStartAt: scheduledDayStartIso(),
    started,
    idle,
    blocked,
    finished,
    notStarted,
    summary,
  }
}

function ensureSeedWorkdays(): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(SEED_KEY)) return

  const date = getTodayDateKey()
  const companyId = DEFAULT_COMPANY_ID
  const morning = scheduledDayStartIso()

  const seeds: Array<{
    employeeId: string
    phase: WorkdayPhase
    state: WorkdayState
    startedAt: string
    blockedReason?: string
  }> = [
    { employeeId: 'ag-max', phase: 'execute_tasks', state: 'working', startedAt: morning },
    { employeeId: 'ag-cto', phase: 'agenda', state: 'planning', startedAt: morning },
    { employeeId: 'ag-qa', phase: 'check_approvals', state: 'waiting', startedAt: morning },
    {
      employeeId: 'ag-arch',
      phase: 'execute_tasks',
      state: 'waiting',
      startedAt: morning,
      blockedReason: 'Waiting on Owner approval for architecture decision',
    },
    { employeeId: 'ag-devops', phase: 'review', state: 'reviewing', startedAt: morning },
  ]

  seeds.forEach((seed) => {
    const workday = createEmptyWorkday({ employeeId: seed.employeeId, companyId, date })
    upsertWorkday(
      appendPhaseLog(
        {
          ...workday,
          startedAt: seed.startedAt,
          phase: seed.phase,
          state: seed.state,
          agendaItems: buildAgendaForEmployee(seed.employeeId),
          blockedReason: seed.blockedReason ?? null,
        },
        seed.phase,
        seed.state,
        'Seeded morning workday',
      ),
    )
  })

  localStorage.setItem(SEED_KEY, '1')
}

export function initializeWorkdayEngine(): WorkdayCompanyDashboard {
  ensureSeedWorkdays()
  return getCompanyWorkdayDashboard()
}

export function getWorkdayForEmployee(employeeId: string): EmployeeWorkday | null {
  syncWorkdaysFromPlatform()
  return getTodayWorkdayForEmployee(employeeId)
}
