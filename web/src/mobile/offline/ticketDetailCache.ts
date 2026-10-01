/**
 * Детальный снимок заявки (ticket + attachments + timeline) в IndexedDB.
 *
 * Заменяет общий localStorage-ключ `sm_mobile_ticket_cache_v1`. Ключ хранит
 * scope (`ticketId::scopeJSON`), как раньше: разные контуры одной заявки
 * не затирают друг друга.
 */

import { offlineStore } from './runtime.js'
import { ticketDetailCacheKey, type TicketScopeLike } from './cacheKeys.js'

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
  data: OfflineTicketDetailData<TTicket, TAttachment, TTimeline>
}

export async function saveTicketDetailCache<TTicket, TAttachment, TTimeline>(params: {
  ticketId: string
  scope?: TicketScopeLike
  ticket: TTicket
  attachments: TAttachment[]
  timeline: TTimeline | null
}): Promise<void> {
  const store = offlineStore()
  if (!store || !params.ticketId) return
  await store.cacheTicketDetailEntry(ticketDetailCacheKey(params.ticketId, params.scope), {
    savedAt: new Date().toISOString(),
    data: {
      ticket: params.ticket,
      attachments: params.attachments,
      timeline: params.timeline,
    },
  })
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
