import type { Role, TicketCard } from '../lib/api'
import { safeReadJson, safeWriteJson } from '../lib/browserStorage'
import {
  dedupeBoardCards,
  filterTicketsForMobileHomeTab,
  isAwaitingAcceptanceTicket,
  isMobileHomeBoardFilterTab,
  ticketRequiresMyAction,
  type MobileHomeBoardChipId,
  type MobileHomeBoardFilterTab,
  MOBILE_HOME_BOARD_CHIP_IDS,
} from './mobileHomeBoardFilters'
import type { MobileHomeQuickFilter } from './home/HomeQuickCards'
import { isHomeUrgentTicket } from './home/homeUrgent'

const LS_KEY = 'sma.mobileHome.boardUi.v1'

const QUICK_FILTER_VALUES = ['urgent', 'awaiting', 'longterm', 'myaction', 'rework'] as const
function readQuickFilter(v: unknown): MobileHomeQuickFilter {
  return typeof v === 'string' && (QUICK_FILTER_VALUES as readonly string[]).includes(v)
    ? (v as MobileHomeQuickFilter)
    : null
}

export const MOBILE_HOME_QUICK_FILTER_LABELS: Record<Exclude<MobileHomeQuickFilter, null>, string> = {
  urgent: 'Срочные заявки',
  awaiting: 'На приёмке',
  longterm: 'Долгосрочные заявки',
  myaction: 'Требует моего действия',
  rework: 'Требуют доработки',
}

export type MobileHomeQuickFilterContext = {
  meId: string | undefined
  meRole: Role | undefined | null
  canAssignProvider: boolean
  reworkTicketIds: ReadonlySet<string>
}

/** Быстрые карты, которые считаются по board главной. */
export type MobileHomeBoardQuickFilter = Exclude<MobileHomeQuickFilter, null | 'longterm'>

/**
 * Выборка быстрой карты главной по board. Счётчик карты и открытый по нажатию
 * список считаются одной функцией по одному и тому же board, поэтому
 * расходиться не могут, а board уже сужен backend'ом (tenant, контур, привязки).
 *
 * «Долгосрочные» сюда не входят: board — последние 500 заявок, а долгосрочная
 * заявка бывает старой. Их выборку и точный total отдаёт GET /tickets/long-term.
 */
export function filterTicketsByQuickFilter(
  cards: TicketCard[],
  quickFilter: MobileHomeBoardQuickFilter,
  ctx: MobileHomeQuickFilterContext,
): TicketCard[] {
  const list = dedupeBoardCards(cards)
  switch (quickFilter) {
    case 'urgent':
      return list.filter(isHomeUrgentTicket)
    case 'awaiting':
      return list.filter(isAwaitingAcceptanceTicket)
    case 'rework':
      return list.filter((t) => t.status === 'IN_PROGRESS' && ctx.reworkTicketIds.has(t.id))
    case 'myaction':
      return list.filter((t) => ticketRequiresMyAction(t, ctx.meId, ctx.meRole, ctx.canAssignProvider))
  }
}

/** Нажатие на быструю карту: открыть её выборку, повторное нажатие — закрыть. */
export function toggleMobileHomeQuickFilter(
  current: MobileHomeQuickFilter,
  next: Exclude<MobileHomeQuickFilter, null>,
): MobileHomeQuickFilter {
  return current === next ? null : next
}

/**
 * Страницы долгосрочных заявок → один список. Сервер отдаёт страницы по
 * курсору без пересечений, но запрос мог повториться (refetch, двойной тап на
 * «Показать ещё»), и одна заявка не должна показаться дважды.
 */
export function mergeLongTermTicketPages(pages: ReadonlyArray<{ items: TicketCard[] }> | undefined): TicketCard[] {
  const seen = new Set<string>()
  const out: TicketCard[] = []
  for (const page of pages ?? []) {
    for (const ticket of page.items) {
      if (seen.has(ticket.id)) continue
      seen.add(ticket.id)
      out.push(ticket)
    }
  }
  return out
}

