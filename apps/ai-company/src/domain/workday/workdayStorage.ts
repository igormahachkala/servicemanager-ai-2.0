import {
  WORKDAY_PHASES,
  type WorkdayPhase,
  scheduledDayStartIso,
} from './workdayPhase'
import { WORKDAY_STATES, type WorkdayState } from './workdayState'
import type {
  EmployeeWorkday,
  WorkdayAgendaItem,
  WorkdayAgendaSource,
  WorkdayPhaseLogEntry,
  WorkdaySummary,
} from './workday'

export const STORAGE_KEY = 'ai-company-workdays'
export const CHANGE_EVENT = 'ai-company-workday-change'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parsePhase(value: unknown): WorkdayPhase {
  if (typeof value === 'string' && WORKDAY_PHASES.includes(value as WorkdayPhase)) {
    return value as WorkdayPhase
  }
  return 'day_start'
}

function parseState(value: unknown): WorkdayState {
  if (typeof value === 'string' && WORKDAY_STATES.includes(value as WorkdayState)) {
    return value as WorkdayState
  }
  return 'starting'
}

function parseAgendaSource(value: unknown): WorkdayAgendaSource {
  const sources: WorkdayAgendaSource[] = [
    'task',
    'approval',
    'notification',
    'knowledge',
    'handoff',
    'sprint',
    'report',
  ]
  if (typeof value === 'string' && sources.includes(value as WorkdayAgendaSource)) {
    return value as WorkdayAgendaSource
  }
  return 'task'
}

function parseAgendaItem(value: unknown): WorkdayAgendaItem | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.label !== 'string') return null
  return {
    id: value.id,
    label: value.label,
    source: parseAgendaSource(value.source),
    sourceId: typeof value.sourceId === 'string' ? value.sourceId : null,
    completed: value.completed === true,
  }
}

function parsePhaseLog(value: unknown): WorkdayPhaseLogEntry | null {
  if (!isRecord(value)) return null
  if (typeof value.at !== 'string') return null
  return {
    phase: parsePhase(value.phase),
    state: parseState(value.state),
    at: value.at,
    note: typeof value.note === 'string' ? value.note : undefined,
  }
}

function parseSummary(value: unknown): WorkdaySummary | null {
  if (!isRecord(value)) return null
  return {
    tasksCompleted: typeof value.tasksCompleted === 'number' ? value.tasksCompleted : 0,
    reportsCreated: typeof value.reportsCreated === 'number' ? value.reportsCreated : 0,
    approvalsHandled: typeof value.approvalsHandled === 'number' ? value.approvalsHandled : 0,
    knowledgeRead: typeof value.knowledgeRead === 'number' ? value.knowledgeRead : 0,
    notificationsChecked: typeof value.notificationsChecked === 'number' ? value.notificationsChecked : 0,
    phasesCompleted: typeof value.phasesCompleted === 'number' ? value.phasesCompleted : 0,
    totalPhases: typeof value.totalPhases === 'number' ? value.totalPhases : WORKDAY_PHASES.length,
    agendaCompleted: typeof value.agendaCompleted === 'number' ? value.agendaCompleted : 0,
    agendaTotal: typeof value.agendaTotal === 'number' ? value.agendaTotal : 0,
  }
}

export function parseEmployeeWorkday(value: unknown): EmployeeWorkday | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.employeeId !== 'string' ||
    typeof value.companyId !== 'string' ||
    typeof value.date !== 'string'
  ) {
    return null
  }

  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString()
  const agendaRaw = Array.isArray(value.agendaItems) ? value.agendaItems : []
  const logRaw = Array.isArray(value.phaseLog) ? value.phaseLog : []

  return {
    id: value.id,
    employeeId: value.employeeId,
    companyId: value.companyId,
    date: value.date,
    scheduledStartAt:
      typeof value.scheduledStartAt === 'string' ? value.scheduledStartAt : scheduledDayStartIso(),
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : null,
    finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : null,
    phase: parsePhase(value.phase),
    state: parseState(value.state),
    agendaItems: agendaRaw.map(parseAgendaItem).filter((item): item is WorkdayAgendaItem => item !== null),
    phaseLog: logRaw.map(parsePhaseLog).filter((item): item is WorkdayPhaseLogEntry => item !== null),
    summary: parseSummary(value.summary),
    blockedReason: typeof value.blockedReason === 'string' ? value.blockedReason : null,
    idleSince: typeof value.idleSince === 'string' ? value.idleSince : null,
    updatedAt,
  }
}

export function loadWorkdays(): EmployeeWorkday[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseEmployeeWorkday).filter((item): item is EmployeeWorkday => item !== null)
  } catch {
    return []
  }
}

export function saveWorkdays(workdays: EmployeeWorkday[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workdays))
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch {
    /* noop */
  }
}

export function getWorkdayById(id: string): EmployeeWorkday | null {
  return loadWorkdays().find((item) => item.id === id) ?? null
}

export function getTodayDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getWorkdayForEmployeeOnDate(employeeId: string, date: string): EmployeeWorkday | null {
  return loadWorkdays().find((item) => item.employeeId === employeeId && item.date === date) ?? null
}

export function getTodayWorkdayForEmployee(employeeId: string): EmployeeWorkday | null {
  return getWorkdayForEmployeeOnDate(employeeId, getTodayDateKey())
}

export function upsertWorkday(workday: EmployeeWorkday): EmployeeWorkday {
  const all = loadWorkdays()
  const index = all.findIndex((item) => item.id === workday.id)
  const next = { ...workday, updatedAt: new Date().toISOString() }
  if (index >= 0) {
    all[index] = next
  } else {
    all.unshift(next)
  }
  saveWorkdays(all)
  return next
}

export function createEmptyWorkday(input: {
  employeeId: string
  companyId: string
  date?: string
}): EmployeeWorkday {
  const date = input.date ?? getTodayDateKey()
  return {
    id: `workday-${input.employeeId}-${date}`,
    employeeId: input.employeeId,
    companyId: input.companyId,
    date,
    scheduledStartAt: scheduledDayStartIso(new Date(`${date}T12:00:00`)),
    startedAt: null,
    finishedAt: null,
    phase: 'day_start',
    state: 'starting',
    agendaItems: [],
    phaseLog: [],
    summary: null,
    blockedReason: null,
    idleSince: null,
    updatedAt: new Date().toISOString(),
  }
}
