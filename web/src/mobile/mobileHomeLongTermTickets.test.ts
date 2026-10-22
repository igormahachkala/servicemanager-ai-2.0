import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TicketCard } from '../lib/api'
import { isLongTermTicket, LONG_TERM_TICKET_MIN_DAYS, plannedWorkDurationMs } from './mobileHomeBoardFilters'
import {
  filterTicketsByQuickFilter,
  MOBILE_HOME_QUICK_FILTER_LABELS,
  readPersistedMobileHomeBoardUi,
  toggleMobileHomeQuickFilter,
  writePersistedMobileHomeBoardUi,
  type MobileHomeQuickFilterContext,
} from './mobileHomeListUtils'
import type { MobileHomeQuickFilter } from './home/HomeQuickCards'

/**
 * Карточка «Долгосрочные заявки» на главной /m.
 *
 * Долгосрочная — активная заявка, у которой плановый срок выполнения
 * (plannedDueAt − createdAt) не меньше 10 суток. Не время до дедлайна
 * и не срок SLA.
 */

const DAY = 24 * 60 * 60 * 1000
const CREATED = '2026-10-01T09:00:00.000Z'

function at(base: string, ms: number): string {
  return new Date(Date.parse(base) + ms).toISOString()
}

function card(id: string, overrides: Partial<TicketCard> = {}): TicketCard {
  return {
    id,
    ticketNumber: Number(id.replace(/\D/g, '')) || 1,
    status: 'ASSIGNED',
    title: `Заявка ${id}`,
    description: '',
    createdAt: CREATED,
    slaDueAt: null,
    plannedDueAt: at(CREATED, 14 * DAY),
    priority: 'NORMAL',
    urgency: 'NOT_URGENT',
    slaBreached: false,
    assignedTechnicianId: 'tech-1',
    assignedTechnician: { id: 'tech-1', email: 'tech-1@test.local' },
    createdByUserId: 'creator',
    category: { id: 'cat', name: 'Холод' },
    location: { id: 'loc-a', name: 'Точка А', city: 'Уфа', address: null },
    ...overrides,
  } as TicketCard
}

const ctx: MobileHomeQuickFilterContext = {
  meId: 'tech-1',
  meRole: 'TECHNICIAN',
  canAssignProvider: false,
  reworkTicketIds: new Set(),
}

const ids = (tickets: TicketCard[]) => tickets.map((t) => t.id)

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('долгосрочная заявка: плановый срок выполнения от 10 суток', () => {
  it('порог — ровно 10 суток от регистрации, включительно', () => {
    expect(LONG_TERM_TICKET_MIN_DAYS).toBe(10)
    expect(isLongTermTicket(card('t1', { plannedDueAt: at(CREATED, 10 * DAY) }))).toBe(true)
    expect(isLongTermTicket(card('t2', { plannedDueAt: at(CREATED, 10 * DAY - 60_000) }))).toBe(false)
    expect(isLongTermTicket(card('t3', { plannedDueAt: at(CREATED, 45 * DAY) }))).toBe(true)
  })

  it('длительность — plannedDueAt минус createdAt', () => {
    expect(plannedWorkDurationMs(card('t1', { plannedDueAt: at(CREATED, 12 * DAY) }))).toBe(12 * DAY)
    expect(plannedWorkDurationMs(card('t2', { plannedDueAt: null }))).toBeNull()
    expect(plannedWorkDurationMs(card('t3', { plannedDueAt: 'не дата' }))).toBeNull()
    expect(plannedWorkDurationMs(card('t4', { createdAt: 'не дата' }))).toBeNull()
  })

  it('не время до дедлайна: результат не зависит от текущего момента', () => {
    // Создана давно, срок завтра: на работу отводилось 41 сутки — долгосрочная.
    const longButSoon = card('t1', { createdAt: '2026-09-01T09:00:00.000Z', plannedDueAt: '2026-10-12T09:00:00.000Z' })
    // Создана сегодня, срок через 3 дня: короткая, хотя «далеко» от старых заявок.
    const shortFresh = card('t2', { createdAt: '2026-10-11T09:00:00.000Z', plannedDueAt: '2026-10-14T09:00:00.000Z' })
    // Срок уже прошёл, но длительность 15 суток — по-прежнему долгосрочная.
    const longOverdue = card('t3', { createdAt: '2026-09-01T09:00:00.000Z', plannedDueAt: '2026-09-16T09:00:00.000Z' })

    for (const now of ['2026-09-02T00:00:00.000Z', '2026-10-11T12:00:00.000Z', '2027-01-01T00:00:00.000Z']) {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(now))
      expect([isLongTermTicket(longButSoon), isLongTermTicket(shortFresh), isLongTermTicket(longOverdue)]).toEqual([
        true,
        false,
        true,
      ])
      vi.useRealTimers()
    }
  })

  it('срок SLA не подменяет плановый срок', () => {
    expect(isLongTermTicket(card('t1', { plannedDueAt: null, slaDueAt: at(CREATED, 30 * DAY) }))).toBe(false)
    expect(isLongTermTicket(card('t2', { plannedDueAt: at(CREATED, 2 * DAY), slaDueAt: at(CREATED, 30 * DAY) }))).toBe(false)
  })

  it('DONE и CANCELED исключены, остальные статусы активны', () => {
    for (const status of ['DONE', 'CANCELED'] as const) {
      expect(isLongTermTicket(card('t', { status }))).toBe(false)
    }
    for (const status of ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_ACCEPTANCE', 'FIELD_COMPLETE'] as const) {
      expect(isLongTermTicket(card('t', { status }))).toBe(true)
    }
  })
})

