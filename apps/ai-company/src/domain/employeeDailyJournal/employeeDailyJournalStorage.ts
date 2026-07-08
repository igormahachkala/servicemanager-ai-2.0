/**
 * Employee Daily Journal — localStorage persistence (AI-COMPANY-103C).
 * Append-only work log; not Memory / Knowledge / Experience stores.
 */

import type { Report } from '../reports/report'
import type { RuntimeRun } from '../runtime/runtimeRun'
import type { MaxWorkerLoopSnapshot } from '../maxWorkerLoop/maxWorkerLoopEngine'
import {
  parseEmployeeDailyJournalEntry,
  type EmployeeDailyJournalDaySummary,
  type EmployeeDailyJournalEntry,
  type EmployeeDailyJournalFilter,
} from './employeeDailyJournal'
import {
  buildEmployeeDailyJournalEntryFromMaxWorkerLoopSnapshot,
  buildEmployeeDailyJournalEntryFromRuntimeCompletion,
  type BuildEmployeeDailyJournalFromRuntimeInput,
} from './employeeDailyJournalProjector'

export const EMPLOYEE_DAILY_JOURNAL_STORAGE_KEY = 'ai-company-employee-daily-journal'

export const EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT = 'ai-company-employee-daily-journal-sync'

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT))
}

export function loadEmployeeDailyJournalEntries(): EmployeeDailyJournalEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(EMPLOYEE_DAILY_JOURNAL_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(parseEmployeeDailyJournalEntry)
      .filter((item): item is EmployeeDailyJournalEntry => item !== null)
      .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
  } catch {
    return []
  }
}

function saveEmployeeDailyJournalEntries(entries: EmployeeDailyJournalEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(EMPLOYEE_DAILY_JOURNAL_STORAGE_KEY, JSON.stringify(entries))
    emitSync()
  } catch {
    /* noop */
  }
}

export function getEmployeeDailyJournalEntryById(id: string): EmployeeDailyJournalEntry | null {
  return loadEmployeeDailyJournalEntries().find((item) => item.id === id) ?? null
}

export function getEmployeeDailyJournalEntryByRuntimeRunId(
  runtimeRunId: string,
): EmployeeDailyJournalEntry | null {
  return loadEmployeeDailyJournalEntries().find((item) => item.runtimeRunId === runtimeRunId) ?? null
}

export function listEmployeeDailyJournalEntries(
  filter: EmployeeDailyJournalFilter = {},
): EmployeeDailyJournalEntry[] {
  let items = loadEmployeeDailyJournalEntries()

  if (filter.employeeId) {
    items = items.filter((item) => item.employeeId === filter.employeeId)
  }
  if (filter.dateKey) {
    items = items.filter((item) => item.dateKey === filter.dateKey)
  }
  if (filter.from) {
    items = items.filter((item) => item.finishedAt >= filter.from!)
  }
  if (filter.to) {
    items = items.filter((item) => item.finishedAt <= filter.to!)
  }
  if (filter.limit != null && filter.limit > 0) {
    items = items.slice(0, filter.limit)
  }

  return items
}

export function appendEmployeeDailyJournalEntry(
  entry: EmployeeDailyJournalEntry,
): EmployeeDailyJournalEntry {
  const existing = loadEmployeeDailyJournalEntries()
  if (entry.runtimeRunId) {
    const duplicate = existing.find(
      (item) => item.runtimeRunId === entry.runtimeRunId && item.employeeId === entry.employeeId,
    )
    if (duplicate) return duplicate
  }

  saveEmployeeDailyJournalEntries([entry, ...existing])
  return entry
}

export function recordEmployeeDailyJournalFromMaxWorkerLoopSnapshot(
  snapshot: MaxWorkerLoopSnapshot,
  run: RuntimeRun,
  report: Report,
  now: Date = new Date(),
): EmployeeDailyJournalEntry {
  const entry = buildEmployeeDailyJournalEntryFromMaxWorkerLoopSnapshot(snapshot, run, report, now)
  return appendEmployeeDailyJournalEntry(entry)
}

export function recordEmployeeDailyJournalFromRuntimeCompletion(
  input: BuildEmployeeDailyJournalFromRuntimeInput,
  now: Date = new Date(),
): EmployeeDailyJournalEntry {
  const entry = buildEmployeeDailyJournalEntryFromRuntimeCompletion(input, now)
  return appendEmployeeDailyJournalEntry(entry)
}

export function buildEmployeeDailyJournalDaySummary(
  employeeId: string,
  dateKey: string,
): EmployeeDailyJournalDaySummary {
  const entries = listEmployeeDailyJournalEntries({ employeeId, dateKey })
  return {
    employeeId,
    dateKey,
    entryCount: entries.length,
    entries,
    firstStartedAt: entries.length > 0 ? entries[entries.length - 1]!.startedAt : null,
    lastFinishedAt: entries.length > 0 ? entries[0]!.finishedAt : null,
  }
}
