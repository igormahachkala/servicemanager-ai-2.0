/**
 * SMA-WORK-CALENDAR-V1 — совместимость web с ответом backend PR #453 (4ba0e242).
 *
 * work-calendar.response.v1.json — эталон бэкенда (побайтовая копия).
 * workCalendar.scenarios.json — сценарии того же сервиса (см. __fixtures__/README.md).
 * Ответы идут тем же путём, что на странице: проверка контракта → пояс и
 * граница → фильтры → раскладка по дням → строки → ссылки.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import canonical from './__fixtures__/work-calendar.response.v1.json'
import scenarios from './__fixtures__/workCalendar.scenarios.json'
import {
  EMPTY_FILTERS,
  applyFilters,
  buildEmployeeRows,
  buildLocationRows,
  calendarRange,
  capabilityNotices,
  eventLinks,
  filterParams,
  splitByTiming,
  truncatedNotice,
} from './workCalendar'
import {
  WorkCalendarContractError,
  assertResponseMatchesRequest,
  buildWorkCalendarQuery,
  parseWorkCalendarResponse,
} from './workCalendarApi'

type Case = { actor: { role: string; companyId: string }; query: Record<string, string>; response: unknown }
const cases = scenarios.cases as unknown as Record<string, Case>
const PROVIDER = 'provider-1'

// Ответ, который тест намеренно портит: глубокий доступ без проверок типов.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>
const clone = (value: unknown) => structuredClone(value) as Raw

const previousTz = process.env.TZ
afterEach(() => {
  process.env.TZ = previousTz
})

/** Страница в браузере с поясом ответа: та же граница и тот же пояс. */
function load(name: string, view: 'day' | 'week' | 'month', anchor: [number, number, number]) {
  const c = cases[name]
  process.env.TZ = c.query.timezone
  const range = calendarRange(view, new Date(...anchor))
  const response = parseWorkCalendarResponse(clone(c.response))
  assertResponseMatchesRequest(response, { from: range.days[0], to: c.query.to, timezone: c.query.timezone }, range.from.toISOString())
  return { c, range, response }
}

/** Поля, которые читает web. Совпадение с эталоном — точное: и новое, и пропавшее поле видны. */
const FIELDS = {
  root: ['capabilities', 'events', 'meta', 'range', 'resources', 'version'],
  range: ['from', 'timezone', 'to'],
  capabilities: [
    'employeeDirectory',
    'inspections',
    'locationDirectory',
    'readOnly',
    'recurrenceProjection',
    'resources',
    'restrictedEmpty',
    'tickets',
    'timeWindows',
    'unscheduled',
  ],
  employee: ['companyId', 'displayName', 'eventCount', 'id', 'isActive', 'isExecutor', 'isOwnCompany', 'role'],
  location: ['address', 'city', 'clientCompanyId', 'eventCount', 'id', 'name'],
  event: [
    'clientCompanyId',
    'companyId',
    'employeeId',
    'entityId',
    'id',
    'inspection',
    'kind',
    'locationId',
    'recurrence',
    'scheduleId',
    'source',
    'status',
    'ticket',
    'ticketId',
    'timing',
    'title',
  ],
  timing: ['dueAt', 'endAt', 'hasWindow', 'localDate', 'mode', 'startAt'],
  recurrence: ['followingDueAt', 'frequency', 'intervalDays', 'isOverdue', 'nextDueAt', 'overdueAt'],
  ticket: ['parentId', 'priority', 'slaDueAt', 'ticketNumber', 'urgency'],
  inspection: ['lastRunId', 'templateName'],
  meta: ['generatedAt', 'limits', 'returned', 'scheduled', 'total', 'totalIsExact', 'truncated', 'truncatedSources', 'unscheduled'],
  returned: ['scheduled', 'total', 'unscheduled'],
}
const keys = (o: object) => Object.keys(o).sort()

