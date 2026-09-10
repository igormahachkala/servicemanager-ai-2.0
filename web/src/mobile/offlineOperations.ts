import * as api from '../lib/api'

/**
 * SMA-MOBILE-OFFLINE-MODE-V1-113A — what may be queued offline, and why.
 *
 * The rule this module exists to enforce: an operation may only be queued offline if replaying
 * it after a lost response cannot create a second entity. "Send → server accepted → response
 * lost → retry" is the normal case on a failing mobile link, not an edge case, so an append-only
 * endpoint without a de-duplication key is not offline-safe no matter how careful the client is.
 *
 * Classification below is derived from the endpoints as they exist in this repository today,
 * not from intent. It is data, so the queue can refuse an unsafe operation instead of relying on
 * every call site to remember.
 */

export type OfflineOperationKind =
  /** Absolute-value update addressed by id. Replay converges on the same state. */
  | 'safe_retry'
  /**
   * Replay cannot duplicate, but the second attempt is rejected rather than ignored, so the
   * client must treat the specific "already applied" rejection as success.
   */
  | 'safe_with_reconciliation'
  /**
   * Append-only with no de-duplication key, but already shipped and useful. Sent at most once
   * automatically: if the response is lost the item is parked as failed for the technician to
   * decide, because an automatic retry is exactly what would duplicate it.
   */
  | 'send_once_no_auto_retry'
  /** Append-only with no server-side de-duplication key. Replay creates a second row. */
  | 'blocked_needs_idempotency_key'

export type OfflineOperationSpec = {
  type: string
  kind: OfflineOperationKind
  /** Endpoint this operation replays against, for the report and for debugging. */
  endpoint: string
  /** Why it is classified this way — the evidence, in one line. */
  rationale: string
  /** Present only for blocked operations: what the backend must add before enabling. */
  requires?: string
}

export const OFFLINE_OPERATIONS: Record<string, OfflineOperationSpec> = {
  /* ── enabled ────────────────────────────────────────────────────────────── */
  inspection_checkpoint_update: {
    type: 'inspection_checkpoint_update',
    kind: 'safe_retry',
    endpoint: 'PATCH /inspection/runs/:runId/items/:itemId',
    rationale:
      'InspectionService.updateRunItem writes absolute values (dto.status ?? item.status) to a row addressed by id and appends nothing. Replaying the same body converges on the same state.',
  },

  /* ── enabled, but the client must map one rejection to success ──────────── */
  ticket_status_change: {
    type: 'ticket_status_change',
    kind: 'safe_with_reconciliation',
    endpoint: 'PATCH /tickets/:id/status',
    rationale:
      'decideTicketTransition rejects a transition whose fromStatus already equals toStatus, and history/notification writes are guarded by fromStatus !== toStatus. A replay therefore cannot double-apply, but it fails instead of no-opping, so the queue must treat "already in that status" as done.',
  },

  /* ── blocked: replay would duplicate ────────────────────────────────────── */
  ticket_comment: {
    type: 'ticket_comment',
    kind: 'send_once_no_auto_retry',
    endpoint: 'POST /tickets/:id/comments',
    rationale:
      'Pure append: nothing in the request identifies the comment, so an automatic replay after a lost response writes a second identical comment. Offline comments already ship, so rather than removing a working feature this is sent at most once automatically and then parked for the technician.',
    requires:
      'A client-generated idempotency key (Idempotency-Key header or clientRequestId in the body) returning the original result on replay would make this fully safe_retry.',
  },
  inspection_checkpoint_photo: {
    type: 'inspection_checkpoint_photo',
    kind: 'blocked_needs_idempotency_key',
    endpoint: 'POST /inspection/runs/:runId/items/:itemId/attachments',
    rationale:
      'Pure append: every call creates a new InspectionRunItemAttachment row and stores another copy of the file. A replay duplicates both the row and the upload.',
    requires:
      'Backend idempotency key on the attachment endpoint. Until then a queued photo can be captured and shown locally but must not be auto-sent.',
  },
  ticket_photo_upload: {
    type: 'ticket_photo_upload',
    kind: 'blocked_needs_idempotency_key',
    endpoint: 'POST /tickets/:id/attachments',
    rationale:
      'Pure append, same shape as the inspection attachment. This type existed in the v1 queue but was never handled by the sender — see the regression test covering that.',
    requires: 'Backend idempotency key on the ticket attachment endpoint.',
  },
  inspection_ticket_from_item: {
    type: 'inspection_ticket_from_item',
    kind: 'blocked_needs_idempotency_key',
    endpoint: 'POST /inspection/runs/:runId/items/:itemId/create-ticket',
    rationale:
      'InspectionRunItem.ticketId is @unique and the service refuses a second ticket for the same item, so a replay cannot duplicate the ticket. It is still blocked for V1 because the offline client cannot distinguish "my earlier attempt succeeded" from "someone else raised it" without reading the item back, which offline it cannot do.',
    requires:
      'Either an idempotency key, or a client-supplied item read on reconnect before enqueueing. Deliberately left disabled rather than half-enabled.',
  },
}

