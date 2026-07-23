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

/**
 * Outcome of the check gate. Four states, because a single boolean conflated
 * three different situations: checks ran and failed, checks were never required,
 * and checks were required but nothing was reported. The last one is a silent
 * failure — an executor that skipped its checks used to look exactly like an
 * analysis task that never had any.
 */
export const EMPLOYEE_TOOL_REVIEW_CHECKS_OUTCOMES = [
  'passed',
  'failed',
  'not_required',
  'missing',
] as const

export type EmployeeToolReviewChecksOutcome =
  (typeof EMPLOYEE_TOOL_REVIEW_CHECKS_OUTCOMES)[number]

export function isEmployeeToolReviewChecksOutcome(
  value: unknown,
): value is EmployeeToolReviewChecksOutcome {
  return (
    typeof value === 'string' &&
    (EMPLOYEE_TOOL_REVIEW_CHECKS_OUTCOMES as readonly string[]).includes(value)
  )
}

/** Derived view kept for existing callers: only `failed` and `missing` are bad. */
export function checksPassedFromOutcome(outcome: EmployeeToolReviewChecksOutcome): boolean {
  return outcome !== 'failed' && outcome !== 'missing'
}

export type EmployeeToolReviewEvaluation = {
  fileScopeOk: boolean
  outOfScopeFiles: string[]
  checksOutcome: EmployeeToolReviewChecksOutcome
  /** Derived from checksOutcome — never set independently. */
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
