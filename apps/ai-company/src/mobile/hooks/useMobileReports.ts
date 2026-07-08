import { useCallback, useEffect, useMemo, useState } from 'react'
import { EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT } from '../../domain/employeeDailyJournal'
import { EMPLOYEE_WORK_QUEUE_SYNC_EVENT } from '../../domain/employeeWorkQueue'
import { EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT } from '../../domain/operatingDaySummary'
import { CHANGE_EVENT as WORKDAY_CHANGE_EVENT } from '../../domain/workday/workdayStorage'
import { MAX_WORKER_LOOP_SYNC_EVENT } from '../../hooks/useMaxWorkerLoop'
import {
  buildMobileReportsSnapshot,
  type MobileReportsSnapshot,
} from '../reports/mobileReportsSnapshot'

const REPORTS_SYNC_EVENT = 'ai-company-mobile-reports-sync'

export function refreshMobileReports(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(REPORTS_SYNC_EVENT))
}

export function useMobileReports() {
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => {
    setTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const onChange = () => refresh()
    window.addEventListener(REPORTS_SYNC_EVENT, onChange)
    window.addEventListener(MAX_WORKER_LOOP_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT, onChange)
    window.addEventListener(WORKDAY_CHANGE_EVENT, onChange)
    window.addEventListener('ai-company-runtime-sync', onChange)
    return () => {
      window.removeEventListener(REPORTS_SYNC_EVENT, onChange)
      window.removeEventListener(MAX_WORKER_LOOP_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT, onChange)
      window.removeEventListener(WORKDAY_CHANGE_EVENT, onChange)
      window.removeEventListener('ai-company-runtime-sync', onChange)
    }
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return
      if (
        event.key.includes('reports') ||
        event.key.includes('journal') ||
        event.key.includes('operating-day') ||
        event.key.includes('max-worker-loop') ||
        event.key.includes('workday')
      ) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const snapshot = useMemo((): MobileReportsSnapshot => {
    void tick
    return buildMobileReportsSnapshot()
  }, [tick])

  return { snapshot, refresh, isEmpty: snapshot.items.length === 0 }
}
