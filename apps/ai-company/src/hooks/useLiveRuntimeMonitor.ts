import { useEffect, useMemo, useState } from 'react'
import { loadEvents } from '../domain/events/eventStorage'
import { getRunHistoryByRuntimeRunId } from '../domain/run/runStorage'
import { OLLAMA_EXECUTION_TIMEOUT_MS } from '../domain/runtime/providers/runtimeCapabilities'
import { formatElapsedMs, loadRuntimeLogs } from '../domain/runtime/providers/runtimeHealth'
import {
  getActiveRuntimeRunId,
  getRuntimeRunById,
  loadRuntimeRuns,
  type RuntimePipelineStep,
  type RuntimeRun,
} from '../domain/runtime/runtimeOrchestrator'
import { getModelById, getProviderById } from '../domain/runtime/runtimeStorage'
import { resolveEmployee } from '../mission-control/data/conversation'
import { useRuntime } from './useRuntime'
import { useRuntimeProvider } from './useRuntimeProvider'

const POLL_MS = 500

export type LiveStreamEntry = {
  id: string
  at: string
  kind: 'log' | 'event' | 'pipeline'
  level: 'info' | 'warn' | 'error' | 'success'
  message: string
}

export function resolveCurrentPipelineStep(steps: RuntimePipelineStep[]): RuntimePipelineStep | null {
  return (
    steps.find((step) => step.status === 'active') ??
    [...steps].reverse().find((step) => step.status === 'done' || step.status === 'failed') ??
    steps[0] ??
    null
  )
}

export function computeRunElapsedMs(
  run: RuntimeRun | null,
  liveElapsedMs: number,
  isLiveExecuting: boolean,
): number {
  if (!run) return 0
  if (run.status === 'running') {
    if (isLiveExecuting) return liveElapsedMs
    return Math.max(0, Date.now() - new Date(run.startedAt).getTime())
  }
  if (run.result?.executionDurationMs != null) return run.result.executionDurationMs
  if (run.finishedAt) {
    return Math.max(0, new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime())
  }
  return 0
}

export function useLiveRuntimeMonitor(selectedRunId: string | null) {
  const { runs, executing, executionElapsedMs, activeRunId, refresh: refreshRuns } = useRuntime()
  const { activeProvider, activeHealth, activeProviderId } = useRuntimeProvider()
  const [pollTick, setPollTick] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPollTick((value) => value + 1)
      refreshRuns()
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [refreshRuns])

  const activeId = getActiveRuntimeRunId() ?? activeRunId

  const monitoredRun = useMemo(() => {
    void pollTick
    if (selectedRunId) return getRuntimeRunById(selectedRunId)
    if (activeId) return getRuntimeRunById(activeId)
    const running = loadRuntimeRuns().find((item) => item.status === 'running')
    if (running) return running
    return loadRuntimeRuns()[0] ?? null
  }, [selectedRunId, activeId, pollTick, runs])

  const runHistory = useMemo(
    () => (monitoredRun ? getRunHistoryByRuntimeRunId(monitoredRun.id) : null),
    [monitoredRun],
  )

  const logs = useMemo(() => {
    void pollTick
    const all = loadRuntimeLogs()
    if (!monitoredRun) return all.slice(0, 24)
    return all
      .filter((item) => item.runId === monitoredRun.id || item.runId === null)
      .slice(0, 30)
  }, [monitoredRun, pollTick])

  const events = useMemo(() => {
    void pollTick
    if (!monitoredRun) return []
    return loadEvents()
      .filter((event) => event.sourceId === monitoredRun.id)
      .slice(0, 16)
  }, [monitoredRun, pollTick])

  const currentStep = useMemo(
    () => (monitoredRun ? resolveCurrentPipelineStep(monitoredRun.pipeline) : null),
    [monitoredRun],
  )

  const elapsedMs = useMemo(
    () =>
      computeRunElapsedMs(
        monitoredRun,
        executionElapsedMs,
        executing && monitoredRun?.id === activeId,
      ),
    [monitoredRun, executionElapsedMs, executing, activeId],
  )

  const streamEntries = useMemo((): LiveStreamEntry[] => {
    if (!monitoredRun) return []
    const entries: LiveStreamEntry[] = []

    for (const log of logs) {
      entries.push({
        id: log.id,
        at: log.at,
        kind: 'log',
        level: log.level,
        message: log.message,
      })
    }

    for (const event of events) {
      entries.push({
        id: event.id,
        at: event.createdAt,
        kind: 'event',
        level:
          event.severity === 'error'
            ? 'error'
            : event.severity === 'success'
              ? 'success'
              : 'info',
        message: event.type,
      })
    }

    for (const step of monitoredRun.pipeline) {
      if (step.status === 'pending') continue
      entries.push({
        id: `pipeline-${step.id}-${step.status}`,
        at: monitoredRun.startedAt,
        kind: 'pipeline',
        level:
          step.status === 'failed' ? 'error' : step.status === 'done' ? 'success' : 'info',
        message: `${step.id} · ${step.status}${step.detail ? ` · ${step.detail}` : ''}`,
      })
    }

    return entries
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 48)
  }, [monitoredRun, logs, events])

  const employee = monitoredRun ? resolveEmployee(monitoredRun.employeeId) : null
  const model = monitoredRun ? getModelById(monitoredRun.modelId) : null
  const provider = monitoredRun ? getProviderById(monitoredRun.providerId) : null
  const reportStep = monitoredRun?.pipeline.find((step) => step.id === 'create_report') ?? null
  const completeStep = monitoredRun?.pipeline.find((step) => step.id === 'complete') ?? null
  const warnings = monitoredRun?.result?.warnings ?? []

  return {
    monitoredRun,
    runHistory,
    logs,
    events,
    streamEntries,
    warnings,
    currentStep,
    elapsedMs,
    elapsedLabel: formatElapsedMs(elapsedMs),
    timeoutMs: OLLAMA_EXECUTION_TIMEOUT_MS,
    timeoutLabel: `${OLLAMA_EXECUTION_TIMEOUT_MS / 1000}s`,
    activeProvider,
    activeHealth,
    activeProviderId,
    employee,
    model,
    provider,
    reportStep,
    completeStep,
    isLive: monitoredRun?.status === 'running' || executing,
    activeRunId: activeId,
    recentRuns: runs.slice(0, 10),
  }
}