describe('эталон бэкенда work-calendar.response.v1.json', () => {
  const backendPath = resolve(process.cwd(), '../backend/src/work-calendar/__fixtures__/work-calendar.response.v1.json')
  const backendPresent = existsSync(backendPath)

  // В ветке web файла бэкенда нет; после влития #453 и #454 проверка становится обязательной.
  it.skipIf(!backendPresent)('копия в web побайтово совпадает с файлом бэкенда', () => {
    const webPath = resolve(process.cwd(), 'src/lib/__fixtures__/work-calendar.response.v1.json')
    expect(readFileSync(webPath, 'utf8')).toBe(readFileSync(backendPath, 'utf8'))
  })

  it('round-trip: разбор ничего не теряет и не переименовывает', () => {
    const parsed = parseWorkCalendarResponse(clone(canonical))
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(canonical)
  })

  it('каждое поле эталона известно web, и каждое поле web есть в эталоне', () => {
    const r = canonical as unknown as Raw
    expect(keys(r)).toEqual(FIELDS.root)
    expect(keys(r.range)).toEqual(FIELDS.range)
    expect(keys(r.capabilities)).toEqual(FIELDS.capabilities)
    expect(keys(r.meta)).toEqual(FIELDS.meta)
    expect(keys(r.meta.returned)).toEqual(FIELDS.returned)
    for (const emp of r.resources.employees) expect(keys(emp)).toEqual(FIELDS.employee)
    for (const loc of r.resources.locations) expect(keys(loc)).toEqual(FIELDS.location)
    for (const e of r.events) {
      expect(keys(e)).toEqual(FIELDS.event)
      expect(keys(e.timing)).toEqual(FIELDS.timing)
      if (e.recurrence) expect(keys(e.recurrence)).toEqual(FIELDS.recurrence)
      if (e.ticket) expect(keys(e.ticket)).toEqual(FIELDS.ticket)
      if (e.inspection) expect(keys(e.inspection)).toEqual(FIELDS.inspection)
    }
    expect(r.events.map((e: Raw) => e.kind).sort()).toEqual(['INSPECTION', 'TICKET', 'TICKET'])
  })

  it('эталон проходит путь страницы: дни, строки, ссылки, раскрытие подрядчика', () => {
    process.env.TZ = 'Europe/Moscow'
    const range = calendarRange('week', new Date(2026, 9, 27))
    const response = parseWorkCalendarResponse(clone(canonical))
    assertResponseMatchesRequest(response, { from: '2026-10-26', to: '2026-11-02', timezone: 'Europe/Moscow' }, range.from.toISOString())

    const split = splitByTiming(response.events, range.days)
    expect(Object.fromEntries([...split.byDay].map(([d, l]) => [d, l.map((e) => e.ticket?.ticketNumber ?? e.title)]))).toEqual({
      '2026-10-27': [1042],
      '2026-10-29': ['ТО холодильного оборудования'],
    })
    expect(split.unscheduled.map((e) => e.ticket?.ticketNumber)).toEqual([1043])

    const employees = buildEmployeeRows(response, response.events, { filters: EMPTY_FILTERS, showEmpty: true })
    expect(employees.map((r) => [r.label, r.sublabel, r.events.length])).toEqual([
      ['Аксёнов Олег', 'Мастер', 0],
      ['Петров Иван', 'Техник', 2],
      ['Субподрядов Артём', 'Другая организация', 1],
      ['Нераспределённые', 'Исполнитель не назначен', 0],
    ])
    const locations = buildLocationRows(response, response.events, { filters: EMPTY_FILTERS, showEmpty: true })
    expect(locations.map((r) => [r.label, r.events.length])).toEqual([
      ['Магазин №14', 3],
      ['Склад «Восток»', 0],
    ])

    const [ticket, inspection] = response.events
    expect(eventLinks(ticket, {}, PROVIDER).primary?.to).toBe(
      '/tickets/bbbbbbbb-0000-4000-8000-000000000001?linkedClientCompanyId=client-a',
    )
    expect(eventLinks(inspection, {}, PROVIDER).primary?.to).toBe(
      '/inspection/schedules?linkedClientCompanyId=client-a&locationId=aaaaaaaa-0000-4000-8000-000000000001',
    )
  })
})

