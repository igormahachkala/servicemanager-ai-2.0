import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT } from '../../domain/employeeDailyJournal'
import { EMPLOYEE_WORK_QUEUE_SYNC_EVENT } from '../../domain/employeeWorkQueue'
import { MAX_WORKER_LOOP_SYNC_EVENT } from '../../hooks/useMaxWorkerLoop'
import {
  buildMobileDemoChecklist,
  prepareMobileDemoScenario,
  type MobileDemoChecklistView,
} from '../demo/mobileDemoViewModel'
import {
  endMobileDemoSession,
  loadMobileDemoState,
  MOBILE_DEMO_SYNC_EVENT,
  recordMobileDemoRouteVisit,
  setMobileDemoModeEnabled,
  startMobileDemoSession,
  type MobileDemoSession,
} from '../demo/mobileDemoStorage'
import { resetMobileDemoRuntimeData } from '../demo/mobileDemoReset'
import { seedMobileDemoWorkItem } from '../demo/mobileDemoSeed'

const REFRESH_EVENTS = [
  MOBILE_DEMO_SYNC_EVENT,
  EMPLOYEE_WORK_QUEUE_SYNC_EVENT,
  MAX_WORKER_LOOP_SYNC_EVENT,
  EMPLOYEE_DAILY_JOURNAL_SYNC_EVENT,
  'ai-company-approval-sync',
] as const

export function useMobileDemo() {
  const { pathname } = useLocation()
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => {
    setTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const onChange = () => refresh()
    for (const eventName of REFRESH_EVENTS) {
      window.addEventListener(eventName, onChange)
    }
    return () => {
      for (const eventName of REFRESH_EVENTS) {
        window.removeEventListener(eventName, onChange)
      }
    }
  }, [refresh])

  const state = useMemo(() => {
    void tick
    return loadMobileDemoState()
  }, [tick])

  useEffect(() => {
    if (!state.enabled) return
    recordMobileDemoRouteVisit(pathname)
    refresh()
  }, [pathname, refresh, state.enabled])

  const checklist: MobileDemoChecklistView | null = useMemo(() => {
    void tick
    return buildMobileDemoChecklist(state.session)
  }, [state.session, tick])

  const enableDemoMode = useCallback(() => {
    setMobileDemoModeEnabled(true)
    refresh()
  }, [refresh])

  const disableDemoMode = useCallback(() => {
    endMobileDemoSession()
    refresh()
  }, [refresh])

  const resetDemoData = useCallback(() => {
    resetMobileDemoRuntimeData()
    refresh()
  }, [refresh])

  const startDemoSession = useCallback((): MobileDemoSession => {
    const session = startMobileDemoSession()
    refresh()
    return session
  }, [refresh])

  const prepareDemo = useCallback((): MobileDemoSession => {
    const session = prepareMobileDemoScenario()
    refresh()
    return session
  }, [refresh])

  const seedDemoTask = useCallback(() => {
    seedMobileDemoWorkItem()
    refresh()
  }, [refresh])

  return {
    enabled: state.enabled,
    session: state.session,
    checklist,
    refresh,
    enableDemoMode,
    disableDemoMode,
    resetDemoData,
    startDemoSession,
    prepareDemo,
    seedDemoTask,
  }
}
