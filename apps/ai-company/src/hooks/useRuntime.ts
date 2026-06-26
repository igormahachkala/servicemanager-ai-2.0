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
  const [executing, setExecuting] = useState(false)
  const [executionError, setExecutionError] = useState<string | null>(null)

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

  const startRun = useCallback(async (request: RuntimeRunRequest): Promise<RuntimeRun> => {
    setExecuting(true)
    setExecutionError(null)
    try {
      const created = await orchestrateRuntimeRun(request)
      setRuns(loadRuntimeRuns())
      if (created.status === 'failed') {
        setExecutionError(created.result?.warnings.find((item) => item.severity === 'error')?.message ?? 'Runtime run failed')
      }
      return created
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Runtime run failed'
      setExecutionError(message)
      throw error
    } finally {
      setExecuting(false)
    }
  }, [])

  const approveRun = useCallback(async (runId: string): Promise<RuntimeRun | null> => {
    setExecuting(true)
    setExecutionError(null)
    try {
      const updated = await completeRuntimeRunAfterApproval(runId)
      setRuns(loadRuntimeRuns())
      return updated
    } finally {
      setExecuting(false)
    }
  }, [])

  const getRun = useCallback((runId: string) => getRuntimeRunById(runId), [])

  return { runs, stats, refresh, startRun, approveRun, getRun, executing, executionError }
}

export type { RuntimeRun, RuntimeRunRequest } from '../domain/runtime/runtimeOrchestrator'
