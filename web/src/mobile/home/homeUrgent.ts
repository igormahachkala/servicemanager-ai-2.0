import type { TicketCard, TicketStatus } from '../../lib/api'
import { dedupeBoardCards } from '../mobileHomeBoardFilters'

/**
 * SMA-MOBILE-HOME — ЕДИНЫЙ canonical-предикат срочности для всей Главной.
 *
 * «Срочная» = реально срочная заявка (priority ИЛИ urgency === URGENT) и ещё
 * в работе (NEW/ASSIGNED/IN_PROGRESS) — «требует реакции сейчас», НЕ SLA-warning.
 *
 * Один и тот же предикат используют: счётчик и превью операционной карточки
 * «Срочные заявки», список после «Все срочные» (urgent quick-filter) и
 * «Срочные» chip (mobileHomeListUtils). Второй urgent-engine не вводится;
 * источник — уже загруженные board-данные, нового backend нет.
 */
const ACTIVE_STATUSES: ReadonlySet<TicketStatus> = new Set<TicketStatus>(['NEW', 'ASSIGNED', 'IN_PROGRESS'])

export function isHomeUrgentTicket(ticket: TicketCard): boolean {
  const urgent = (ticket.priority ?? 'NORMAL') === 'URGENT' || ticket.urgency === 'URGENT'
  return urgent && ACTIVE_STATUSES.has(ticket.status)
}

export function selectHomeUrgentTickets(cards: TicketCard[] | null | undefined): TicketCard[] {
  if (!cards || cards.length === 0) return []
  return dedupeBoardCards(cards).filter(isHomeUrgentTicket)
}

export const HOME_URGENT_PREVIEW_MAX = 3

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
