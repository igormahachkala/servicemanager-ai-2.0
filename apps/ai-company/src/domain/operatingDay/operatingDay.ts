/**
 * Operating Day Engine V1 — employee shift orchestration (AI-COMPANY-104A).
 *
 * NOT Autonomous Scheduler (queue order only).
 * NOT MAX Worker Loop (single task execution).
 * NOT company OperatingDaySnapshot (Command Center UI aggregate).
 *
 * Orchestrates one employee shift:
 * start → Work Queue → task cycle (Decision Plan → Consult Peer → Worker Loop → Journal) → finish → Summary.
 */

import { DEFAULT_COMPANY_ID } from '../company/company'

export const OPERATING_DAY_VERSION = 'v1' as const

export type OperatingDayVersion = typeof OPERATING_DAY_VERSION

/** Lifecycle of an employee operating day session. */
export const OPERATING_DAY_STATES = [
  'not_started',
  'running',
  'paused',
  'between_tasks',
  'processing_task',
  'awaiting_finish',
  'finished',
] as const

export type OperatingDayState = (typeof OPERATING_DAY_STATES)[number]

/** Phases within one Work Queue task cycle. */
export const OPERATING_DAY_TASK_CYCLE_PHASES = [
  'queue_select',
  'decision_plan',
  'consult_peer',
  'worker_loop',
  'journal',
  'completed',
  'failed',
  'skipped',
] as const

export type OperatingDayTaskCyclePhase = (typeof OPERATING_DAY_TASK_CYCLE_PHASES)[number]

export type OperatingDayTaskCycle = {
  workItemId: string
  workItemTitle: string
  phase: OperatingDayTaskCyclePhase
  workerLoopId: string | null
  decisionPlanId: string | null
  journalEntryId: string | null
  runtimeRunId: string | null
  startedAt: string
  finishedAt: string | null
  ok: boolean | null
  errorMessage: string | null
}

export type OperatingDaySession = {
  id: string
  version: OperatingDayVersion
  operatingDayId: string
  employeeId: string
  companyId: string
  state: OperatingDayState
  dateKey: string
  startedAt: string
  pausedAt: string | null
  resumedAt: string | null
  finishedAt: string | null
  currentTaskCycle: OperatingDayTaskCycle | null
  completedTaskCycles: OperatingDayTaskCycle[]
  queueSnapshotAt: string | null
  pendingWorkItemIds: string[]
  processedWorkItemIds: string[]
  skippedWorkItemIds: string[]
  lastErrorMessage: string | null
  updatedAt: string
}

export type OperatingDaySummary = {
  employeeId: string
  companyId: string
  dateKey: string
  startedAt: string
  finishedAt: string
  tasksCompleted: number
  tasksFailed: number
  tasksSkipped: number
  journalEntryIds: string[]
  workerLoopIds: string[]
  workItemIds: string[]
  /** Human-readable end-of-day note (RU domain copy). */
  narrative: string
}

export type OperatingDay = {
  id: string
  version: OperatingDayVersion
  employeeId: string
  companyId: string
  dateKey: string
  state: OperatingDayState
  sessionId: string | null
  summary: OperatingDaySummary | null
  createdAt: string
  updatedAt: string
}

export type StartOperatingDayInput = {
  employeeId: string
  companyId?: string | null
  /** YYYY-MM-DD — default: today (UTC slice). */
  dateKey?: string | null
}

export type ContinueOperatingDayInput = {
  employeeId: string
}

export type FinishOperatingDayInput = {
  employeeId: string
}

export type PauseOperatingDayInput = {
  employeeId: string
  reason?: string | null
}

export type ResumeOperatingDayInput = {
  employeeId: string
}

export type OperatingDayActionResult = {
  day: OperatingDay
  session: OperatingDaySession
  summary: OperatingDaySummary | null
}

export type ContinueOperatingDayResult = OperatingDayActionResult & {
  taskCycle: OperatingDayTaskCycle | null
  queueEmpty: boolean
  paused: boolean
  finished: boolean
  errorMessage: string | null
}

const TERMINAL_DAY_STATES: OperatingDayState[] = ['finished']

export function createOperatingDayId(now: Date = new Date()): string {
  return `opday-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`
}

export function createOperatingDaySessionId(now: Date = new Date()): string {
  return `opds-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`
}

export function dateKeyFromDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export function isTerminalOperatingDayState(state: OperatingDayState): boolean {
  return TERMINAL_DAY_STATES.includes(state)
}

