import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { listEmployeeDailyJournalEntries, type EmployeeDailyJournalEntry } from '../../domain/employeeDailyJournal'
import { getEmployeeBrainByEmployeeId } from '../../domain/employeeBrain/employeeBrainStorage'
import {
  continueEmployeeOperatingDay,
  finishEmployeeOperatingDay,
  getEmployeeOperatingDaySnapshot,
  startEmployeeOperatingDay,
  type EmployeeOperatingDaySnapshot,
} from '../../domain/employeeOperatingDay'
import {
  listEmployeeWorkQueue,
  pickNextWorkItem,
  type WorkPriority,
} from '../../domain/employeeWorkQueue'
import {
  buildEmployeeWorkQueueView,
  type EmployeeWorkQueueView,
} from '../../domain/employeeWorkQueue/employeeWorkQueueViewModel'
import { getEmployee, type EmployeeProfile } from '../../domain/employeeRegistry'
import { buildFirstEmployeeFlowStatus } from '../../domain/firstEmployeeFlow'
import { hasMobileEmployeeCapability } from '../../domain/mobileEmployee'
import {
  runEmployeeWorkQueueNextItem,
  type EmployeeWorkQueueRunResult,
} from '../../domain/employeeWorkerLoop'
import { MAX_WORKER_EMPLOYEE_ID, type MaxWorkerLoopRecord } from '../../domain/maxWorkerLoop'
import {
  loadEmployeeOperatingDaySummaries,
  type EmployeeOperatingDaySummary,
} from '../../domain/operatingDaySummary'
import { getPresenceByEmployeeId, type EmployeePresence } from '../../domain/presence'
import { getModelById, getRuntimeProfileByEmployeeId } from '../../domain/runtime/runtimeStorage'
import { getTodayDateKey } from '../../domain/workday'
import { resolveEmployee, type EmployeeRef } from '../../mission-control/data/conversation'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import { EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT } from '../../domain/employeeDailyJournal/employeeDailyJournalStorage'
import {
  EMPLOYEE_WORK_QUEUE_STORAGE_KEY,
  EMPLOYEE_WORK_QUEUE_SYNC_EVENT,
} from '../../domain/employeeWorkQueue'
import { EMPLOYEE_OPERATING_DAY_SYNC_EVENT } from '../../domain/employeeOperatingDay/employeeOperatingDayEngine'
import { EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT } from '../../domain/operatingDaySummary/operatingDaySummaryStorage'
import { CHANGE_EVENT } from '../../domain/workday/workdayStorage'
import { MAX_WORKER_LOOP_SYNC_EVENT } from '../../hooks/useMaxWorkerLoop'
import { findActiveEmployeeWorkerLoop } from '../runtime/mobileRuntimeLiveViewModel'

export type MobileRunNextPreview = {
  workItemId: string
  title: string
  taskText: string
  priority: WorkPriority
  employeeName: string
  modelLabel: string | null
}

export type MobileEmployeeProfileSnapshot = {
  employeeId: string
  employee: EmployeeRef | null
  registryProfile: EmployeeProfile | null
  presence: EmployeePresence | null
  operatingDay: EmployeeOperatingDaySnapshot
  workQueue: EmployeeWorkQueueView
  lastJournalEntry: EmployeeDailyJournalEntry | null
  lastOperatingDaySummary: EmployeeOperatingDaySummary | null
  hasPriorActivity: boolean
  modelLabel: string | null
  brainSummary: string | null
  dateKey: string
  canRunWorkerLoop: boolean
  canShowRuntimeLive: boolean
}

/** @deprecated use MobileEmployeeProfileSnapshot */
export type MobileEmployeeMaxSnapshot = MobileEmployeeProfileSnapshot

function buildSnapshot(employeeId: string): MobileEmployeeProfileSnapshot {
  const canonical = resolveCanonicalEmployeeId(employeeId)
  const employee = resolveEmployee(canonical)
  const registryProfile = getEmployee(canonical)
  const profile = getRuntimeProfileByEmployeeId(canonical)
  const model = profile ? getModelById(profile.primaryModelId) : null
  const brain = getEmployeeBrainByEmployeeId(canonical)
  const journalEntries = listEmployeeDailyJournalEntries({ employeeId: canonical, limit: 1 })
  const summaries = loadEmployeeOperatingDaySummaries()
    .filter((item) => item.employeeId === canonical)
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))

  return {
    employeeId: canonical,
    employee,
    registryProfile,
    presence: getPresenceByEmployeeId(canonical),
    operatingDay: getEmployeeOperatingDaySnapshot(canonical),
    workQueue: buildEmployeeWorkQueueView(canonical),
    lastJournalEntry: journalEntries[0] ?? null,
    lastOperatingDaySummary: summaries[0] ?? null,
    hasPriorActivity: buildFirstEmployeeFlowStatus(canonical).hasPriorActivity,
    modelLabel: model?.name ?? profile?.primaryModelId ?? null,
    brainSummary: brain?.specialization.summary ?? null,
    dateKey: getTodayDateKey(),
    canRunWorkerLoop: hasMobileEmployeeCapability(canonical, 'worker_loop'),
    canShowRuntimeLive: hasMobileEmployeeCapability(canonical, 'runtime_live'),
  }
}

