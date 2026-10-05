/**
 * Детальный снимок заявки (ticket + attachments + timeline) в IndexedDB.
 *
 * Заменяет общий localStorage-ключ `sm_mobile_ticket_cache_v1`. Ключ хранит
 * scope (`ticketId::scopeJSON`), как раньше: разные контуры одной заявки
 * не затирают друг друга.
 */

import { offlineStore, reportOfflineStorageUnavailable, waitForOfflineStore } from './runtime.js'
import { ticketDetailCacheKey, type TicketScopeLike } from './cacheKeys.js'
import {
  cacheServerImagesForParent,
  deleteServerMediaForParent,
  hasAllServerMedia,
  isServerImageCandidate,
  retainServerMediaForParent,
  type ServerImageCandidate,
} from './serverMediaCache.js'

export const TICKET_CACHE_STALE_MS = 8 * 60 * 60 * 1000

export type OfflineTicketDetailData<TTicket = unknown, TAttachment = unknown, TTimeline = unknown> = {
  ticket: TTicket
  attachments: TAttachment[]
  timeline: TTimeline | null
}

export type OfflineTicketDetailCacheEntry<
  TTicket = unknown,
  TAttachment = unknown,
  TTimeline = unknown,
> = {
  savedAt: string
  cachedAt?: string
  complete?: boolean
  mediaUrls?: string[]
  data: OfflineTicketDetailData<TTicket, TAttachment, TTimeline>
}

export type TicketDetailCacheState = 'none' | 'partial' | 'complete' | 'stale'

export type SaveTicketDetailCacheResult =
  | { ok: true; complete: true; entry: OfflineTicketDetailCacheEntry }
  | { ok: false; complete: false; message: string; storageUnavailable: boolean }

type AttachmentShape = {
  id?: string | null
  url?: string | null
  downloadUrl?: string | null
  path?: string | null
  filename?: string | null
  originalName?: string | null
  mimeType?: string | null
}

export function isTicketCacheStale(cachedAt?: string | null, now = Date.now()): boolean {
  if (!cachedAt) return true
  const value = Date.parse(cachedAt)
  return !Number.isFinite(value) || now - value >= TICKET_CACHE_STALE_MS
}

type TicketDetailMediaDeps = {
  resolveUrl: (attachment: AttachmentShape) => string
  fetchBlob: (url: string) => Promise<Blob | null>
}

async function defaultMediaDeps(): Promise<TicketDetailMediaDeps> {
  const api = await import('../../lib/api')
  return {
    resolveUrl: api.resolveTicketAttachmentUrl,
    fetchBlob: api.fetchProtectedUploadBlob,
  }
}

function imageCandidates(
  attachments: unknown[],
  resolveUrl: TicketDetailMediaDeps['resolveUrl'],
): ServerImageCandidate[] {
  return attachments
    .map((raw) => {
      const attachment = raw as AttachmentShape
      return {
        attachmentId: attachment.id || undefined,
        url: resolveUrl(attachment),
        mimeType: attachment.mimeType,
        fileName: attachment.filename || attachment.originalName,
      }
    })
    .filter((candidate) => candidate.url && isServerImageCandidate(candidate))
}

export async function saveTicketDetailCache<TTicket, TAttachment, TTimeline>(params: {
  ticketId: string
  scope?: TicketScopeLike
  ticket: TTicket
  attachments: TAttachment[]
  timeline: TTimeline | null
  mediaDeps?: TicketDetailMediaDeps
}): Promise<SaveTicketDetailCacheResult> {
  const store = offlineStore()
  if (!store?.available || !params.ticketId) {
    return {
      ok: false,
      complete: false,
      message: 'Офлайн-хранилище недоступно',
      storageUnavailable: true,
    }
  }

  const key = ticketDetailCacheKey(params.ticketId, params.scope)
  const savedAt = new Date().toISOString()
  const data = {
    ticket: params.ticket,
    attachments: params.attachments,
    timeline: params.timeline,
  }
  const partialEntry: OfflineTicketDetailCacheEntry<TTicket, TAttachment, TTimeline> = {
    savedAt,
    complete: false,
    mediaUrls: [],
    data,
  }
  const initialWrite = await store.cacheTicketDetailEntry(key, partialEntry)
  if (!initialWrite.ok) {
    if (initialWrite.reason === 'quota' || initialWrite.reason === 'unavailable') {
      reportOfflineStorageUnavailable(initialWrite.message)
    }
    return {
      ok: false,
      complete: false,
      message: initialWrite.message,
      storageUnavailable: initialWrite.reason === 'quota' || initialWrite.reason === 'unavailable',
    }
  }

  const hasImages = params.attachments.some((raw) => {
    const attachment = raw as AttachmentShape
    const rawUrl = attachment.downloadUrl || attachment.url || attachment.path || ''
    return Boolean(rawUrl) && isServerImageCandidate({
      url: rawUrl,
      mimeType: attachment.mimeType,
      fileName: attachment.filename || attachment.originalName,
    })
  })
  const mediaDeps = params.mediaDeps || (hasImages ? await defaultMediaDeps() : null)
  const candidates = mediaDeps ? imageCandidates(params.attachments, mediaDeps.resolveUrl) : []
  const media = await cacheServerImagesForParent({
    parent: { type: 'ticket', id: params.ticketId },
    candidates,
    fetchBlob: mediaDeps?.fetchBlob || (async () => null),
  })
  if (!media.ok) {
    return {
      ok: false,
      complete: false,
      message: media.message,
      storageUnavailable: media.storageUnavailable,
    }
  }

  await retainServerMediaForParent({ type: 'ticket', id: params.ticketId }, media.urls)
  const entry: OfflineTicketDetailCacheEntry<TTicket, TAttachment, TTimeline> = {
    savedAt,
    cachedAt: new Date().toISOString(),
    complete: true,
    mediaUrls: media.urls,
    data: {
      ticket: params.ticket,
      attachments: params.attachments,
      timeline: params.timeline,
    },
  }
  const finalWrite = await store.cacheTicketDetailEntry(key, entry)
  if (!finalWrite.ok) {
    if (finalWrite.reason === 'quota' || finalWrite.reason === 'unavailable') {
      reportOfflineStorageUnavailable(finalWrite.message)
    }
    return {
      ok: false,
      complete: false,
      message: finalWrite.message,
      storageUnavailable: finalWrite.reason === 'quota' || finalWrite.reason === 'unavailable',
    }
  }
  return { ok: true, complete: true, entry }
}

