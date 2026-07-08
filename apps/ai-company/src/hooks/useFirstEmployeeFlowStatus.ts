import { useCallback, useEffect, useMemo, useState } from 'react'
import { EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT } from '../domain/employeeDailyJournal'
import { EMPLOYEE_WORK_QUEUE_SYNC_EVENT } from '../domain/employeeWorkQueue'
import {
  buildFirstEmployeeFlowStatus,
  type FirstEmployeeFlowStatus,
} from '../domain/firstEmployeeFlow'
import { EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT } from '../domain/operatingDaySummary'
import { CHANGE_EVENT as WORKDAY_CHANGE_EVENT } from '../domain/workday/workdayStorage'
import { MAX_WORKER_LOOP_SYNC_EVENT } from './useMaxWorkerLoop'

export function useFirstEmployeeFlowStatus(): FirstEmployeeFlowStatus {
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => {
    setTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const onChange = () => refresh()
    window.addEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT, onChange)
    window.addEventListener(MAX_WORKER_LOOP_SYNC_EVENT, onChange)
    window.addEventListener(WORKDAY_CHANGE_EVENT, onChange)
    return () => {
      window.removeEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT, onChange)
      window.removeEventListener(MAX_WORKER_LOOP_SYNC_EVENT, onChange)
      window.removeEventListener(WORKDAY_CHANGE_EVENT, onChange)
    }
  }, [refresh])

  return useMemo(() => {
    void tick
    return buildFirstEmployeeFlowStatus()
  }, [tick])
}
