import type { Role, TicketCard } from '../lib/api'

export type MobileHomeBoardFilterTab = 'all' | 'mine' | 'new' | 'in_work' | 'overdue' | 'done'

/** Канонический порядок и подписи быстрых фильтров на /m (единый источник). */
export const MOBILE_HOME_TABS: MobileHomeBoardFilterTab[] = ['all', 'mine', 'new', 'in_work', 'overdue', 'done']

export const MOBILE_HOME_TAB_LABELS: Record<MobileHomeBoardFilterTab, string> = {
  all: 'Все',
  mine: 'Мои',
  new: 'Новые',
  in_work: 'В работе',
  overdue: 'Просроченные',
  done: 'Завершенные',
}

export function isMobileHomeBoardFilterTab(value: unknown): value is MobileHomeBoardFilterTab {
  return typeof value === 'string' && (MOBILE_HOME_TABS as string[]).includes(value)
}

/** Быстрые фильтры на главной /m (комбинируются с поиском и вкладкой). */
export type MobileHomeBoardChipId = 'urgent' | 'overdue' | 'unassigned' | 'today'

export const MOBILE_HOME_BOARD_CHIP_IDS: MobileHomeBoardChipId[] = ['urgent', 'overdue', 'unassigned', 'today']

export const MOBILE_HOME_BOARD_CHIP_LABELS: Record<MobileHomeBoardChipId, string> = {
  urgent: 'Срочные',
  overdue: 'Просроченные',
  unassigned: 'Без исполнителя',
  today: 'Сегодня',
}

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
  return (ticket.assignedTechnicianId || ticket.assignedTechnician?.id || '').trim() === meId.trim()
}

/**
 * Ролевая семантика «Мои заявки»:
 * - TECHNICIAN: назначенные на текущего пользователя.
 * - Остальные роли: созданные текущим пользователем.
 */
export function isMineTicketForRole(
  ticket: TicketCard,
  meId: string | undefined,
  role: Role | undefined | null,
): boolean {
  if (!role || !meId) return false
  if (role === 'TECHNICIAN') return isTicketAssignedToMe(ticket, meId)
  return (ticket.createdByUserId || '').trim() === meId.trim()
}

export function isTicketInWorkStatus(ticket: TicketCard): boolean {
  return ticket.status === 'ASSIGNED' || ticket.status === 'IN_PROGRESS'
}

export function isNewTicket(ticket: TicketCard): boolean {
  return ticket.status === 'NEW'
}

export function isDoneTicket(ticket: TicketCard): boolean {
  return ticket.status === 'DONE'
}

/** Просроченные: SLA нарушен и заявка ещё в работе (не закрыта/не отменена). */
export function isOverdueTicket(ticket: TicketCard): boolean {
  if (ticket.status === 'DONE' || ticket.status === 'CANCELED') return false
  return ticket.slaBreached === true
}

function matchesMobileHomeTab(
  ticket: TicketCard,
  tab: MobileHomeBoardFilterTab,
  meId: string | undefined,
  role?: Role | null,
): boolean {
  switch (tab) {
    case 'all':
      return ticket.status !== 'DONE' && ticket.status !== 'CANCELED'
    case 'mine':
      return isMineTicketForRole(ticket, meId, role) && ticket.status !== 'DONE' && ticket.status !== 'CANCELED'
    case 'new':
      return isNewTicket(ticket)
    case 'in_work':
      return isTicketInWorkStatus(ticket)
    case 'overdue':
      return isOverdueTicket(ticket)
    case 'done':
      return isDoneTicket(ticket)
    default:
      return true
  }
}

export function filterTicketsForMobileHomeTab(
  cards: TicketCard[],
  tab: MobileHomeBoardFilterTab,
  meId: string | undefined,
  role?: Role | null,
): TicketCard[] {
  const list = dedupeBoardCards(cards)
  if (tab === 'all') return list
  return list.filter((t) => matchesMobileHomeTab(t, tab, meId, role))
}

