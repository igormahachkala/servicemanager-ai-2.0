import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT } from '../domain/employeeDailyJournal'
import {
  EMPLOYEE_OPERATING_DAY_SYNC_EVENT,
  continueEmployeeOperatingDay,
  finishEmployeeOperatingDay,
  getEmployeeOperatingDaySnapshot,
  pauseEmployeeOperatingDay,
  resumeEmployeeOperatingDay,
  startEmployeeOperatingDay,
  type EmployeeOperatingDaySnapshot,
} from '../domain/employeeOperatingDay'
import { EMPLOYEE_WORK_QUEUE_SYNC_EVENT } from '../domain/employeeWorkQueue'
import { PRESENCE_STORAGE_KEY } from '../domain/presence'
import { CHANGE_EVENT, STORAGE_KEY as WORKDAY_STORAGE_KEY } from '../domain/workday'

export function useEmployeeOperatingDay(employeeId: string | undefined) {
  const navigate = useNavigate()
  const [snapshot, setSnapshot] = useState<EmployeeOperatingDaySnapshot | null>(() =>
    employeeId ? getEmployeeOperatingDaySnapshot(employeeId) : null,
  )

  const refresh = useCallback(() => {
    if (!employeeId) {
      setSnapshot(null)
      return
    }
    setSnapshot(getEmployeeOperatingDaySnapshot(employeeId))
  }, [employeeId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!employeeId || snapshot?.status !== 'active') return
    const timer = window.setInterval(refresh, 60_000)
    return () => window.clearInterval(timer)
  }, [employeeId, snapshot?.status, refresh])

  useEffect(() => {
    const onChange = () => refresh()
    window.addEventListener(CHANGE_EVENT, onChange)
    window.addEventListener(EMPLOYEE_OPERATING_DAY_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_OPERATING_DAY_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
    }
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === WORKDAY_STORAGE_KEY ||
        event.key === PRESENCE_STORAGE_KEY ||
        event.key === 'ai-company-workday-events'
      ) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const start = useCallback(() => {
    if (!employeeId) return
    setSnapshot(startEmployeeOperatingDay(employeeId))
  }, [employeeId])

  const continueDay = useCallback(() => {
    if (!employeeId) return
    const current = getEmployeeOperatingDaySnapshot(employeeId)
    if (current.continueHref) {
      navigate(current.continueHref)
      return
    }
    setSnapshot(continueEmployeeOperatingDay(employeeId))
  }, [employeeId, navigate])

  const finish = useCallback(() => {
    if (!employeeId) return
    setSnapshot(finishEmployeeOperatingDay(employeeId))
  }, [employeeId])

  const pause = useCallback(() => {
    if (!employeeId) return
    setSnapshot(pauseEmployeeOperatingDay(employeeId))
  }, [employeeId])

  const resume = useCallback(() => {
    if (!employeeId) return
    setSnapshot(resumeEmployeeOperatingDay(employeeId))
  }, [employeeId])

  return {
    snapshot,
    start,
    continueDay,
    finish,
    pause,
    resume,
    refresh,
  }
}

export type { EmployeeOperatingDaySnapshot }
