import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { TicketCard } from '../../lib/api'
import { formatTicketAgeShort, HOME_URGENT_PREVIEW_MAX, selectHomeUrgentTickets } from './urgentCardData'

/**
 * SMA-MOBILE-HOME — операционная карточка «Срочные заявки» + blue Materials.
 * Чистая логика + source-contract (окружение node).
 */

const card = (id: string, opts: Partial<TicketCard> = {}): TicketCard =>
  ({ id, status: 'NEW', priority: 'NORMAL', urgency: 'NOT_URGENT', ticketNumber: 1, createdAt: new Date().toISOString(), ...opts } as unknown as TicketCard)

describe('selectHomeUrgentTickets', () => {
  it('берёт только срочные (priority ИЛИ urgency === URGENT) и в работе', () => {
    const cards = [
      card('a', { priority: 'URGENT', status: 'NEW' }),
      card('b', { urgency: 'URGENT', status: 'IN_PROGRESS' }),
      card('c', { priority: 'URGENT', status: 'ASSIGNED' }),
      card('d', { priority: 'URGENT', status: 'DONE' }),
      card('e', { priority: 'URGENT', status: 'AWAITING_ACCEPTANCE' }),
      card('f', { priority: 'URGENT', status: 'CANCELED' }),
      card('g', { priority: 'NORMAL', urgency: 'NOT_URGENT', status: 'NEW' }),
    ]
    expect(selectHomeUrgentTickets(cards).map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('дедуплицирует по id', () => {
    expect(selectHomeUrgentTickets([card('a', { priority: 'URGENT' }), card('a', { priority: 'URGENT' })]).map((t) => t.id)).toEqual(['a'])
  })

  it('пустой/нулевой вход → []', () => {
    expect(selectHomeUrgentTickets([])).toEqual([])
    expect(selectHomeUrgentTickets(null)).toEqual([])
    expect(selectHomeUrgentTickets(undefined)).toEqual([])
  })

  it('count корректный (несколько срочных)', () => {
    const cards = [card('a', { priority: 'URGENT' }), card('b', { priority: 'URGENT' }), card('c', { priority: 'URGENT' })]
    expect(selectHomeUrgentTickets(cards).length).toBe(3)
  })
})

describe('formatTicketAgeShort', () => {
  const base = Date.parse('2026-10-06T12:00:00.000Z')
  it('мин/часы/дни', () => {
    expect(formatTicketAgeShort('2026-10-06T12:00:00.000Z', base)).toBe('0 мин')
    expect(formatTicketAgeShort('2026-10-06T11:45:00.000Z', base)).toBe('15 мин')
    expect(formatTicketAgeShort('2026-10-06T09:00:00.000Z', base)).toBe('3 ч')
    expect(formatTicketAgeShort('2026-10-04T12:00:00.000Z', base)).toBe('2 дн')
  })
  it('нет данных/битое → пустая строка', () => {
    expect(formatTicketAgeShort(null, base)).toBe('')
    expect(formatTicketAgeShort(undefined, base)).toBe('')
    expect(formatTicketAgeShort('не-дата', base)).toBe('')
  })
})

describe('Source-contract: Home operational cards', () => {
  const read = (p: string) => readFileSync(join(__dirname, p), 'utf8')

  it('максимум превью срочных = 3', () => {
    expect(HOME_URGENT_PREVIEW_MAX).toBe(3)
    expect(read('HomeUrgentCard.tsx')).toContain('tickets.slice(0, HOME_URGENT_PREVIEW_MAX)')
  })

  it('пустой список срочных → карточка не рендерится', () => {
    expect(read('HomeUrgentCard.tsx')).toContain('if (!tickets.length) return null')
  })

  it('«Все срочные →» ведёт в canonical urgent-фильтр (urgent chip), не во второй flow', () => {
    const s = read('MobileHome.tsx')
    expect(s).toContain('<HomeUrgentCard')
    expect(s).toContain('onViewAll={showAllUrgent}')
    expect(s).toContain("new Set<MobileHomeBoardChipId>(['urgent'])")
    // превью-строки ведут в существующий ticket flow
    expect(read('HomeUrgentCard.tsx')).toContain('to={ticketHref(ticket)}')
  })

  it('Materials: canonical flow сохранён, добавлен синий visual state, без изменения доступа', () => {
    const s = read('MobileHome.tsx')
    expect(s).toContain('getMobileMaterialsEntry(meQ.data, location.pathname)')
    expect(s).toContain('mobileHomeQuickCard--blue')
    // без нового источника/доступа — вход прежний
    expect(s).toContain('navigate(materialsHomeHref)')
  })
})
