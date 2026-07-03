import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  loadRuntimeMonitorDashboard,
  type RuntimeMonitorDashboard,
  type RuntimeMonitorFilter,
} from '../domain/runtimeMonitor'
import { syncRuntimeDerivedStores } from '../domain/runtime/runtimeDataSources'

export function useRuntimeMonitor(filter: RuntimeMonitorFilter = {}) {
  const employeeId = filter.employeeId

  const [dashboard, setDashboard] = useState<RuntimeMonitorDashboard>(() => {
    syncRuntimeDerivedStores()
    return loadRuntimeMonitorDashboard(filter)
  })

  const refresh = useCallback(() => {
    syncRuntimeDerivedStores()
    setDashboard(loadRuntimeMonitorDashboard(filter))
  }, [employeeId])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-runtime-runs') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const summary = useMemo(
    () => ({
      averageRuntimeMs: dashboard.averageRuntimeMs,
      completedToday: dashboard.completedToday,
      totalCostToday: dashboard.totalCostToday,
      timeoutRate: dashboard.timeoutRate,
    }),
    [dashboard],
  )

  return { dashboard, summary, refresh }
}
