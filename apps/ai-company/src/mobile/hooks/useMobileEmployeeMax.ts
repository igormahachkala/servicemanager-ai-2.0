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
import { buildFirstEmployeeFlowStatus } from '../../domain/firstEmployeeFlow'
import {
  buildMaxWorkspaceWorkQueueView,
  type MaxWorkspaceWorkQueueView,
} from '../../domain/maxWorkspace/maxWorkspaceWorkQueueViewModel'
import { runMaxEmployeeWorkQueueNextItem } from '../../domain/maxWorkspace/maxWorkspaceWorkQueueRunner'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import {
  loadEmployeeOperatingDaySummaries,
  type EmployeeOperatingDaySummary,
} from '../../domain/operatingDaySummary'
import { getPresenceByEmployeeId, type EmployeePresence } from '../../domain/presence'
import { getModelById, getRuntimeProfileByEmployeeId } from '../../domain/runtime/runtimeStorage'
import { getTodayDateKey } from '../../domain/workday'
import { resolveEmployee, type EmployeeRef } from '../../mission-control/data/conversation'
import { EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT } from '../../domain/employeeDailyJournal/employeeDailyJournalStorage'
import {
  EMPLOYEE_WORK_QUEUE_STORAGE_KEY,
  EMPLOYEE_WORK_QUEUE_SYNC_EVENT,
} from '../../domain/employeeWorkQueue'
import { EMPLOYEE_OPERATING_DAY_SYNC_EVENT } from '../../domain/employeeOperatingDay/employeeOperatingDayEngine'
import { EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT } from '../../domain/operatingDaySummary/operatingDaySummaryStorage'
import { CHANGE_EVENT } from '../../domain/workday/workdayStorage'
import { MAX_WORKER_LOOP_SYNC_EVENT } from '../../hooks/useMaxWorkerLoop'

export type MobileEmployeeMaxSnapshot = {
  employeeId: typeof MAX_WORKER_EMPLOYEE_ID
  employee: EmployeeRef | null
  presence: EmployeePresence | null
  operatingDay: EmployeeOperatingDaySnapshot
  workQueue: MaxWorkspaceWorkQueueView
  lastJournalEntry: EmployeeDailyJournalEntry | null
  lastOperatingDaySummary: EmployeeOperatingDaySummary | null
  hasPriorActivity: boolean
  modelLabel: string | null
  brainSummary: string | null
  dateKey: string
}

function buildSnapshot(): MobileEmployeeMaxSnapshot {
  const employeeId = MAX_WORKER_EMPLOYEE_ID
  const employee = resolveEmployee(employeeId)
  const profile = getRuntimeProfileByEmployeeId(employeeId)
  const model = profile ? getModelById(profile.primaryModelId) : null
  const brain = getEmployeeBrainByEmployeeId(employeeId)
  const journalEntries = listEmployeeDailyJournalEntries({ employeeId, limit: 1 })
  const summaries = loadEmployeeOperatingDaySummaries()
    .filter((item) => item.employeeId === employeeId)
    .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))

  return {
    employeeId,
    employee,
    presence: getPresenceByEmployeeId(employeeId),
    operatingDay: getEmployeeOperatingDaySnapshot(employeeId),
    workQueue: buildMaxWorkspaceWorkQueueView(),
    lastJournalEntry: journalEntries[0] ?? null,
    lastOperatingDaySummary: summaries[0] ?? null,
    hasPriorActivity: buildFirstEmployeeFlowStatus(employeeId).hasPriorActivity,
    modelLabel: model?.name ?? profile?.primaryModelId ?? null,
    brainSummary: brain?.specialization.summary ?? null,
    dateKey: getTodayDateKey(),
  }
}

export function useMobileEmployeeMax() {
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
    return buildSnapshot()
  }, [tick])

  const startWorkday = useCallback(() => {
    startEmployeeOperatingDay(MAX_WORKER_EMPLOYEE_ID)
    refresh()
  }, [refresh])

  const continueWorkday = useCallback(() => {
    continueEmployeeOperatingDay(MAX_WORKER_EMPLOYEE_ID)
    refresh()
  }, [refresh])

  const finishWorkday = useCallback(() => {
    finishEmployeeOperatingDay(MAX_WORKER_EMPLOYEE_ID)
    refresh()
  }, [refresh])

  const runNext = useCallback(async () => {
    setIsRunning(true)
    try {
      await runMaxEmployeeWorkQueueNextItem()
      refresh()
    } finally {
      setIsRunning(false)
    }
  }, [refresh])

  return {
    snapshot,
    isRunning,
    startWorkday,
    continueWorkday,
    finishWorkday,
    runNext,
    refresh,
  }
}
