import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { InspectionSchedule } from '../lib/api'
import * as api from '../lib/api'
import { MobileInspectionTodayPage } from './MobileInspectionTodayPage'
import { TODAY_SCHEDULE_LIMIT_NOTE, todayWindow } from './mobileInspectionToday'

type QueryOptions = { queryKey: unknown[]; queryFn: () => Promise<unknown>; staleTime?: number }
type QueryResult = {
  data?: InspectionSchedule[]
  isLoading?: boolean
  isPending?: boolean
  isError?: boolean
  refetch: () => void
}
const fixture = vi.hoisted(() => ({
  online: true,
  queries: [] as QueryOptions[],
  today: { data: [], refetch: vi.fn() } as QueryResult,
  previous: { data: [], refetch: vi.fn() } as QueryResult,
}))

vi.mock('../lib/api', () => ({
  me: vi.fn(), board: vi.fn(), getInspectionSchedules: vi.fn(), startInspectionRun: vi.fn(),
}))
vi.mock('./offline/useOffline', () => ({ useOfflineStatus: () => ({ online: fixture.online }) }))
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: QueryOptions) => {
    fixture.queries.push(options)
    if (options.queryKey[0] === 'mobile-inspection-today') {
      return options.queryKey[1] === 'previous' ? fixture.previous : fixture.today
    }
    return { data: undefined }
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
}))

function schedule(id: string, dayOffset: number, overrides: Partial<InspectionSchedule> = {}): InspectionSchedule {
  const date = new Date()
  date.setDate(date.getDate() + dayOffset)
  date.setHours(9, 0, 0, 0)
  return {
    id, companyId: 'provider', name: id, nextDueAt: date.toISOString(), startDate: date.toISOString(),
    frequency: 'DAILY', graceDays: 0, leadTimeDays: 0, isActive: true,
    createdAt: date.toISOString(), updatedAt: date.toISOString(), isOverdue: dayOffset < 0,
    template: { id: 'template', name: 'Тип обхода' }, location: { id: 'location', name: `Объект ${id}`, address: 'Адрес' },
    ...overrides,
  }
}

function render(path = '/m/inspection/today') {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] }, createElement(MobileInspectionTodayPage)))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 29, 12))
  vi.clearAllMocks()
  fixture.online = true
  fixture.queries = []
  fixture.today = { data: [], refetch: vi.fn() }
  fixture.previous = { data: [], refetch: vi.fn() }
})

afterEach(() => vi.useRealTimers())

