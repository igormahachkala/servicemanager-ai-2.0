/**
 * Operating Day Engine V1 — shift orchestration API (AI-COMPANY-104A).
 *
 * Flow per continueOperatingDay():
 * Work Queue → select next → Decision Plan → Consult Peer → Worker Loop → Journal → next.
 */

import { DEFAULT_COMPANY_ID } from '../company/company'
import { getEmployeeDailyJournalEntryByMaxWorkerLoopId } from '../employeeDailyJournal/employeeDailyJournalStorage'
import {
  assignEmployeeWorkItem,
  completeEmployeeWorkItem,
  listEmployeeWorkQueue,
  pickNextWorkItem,
  skipEmployeeWorkItem,
  startNextEmployeeWorkItem,
  type WorkItem,
} from '../employeeWorkQueue'
import { emitEvent } from '../events/eventStorage'
import {
  AI_PHOTO_LAB_PROJECT_ID,
  AI_PHOTO_LAB_WORKSPACE_ID,
} from '../projects/aiPhotoLabIds'
import { MAX_WORKER_EMPLOYEE_ID, runMaxWorkerLoopV1 } from '../maxWorkerLoop'
import {
  buildOperatingDaySummary,
  createOperatingDayId,
  createOperatingDaySessionId,
  dateKeyFromDate,
  type ContinueOperatingDayInput,
  type ContinueOperatingDayResult,
  type FinishOperatingDayInput,
  type OperatingDay,
  type OperatingDayActionResult,
  type OperatingDaySession,
  type OperatingDayTaskCycle,
  type OperatingDayTaskCyclePhase,
  type PauseOperatingDayInput,
  type ResumeOperatingDayInput,
  type StartOperatingDayInput,
} from './operatingDay'
import {
  getActiveOperatingDaySession,
  getOperatingDayForEmployeeDate,
  getOperatingDaySessionById,
  patchOperatingDayState,
  upsertOperatingDay,
  upsertOperatingDaySession,
} from './operatingDayStorage'

function nowIso(): string {
  return new Date().toISOString()
}

function snapshotPendingWorkItemIds(employeeId: string): string[] {
  const queue = listEmployeeWorkQueue(employeeId)
  return queue.items
    .filter((item) => item.status === 'pending' || item.status === 'scheduled')
    .sort((a, b) => a.queuePosition - b.queuePosition)
    .map((item) => item.id)
}

function resolveInitialSessionState(employeeId: string): OperatingDaySession['state'] {
  const queue = listEmployeeWorkQueue(employeeId)
  const hasRunnable = Boolean(pickNextWorkItem(queue.items) || queue.activeItem)
  return hasRunnable ? 'running' : 'awaiting_finish'
}

function persistPair(day: OperatingDay, session: OperatingDaySession): OperatingDayActionResult {
  const savedSession = upsertOperatingDaySession(session)
  const savedDay = upsertOperatingDay({
    ...day,
    sessionId: savedSession.id,
    state: savedSession.state === 'finished' ? 'finished' : savedSession.state,
    updatedAt: nowIso(),
  })
  return {
    day: savedDay,
    session: savedSession,
    summary: savedDay.summary,
  }
}

function emitOperatingDayEvent(
  type: 'workday.started' | 'workday.finished' | 'task.completed' | 'runtime.failed',
  day: OperatingDay,
  session: OperatingDaySession,
  message: string,
): void {
  emitEvent({
    type,
    sourceType: 'employee',
    sourceId: day.employeeId,
    employeeId: day.employeeId,
    workspaceId: null,
    reportId: null,
    metadata: {
      message,
      operatingDayId: day.id,
      sessionId: session.id,
      dateKey: day.dateKey,
      source: 'operating-day-engine',
    },
    severity: type === 'runtime.failed' ? 'warn' : 'info',
  })
}

function buildActionResult(day: OperatingDay, session: OperatingDaySession): OperatingDayActionResult {
  return { day, session, summary: day.summary }
}

