import { useEffect, useLayoutEffect, useState } from 'react'
import * as api from '../lib/api'
import { safeReadJson as readBrowserStorageJson, safeWriteJson as writeBrowserStorageJson } from '../lib/browserStorage'
import {
  getOfflineOperationSpec,
  isAlreadyAppliedRejection,
  isOfflineWriteEnabled,
  mayAutoRetry,
  SEND_ONCE_PARKED_MESSAGE,
} from './offlineOperations'

/**
 * SMA-MOBILE-OFFLINE-MODE-V1-113A.
 *
 * `inspection_checkpoint_update` joins the queue because it is the one operation in the current
 * API that is provably safe to replay: an absolute-value update addressed by id. The remaining
 * types stay declared so existing stored items keep their shape across the upgrade, but
 * offlineOperations.ts decides which of them may be enqueued.
 */
export type OfflineQueueActionType =
  | 'ticket_status_change'
  | 'ticket_comment'
  | 'ticket_photo_upload'
  | 'inspection_checkpoint_update'
export type OfflineQueueItemStatus = 'pending' | 'syncing' | 'failed' | 'synced'

export type OfflineQueueItem = {
  id: string
  type: OfflineQueueActionType
  /** Empty for operations that do not target a ticket (a round checkpoint, for example). */
  ticketId: string
  scope: api.TicketScopeParams
  payload: {
    status?: api.TicketStatus
    comment?: string
    /** 113A: round checkpoint target and absolute values to write. */
    runId?: string
    itemId?: string
    checkpoint?: {
      status?: string
      comment?: string
      requiresRepair?: boolean
      booleanValue?: boolean
      numberValue?: number
      textValue?: string
    }
  }
  createdAt: string
  status: OfflineQueueItemStatus
  lastError?: string
  /** 113A retry metadata — without it a permanently failing item is indistinguishable from a new one. */
  attempts?: number
  lastAttemptAt?: string
}

/** Результат ручной синхронизации очереди (synced-записи из storage удаляются). */
export type OfflineQueueRetryResult = {
  queue: OfflineQueueItem[]
  synced: number
  failed: number
}

type OfflineBoardCacheEntry = {
  savedAt: string
  data: api.BoardResponse
}

type OfflineTicketDetailCacheEntry = {
  savedAt: string
  data: {
    ticket: api.TicketGetOne
    attachments: api.TicketAttachmentItem[]
    timeline: api.TimelineResponse | null
  }
}

const OFFLINE_QUEUE_KEY = 'sm_mobile_offline_queue_v1'
const OFFLINE_BOARD_CACHE_KEY = 'sm_mobile_board_cache_v1'
const OFFLINE_TICKET_CACHE_KEY = 'sm_mobile_ticket_cache_v1'
const OFFLINE_QUEUE_EVENT = 'sm_mobile_offline_queue_changed'

function emitQueueChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT))
}

function normalizeScope(scope?: api.TicketScopeParams): api.TicketScopeParams {
  return {
    companyId: (scope?.companyId || '').trim() || undefined,
    linkedClientCompanyId: (scope?.linkedClientCompanyId || '').trim() || undefined,
  }
}

function scopeKey(scope?: api.TicketScopeParams): string {
  return JSON.stringify(normalizeScope(scope))
}

function ticketDetailKey(ticketId: string, scope?: api.TicketScopeParams): string {
  return `${ticketId}::${scopeKey(scope)}`
}

function safeReadJson<T>(key: string, fallback: T): T {
  return readBrowserStorageJson('local', key, fallback)
}

function safeWriteJson(key: string, value: unknown) {
  writeBrowserStorageJson('local', key, value)
}

