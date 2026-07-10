/**
 * Employee Tool Review — localStorage persistence (AI-COMPANY-113F).
 */

import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import {
  EMPLOYEE_TOOL_REVIEW_STORAGE_KEY,
  EMPLOYEE_TOOL_REVIEW_SYNC_EVENT,
  EMPLOYEE_TOOL_REVIEW_VERSION,
  type CreateEmployeeToolReviewInput,
  type EmployeeToolReview,
  type EmployeeToolReviewHistoryEntry,
  type EmployeeToolReviewHistoryKind,
  type ListEmployeeToolReviewsFilter,
} from './employeeToolReviewTypes'

function nowIso(): string {
  return new Date().toISOString()
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(EMPLOYEE_TOOL_REVIEW_SYNC_EVENT))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

type StoreSnapshot = {
  version: typeof EMPLOYEE_TOOL_REVIEW_VERSION
  reviews: EmployeeToolReview[]
  updatedAt: string
}

function emptySnapshot(): StoreSnapshot {
  return { version: EMPLOYEE_TOOL_REVIEW_VERSION, reviews: [], updatedAt: nowIso() }
}

function readSnapshot(): StoreSnapshot {
  if (typeof window === 'undefined') return emptySnapshot()
  try {
    const raw = window.localStorage.getItem(EMPLOYEE_TOOL_REVIEW_STORAGE_KEY)
    if (!raw) return emptySnapshot()
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== EMPLOYEE_TOOL_REVIEW_VERSION) return emptySnapshot()
    return {
      version: EMPLOYEE_TOOL_REVIEW_VERSION,
      reviews: Array.isArray(parsed.reviews) ? (parsed.reviews as EmployeeToolReview[]) : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : nowIso(),
    }
  } catch {
    return emptySnapshot()
  }
}

function writeSnapshot(snapshot: StoreSnapshot): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    EMPLOYEE_TOOL_REVIEW_STORAGE_KEY,
    JSON.stringify({ ...snapshot, updatedAt: nowIso() }),
  )
  emitSync()
}

function appendHistory(
  history: EmployeeToolReviewHistoryEntry[],
  kind: EmployeeToolReviewHistoryKind,
  message: string | null = null,
): EmployeeToolReviewHistoryEntry[] {
  return [
    ...history,
    { id: createId('etrh'), kind, at: nowIso(), message },
  ]
}

function patchReview(
  id: string,
  patch: Partial<EmployeeToolReview> & {
    historyKind?: EmployeeToolReviewHistoryKind
    historyMessage?: string | null
  },
): EmployeeToolReview | null {
  const snapshot = readSnapshot()
  const index = snapshot.reviews.findIndex((review) => review.id === id)
  if (index < 0) return null

  const existing = snapshot.reviews[index]
  const history =
    patch.historyKind != null
      ? appendHistory(existing.history, patch.historyKind, patch.historyMessage ?? null)
      : existing.history

  const next: EmployeeToolReview = {
    ...existing,
    ...patch,
    history,
    updatedAt: nowIso(),
  }

  const reviews = [...snapshot.reviews]
  reviews[index] = next
  writeSnapshot({ ...snapshot, reviews })
  return next
}

export function loadEmployeeToolReviews(): EmployeeToolReview[] {
  return readSnapshot().reviews
}

export function getEmployeeToolReview(id: string): EmployeeToolReview | null {
  return loadEmployeeToolReviews().find((review) => review.id === id) ?? null
}

