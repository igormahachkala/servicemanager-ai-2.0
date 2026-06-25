import type { RunArtifact } from './runArtifact'
import type { RunMetrics } from './runMetrics'
import type { RunStep } from './runStep'

export const RUN_HISTORY_STATUSES = [
  'queued',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'cancelled',
] as const

export type RunHistoryStatus = (typeof RUN_HISTORY_STATUSES)[number]

export type RunContextLayer = {
  key: string
  label: string
  loaded: boolean
  itemCount: number
  summary: string
}

export type RunWarning = {
  id: string
  code: string
  message: string
  severity: 'info' | 'warn' | 'error'
}

export type RunTimelineEntry = {
  id: string
  timestamp: string
  label: string
  kind: 'step' | 'warning' | 'artifact' | 'event'
  detail?: string
}

/** Platform-owned execution log — independent of LLM provider. */
export type RunHistory = {
  id: string
  runtimeRunId: string | null
  employeeId: string
  workspaceId: string | null
  status: RunHistoryStatus
  startedAt: string
  finishedAt: string | null
  reportId: string | null
  taskId: string | null
  chatId: string | null
  modelId: string | null
  steps: RunStep[]
  metrics: RunMetrics
  artifacts: RunArtifact[]
  warnings: RunWarning[]
  context: RunContextLayer[]
  timeline: RunTimelineEntry[]
}

export type RunHistoryFilter = {
  status: RunHistoryStatus | 'all'
  employeeId: string | 'all'
  workspaceId: 'all' | 'none' | string
}

export type RunHistoryStats = {
  total: number
  completed: number
  running: number
  waitingApproval: number
  failed: number
  cancelled: number
}

export function isTerminalRunHistoryStatus(status: RunHistoryStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}
