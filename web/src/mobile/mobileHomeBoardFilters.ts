import type { Role, TicketCard } from '../lib/api'

export type MobileHomeBoardFilterTab = 'all' | 'mine' | 'in_work'

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

export function filterTicketsForMobileHomeTab(
  cards: TicketCard[],
  tab: MobileHomeBoardFilterTab,
  meId: string | undefined,
  role?: Role | null,
): TicketCard[] {
  const list = dedupeBoardCards(cards)
  if (tab === 'all') return list
  if (tab === 'mine') return list.filter((t) => isMineTicketForRole(t, meId, role))
  if (tab === 'in_work') return list.filter(isTicketInWorkStatus)
  return list
}

export function mobileHomeBoardTabCounts(cards: TicketCard[], meId: string | undefined, role?: Role | null) {
  const list = dedupeBoardCards(cards)
  return {
    all: list.length,
    mine: list.filter((t) => isMineTicketForRole(t, meId, role)).length,
    in_work: list.filter(isTicketInWorkStatus).length,
  }
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
