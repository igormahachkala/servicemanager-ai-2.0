import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadApprovalStore } from '../../domain/approval/approvalStorage'
import { listEmployeeDailyJournalEntries } from '../../domain/employeeDailyJournal'
import { EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT } from '../../domain/employeeDailyJournal/employeeDailyJournalStorage'
import { getEmployeeOperatingDaySnapshot } from '../../domain/employeeOperatingDay'
import { EMPLOYEE_OPERATING_DAY_SYNC_EVENT } from '../../domain/employeeOperatingDay/employeeOperatingDayEngine'
import { loadEmployeeWorkItems, EMPLOYEE_WORK_QUEUE_SYNC_EVENT } from '../../domain/employeeWorkQueue'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { getPresenceByEmployeeId, type PresenceStatus } from '../../domain/presence'
import { EMPLOYEE_ROUTE_IDS } from '../../mission-control/data/employeeIdResolver'
import { resolveEmployee } from '../../mission-control/data/conversation'
import type { EmployeeOperatingDayStatus } from '../../domain/employeeOperatingDay'

export type MobileRosterSlotId = 'max' | 'atlas' | 'sentinel' | 'builder'

export type MobileEmployeeRosterAvailability = 'active' | 'placeholder'

export type MobileEmployeeRosterEntry = {
  slotId: MobileRosterSlotId
  employeeId: string
  mobileRouteId: string
  codename: string
  role: string
  availability: MobileEmployeeRosterAvailability
  presenceStatus: PresenceStatus | null
  workdayStatus: EmployeeOperatingDayStatus | 'unavailable'
  queueCount: number
  pendingDecisions: number
  lastResultTitle: string | null
  lastResultAt: string | null
}

type RosterSlotConfig = {
  slotId: MobileRosterSlotId
  employeeId: string
  availability: MobileEmployeeRosterAvailability
  codename?: string
  role?: string
}

const ROSTER_SLOTS: RosterSlotConfig[] = [
  { slotId: 'max', employeeId: EMPLOYEE_ROUTE_IDS.max, availability: 'active' },
  { slotId: 'atlas', employeeId: EMPLOYEE_ROUTE_IDS.atlas, availability: 'placeholder' },
  { slotId: 'sentinel', employeeId: EMPLOYEE_ROUTE_IDS.sentinel, availability: 'placeholder' },
  {
    slotId: 'builder',
    employeeId: 'builder-planned',
    availability: 'placeholder',
    codename: 'Builder',
    role: 'Product Engineer',
  },
]

function countQueueItems(employeeId: string): number {
  return loadEmployeeWorkItems().filter(
    (item) =>
      item.employeeId === employeeId &&
      (item.status === 'pending' ||
        item.status === 'scheduled' ||
        item.status === 'in_progress' ||
        item.status === 'blocked'),
  ).length
}

function countPendingDecisions(employeeId: string): number {
  const blocked = loadEmployeeWorkItems().filter(
    (item) => item.employeeId === employeeId && item.status === 'blocked',
  ).length
  if (employeeId !== MAX_WORKER_EMPLOYEE_ID) return blocked

  const approvals = loadApprovalStore().approvals.filter((item) => item.status === 'pending').length
  return blocked + approvals
}

function buildActiveEntry(slot: RosterSlotConfig): MobileEmployeeRosterEntry {
  const employee = resolveEmployee(slot.employeeId)
  const presence = getPresenceByEmployeeId(slot.employeeId)
  const operatingDay = getEmployeeOperatingDaySnapshot(slot.employeeId)
  const journal = listEmployeeDailyJournalEntries({ employeeId: slot.employeeId, limit: 1 })[0] ?? null

  return {
    slotId: slot.slotId,
    employeeId: slot.employeeId,
    mobileRouteId: slot.employeeId,
    codename: employee?.codename ?? slot.codename ?? slot.slotId.toUpperCase(),
    role: employee?.role ?? slot.role ?? '',
    availability: slot.availability,
    presenceStatus: presence?.status ?? null,
    workdayStatus: operatingDay.status,
    queueCount: countQueueItems(slot.employeeId),
    pendingDecisions: countPendingDecisions(slot.employeeId),
    lastResultTitle: journal?.taskTitle?.trim() || journal?.taskText.slice(0, 80) || null,
    lastResultAt: journal?.finishedAt ?? null,
  }
}

function buildPlaceholderEntry(slot: RosterSlotConfig): MobileEmployeeRosterEntry {
  const employee = slot.employeeId === 'builder-planned' ? null : resolveEmployee(slot.employeeId)

  return {
    slotId: slot.slotId,
    employeeId: slot.employeeId,
    mobileRouteId: slot.employeeId,
    codename: slot.codename ?? employee?.codename ?? slot.slotId,
    role: slot.role ?? employee?.role ?? '',
    availability: slot.availability,
    presenceStatus: null,
    workdayStatus: 'unavailable',
    queueCount: 0,
    pendingDecisions: 0,
    lastResultTitle: null,
    lastResultAt: null,
  }
}

function buildRoster(): MobileEmployeeRosterEntry[] {
  return ROSTER_SLOTS.map((slot) =>
    slot.availability === 'active' ? buildActiveEntry(slot) : buildPlaceholderEntry(slot),
  )
}

export function useMobileEmployeesRoster() {
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => {
    setTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const onChange = () => refresh()
    window.addEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_OPERATING_DAY_SYNC_EVENT, onChange)
    window.addEventListener('ai-company-presence-sync', onChange)
    return () => {
      window.removeEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_OPERATING_DAY_SYNC_EVENT, onChange)
      window.removeEventListener('ai-company-presence-sync', onChange)
    }
  }, [refresh])

  const roster = useMemo(() => {
    void tick
    return buildRoster()
  }, [tick])

  return { roster, refresh }
}