function appendCompletedCycle(
  session: OperatingDaySession,
  cycle: OperatingDayTaskCycle,
): OperatingDaySession {
  const processed = session.processedWorkItemIds.includes(cycle.workItemId)
    ? session.processedWorkItemIds
    : [...session.processedWorkItemIds, cycle.workItemId]

  const pending = session.pendingWorkItemIds.filter((id) => id !== cycle.workItemId)
  const skipped =
    cycle.ok === false && !session.skippedWorkItemIds.includes(cycle.workItemId)
      ? [...session.skippedWorkItemIds, cycle.workItemId]
      : session.skippedWorkItemIds

  return {
    ...session,
    currentTaskCycle: null,
    completedTaskCycles: [...session.completedTaskCycles, cycle],
    processedWorkItemIds: processed,
    pendingWorkItemIds: pending,
    skippedWorkItemIds: skipped,
    updatedAt: nowIso(),
  }
}

function resolvePostTaskSessionState(employeeId: string): OperatingDaySession['state'] {
  const queue = listEmployeeWorkQueue(employeeId)
  if (queue.activeItem) return 'between_tasks'
  if (pickNextWorkItem(queue.items)) return 'between_tasks'
  return 'awaiting_finish'
}

function patchCyclePhase(
  cycle: OperatingDayTaskCycle,
  phase: OperatingDayTaskCyclePhase,
  patch: Partial<OperatingDayTaskCycle> = {},
): OperatingDayTaskCycle {
  return { ...cycle, phase, ...patch }
}

async function executeOperatingDayTaskCycle(
  session: OperatingDaySession,
  employeeId: string,
): Promise<{ session: OperatingDaySession; cycle: OperatingDayTaskCycle | null; errorMessage: string | null }> {
  const queue = listEmployeeWorkQueue(employeeId)
  let workItem: WorkItem | null = queue.activeItem

  if (!workItem) {
    if (!pickNextWorkItem(queue.items)) {
      return { session, cycle: null, errorMessage: null }
    }
    workItem = startNextEmployeeWorkItem(employeeId)
    if (!workItem) {
      return {
        session: {
          ...session,
          lastErrorMessage: 'Не удалось взять следующую задачу из Work Queue.',
          updatedAt: nowIso(),
        },
        cycle: null,
        errorMessage: 'Не удалось взять следующую задачу из Work Queue.',
      }
    }
  }

  const startedAt = nowIso()
  let cycle: OperatingDayTaskCycle = {
    workItemId: workItem.id,
    workItemTitle: workItem.title,
    phase: 'queue_select',
    workerLoopId: null,
    decisionPlanId: null,
    journalEntryId: null,
    runtimeRunId: null,
    startedAt,
    finishedAt: null,
    ok: null,
    errorMessage: null,
  }

  let nextSession: OperatingDaySession = {
    ...session,
    state: 'processing_task',
    currentTaskCycle: cycle,
    lastErrorMessage: null,
    updatedAt: startedAt,
  }

  if (employeeId !== MAX_WORKER_EMPLOYEE_ID) {
    const reason = `V1 Operating Day Engine запускает Worker Loop только для ${MAX_WORKER_EMPLOYEE_ID}.`
    skipEmployeeWorkItem({ workItemId: workItem.id, reason })
    cycle = patchCyclePhase(cycle, 'skipped', {
      ok: false,
      finishedAt: nowIso(),
      errorMessage: reason,
    })
    nextSession = appendCompletedCycle(
      { ...nextSession, state: resolvePostTaskSessionState(employeeId) },
      cycle,
    )
    return { session: nextSession, cycle, errorMessage: reason }
  }

  cycle = patchCyclePhase(cycle, 'decision_plan')
  nextSession = { ...nextSession, currentTaskCycle: cycle }

  const taskText = workItem.taskText?.trim() || workItem.title
  const loopResult = await runMaxWorkerLoopV1({
    taskText,
    title: workItem.title,
    projectId: workItem.projectId ?? AI_PHOTO_LAB_PROJECT_ID,
    workspaceId: workItem.workspaceId ?? AI_PHOTO_LAB_WORKSPACE_ID,
    priority: workItem.priority,
  })

  assignEmployeeWorkItem({
    workItemId: workItem.id,
    workerLoopId: loopResult.loop.id,
    decisionPlanId: loopResult.loop.decisionPlan?.id ?? null,
  })

  cycle = patchCyclePhase(cycle, 'consult_peer', {
    workerLoopId: loopResult.loop.id,
    decisionPlanId: loopResult.loop.decisionPlan?.id ?? null,
    runtimeRunId: loopResult.loop.runtimeRunId,
  })
  nextSession = { ...nextSession, currentTaskCycle: cycle }

  cycle = patchCyclePhase(cycle, 'worker_loop')

  if (loopResult.loop.status === 'completed') {
    const journal = getEmployeeDailyJournalEntryByMaxWorkerLoopId(loopResult.loop.id)
    cycle = patchCyclePhase(cycle, 'journal', {
      journalEntryId: journal?.id ?? null,
    })

    completeEmployeeWorkItem({
      workItemId: workItem.id,
      completedAt: loopResult.loop.finishedAt ?? nowIso(),
    })

    cycle = patchCyclePhase(cycle, 'completed', {
      ok: true,
      finishedAt: loopResult.loop.finishedAt ?? nowIso(),
      errorMessage: null,
    })

    nextSession = appendCompletedCycle(
      { ...nextSession, state: resolvePostTaskSessionState(employeeId) },
      cycle,
    )
    return { session: nextSession, cycle, errorMessage: null }
  }

  const failMessage = loopResult.loop.errorMessage ?? `Worker Loop: ${loopResult.loop.status}`
  skipEmployeeWorkItem({ workItemId: workItem.id, reason: failMessage })

  cycle = patchCyclePhase(cycle, 'failed', {
    ok: false,
    finishedAt: nowIso(),
    errorMessage: failMessage,
  })

  nextSession = appendCompletedCycle(
    {
      ...nextSession,
      state: resolvePostTaskSessionState(employeeId),
      lastErrorMessage: failMessage,
    },
    cycle,
  )

  return { session: nextSession, cycle, errorMessage: failMessage }
}

