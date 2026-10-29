import { TicketStatus } from '@prisma/client'

import { buildStaleTicketWhere, staleTicketCreatedBefore } from './board-stale-tickets'

describe('board-stale-tickets', () => {
  const now = new Date('2026-10-29T12:00:00.000Z')

  it('граница — ровно olderThanDays × 24 ч назад', () => {
    expect(staleTicketCreatedBefore(now, 10).toISOString()).toBe('2026-10-19T12:00:00.000Z')
  })

  it('строго раньше границы и только незакрытые статусы', () => {
    expect(buildStaleTicketWhere(now, 10)).toEqual({
      status: {
        in: [
          TicketStatus.NEW,
          TicketStatus.ASSIGNED,
          TicketStatus.IN_PROGRESS,
          TicketStatus.AWAITING_ACCEPTANCE,
        ],
      },
      createdAt: { lt: new Date('2026-10-19T12:00:00.000Z') },
    })
  })
})