export async function loadTicketDetailCache<TTicket, TAttachment, TTimeline>(
  ticketId: string,
  scope?: TicketScopeLike,
): Promise<OfflineTicketDetailCacheEntry<TTicket, TAttachment, TTimeline> | null> {
  const store = offlineStore()
  if (!store || !ticketId) return null
  return store.readTicketDetailEntry<OfflineTicketDetailCacheEntry<TTicket, TAttachment, TTimeline>>(
    ticketDetailCacheKey(ticketId, scope),
  )
}

/** Любой сохранённый срез заявки по id (разные scope в ключе). Только для офлайн-чтения. */
export async function loadAnyTicketDetailCache<TTicket, TAttachment, TTimeline>(
  ticketId: string,
): Promise<OfflineTicketDetailCacheEntry<TTicket, TAttachment, TTimeline> | null> {
  const id = (ticketId || '').trim()
  const store = offlineStore()
  if (!store || !id) return null
  const prefix = `${id}::`
  const keys = await store.listTicketDetailKeys()
  for (const key of keys) {
    if (!key.startsWith(prefix)) continue
    const entry = await store.readTicketDetailEntry<
      OfflineTicketDetailCacheEntry<TTicket, TAttachment, TTimeline>
    >(key)
    if (entry) return entry
  }
  return null
}

/** Чтение detail для queryFn: ждёт store и перебирает scope, затем любой снимок этого id. */
export async function readCachedTicketDetail<TTicket, TAttachment, TTimeline>(
  ticketId: string,
  scopes: Array<TicketScopeLike | undefined> = [],
): Promise<OfflineTicketDetailCacheEntry<TTicket, TAttachment, TTimeline> | null> {
  await waitForOfflineStore()
  for (const scope of scopes) {
    const entry = await loadTicketDetailCache<TTicket, TAttachment, TTimeline>(ticketId, scope)
    if (entry?.data) return entry
  }
  return loadAnyTicketDetailCache<TTicket, TAttachment, TTimeline>(ticketId)
}

export async function ticketDetailCacheState(
  ticketId: string,
  scope?: TicketScopeLike,
): Promise<TicketDetailCacheState> {
  const entry = await readCachedTicketDetail(ticketId, [scope])
  const ticket = (entry?.data as { ticket?: { id?: string } } | undefined)?.ticket
  if (!ticket?.id) return 'none'
  if (!entry?.complete || !entry.cachedAt || !(await hasAllServerMedia(entry.mediaUrls || []))) return 'partial'
  return isTicketCacheStale(entry.cachedAt) ? 'stale' : 'complete'
}

export async function removeTicketDetailCache(
  ticketId: string,
  scope?: TicketScopeLike,
): Promise<void> {
  const store = offlineStore()
  if (!store || !ticketId) return
  const key = ticketDetailCacheKey(ticketId, scope)
  await store.deleteTicketDetailEntry(key)

  // Один ticket может иметь detail в нескольких scope. Оригиналы удаляются
  // только вместе с последним его снимком.
  const prefix = `${ticketId}::`
  const remaining = (await store.listTicketDetailKeys()).some((item) => item.startsWith(prefix))
  if (!remaining) await deleteServerMediaForParent({ type: 'ticket', id: ticketId })
}
