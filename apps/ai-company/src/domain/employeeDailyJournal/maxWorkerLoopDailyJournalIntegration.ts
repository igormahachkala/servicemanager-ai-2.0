/**
 * MAX Worker Loop → Employee Daily Journal integration (AI-COMPANY-103D-2).
 * Called once after successful loop completion; idempotent on refresh.
 */

import type { Report } from '../reports/report'
import type { RuntimeRun } from '../runtime/runtimeRun'
import type { MaxWorkerLoopSnapshot } from '../maxWorkerLoop/maxWorkerLoopEngine'
import type { EmployeeDailyJournalEntry } from './employeeDailyJournal'
import {
  getEmployeeDailyJournalEntryByMaxWorkerLoopId,
  getEmployeeDailyJournalEntryByRuntimeRunId,
  recordEmployeeDailyJournalFromMaxWorkerLoopSnapshot,
} from './employeeDailyJournalStorage'

export type RecordMaxWorkerLoopDailyJournalInput = {
  snapshot: MaxWorkerLoopSnapshot
  run: RuntimeRun
  report: Report
  now?: Date
}

/**
 * Records a journal entry when MAX Worker Loop completes successfully.
 * Returns existing entry if already recorded (runtimeRunId / maxWorkerLoopId).
 */
export function recordMaxWorkerLoopDailyJournalOnCompletion(
  input: RecordMaxWorkerLoopDailyJournalInput,
): EmployeeDailyJournalEntry | null {
  const { snapshot, run, report, now } = input
  const loop = snapshot.loop

  if (loop.status !== 'completed') return null
  if (!run.id || !report.id) return null

  const byRun = getEmployeeDailyJournalEntryByRuntimeRunId(run.id)
  if (byRun && byRun.employeeId === loop.employeeId) {
    return byRun
  }

  const byLoop = getEmployeeDailyJournalEntryByMaxWorkerLoopId(loop.id)
  if (byLoop && byLoop.employeeId === loop.employeeId) {
    return byLoop
  }

  return recordEmployeeDailyJournalFromMaxWorkerLoopSnapshot(snapshot, run, report, now)
}
