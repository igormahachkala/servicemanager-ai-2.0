import { useEffect, useLayoutEffect, useState } from 'react'
import * as api from '../lib/api'
import {
  safeReadJson as readBrowserStorageJson,
  safeRemoveItem as removeBrowserStorageItem,
  safeWriteJson as writeBrowserStorageJson,
} from '../lib/browserStorage'
import { isLiveApiAllowed, subscribeOfflineStatus } from './offline/runtime'

export type OfflineQueueActionType = 'ticket_status_change' | 'ticket_comment' | 'ticket_photo_upload'
export type OfflineQueueItemStatus = 'pending' | 'syncing' | 'failed' | 'synced'

export type OfflineQueueItem = {
  id: string
  type: OfflineQueueActionType
  ticketId: string
  scope: api.TicketScopeParams
  payload: {
    status?: api.TicketStatus
    comment?: string
  }
  createdAt: string
  status: OfflineQueueItemStatus
  lastError?: string
}

/** Результат ручной синхронизации очереди (synced-записи из storage удаляются). */
export type OfflineQueueRetryResult = {
  queue: OfflineQueueItem[]
  synced: number
  failed: number
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

function safeReadJson<T>(key: string, fallback: T): T {
  return readBrowserStorageJson('local', key, fallback)
}

function safeWriteJson(key: string, value: unknown) {
  writeBrowserStorageJson('local', key, value)
}

/**
 * SMA-MOBILE-OFFLINE-INTEGRATION-113D: очистка прежних кэшей при выходе.
 *
 * Очередь и UI-кэши раньше лежали в localStorage без разделения по
 * пользователю. Рабочий путь уже пишет доску и детальную карточку в
 * IndexedDB namespace, но legacy-ключи могут остаться после незавершённого
 * migrate — на общем планшете их надо снять при выходе.
 *
 * Новый офлайн-слой открывает отдельную базу на связку компания+пользователь
 * и стирает её при выходе (`store.destroy`).
 */
export function clearLegacyOfflineCaches() {
  for (const key of [OFFLINE_QUEUE_KEY, OFFLINE_BOARD_CACHE_KEY, OFFLINE_TICKET_CACHE_KEY]) {
    removeBrowserStorageItem('local', key)
  }
}

/**
 * Единый признак «можно бить живой API» для queue/live решений.
 * Совпадает с offline.liveApiAllowed (не сырой navigator.onLine).
 */
export function getOnlineStatus(): boolean {
  return isLiveApiAllowed()
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => getOnlineStatus())

  useLayoutEffect(() => {
    setIsOnline(getOnlineStatus())
  }, [])

  useEffect(() => {
    return subscribeOfflineStatus((status) => {
      setIsOnline(status.liveApiAllowed)
    })
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

export function enqueueOfflineComment(params: {
  ticketId: string
  scope?: api.TicketScopeParams
  comment: string
}): OfflineQueueItem {
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
  } else if (item.type === 'ticket_status_change') {
    const status = item.payload.status
    if (!status) throw new Error('Не указан статус')
    const comment = item.payload.comment?.trim()
    if (comment) {
      await api.addTicketComment(item.ticketId, comment, item.scope)
    }
    await api.updateTicketStatus(item.ticketId, { status }, item.scope)
  }
}

async function runRetryOfflineQueue(): Promise<OfflineQueueRetryResult> {
  const stored = readOfflineQueue().filter((row) => row.status !== 'synced')
  writeOfflineQueue(stored)

  let synced = 0
  let failed = 0

  const toProcess = stored
    .filter((row) => row.status === 'pending' || row.status === 'failed')
    .map((row) => row.id)

  for (const id of toProcess) {
    const current = readOfflineQueue()
    const idx = current.findIndex((r) => r.id === id)
    if (idx === -1) continue
    const item = current[idx]!
    if (item.status === 'synced') continue

    current[idx] = { ...item, status: 'syncing' }
    writeOfflineQueue(current)

    try {
      await processOneItem(item)
      writeOfflineQueue(readOfflineQueue().filter((r) => r.id !== id))
      synced += 1
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      const after = readOfflineQueue()
      const fi = after.findIndex((r) => r.id === id)
      if (fi !== -1) {
        after[fi] = { ...after[fi]!, status: 'failed', lastError: errMsg }
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

  queue[idx] = { ...item, status: 'syncing' }
  writeOfflineQueue(queue)

  try {
    await processOneItem(item)
    writeOfflineQueue(readOfflineQueue().filter((r) => r.id !== id))
    return { ok: true }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
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
