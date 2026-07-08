/**
 * Employee Operating Day Summary — localStorage persistence (AI-COMPANY-104C).
 */

import type { EmployeeWorkday } from '../workday/workday'
import {
  parseEmployeeOperatingDaySummary,
  type EmployeeOperatingDaySummary,
} from './operatingDaySummary'
import { buildEmployeeOperatingDaySummary } from './operatingDaySummaryEngine'

export const EMPLOYEE_OPERATING_DAY_SUMMARY_STORAGE_KEY = 'ai-company-employee-operating-day-summaries'

export const EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT = 'ai-company-employee-operating-day-summary-sync'

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT))
}

export function loadEmployeeOperatingDaySummaries(): EmployeeOperatingDaySummary[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(EMPLOYEE_OPERATING_DAY_SUMMARY_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(parseEmployeeOperatingDaySummary)
      .filter((item): item is EmployeeOperatingDaySummary => item !== null)
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
  } catch {
    return []
  }
}

function saveEmployeeOperatingDaySummaries(summaries: EmployeeOperatingDaySummary[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(EMPLOYEE_OPERATING_DAY_SUMMARY_STORAGE_KEY, JSON.stringify(summaries))
    emitSync()
  } catch {
    /* noop */
  }
}

export function getEmployeeOperatingDaySummaryById(id: string): EmployeeOperatingDaySummary | null {
  return loadEmployeeOperatingDaySummaries().find((item) => item.id === id) ?? null
}

export function getEmployeeOperatingDaySummaryByEmployeeAndDate(
  employeeId: string,
  dateKey: string,
): EmployeeOperatingDaySummary | null {
  return (
    loadEmployeeOperatingDaySummaries().find(
      (item) => item.employeeId === employeeId && item.dateKey === dateKey,
    ) ?? null
  )
}

export function saveEmployeeOperatingDaySummary(
  summary: EmployeeOperatingDaySummary,
): EmployeeOperatingDaySummary {
  const existing = loadEmployeeOperatingDaySummaries()
  const duplicateIndex = existing.findIndex(
    (item) => item.employeeId === summary.employeeId && item.dateKey === summary.dateKey,
  )
  if (duplicateIndex >= 0) {
    return existing[duplicateIndex]!
  }
  saveEmployeeOperatingDaySummaries([summary, ...existing])
  return summary
}

export function recordOperatingDaySummaryOnWorkdayFinish(
  workday: EmployeeWorkday,
  now: Date = new Date(),
): EmployeeOperatingDaySummary | null {
  if (workday.state !== 'finished') return null

  const existing = getEmployeeOperatingDaySummaryByEmployeeAndDate(workday.employeeId, workday.date)
  if (existing) return existing

  const summary = buildEmployeeOperatingDaySummary({
    employeeId: workday.employeeId,
    dateKey: workday.date,
    workday,
    finishedAt: workday.finishedAt ?? now.toISOString(),
    now,
  })

  return saveEmployeeOperatingDaySummary(summary)
}
