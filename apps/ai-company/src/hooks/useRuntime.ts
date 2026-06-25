import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  completeRuntimeRunAfterApproval,
  getRuntimeRunById,
  loadRuntimeRuns,
  orchestrateRuntimeRun,
  type RuntimeRun,
  type RuntimeRunRequest,
} from '../domain/runtime/runtimeOrchestrator'

export function useRuntime() {
  const [runs, setRuns] = useState<RuntimeRun[]>([])

  const refresh = useCallback(() => {
    setRuns(loadRuntimeRuns())
  }, [])

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

  const stats = useMemo(
    () => ({
      total: runs.length,
      completed: runs.filter((item) => item.status === 'completed').length,
      waitingApproval: runs.filter((item) => item.status === 'waiting_approval').length,
      failed: runs.filter((item) => item.status === 'failed').length,
    }),
    [runs],
  )

  const startRun = useCallback(
    (request: RuntimeRunRequest): RuntimeRun => {
      const created = orchestrateRuntimeRun(request)
      setRuns(loadRuntimeRuns())
      return created
    },
    [],
  )

  const approveRun = useCallback((runId: string): RuntimeRun | null => {
    const updated = completeRuntimeRunAfterApproval(runId)
    setRuns(loadRuntimeRuns())
    return updated
  }, [])

  const getRun = useCallback((runId: string) => getRuntimeRunById(runId), [])

  return { runs, stats, refresh, startRun, approveRun, getRun }
}

export type { RuntimeRun, RuntimeRunRequest } from '../domain/runtime/runtimeOrchestrator'
