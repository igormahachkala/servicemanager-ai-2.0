import type { RuntimeRun } from '../runtime/runtimeRun'

export type RuntimeRunMetrics = {
  runId: string
  employeeId: string
  employeeCodename: string
  modelId: string
  modelName: string
  providerId: string
  providerName: string
  status: RuntimeRun['status']
  durationMs: number | null
  cpuTimeMs: number | null
  estimatedTokens: number
  estimatedCost: number
  startedAt: string
  isTimeout: boolean
}

export type ModelPerformanceRow = {
  modelId: string
  modelName: string
  runCount: number
  avgDurationMs: number
  avgCost: number
  totalCost: number
  totalTokens: number
}

export type EmployeePerformanceRow = {
  employeeId: string
  codename: string
  runCount: number
  totalCost: number
  avgDurationMs: number
}

export type RuntimeMonitorDashboard = {
  runs: RuntimeRunMetrics[]
  fastModels: ModelPerformanceRow[]
  heavyModels: ModelPerformanceRow[]
  averageRuntimeMs: number | null
  longestRun: RuntimeRunMetrics | null
  timeoutRate: number
  completedToday: number
  totalCostToday: number
  topEmployees: EmployeePerformanceRow[]
  topModels: ModelPerformanceRow[]
}

export type RuntimeMonitorFilter = {
  employeeId?: string
}