export function mobileHomeBoardTabCounts(
  cards: TicketCard[],
  meId: string | undefined,
  role?: Role | null,
): Record<MobileHomeBoardFilterTab, number> {
  const list = dedupeBoardCards(cards)
  const counts = {
    all: 0,
    mine: 0,
    new: 0,
    in_work: 0,
    overdue: 0,
    done: 0,
  } as Record<MobileHomeBoardFilterTab, number>
  for (const tab of MOBILE_HOME_TABS) {
    counts[tab] = list.filter((t) => matchesMobileHomeTab(t, tab, meId, role)).length
  }
  return counts
}

export type MobileHomeTabEmptyCopy = { title: string; hint: string }

export type MobileHomeEmptyContext = {
  role?: Role | null
  /** Карточек на доске после дедупа */
  boardTotal: number
}

/** Текст пустого состояния вкладки главной (заголовок + подсказка). */
export function mobileHomeTabEmptyCopy(tab: MobileHomeBoardFilterTab, ctx?: MobileHomeEmptyContext): MobileHomeTabEmptyCopy {
  const tech = ctx?.role === 'TECHNICIAN'
  const total = ctx?.boardTotal ?? 0
  switch (tab) {
    case 'mine':
      return {
        title: tech ? 'Нет заявок на вас' : 'Нет созданных вами заявок',
        hint: tech
          ? 'Техник: здесь только заявки, назначенные на вас.'
          : 'Клиент: здесь только заявки, созданные вами.',
      }
    case 'in_work':
      return {
        title: 'Нет заявок в работе',
        hint: tech
          ? 'Здесь видны заявки со статусом «Назначена» и «В работе» по контуру. Если список пуст — либо всё закрыто, либо заявки ещё в статусе «Новые».'
          : 'Заявки со статусом «Назначена» или «В работе» — во вкладке «В работе».',
      }
    case 'new':
      return {
        title: 'Нет новых заявок',
        hint: 'Здесь только заявки в статусе «Новая». Когда появится новая заявка, она отобразится тут.',
      }
    case 'overdue':
      return {
        title: 'Нет просроченных заявок',
        hint: 'Здесь заявки с нарушенным SLA, которые ещё не закрыты. Пусто — значит сроки в норме.',
      }
    case 'done':
      return {
        title: 'Нет завершённых заявок',
        hint: 'Здесь недавно завершённые заявки. Полный архив доступен на десктопе во вкладке «Архив».',
      }
    default:
      if (total === 0) {
        return {
          title: 'Заявок пока нет',
          hint: tech
            ? 'Нет заявок в этом контуре. Возможно: нет активных заявок, не выбран клиентский контур или нет совпадений по вашим точкам/доступу. Обратитесь к администратору, если ожидали данные.'
            : 'Когда в контуре появятся заявки, список обновится автоматически.',
        }
      }
      return {
        title: 'Нет заявок по фильтру',
        hint: 'Переключите вкладку выше — например, «Все» или «Мои заявки».',
      }
  }
}

/** @deprecated Используйте mobileHomeTabEmptyCopy для подсказки; оставлено для совместимости. */
export function emptyMessageForMobileHomeTab(tab: MobileHomeBoardFilterTab): string {
  return mobileHomeTabEmptyCopy(tab).title
}

export type MobileMyTicketsFilterKey = 'active' | 'new' | 'archive'

/**
 * Архив в /m/my: история контура для provider/admin, личные — для TECH (assigned) и CLIENT (created).
 * Active/new остаются «мои» по ролевой семантике isMineTicketForRole.
 */
export function usesContourArchiveScope(role: Role | undefined | null): boolean {
  if (!role) return false
  if (role === 'TECHNICIAN' || role === 'CLIENT' || role === 'STAFF') return false
  return true
}

export function ticketsForMobileMyPage(
  allTickets: TicketCard[],
  filter: MobileMyTicketsFilterKey,
  meId: string | undefined,
  role: Role | undefined | null,
): TicketCard[] {
  const list = dedupeBoardCards(allTickets)
  if (filter === 'archive' && usesContourArchiveScope(role)) return list
  return list.filter((ticket) => isMineTicketForRole(ticket, meId, role))
}