/**
 * Starts an employee operating day: loads Work Queue snapshot and opens session.
 * Idempotent for the same employee + dateKey while session is active.
 */
export function startOperatingDay(input: StartOperatingDayInput): OperatingDayActionResult {
  const employeeId = input.employeeId.trim()
  const companyId = input.companyId ?? DEFAULT_COMPANY_ID
  const dateKey = input.dateKey ?? dateKeyFromDate()
  const now = nowIso()

  const existingDay = getOperatingDayForEmployeeDate(employeeId, dateKey)
  if (existingDay?.sessionId) {
    const existingSession = getOperatingDaySessionById(existingDay.sessionId)
    if (existingSession && existingSession.state !== 'finished') {
      return buildActionResult(existingDay, existingSession)
    }
  }

  const active = getActiveOperatingDaySession(employeeId)
  if (active) {
    const day = getOperatingDayForEmployeeDate(employeeId, active.dateKey)
    if (day) return buildActionResult(day, active)
  }

  const dayId = createOperatingDayId()
  const sessionId = createOperatingDaySessionId()
  const pendingIds = snapshotPendingWorkItemIds(employeeId)
  const initialState = resolveInitialSessionState(employeeId)

  const session: OperatingDaySession = {
    id: sessionId,
    version: 'v1',
    operatingDayId: dayId,
    employeeId,
    companyId,
    state: initialState,
    dateKey,
    startedAt: now,
    pausedAt: null,
    resumedAt: null,
    finishedAt: null,
    currentTaskCycle: null,
    completedTaskCycles: [],
    queueSnapshotAt: now,
    pendingWorkItemIds: pendingIds,
    processedWorkItemIds: [],
    skippedWorkItemIds: [],
    lastErrorMessage: null,
    updatedAt: now,
  }

  const day: OperatingDay = {
    id: dayId,
    version: 'v1',
    employeeId,
    companyId,
    dateKey,
    state: initialState,
    sessionId,
    summary: null,
    createdAt: now,
    updatedAt: now,
  }

  const saved = persistPair(day, session)
  emitOperatingDayEvent(
    'workday.started',
    saved.day,
    saved.session,
    `Operating Day начат: ${employeeId} · ${dateKey} · задач в очереди: ${pendingIds.length}`,
  )
  return saved
}

