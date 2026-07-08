import { useCallback, useEffect, useMemo, useState } from 'react'
import { EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT } from '../../domain/employeeDailyJournal/employeeDailyJournalStorage'
import { EMPLOYEE_WORK_QUEUE_SYNC_EVENT } from '../../domain/employeeWorkQueue'
import {
  buildMobileTasksCenterSnapshot,
  type MobileTaskCenterFilter,
  type MobileTasksCenterSnapshot,
} from '../tasks/mobileTasksCenterViewModel'

export function useMobileTasksCenter(initialFilter: MobileTaskCenterFilter = 'all') {
  const [filter, setFilter] = useState<MobileTaskCenterFilter>(initialFilter)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => {
    setTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const onChange = () => refresh()
    window.addEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
    return () => {
      window.removeEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
    }
  }, [refresh])

  const snapshot: MobileTasksCenterSnapshot = useMemo(() => {
    void tick
    return buildMobileTasksCenterSnapshot(filter)
  }, [filter, tick])

  return {
    filter,
    setFilter,
    snapshot,
    refresh,
  }
}
