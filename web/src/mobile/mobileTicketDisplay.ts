import type { Me, Role, TicketCard, TicketGetOne, TicketPriority, TicketScopeParams, TicketStatus } from '../lib/api'
import type { MobileHomeBoardChipId, MobileHomeBoardFilterTab } from './mobileHomeBoardFilters'

/** Состояние для Link: откуда открыли карточку (кнопка «Назад» на деталях). */
export type MobileTicketListOrigin = 'home' | 'my' | 'chat'

/** Данные навигации с списка → детали (scope + «Назад»). */
export type MobileTicketNavState = {
  mobileListOrigin: MobileTicketListOrigin
  /** companyId владельца заявки (tenant), если заявка не в компании текущего пользователя — для getOne/attachments. */
  ticketOwnerCompanyId?: string
  /** Восстановление списка главной после «Назад» с деталки (не пишем в localStorage). */
  homeBoardTab?: MobileHomeBoardFilterTab
  homeBoardChips?: MobileHomeBoardChipId[]
  homeBoardSearch?: string
  /** Одноразовый toast после редиректа (например create/create&claim). */
  mobileOperationalToast?: string
}

/**
 * Роли оператора по клиентским заявкам: tenant карточки ≠ company пользователя
 * → в ссылку/getOne уходит linkedClientCompanyId = companyId заявки.
 * (Тип компании PROVIDER в Me не приходит — у «провайдерского» контура обычно STAFF/ADMIN/TECHNICIAN.)
 */
const MOBILE_TICKET_LINK_SCOPE_ROLES: Role[] = [
  'TECHNICIAN',
  'STAFF',
  'ADMIN',
  'MASTER',
  'DISPATCHER',
  'NETWORK_DIRECTOR',
  'TERRITORIAL_MANAGER',
]

function scopeFingerprint(s: TicketScopeParams): string {
  return `${(s.companyId || '').trim()}\t${(s.linkedClientCompanyId || '').trim()}`
}

/**
 * Только явные поля; `undefined`/пустой scope → `{}`, чтобы appendScopeToPath
 * не подмешивал persisted linked/company из localStorage (ложный tenant / 404).
 */
