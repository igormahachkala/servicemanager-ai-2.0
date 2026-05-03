import type { TicketCard } from '../lib/api'

export type MobileHomeBoardFilterTab = 'all' | 'new' | 'mine' | 'in_work'

export function dedupeBoardCards(cards: TicketCard[]): TicketCard[] {
  const seen = new Set<string>()
  const out: TicketCard[] = []
  for (const c of cards) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    out.push(c)
  }
  return out
}

export function isNewUnassignedTicket(ticket: TicketCard): boolean {
  return ticket.status === 'NEW' && !ticket.assignedTechnician
}

export function isTicketAssignedToMe(ticket: TicketCard, meId: string | undefined): boolean {
  if (!meId) return false
  return (ticket.assignedTechnician?.id || '').trim() === meId.trim()
}

export function isTicketInWorkStatus(ticket: TicketCard): boolean {
  return ticket.status === 'ASSIGNED' || ticket.status === 'IN_PROGRESS'
}

export function filterTicketsForMobileHomeTab(
  cards: TicketCard[],
  tab: MobileHomeBoardFilterTab,
  meId: string | undefined,
): TicketCard[] {
  const list = dedupeBoardCards(cards)
  if (tab === 'all') return list
  if (tab === 'new') return list.filter(isNewUnassignedTicket)
  if (tab === 'mine') return list.filter((t) => isTicketAssignedToMe(t, meId))
  if (tab === 'in_work') return list.filter(isTicketInWorkStatus)
  return list
}

export function mobileHomeBoardTabCounts(cards: TicketCard[], meId: string | undefined) {
  const list = dedupeBoardCards(cards)
  return {
    all: list.length,
    new: list.filter(isNewUnassignedTicket).length,
    mine: list.filter((t) => isTicketAssignedToMe(t, meId)).length,
    in_work: list.filter(isTicketInWorkStatus).length,
  }
}

export function emptyMessageForMobileHomeTab(tab: MobileHomeBoardFilterTab): string {
  switch (tab) {
    case 'new':
      return 'Нет новых заявок'
    case 'mine':
      return 'Нет назначенных заявок'
    case 'in_work':
      return 'Нет заявок в работе'
    default:
      return 'Нет заявок'
  }
}
