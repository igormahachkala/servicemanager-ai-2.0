import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  computePresenceStats,
  getPresenceByEmployeeId,
  getTodayWorkdayEvents,
  getWorkdayEventsForEmployee,
  initializePresenceEngine,
  loadPresenceRecords,
  syncPresenceFromPlatform,
  type EmployeePresence,
  type PresenceStats,
  type WorkdayEvent,
} from '../domain/presence'
import { isPresenceWaiting, isPresenceWorking } from '../domain/presence/presenceStats'

const PRESENCE_SYNC_EVENT = 'ai-company-presence-sync'

export function dispatchPresenceSync(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PRESENCE_SYNC_EVENT))
  }
}

export function usePresence() {
  const [records, setRecords] = useState<EmployeePresence[]>(() => initializePresenceEngine())

  const refresh = useCallback(() => {
    setRecords(syncPresenceFromPlatform())
    dispatchPresenceSync()
  }, [])

  const sync = useCallback(() => {
    setRecords(syncPresenceFromPlatform())
    dispatchPresenceSync()
  }, [])

  useEffect(() => {
    const onPresenceSync = () => {
      setRecords(loadPresenceRecords())
    }
    window.addEventListener(PRESENCE_SYNC_EVENT, onPresenceSync)
    return () => window.removeEventListener(PRESENCE_SYNC_EVENT, onPresenceSync)
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === 'ai-company-presence' ||
        event.key === 'ai-company-workday-events' ||
        event.key === 'ai-company-runtime-runs' ||
        event.key === 'ai-company-approvals' ||
        event.key === 'ai-company-chats'
      ) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const stats = useMemo(() => computePresenceStats(records), [records])

  const getByEmployeeId = useCallback((employeeId: string): EmployeePresence | null => {
    return getPresenceByEmployeeId(employeeId)
  }, [])

  const nowWorking = useMemo(
    () => records.filter((item) => isPresenceWorking(item.status)),
    [records],
  )

  const waiting = useMemo(
    () => records.filter((item) => isPresenceWaiting(item.status)),
    [records],
  )

  const todayEvents = useMemo(() => getTodayWorkdayEvents(), [records])

  return {
    records,
    stats,
    nowWorking,
    waiting,
    todayEvents,
    getByEmployeeId,
    getWorkdayEventsForEmployee,
    refresh,
    sync,
  }
}

export type { EmployeePresence, PresenceStats, WorkdayEvent }
