/**
 * Employee Operating Day Workspace — per-employee "Сегодня" (AI-COMPANY-104B).
 * Separate from MAX Workspace and company Operating Day board.
 */

export const EMPLOYEE_OPERATING_DAY_VERSION = 'v1' as const

export const EMPLOYEE_OPERATING_DAY_STATUSES = [
  'not_started',
  'active',
  'paused',
  'finished',
] as const

export type EmployeeOperatingDayStatus = (typeof EMPLOYEE_OPERATING_DAY_STATUSES)[number]

export type EmployeeOperatingDayCurrentTask = {
  workItemId: string
  title: string
  status: string
  summary: string | null
  href: string | null
}

export type EmployeeOperatingDayActions = {
  canStart: boolean
  canContinue: boolean
  canFinish: boolean
  canPause: boolean
  canResume: boolean
}

export type EmployeeOperatingDaySnapshot = {
  version: typeof EMPLOYEE_OPERATING_DAY_VERSION
  employeeId: string
  employeeLabel: string
  dateKey: string
  status: EmployeeOperatingDayStatus
  workdayStarted: boolean
  startedAt: string | null
  finishedAt: string | null
  tasksCompleted: number
  tasksRemaining: number
  currentTask: EmployeeOperatingDayCurrentTask | null
  workHoursMinutes: number
  consultationsCount: number
  decisionsCount: number
  reportsCount: number
  daySummary: string | null
  actions: EmployeeOperatingDayActions
  continueHref: string | null
}
