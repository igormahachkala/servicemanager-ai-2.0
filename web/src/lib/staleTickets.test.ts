import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { BoardResponse, TicketCard } from './api'
import { applyTicketInvalidation } from '../ui/useWsInvalidation'
import {
  buildStaleBoardHref,
  isStaleTicket,
  readStaleBoardDays,
  STALE_TICKET_OPEN_STATUSES,
  STALE_TICKETS_TITLE,
  staleBoardCards,
  staleBoardCount,
} from './staleTickets'

const NOW = Date.parse('2026-10-29T12:00:00.000Z')
const HOUR = 60 * 60 * 1000

function card(id: string, status: TicketCard['status'], ageHours: number): TicketCard {
  return {
    id,
    companyId: 'c1',
    title: id,
    status,
    urgency: 'NORMAL',
    createdAt: new Date(NOW - ageHours * HOUR).toISOString(),
    slaDueAt: null,
    slaBreached: false,
    isChild: false,
    category: { id: 'cat', name: 'cat' },
    assignedTechnician: null,
  } as TicketCard
}

function board(cards: TicketCard[], matchingTotal?: number): BoardResponse {
  return {
    columns: [{ status: 'NEW', total: cards.length, sla: { breached: 0, atRisk: 0 }, cards }],
    meta: { totalTickets: cards.length, atRiskThresholdMinutes: 60, limitedToLast: 500, ...(matchingTotal === undefined ? {} : { matchingTotal }) },
  } as BoardResponse
}

describe('isStaleTicket', () => {
  it('граница 240 ч строгая', () => {
    expect(isStaleTicket(card('a', 'NEW', 240), NOW)).toBe(false)
    expect(isStaleTicket(card('a', 'NEW', 240.01), NOW)).toBe(true)
    expect(isStaleTicket(card('a', 'NEW', 239), NOW)).toBe(false)
  })

  it('закрытые не считаются, на приёмке — считается', () => {
    expect(isStaleTicket(card('a', 'DONE', 500), NOW)).toBe(false)
    expect(isStaleTicket(card('a', 'CANCELED', 500), NOW)).toBe(false)
    for (const status of ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_ACCEPTANCE'] as const) {
      expect(isStaleTicket(card('a', status, 500), NOW)).toBe(true)
    }
  })

  it('неразборчивая дата — не старая', () => {
    expect(isStaleTicket({ status: 'NEW', createdAt: 'x' }, NOW)).toBe(false)
  })
})

describe('счёт карточки', () => {
  it('берёт точный счёт сервера, а не число пришедших карточек', () => {
    expect(staleBoardCount(board([card('a', 'NEW', 300)], 742))).toBe(742)
  })

  it('без matchingTotal — число карточек без повторов', () => {
    const a = card('a', 'NEW', 300)
    const data = board([a, a, card('b', 'NEW', 300)])
    expect(staleBoardCards(data).map((c) => c.id)).toEqual(['a', 'b'])
    expect(staleBoardCount(data)).toBe(2)
    expect(staleBoardCount(undefined)).toBe(0)
  })
})

describe('адрес доски компьютера', () => {
  it('ссылка карточки несёт скоуп и olderThanDays=10', () => {
    expect(buildStaleBoardHref({})).toBe('/board?olderThanDays=10')
    expect(buildStaleBoardHref({ linkedClientCompanyId: 'L1' })).toBe('/board?linkedClientCompanyId=L1&olderThanDays=10')
    expect(buildStaleBoardHref({ companyId: 'C1' })).toBe('/board?companyId=C1&olderThanDays=10')
  })

  it('доска читает только допустимые значения', () => {
    expect(readStaleBoardDays('?olderThanDays=10')).toBe(10)
    expect(readStaleBoardDays('?linkedClientCompanyId=L1&olderThanDays=10')).toBe(10)
    for (const bad of ['', '?olderThanDays=', '?olderThanDays=0', '?olderThanDays=366', '?olderThanDays=1.5', '?olderThanDays=abc', '?olderThanDays=-3']) {
      expect(readStaleBoardDays(bad)).toBeUndefined()
    }
  })

  it('заголовок карточки', () => {
    expect(STALE_TICKETS_TITLE).toBe('Заявки старше 10 дней')
  })
})

describe('обновление без перезагрузки', () => {
  it('событие заявки по WebSocket помечает устаревшими оба счётчика', () => {
    const qc = new QueryClient()
    qc.setQueryData(['mobile-home-stale-board', 'L1', ''], board([]))
    qc.setQueryData(['dashboard-stale-board', 'L1', ''], board([]))
    applyTicketInvalidation(qc, 't1')
    expect(qc.getQueryState(['mobile-home-stale-board', 'L1', ''])?.isInvalidated).toBe(true)
    expect(qc.getQueryState(['dashboard-stale-board', 'L1', ''])?.isInvalidated).toBe(true)
  })

  /** Ключи запросов, которые инвалидирует тест выше, должны быть настоящими ключами экранов. */
  it.each([
    ['mobile/home/MobileHome.tsx', 'mobile-home-stale-board'],
    ['components/dashboard/StaleTicketsCard.tsx', 'dashboard-stale-board'],
  ])('%s грузит доску с olderThanDays под ключом %s', (file, key) => {
    const code = readFileSync(resolve(__dirname, '..', file), 'utf8')
    expect(code).toMatch(new RegExp(`queryKey: \\['${key}',[^\\]]*\\],\\s*\\n?\\s*queryFn: \\(\\) =>[\\s\\S]{0,300}?api\\.board\\([\\s\\S]{0,300}?olderThanDays: STALE_TICKET_AGE_DAYS`))
  })
})

describe('правило совпадает с сервером', () => {
  it('те же незакрытые статусы, что в backend/src/tickets/board-stale-tickets.ts', () => {
    const backend = readFileSync(resolve(__dirname, '../../../backend/src/tickets/board-stale-tickets.ts'), 'utf8')
    const start = backend.indexOf('= [', backend.indexOf('export const STALE_TICKET_OPEN_STATUSES'))
    const block = backend.slice(start, backend.indexOf(']', start))
    const statuses = [...block.matchAll(/TicketStatus\.([A-Z_]+)/g)].map((m) => m[1])
    expect(statuses).toEqual([...STALE_TICKET_OPEN_STATUSES])
  })
})
