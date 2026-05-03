import type { Me, Role, TicketCard, TicketGetOne, TicketScopeParams } from '../lib/api'

/** Состояние для Link: откуда открыли карточку (кнопка «Назад» на деталях). */
export type MobileTicketListOrigin = 'home' | 'my'

/** Данные навигации с списка → детали (scope + «Назад»). */
export type MobileTicketNavState = {
  mobileListOrigin: MobileTicketListOrigin
  /** companyId владельца заявки (tenant), если заявка не в компании текущего пользователя — для getOne/attachments. */
  ticketOwnerCompanyId?: string
}

const MOBILE_TICKET_LINK_SCOPE_ROLES: Role[] = [
  'TECHNICIAN',
  'ADMIN',
  'MASTER',
  'DISPATCHER',
  'NETWORK_DIRECTOR',
  'TERRITORIAL_MANAGER',
]

/** Сжать scope для appendScopeToPath: пустой объект не блокирует fallback по owner. */
export function compactTicketScope(s: TicketScopeParams): TicketScopeParams | undefined {
  const companyId = (s.companyId || '').trim()
  const linked = (s.linkedClientCompanyId || '').trim()
  const out: TicketScopeParams = {}
  if (companyId) out.companyId = companyId
  if (linked) out.linkedClientCompanyId = linked
  return Object.keys(out).length ? out : undefined
}

/**
 * Тот же принцип, что у board: заявка в tenant другой компании → linkedClientCompanyId = companyId заявки.
 * Не подменяет доступ: только отражает уже видимую на доске заявку.
 */
export function scopeForMobileTicketLink(
  me: Pick<Me, 'companyId' | 'role'> | null | undefined,
  pageScope: TicketScopeParams,
  ticket: Pick<TicketCard, 'companyId'>,
): TicketScopeParams {
  const base: TicketScopeParams = {
    companyId: pageScope.companyId,
    linkedClientCompanyId: pageScope.linkedClientCompanyId,
  }
  if (!me?.companyId || !ticket.companyId) return base
  if (ticket.companyId === me.companyId) return base
  if (!me.role || !MOBILE_TICKET_LINK_SCOPE_ROLES.includes(me.role)) return base
  return {
    companyId: base.companyId,
    linkedClientCompanyId: ticket.companyId,
  }
}

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
  ticketOwnerCompanyId?: string,
): MobileTicketNavState {
  const owner = (ticketOwnerCompanyId || '').trim()
  if (owner) return { mobileListOrigin: origin, ticketOwnerCompanyId: owner }
  return { mobileListOrigin: origin }
}