/** «Показано N из total» в открытом списке — total страницы, не длина загруженного. */
export function longTermTicketsTotal(pages: ReadonlyArray<{ total: number }> | undefined): number {
  const first = pages?.[0]
  return first && Number.isFinite(first.total) ? first.total : 0
}

/**
 * Счётчик карточки на главной — ответ GET /tickets/long-term/count: один COUNT
 * по всему контуру, без списка. Нет ответа или он битый — ноль, карточка скрыта.
 */
export function longTermCardCount(count: { total: number } | undefined): number {
  return count && Number.isFinite(count.total) && count.total > 0 ? count.total : 0
}

/** Список долгосрочных грузится, только когда карточку открыли. */
export function shouldLoadLongTermList(quickFilter: MobileHomeQuickFilter): boolean {
  return quickFilter === 'longterm'
}

export function readPersistedMobileHomeBoardUi(): {
  tab: MobileHomeBoardFilterTab
  chips: MobileHomeBoardChipId[]
  quickFilter: MobileHomeQuickFilter
} {
  const o = safeReadJson<{ tab?: string; chips?: unknown; quickFilter?: unknown } | null>('local', LS_KEY, null)
  if (!o) return { tab: 'all', chips: [], quickFilter: null }
  const tab = isMobileHomeBoardFilterTab(o.tab) ? o.tab : 'all'
  const chipsRaw = Array.isArray(o.chips) ? o.chips : []
  const chips = chipsRaw.filter((c): c is MobileHomeBoardChipId =>
    MOBILE_HOME_BOARD_CHIP_IDS.includes(c as MobileHomeBoardChipId),
  )
  return { tab, chips, quickFilter: readQuickFilter(o.quickFilter) }
}

export function writePersistedMobileHomeBoardUi(
  tab: MobileHomeBoardFilterTab,
  chips: Iterable<MobileHomeBoardChipId>,
  quickFilter: MobileHomeQuickFilter,
) {
  safeWriteJson('local', LS_KEY, { tab, chips: [...new Set(chips)], quickFilter })
}

function norm(s: string): string {
  return s.trim().toLowerCase()
}

function ticketHaystack(t: TicketCard): string {
  const parts: string[] = []
  if (t.ticketNumber != null && Number.isFinite(Number(t.ticketNumber))) parts.push(String(t.ticketNumber), `#${t.ticketNumber}`)
  const req = (t.requesterName || '').trim()
  if (req) parts.push(req)
  const pt = (t.pointName || '').trim()
  if (pt) parts.push(pt)
  const loc = t.location
  if (loc) {
    parts.push(loc.name, loc.address || '', loc.city || '', loc.platformCode || '', loc.externalCode || '')
  }
  parts.push(t.category?.name || '', t.title || '')
  const desc = (t.description || '').trim()
  if (desc) parts.push(desc)
  return norm(parts.filter(Boolean).join('\n'))
}

export function ticketMatchesMobileHomeSearch(ticket: TicketCard, queryRaw: string): boolean {
  const q = norm(queryRaw)
  if (!q) return true
  return ticketHaystack(ticket).includes(q)
}

export type TicketSlaState = 'none' | 'breached' | 'warning' | 'ok'

export function getSlaState(ticket: TicketCard, nowMs: number): TicketSlaState {
  if (!ticket.slaDueAt) return 'none'
  const due = new Date(ticket.slaDueAt).getTime()
  if (Number.isNaN(due)) return 'none'
  if (due < nowMs) return 'breached'
  const diff = due - nowMs
  if (diff < 60 * 60 * 1000) return 'warning'
  return 'ok'
}

function isNearDeadlineTicket(t: TicketCard, nowMs: number, atRiskThresholdMs: number): boolean {
  if (t.status === 'DONE' || t.status === 'CANCELED') return false
  if (!t.slaDueAt || t.slaBreached) return false
  const due = new Date(t.slaDueAt).getTime()
  if (Number.isNaN(due) || nowMs >= due) return false
  return nowMs > due - atRiskThresholdMs
}

