import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CHANGE_EVENT,
  STORAGE_KEY,
  advanceWorkdayPhase,
  finishWorkday,
  getCompanyWorkdayDashboard,
  getWorkdayForEmployee,
  getTodayWorkdays,
  initializeWorkdayEngine,
  startWorkday,
  syncWorkdaysFromPlatform,
  type EmployeeWorkday,
  type WorkdayCompanyDashboard,
} from '../domain/workday'

export function useWorkday(employeeId?: string) {
  const [dashboard, setDashboard] = useState<WorkdayCompanyDashboard>(() => initializeWorkdayEngine())

  const refresh = useCallback(() => {
    setDashboard(getCompanyWorkdayDashboard())
  }, [])

  useEffect(() => {
    const onChange = () => refresh()
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => window.removeEventListener(CHANGE_EVENT, onChange)
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === STORAGE_KEY ||
        event.key === 'ai-company-presence' ||
        event.key === 'ai-company-workday-events' ||
        event.key === 'ai-company-delivery-tasks' ||
        event.key === 'ai-company-approvals' ||
        event.key === 'ai-company-notifications' ||
        event.key === 'ai-company-reports' ||
        event.key === 'ai-company-events'
      ) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const employeeWorkday = useMemo<EmployeeWorkday | null>(() => {
    if (!employeeId) return null
    return getWorkdayForEmployee(employeeId)
  }, [employeeId, dashboard])

  const todayWorkdays = useMemo(() => getTodayWorkdays(), [dashboard])

  const start = useCallback(
    (id: string) => {
      startWorkday(id)
      refresh()
    },
    [refresh],
  )

  const advance = useCallback(
    (id: string) => {
      advanceWorkdayPhase(id)
      refresh()
    },
    [refresh],
  )

  const finish = useCallback(
    (id: string) => {
      finishWorkday(id)
      refresh()
    },
    [refresh],
  )

  const sync = useCallback(() => {
    syncWorkdaysFromPlatform()
    refresh()
  }, [refresh])

  return {
    dashboard,
    employeeWorkday,
    todayWorkdays,
    start,
    advance,
    finish,
    sync,
    refresh,
  }
}

export type { EmployeeWorkday, WorkdayCompanyDashboard }
