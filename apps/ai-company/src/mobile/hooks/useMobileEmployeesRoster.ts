import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadApprovalStore } from '../../domain/approval/approvalStorage'
import { listEmployeeDailyJournalEntries } from '../../domain/employeeDailyJournal'
import { EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT } from '../../domain/employeeDailyJournal/employeeDailyJournalStorage'
import {
  EMPLOYEE_REGISTRY_SYNC_EVENT,
  getRegistryEmployeeBySlot,
  isRegistryEmployeeActive,
  listRegistryRosterEmployees,
  type EmployeeProfile,
} from '../../domain/employeeRegistry'
import { getEmployeeOperatingDaySnapshot } from '../../domain/employeeOperatingDay'
import { EMPLOYEE_OPERATING_DAY_SYNC_EVENT } from '../../domain/employeeOperatingDay/employeeOperatingDayEngine'
import { loadEmployeeWorkItems, EMPLOYEE_WORK_QUEUE_SYNC_EVENT } from '../../domain/employeeWorkQueue'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { mobileEmployeeRouteAlias } from '../../domain/mobileEmployee'
import { getPresenceByEmployeeId, type PresenceStatus } from '../../domain/presence'
import type { EmployeeOperatingDayStatus } from '../../domain/employeeOperatingDay'

export type MobileRosterSlotId = 'max' | 'atlas' | 'sentinel' | 'builder'

export type MobileEmployeeRosterAvailability = 'active' | 'placeholder'

export type MobileEmployeeRosterEntry = {
  slotId: MobileRosterSlotId
  employeeId: string
  mobileRouteId: string
  codename: string
  role: string
  title: string
  department: string
  avatar: string | null
  registryStatus: EmployeeProfile['status']
  currentWorkload: number
  availability: MobileEmployeeRosterAvailability
  presenceStatus: PresenceStatus | null
  workdayStatus: EmployeeOperatingDayStatus | 'unavailable'
  queueCount: number
  pendingDecisions: number
  lastResultTitle: string | null
  lastResultAt: string | null
}

const ROSTER_SLOT_ORDER: MobileRosterSlotId[] = ['max', 'atlas', 'sentinel', 'builder']

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

function buildActiveEntry(profile: EmployeeProfile): MobileEmployeeRosterEntry {
  const slotId = profile.rosterSlotId as MobileRosterSlotId
  const presence = getPresenceByEmployeeId(profile.employeeId)
  const operatingDay = getEmployeeOperatingDaySnapshot(profile.employeeId)
  const journal =
    listEmployeeDailyJournalEntries({ employeeId: profile.employeeId, limit: 1 })[0] ?? null

  return {
    slotId,
    employeeId: profile.employeeId,
    mobileRouteId: mobileEmployeeRouteAlias(profile.employeeId),
    codename: profile.displayName,
    role: profile.role.title,
    title: profile.title,
    department: profile.department,
    avatar: profile.avatar,
    registryStatus: profile.status,
    currentWorkload: profile.currentWorkload,
    availability: 'active',
    presenceStatus: presence?.status ?? null,
    workdayStatus: operatingDay.status,
    queueCount: countQueueItems(profile.employeeId),
    pendingDecisions: countPendingDecisions(profile.employeeId),
    lastResultTitle: journal?.taskTitle?.trim() || journal?.taskText.slice(0, 80) || null,
    lastResultAt: journal?.finishedAt ?? null,
  }
}

function buildPlaceholderEntry(profile: EmployeeProfile): MobileEmployeeRosterEntry {
  const slotId = profile.rosterSlotId as MobileRosterSlotId

  return {
    slotId,
    employeeId: profile.employeeId,
    mobileRouteId: mobileEmployeeRouteAlias(profile.employeeId),
    codename: profile.displayName,
    role: profile.role.title,
    title: profile.title,
    department: profile.department,
    avatar: profile.avatar,
    registryStatus: profile.status,
    currentWorkload: profile.currentWorkload,
    availability: 'placeholder',
    presenceStatus: null,
    workdayStatus: 'unavailable',
    queueCount: 0,
    pendingDecisions: 0,
    lastResultTitle: null,
    lastResultAt: null,
  }
}

function buildRoster(): MobileEmployeeRosterEntry[] {
  const profilesBySlot = new Map<MobileRosterSlotId, EmployeeProfile>()
  for (const profile of listRegistryRosterEmployees()) {
    if (profile.rosterSlotId) {
      profilesBySlot.set(profile.rosterSlotId, profile)
    }
  }

  return ROSTER_SLOT_ORDER.flatMap((slotId) => {
    const profile = profilesBySlot.get(slotId) ?? getRegistryEmployeeBySlot(slotId)
    if (!profile) return []
    return [isRegistryEmployeeActive(profile) ? buildActiveEntry(profile) : buildPlaceholderEntry(profile)]
  })
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
    window.addEventListener(EMPLOYEE_REGISTRY_SYNC_EVENT, onChange)
    window.addEventListener('ai-company-presence-sync', onChange)
    return () => {
      window.removeEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_OPERATING_DAY_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_REGISTRY_SYNC_EVENT, onChange)
      window.removeEventListener('ai-company-presence-sync', onChange)
    }
  }, [refresh])

  const roster = useMemo(() => {
    void tick
    return buildRoster()
  }, [tick])

  return { roster, refresh }
}