function buildRunNextPreview(snapshot: MobileEmployeeProfileSnapshot): MobileRunNextPreview | null {
  if (!snapshot.canRunWorkerLoop) return null

  const queue = listEmployeeWorkQueue(snapshot.employeeId)
  if (queue.activeItem) return null

  const next = pickNextWorkItem(queue.items)
  if (!next) return null

  return {
    workItemId: next.id,
    title: next.title,
    taskText: next.taskText?.trim() || next.summary?.trim() || next.title,
    priority: next.priority,
    employeeName:
      snapshot.registryProfile?.displayName ??
      snapshot.employee?.codename ??
      snapshot.employeeId,
    modelLabel: snapshot.modelLabel,
  }
}

export function useMobileEmployeeProfile(employeeId: string) {
  const canonical = resolveCanonicalEmployeeId(employeeId)
  const { pathname } = useLocation()
  const [tick, setTick] = useState(0)
  const [isRunning, setIsRunning] = useState(false)

  const refresh = useCallback(() => {
    setTick((value) => value + 1)
  }, [])

  useEffect(() => {
    refresh()
  }, [pathname, refresh])

  useEffect(() => {
    const onChange = () => refresh()
    window.addEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_OPERATING_DAY_SYNC_EVENT, onChange)
    window.addEventListener(MAX_WORKER_LOOP_SYNC_EVENT, onChange)
    window.addEventListener(CHANGE_EVENT, onChange)
    window.addEventListener('ai-company-presence-sync', onChange)
    window.addEventListener('focus', onChange)
    window.addEventListener('visibilitychange', onChange)
    return () => {
      window.removeEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_OPERATING_DAY_SYNC_EVENT, onChange)
      window.removeEventListener(MAX_WORKER_LOOP_SYNC_EVENT, onChange)
      window.removeEventListener(CHANGE_EVENT, onChange)
      window.removeEventListener('ai-company-presence-sync', onChange)
      window.removeEventListener('focus', onChange)
      window.removeEventListener('visibilitychange', onChange)
    }
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === EMPLOYEE_WORK_QUEUE_STORAGE_KEY || event.key === null) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const snapshot = useMemo(() => {
    void tick
    return buildSnapshot(canonical)
  }, [canonical, tick])

  const activeWorkerLoop = useMemo((): MaxWorkerLoopRecord | null => {
    void tick
    if (!snapshot.canShowRuntimeLive) return null
    const active = findActiveEmployeeWorkerLoop(canonical)
    if (!active || active.employeeId !== canonical) return null
    return active
  }, [canonical, snapshot.canShowRuntimeLive, tick])

  const getRunNextPreview = useCallback((): MobileRunNextPreview | null => {
    return buildRunNextPreview(snapshot)
  }, [snapshot])

  const startWorkday = useCallback(() => {
    startEmployeeOperatingDay(canonical)
    refresh()
  }, [canonical, refresh])

  const continueWorkday = useCallback(() => {
    continueEmployeeOperatingDay(canonical)
    refresh()
  }, [canonical, refresh])

  const finishWorkday = useCallback(() => {
    finishEmployeeOperatingDay(canonical)
    refresh()
  }, [canonical, refresh])

  const runNext = useCallback(async (): Promise<EmployeeWorkQueueRunResult> => {
    if (!snapshot.canRunWorkerLoop) {
      return {
        ok: false,
        workItem: null,
        loopId: null,
        runtimeRunId: null,
        errorMessage: 'Worker Loop недоступен для этого сотрудника.',
      }
    }

    setIsRunning(true)
    try {
      const result = await runEmployeeWorkQueueNextItem(canonical)
      refresh()
      return result
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Не удалось запустить Worker Loop'
      return {
        ok: false,
        workItem: null,
        loopId: null,
        runtimeRunId: null,
        errorMessage: message,
      }
    } finally {
      setIsRunning(false)
    }
  }, [canonical, refresh, snapshot.canRunWorkerLoop])

  return {
    snapshot,
    activeWorkerLoop,
    isRunning,
    getRunNextPreview,
    startWorkday,
    continueWorkday,
    finishWorkday,
    runNext,
    refresh,
  }
}

export function useMobileEmployeeMax() {
  return useMobileEmployeeProfile(MAX_WORKER_EMPLOYEE_ID)
}