describe('mobile Today previous visits presentation', () => {
  it('renders yesterday and today in different sections with the original date and server overdue label', () => {
    fixture.today.data = [schedule('today', 0)]
    fixture.previous.data = [schedule('yesterday', -1), schedule('grace', -2, { graceDays: 3, isOverdue: false })]
    const html = render()
    const todaySection = html.indexOf('aria-label="На сегодня"')
    expect(html).toContain('aria-label="Незавершённые прошлых дней"')
    expect(html.indexOf('Объект yesterday')).toBeLessThan(todaySection)
    expect(html.indexOf('Объект today')).toBeGreaterThan(todaySection)
    expect(html).toContain('Плановая дата:')
    expect(html).toContain('Просрочен')
    expect(html).toContain('В пределах льготного срока')
    expect(html).toContain(TODAY_SCHEDULE_LIMIT_NOTE)
  })

  it('requests disjoint active-only periods without an employee-id access imitation', async () => {
    render()
    const requests = fixture.queries.filter((query) => query.queryKey[0] === 'mobile-inspection-today')
    expect(requests).toHaveLength(2)
    for (const query of requests) await query.queryFn()
    const window = todayWindow()
    expect(api.getInspectionSchedules).toHaveBeenNthCalledWith(1, { from: window.from, to: window.to, active: true })
    expect(api.getInspectionSchedules).toHaveBeenNthCalledWith(2, { to: new Date(Date.parse(window.from) - 1).toISOString(), active: true })
    // Do not reuse a just-completed run for five seconds when returning from it.
    expect(requests.every((query) => query.staleTime === 0)).toBe(true)
  })

  it('keeps today visible and warns when a full 200-row backlog was returned', () => {
    fixture.today.data = [schedule('today', 0)]
    fixture.previous.data = Array.from({ length: 200 }, (_, i) => schedule(`old-${i}`, -1))
    const html = render()
    expect(html).toContain('Объект today')
    expect(html).toContain('Достигнут лимит 200 планов за этот период')
    expect(html).toContain('Другие визиты могут не отображаться')
  })

  it('does not promise a complete empty list when scope filtering may hide the API cap', () => {
    const html = render()
    expect(html).toContain(TODAY_SCHEDULE_LIMIT_NOTE)
    expect(html).toContain('В загруженном списке нет незавершённых визитов прошлых дней')
    expect(html).not.toContain('На сегодня обходов не запланировано')
  })

  it('shows an independent retry error for either failed period and preserves the other', () => {
    fixture.previous = { isError: true, refetch: vi.fn() }
    fixture.today.data = [schedule('today', 0)]
    let html = render()
    expect(html).toContain('Не удалось загрузить предыдущие визиты')
    expect(html).toContain('Повторить')
    expect(html).toContain('Объект today')
    expect(html).not.toContain('В загруженном списке нет незавершённых')
    fixture.today = { isError: true, refetch: vi.fn() }
    fixture.previous = { data: [schedule('previous', -1)], refetch: vi.fn() }
    html = render()
    expect(html).toContain('Не удалось загрузить план на сегодня')
    expect(html).toContain('Объект previous')
  })

  it('preserves cached cards with a stale-data notice if a refresh fails', () => {
    fixture.previous = { data: [schedule('cached', -1)], isError: true, refetch: vi.fn() }
    const html = render()
    expect(html).toContain('Ниже показаны ранее загруженные данные')
    expect(html).toContain('Объект cached')
  })

  it('shows one period while the other is loading, without claiming the pending period is empty', () => {
    fixture.previous = { isLoading: true, isPending: true, refetch: vi.fn() }
    fixture.today.data = [schedule('today', 0)]
    const html = render()
    expect(html).toContain('Загружаем предыдущие визиты')
    expect(html).toContain('Объект today')
    expect(html).not.toContain('В загруженном списке нет незавершённых')
  })

  it('resumes an existing previous run using both mobile roots, including offline', () => {
    fixture.online = false
    fixture.previous.data = [schedule('running', -1, { lastRun: { id: 'existing-run', status: 'IN_PROGRESS' } })]
    for (const root of ['/m', '/max']) {
      const html = render(`${root}/inspection/today`)
      expect(html).toContain(`href="${root}/inspection/existing-run"`)
      expect(html).toContain('Продолжить')
      expect(html).toContain('Начать новый обход можно только онлайн')
    }
  })

  it('explains an offline period without cached data instead of showing a false empty plan', () => {
    fixture.online = false
    fixture.previous = { isPending: true, isLoading: false, refetch: vi.fn() }
    const html = render()
    expect(html).toContain('Нет сохранённых данных за этот период')
    expect(html).not.toContain('В загруженном списке нет незавершённых')
  })

  it('disables new runs offline and excludes completed, inactive and future stale rows', () => {
    fixture.online = false
    const done = schedule('done', -1)
    fixture.previous.data = [
      schedule('pending', -1),
      schedule('inactive', -1, { isActive: false }),
      { ...done, lastRun: { id: 'run', status: 'COMPLETED', dueAt: done.nextDueAt } },
      schedule('future', 1),
    ]
    const html = render()
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Начать обход<\/button>/)
    expect(html).not.toContain('Объект inactive')
    expect(html).not.toContain('Объект done')
    expect(html).not.toContain('Объект future')
  })

  it('does not render the same plan twice across period snapshots', () => {
    fixture.today.data = [schedule('moved', 0)]
    fixture.previous.data = [schedule('moved', -1)]
    expect(render().match(/Объект moved/g)).toHaveLength(1)
  })
})