describe('счётчик карточки и отфильтрованный список', () => {
  const board = [
    card('t1'),
    card('t2', { plannedDueAt: at(CREATED, 3 * DAY) }),
    card('t3', { status: 'DONE' }),
    card('t4', { status: 'CANCELED' }),
    card('t5', { plannedDueAt: null }),
    card('t6', { status: 'NEW', assignedTechnicianId: null, assignedTechnician: null, plannedDueAt: at(CREATED, 20 * DAY) }),
    card('t7', { status: 'AWAITING_ACCEPTANCE' }),
  ]

  it('считает только активные заявки со сроком от 10 суток', () => {
    expect(ids(filterTicketsByQuickFilter(board, 'longterm', ctx))).toEqual(['t1', 't6', 't7'])
  })

  it('заявка, пришедшая в board дважды, считается один раз', () => {
    expect(filterTicketsByQuickFilter([...board, card('t1')], 'longterm', ctx)).toHaveLength(3)
  })

  it('пустой board — ноль, карточка скрывается тем же правилом, что «На приёмке»', () => {
    expect(filterTicketsByQuickFilter([], 'longterm', ctx)).toEqual([])
  })

  it('«На приёмке» и остальные быстрые карты считают как раньше', () => {
    expect(ids(filterTicketsByQuickFilter(board, 'awaiting', ctx))).toEqual(['t7'])
    expect(ids(filterTicketsByQuickFilter(board, 'myaction', ctx))).toEqual(['t1', 't2', 't5', 't6'])
    expect(
      ids(filterTicketsByQuickFilter([card('t8', { status: 'IN_PROGRESS' })], 'rework', { ...ctx, reworkTicketIds: new Set(['t8']) })),
    ).toEqual(['t8'])
  })
})

describe('навигация по нажатию', () => {
  it('нажатие открывает выборку, повторное — закрывает, с другой карты — переключает', () => {
    expect(toggleMobileHomeQuickFilter(null, 'longterm')).toBe('longterm')
    expect(toggleMobileHomeQuickFilter('longterm', 'longterm')).toBeNull()
    expect(toggleMobileHomeQuickFilter('awaiting', 'longterm')).toBe('longterm')
  })

  it('у отфильтрованного списка есть заголовок', () => {
    expect(MOBILE_HOME_QUICK_FILTER_LABELS.longterm).toBe('Долгосрочные заявки')
    expect(MOBILE_HOME_QUICK_FILTER_LABELS.awaiting).toBe('На приёмке')
  })

  it('открытая выборка переживает возврат на главную через сохранённое состояние', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
      },
    })

    writePersistedMobileHomeBoardUi('all', [], 'longterm')
    expect(readPersistedMobileHomeBoardUi().quickFilter).toBe('longterm')

    store.set('sma.mobileHome.boardUi.v1', JSON.stringify({ tab: 'all', chips: [], quickFilter: 'longterm-ish' }))
    expect(readPersistedMobileHomeBoardUi().quickFilter).toBeNull()
  })
})

describe('разграничение доступа', () => {
  const quickFilters: Array<Exclude<MobileHomeQuickFilter, null>> = ['urgent', 'awaiting', 'longterm', 'myaction', 'rework']

  it('выборка — подмножество board: карточка не добавляет заявок сверх видимых', () => {
    const board = [card('t1'), card('t2', { status: 'NEW', assignedTechnicianId: null, assignedTechnician: null })]
    const visible = new Set(ids(board))
    for (const quickFilter of quickFilters) {
      for (const role of ['TECHNICIAN', 'CLIENT', 'ADMIN', 'DISPATCHER'] as const) {
        const result = filterTicketsByQuickFilter(board, quickFilter, { ...ctx, meRole: role, canAssignProvider: true })
        expect(ids(result).every((id) => visible.has(id))).toBe(true)
      }
    }
  })

  it('роль не меняет выборку долгосрочных: решает только board, суженный backend', () => {
    const board = [card('t1'), card('t2', { assignedTechnicianId: 'other', assignedTechnician: { id: 'other', email: 'o@test.local' } })]
    const byRole = (['TECHNICIAN', 'CLIENT', 'ADMIN'] as const).map((role) =>
      ids(filterTicketsByQuickFilter(board, 'longterm', { ...ctx, meRole: role })),
    )
    expect(byRole).toEqual([
      ['t1', 't2'],
      ['t1', 't2'],
      ['t1', 't2'],
    ])
  })
})
