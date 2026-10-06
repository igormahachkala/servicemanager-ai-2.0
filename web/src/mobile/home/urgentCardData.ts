import type { TicketCard, TicketStatus } from '../../lib/api'
import { dedupeBoardCards } from '../mobileHomeBoardFilters'
import { isUrgentTicket } from '../mobileHomeListUtils'

/**
 * SMA-MOBILE-HOME — операционная карточка «Срочные заявки». Использует уже
 * загруженные board-данные и canonical-предикат срочности (isUrgentTicket:
 * priority/urgency === URGENT). Новый backend/источник не вводится.
 * Для операционной карточки берём срочные В РАБОТЕ (требуют реакции сейчас).
 */
const ACTIVE_STATUSES: ReadonlySet<TicketStatus> = new Set<TicketStatus>(['NEW', 'ASSIGNED', 'IN_PROGRESS'])

export const HOME_URGENT_PREVIEW_MAX = 3

export function selectHomeUrgentTickets(cards: TicketCard[] | null | undefined): TicketCard[] {
  if (!cards || cards.length === 0) return []
  return dedupeBoardCards(cards).filter((t) => isUrgentTicket(t) && ACTIVE_STATUSES.has(t.status))
}

/** Короткий возраст заявки по createdAt: «5 мин», «2 ч», «3 дн». Нет данных → ''. */
export function formatTicketAgeShort(createdAt?: string | null, nowMs: number = Date.now()): string {
  if (!createdAt) return ''
  const started = Date.parse(createdAt)
  if (Number.isNaN(started)) return ''
  const minutes = Math.max(0, Math.floor((nowMs - started) / 60000))
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч`
  return `${Math.floor(hours / 24)} дн`
}
