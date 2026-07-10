/**
 * Cursor Local Adapter — types & port contract (AI-COMPANY-113C).
 * No Cursor Cloud API. No fake success.
 */

export const CURSOR_LOCAL_ADAPTER_VERSION = 'v1' as const

export const CURSOR_LOCAL_INBOX_STORAGE_KEY = 'ai-company-cursor-local-inbox'

export const CURSOR_LOCAL_OUTBOX_STORAGE_KEY = 'ai-company-cursor-local-outbox'

export const CURSOR_LOCAL_ADAPTER_SYNC_EVENT = 'ai-company-cursor-local-adapter-sync'

export const CURSOR_LOCAL_CAPABILITY_IDS = [
  'filesystem_inbox',
  'clipboard_handoff',
  'cli_open_workspace',
  'cli_open_file',
  'cli_chat_window',
  'cursor_agent_cli',
  'cursor_automation_ui',
] as const

export type CursorLocalCapabilityId = (typeof CURSOR_LOCAL_CAPABILITY_IDS)[number]

export type CursorLocalCapability = {
  id: CursorLocalCapabilityId
  available: boolean
  confirmed: boolean
  requiresManualAction: boolean
  requiresUserSession: boolean
  requiresApiAuth: boolean
  notes: string
}

export const CURSOR_LOCAL_ADAPTER_STATUSES = [
  'unsupported',
  'partial',
  'ready',
  'blocked',
] as const

export type CursorLocalAdapterStatus = (typeof CURSOR_LOCAL_ADAPTER_STATUSES)[number]

export const CURSOR_LOCAL_SUBMISSION_STATUSES = [
  'unsupported',
  'prepared',
  'opened',
  'submitted',
] as const

export type CursorLocalSubmissionStatus = (typeof CURSOR_LOCAL_SUBMISSION_STATUSES)[number]

export const CURSOR_LOCAL_POLL_STATUSES = [
  'pending',
  'ready',
  'unsupported',
  'not_found',
] as const

export type CursorLocalPollStatus = (typeof CURSOR_LOCAL_POLL_STATUSES)[number]

export type CursorLocalTaskMetadata = {
  envelopeId: string
  version: typeof CURSOR_LOCAL_ADAPTER_VERSION
  toolExecutionRunId: string | null
  workItemId: string | null
  employeeId: string | null
  companyId: string | null
  title: string
  repositoryRelativeRoot: string
  inboxRelativePath: string
  outboxRelativePath: string
  fileScope: string[]
  createdAt: string
  source: 'tool_execution_run' | 'manual'
}

export type CursorLocalTaskEnvelope = {
  envelopeId: string
  taskMarkdown: string
  metadata: CursorLocalTaskMetadata
  expectedResultMarkdown: string
  checksMarkdown: string
  relativeInboxPath: string
  relativeOutboxPath: string
  createdAt: string
}

export type CursorLocalSubmissionResult = {
  status: CursorLocalSubmissionStatus
  reason: string | null
  envelopeId: string | null
  openedUri: string | null
  requiresManualAction: boolean
}

export type CursorLocalPollResult = {
  status: CursorLocalPollStatus
  reason: string | null
  envelopeId: string
}

export type CursorLocalResultMetadata = {
  envelopeId: string
  recordedAt: string
  recordedBy: 'owner' | 'script' | 'unknown'
  checksPassed: boolean | null
  summary: string | null
}

export type CursorLocalResultEnvelope = {
  envelopeId: string
  resultMarkdown: string
  metadata: CursorLocalResultMetadata
  ingestedAt: string
}

export type PrepareCursorLocalTaskInput = {
  title: string
  instructions: string
  expectedResult?: string | null
  checks?: string[]
  fileScope?: string[]
  toolExecutionRunId?: string | null
  workItemId?: string | null
  employeeId?: string | null
  companyId?: string | null
  repositoryRelativeRoot?: string
}

export type SubmitCursorLocalTaskInput = {
  envelopeId: string
  /** When true, only validate — never claim success without confirmed channel. */
  dryRun?: boolean
}

export interface CursorLocalAdapter {
  detectCapabilities(): CursorLocalCapability[]
  getStatus(): CursorLocalAdapterStatus
  prepareTask(input: PrepareCursorLocalTaskInput): CursorLocalTaskEnvelope
  submitTask(input: SubmitCursorLocalTaskInput): CursorLocalSubmissionResult
  pollTask(envelopeId: string): CursorLocalPollResult
  ingestResult(envelopeId: string): CursorLocalResultEnvelope | null
}
