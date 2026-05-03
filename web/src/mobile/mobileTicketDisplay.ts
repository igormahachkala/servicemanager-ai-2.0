import type { TicketCard, TicketGetOne } from '../lib/api'

/** Состояние для Link: откуда открыли карточку (кнопка «Назад» на деталях). */
export type MobileTicketListOrigin = 'home' | 'my'

export function mobileTicketNumberTitle(ticketNumber?: number | null): string {
  if (ticketNumber != null && Number.isFinite(Number(ticketNumber))) {
    return `Заявка #${ticketNumber}`
  }
  return 'Заявка'
}

export function mobileTicketCategoryLocationFromCard(
  card: Pick<TicketCard, 'category' | 'title' | 'location' | 'pointName'>,
): string {
  const cat = card.category?.name || card.title || 'Без категории'
  const loc = card.location?.name || card.pointName || 'Без локации'
  return `${cat} · ${loc}`
}

export function mobileTicketCategoryLocationFromDetail(
  ticket: Pick<TicketGetOne, 'problemCategory' | 'title' | 'location' | 'pointName'>,
): string {
  const cat = ticket.problemCategory?.name || ticket.title || 'Без категории'
  const loc = ticket.location?.name || ticket.pointName || 'Без локации'
  return `${cat} · ${loc}`
}

export function mobileTicketNavState(
  origin: MobileTicketListOrigin,
): { mobileListOrigin: MobileTicketListOrigin } {
  return { mobileListOrigin: origin }
}
