import { useCallback, useEffect, useState } from 'react'
import {
  EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT,
  getEmployeeOperatingDaySummaryByEmployeeAndDate,
  type EmployeeOperatingDaySummary,
} from '../domain/operatingDaySummary'
import { EMPLOYEE_OPERATING_DAY_SYNC_EVENT } from '../domain/employeeOperatingDay'
import { CHANGE_EVENT, STORAGE_KEY as WORKDAY_STORAGE_KEY } from '../domain/workday'

export function useEmployeeOperatingDaySummary(
  employeeId: string | undefined,
  dateKey: string | undefined,
) {
  const [summary, setSummary] = useState<EmployeeOperatingDaySummary | null>(() =>
    employeeId && dateKey
      ? getEmployeeOperatingDaySummaryByEmployeeAndDate(employeeId, dateKey)
      : null,
  )

  const refresh = useCallback(() => {
    if (!employeeId || !dateKey) {
      setSummary(null)
      return
    }
    setSummary(getEmployeeOperatingDaySummaryByEmployeeAndDate(employeeId, dateKey))
  }, [employeeId, dateKey])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onChange = () => refresh()
    window.addEventListener(EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_OPERATING_DAY_SYNC_EVENT, onChange)
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => {
      window.removeEventListener(EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_OPERATING_DAY_SYNC_EVENT, onChange)
      window.removeEventListener(CHANGE_EVENT, onChange)
    }
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === WORKDAY_STORAGE_KEY || event.key === 'ai-company-employee-operating-day-summaries') {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  return { summary, refresh }
}
