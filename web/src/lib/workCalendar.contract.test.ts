/**
 * SMA-WORK-CALENDAR-V1 — совместимость web с ответом backend PR #453.
 *
 * Ответы в fixture вернул настоящий WorkCalendarService (см.
 * __fixtures__/README.md). Тест прогоняет их через тот же путь, что и
 * страница: проверка контракта → проверка пояса и границы → фильтры →
 * раскладка по дням → строки → ссылки.
 */
import { afterEach, describe, expect, it } from 'vitest'

import fixture from './__fixtures__/workCalendar.contract.json'
import {
  EMPTY_FILTERS,
  applyFilters,
  buildEmployeeRows,
  buildLocationRows,
  calendarRange,
  capabilityNotices,
  eventLinks,
  requestStatuses,
  splitByTiming,
  truncatedNotice,
} from './workCalendar'
import {
  WorkCalendarContractError,
  assertResponseMatchesRequest,
  buildWorkCalendarQuery,
  parseWorkCalendarResponse,
  type WorkCalendarResponse,
} from './workCalendarApi'

type Case = { actor: { role: string }; query: Record<string, string>; response: unknown }
const cases = fixture.cases as unknown as Record<string, Case>
const PROVIDER = 'provider-1'

const previousTz = process.env.TZ
afterEach(() => {
  process.env.TZ = previousTz
})

/** Страница в браузере с поясом ответа: та же граница и тот же пояс. */
function load(name: string, view: 'day' | 'week' | 'month', anchor: [number, number, number]) {
  const c = cases[name]
  process.env.TZ = c.query.timezone
  const range = calendarRange(view, new Date(...anchor))
  const response = parseWorkCalendarResponse(structuredClone(c.response))
  assertResponseMatchesRequest(response, { from: range.days[0], to: c.query.to, timezone: c.query.timezone }, range.from.toISOString())
  return { c, range, response }
}

// Ответ, который тест намеренно портит: глубокий доступ без проверок типов.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>
const clone = (name: string) => structuredClone(cases[name].response) as Raw

describe('fixture', () => {
  it('снят с backend PR #453 и разбирается без ошибок во всех случаях', () => {
    expect(fixture.source).toMatchObject({ backendPr: 453, commit: 'a301a98181f044deeee22df270e44ef1deec2078' })
    expect(Object.keys(cases).length).toBeGreaterThanOrEqual(10)
    for (const [name, c] of Object.entries(cases)) {
      expect(() => parseWorkCalendarResponse(structuredClone(c.response)), name).not.toThrow()
    }
  })

  it('параметры запросов fixture — те, что строит клиент', () => {
    for (const c of Object.values(cases)) {
      const built = new URLSearchParams(
        buildWorkCalendarQuery({
          from: c.query.from,
          to: c.query.to,
          timezone: c.query.timezone,
          linkedClientCompanyId: c.query.linkedClientCompanyId,
          types: c.query.types?.split(',') as never,
          statuses: c.query.statuses?.split(','),
        }),
      )
      expect(Object.fromEntries(built)).toEqual(c.query)
    }
  })
})