export function isActiveOperatingDayState(state: OperatingDayState): boolean {
  return !isTerminalOperatingDayState(state) && state !== 'not_started'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseTaskCyclePhase(value: unknown): OperatingDayTaskCyclePhase {
  if (
    typeof value === 'string' &&
    (OPERATING_DAY_TASK_CYCLE_PHASES as readonly string[]).includes(value)
  ) {
    return value as OperatingDayTaskCyclePhase
  }
  return 'queue_select'
}

function parseOperatingDayState(value: unknown): OperatingDayState {
  if (typeof value === 'string' && (OPERATING_DAY_STATES as readonly string[]).includes(value)) {
    return value as OperatingDayState
  }
  return 'not_started'
}

export function parseOperatingDayTaskCycle(value: unknown): OperatingDayTaskCycle | null {
  if (!isRecord(value)) return null
  if (typeof value.workItemId !== 'string' || typeof value.workItemTitle !== 'string') return null

  return {
    workItemId: value.workItemId,
    workItemTitle: value.workItemTitle,
    phase: parseTaskCyclePhase(value.phase),
    workerLoopId: typeof value.workerLoopId === 'string' ? value.workerLoopId : null,
    decisionPlanId: typeof value.decisionPlanId === 'string' ? value.decisionPlanId : null,
    journalEntryId: typeof value.journalEntryId === 'string' ? value.journalEntryId : null,
    runtimeRunId: typeof value.runtimeRunId === 'string' ? value.runtimeRunId : null,
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : new Date().toISOString(),
    finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : null,
    ok: typeof value.ok === 'boolean' ? value.ok : value.ok === null ? null : null,
    errorMessage: typeof value.errorMessage === 'string' ? value.errorMessage : null,
  }
}

export function parseOperatingDaySummary(value: unknown): OperatingDaySummary | null {
  if (!isRecord(value)) return null
  if (typeof value.employeeId !== 'string' || typeof value.dateKey !== 'string') return null

  const journalEntryIds = Array.isArray(value.journalEntryIds)
    ? value.journalEntryIds.filter((item): item is string => typeof item === 'string')
    : []
  const workerLoopIds = Array.isArray(value.workerLoopIds)
    ? value.workerLoopIds.filter((item): item is string => typeof item === 'string')
    : []
  const workItemIds = Array.isArray(value.workItemIds)
    ? value.workItemIds.filter((item): item is string => typeof item === 'string')
    : []

  return {
    employeeId: value.employeeId,
    companyId: typeof value.companyId === 'string' ? value.companyId : DEFAULT_COMPANY_ID,
    dateKey: value.dateKey,
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : new Date().toISOString(),
    finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : new Date().toISOString(),
    tasksCompleted: typeof value.tasksCompleted === 'number' ? value.tasksCompleted : 0,
    tasksFailed: typeof value.tasksFailed === 'number' ? value.tasksFailed : 0,
    tasksSkipped: typeof value.tasksSkipped === 'number' ? value.tasksSkipped : 0,
    journalEntryIds,
    workerLoopIds,
    workItemIds,
    narrative: typeof value.narrative === 'string' ? value.narrative : '',
  }
}

export function parseOperatingDaySession(value: unknown): OperatingDaySession | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.employeeId !== 'string') return null

  const completedTaskCycles = Array.isArray(value.completedTaskCycles)
    ? value.completedTaskCycles
        .map(parseOperatingDayTaskCycle)
        .filter((item): item is OperatingDayTaskCycle => item !== null)
    : []

  const pendingWorkItemIds = Array.isArray(value.pendingWorkItemIds)
    ? value.pendingWorkItemIds.filter((item): item is string => typeof item === 'string')
    : []
  const processedWorkItemIds = Array.isArray(value.processedWorkItemIds)
    ? value.processedWorkItemIds.filter((item): item is string => typeof item === 'string')
    : []
  const skippedWorkItemIds = Array.isArray(value.skippedWorkItemIds)
    ? value.skippedWorkItemIds.filter((item): item is string => typeof item === 'string')
    : []

  const currentTaskCycle = value.currentTaskCycle
    ? parseOperatingDayTaskCycle(value.currentTaskCycle)
    : null

  return {
    id: value.id,
    version: OPERATING_DAY_VERSION,
    operatingDayId: typeof value.operatingDayId === 'string' ? value.operatingDayId : '',
    employeeId: value.employeeId,
    companyId: typeof value.companyId === 'string' ? value.companyId : DEFAULT_COMPANY_ID,
    state: parseOperatingDayState(value.state),
    dateKey: typeof value.dateKey === 'string' ? value.dateKey : dateKeyFromDate(),
    startedAt: typeof value.startedAt === 'string' ? value.startedAt : new Date().toISOString(),
    pausedAt: typeof value.pausedAt === 'string' ? value.pausedAt : null,
    resumedAt: typeof value.resumedAt === 'string' ? value.resumedAt : null,
    finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : null,
    currentTaskCycle,
    completedTaskCycles,
    queueSnapshotAt: typeof value.queueSnapshotAt === 'string' ? value.queueSnapshotAt : null,
    pendingWorkItemIds,
    processedWorkItemIds,
    skippedWorkItemIds,
    lastErrorMessage: typeof value.lastErrorMessage === 'string' ? value.lastErrorMessage : null,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  }
}

export function parseOperatingDay(value: unknown): OperatingDay | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.employeeId !== 'string') return null

  const summary = value.summary ? parseOperatingDaySummary(value.summary) : null

  return {
    id: value.id,
    version: OPERATING_DAY_VERSION,
    employeeId: value.employeeId,
    companyId: typeof value.companyId === 'string' ? value.companyId : DEFAULT_COMPANY_ID,
    dateKey: typeof value.dateKey === 'string' ? value.dateKey : dateKeyFromDate(),
    state: parseOperatingDayState(value.state),
    sessionId: typeof value.sessionId === 'string' ? value.sessionId : null,
    summary,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  }
}

export function buildOperatingDaySummary(
  day: OperatingDay,
  session: OperatingDaySession,
  finishedAt: string,
): OperatingDaySummary {
  const completed = session.completedTaskCycles.filter((cycle) => cycle.ok === true)
  const failed = session.completedTaskCycles.filter((cycle) => cycle.ok === false)

  return {
    employeeId: day.employeeId,
    companyId: day.companyId,
    dateKey: day.dateKey,
    startedAt: session.startedAt,
    finishedAt,
    tasksCompleted: completed.length,
    tasksFailed: failed.length,
    tasksSkipped: session.skippedWorkItemIds.length,
    journalEntryIds: completed
      .map((cycle) => cycle.journalEntryId)
      .filter((id): id is string => Boolean(id)),
    workerLoopIds: completed
      .map((cycle) => cycle.workerLoopId)
      .filter((id): id is string => Boolean(id)),
    workItemIds: [...session.processedWorkItemIds],
    narrative: `Рабочий день ${day.dateKey}: выполнено ${completed.length}, ошибок ${failed.length}, пропущено ${session.skippedWorkItemIds.length}.`,
  }
}