function isTodayTicket(t: TicketCard, nowMs: number): boolean {
  const d = new Date(t.createdAt)
  if (Number.isNaN(d.getTime())) return false
  const a = new Date(nowMs)
  return (
    d.getFullYear() === a.getFullYear() && d.getMonth() === a.getMonth() && d.getDate() === a.getDate()
  )
}

function ticketMatchesChip(
  ticket: TicketCard,
  chip: MobileHomeBoardChipId,
  _meId: string | undefined,
  _meRole: Role | undefined | null,
  nowMs: number,
): boolean {
  switch (chip) {
    case 'urgent':
      // SMA-MOBILE-HOME — «Срочные» = canonical isHomeUrgentTicket (priority/urgency
      // URGENT), единый предикат с операционной карточкой и urgent quick-filter.
      return isHomeUrgentTicket(ticket)
    case 'overdue':
      return getSlaState(ticket, nowMs) === 'breached'
    case 'unassigned':
      return ticket.status === 'NEW' && !ticket.assignedTechnician
    case 'today':
      return isTodayTicket(ticket, nowMs)
    default:
      return true
  }
}

export function filterTicketsByChips(
  tickets: TicketCard[],
  chips: ReadonlySet<MobileHomeBoardChipId>,
  meId: string | undefined,
  meRole: Role | undefined | null,
  nowMs: number,
): TicketCard[] {
  if (!chips.size) return tickets
  return tickets.filter((t) => {
    for (const c of chips) {
      if (!ticketMatchesChip(t, c, meId, meRole, nowMs)) return false
    }
    return true
  })
}

export function sortTicketsForMobileHome(
  tickets: TicketCard[],
  nowMs: number,
  atRiskThresholdMinutes: number,
): TicketCard[] {
  const atRiskMs = Math.max(1, atRiskThresholdMinutes) * 60_000
  const slaPriority: Record<TicketSlaState, number> = {
    breached: 0,
    warning: 1,
    ok: 2,
    none: 3,
  }
  const score = (t: TicketCard): [number, number, number, number, number] => {
    const slaState = getSlaState(t, nowMs)
    const slaRank = slaPriority[slaState]
    const urgent = isHomeUrgentTicket(t) ? 0 : 1
    const deadlinePressure =
      slaState === 'breached' || slaState === 'warning' || isNearDeadlineTicket(t, nowMs, atRiskMs) ? 0 : 1
    const newUn = t.status === 'NEW' && !t.assignedTechnician ? 0 : 1
    const created = new Date(t.createdAt).getTime()
    const createdKey = Number.isNaN(created) ? 0 : -created
    return [slaRank, urgent, deadlinePressure, newUn, createdKey]
  }
  const cmp = (a: TicketCard, b: TicketCard) => {
    const sa = score(a)
    const sb = score(b)
    for (let i = 0; i < sa.length; i++) {
      if (sa[i] !== sb[i]) return sa[i] - sb[i]
    }
    return 0
  }
  return [...tickets].sort(cmp)
}

export function buildMobileHomeVisibleTickets(params: {
  cards: TicketCard[]
  tab: MobileHomeBoardFilterTab
  meId: string | undefined
  meRole?: Role | null
  chips: ReadonlySet<MobileHomeBoardChipId>
  searchQuery: string
  atRiskThresholdMinutes: number
  nowMs?: number
}): TicketCard[] {
  const nowMs = params.nowMs ?? Date.now()
  const tabbed = filterTicketsForMobileHomeTab(params.cards, params.tab, params.meId, params.meRole)
  const deduped = dedupeBoardCards(tabbed)
  const chipped = filterTicketsByChips(deduped, params.chips, params.meId, params.meRole, nowMs)
  const searched = chipped.filter((t) => ticketMatchesMobileHomeSearch(t, params.searchQuery))
  return sortTicketsForMobileHome(searched, nowMs, params.atRiskThresholdMinutes)
}

