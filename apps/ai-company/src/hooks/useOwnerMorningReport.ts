import { useCallback, useEffect, useMemo, useState } from 'react'
import { CURSOR_AUTOMATION_OWNER_APPROVAL_SYNC_EVENT, CURSOR_AUTOMATION_SUBMIT_SYNC_EVENT } from '../domain/cursorAutomation'
import { buildOwnerMorningReportSnapshot } from '../domain/morningReport'
import { MAX_WORKER_LOOP_SYNC_EVENT } from './useMaxWorkerLoop'

const REPORT_SYNC_EVENT = 'ai-company-owner-morning-report-sync'

export function refreshOwnerMorningReport(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(REPORT_SYNC_EVENT))
}

export function useOwnerMorningReport() {
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => {
    setTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const onSync = () => refresh()
    window.addEventListener(REPORT_SYNC_EVENT, onSync)
    window.addEventListener(MAX_WORKER_LOOP_SYNC_EVENT, onSync)
    window.addEventListener(CURSOR_AUTOMATION_OWNER_APPROVAL_SYNC_EVENT, onSync)
    window.addEventListener(CURSOR_AUTOMATION_SUBMIT_SYNC_EVENT, onSync)
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === 'ai-company-max-worker-loops' ||
        event.key === 'ai-company-reports' ||
        event.key === 'ai-company-cursor-automation-owner-approvals' ||
        event.key === 'ai-company-cursor-automation-submit-runs' ||
        event.key === 'ai-company-work-scheduler-plans' ||
        event.key === 'ai-company-approvals'
      ) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(REPORT_SYNC_EVENT, onSync)
      window.removeEventListener(MAX_WORKER_LOOP_SYNC_EVENT, onSync)
      window.removeEventListener(CURSOR_AUTOMATION_OWNER_APPROVAL_SYNC_EVENT, onSync)
      window.removeEventListener(CURSOR_AUTOMATION_SUBMIT_SYNC_EVENT, onSync)
      window.removeEventListener('storage', onStorage)
    }
  }, [refresh])

  const snapshot = useMemo(() => {
    void tick
    return buildOwnerMorningReportSnapshot()
  }, [tick])

  return { snapshot, refresh }
}
