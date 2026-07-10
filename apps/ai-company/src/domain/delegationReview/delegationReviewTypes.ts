/**
 * Delegation Review — domain types (AI-COMPANY-112H).
 * Builder completes delegated work → MAX reviews → Accept or Rework.
 */

export const DELEGATION_REVIEW_VERSION = 'v1' as const

export const DELEGATION_REVIEW_STORAGE_KEY = 'ai-company-delegation-reviews'

export const DELEGATION_REVIEW_SYNC_EVENT = 'ai-company-delegation-reviews-sync'

export const DELEGATION_REVIEW_STATUSES = [
  'awaiting_result',
  'awaiting_review',
  'accepted',
  'rework_requested',
  'failed',
] as const

export type DelegationReviewStatus = (typeof DELEGATION_REVIEW_STATUSES)[number]

export const DELEGATION_REVIEW_HISTORY_KINDS = [
  'created',
  'awaiting_result',
  'awaiting_review',
  'accepted',
  'rework_requested',
  'failed',
  'reopened',
] as const

export type DelegationReviewHistoryKind = (typeof DELEGATION_REVIEW_HISTORY_KINDS)[number]

export type DelegationReviewHistoryEntry = {
  id: string
  kind: DelegationReviewHistoryKind
  at: string
  message: string | null
}

export type DelegationReviewRecord = {
  id: string
  version: typeof DELEGATION_REVIEW_VERSION
  companyId: string
  status: DelegationReviewStatus
  delegationPlanId: string
  builderEmployeeId: string
  reviewerEmployeeId: string
  builderWorkItemId: string
  reworkWorkItemId: string | null
  parentReviewId: string | null
  reportId: string | null
  taskTitle: string
  taskText: string
  reworkNotes: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  acceptedAt: string | null
  reworkRequestedAt: string | null
  failedAt: string | null
  history: DelegationReviewHistoryEntry[]
}

export type CreateDelegationReviewInput = {
  companyId: string
  delegationPlanId: string
  builderEmployeeId: string
  reviewerEmployeeId: string
  builderWorkItemId: string
  taskTitle: string
  taskText: string
  reportId?: string | null
  parentReviewId?: string | null
  initialStatus?: Extract<DelegationReviewStatus, 'awaiting_result' | 'awaiting_review'>
}

export type ListDelegationReviewsFilter = {
  companyId?: string
  status?: DelegationReviewStatus | DelegationReviewStatus[]
  builderEmployeeId?: string
  reviewerEmployeeId?: string
  delegationPlanId?: string
  builderWorkItemId?: string
}
