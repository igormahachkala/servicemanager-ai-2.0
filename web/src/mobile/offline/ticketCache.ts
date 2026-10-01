/**
 * Снимок заявки в IndexedDB (namespace пользователя).
 *
 * Не заменяет детальный localStorage-кэш (ticket+attachments+timeline) —
 * тот переносится в плане 3. Здесь entity `tickets` для холодного показа
 * карточки, когда legacy-среза ещё нет.
 */

import { offlineStore } from './runtime.js'

type TicketSnapshot = { id: string } & Record<string, unknown>

export async function cacheTicketSnapshot(ticket: TicketSnapshot): Promise<void> {
  const store = offlineStore()
  if (!store || !ticket?.id) return
  await store.cacheTicket(ticket)
}

export async function readTicketSnapshot<T extends TicketSnapshot>(ticketId: string): Promise<T | null> {
  const store = offlineStore()
  if (!store || !ticketId) return null
  return store.readTicket<T>(ticketId)
}
