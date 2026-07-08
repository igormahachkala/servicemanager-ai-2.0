import { useCallback, useEffect, useMemo, useState } from 'react'
import { CURSOR_AUTOMATION_SYNC_EVENT } from '../../domain/cursorAutomation/cursorAutomationStorage'
import { CURSOR_AUTOMATION_OWNER_APPROVAL_SYNC_EVENT } from '../../domain/cursorAutomation/cursorAutomationOwnerApproval'
import { EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT } from '../../domain/employeeDailyJournal'
import { EMPLOYEE_WORK_QUEUE_SYNC_EVENT } from '../../domain/employeeWorkQueue'
import {
  approveMobileOwnerDecision,
  buildMobileOwnerDecisionsSnapshot,
  countMobileOwnerDecisionsByFilter,
  filterMobileOwnerDecisions,
  rejectMobileOwnerDecision,
  type MobileOwnerDecisionFilter,
  type MobileOwnerDecisionItem,
} from '../../domain/mobileOwnerDecisions'
import { MAX_WORKER_LOOP_SYNC_EVENT } from '../../hooks/useMaxWorkerLoop'

const APPROVAL_SYNC_EVENT = 'ai-company-approval-sync'

export function useMobileOwnerDecisions() {
  const [filter, setFilter] = useState<MobileOwnerDecisionFilter>('all')
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => {
    setTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const onChange = () => refresh()
    window.addEventListener(APPROVAL_SYNC_EVENT, onChange)
    window.addEventListener(CURSOR_AUTOMATION_SYNC_EVENT, onChange)
    window.addEventListener(CURSOR_AUTOMATION_OWNER_APPROVAL_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
    window.addEventListener(MAX_WORKER_LOOP_SYNC_EVENT, onChange)
    return () => {
      window.removeEventListener(APPROVAL_SYNC_EVENT, onChange)
      window.removeEventListener(CURSOR_AUTOMATION_SYNC_EVENT, onChange)
      window.removeEventListener(CURSOR_AUTOMATION_OWNER_APPROVAL_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT, onChange)
      window.removeEventListener(MAX_WORKER_LOOP_SYNC_EVENT, onChange)
    }
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key) return
      if (
        event.key.includes('approvals') ||
        event.key.includes('cursor-automation') ||
        event.key.includes('work-queue') ||
        event.key.includes('journal') ||
        event.key.includes('max-worker-loop')
      ) {
        refresh()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const allItems = useMemo(() => {
    void tick
    return buildMobileOwnerDecisionsSnapshot()
  }, [tick])

  const items = useMemo(
    () => filterMobileOwnerDecisions(allItems, filter),
    [allItems, filter],
  )

  const counts = useMemo(() => countMobileOwnerDecisionsByFilter(allItems), [allItems])

  const approve = useCallback(
    (item: MobileOwnerDecisionItem) => {
      const ok = approveMobileOwnerDecision(item)
      refresh()
      return ok
    },
    [refresh],
  )

  const reject = useCallback(
    (item: MobileOwnerDecisionItem) => {
      const ok = rejectMobileOwnerDecision(item)
      refresh()
      return ok
    },
    [refresh],
  )

  return {
    filter,
    setFilter,
    items,
    allItems,
    counts,
    approve,
    reject,
    refresh,
  }
}