describe('нет тихой подстановки: несовместимый ответ — ошибка', () => {
  const broken: Array<[string, (r: Raw) => void, RegExp]> = [
    ['другая версия', (r) => (r.version = 2), /version = 1/],
    ['старое имя type вместо kind', (r) => ((r.events[0].type = r.events[0].kind), delete r.events[0].kind), /kind ∈ TICKET\|INSPECTION/],
    ['старое плоское scheduling вместо timing', (r) => delete r.events[0].timing, /events\[0\]\.timing/],
    ['нет localDate у DUE', (r) => (r.events[0].timing.localDate = null), /localDate YYYY-MM-DD/],
    [
      'пришло окно времени',
      (r) => ((r.events[0].timing.startAt = '2026-10-27T07:00:00.000Z'), (r.events[0].timing.hasWindow = true)),
      /hasWindow = false/,
    ],
    ['у обхода нет recurrence', (r) => (r.events[1].recurrence = null), /recurrence\{/],
    ['ticketId ≠ entityId', (r) => (r.events[0].ticketId = 'other'), /ticketId = entityId/],
    ['старые capabilities.eventTypes вместо tickets/inspections', (r) => delete r.capabilities.tickets, /capabilities\.tickets/],
    ['неизвестный источник обрезки', (r) => ((r.meta.truncated = true), (r.meta.truncatedSources = ['tickets'])), /truncatedSources/],
    ['truncated без источника', (r) => (r.meta.truncated = true), /truncated ⇔/],
    ['returned расходится с events', (r) => (r.meta.returned.total = 99), /returned\.total/],
    ['у объекта нет eventCount', (r) => delete r.resources.locations[0].eventCount, /resources\.locations\[0\]/],
    ['раскрыта роль подрядчика', (r) => (r.resources.employees[2].role = 'TECHNICIAN'), /другой компании .* должны быть null/],
    [
      'раскрыта компания подрядчика',
      (r) => (r.resources.employees[2].companyId = 'provider-secondary'),
      /другой компании .* должны быть null/,
    ],
  ]
  for (const [title, mutate, expected] of broken) {
    it(title, () => {
      const r = clone(canonical)
      mutate(r)
      expect(() => parseWorkCalendarResponse(r)).toThrow(WorkCalendarContractError)
      expect(() => parseWorkCalendarResponse(r)).toThrow(expected)
    })
  }

  it('лишнее новое поле контракт не ломает', () => {
    const r = clone(canonical)
    r.events[0].futureField = 1
    r.capabilities.somethingNew = true
    expect(() => parseWorkCalendarResponse(r)).not.toThrow()
  })

  it('пояс или граница ответа не совпали с запросом — ошибка, а не сдвиг суток', () => {
    const response = parseWorkCalendarResponse(clone(canonical))
    expect(() =>
      assertResponseMatchesRequest(response, { from: '2026-10-26', to: '2026-11-02', timezone: 'Asia/Yekaterinburg' }, response.range.from),
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

describe('сценарии сервиса (4ba0e242)', () => {
  it('сняты с того же коммита, что эталон, и все разбираются', () => {
    expect(scenarios.source).toMatchObject({ backendPr: 453, commit: '4ba0e24223a286b808757948e60ffdd6f26d1bf1' })
    expect(Object.keys(cases)).toHaveLength(12)
    for (const [name, c] of Object.entries(cases)) expect(() => parseWorkCalendarResponse(clone(c.response)), name).not.toThrow()
  })

  it('запросы сценариев строятся клиентом из фильтров один в один', () => {
    for (const c of Object.values(cases)) {
      const q = c.query
      const built = buildWorkCalendarQuery({
        from: q.from,
        to: q.to,
        timezone: q.timezone,
        linkedClientCompanyId: q.linkedClientCompanyId,
        eventTypes: q.eventTypes?.split(',') as never,
        statuses: q.statuses?.split(','),
        assigned: q.assigned as never,
        includeCompleted: q.includeCompleted ? q.includeCompleted === 'true' : undefined,
      })
      expect(Object.fromEntries(new URLSearchParams(built))).toEqual(q)
    }
  })
})

describe('раскладка по дням (Europe/Moscow)', () => {
  it('неделя: каждое событие в своих сутках по localDate; 22:30 UTC — на следующий день', () => {
    const { range, response } = load('dispatcherWeek', 'week', [2026, 9, 27])
    const split = splitByTiming(response.events, range.days)
    expect(Object.fromEntries([...split.byDay].map(([d, l]) => [d, l.map((e) => e.entityId)]))).toEqual({
      '2026-10-26': ['s-overdue'],
      '2026-10-27': ['t-assigned'],
      '2026-10-28': ['t-late', 's-planned'],
      '2026-10-29': ['s-running', 't-unassigned'],
      '2026-10-31': ['t-contractor'],
    })
    const late = response.events.find((e) => e.entityId === 't-late')!
    expect(late.timing.dueAt!.slice(0, 10)).toBe('2026-10-27')
    expect(late.timing.localDate).toBe('2026-10-28')
    expect(split.unscheduled.map((e) => e.entityId)).toEqual(['t-unscheduled'])
    expect(split.outside).toEqual([])
  })

  it('день и месяц', () => {
    const day = load('dispatcherDay', 'day', [2026, 9, 27])
    const daySplit = splitByTiming(day.response.events, day.range.days)
    expect([...daySplit.byDay.keys()]).toEqual(['2026-10-27'])
    expect(daySplit.unscheduled.map((e) => e.entityId)).toEqual(['t-unscheduled'])

    const month = load('dispatcherMonth', 'month', [2026, 9, 15])
    expect(month.range.days).toHaveLength(31)
    const monthSplit = splitByTiming(month.response.events, month.range.days)
    expect(monthSplit.outside).toEqual([])
    expect([...monthSplit.byDay.values()].flat().length + monthSplit.unscheduled.length).toBe(month.response.events.length)
  })
})

describe('DST: America/New_York, перевод часов 1 ноября 2026', () => {
  it('граница недели браузера совпадает с range сервера; 23:30 EST — в сутках 1 ноября', () => {
    const { range, response } = load('newYorkDstWeek', 'week', [2026, 9, 28])
    expect(range.from.toISOString()).toBe(response.range.from)
    expect(range.to.toISOString()).toBe(response.range.to)
    expect((range.to.getTime() - range.from.getTime()) / 3_600_000).toBe(169)
    const split = splitByTiming(response.events, range.days)
    expect(split.byDay.get('2026-11-01')?.map((e) => e.entityId)).toEqual(['t-dst'])
    expect(split.byDay.get('2026-10-30')?.map((e) => e.entityId)).toEqual(['t-before-dst'])
  })
})

describe('завершённые, типы, назначение — серверные параметры', () => {
  it('по умолчанию DONE/CANCELED нет ни на сервере, ни после фильтра; с флагом — есть', () => {
    const def = load('dispatcherWeek', 'week', [2026, 9, 27]).response
    expect(def.events.map((e) => e.status)).not.toContain('DONE')
    expect(def.events.map((e) => e.status)).not.toContain('CANCELED')
    const done = load('dispatcherWeekCompleted', 'week', [2026, 9, 27]).response
    expect(done.events.map((e) => e.entityId)).toEqual(expect.arrayContaining(['t-done', 't-canceled']))
    expect(applyFilters(done.events, EMPTY_FILTERS).map((e) => e.entityId)).not.toContain('t-done')
    expect(applyFilters(done.events, { ...EMPTY_FILTERS, includeCompleted: true })).toHaveLength(done.events.length)
  })

  it('statuses=DONE без флага сервер возвращает пусто — клиент такой запрос не строит', () => {
    expect(load('dispatcherWeekDoneWithoutFlag', 'week', [2026, 9, 27]).response.events).toEqual([])
    const sent = filterParams({ ...EMPTY_FILTERS, statuses: ['DONE'] })
    expect(sent).toMatchObject({ statuses: [], includeCompleted: false })
  })

  it('eventTypes=TICKET и assigned=unassigned сужают на сервере, фильтр поверх ничего не теряет', () => {
    const tickets = load('dispatcherWeekTickets', 'week', [2026, 9, 27]).response
    expect(tickets.events.every((e) => e.kind === 'TICKET')).toBe(true)
    expect(applyFilters(tickets.events, { ...EMPTY_FILTERS, eventTypes: ['TICKET'] })).toHaveLength(tickets.events.length)

    const unassigned = load('dispatcherWeekUnassigned', 'week', [2026, 9, 27]).response
    expect(unassigned.events.length).toBeGreaterThan(0)
    expect(unassigned.events.every((e) => e.employeeId === null)).toBe(true)
    expect(applyFilters(unassigned.events, { ...EMPTY_FILTERS, assigned: 'unassigned' })).toHaveLength(unassigned.events.length)
    const rows = buildEmployeeRows(unassigned, unassigned.events, {
      filters: { ...EMPTY_FILTERS, assigned: 'unassigned' },
      showEmpty: true,
    })
    expect(rows.map((r) => r.key)).toEqual(['unassigned'])
  })
})

describe('сотрудники и объекты без работ, раскрытие подрядчика', () => {
  it('сотрудник без событий — строка; подрядчик — без роли и компании', () => {
    const { response } = load('dispatcherWeek', 'week', [2026, 9, 27])
    const rows = buildEmployeeRows(response, response.events, { filters: EMPTY_FILTERS, showEmpty: true })
    expect(rows.map((r) => [r.label, r.sublabel, r.events.length])).toEqual([
      ['Аксёнов Олег', 'Мастер', 0],
      ['Петров Иван', 'Техник', 3],
      ['Смирнова Анна', 'Техник', 1],
      ['Субподрядов Артём', 'Другая организация', 1],
      ['Нераспределённые', 'Исполнитель не назначен', 3],
    ])
    const contractor = response.resources.employees.find((e) => !e.isOwnCompany)!
    expect(contractor).toMatchObject({ companyId: null, role: null, isActive: null, isExecutor: null })
    expect(JSON.stringify(rows.map((r) => [r.label, r.sublabel]))).not.toMatch(/provider-secondary|TECHNICIAN/)
  })

  it('объект без событий — строка из справочника сервера', () => {
    const { response } = load('dispatcherWeek', 'week', [2026, 9, 27])
    const rows = buildLocationRows(response, response.events, { filters: EMPTY_FILTERS, showEmpty: true })
    expect(rows.map((r) => [r.key, r.events.length])).toEqual([
      ['location:loc-a1', 6],
      ['location:loc-a2', 2],
      ['location:loc-a3', 0],
    ])
  })

  it('технику — только он сам, справочника объектов нет', () => {
    const { response } = load('technicianWeek', 'week', [2026, 9, 27])
    expect(response.resources.employees.map((e) => e.displayName)).toEqual(['Петров Иван'])
    expect(response.capabilities.locationDirectory).toBe(false)
  })
})

describe('ссылки по событиям сценария', () => {
  it('провайдер без области в адресе: заявка, план, последний обход — с linkedClientCompanyId клиента', () => {
    const { response } = load('dispatcherWeek', 'week', [2026, 9, 27])
    const ticket = response.events.find((e) => e.entityId === 't-assigned')!
    const running = response.events.find((e) => e.entityId === 's-running')!
    expect(eventLinks(ticket, {}, PROVIDER).primary?.to).toBe('/tickets/t-assigned?linkedClientCompanyId=client-a')
    expect(eventLinks(running, {}, PROVIDER)).toEqual({
      primary: { label: 'Открыть план обходов', to: '/inspection/schedules?linkedClientCompanyId=client-a&locationId=loc-a1' },
      lastRun: '/inspection/runs/run-1?linkedClientCompanyId=client-a',
      location: '/locations/loc-a1?linkedClientCompanyId=client-a',
    })
  })
})

describe('ограниченные capabilities и truncated', () => {
  it('нет LOCATIONS_VIEW: обходов и справочника объектов нет — предупреждения', () => {
    const { response } = load('noLocationsView', 'week', [2026, 9, 27])
    expect(response.events.some((e) => e.kind === 'INSPECTION')).toBe(false)
    expect(capabilityNotices(response.capabilities)).toEqual([
      'Планы обходов недоступны вашей роли: в календаре только заявки.',
      'Справочник объектов недоступен: строки — только объекты с работами.',
    ])
  })

  it('restricted-empty: пусто и объяснено', () => {
    const { response } = load('restrictedEmpty', 'week', [2026, 9, 27])
    expect(response.events).toEqual([])
    expect(capabilityNotices(response.capabilities)).toEqual([
      'У вас нет доступа ни к одному объекту в этом контуре — календарь пуст не потому, что работ нет.',
    ])
  })

  it('обрезка планов: total — нижняя граница, источник и лимит из meta', () => {
    const { response } = load('truncatedInspections', 'week', [2026, 9, 27])
    expect(response.meta).toMatchObject({ truncated: true, totalIsExact: false, truncatedSources: ['inspections'] })
    expect(truncatedNotice(response.meta)).toBe(
      'Показаны не все данные: работ в ответе 8 из не менее 8; обрезаны планы обходов — первые 500. Сократите период или уточните фильтры.',
    )
  })
})