export type MobileHomeLocationGroup = {
  locationId: string
  locationName: string
  city: string | null
  address: string | null
  /** Renderable tickets for the selected home-board context. */
  tickets: TicketCard[]
  /** Полный счётчик: все статусы (включая DONE/CANCELED). */
  totalTickets: number
  newTickets: number
  inProgressTickets: number
  /** Активные = NEW + ASSIGNED + IN_PROGRESS + AWAITING_ACCEPTANCE. */
  activeTickets: number
  doneTickets: number
  canceledTickets: number
  /** Просроченные только среди активных заявок. */
  overdueTickets: number
}

export type MobileHomeLocationGroupRenderMode = 'active' | 'done'

/** SMA-112: активная заявка для главной (диспетчерский экран). */
function isActiveHomeTicketStatus(status: TicketCard['status']): boolean {
  // SMA-ACCEPTANCE-005: заявка на приёмке у клиента ещё активна и остаётся на главной доске.
  return (
    status === 'NEW' ||
    status === 'ASSIGNED' ||
    status === 'IN_PROGRESS' ||
    status === 'AWAITING_ACCEPTANCE'
  )
}

function shouldRenderTicketInLocationGroup(status: TicketCard['status'], renderMode: MobileHomeLocationGroupRenderMode): boolean {
  if (renderMode === 'done') return status === 'DONE'
  return isActiveHomeTicketStatus(status)
}

/**
 * Group an already-sorted ticket list by location, preserving ticket sort order within
 * each group. Group order = insertion order (first group contains the globally most-critical ticket).
 *
 * SMA-112: счётчики точки считаются по ВСЕМ статусам (total/active/done/canceled/overdue),
 * но в `tickets` (для раскрытого списка) попадают заявки выбранного контекста вкладки.
 * Группа создаётся даже если у точки нет активных заявок (карточка остаётся видимой).
 */
export function groupTicketsByLocation(
  tickets: TicketCard[],
  options: { renderMode?: MobileHomeLocationGroupRenderMode } = {},
): MobileHomeLocationGroup[] {
  const renderMode = options.renderMode ?? 'active'
  const map = new Map<string, MobileHomeLocationGroup>()
  for (const t of tickets) {
    const locId = t.location?.id ?? '__none__'
    if (!map.has(locId)) {
      map.set(locId, {
        locationId: locId,
        locationName: t.location?.name ?? (t.pointName || null) ?? 'Без точки',
        city: t.location?.city ?? null,
        address: t.location?.address ?? null,
        tickets: [],
        totalTickets: 0,
        newTickets: 0,
        inProgressTickets: 0,
        activeTickets: 0,
        doneTickets: 0,
        canceledTickets: 0,
        overdueTickets: 0,
      })
    }
    const g = map.get(locId)!
    g.totalTickets++
    if (t.status === 'NEW') g.newTickets++
    if (t.status === 'IN_PROGRESS' || t.status === 'ASSIGNED' || t.status === 'AWAITING_ACCEPTANCE') g.inProgressTickets++
    if (t.status === 'DONE') g.doneTickets++
    if (t.status === 'CANCELED') g.canceledTickets++
    if (isActiveHomeTicketStatus(t.status)) {
      g.activeTickets++
      if (t.slaBreached) g.overdueTickets++
    }
    if (shouldRenderTicketInLocationGroup(t.status, renderMode)) g.tickets.push(t)
  }
  return [...map.values()]
}

/** Default expanded set: first group when ≤3 groups, else all collapsed. */
export function defaultExpandedLocationIds(groups: MobileHomeLocationGroup[]): Set<string> {
  if (groups.length === 0) return new Set()
  if (groups.length <= 3) return new Set([groups[0].locationId])
  return new Set()
}

export function formatActiveMobileHomeFiltersSummary(params: {
  searchQuery: string
  chips: ReadonlySet<MobileHomeBoardChipId>
  chipLabels: Record<MobileHomeBoardChipId, string>
}): string {
  const bits: string[] = []
  const q = params.searchQuery.trim()
  if (q) bits.push(`поиск «${q.length > 40 ? `${q.slice(0, 40)}…` : q}»`)
  for (const c of params.chips) {
    bits.push(params.chipLabels[c] || c)
  }
  return bits.length ? bits.join(' · ') : ''
}