describe('нет тихой подстановки: несовместимый ответ — ошибка', () => {
  const broken: Array<[string, (r: Raw) => void, RegExp]> = [
    ['нет capabilities.eventTypes', (r) => delete r.capabilities.eventTypes, /capabilities\.eventTypes/],
    [
      'старое имя поля kind вместо type',
      (r) => ((r.events[0].kind = r.events[0].type), delete r.events[0].type),
      /type ∈ TICKET\|INSPECTION/,
    ],
    ['нет localDate у SCHEDULED', (r) => (r.events[1].localDate = null), /localDate YYYY-MM-DD/],
    [
      'пришло окно времени',
      (r) => ((r.events[1].startAt = '2026-10-27T07:00:00.000Z'), (r.events[1].hasWindow = true)),
      /hasWindow = false/,
    ],
    ['неизвестный источник обрезки', (r) => ((r.meta.truncated = true), (r.meta.truncatedSources = ['tickets'])), /truncatedSources/],
    ['truncated без источника', (r) => (r.meta.truncated = true), /truncated ⇔/],
    ['нет meta.counts', (r) => delete r.meta.counts, /meta\.counts/],
    ['сотрудник без isOwnCompany', (r) => delete r.resources.employees[0].isOwnCompany, /resources\.employees\[0\]/],
    ['у обхода нет inspection', (r) => delete r.events[0].inspection, /inspection\{/],
    ['events не массив', (r) => (r.events = {}), /events\[\]/],
  ]
  for (const [title, mutate, expected] of broken) {
    it(title, () => {
      const r = clone('dispatcherWeek')
      mutate(r)
      expect(() => parseWorkCalendarResponse(r)).toThrow(WorkCalendarContractError)
      expect(() => parseWorkCalendarResponse(r)).toThrow(expected)
    })
  }

  it('лишнее новое поле контракт не ломает', () => {
    const r = clone('dispatcherWeek')
    r.events[0].futureField = 1
    r.capabilities.somethingNew = true
    expect(() => parseWorkCalendarResponse(r)).not.toThrow()
  })

  it('пояс или граница ответа не совпали с запросом — ошибка, а не сдвиг суток', () => {
    process.env.TZ = 'Europe/Moscow'
    const response = parseWorkCalendarResponse(clone('dispatcherWeek'))
    const range = calendarRange('week', new Date(2026, 9, 27))
    expect(() =>
      assertResponseMatchesRequest(
        response,
        { from: '2026-10-26', to: '2026-11-02', timezone: 'Asia/Yekaterinburg' },
        range.from.toISOString(),
      ),
    ).toThrow(/range\.timezone/)
    expect(() =>
      assertResponseMatchesRequest(
        response,
        { from: '2026-10-26', to: '2026-11-02', timezone: 'Europe/Moscow' },
        '2026-10-26T00:00:00.000Z',
      ),
    ).toThrow(/range\.from/)
  })
})

describe('раскладка заявок и обходов по дням (Europe/Moscow)', () => {
  it('неделя: каждое событие в своих сутках по localDate; поздний срок по UTC — на следующий день', () => {
    const { range, response } = load('dispatcherWeek', 'week', [2026, 9, 27])
    expect(range.days).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
    const split = splitByTiming(response.events, range.days)
    const byDay = Object.fromEntries([...split.byDay].map(([day, list]) => [day, list.map((e) => e.sourceId)]))
    expect(byDay).toEqual({
      '2026-10-26': ['s-overdue'],
      '2026-10-27': ['t-assigned'],
      '2026-10-28': ['t-late', 's-planned'],
      '2026-10-29': ['s-running', 't-unassigned'],
      '2026-10-30': ['t-done', 't-canceled'],
      '2026-10-31': ['t-foreign-exec'],
    })
    const late = response.events.find((e) => e.sourceId === 't-late')!
    expect(late.dueAt!.slice(0, 10)).toBe('2026-10-27')
    expect(late.localDate).toBe('2026-10-28')
    expect(split.unscheduled.map((e) => e.sourceId)).toEqual(['t-unscheduled'])
    expect(split.outside).toEqual([])
  })

  it('день: один столбец, задача без даты — в своей секции', () => {
    const { range, response } = load('dispatcherDay', 'day', [2026, 9, 27])
    const split = splitByTiming(response.events, range.days)
    expect([...split.byDay.keys()]).toEqual(['2026-10-27'])
    expect(split.byDay.get('2026-10-27')!.map((e) => e.sourceId)).toEqual(['t-assigned'])
    expect(split.unscheduled.map((e) => e.sourceId)).toEqual(['t-unscheduled'])
    expect(split.outside).toEqual([])
  })

  it('месяц: 31 столбец, все события внутри', () => {
    const { range, response } = load('dispatcherMonth', 'month', [2026, 9, 15])
    expect(range.days).toHaveLength(31)
    const split = splitByTiming(response.events, range.days)
    expect(split.outside).toEqual([])
    expect([...split.byDay.values()].flat()).toHaveLength(response.events.length - split.unscheduled.length)
  })
})

describe('DST: America/New_York, перевод часов 1 ноября 2026', () => {
  it('граница недели браузера совпадает с range.from сервера; 23:30 EST — в сутках 1 ноября', () => {
    const { range, response } = load('newYorkDstWeek', 'week', [2026, 9, 28])
    expect(range.from.toISOString()).toBe(response.range.from)
    expect(range.to.toISOString()).toBe(response.range.to)
    expect((range.to.getTime() - range.from.getTime()) / 3_600_000).toBe(169)
    const split = splitByTiming(response.events, range.days)
    expect(split.byDay.get('2026-11-01')?.map((e) => e.sourceId)).toEqual(['t-dst'])
    expect(split.byDay.get('2026-10-30')?.map((e) => e.sourceId)).toEqual(['t-before-dst'])
    expect(split.outside).toEqual([])
  })
})

describe('сотрудники и объекты', () => {
  it('сотрудник без событий — строка; чужой исполнитель видимой заявки подписан; нераспределённые отдельно', () => {
    const { response } = load('dispatcherWeek', 'week', [2026, 9, 27])
    const events = applyFilters(response.events, { ...EMPTY_FILTERS, includeCompleted: true })
    const rows = buildEmployeeRows(response, events, { filters: EMPTY_FILTERS, showEmpty: true })
    expect(rows.map((r) => [r.label, r.sublabel, r.events.map((e) => e.sourceId)])).toEqual([
      ['Аксёнов Олег', '', []],
      ['Петров Иван', '', ['t-assigned', 's-planned', 's-running', 't-done']],
      ['Смирнова Анна', '', ['t-late']],
      ['Сотрудник Чужой', 'Другая организация', ['t-foreign-exec']],
      ['Нераспределённые', 'Исполнитель не назначен', ['s-overdue', 't-unassigned', 't-canceled', 't-unscheduled']],
    ])
  })

  it('объекты — из resources.locations; сервер V1 отдаёт только объекты с работами', () => {
    const { response } = load('dispatcherWeek', 'week', [2026, 9, 27])
    const rows = buildLocationRows(response, response.events, { filters: EMPTY_FILTERS, showEmpty: true })
    expect(rows.map((r) => [r.key, r.label, r.sublabel])).toEqual([
      ['location:loc-a1', 'А1', 'Уфа'],
      ['location:loc-a2', 'А2', 'Уфа'],
    ])
    expect(rows.every((r) => r.events.length > 0)).toBe(true)
    expect(rows.reduce((n, r) => n + r.events.length, 0)).toBe(response.events.length)
  })

  it('технику — только он сам', () => {
    const { response } = load('technicianWeek', 'week', [2026, 9, 27])
    expect(response.resources.employees.map((e) => e.displayName)).toEqual(['Петров Иван'])
  })
})

describe('фильтры поверх ответа', () => {
  it('«Завершённые» выключены: запрос без DONE/CANCELED даёт тот же набор, что фильтр на полном ответе', () => {
    const full = load('dispatcherWeek', 'week', [2026, 9, 27]).response
    const active = load('dispatcherWeekActiveStatuses', 'week', [2026, 9, 27])
    // Случай fixture снят ровно с тем statuses, который клиент шлёт по умолчанию.
    expect(active.c.query.statuses.split(',')).toEqual(requestStatuses(EMPTY_FILTERS))
    const ids = (r: WorkCalendarResponse['events']) => r.map((e) => e.sourceId).sort()
    expect(ids(applyFilters(full.events, EMPTY_FILTERS))).toEqual(ids(active.response.events))
    expect(ids(active.response.events)).not.toContain('t-done')
    expect(ids(active.response.events)).not.toContain('t-canceled')
  })

  it('types=TICKET: обходов нет и на сервере, и после фильтра', () => {
    const { response } = load('dispatcherWeekTicketsOnly', 'week', [2026, 9, 27])
    expect(response.events.every((e) => e.type === 'TICKET')).toBe(true)
    expect(applyFilters(response.events, { ...EMPTY_FILTERS, types: ['TICKET'], includeCompleted: true })).toHaveLength(
      response.events.length,
    )
  })

  it('assigned (только в интерфейсе) делит ответ на назначенные и нет без потерь', () => {
    const { response } = load('dispatcherWeek', 'week', [2026, 9, 27])
    const base = { ...EMPTY_FILTERS, includeCompleted: true }
    const a = applyFilters(response.events, { ...base, assigned: 'assigned' })
    const u = applyFilters(response.events, { ...base, assigned: 'unassigned' })
    expect(a.length + u.length).toBe(response.events.length)
    expect(u.every((e) => e.employeeId === null)).toBe(true)
  })
})

describe('ссылки по событиям fixture', () => {
  it('провайдер без области в адресе: заявка и план — с linkedClientCompanyId клиента объекта', () => {
    const { response } = load('dispatcherWeek', 'week', [2026, 9, 27])
    const ticket = response.events.find((e) => e.sourceId === 't-assigned')!
    const running = response.events.find((e) => e.sourceId === 's-running')!
    expect(eventLinks(ticket, {}, PROVIDER).primary?.to).toBe('/tickets/t-assigned?linkedClientCompanyId=client-a')
    expect(eventLinks(running, {}, PROVIDER)).toEqual({
      primary: { label: 'Открыть план обходов', to: '/inspection/schedules?linkedClientCompanyId=client-a&locationId=loc-a1' },
      lastRun: '/inspection/runs/run-1?linkedClientCompanyId=client-a',
      location: '/locations/loc-a1?linkedClientCompanyId=client-a',
    })
  })
})

describe('ограниченные capabilities', () => {
  it('нет LOCATIONS_VIEW: обходов нет, предупреждение, а не пустота', () => {
    const { response } = load('noLocationsView', 'week', [2026, 9, 27])
    expect(response.capabilities.eventTypes.INSPECTION).toBe(false)
    expect(response.events.some((e) => e.type === 'INSPECTION')).toBe(false)
    expect(capabilityNotices(response.capabilities)).toEqual(['Планы обходов недоступны вашей роли: в календаре только заявки.'])
  })

  it('restricted-empty: пусто и объяснено', () => {
    const { response } = load('restrictedEmpty', 'week', [2026, 9, 27])
    expect(response.events).toEqual([])
    expect(buildEmployeeRows(response, [], { filters: EMPTY_FILTERS, showEmpty: true }).map((r) => r.key)).toEqual(['unassigned'])
    expect(capabilityNotices(response.capabilities)).toEqual([
      'У вас нет доступа ни к одному объекту в этом контуре — календарь пуст не потому, что работ нет.',
    ])
  })

  it('обрезка планов обходов — предупреждение с лимитом сервера', () => {
    const { response } = load('truncatedInspections', 'week', [2026, 9, 27])
    expect(truncatedNotice(response.meta)).toBe(
      'Показаны не все данные: планы обходов — первые 500. Сократите период или уточните фильтры.',
    )
  })
})