export function getOfflineOperationSpec(type: string): OfflineOperationSpec | null {
  return OFFLINE_OPERATIONS[type] ?? null
}

/** May this operation type be written to the offline queue at all? */
export function isOfflineWriteEnabled(type: string): boolean {
  const spec = getOfflineOperationSpec(type)
  if (!spec) return false
  return (
    spec.kind === 'safe_retry' ||
    spec.kind === 'safe_with_reconciliation' ||
    spec.kind === 'send_once_no_auto_retry'
  )
}

/**
 * May the background sync send this item again on its own?
 *
 * False for send_once_no_auto_retry once an attempt has been made: the queue cannot tell a lost
 * response from a rejected request, and guessing wrong duplicates the technician's comment.
 */
export function mayAutoRetry(type: string, attempts: number): boolean {
  const spec = getOfflineOperationSpec(type)
  if (!spec) return false
  if (spec.kind === 'send_once_no_auto_retry') return attempts < 1
  return spec.kind === 'safe_retry' || spec.kind === 'safe_with_reconciliation'
}

/** Message shown when a send-once item needs a human decision. */
export const SEND_ONCE_PARKED_MESSAGE =
  'Отправка не подтверждена. Откройте заявку и проверьте, появился ли комментарий, прежде чем отправлять повторно.'

export function listBlockedOfflineOperations(): OfflineOperationSpec[] {
  return Object.values(OFFLINE_OPERATIONS).filter(
    (spec) => spec.kind === 'blocked_needs_idempotency_key',
  )
}

/**
 * A replay of a safe_with_reconciliation operation may come back as a rejection that actually
 * means "your earlier attempt already landed". Those must count as success, or the queue will
 * retry forever and the technician will see a permanent error for work that is done.
 */
export function isAlreadyAppliedRejection(type: string, message: string): boolean {
  const spec = getOfflineOperationSpec(type)
  if (!spec || spec.kind !== 'safe_with_reconciliation') return false

  const text = (message || '').toLowerCase()
  if (type === 'ticket_status_change') {
    // decideTicketTransition's refusal for an already-applied status.
    return (
      text.includes('переход') ||
      text.includes('transition') ||
      text.includes('already') ||
      text.includes('текущий статус')
    )
  }
  return false
}

/** Sync states shown to the technician. Russian-only, per product rules. */
export const OFFLINE_SYNC_LABEL = {
  offline: 'Нет сети',
  saved_local: 'Сохранено на устройстве',
  pending: 'Ожидает отправки',
  syncing: 'Синхронизация',
  synced: 'Синхронизировано',
  failed: 'Ошибка синхронизации',
} as const

export type OfflineSyncState = keyof typeof OFFLINE_SYNC_LABEL

/** Scope every cached key by the signed-in user, so a device handover cannot leak work. */
export function offlineCacheNamespace(user?: { id?: string; companyId?: string } | null): string {
  const id = (user?.id || '').trim()
  const company = (user?.companyId || '').trim()
  if (!id || !company) return 'anon'
  return `${company}:${id}`
}

export type { api }