/**
 * Continues the operating day by running one full task cycle from Work Queue.
 */
export async function continueOperatingDay(
  input: ContinueOperatingDayInput,
): Promise<ContinueOperatingDayResult> {
  const employeeId = input.employeeId.trim()
  let session = getActiveOperatingDaySession(employeeId)

  if (!session) {
    const started = startOperatingDay({ employeeId })
    if (started.session.state === 'awaiting_finish') {
      return {
        ...started,
        taskCycle: null,
        queueEmpty: true,
        paused: false,
        finished: false,
        errorMessage: 'Work Queue пуста — завершите день через finishOperatingDay().',
      }
    }
    return continueOperatingDay({ employeeId })
  }

  const day =
    getOperatingDayForEmployeeDate(employeeId, session.dateKey) ??
    ({
      id: session.operatingDayId,
      version: 'v1' as const,
      employeeId,
      companyId: session.companyId,
      dateKey: session.dateKey,
      state: session.state,
      sessionId: session.id,
      summary: null,
      createdAt: session.startedAt,
      updatedAt: session.updatedAt,
    } satisfies OperatingDay)

  if (session.state === 'paused') {
    return {
      ...buildActionResult(day, session),
      taskCycle: null,
      queueEmpty: false,
      paused: true,
      finished: false,
      errorMessage: 'Operating Day на паузе — вызовите resumeOperatingDay().',
    }
  }

  if (session.state === 'finished') {
    return {
      ...buildActionResult(day, session),
      taskCycle: null,
      queueEmpty: true,
      paused: false,
      finished: true,
      errorMessage: null,
    }
  }

  if (session.state === 'awaiting_finish') {
    const queue = listEmployeeWorkQueue(employeeId)
    const hasWork = Boolean(pickNextWorkItem(queue.items) || queue.activeItem)
    if (!hasWork) {
      return {
        ...buildActionResult(day, session),
        taskCycle: null,
        queueEmpty: true,
        paused: false,
        finished: false,
        errorMessage: 'Задач в Work Queue больше нет — завершите день через finishOperatingDay().',
      }
    }
    session = { ...session, state: 'running', updatedAt: nowIso() }
  }

  if (session.state === 'processing_task') {
    return {
      ...buildActionResult(day, session),
      taskCycle: session.currentTaskCycle,
      queueEmpty: false,
      paused: false,
      finished: false,
      errorMessage: 'Задача уже выполняется — дождитесь завершения цикла.',
    }
  }

  const { session: nextSession, cycle, errorMessage } = await executeOperatingDayTaskCycle(
    session,
    employeeId,
  )

  if (!cycle) {
    const awaitingSession = { ...nextSession, state: 'awaiting_finish' as const, updatedAt: nowIso() }
    const saved = persistPair(
      { ...day, state: 'awaiting_finish', updatedAt: nowIso() },
      awaitingSession,
    )
    return {
      ...saved,
      taskCycle: null,
      queueEmpty: true,
      paused: false,
      finished: false,
      errorMessage: errorMessage ?? 'Work Queue пуста.',
    }
  }

  const saved = persistPair({ ...day, state: nextSession.state, updatedAt: nowIso() }, nextSession)

  if (cycle.ok) {
    emitOperatingDayEvent(
      'task.completed',
      saved.day,
      saved.session,
      `Operating Day · задача выполнена: ${cycle.workItemTitle}`,
    )
  } else {
    emitOperatingDayEvent(
      'runtime.failed',
      saved.day,
      saved.session,
      cycle.errorMessage ?? `Operating Day · ошибка: ${cycle.workItemTitle}`,
    )
  }

  const queue = listEmployeeWorkQueue(employeeId)
  const queueEmpty = !pickNextWorkItem(queue.items) && !queue.activeItem

  return {
    ...saved,
    taskCycle: cycle,
    queueEmpty,
    paused: false,
    finished: false,
    errorMessage: cycle.ok ? null : (cycle.errorMessage ?? errorMessage),
  }
}

