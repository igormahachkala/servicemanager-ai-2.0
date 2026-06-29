import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  approveWorkSuggestion,
  computeWorkSchedulerStats,
  dismissWorkSuggestion,
  getWorkSchedulerPlanByTaskResultId,
  listPendingWorkSuggestions,
  loadWorkSchedulerPlans,
  type WorkSchedulerPlan,
  type WorkSchedulerStats,
  type WorkSuggestion,
} from '../domain/workScheduler'

const REFRESH_KEY = 'ai-company-work-scheduler-plans'

export function useWorkScheduler(options?: {
  taskResultId?: string | null
  employeeId?: string | null
  projectId?: string | null
}) {
  const [plans, setPlans] = useState<WorkSchedulerPlan[]>(() => loadWorkSchedulerPlans())
  const [stats, setStats] = useState<WorkSchedulerStats>(() => computeWorkSchedulerStats())

  const refresh = useCallback(() => {
    setPlans(loadWorkSchedulerPlans())
    setStats(computeWorkSchedulerStats())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === REFRESH_KEY) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const plan = useMemo(() => {
    if (options?.taskResultId) return getWorkSchedulerPlanByTaskResultId(options.taskResultId)
    return null
  }, [options?.taskResultId, plans])

  const pending = useMemo(() => {
    return listPendingWorkSuggestions({
      employeeId: options?.employeeId ?? undefined,
      projectId: options?.projectId ?? undefined,
      limit: 12,
    })
  }, [options?.employeeId, options?.projectId, plans])

  const approve = useCallback(
    (planId: string, suggestionId: string, comment?: string) => {
      approveWorkSuggestion(planId, suggestionId, comment)
      refresh()
    },
    [refresh],
  )

  const dismiss = useCallback(
    (planId: string, suggestionId: string) => {
      dismissWorkSuggestion(planId, suggestionId)
      refresh()
    },
    [refresh],
  )

  return { plans, plan, pending, stats, refresh, approve, dismiss }
}

export type { WorkSchedulerPlan, WorkSuggestion }
