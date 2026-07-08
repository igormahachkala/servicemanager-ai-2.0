/**
 * Operating Day Engine ↔ Employee Operating Day Summary bridge (AI-COMPANY-104C).
 */

import type { OperatingDay, OperatingDaySession, OperatingDaySummary } from '../operatingDay/operatingDay'
import {
  buildEmployeeOperatingDaySummary,
  buildEmployeeOperatingDaySummaryNarrative,
} from './operatingDaySummaryEngine'
import type { EmployeeOperatingDaySummary } from './operatingDaySummary'
import {
  getEmployeeOperatingDaySummaryByEmployeeAndDate,
  getEmployeeOperatingDaySummaryById,
  saveEmployeeOperatingDaySummary,
} from './operatingDaySummaryStorage'

export type RecordOperatingDaySummaryOnEngineFinishInput = {
  day: OperatingDay
  session: OperatingDaySession
  finishedAt: string
  now?: Date
}

export type RecordOperatingDaySummaryOnEngineFinishResult = {
  employeeSummary: EmployeeOperatingDaySummary
  operatingDaySummary: OperatingDaySummary
}

export function mapEmployeeSummaryToOperatingDaySummary(
  employeeSummary: EmployeeOperatingDaySummary,
  day: OperatingDay,
  session: OperatingDaySession,
  finishedAt: string,
): OperatingDaySummary {
  const failedCycles = session.completedTaskCycles.filter((cycle) => cycle.ok === false).length

  return {
    employeeId: day.employeeId,
    companyId: day.companyId,
    dateKey: day.dateKey,
    startedAt: employeeSummary.startedAt ?? session.startedAt,
    finishedAt,
    tasksCompleted: employeeSummary.tasksCompletedCount,
    tasksFailed: Math.max(failedCycles, employeeSummary.difficulties.filter((d) => d.kind === 'worker_loop_failed').length),
    tasksSkipped: session.skippedWorkItemIds.length,
    tasksRemaining: employeeSummary.tasksRemainingCount,
    tasksBlocked: employeeSummary.tasksBlockedCount,
    workDurationMs: employeeSummary.workDurationMs,
    employeeOperatingDaySummaryId: employeeSummary.id,
    journalEntryIds: employeeSummary.journalEntryIds,
    workerLoopIds: employeeSummary.workerLoopIds,
    workItemIds: [...session.processedWorkItemIds],
    morningReportSource: employeeSummary.morningReportSource,
    morningReportEligible: employeeSummary.morningReportEligible,
    narrative: buildEmployeeOperatingDaySummaryNarrative(employeeSummary),
  }
}

/**
 * Idempotent: returns existing summary when session/day already recorded for this date.
 */
export function recordOperatingDaySummaryOnEngineFinish(
  input: RecordOperatingDaySummaryOnEngineFinishInput,
): RecordOperatingDaySummaryOnEngineFinishResult {
  const { day, session, finishedAt } = input

  if (session.employeeOperatingDaySummaryId) {
    const linked = getEmployeeOperatingDaySummaryById(session.employeeOperatingDaySummaryId)
    if (linked) {
      return {
        employeeSummary: linked,
        operatingDaySummary: mapEmployeeSummaryToOperatingDaySummary(linked, day, session, finishedAt),
      }
    }
  }

  const existing = getEmployeeOperatingDaySummaryByEmployeeAndDate(day.employeeId, day.dateKey)
  if (existing) {
    return {
      employeeSummary: existing,
      operatingDaySummary: mapEmployeeSummaryToOperatingDaySummary(existing, day, session, finishedAt),
    }
  }

  const employeeSummary = buildEmployeeOperatingDaySummary({
    employeeId: day.employeeId,
    dateKey: day.dateKey,
    operatingDayId: day.id,
    operatingDaySessionId: session.id,
    sessionStartedAt: session.startedAt,
    finishedAt,
    now: input.now,
  })

  const saved = saveEmployeeOperatingDaySummary(employeeSummary)

  return {
    employeeSummary: saved,
    operatingDaySummary: mapEmployeeSummaryToOperatingDaySummary(saved, day, session, finishedAt),
  }
}
