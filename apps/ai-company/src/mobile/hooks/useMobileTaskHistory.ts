import { useCallback, useEffect, useMemo, useState } from 'react'
import { EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT } from '../../domain/employeeDailyJournal'
import { EMPLOYEE_WORK_QUEUE_SYNC_EVENT } from '../../domain/employeeWorkQueue'
import { EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT } from '../../domain/operatingDaySummary/operatingDaySummaryStorage'
import { MAX_WORKER_LOOP_SYNC_EVENT } from '../../hooks/useMaxWorkerLoop'
import {
  buildMobileTaskHistorySnapshot,
  findMobileTaskHistoryGroup,
  type MobileTaskHistorySnapshot,
} from '../history/mobileTaskHistoryViewModel'
import {
  isMobileTaskHistoryGroupId,
  type MobileTaskHistoryGroupId,
} from '../history/mobileTaskHistoryTypes'

const REFRESH_EVENTS = [
  EMPLOYEE_WORK_QUEUE_SYNC_EVENT,
  MAX_WORKER_LOOP_SYNC_EVENT,
  EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT,
  EMPLOYEE_OPERATING_DAY_SUMMARY_SYNC_EVENT,
  'ai-company-mobile-demo-sync',
] as const

export function useMobileTaskHistory(selectedGroupId: string | null) {
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => {
    setTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const onChange = () => refresh()
    for (const eventName of REFRESH_EVENTS) {
      window.addEventListener(eventName, onChange)
    }
    window.addEventListener('focus', onChange)
    window.addEventListener('visibilitychange', onChange)
    return () => {
      for (const eventName of REFRESH_EVENTS) {
        window.removeEventListener(eventName, onChange)
      }
      window.removeEventListener('focus', onChange)
      window.removeEventListener('visibilitychange', onChange)
    }
  }, [refresh])

  const snapshot: MobileTaskHistorySnapshot = useMemo(() => {
    void tick
    return buildMobileTaskHistorySnapshot()
  }, [tick])

  const activeGroupId: MobileTaskHistoryGroupId | null = useMemo(() => {
    if (!selectedGroupId) return null
    return isMobileTaskHistoryGroupId(selectedGroupId) ? selectedGroupId : null
  }, [selectedGroupId])

  const activeGroup = useMemo(
    () => findMobileTaskHistoryGroup(snapshot, activeGroupId),
    [activeGroupId, snapshot],
  )

  return {
    snapshot,
    activeGroupId,
    activeGroup,
    refresh,
  }
}
