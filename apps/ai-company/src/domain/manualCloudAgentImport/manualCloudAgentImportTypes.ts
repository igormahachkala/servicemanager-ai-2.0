/**
 * Manual Cloud Agent result import — types (AI-COMPANY-111).
 */

import type { ExecutionRoute } from '../cursorExecutionRoute/cursorExecutionRouteTypes'
import type { CursorResultEnvelope } from '../cursorResultEnvelope/cursorResultEnvelopeTypes'
import type { EmployeeToolReview } from '../employeeToolReview/employeeToolReviewTypes'
import type { ToolExecutionRun } from '../toolExecution/toolExecutionRunTypes'

export const MANUAL_CLOUD_AGENT_IMPORT_FINAL_STATUSES = [
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'TIMED_OUT',
] as const

export type ManualCloudAgentImportFinalStatus =
  (typeof MANUAL_CLOUD_AGENT_IMPORT_FINAL_STATUSES)[number]

export const MANUAL_CLOUD_AGENT_IMPORT_CHECK_STATUSES = [
  'PASSED',
  'FAILED',
  'SKIPPED',
] as const

export type ManualCloudAgentImportCheckStatus =
  (typeof MANUAL_CLOUD_AGENT_IMPORT_CHECK_STATUSES)[number]

export const MANUAL_CLOUD_AGENT_IMPORT_REASON_CODES = [
  'TOOL_EXECUTION_RUN_NOT_FOUND',
  'ROUTE_MISMATCH',
  'RUN_ALREADY_TERMINAL',
  'RESULT_ALREADY_IMPORTED',
  'INVALID_COMMIT_SHA',
  'INVALID_PULL_REQUEST_URL',
  'EXECUTION_EVIDENCE_REQUIRED',
  'INVALID_STATUS_COMBINATION',
  'IMPORT_ACCEPTED',
  'IMPORT_REQUIRES_REVIEW',
] as const

export type ManualCloudAgentImportReasonCode =
  (typeof MANUAL_CLOUD_AGENT_IMPORT_REASON_CODES)[number]

export type ManualCloudAgentImportCheckInput = {
  name: string
  status: ManualCloudAgentImportCheckStatus
  details?: string
}

export type ManualCloudAgentImportArtifactInput = {
  type: string
  reference: string
  description?: string
}

export type ManualCloudAgentImportErrorInput = {
  code: string
  message: string
  details?: unknown
}

export type ManualCloudAgentImportInput = {
  toolExecutionRunId: string
  branch: string | null
  commitSha: string | null
  pullRequestUrl: string | null
  summary: string
  changedFiles: string[]
  checks: ManualCloudAgentImportCheckInput[]
  artifacts: ManualCloudAgentImportArtifactInput[]
  errors: ManualCloudAgentImportErrorInput[]
  startedAt: string | null
  finishedAt: string
  finalStatus: ManualCloudAgentImportFinalStatus
  externalCorrelationId?: string | null
  metadata?: Record<string, unknown>
}

export type ManualCloudAgentImportEventType =
  | 'manual_cloud_agent_result_import_started'
  | 'manual_cloud_agent_result_import_accepted'
  | 'manual_cloud_agent_result_import_rejected'
  | 'manual_cloud_agent_result_requires_review'
  | 'manual_cloud_agent_result_duplicate'

export type ManualCloudAgentImportEvent = {
  type: ManualCloudAgentImportEventType
  at: string
  toolExecutionRunId: string
  reasonCode: ManualCloudAgentImportReasonCode
  finalStatus: ManualCloudAgentImportFinalStatus | null
}

export type ManualCloudAgentImportOutcome =
  | {
      ok: true
      reasonCode: 'IMPORT_ACCEPTED' | 'IMPORT_REQUIRES_REVIEW'
      envelope: CursorResultEnvelope
      run: ToolExecutionRun
      review: EmployeeToolReview | null
      duplicate: false
      events: ManualCloudAgentImportEvent[]
    }
  | {
      ok: false
      reasonCode: ManualCloudAgentImportReasonCode
      message: string
      existingResultRef: string | null
      events: ManualCloudAgentImportEvent[]
    }

export type ResolvedToolExecutionRunRoute = ExecutionRoute | null
