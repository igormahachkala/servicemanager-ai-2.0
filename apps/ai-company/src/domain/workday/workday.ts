import type { WorkdayPhase } from './workdayPhase'
import type { WorkdayState } from './workdayState'

export type WorkdayAgendaSource =
  | 'task'
  | 'approval'
  | 'notification'
  | 'knowledge'
  | 'handoff'
  | 'sprint'
  | 'report'

export type WorkdayAgendaItem = {
  id: string
  label: string
  source: WorkdayAgendaSource
  sourceId: string | null
  completed: boolean
}

export type WorkdayPhaseLogEntry = {
  phase: WorkdayPhase
  state: WorkdayState
  at: string
  note?: string
}

export type WorkdaySummary = {
  tasksCompleted: number
  reportsCreated: number
  approvalsHandled: number
  knowledgeRead: number
  notificationsChecked: number
  phasesCompleted: number
  totalPhases: number
  agendaCompleted: number
  agendaTotal: number
}

export type EmployeeWorkday = {
  id: string
  employeeId: string
  companyId: string
  date: string
  scheduledStartAt: string
  startedAt: string | null
  finishedAt: string | null
  phase: WorkdayPhase
  state: WorkdayState
  agendaItems: WorkdayAgendaItem[]
  phaseLog: WorkdayPhaseLogEntry[]
  summary: WorkdaySummary | null
  blockedReason: string | null
  idleSince: string | null
  updatedAt: string
}

export type WorkdayDashboardBucket = 'started' | 'idle' | 'blocked' | 'finished' | 'notStarted'

export type WorkdayDashboardEntry = {
  workday: EmployeeWorkday
  bucket: WorkdayDashboardBucket
  employeeName: string
  employeeCodename: string
}

export type WorkdayCompanyDashboard = {
  date: string
  scheduledStartAt: string
  started: WorkdayDashboardEntry[]
  idle: WorkdayDashboardEntry[]
  blocked: WorkdayDashboardEntry[]
  finished: WorkdayDashboardEntry[]
  notStarted: WorkdayDashboardEntry[]
  summary: WorkdayDailySummary
}

export type WorkdayDailySummary = {
  totalEmployees: number
  startedCount: number
  idleCount: number
  blockedCount: number
  finishedCount: number
  notStartedCount: number
  avgPhasesCompleted: number
  reportsToday: number
  tasksInProgress: number
}
