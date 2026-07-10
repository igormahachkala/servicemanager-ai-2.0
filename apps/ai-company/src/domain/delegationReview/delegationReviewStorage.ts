/**
 * Delegation Review — localStorage persistence (AI-COMPANY-112H).
 */

import {
  DELEGATION_REVIEW_STORAGE_KEY,
  DELEGATION_REVIEW_SYNC_EVENT,
  DELEGATION_REVIEW_VERSION,
  type CreateDelegationReviewInput,
  type DelegationReviewHistoryEntry,
  type DelegationReviewHistoryKind,
  type DelegationReviewRecord,
  type ListDelegationReviewsFilter,
} from './delegationReviewTypes'

function nowIso(): string {
  return new Date().toISOString()
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function emitSync(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(DELEGATION_REVIEW_SYNC_EVENT))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

type StoreSnapshot = {
  version: typeof DELEGATION_REVIEW_VERSION
  reviews: DelegationReviewRecord[]
  updatedAt: string
}

function emptySnapshot(): StoreSnapshot {
  return { version: DELEGATION_REVIEW_VERSION, reviews: [], updatedAt: nowIso() }
}

function readSnapshot(): StoreSnapshot {
  if (typeof window === 'undefined') return emptySnapshot()
  try {
    const raw = window.localStorage.getItem(DELEGATION_REVIEW_STORAGE_KEY)
    if (!raw) return emptySnapshot()
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== DELEGATION_REVIEW_VERSION) return emptySnapshot()
    return {
      version: DELEGATION_REVIEW_VERSION,
      reviews: Array.isArray(parsed.reviews) ? (parsed.reviews as DelegationReviewRecord[]) : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : nowIso(),
    }
  } catch {
    return emptySnapshot()
  }
}

function writeSnapshot(snapshot: StoreSnapshot): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    DELEGATION_REVIEW_STORAGE_KEY,
    JSON.stringify({ ...snapshot, updatedAt: nowIso() }),
  )
  emitSync()
}

function appendHistory(
  history: DelegationReviewHistoryEntry[],
  kind: DelegationReviewHistoryKind,
  message: string | null = null,
): DelegationReviewHistoryEntry[] {
  return [
    ...history,
    {
      id: createId('drh'),
      kind,
      at: nowIso(),
      message,
    },
  ]
}

export function loadDelegationReviews(): DelegationReviewRecord[] {
  return readSnapshot().reviews
}

export function getDelegationReviewById(id: string): DelegationReviewRecord | null {
  return loadDelegationReviews().find((review) => review.id === id) ?? null
}

export function listDelegationReviews(filter: ListDelegationReviewsFilter = {}): DelegationReviewRecord[] {
  let reviews = loadDelegationReviews()

  if (filter.companyId) {
    reviews = reviews.filter((review) => review.companyId === filter.companyId)
  }
  if (filter.builderEmployeeId) {
    reviews = reviews.filter((review) => review.builderEmployeeId === filter.builderEmployeeId)
  }
  if (filter.reviewerEmployeeId) {
    reviews = reviews.filter((review) => review.reviewerEmployeeId === filter.reviewerEmployeeId)
  }
  if (filter.delegationPlanId) {
    reviews = reviews.filter((review) => review.delegationPlanId === filter.delegationPlanId)
  }
  if (filter.builderWorkItemId) {
    reviews = reviews.filter((review) => review.builderWorkItemId === filter.builderWorkItemId)
  }
  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
    reviews = reviews.filter((review) => statuses.includes(review.status))
  }

  return reviews.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function findOpenDelegationReviewByWorkItem(workItemId: string): DelegationReviewRecord | null {
  return (
    loadDelegationReviews().find(
      (review) =>
        review.builderWorkItemId === workItemId &&
        (review.status === 'awaiting_result' ||
          review.status === 'awaiting_review' ||
          review.status === 'rework_requested'),
    ) ?? null
  )
}

export function findAwaitingReviewForMax(): DelegationReviewRecord | null {
  return (
    listDelegationReviews({ status: 'awaiting_review' }).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    )[0] ?? null
  )
}

