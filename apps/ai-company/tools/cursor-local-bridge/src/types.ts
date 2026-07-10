/**
 * Cursor Local Bridge — shared types (AI-COMPANY-113E).
 * Node-only process; no Cursor Cloud API.
 */

export const CURSOR_BRIDGE_VERSION = 'v1' as const

export const CURSOR_BRIDGE_RUN_STATUSES = [
  'pending',
  'queued',
  'opened',
  'result_received',
  'failed',
] as const

export type CursorBridgeRunStatus = (typeof CURSOR_BRIDGE_RUN_STATUSES)[number]

export type CursorBridgeHistoryEntry = {
  at: string
  message: string
  cursorExitCode: number | null
}

export type CursorBridgeEnqueueRequest = {
  runId: string
  title: string
  instructions: string
  expectedResult?: string
  fileScope?: string[]
  checks?: string[]
  employeeId?: string | null
  workItemId?: string | null
  companyId?: string | null
  repositoryRoot?: string | null
  workspaceRelativePath?: string | null
}

export type CursorBridgeRunRecord = {
  version: typeof CURSOR_BRIDGE_VERSION
  runId: string
  status: CursorBridgeRunStatus
  title: string
  employeeId: string | null
  workItemId: string | null
  companyId: string | null
  repositoryRoot: string
  inboxRelativePath: string
  outboxRelativePath: string
  cursorBinary: string | null
  cursorOpenExitCode: number | null
  cursorOpenError: string | null
  history: CursorBridgeHistoryEntry[]
  resultIngestedAt: string | null
  result: CursorLocalResultJson | null
  createdAt: string
  updatedAt: string
}

export type CursorLocalResultJson = {
  runId: string
  status: 'completed' | 'failed' | 'partial'
  summary: string
  changedFiles: string[]
  checks: string[]
  commit: string | null
  pullRequest: string | null
  warnings: string[]
  errors: string[]
  completedAt: string
}

export type CursorBridgeStatusSnapshot = {
  version: typeof CURSOR_BRIDGE_VERSION
  running: boolean
  host: string
  port: number
  repositoryRoot: string
  cursorBinary: string | null
  cursorDetected: boolean
  inboxRelativePath: string
  outboxRelativePath: string
  pendingDirectory: string
  runs: CursorBridgeRunRecord[]
  startedAt: string | null
}