export function getOnlineStatus(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => getOnlineStatus())

  useLayoutEffect(() => {
    setIsOnline(getOnlineStatus())
  }, [])

  useEffect(() => {
    const sync = () => setIsOnline(getOnlineStatus())
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  return isOnline
}

export function subscribeOfflineQueue(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const wrapped = () => listener()
  window.addEventListener(OFFLINE_QUEUE_EVENT, wrapped)
  return () => window.removeEventListener(OFFLINE_QUEUE_EVENT, wrapped)
}

export function readOfflineQueue(): OfflineQueueItem[] {
  return safeReadJson<OfflineQueueItem[]>(OFFLINE_QUEUE_KEY, [])
}

function writeOfflineQueue(items: OfflineQueueItem[]) {
  safeWriteJson(OFFLINE_QUEUE_KEY, items)
  emitQueueChanged()
}

export function getPendingOfflineActionsCount(): number {
  return readOfflineQueue().filter((item) => item.status === 'pending' || item.status === 'failed').length
}

export function getPendingAndFailedCounts(): { pending: number; failed: number } {
  const queue = readOfflineQueue()
  let pending = 0
  let failed = 0
  for (const item of queue) {
    if (item.status === 'pending' || item.status === 'syncing') pending++
    else if (item.status === 'failed') failed++
  }
  return { pending, failed }
}

export function deleteSingleQueueItem(id: string): void {
  const updated = readOfflineQueue().filter((item) => item.id !== id)
  writeOfflineQueue(updated)
}

function findPendingOrFailedStatusChangeDuplicate(
  queue: OfflineQueueItem[],
  ticketId: string,
  scope: api.TicketScopeParams,
  status: api.TicketStatus,
): OfflineQueueItem | null {
  const sk = scopeKey(scope)
  for (const row of queue) {
    if (row.type !== 'ticket_status_change') continue
    if (row.ticketId !== ticketId) continue
    if (row.payload.status !== status) continue
    if (scopeKey(row.scope) !== sk) continue
    if (row.status === 'pending' || row.status === 'failed') return row
  }
  return null
}

export function enqueueOfflineStatusChange(params: {
  ticketId: string
  scope?: api.TicketScopeParams
  status: api.TicketStatus
  comment?: string
}): OfflineQueueItem {
  assertOfflineWriteEnabled('ticket_status_change')
  const scope = normalizeScope(params.scope)
  const current = readOfflineQueue()
  const dup = findPendingOrFailedStatusChangeDuplicate(current, params.ticketId, scope, params.status)
  if (dup) {
    return dup
  }

  const item: OfflineQueueItem = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    type: 'ticket_status_change',
    ticketId: params.ticketId,
    scope,
    payload: {
      status: params.status,
      comment: params.comment?.trim() || undefined,
    },
    createdAt: new Date().toISOString(),
    status: 'pending',
  }
  current.push(item)
  writeOfflineQueue(current)
  return item
}

/**
 * 113A: refuse to queue an operation whose replay could duplicate server state.
 *
 * Enforced here rather than at each call site: the failure this prevents — a second identical
 * comment or a second uploaded photo after a lost response — is invisible at the call site and
 * only shows up in the ticket history days later.
 */
export class OfflineWriteNotSupportedError extends Error {
  readonly operationType: string
  constructor(type: string) {
    const spec = getOfflineOperationSpec(type)
    super(
      spec?.requires
        ? `Офлайн-отправка недоступна для «${type}»: ${spec.requires}`
        : `Офлайн-отправка недоступна для «${type}»`,
    )
    this.name = 'OfflineWriteNotSupportedError'
    this.operationType = type
  }
}

function assertOfflineWriteEnabled(type: OfflineQueueActionType) {
  if (!isOfflineWriteEnabled(type)) throw new OfflineWriteNotSupportedError(type)
}

/**
 * 113A: queue an absolute-value update of a round checkpoint. The one write this task enables,
 * because PATCH /inspection/runs/:runId/items/:itemId is the one endpoint that converges on
 * replay instead of appending.
 *
 * Repeated edits of the same checkpoint collapse onto one queued item: the last value wins,
 * which is what the technician means and what keeps the queue from growing per keystroke.
 */
export function enqueueOfflineCheckpointUpdate(params: {
  runId: string
  itemId: string
  checkpoint: NonNullable<OfflineQueueItem['payload']['checkpoint']>
}): OfflineQueueItem {
  assertOfflineWriteEnabled('inspection_checkpoint_update')

  const current = readOfflineQueue()
  const existingIdx = current.findIndex(
    (row) =>
      row.type === 'inspection_checkpoint_update' &&
      row.payload.runId === params.runId &&
      row.payload.itemId === params.itemId &&
      (row.status === 'pending' || row.status === 'failed'),
  )

  if (existingIdx !== -1) {
    const merged: OfflineQueueItem = {
      ...current[existingIdx]!,
      status: 'pending',
      lastError: undefined,
      payload: {
        ...current[existingIdx]!.payload,
        checkpoint: { ...current[existingIdx]!.payload.checkpoint, ...params.checkpoint },
      },
    }
    current[existingIdx] = merged
    writeOfflineQueue(current)
    return merged
  }

  const item: OfflineQueueItem = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    type: 'inspection_checkpoint_update',
    ticketId: '',
    scope: normalizeScope(undefined),
    payload: { runId: params.runId, itemId: params.itemId, checkpoint: params.checkpoint },
    createdAt: new Date().toISOString(),
    status: 'pending',
    attempts: 0,
  }
  current.push(item)
  writeOfflineQueue(current)
  return item
}

