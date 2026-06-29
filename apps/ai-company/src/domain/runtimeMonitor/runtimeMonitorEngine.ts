import { computeDurationMs } from '../run/runMetrics'
import { getModelById, getProviderById } from '../runtime/runtimeStorage'
import { loadRuntimeRuns } from '../runtime/runtimeOrchestrator'
import type { RuntimeRun } from '../runtime/runtimeRun'
import { resolveEmployee } from '../../mission-control/data/conversation'
import type {
  EmployeePerformanceRow,
  ModelPerformanceRow,
  RuntimeMonitorDashboard,
  RuntimeMonitorFilter,
  RuntimeRunMetrics,
} from './runtimeMonitor'

const HEAVY_MODEL_COST_THRESHOLD = 0.01
const FAST_MODEL_DURATION_THRESHOLD_MS = 15_000

function isToday(iso: string): boolean {
  const date = new Date(iso)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function isTimeoutRun(run: RuntimeRun): boolean {
  if (run.status === 'cancelled') {
    return run.result?.warnings.some((item) => /timeout|timed out/i.test(item.message)) ?? false
  }
  if (run.status === 'failed') {
    return run.result?.warnings.some((item) => /timeout|timed out/i.test(item.message)) ?? false
  }
  return false
}

export function formatDurationMs(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

export function formatCost(value: number): string {
  return `$${value.toFixed(4)}`
}

export function formatTokens(value: number): string {
  return value.toLocaleString()
}

export function buildRuntimeRunMetrics(run: RuntimeRun): RuntimeRunMetrics {
  const employee = resolveEmployee(run.employeeId)
  const model = getModelById(run.modelId)
  const provider = getProviderById(run.providerId)
  const durationMs = computeDurationMs(run.startedAt, run.finishedAt)
  const cpuTimeMs = run.result?.executionDurationMs ?? durationMs

  return {
    runId: run.id,
    employeeId: run.employeeId,
    employeeCodename: employee?.codename ?? run.employeeId,
    modelId: run.modelId,
    modelName: model?.name ?? run.modelId,
    providerId: run.providerId,
    providerName: provider?.name ?? run.providerId,
    status: run.status,
    durationMs,
    cpuTimeMs,
    estimatedTokens: run.result?.estimatedTokens ?? 0,
    estimatedCost: run.result?.estimatedCost ?? 0,
    startedAt: run.startedAt,
    isTimeout: isTimeoutRun(run),
  }
}

function aggregateModels(metrics: RuntimeRunMetrics[]): ModelPerformanceRow[] {
  const map = new Map<string, ModelPerformanceRow & { durationSum: number }>()

  for (const item of metrics) {
    const current = map.get(item.modelId) ?? {
      modelId: item.modelId,
      modelName: item.modelName,
      runCount: 0,
      avgDurationMs: 0,
      avgCost: 0,
      totalCost: 0,
      totalTokens: 0,
      durationSum: 0,
    }
    current.runCount += 1
    current.totalCost += item.estimatedCost
    current.totalTokens += item.estimatedTokens
    current.durationSum += item.cpuTimeMs ?? item.durationMs ?? 0
    map.set(item.modelId, current)
  }

  return [...map.values()]
    .map((item) => ({
      modelId: item.modelId,
      modelName: item.modelName,
      runCount: item.runCount,
      avgDurationMs: item.runCount > 0 ? Math.round(item.durationSum / item.runCount) : 0,
      avgCost: item.runCount > 0 ? item.totalCost / item.runCount : 0,
      totalCost: item.totalCost,
      totalTokens: item.totalTokens,
    }))
    .sort((a, b) => b.runCount - a.runCount)
}

function aggregateEmployees(metrics: RuntimeRunMetrics[]): EmployeePerformanceRow[] {
  const map = new Map<string, EmployeePerformanceRow & { durationSum: number }>()

  for (const item of metrics) {
    const current = map.get(item.employeeId) ?? {
      employeeId: item.employeeId,
      codename: item.employeeCodename,
      runCount: 0,
      totalCost: 0,
      avgDurationMs: 0,
      durationSum: 0,
    }
    current.runCount += 1
    current.totalCost += item.estimatedCost
    current.durationSum += item.cpuTimeMs ?? item.durationMs ?? 0
    map.set(item.employeeId, current)
  }

  return [...map.values()]
    .map((item) => ({
      employeeId: item.employeeId,
      codename: item.codename,
      runCount: item.runCount,
      totalCost: item.totalCost,
      avgDurationMs: item.runCount > 0 ? Math.round(item.durationSum / item.runCount) : 0,
    }))
    .sort((a, b) => b.runCount - a.runCount)
}

export function buildRuntimeMonitorDashboard(
  runs: RuntimeRun[],
  filter: RuntimeMonitorFilter = {},
): RuntimeMonitorDashboard {
  const scoped = filter.employeeId
    ? runs.filter((item) => item.employeeId === filter.employeeId)
    : runs

  const metrics = scoped
    .map(buildRuntimeRunMetrics)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  const completed = metrics.filter((item) => item.status === 'completed')
  const withDuration = completed.filter((item) => item.cpuTimeMs != null || item.durationMs != null)
  const durationValues = withDuration.map((item) => item.cpuTimeMs ?? item.durationMs ?? 0)
  const averageRuntimeMs =
    durationValues.length > 0
      ? Math.round(durationValues.reduce((sum, value) => sum + value, 0) / durationValues.length)
      : null

  const longestRun =
    withDuration.length > 0
      ? [...withDuration].sort(
          (a, b) => (b.cpuTimeMs ?? b.durationMs ?? 0) - (a.cpuTimeMs ?? a.durationMs ?? 0),
        )[0]
      : null

  const timeoutCandidates = metrics.filter(
    (item) => item.status === 'failed' || item.status === 'cancelled' || item.isTimeout,
  )
  const timeoutCount = timeoutCandidates.filter((item) => item.isTimeout).length
  const timeoutRate =
    timeoutCandidates.length > 0 ? Math.round((timeoutCount / timeoutCandidates.length) * 100) : 0

  const todayMetrics = metrics.filter((item) => isToday(item.startedAt))
  const completedToday = todayMetrics.filter((item) => item.status === 'completed').length
  const totalCostToday = todayMetrics.reduce((sum, item) => sum + item.estimatedCost, 0)

  const modelRows = aggregateModels(metrics)
  const fastModels = [...modelRows]
    .filter((item) => item.runCount > 0 && item.avgDurationMs <= FAST_MODEL_DURATION_THRESHOLD_MS)
    .sort((a, b) => a.avgDurationMs - b.avgDurationMs)
    .slice(0, 4)

  const heavyModels = [...modelRows]
    .filter((item) => item.avgCost >= HEAVY_MODEL_COST_THRESHOLD || item.totalCost >= 0.05)
    .sort((a, b) => b.avgCost - a.avgCost)
    .slice(0, 4)

  return {
    runs: metrics,
    fastModels,
    heavyModels,
    averageRuntimeMs,
    longestRun,
    timeoutRate,
    completedToday,
    totalCostToday,
    topEmployees: aggregateEmployees(metrics).slice(0, 5),
    topModels: modelRows.slice(0, 5),
  }
}

export function loadRuntimeMonitorDashboard(filter: RuntimeMonitorFilter = {}): RuntimeMonitorDashboard {
  return buildRuntimeMonitorDashboard(loadRuntimeRuns(), filter)
}

export function getRuntimeRunMetrics(runId: string): RuntimeRunMetrics | null {
  const run = loadRuntimeRuns().find((item) => item.id === runId)
  return run ? buildRuntimeRunMetrics(run) : null
}
