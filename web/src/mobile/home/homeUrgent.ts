import type { TicketCard, TicketStatus } from '../../lib/api'
import { dedupeBoardCards } from '../mobileHomeBoardFilters'
import { mobileTicketPriorityIsUrgent } from '../mobileTicketDisplay'

/**
 * SMA-MOBILE-SERVICE-OS Phase 0+1 — выбор срочных заявок для приоритетного блока
 * Главной. Использует уже загруженные board-данные (новый backend не вводится):
 * срочные + ещё в работе (не завершённые/отменённые/на приёмке).
 */
const ACTIVE_STATUSES: ReadonlySet<TicketStatus> = new Set<TicketStatus>(['NEW', 'ASSIGNED', 'IN_PROGRESS'])

export function selectHomeUrgentTickets(cards: TicketCard[] | null | undefined): TicketCard[] {
  if (!cards || cards.length === 0) return []
  return dedupeBoardCards(cards).filter(
    (ticket) => mobileTicketPriorityIsUrgent(ticket.priority) && ACTIVE_STATUSES.has(ticket.status),
  )
}