export function getEmployeeToolReviewByRunId(
  toolExecutionRunId: string,
): EmployeeToolReview | null {
  return (
    loadEmployeeToolReviews()
      .filter((review) => review.toolExecutionRunId === toolExecutionRunId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
  )
}

export function listEmployeeToolReviews(
  filter: ListEmployeeToolReviewsFilter = {},
): EmployeeToolReview[] {
  let reviews = loadEmployeeToolReviews()

  if (filter.companyId) {
    reviews = reviews.filter((review) => review.companyId === filter.companyId)
  }
  if (filter.employeeId) {
    const canonical = resolveCanonicalEmployeeId(filter.employeeId)
    reviews = reviews.filter((review) => review.employeeId === canonical)
  }
  if (filter.reviewerEmployeeId) {
    const canonical = resolveCanonicalEmployeeId(filter.reviewerEmployeeId)
    reviews = reviews.filter((review) => review.reviewerEmployeeId === canonical)
  }
  if (filter.toolExecutionRunId) {
    reviews = reviews.filter((review) => review.toolExecutionRunId === filter.toolExecutionRunId)
  }
  if (filter.workItemId) {
    reviews = reviews.filter((review) => review.workItemId === filter.workItemId)
  }
  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
    reviews = reviews.filter((review) => statuses.includes(review.status))
  }

  return reviews.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function createEmployeeToolReview(input: CreateEmployeeToolReviewInput): EmployeeToolReview {
  const now = nowIso()
  const review: EmployeeToolReview = {
    id: createId('etrev'),
    version: EMPLOYEE_TOOL_REVIEW_VERSION,
    companyId: input.companyId,
    employeeId: resolveCanonicalEmployeeId(input.employeeId),
    reviewerEmployeeId: resolveCanonicalEmployeeId(input.reviewerEmployeeId),
    toolExecutionRunId: input.toolExecutionRunId,
    workItemId: input.workItemId,
    delegationPlanId: input.delegationPlanId ?? null,
    envelope: input.envelope,
    evaluation: input.evaluation,
    status: 'awaiting_employee_review',
    reworkReason: null,
    reworkEnvelopeId: null,
    delegationReviewId: null,
    reportId: null,
    createdAt: now,
    updatedAt: now,
    history: appendHistory([], 'created', 'Employee tool review created from Cursor result.'),
  }

  const withStarted = appendHistory(review.history, 'review_started', 'Builder review started.')
  const snapshot = readSnapshot()
  writeSnapshot({
    ...snapshot,
    reviews: [{ ...review, history: withStarted }, ...snapshot.reviews],
  })
  return getEmployeeToolReview(review.id) ?? { ...review, history: withStarted }
}

export function markEmployeeToolReviewAccepted(
  id: string,
  patch: { reportId?: string | null; delegationReviewId?: string | null; message?: string | null },
): EmployeeToolReview | null {
  const existing = getEmployeeToolReview(id)
  if (!existing || existing.status !== 'awaiting_employee_review') return null

  return patchReview(id, {
    status: 'accepted',
    reportId: patch.reportId ?? existing.reportId,
    delegationReviewId: patch.delegationReviewId ?? existing.delegationReviewId,
    historyKind: 'accepted',
    historyMessage: patch.message ?? 'Builder accepted Cursor result.',
  })
}

export function markEmployeeToolReviewSentToMax(
  id: string,
  patch: { reportId: string; delegationReviewId: string; message?: string | null },
): EmployeeToolReview | null {
  const existing = getEmployeeToolReview(id)
  if (!existing || (existing.status !== 'accepted' && existing.status !== 'awaiting_employee_review')) {
    return null
  }

  return patchReview(id, {
    status: 'sent_to_max',
    reportId: patch.reportId,
    delegationReviewId: patch.delegationReviewId,
    historyKind: 'sent_to_max',
    historyMessage: patch.message ?? 'Result sent to MAX for review.',
  })
}

export function requestEmployeeToolReviewRework(
  id: string,
  reason: string,
  reworkEnvelopeId?: string | null,
): EmployeeToolReview | null {
  const existing = getEmployeeToolReview(id)
  if (!existing || existing.status !== 'awaiting_employee_review') return null

  return patchReview(id, {
    status: 'rework_requested',
    reworkReason: reason.trim(),
    reworkEnvelopeId: reworkEnvelopeId ?? null,
    historyKind: 'rework_requested',
    historyMessage: reason.trim(),
  })
}

export function rejectEmployeeToolReview(id: string, reason?: string | null): EmployeeToolReview | null {
  const existing = getEmployeeToolReview(id)
  if (!existing || existing.status !== 'awaiting_employee_review') return null

  return patchReview(id, {
    status: 'rejected',
    reworkReason: reason?.trim() ?? null,
    historyKind: 'rejected',
    historyMessage: reason?.trim() ?? 'Builder rejected Cursor result.',
  })
}

export function clearEmployeeToolReviews(): void {
  writeSnapshot(emptySnapshot())
}