export function enqueueOfflineComment(params: {
  ticketId: string
  scope?: api.TicketScopeParams
  comment: string
}): OfflineQueueItem {
  assertOfflineWriteEnabled('ticket_comment')
  const item: OfflineQueueItem = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    type: 'ticket_comment',
    ticketId: params.ticketId,
    scope: normalizeScope(params.scope),
    payload: {
      comment: params.comment.trim(),
    },
    createdAt: new Date().toISOString(),
    status: 'pending',
  }
  const current = readOfflineQueue()
  current.push(item)
  writeOfflineQueue(current)
  return item
}

let retryInFlight: Promise<OfflineQueueRetryResult> | null = null

async function processOneItem(item: OfflineQueueItem): Promise<void> {
  if (item.type === 'ticket_comment') {
    const comment = item.payload.comment?.trim()
    if (!comment) throw new Error('Пустой комментарий')
    await api.addTicketComment(item.ticketId, comment, item.scope)
    return
  }

  if (item.type === 'ticket_status_change') {
    const status = item.payload.status
    if (!status) throw new Error('Не указан статус')
    const comment = item.payload.comment?.trim()
    if (comment) {
      await api.addTicketComment(item.ticketId, comment, item.scope)
    }
    await api.updateTicketStatus(item.ticketId, { status }, item.scope)
    return
  }

  if (item.type === 'inspection_checkpoint_update') {
    const { runId, itemId, checkpoint } = item.payload
    if (!runId || !itemId) throw new Error('Не указан обход или пункт')
    if (!checkpoint || Object.keys(checkpoint).length === 0) {
      throw new Error('Пустое изменение пункта обхода')
    }
    // Absolute values, addressed by id: replaying this converges rather than appending.
    await api.updateInspectionRunItem(runId, itemId, checkpoint as any)
    return
  }

  /**
   * 113A: previously this function ended after the two known branches, so an item of any other
   * type — ticket_photo_upload was declared but never handled — fell through, resolved, and was
   * deleted from the queue as if it had been sent. A queued photo disappeared and the technician
   * was told it synced. Refusing loudly keeps the item in the queue where it can be seen.
   */
  throw new Error(`Тип действия не поддерживается офлайн: ${item.type}`)
}

async function runRetryOfflineQueue(): Promise<OfflineQueueRetryResult> {
  const stored = readOfflineQueue().filter((row) => row.status !== 'synced')
  writeOfflineQueue(stored)

  let synced = 0
  let failed = 0

  const toProcess = stored
    .filter((row) => row.status === 'pending' || row.status === 'failed')
    // 113A: a send-once item that has already been attempted is not retried automatically —
    // the sync cannot distinguish a lost response from a rejected request, and guessing wrong
    // duplicates the technician's comment. It stays visible for a manual decision.
    .filter((row) => mayAutoRetry(row.type, row.attempts ?? 0))
    .map((row) => row.id)

  for (const id of toProcess) {
    const current = readOfflineQueue()
    const idx = current.findIndex((r) => r.id === id)
    if (idx === -1) continue
    const item = current[idx]!
    if (item.status === 'synced') continue

    current[idx] = {
      ...item,
      status: 'syncing',
      attempts: (item.attempts ?? 0) + 1,
      lastAttemptAt: new Date().toISOString(),
    }
    writeOfflineQueue(current)

    try {
      await processOneItem(item)
      writeOfflineQueue(readOfflineQueue().filter((r) => r.id !== id))
      synced += 1
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      /**
       * 113A: a replay of a safe_with_reconciliation operation can be rejected precisely
       * because the earlier attempt already landed. Retrying that forever would show the
       * technician a permanent error for work that is done, so it counts as synced.
       */
      if (isAlreadyAppliedRejection(item.type, errMsg)) {
        writeOfflineQueue(readOfflineQueue().filter((r) => r.id !== id))
        synced += 1
        continue
      }
      const after = readOfflineQueue()
      const fi = after.findIndex((r) => r.id === id)
      if (fi !== -1) {
        const spec = getOfflineOperationSpec(item.type)
        after[fi] = {
          ...after[fi]!,
          status: 'failed',
          lastError:
            spec?.kind === 'send_once_no_auto_retry' ? SEND_ONCE_PARKED_MESSAGE : errMsg,
        }
        writeOfflineQueue(after)
      }
      failed += 1
    }
  }

  return { queue: readOfflineQueue(), synced, failed }
}

