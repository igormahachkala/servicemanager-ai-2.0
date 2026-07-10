/**
 * Cursor Local Bridge — browser client types (AI-COMPANY-113E).
 */

export const CURSOR_BRIDGE_DEFAULT_HOST = '127.0.0.1'

export const CURSOR_BRIDGE_DEFAULT_PORT = 17319

export const CURSOR_BRIDGE_SYNC_EVENT = 'ai-company-cursor-bridge-sync'

export type CursorBridgeEnqueuePayload = {
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

export type CursorBridgeRunSnapshot = {
  runId: string
  status: 'pending' | 'queued' | 'opened' | 'result_received' | 'failed'
  title: string
  employeeId: string | null
  workItemId: string | null
  companyId: string | null
  inboxRelativePath: string
  outboxRelativePath: string
  cursorOpenExitCode: number | null
  resultIngestedAt: string | null
  result: CursorLocalResultPayload | null
  history: Array<{ at: string; message: string; cursorExitCode: number | null }>
}

export type CursorBridgeClientOutcome = {
  ok: boolean
  bridgeOnline: boolean
  run: CursorBridgeRunSnapshot | null
  error: string | null
}

export type CursorLocalResultPayload = {
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