export function compactTicketScope(
  scope?: Pick<TicketScopeParams, 'companyId' | 'linkedClientCompanyId'> | null,
): TicketScopeParams {
  if (!scope) return {}
  const clean: TicketScopeParams = {}
  const companyId = (scope.companyId || '').trim()
  const linked = (scope.linkedClientCompanyId || '').trim()
  if (companyId) clean.companyId = companyId
  if (linked) clean.linkedClientCompanyId = linked
  return clean
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

export type MobileTicketContextMode = 'observer' | 'provider' | 'tenant'

/** Режим видимости для mobile ticket UI (composer, upload). Не смешивать с API linked scope. */
export function resolveMobileTicketContextMode(
  me: Pick<Me, 'companyId' | 'role'> | null | undefined,
  ticket: Pick<TicketGetOne, 'companyId'> | null | undefined,
  observerCompanyId: string,
): MobileTicketContextMode {
  if ((observerCompanyId || '').trim()) return 'observer'
  if (!me?.role || !ticket) return 'tenant'
  if (me.role === 'CLIENT') return 'tenant'
  const meCo = (me.companyId || '').trim()
  const tCo = (ticket.companyId || '').trim()
  if (meCo && tCo && meCo !== tCo) return 'provider'
  return 'tenant'
}

export function resolveMobileCanSendComment(
  me: Pick<Me, 'companyId' | 'role'> | null | undefined,
  ticket: Pick<TicketGetOne, 'companyId'> | null | undefined,
  observerCompanyId: string,
): boolean {
  const mode = resolveMobileTicketContextMode(me, ticket, observerCompanyId)
  if (mode === 'observer') return false
  if (me?.role === 'CLIENT') return mode === 'tenant'
  return true
}

/**
 * Scope для attachments / timeline / comments / status на деталке.
 * Cross-tenant: linkedClientCompanyId = ticket.companyId (tenant заявки).
 * Own-tenant (CLIENT на своей заявке): без linked-параметра.
 */
export function resolveMobileTicketResourceScope(
  me: Pick<Me, 'companyId' | 'role'> | null | undefined,
  ticket: Pick<TicketGetOne, 'companyId'> | null | undefined,
  opts: { observerCompanyId?: string; urlLinkedClientCompanyId?: string },
): TicketScopeParams {
  const observerCompanyId = (opts.observerCompanyId || '').trim()
  if (observerCompanyId) {
    return { companyId: observerCompanyId }
  }

  const meCo = (me?.companyId || '').trim()
  const tCo = (ticket?.companyId || '').trim()

  if (meCo && tCo && meCo === tCo) {
    return {}
  }

  if (tCo && me?.role && MOBILE_TICKET_LINK_SCOPE_ROLES.includes(me.role)) {
    return { linkedClientCompanyId: tCo }
  }

  const urlLinked = (opts.urlLinkedClientCompanyId || '').trim()
  if (urlLinked) {
    return { linkedClientCompanyId: urlLinked }
  }

  return {}
}

export function mobileTicketAttachmentReadScopes(input: {
  me: Pick<Me, 'companyId' | 'role'> | null | undefined
  ticket: Pick<TicketGetOne, 'companyId'>
  observerCompanyId: string
  urlLinkedClientCompanyId: string
  stateTicketOwnerCompanyId: string
  persistedCompanyId: string
  persistedLinkedClientCompanyId: string
}): TicketScopeParams[] {
  const primary = resolveMobileTicketResourceScope(input.me, input.ticket, {
    observerCompanyId: input.observerCompanyId,
    urlLinkedClientCompanyId: input.urlLinkedClientCompanyId,
  })

  const out: TicketScopeParams[] = []
  const add = (s: TicketScopeParams) => {
    const fp = scopeFingerprint(s)
    if (!out.some((x) => scopeFingerprint(x) === fp)) out.push(s)
  }

  add(primary)

  for (const sc of mobileTicketDetailGetOneScopes({
    urlCompanyId: input.observerCompanyId,
    urlLinkedClientCompanyId: input.urlLinkedClientCompanyId,
    stateTicketOwnerCompanyId: input.stateTicketOwnerCompanyId,
    persistedCompanyId: input.persistedCompanyId,
    persistedLinkedClientCompanyId: input.persistedLinkedClientCompanyId,
    meRole: input.me?.role,
  })) {
    add(sc)
  }

  const tCo = (input.ticket.companyId || '').trim()
  if (tCo) add({ linkedClientCompanyId: tCo })
  add({})

  return out
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
  homeRestore?: { tab?: MobileHomeBoardFilterTab; chips?: MobileHomeBoardChipId[]; search?: string },
  operationalToast?: string,
): MobileTicketNavState {
  const owner = (ticketOwnerCompanyId || '').trim()
  const base: MobileTicketNavState = owner ? { mobileListOrigin: origin, ticketOwnerCompanyId: owner } : { mobileListOrigin: origin }
  if (!homeRestore) {
    const t = (operationalToast || '').trim()
    if (t) base.mobileOperationalToast = t.slice(0, 500)
    return base
  }
  if (homeRestore.tab) base.homeBoardTab = homeRestore.tab
  if (homeRestore.chips !== undefined) base.homeBoardChips = homeRestore.chips
  const q = (homeRestore.search || '').trim()
  if (q) base.homeBoardSearch = q.slice(0, 240)
  const t2 = (operationalToast || '').trim()
  if (t2) base.mobileOperationalToast = t2.slice(0, 500)
  return base
}

/** Оставить в state только поля, нужные вне экрана списка (после replace при восстановлении фильтров). */
export function stripMobileHomeRestoreFromNavState(state: MobileTicketNavState | null | undefined): MobileTicketNavState | undefined {
  if (!state) return undefined
  const next: MobileTicketNavState = {
    mobileListOrigin: state.mobileListOrigin,
  }
  if (state.ticketOwnerCompanyId) next.ticketOwnerCompanyId = state.ticketOwnerCompanyId
  return next
}

export function mobileTicketStatusLabelRu(status: TicketStatus): string {
  if (status === 'NEW') return 'Новая'
  if (status === 'ASSIGNED') return 'Назначена'
  if (status === 'IN_PROGRESS') return 'В работе'
  if (status === 'AWAITING_ACCEPTANCE') return 'Ожидает приёмки'
  if (status === 'DONE') return 'Завершена'
  if (status === 'CANCELED') return 'Отменена'
  return status
}

/** Классы для цветного бейджа статуса на мобильных экранах. */
export function mobileTicketStatusBadgeClassName(status: TicketStatus): string {
  return `mobileTicketStatus mobileTicketStatus--${status}`
}

function formatDurationRu(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0 мин'
  const totalMin = Math.ceil(ms / 60_000)
  const d = Math.floor(totalMin / (60 * 24))
  const h = Math.floor((totalMin % (60 * 24)) / 60)
  const m = totalMin % 60
  if (d > 0) return `${d} д ${h} ч`
  if (h > 0) return `${h} ч ${m} мин`
  return `${m} мин`
}

/** Текст до дедлайна SLA или «Просрочено»; для завершённых — null. */
export function mobileTicketSlaCountdownLabel(params: {
  slaDueAt: string | null | undefined
  slaBreached: boolean
  status: TicketStatus
}): string | null {
  if (params.status === 'DONE' || params.status === 'CANCELED') return null
  if (!params.slaDueAt) return null
  const due = new Date(params.slaDueAt).getTime()
  if (Number.isNaN(due)) return null
  const now = Date.now()
  if (params.slaBreached || now >= due) return 'Просрочено'
  return `Осталось: ${formatDurationRu(due - now)}`
}

export function mobileTicketPriorityIsUrgent(priority: TicketPriority | null | undefined): boolean {
  return priority === 'URGENT'
}
