import { cacheLocationSnapshot } from './locationCache.js'
import { cacheTicketSnapshot } from './ticketCache.js'
import {
  saveTicketDetailCache,
  type SaveTicketDetailCacheResult,
} from './ticketDetailCache.js'
import type { TicketScopeLike } from './cacheKeys.js'

export type AutoPrefetchTicket = {
  id: string
  status?: string
  assignedTechnicianId?: string | null
  assignedTechnician?: { id?: string | null } | null
}

function assignedToMe(ticket: AutoPrefetchTicket, meId?: string): boolean {
  if (!meId) return false
  return (ticket.assignedTechnicianId || ticket.assignedTechnician?.id || '') === meId
}

/** Все IN_PROGRESS техника + 5 первых ASSIGNED в порядке списка Home (вкладка «Все»). */
export function selectAutoPrefetchTicketIds(
  allTickets: AutoPrefetchTicket[],
  homeListTickets: AutoPrefetchTicket[],
  meId?: string,
): string[] {
  const inProgress = allTickets
    .filter((ticket) => ticket.status === 'IN_PROGRESS' && assignedToMe(ticket, meId))
    .map((ticket) => ticket.id)
  const assigned = homeListTickets
    .filter((ticket) => ticket.status === 'ASSIGNED' && assignedToMe(ticket, meId))
    .slice(0, 5)
    .map((ticket) => ticket.id)
  return [...new Set([...inProgress, ...assigned])]
}

export type TicketPrefetchResult =
  | { ok: true; ticketId: string }
  | { ok: false; ticketId: string; message: string; storageUnavailable: boolean }

/** Полный detail и все оригиналы изображений. Частичный результат успехом не считается. */
export async function prefetchTicketForOffline(
  ticketId: string,
  scope?: TicketScopeLike,
): Promise<TicketPrefetchResult> {
  try {
    const api = await import('../../lib/api')
    const [ticket, attachments, timeline] = await Promise.all([
      api.getTicket(ticketId, scope),
      api.ticketAttachments(ticketId, scope),
      api.ticketTimeline(ticketId, scope),
    ])

    const saved: SaveTicketDetailCacheResult = await saveTicketDetailCache({
      ticketId,
      scope,
      ticket,
      attachments,
      timeline,
    })
    if (!saved.ok) {
      return {
        ok: false,
        ticketId,
        message: saved.message,
        storageUnavailable: saved.storageUnavailable,
      }
    }

    await cacheTicketSnapshot(ticket as { id: string } & Record<string, unknown>)
    if (ticket.location?.id) {
      await cacheLocationSnapshot(ticket.location as { id: string } & Record<string, unknown>)
    }
    return { ok: true, ticketId }
  } catch (error) {
    return {
      ok: false,
      ticketId,
      message: (error as Error)?.message || 'Не удалось закэшировать заявку',
      storageUnavailable: false,
    }
  }
}