export async function retrySingleQueueItem(id: string): Promise<{ ok: boolean; error?: string }> {
  const queue = readOfflineQueue()
  const idx = queue.findIndex((r) => r.id === id)
  if (idx === -1) return { ok: false, error: 'Действие не найдено' }
  const item = queue[idx]!
  if (item.status === 'synced') return { ok: true }

  queue[idx] = {
    ...item,
    status: 'syncing',
    attempts: (item.attempts ?? 0) + 1,
    lastAttemptAt: new Date().toISOString(),
  }
  writeOfflineQueue(queue)

  try {
    await processOneItem(item)
    writeOfflineQueue(readOfflineQueue().filter((r) => r.id !== id))
    return { ok: true }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    if (isAlreadyAppliedRejection(item.type, errMsg)) {
      writeOfflineQueue(readOfflineQueue().filter((r) => r.id !== id))
      return { ok: true }
    }
    const after = readOfflineQueue()
    const fi = after.findIndex((r) => r.id === id)
    if (fi !== -1) {
      after[fi] = { ...after[fi]!, status: 'failed', lastError: errMsg }
      writeOfflineQueue(after)
    }
    return { ok: false, error: errMsg }
  }
}

/**
 * Отправка очереди вручную. Повторный вызов, пока идёт предыдущий, возвращает тот же Promise (без параллельных дублей).
 * Успешно синхронизированные записи удаляются из localStorage.
 */
export function retryOfflineQueue(): Promise<OfflineQueueRetryResult> {
  if (!retryInFlight) {
    retryInFlight = runRetryOfflineQueue().finally(() => {
      retryInFlight = null
    })
  }
  return retryInFlight
}

export function saveBoardCache(scope: api.TicketScopeParams | undefined, data: api.BoardResponse) {
  const current = safeReadJson<Record<string, OfflineBoardCacheEntry>>(OFFLINE_BOARD_CACHE_KEY, {})
  current[scopeKey(scope)] = {
    savedAt: new Date().toISOString(),
    data,
  }
  safeWriteJson(OFFLINE_BOARD_CACHE_KEY, current)
}

export function loadBoardCache(scope?: api.TicketScopeParams): OfflineBoardCacheEntry | null {
  const current = safeReadJson<Record<string, OfflineBoardCacheEntry>>(OFFLINE_BOARD_CACHE_KEY, {})
  return current[scopeKey(scope)] || null
}

export function saveTicketDetailCache(params: {
  ticketId: string
  scope?: api.TicketScopeParams
  ticket: api.TicketGetOne
  attachments: api.TicketAttachmentItem[]
  timeline: api.TimelineResponse | null
}) {
  const current = safeReadJson<Record<string, OfflineTicketDetailCacheEntry>>(OFFLINE_TICKET_CACHE_KEY, {})
  current[ticketDetailKey(params.ticketId, params.scope)] = {
    savedAt: new Date().toISOString(),
    data: {
      ticket: params.ticket,
      attachments: params.attachments,
      timeline: params.timeline,
    },
  }
  safeWriteJson(OFFLINE_TICKET_CACHE_KEY, current)
}

export function loadTicketDetailCache(ticketId: string, scope?: api.TicketScopeParams): OfflineTicketDetailCacheEntry | null {
  const current = safeReadJson<Record<string, OfflineTicketDetailCacheEntry>>(OFFLINE_TICKET_CACHE_KEY, {})
  return current[ticketDetailKey(ticketId, scope)] || null
}

/** Любой сохранённый срез заявки по id (разные scope в ключе). Только для офлайн-чтения кэша. */
export function loadAnyTicketDetailCache(ticketId: string): OfflineTicketDetailCacheEntry | null {
  const id = (ticketId || '').trim()
  if (!id) return null
  const current = safeReadJson<Record<string, OfflineTicketDetailCacheEntry>>(OFFLINE_TICKET_CACHE_KEY, {})
  const prefix = `${id}::`
  for (const [key, entry] of Object.entries(current)) {
    if (key.startsWith(prefix)) return entry
  }
  return null
}
