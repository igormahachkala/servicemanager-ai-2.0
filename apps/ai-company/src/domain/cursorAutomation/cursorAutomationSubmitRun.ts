/**
 * Cursor Automation Submit Run — production-ready submit record (AI-COMPANY-099A).
 * Persisted locally until Runtime Persistence / Cursor API adapter is connected.
 */

import type { CursorAutomationExpectedResult, CursorAutomationPlan } from './cursorAutomationTypes'

export const CURSOR_AUTOMATION_SUBMIT_RUN_STATUSES = [
  'submitted_mock',
  'submitted_pending_real_adapter',
  'waiting_for_result',
  'failed',
  'completed',
] as const

export type CursorAutomationSubmitRunStatus =
  (typeof CURSOR_AUTOMATION_SUBMIT_RUN_STATUSES)[number]

export const CURSOR_AUTOMATION_SUBMIT_DELIVERY_MODES = [
  'mock_v1_stub',
  'pending_real_adapter',
] as const

export type CursorAutomationSubmitDeliveryMode =
  (typeof CURSOR_AUTOMATION_SUBMIT_DELIVERY_MODES)[number]

export type CursorAutomationHandoffPayload = {
  handoffId: string
  promptMarkdown: string
  plan: CursorAutomationPlan
  expectedResult: CursorAutomationExpectedResult
  metadata: {
    maxWorkerLoopId: string
    runtimeRunId: string | null
    ownerApprovalId: string
    employeeId: string
    submittedBy: 'owner'
    workflowVersion: string
  }
}

/** CursorAutomationRun — submit artifact for adapter ingestion. */
export type CursorAutomationSubmitRun = {
  runId: string
  maxWorkerLoopId: string
  runtimeRunId: string | null
  ownerApprovalId: string
  handoffId: string
  status: CursorAutomationSubmitRunStatus
  deliveryMode: CursorAutomationSubmitDeliveryMode
  adapterConnected: boolean
  submittedAt: string
  handoffPayload: CursorAutomationHandoffPayload
  expectedChecks: string[]
  errorMessage: string | null
  retryCount: number
  createdAt: string
  updatedAt: string
}
