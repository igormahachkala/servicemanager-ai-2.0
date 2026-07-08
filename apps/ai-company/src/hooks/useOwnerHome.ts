import { useCallback, useEffect, useMemo, useState } from 'react'
import { EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT } from '../domain/employeeDailyJournal'
import { EMPLOYEE_WORK_QUEUE_SYNC_EVENT } from '../domain/employeeWorkQueue'
import { buildOwnerHomeSnapshot, type OwnerHomeSnapshot } from '../domain/ownerHome'
import { CURSOR_AUTOMATION_SYNC_EVENT } from '../domain/cursorAutomation/cursorAutomationStorage'
import { CHANGE_EVENT as WORKDAY_CHANGE_EVENT } from '../domain/workday/workdayStorage'
import { MAX_WORKER_LOOP_SYNC_EVENT } from './useMaxWorkerLoop'

const APPROVAL_SYNC_EVENT = 'ai-company-approval-sync'

export function useOwnerHome(): OwnerHomeSnapshot {
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => {
    setTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const onChange = () => refresh()
    window.addEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
    window.addEventListener(MAX_WORKER_LOOP_SYNC_EVENT, onChange)
    window.addEventListener(CURSOR_AUTOMATION_SYNC_EVENT, onChange)
    window.addEventListener(WORKDAY_CHANGE_EVENT, onChange)
    window.addEventListener(APPROVAL_SYNC_EVENT, onChange)
    window.addEventListener('ai-company-presence-sync', onChange)
    window.addEventListener('ai-company-runtime-sync', onChange)
    return () => {
      window.removeEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
      window.removeEventListener(MAX_WORKER_LOOP_SYNC_EVENT, onChange)
      window.removeEventListener(CURSOR_AUTOMATION_SYNC_EVENT, onChange)
      window.removeEventListener(WORKDAY_CHANGE_EVENT, onChange)
      window.removeEventListener(APPROVAL_SYNC_EVENT, onChange)
      window.removeEventListener('ai-company-presence-sync', onChange)
      window.removeEventListener('ai-company-runtime-sync', onChange)
    }
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return
      if (
        event.key.includes('work-queue') ||
        event.key.includes('journal') ||
        event.key.includes('approvals') ||
        event.key.includes('presence') ||
        event.key.includes('runtime') ||
        event.key.includes('cursor-automation') ||
        event.key.includes('workday')
      ) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  return useMemo(() => {
    void tick
    return buildOwnerHomeSnapshot()
  }, [tick])
}
