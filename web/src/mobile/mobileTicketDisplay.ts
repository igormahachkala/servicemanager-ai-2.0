import type { Me, Role, TicketCard, TicketGetOne, TicketScopeParams } from '../lib/api'

/** Состояние для Link: откуда открыли карточку (кнопка «Назад» на деталях). */
export type MobileTicketListOrigin = 'home' | 'my'

/** Данные навигации с списка → детали (scope + «Назад»). */
export type MobileTicketNavState = {
  mobileListOrigin: MobileTicketListOrigin
  /** companyId владельца заявки (tenant), если заявка не в компании текущего пользователя — для getOne/attachments. */
  ticketOwnerCompanyId?: string
}

/** Роли, для которых карточка клиента на доске провайдера открывается с linkedClientCompanyId = companyId заявки и повтором getOne по владельцу при 404. */
const MOBILE_TICKET_LINK_SCOPE_ROLES: Role[] = [
  'TECHNICIAN',
  'ADMIN',
  'MASTER',
  'DISPATCHER',
  'NETWORK_DIRECTOR',
  'TERRITORIAL_MANAGER',
  'STAFF',
]

function scopeFingerprint(s: TicketScopeParams): string {
  return `${(s.companyId || '').trim()}\t${(s.linkedClientCompanyId || '').trim()}`
}

/**
 * Пустой объект: appendScopeToPath/getScopeSearchSuffix не подставят persisted scope в URL
 * (иначе в ссылку попадает чужой linkedClient и детали дают ложный 404).
 */
export function compactTicketScope(s: TicketScopeParams): TicketScopeParams {
  const companyId = (s.companyId || '').trim()
  const linked = (s.linkedClientCompanyId || '').trim()
  const out: TicketScopeParams = {}
  if (companyId) out.companyId = companyId
  if (linked) out.linkedClientCompanyId = linked
  return Object.keys(out).length ? out : {}
}

/**
 * Порядок полей как при чтении scope на деталях: URL → state ticketOwner → persisted.
 * Вторая попытка (если отличается от первой): linkedClientCompanyId = ticketOwner из state — после 404 по первой.
 */
export function mobileTicketDetailGetOneScopes(input: {
  urlCompanyId: string
  urlLinkedClientCompanyId: string
  stateTicketOwnerCompanyId: string
  persistedCompanyId: string
  persistedLinkedClientCompanyId: string
  meRole: Role | undefined | null
}): TicketScopeParams[] {
  const urlCompanyId = (input.urlCompanyId || '').trim()
  const urlLinkedClientCompanyId = (input.urlLinkedClientCompanyId || '').trim()
  const stateOwner = (input.stateTicketOwnerCompanyId || '').trim()
  const persistedCompanyId = (input.persistedCompanyId || '').trim()
  const persistedLinked = (input.persistedLinkedClientCompanyId || '').trim()

  const primary: TicketScopeParams = {
    companyId: urlCompanyId || persistedCompanyId || undefined,
    linkedClientCompanyId: urlLinkedClientCompanyId || stateOwner || persistedLinked || undefined,
  }

  const out: TicketScopeParams[] = []
  const add = (s: TicketScopeParams) => {
    const fp = scopeFingerprint(s)
    if (!out.some((x) => scopeFingerprint(x) === fp)) out.push(s)
  }

  add(primary)

  const canOwnerRetry =
    !!stateOwner &&
    !!input.meRole &&
    MOBILE_TICKET_LINK_SCOPE_ROLES.includes(input.meRole) &&
    scopeFingerprint({ ...primary, linkedClientCompanyId: stateOwner }) !== scopeFingerprint(primary)

  if (canOwnerRetry) {
    add({
      companyId: primary.companyId,
      linkedClientCompanyId: stateOwner,
    })
  }

  return out
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
