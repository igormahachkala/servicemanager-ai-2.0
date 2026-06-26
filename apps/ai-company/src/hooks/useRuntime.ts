import { useCallback, useEffect, useMemo, useState } from 'react'
import { cancelRuntimeExecution } from '../domain/runtime/providers/runtimeAdapter'
import {
  completeRuntimeRunAfterApproval,
  getActiveRuntimeRunId,
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
  const [executionStartedAt, setExecutionStartedAt] = useState<number | null>(null)
  const [executionElapsedMs, setExecutionElapsedMs] = useState(0)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)

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

  useEffect(() => {
    if (!executing || executionStartedAt == null) return
    const timer = window.setInterval(() => {
      setExecutionElapsedMs(Date.now() - executionStartedAt)
    }, 250)
    return () => window.clearInterval(timer)
  }, [executing, executionStartedAt])

  useEffect(() => {
    if (!executing) return
    const timer = window.setInterval(() => {
      const currentRunId = getActiveRuntimeRunId()
      if (currentRunId) setActiveRunId(currentRunId)
    }, 300)
    return () => window.clearInterval(timer)
  }, [executing])

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
    setExecutionStartedAt(Date.now())
    setExecutionElapsedMs(0)
    setActiveRunId(null)
    try {
      const created = await orchestrateRuntimeRun(request)
      setRuns(loadRuntimeRuns())
      if (created.status === 'failed' || created.status === 'cancelled') {
        setExecutionError(
          created.result?.warnings.find((item) => item.severity === 'error' || item.severity === 'warn')
            ?.message ?? 'Runtime run failed',
        )
      }
      if (created.result?.executionDurationMs != null) {
        setExecutionElapsedMs(created.result.executionDurationMs)
      }
      return created
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Runtime run failed'
      setExecutionError(message)
      throw error
    } finally {
      setExecuting(false)
      setActiveRunId(null)
    }
  }, [])

  const cancelRun = useCallback(async (): Promise<boolean> => {
    const runId = getActiveRuntimeRunId() ?? activeRunId
    if (!runId) return false
    return cancelRuntimeExecution(runId)
  }, [activeRunId])

  const approveRun = useCallback(async (runId: string): Promise<RuntimeRun | null> => {
    setExecuting(true)
    setExecutionError(null)
    setExecutionStartedAt(Date.now())
    setExecutionElapsedMs(0)
    try {
      const updated = await completeRuntimeRunAfterApproval(runId)
      setRuns(loadRuntimeRuns())
      if (updated?.result?.executionDurationMs != null) {
        setExecutionElapsedMs(updated.result.executionDurationMs)
      }
      return updated
    } finally {
      setExecuting(false)
    }
  }, [])

  const getRun = useCallback((runId: string) => getRuntimeRunById(runId), [])

  return {
    runs,
    stats,
    refresh,
    startRun,
    cancelRun,
    approveRun,
    getRun,
    executing,
    executionError,
    executionElapsedMs,
    activeRunId,
  }
}

export type { RuntimeRun, RuntimeRunRequest } from '../domain/runtime/runtimeOrchestrator'
