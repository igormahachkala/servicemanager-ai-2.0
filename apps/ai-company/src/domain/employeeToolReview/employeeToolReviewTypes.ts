/**
 * Employee Tool Review — types (AI-COMPANY-113F).
 * Builder reviews CursorResultEnvelope before MAX handoff.
 */

import type { CursorResultEnvelope } from '../cursorResult/cursorResultEnvelopeTypes'

export const EMPLOYEE_TOOL_REVIEW_VERSION = 'v1' as const

export const EMPLOYEE_TOOL_REVIEW_STORAGE_KEY = 'ai-company-employee-tool-reviews'

export const EMPLOYEE_TOOL_REVIEW_SYNC_EVENT = 'ai-company-employee-tool-reviews-sync'

export const EMPLOYEE_TOOL_REVIEW_STATUSES = [
  'awaiting_employee_review',
  'accepted',
  'rework_requested',
  'rejected',
  'sent_to_max',
] as const

export type EmployeeToolReviewStatus = (typeof EMPLOYEE_TOOL_REVIEW_STATUSES)[number]

export const EMPLOYEE_TOOL_REVIEW_HISTORY_KINDS = [
  'created',
  'review_started',
  'accepted',
  'rework_requested',
  'rejected',
  'sent_to_max',
] as const

export type EmployeeToolReviewHistoryKind = (typeof EMPLOYEE_TOOL_REVIEW_HISTORY_KINDS)[number]

export type EmployeeToolReviewCheckAssessment = {
  name: string
  status: string
  outputSummary: string
  passed: boolean
}

export type EmployeeToolReviewEvaluation = {
  fileScopeOk: boolean
  outOfScopeFiles: string[]
  checksPassed: boolean
  checkAssessments: EmployeeToolReviewCheckAssessment[]
  expectedResultAligned: boolean
  hasErrors: boolean
  hasUnfinished: boolean
  notes: string[]
}

export type EmployeeToolReviewHistoryEntry = {
  id: string
  kind: EmployeeToolReviewHistoryKind
  at: string
  message: string | null
}

export type EmployeeToolReview = {
  id: string
  version: typeof EMPLOYEE_TOOL_REVIEW_VERSION
  companyId: string
  employeeId: string
  reviewerEmployeeId: string
  toolExecutionRunId: string
  workItemId: string
  delegationPlanId: string | null
  envelope: CursorResultEnvelope
  evaluation: EmployeeToolReviewEvaluation
  status: EmployeeToolReviewStatus
  reworkReason: string | null
  reworkEnvelopeId: string | null
  delegationReviewId: string | null
  reportId: string | null
  createdAt: string
  updatedAt: string
  history: EmployeeToolReviewHistoryEntry[]
}

export type CreateEmployeeToolReviewInput = {
  companyId: string
  employeeId: string
  reviewerEmployeeId: string
  toolExecutionRunId: string
  workItemId: string
  delegationPlanId?: string | null
  envelope: CursorResultEnvelope
  evaluation: EmployeeToolReviewEvaluation
}

export type ListEmployeeToolReviewsFilter = {
  companyId?: string
  employeeId?: string
  reviewerEmployeeId?: string
  toolExecutionRunId?: string
  workItemId?: string
  status?: EmployeeToolReviewStatus | EmployeeToolReviewStatus[]
}