/** Finishes the operating day and builds OperatingDaySummary. */
export function finishOperatingDay(input: FinishOperatingDayInput): OperatingDayActionResult {
  const employeeId = input.employeeId.trim()
  const session = getActiveOperatingDaySession(employeeId)

  if (!session) {
    startOperatingDay({ employeeId })
    return finishOperatingDay({ employeeId })
  }

  const day = getOperatingDayForEmployeeDate(employeeId, session.dateKey)
  if (!day) {
    throw new Error(`Operating Day not found for ${employeeId} · ${session.dateKey}`)
  }

  const finishedAt = nowIso()
  const summary = buildOperatingDaySummary(day, session, finishedAt)

  const finishedSession: OperatingDaySession = {
    ...session,
    state: 'finished',
    finishedAt,
    currentTaskCycle: null,
    updatedAt: finishedAt,
  }

  const finishedDay: OperatingDay = {
    ...day,
    state: 'finished',
    summary,
    updatedAt: finishedAt,
  }

  const saved = persistPair(finishedDay, finishedSession)
  emitOperatingDayEvent(
    'workday.finished',
    saved.day,
    saved.session,
    summary.narrative,
  )
  return saved
}

/** Pauses an active operating day between task cycles. */
export function pauseOperatingDay(input: PauseOperatingDayInput): OperatingDayActionResult {
  const employeeId = input.employeeId.trim()
  const session = getActiveOperatingDaySession(employeeId)

  if (!session) {
    return startOperatingDay({ employeeId })
  }

  if (session.state === 'paused' || session.state === 'finished') {
    const day = getOperatingDayForEmployeeDate(employeeId, session.dateKey)
    if (!day) return startOperatingDay({ employeeId })
    return buildActionResult(day, session)
  }

  if (session.state === 'processing_task') {
    const day = getOperatingDayForEmployeeDate(employeeId, session.dateKey)
    if (!day) return startOperatingDay({ employeeId })
    return buildActionResult(day, {
      ...session,
      lastErrorMessage: 'Нельзя поставить на паузу во время выполнения задачи.',
    })
  }

  const now = nowIso()
  const pausedSession: OperatingDaySession = {
    ...session,
    state: 'paused',
    pausedAt: now,
    lastErrorMessage: input.reason?.trim() ?? null,
    updatedAt: now,
  }

  const day = getOperatingDayForEmployeeDate(employeeId, session.dateKey)
  if (!day) return startOperatingDay({ employeeId })

  return persistPair(patchOperatingDayState(day.id, 'paused') ?? { ...day, state: 'paused' }, pausedSession)
}

/** Resumes a paused operating day. */
export function resumeOperatingDay(input: ResumeOperatingDayInput): OperatingDayActionResult {
  const employeeId = input.employeeId.trim()
  const session = getActiveOperatingDaySession(employeeId)

  if (!session) {
    return startOperatingDay({ employeeId })
  }

  if (session.state !== 'paused') {
    const day = getOperatingDayForEmployeeDate(employeeId, session.dateKey)
    if (!day) return startOperatingDay({ employeeId })
    return buildActionResult(day, session)
  }

  const now = nowIso()
  const nextState = resolvePostTaskSessionState(employeeId)
  const resumedSession: OperatingDaySession = {
    ...session,
    state: nextState === 'awaiting_finish' ? 'awaiting_finish' : 'running',
    resumedAt: now,
    pausedAt: null,
    lastErrorMessage: null,
    updatedAt: now,
  }

  const day = getOperatingDayForEmployeeDate(employeeId, session.dateKey)
  if (!day) return startOperatingDay({ employeeId })

  return persistPair(
    patchOperatingDayState(day.id, resumedSession.state) ?? { ...day, state: resumedSession.state },
    resumedSession,
  )
}
