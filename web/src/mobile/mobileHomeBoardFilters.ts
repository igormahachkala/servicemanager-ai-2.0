import type { Role, TicketCard } from '../lib/api'

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

export type MobileHomeTabEmptyCopy = { title: string; hint: string }

export type MobileHomeEmptyContext = {
  role?: Role | null
  /** Карточек на доске после дедупа */
  boardTotal: number
  /** Сколько NEW без исполнителя на всей доске */
  newUnassignedOnBoard: number
}

/** Текст пустого состояния вкладки главной (заголовок + подсказка). */
export function mobileHomeTabEmptyCopy(tab: MobileHomeBoardFilterTab, ctx?: MobileHomeEmptyContext): MobileHomeTabEmptyCopy {
  const tech = ctx?.role === 'TECHNICIAN'
  const total = ctx?.boardTotal ?? 0
  const newOnBoard = ctx?.newUnassignedOnBoard ?? 0

  switch (tab) {
    case 'new':
      if (total === 0) {
        return {
          title: 'Нет доступных заявок',
          hint: tech
            ? 'В выбранном контуре сейчас нет заявок. Если ожидали увидеть список: проверьте клиентский контур в шапке, обновите экран позже или обратитесь к администратору.'
            : 'Новые необработанные заявки в выбранном контуре появятся здесь после появления данных.',
        }
      }
      if (newOnBoard === 0) {
        return {
          title: 'Новых необработанных заявок нет',
          hint: tech
            ? 'На доске есть заявки в других статусах — загляните во «Все» или «В работе». Новые без исполнителя появятся здесь, когда их создадут в этом контуре.'
            : 'Новые заявки без исполнителя сейчас отсутствуют. Проверьте другие вкладки или фильтры в веб-версии.',
        }
      }
      return {
        title: 'Новых заявок нет',
        hint: 'Новые необработанные заявки в выбранном контуре появятся здесь.',
      }
    case 'mine':
      return {
        title: 'Нет заявок на вас',
        hint: tech
          ? 'После того как вас назначат исполнителем (или вы возьмёте заявку самостоятельно), она появится здесь. Начните с вкладки «Новые».'
          : 'После назначения исполнителем заявки отобразятся во вкладке «Мои».',
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
        hint: 'Переключите вкладку выше — например, «Новые» или «Мои».',
      }
  }
}

/** @deprecated Используйте mobileHomeTabEmptyCopy для подсказки; оставлено для совместимости. */
export function emptyMessageForMobileHomeTab(tab: MobileHomeBoardFilterTab): string {
  return mobileHomeTabEmptyCopy(tab).title
}
