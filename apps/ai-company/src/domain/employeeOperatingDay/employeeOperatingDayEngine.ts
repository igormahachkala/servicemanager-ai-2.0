/**
 * Employee Operating Day — actions (start / continue / finish / pause / resume).
 */

import { appendWorkdayEvent, upsertPresence } from '../presence'
import {
  advanceWorkdayPhase,
  finishWorkday,
  getTodayWorkdayForEmployee,
  startWorkday,
} from '../workday'
import type { EmployeeOperatingDaySnapshot } from './employeeOperatingDay'
import { buildEmployeeOperatingDaySnapshot } from './employeeOperatingDaySnapshot'

export const EMPLOYEE_OPERATING_DAY_SYNC_EVENT = 'ai-company-employee-operating-day-sync'

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(EMPLOYEE_OPERATING_DAY_SYNC_EVENT))
}

export function getEmployeeOperatingDaySnapshot(
  employeeId: string,
  now: Date = new Date(),
): EmployeeOperatingDaySnapshot {
  return buildEmployeeOperatingDaySnapshot(employeeId, now)
}

export function startEmployeeOperatingDay(employeeId: string): EmployeeOperatingDaySnapshot {
  startWorkday(employeeId)
  emitSync()
  return buildEmployeeOperatingDaySnapshot(employeeId)
}

export function continueEmployeeOperatingDay(employeeId: string): EmployeeOperatingDaySnapshot {
  advanceWorkdayPhase(employeeId)
  emitSync()
  return buildEmployeeOperatingDaySnapshot(employeeId)
}

export function finishEmployeeOperatingDay(employeeId: string): EmployeeOperatingDaySnapshot {
  finishWorkday(employeeId)
  emitSync()
  return buildEmployeeOperatingDaySnapshot(employeeId)
}

export function pauseEmployeeOperatingDay(employeeId: string): EmployeeOperatingDaySnapshot {
  const workday = getTodayWorkdayForEmployee(employeeId)
  if (!workday?.startedAt || workday.state === 'finished') {
    return buildEmployeeOperatingDaySnapshot(employeeId)
  }

  const now = new Date().toISOString()
  upsertPresence({
    employeeId,
    status: 'break',
    activity: 'Workday paused',
    startedAt: now,
  })

  appendWorkdayEvent({
    employeeId,
    type: 'break',
    label: 'Workday paused',
    startedAt: now,
    currentProjectId: null,
    currentTaskId: null,
  })

  emitSync()
  return buildEmployeeOperatingDaySnapshot(employeeId)
}

export function resumeEmployeeOperatingDay(employeeId: string): EmployeeOperatingDaySnapshot {
  const workday = getTodayWorkdayForEmployee(employeeId)
  if (!workday?.startedAt || workday.state === 'finished') {
    return buildEmployeeOperatingDaySnapshot(employeeId)
  }

  const now = new Date().toISOString()
  const presenceStatus = workday.state === 'planning' ? 'available' : 'working'

  upsertPresence({
    employeeId,
    status: presenceStatus,
    activity: 'Workday resumed',
    startedAt: now,
  })

  appendWorkdayEvent({
    employeeId,
    type: 'work_started',
    label: 'Workday resumed',
    startedAt: now,
    currentProjectId: null,
    currentTaskId: null,
  })

  emitSync()
  return buildEmployeeOperatingDaySnapshot(employeeId)
}
