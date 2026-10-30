import type { BoardResponse, TicketCard, TicketStatus } from './api'

/**
 * Карточка «Заявки старше 10 дней» на главной (мобильная /m и /dashboard).
 *
 * Правило считает сервер: board?olderThanDays=10 отдаёт незакрытые заявки,
 * созданные раньше 240 ч назад, в обычной видимости доски, а
 * meta.matchingTotal — точный счёт. Клиентская проверка isStaleTicket нужна
 * только без сети, когда есть лишь сохранённая доска.
 */
export const STALE_TICKET_AGE_DAYS = 10
export const STALE_TICKETS_TITLE = `Заявки старше ${STALE_TICKET_AGE_DAYS} дней`

/** Должен совпадать с STALE_TICKET_OPEN_STATUSES в backend/src/tickets/board-stale-tickets.ts. */
export const STALE_TICKET_OPEN_STATUSES: readonly TicketStatus[] = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_ACCEPTANCE']

const DAY_MS = 24 * 60 * 60 * 1000

export function isStaleTicket(card: Pick<TicketCard, 'status' | 'createdAt'>, nowMs: number, days = STALE_TICKET_AGE_DAYS): boolean {
  if (!STALE_TICKET_OPEN_STATUSES.includes(card.status)) return false
  const createdMs = Date.parse(card.createdAt)
  return !Number.isNaN(createdMs) && createdMs < nowMs - days * DAY_MS
}

/** Карточки ответа доски без повторов, в порядке колонок. */
export function staleBoardCards(data: BoardResponse | undefined): TicketCard[] {
  if (!data) return []
  const seen = new Set<string>()
  const out: TicketCard[] = []
  for (const column of data.columns) {
    for (const card of column.cards) {
      if (seen.has(card.id)) continue
      seen.add(card.id)
      out.push(card)
    }
  }
  return out
}

/** Точный счёт сервера; без него — сколько карточек пришло. */
export function staleBoardCount(data: BoardResponse | undefined): number {
  if (!data) return 0
  return typeof data.meta.matchingTotal === 'number' ? data.meta.matchingTotal : staleBoardCards(data).length
}

/** Параметр доски компьютера: /board?olderThanDays=10. */
export const STALE_BOARD_SEARCH_PARAM = 'olderThanDays'

export function readStaleBoardDays(search: string): number | undefined {
  const raw = new URLSearchParams(search).get(STALE_BOARD_SEARCH_PARAM)
  if (!raw || !/^\d{1,3}$/.test(raw)) return undefined
  const days = Number(raw)
  return days >= 1 && days <= 365 ? days : undefined
}

export function buildStaleBoardHref(scope: { linkedClientCompanyId?: string; companyId?: string }): string {
  const search = new URLSearchParams()
  if (scope.linkedClientCompanyId) search.set('linkedClientCompanyId', scope.linkedClientCompanyId)
  if (scope.companyId) search.set('companyId', scope.companyId)
  search.set(STALE_BOARD_SEARCH_PARAM, String(STALE_TICKET_AGE_DAYS))
  return `/board?${search.toString()}`
}
