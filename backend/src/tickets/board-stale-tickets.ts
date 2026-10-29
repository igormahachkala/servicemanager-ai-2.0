import { Prisma, TicketStatus } from '@prisma/client'

/**
 * Карточка «Заявки старше 10 дней» на главной.
 *
 * Старая заявка — незакрытая (DONE и CANCELED не в счёт; на приёмке работа
 * ещё не закрыта) и созданная раньше, чем olderThanDays × 24 ч назад.
 * Отсчёт по часам сервера, чтобы счётчик не зависел от часов устройства.
 */
export const STALE_TICKET_OPEN_STATUSES: readonly TicketStatus[] = [
  TicketStatus.NEW,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
  TicketStatus.AWAITING_ACCEPTANCE,
]

const DAY_MS = 24 * 60 * 60 * 1000

export function staleTicketCreatedBefore(now: Date, olderThanDays: number): Date {
  return new Date(now.getTime() - olderThanDays * DAY_MS)
}

/** Строго раньше границы: заявка ровно 10-дневной давности ещё не старая. */
export function buildStaleTicketWhere(now: Date, olderThanDays: number): Prisma.TicketWhereInput {
  return {
    status: { in: [...STALE_TICKET_OPEN_STATUSES] },
    createdAt: { lt: staleTicketCreatedBefore(now, olderThanDays) },
  }
}