export function createDelegationReview(input: CreateDelegationReviewInput): DelegationReviewRecord {
  const now = nowIso()
  const initialStatus = input.initialStatus ?? 'awaiting_review'
  const review: DelegationReviewRecord = {
    id: createId('drev'),
    version: DELEGATION_REVIEW_VERSION,
    companyId: input.companyId,
    status: initialStatus,
    delegationPlanId: input.delegationPlanId,
    builderEmployeeId: input.builderEmployeeId,
    reviewerEmployeeId: input.reviewerEmployeeId,
    builderWorkItemId: input.builderWorkItemId,
    reworkWorkItemId: null,
    parentReviewId: input.parentReviewId ?? null,
    reportId: input.reportId ?? null,
    taskTitle: input.taskTitle.trim(),
    taskText: input.taskText.trim(),
    reworkNotes: null,
    createdAt: now,
    updatedAt: now,
    completedAt: initialStatus === 'awaiting_review' ? now : null,
    acceptedAt: null,
    reworkRequestedAt: null,
    failedAt: null,
    history: appendHistory([], 'created', `Review for ${input.taskTitle}`),
  }

  const withStatusHistory = appendHistory(
    review.history,
    initialStatus === 'awaiting_result' ? 'awaiting_result' : 'awaiting_review',
    null,
  )

  const snapshot = readSnapshot()
  writeSnapshot({
    ...snapshot,
    reviews: [{ ...review, history: withStatusHistory }, ...snapshot.reviews],
  })

  return getDelegationReviewById(review.id) ?? { ...review, history: withStatusHistory }
}

function patchReview(
  id: string,
  patch: Partial<DelegationReviewRecord> & {
    historyKind?: DelegationReviewHistoryKind
    historyMessage?: string | null
  },
): DelegationReviewRecord | null {
  const snapshot = readSnapshot()
  const index = snapshot.reviews.findIndex((review) => review.id === id)
  if (index < 0) return null

  const existing = snapshot.reviews[index]
  const now = nowIso()
  const history =
    patch.historyKind != null
      ? appendHistory(existing.history, patch.historyKind, patch.historyMessage ?? null)
      : existing.history

  const next: DelegationReviewRecord = {
    ...existing,
    ...patch,
    history,
    updatedAt: now,
  }

  const reviews = [...snapshot.reviews]
  reviews[index] = next
  writeSnapshot({ ...snapshot, reviews })
  return next
}

export function markDelegationReviewAwaitingReview(
  id: string,
  reportId: string,
): DelegationReviewRecord | null {
  const existing = getDelegationReviewById(id)
  if (!existing || existing.status !== 'awaiting_result') return null

  return patchReview(id, {
    status: 'awaiting_review',
    reportId,
    completedAt: nowIso(),
    historyKind: 'awaiting_review',
  })
}

export function acceptDelegationReviewRecord(id: string): DelegationReviewRecord | null {
  const existing = getDelegationReviewById(id)
  if (!existing || existing.status !== 'awaiting_review') return null

  const now = nowIso()
  return patchReview(id, {
    status: 'accepted',
    acceptedAt: now,
    historyKind: 'accepted',
    historyMessage: 'MAX accepted Builder result.',
  })
}

export function requestDelegationReviewReworkRecord(
  id: string,
  reworkWorkItemId: string,
  notes?: string | null,
): DelegationReviewRecord | null {
  const existing = getDelegationReviewById(id)
  if (!existing || existing.status !== 'awaiting_review') return null

  const now = nowIso()
  return patchReview(id, {
    status: 'rework_requested',
    reworkWorkItemId,
    reworkNotes: notes?.trim() ?? null,
    reworkRequestedAt: now,
    historyKind: 'rework_requested',
    historyMessage: notes?.trim() ?? 'MAX requested rework.',
  })
}

export function reopenDelegationReviewForReworkCompletion(
  id: string,
  builderWorkItemId: string,
  reportId: string,
): DelegationReviewRecord | null {
  const existing = getDelegationReviewById(id)
  if (!existing || existing.status !== 'rework_requested') return null

  return patchReview(id, {
    status: 'awaiting_review',
    builderWorkItemId,
    reportId,
    completedAt: nowIso(),
    historyKind: 'reopened',
    historyMessage: 'Builder submitted rework result.',
  })
}

export function failDelegationReviewRecord(
  id: string,
  message?: string | null,
): DelegationReviewRecord | null {
  const existing = getDelegationReviewById(id)
  if (!existing) return null
  if (existing.status === 'accepted' || existing.status === 'failed') return null

  return patchReview(id, {
    status: 'failed',
    failedAt: nowIso(),
    historyKind: 'failed',
    historyMessage: message?.trim() ?? null,
  })
}

export function clearDelegationReviews(): void {
  writeSnapshot(emptySnapshot())
}
