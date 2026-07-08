/**
 * Operating Day Engine V1 — localStorage persistence (AI-COMPANY-104A).
 */

import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import {
  parseOperatingDay,
  parseOperatingDaySession,
  type OperatingDay,
  type OperatingDaySession,
  type OperatingDayState,
  isActiveOperatingDayState,
} from './operatingDay'

export const OPERATING_DAY_STORAGE_KEY = 'ai-company-operating-days'

export const OPERATING_DAY_SESSION_STORAGE_KEY = 'ai-company-operating-day-sessions'

export const OPERATING_DAY_SYNC_EVENT = 'ai-company-operating-day-sync'

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OPERATING_DAY_SYNC_EVENT))
}

function readArray<T>(key: string, parse: (value: unknown) => T | null): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parse).filter((item): item is T => item !== null)
  } catch {
    return []
  }
}

function writeArray<T>(key: string, items: T[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(items))
    emitSync()
  } catch {
    /* noop */
  }
}

function normalizeEmployeeId(raw: string): string {
  return resolveCanonicalEmployeeId(raw)
}

export function loadOperatingDays(): OperatingDay[] {
  return readArray(OPERATING_DAY_STORAGE_KEY, parseOperatingDay).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )
}

export function saveOperatingDays(days: OperatingDay[]): void {
  writeArray(OPERATING_DAY_STORAGE_KEY, days)
}

export function upsertOperatingDay(day: OperatingDay): OperatingDay {
  const next = [...loadOperatingDays().filter((item) => item.id !== day.id), day]
  saveOperatingDays(next)
  return day
}

export function getOperatingDayById(id: string): OperatingDay | null {
  return loadOperatingDays().find((item) => item.id === id) ?? null
}

export function loadOperatingDaySessions(): OperatingDaySession[] {
  return readArray(OPERATING_DAY_SESSION_STORAGE_KEY, parseOperatingDaySession).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )
}

export function saveOperatingDaySessions(sessions: OperatingDaySession[]): void {
  writeArray(OPERATING_DAY_SESSION_STORAGE_KEY, sessions)
}

export function upsertOperatingDaySession(session: OperatingDaySession): OperatingDaySession {
  const next = [...loadOperatingDaySessions().filter((item) => item.id !== session.id), session]
  saveOperatingDaySessions(next)
  return session
}

export function getOperatingDaySessionById(id: string): OperatingDaySession | null {
  return loadOperatingDaySessions().find((item) => item.id === id) ?? null
}

export function getOperatingDayForEmployeeDate(
  employeeId: string,
  dateKey: string,
): OperatingDay | null {
  const canonicalId = normalizeEmployeeId(employeeId)
  return (
    loadOperatingDays().find(
      (item) => item.employeeId === canonicalId && item.dateKey === dateKey,
    ) ?? null
  )
}

export function getActiveOperatingDaySession(employeeId: string): OperatingDaySession | null {
  const canonicalId = normalizeEmployeeId(employeeId)
  return (
    loadOperatingDaySessions().find(
      (item) => item.employeeId === canonicalId && isActiveOperatingDayState(item.state),
    ) ?? null
  )
}

export function getOperatingDaySessionForDay(operatingDayId: string): OperatingDaySession | null {
  return loadOperatingDaySessions().find((item) => item.operatingDayId === operatingDayId) ?? null
}

export function listOperatingDaysForEmployee(employeeId: string): OperatingDay[] {
  const canonicalId = normalizeEmployeeId(employeeId)
  return loadOperatingDays().filter((item) => item.employeeId === canonicalId)
}

export function clearOperatingDayData(employeeId?: string): void {
  if (!employeeId) {
    saveOperatingDays([])
    saveOperatingDaySessions([])
    return
  }
  const canonicalId = normalizeEmployeeId(employeeId)
  saveOperatingDays(loadOperatingDays().filter((item) => item.employeeId !== canonicalId))
  saveOperatingDaySessions(
    loadOperatingDaySessions().filter((item) => item.employeeId !== canonicalId),
  )
}

export function patchOperatingDayState(
  dayId: string,
  state: OperatingDayState,
  patch: Partial<OperatingDay> = {},
): OperatingDay | null {
  const existing = getOperatingDayById(dayId)
  if (!existing) return null
  const updated: OperatingDay = {
    ...existing,
    ...patch,
    state,
    updatedAt: new Date().toISOString(),
  }
  return upsertOperatingDay(updated)
}
