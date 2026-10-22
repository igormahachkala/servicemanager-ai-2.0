import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildLongTermTicketsQuery, type LongTermTicketsResponse, type TicketCard } from '../lib/api'
import {
  filterTicketsByQuickFilter,
  longTermTicketsTotal,
  mergeLongTermTicketPages,
  MOBILE_HOME_QUICK_FILTER_LABELS,
  readPersistedMobileHomeBoardUi,
  toggleMobileHomeQuickFilter,
  writePersistedMobileHomeBoardUi,
  type MobileHomeQuickFilterContext,
} from './mobileHomeListUtils'

/**
 * Карточка «Долгосрочные заявки» на главной /m.
 *
 * Правило (plannedDueAt − createdAt ≥ 240 ч, только активные) и доступ решает
 * GET /tickets/long-term по всему контуру; здесь — как главная пользуется
 * его страницами: счётчик, список, догрузка, навигация.
 */

function card(id: string, overrides: Partial<TicketCard> = {}): TicketCard {
  return {
    id,
    ticketNumber: Number(id.replace(/\D/g, '')) || 1,
    status: 'ASSIGNED',
    title: `Заявка ${id}`,
    description: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    slaDueAt: null,
    plannedDueAt: '2026-02-01T00:00:00.000Z',
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

function page(ids: string[], total: number, nextCursor: string | null = null): LongTermTicketsResponse {
  return { total, items: ids.map((id) => card(id)), nextCursor, limit: 50 }
}

const ctx: MobileHomeQuickFilterContext = {
  meId: 'tech-1',
  meRole: 'TECHNICIAN',
  canAssignProvider: false,
  reworkTicketIds: new Set(),
}

const ids = (tickets: TicketCard[]) => tickets.map((t) => t.id)

afterEach(() => vi.unstubAllGlobals())

describe('счётчик — серверный total', () => {
  it('берётся из ответа, а не из числа загруженных строк', () => {
    expect(longTermTicketsTotal([page(['t1', 't2'], 734, 'c1')])).toBe(734)
    expect(longTermTicketsTotal([page(['t1'], 734, 'c1'), page(['t2'], 734)])).toBe(734)
  })

  it('нет ответа — ноль, карточка скрыта, как «На приёмке» при нуле', () => {
    expect(longTermTicketsTotal(undefined)).toBe(0)
    expect(longTermTicketsTotal([])).toBe(0)
  })

  it('не зависит от board: при пустом board счётчик тот же', () => {
    expect(filterTicketsByQuickFilter([], 'awaiting', ctx)).toEqual([])
    expect(longTermTicketsTotal([page([], 12)])).toBe(12)
  })
})

describe('список и догрузка страниц', () => {
  it('страницы склеиваются в порядке сервера', () => {
    expect(ids(mergeLongTermTicketPages([page(['a', 'b'], 4, 'c1'), page(['c', 'd'], 4)]))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('повтор страницы (refetch, двойной тап) не дублирует заявки', () => {
    expect(ids(mergeLongTermTicketPages([page(['a', 'b'], 3, 'c1'), page(['b', 'c'], 3), page(['c'], 3)]))).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('пустой ответ — пустой список', () => {
    expect(mergeLongTermTicketPages(undefined)).toEqual([])
  })
})

describe('запрос страницы', () => {
  it('передаёт контур тем параметром, которым он пришёл, и курсор страницы', () => {
    expect(buildLongTermTicketsQuery({ limit: 50 })).toBe('?limit=50')
    expect(buildLongTermTicketsQuery({ limit: 50, cursor: 'abc', linkedClientCompanyId: 'client-1' })).toBe(
      '?limit=50&cursor=abc&linkedClientCompanyId=client-1',
    )
    expect(buildLongTermTicketsQuery({ companyId: 'observed-1' })).toBe('?companyId=observed-1')
  })

  it('linkedClientCompanyId важнее companyId, пустые параметры не уходят', () => {
    expect(buildLongTermTicketsQuery({ linkedClientCompanyId: 'client-1', companyId: 'observed-1' })).toBe(
      '?linkedClientCompanyId=client-1',
    )
    expect(buildLongTermTicketsQuery({ cursor: null })).toBe('')
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

describe('остальные карточки не изменились', () => {
  const board = [
    card('t1'),
    card('t2', { status: 'AWAITING_ACCEPTANCE' }),
    card('t3', { status: 'NEW', assignedTechnicianId: null, assignedTechnician: null }),
    card('t4', { status: 'IN_PROGRESS' }),
  ]

  it('«На приёмке», «Требует действия», «Требуют доработки» считают по board как раньше', () => {
    expect(ids(filterTicketsByQuickFilter(board, 'awaiting', ctx))).toEqual(['t2'])
    expect(ids(filterTicketsByQuickFilter(board, 'myaction', ctx))).toEqual(['t1', 't3', 't4'])
    expect(ids(filterTicketsByQuickFilter(board, 'rework', { ...ctx, reworkTicketIds: new Set(['t4']) }))).toEqual(['t4'])
  })

  it('board-выборки не выходят за board и дубли считаются один раз', () => {
    const visible = new Set(ids(board))
    for (const quickFilter of ['urgent', 'awaiting', 'myaction', 'rework'] as const) {
      const result = filterTicketsByQuickFilter([...board, card('t1')], quickFilter, {
        ...ctx,
        reworkTicketIds: new Set(['t4']),
      })
      expect(ids(result).every((id) => visible.has(id))).toBe(true)
      expect(new Set(ids(result)).size).toBe(result.length)
    }
  })
})
