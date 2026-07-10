/**
 * First Employee Navigation Flow — MAX activity signal (AI-COMPANY-106C).
 * Read-only aggregation from Journal, Work Queue, Operating Day Summary.
 */

import { listEmployeeDailyJournalEntries } from '../employeeDailyJournal'
import { loadEmployeeWorkItems } from '../employeeWorkQueue'
import { MAX_WORKER_EMPLOYEE_ID } from '../maxWorkerLoop'
import { loadEmployeeOperatingDaySummaries } from '../operatingDaySummary'

export type FirstEmployeeFlowStatus = {
  employeeId: string
  hasPriorActivity: boolean
  journalEntryCount: number
  completedTaskCount: number
  operatingDaySummaryCount: number
}

export function buildFirstEmployeeFlowStatus(
  employeeId: string = MAX_WORKER_EMPLOYEE_ID,
): FirstEmployeeFlowStatus {
  const journalEntryCount = listEmployeeDailyJournalEntries({ employeeId }).length
  const completedTaskCount = loadEmployeeWorkItems().filter(
    (item) => item.employeeId === employeeId && item.status === 'completed',
  ).length
  const operatingDaySummaryCount = loadEmployeeOperatingDaySummaries().filter(
    (item) => item.employeeId === employeeId,
  ).length

  const hasPriorActivity =
    journalEntryCount > 0 || completedTaskCount > 0 || operatingDaySummaryCount > 0

  return {
    employeeId,
    hasPriorActivity,
    journalEntryCount,
    completedTaskCount,
    operatingDaySummaryCount,
  }
}
