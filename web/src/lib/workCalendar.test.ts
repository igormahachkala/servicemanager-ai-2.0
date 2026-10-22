/**
 * SMA-WORK-CALENDAR-V1 — правила отображения календаря работ (unit).
 * Совместимость с ответом бэкенда — workCalendar.contract.test.ts.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  EMPTY_FILTERS,
  STATUS_OPTIONS,
  anchorFromSearch,
  applyFilters,
  buildEmployeeRows,
  buildLocationRows,
  calendarRange,
  capabilityNotices,
  dueChipLabel,
  dueFullLabel,
  eventDueAt,
  eventLinks,
  eventScope,
  isServerOverdue,
  requestStatuses,
  shiftAnchor,
  splitByTiming,
  truncatedNotice,
  type CalendarFilters,
} from './workCalendar'
import { buildWorkCalendarQuery, type WorkCalendarCapabilities, type WorkCalendarEvent, type WorkCalendarResponse } from './workCalendarApi'
import { isManagementNavItemVisible, railSectionIdForPath } from './navigation'
import { matchManagementRoute, validateManagementRoutes } from './managementRouteMeta'

function event(overrides: Partial<WorkCalendarEvent> & { id: string }): WorkCalendarEvent {
  return {
    type: 'TICKET',
    sourceId: overrides.id,
    title: `Работа ${overrides.id}`,
    status: 'ASSIGNED',
    scheduling: 'SCHEDULED',
    dueAt: '2026-10-21T08:00:00.000Z',
    localDate: '2026-10-21',
    startAt: null,
    endAt: null,
    hasWindow: false,
    employeeId: 'emp-1',
    locationId: 'loc-1',
    clientCompanyId: 'client-a',
    ticket: { ticketNumber: 1, urgency: 'NOT_URGENT', priority: 'NORMAL', slaDueAt: null, parentId: null },
    ...overrides,
  }
}

const unscheduled = (id: string, extra: Partial<WorkCalendarEvent> = {}) =>
  event({ id, scheduling: 'UNSCHEDULED', dueAt: null, localDate: null, ...extra })

const inspectionPart = (patch: Partial<NonNullable<WorkCalendarEvent['inspection']>> = {}) => ({
  frequency: 'MONTHLY',
  intervalDays: null,
  templateName: null,
  overdueAt: '2026-10-21T08:00:00Z',
  isOverdue: false,
  followingDueAt: null,
  lastRunId: null,
  ...patch,
})

const resources = (
  employees: Array<[string, string, boolean?]>,
  locations: Array<[string, string]> = [],
): Pick<WorkCalendarResponse, 'resources'> => ({
  resources: {
    employees: employees.map(([id, displayName, own = true]) => ({ id, displayName, firstName: null, lastName: null, isOwnCompany: own })),
    locations: locations.map(([id, name]) => ({ id, name, city: null, address: null, clientCompanyId: 'client-a' })),
  },
})

const filters = (patch: Partial<CalendarFilters> = {}): CalendarFilters => ({ ...EMPTY_FILTERS, ...patch })

const caps = (patch: Partial<WorkCalendarCapabilities> = {}): WorkCalendarCapabilities => ({
  readOnly: true,
  eventTypes: { TICKET: true, INSPECTION: true },
  unscheduled: true,
  timeWindows: false,
  recurrenceProjection: false,
  employeeRoster: true,
  restrictedEmpty: false,
  ...patch,
})

describe('диапазон [from, to)', () => {
  it('день, неделя с понедельника, месяц — от локальной полуночи', () => {
    const anchor = new Date(2026, 9, 22, 15, 30) // четверг
    const day = calendarRange('day', anchor)
    expect(day.days).toEqual(['2026-10-22'])
    expect(day.to).toEqual(new Date(2026, 9, 23))

    const week = calendarRange('week', anchor)
    expect(week.days).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'])
    expect(week.to).toEqual(new Date(2026, 9, 26))
    expect(calendarRange('week', new Date(2026, 9, 25)).days[0]).toBe('2026-10-19')

    expect(calendarRange('month', anchor).days).toHaveLength(31)
    expect(calendarRange('month', new Date(2026, 1, 10)).days).toHaveLength(28)
    expect(calendarRange('month', new Date(2028, 1, 10)).days).toHaveLength(29)
  })

  it('соседний период; месяц от 31 января не перепрыгивает февраль', () => {
    expect(shiftAnchor('day', new Date(2026, 9, 31), 1)).toEqual(new Date(2026, 10, 1))
    expect(shiftAnchor('week', new Date(2026, 9, 22), -1)).toEqual(new Date(2026, 9, 15))
    expect(shiftAnchor('month', new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 1))
  })

  it('?date= — только корректная дата', () => {
    expect(anchorFromSearch('2026-10-27')).toEqual(new Date(2026, 9, 27))
    for (const bad of ['2026-02-30', '27.10.2026', '', null, '2026-10-27T00:00']) expect(anchorFromSearch(bad)).toBeNull()
  })
})

describe('переход на зимнее время (Europe/Berlin, 25.10.2026)', () => {
  const previousTz = process.env.TZ
  beforeAll(() => {
    process.env.TZ = 'Europe/Berlin'
  })
  afterAll(() => {
    process.env.TZ = previousTz
  })

  it('неделя — 7 суток от полуночи до полуночи, в неделе 169 часов', () => {
    const week = calendarRange('week', new Date(2026, 9, 22))
    expect(week.days).toHaveLength(7)
    expect(week.from.toISOString()).toBe('2026-10-18T22:00:00.000Z')
    expect(week.to.toISOString()).toBe('2026-10-25T23:00:00.000Z')
    expect((week.to.getTime() - week.from.getTime()) / 3_600_000).toBe(169)
  })

  it('день перевода часов — 25 часов, граница следующих суток в полночь', () => {
    const day = calendarRange('day', new Date(2026, 9, 25, 12))
    expect(day.days).toEqual(['2026-10-25'])
    expect(day.to.getHours()).toBe(0)
    expect((day.to.getTime() - day.from.getTime()) / 3_600_000).toBe(25)
  })
})

describe('время события: срок, а не слот', () => {
  it('срок только у SCHEDULED', () => {
    expect(eventDueAt(event({ id: 'a' }))?.toISOString()).toBe('2026-10-21T08:00:00.000Z')
    expect(eventDueAt(unscheduled('b'))).toBeNull()
  })

  it('подпись — «срок HH:mm» в поясе ответа; дата — localDate сервера', () => {
    const e = event({ id: 'a' })
    expect(dueChipLabel(e, 'Asia/Yekaterinburg')).toBe('срок 13:00')
    expect(dueChipLabel(e, 'UTC')).toBe('срок 08:00')
    expect(dueChipLabel(unscheduled('b'), 'UTC')).toBe('')
    expect(dueFullLabel(unscheduled('b'), 'UTC')).toBe('Без плановой даты')
    // 22:30 UTC 27-го в Москве — 28-е: дата берётся из localDate, а не из UTC.
    const late = event({ id: 'late', dueAt: '2026-10-27T22:30:00.000Z', localDate: '2026-10-28' })
    expect(dueFullLabel(late, 'Europe/Moscow')).toMatch(/^до 28 октября 2026 г\., 01:30$/)
  })

  it('раскладка по localDate: по дням, «без времени», за границей — ничего не теряется', () => {
    const events = [
      event({ id: 'late', dueAt: '2026-10-21T15:00:00Z', localDate: '2026-10-21' }),
      event({ id: 'early', dueAt: '2026-10-21T06:00:00Z', localDate: '2026-10-21' }),
      // UTC-дата 21-е, но сервер отнёс к 22-му — верим серверу.
      event({ id: 'zoned', dueAt: '2026-10-21T20:00:00Z', localDate: '2026-10-22' }),
      event({ id: 'far', dueAt: '2026-12-01T06:00:00Z', localDate: '2026-12-01' }),
      unscheduled('none'),
    ]
    const split = splitByTiming(events, ['2026-10-21', '2026-10-22'])
    expect(split.byDay.get('2026-10-21')?.map((e) => e.id)).toEqual(['early', 'late'])
    expect(split.byDay.get('2026-10-22')?.map((e) => e.id)).toEqual(['zoned'])
    expect(split.unscheduled.map((e) => e.id)).toEqual(['none'])
    expect(split.outside.map((e) => e.id)).toEqual(['far'])
  })

  it('просрочка — только inspection.isOverdue с сервера', () => {
    expect(isServerOverdue(event({ id: 'p', dueAt: '2000-01-01T00:00:00Z', localDate: '2000-01-01' }))).toBe(false)
    const insp = event({
      id: 'i',
      type: 'INSPECTION',
      status: 'OVERDUE',
      ticket: undefined,
      inspection: inspectionPart({ isOverdue: true }),
    })
    expect(isServerOverdue(insp)).toBe(true)
  })
})

describe('фильтры', () => {
  const events = [
    event({ id: 't1', employeeId: 'emp-1', locationId: 'loc-1', status: 'NEW' }),
    event({ id: 't2', employeeId: null, locationId: 'loc-2', status: 'ASSIGNED' }),
    event({ id: 'done', status: 'DONE' }),
    event({ id: 'canceled', status: 'CANCELED', employeeId: null }),
    event({
      id: 'i1',
      type: 'INSPECTION',
      employeeId: 'emp-2',
      locationId: 'loc-1',
      status: 'PLANNED',
      ticket: undefined,
      inspection: inspectionPart(),
    }),
    unscheduled('u1', { employeeId: 'emp-1', locationId: 'loc-3' }),
  ]
  const ids = (list: WorkCalendarEvent[]) => list.map((e) => e.id)

  it('«Завершённые» выключены — DONE и CANCELED не запрашиваются и не показываются', () => {
    expect(requestStatuses(filters())).toEqual([
      'NEW',
      'ASSIGNED',
      'IN_PROGRESS',
      'AWAITING_ACCEPTANCE',
      'FIELD_COMPLETE',
      'PLANNED',
      'OVERDUE',
    ])
    expect(requestStatuses(filters({ includeCompleted: true }))).toBeUndefined()
    expect(requestStatuses(filters({ statuses: ['DONE'] }))).toEqual(['DONE'])
    expect(ids(applyFilters(events, filters()))).toEqual(['t1', 't2', 'i1', 'u1'])
    expect(ids(applyFilters(events, filters({ includeCompleted: true })))).toEqual(['t1', 't2', 'done', 'canceled', 'i1', 'u1'])
  })

  it('каждый фильтр по отдельности', () => {
    const all = { includeCompleted: true }
    expect(ids(applyFilters(events, filters({ ...all, employeeIds: ['emp-1'] })))).toEqual(['t1', 'done', 'u1'])
    expect(ids(applyFilters(events, filters({ ...all, locationIds: ['loc-1'] })))).toEqual(['t1', 'done', 'canceled', 'i1'])
    expect(ids(applyFilters(events, filters({ ...all, types: ['INSPECTION'] })))).toEqual(['i1'])
    expect(ids(applyFilters(events, filters({ statuses: ['NEW', 'PLANNED'] })))).toEqual(['t1', 'i1'])
    expect(ids(applyFilters(events, filters({ ...all, assigned: 'unassigned' })))).toEqual(['t2', 'canceled'])
    expect(ids(applyFilters(events, filters({ ...all, assigned: 'assigned' })))).toEqual(['t1', 'done', 'i1', 'u1'])
    expect(ids(applyFilters(events, filters({ ...all, includeUnscheduled: false })))).toEqual(['t1', 't2', 'done', 'canceled', 'i1'])
  })

  it('результат — всегда подмножество ответа', () => {
    const combos: Partial<CalendarFilters>[] = [
      { employeeIds: ['emp-9'] },
      { locationIds: ['loc-1'], types: ['TICKET'] },
      { statuses: ['DONE'] },
    ]
    for (const combo of combos) for (const e of applyFilters(events, filters(combo))) expect(events).toContain(e)
  })

  it('статусы фильтра — ровно те, что принимает сервер', () => {
    expect(STATUS_OPTIONS).toEqual([
      'NEW',
      'ASSIGNED',
      'IN_PROGRESS',
      'AWAITING_ACCEPTANCE',
      'FIELD_COMPLETE',
      'DONE',
      'CANCELED',
      'PLANNED',
      'OVERDUE',
    ])
  })
})

describe('строки', () => {
  const res = resources([
    ['emp-2', 'Аксёнов Олег'],
    ['emp-1', 'Петров Иван'],
    ['emp-x', 'Сотрудник Чужой', false],
  ])
  const events = [
    event({ id: 't1', employeeId: 'emp-1' }),
    event({ id: 't2', employeeId: null }),
    event({ id: 't3', employeeId: 'emp-ghost' }),
  ]

  it('сотрудник без работ — строка; порядок сервера; чужая организация подписана', () => {
    const rows = buildEmployeeRows(res, events, { filters: filters(), showEmpty: true })
    expect(rows.map((r) => [r.label, r.sublabel, r.events.length])).toEqual([
      ['Аксёнов Олег', '', 0],
      ['Петров Иван', '', 1],
      ['Сотрудник Чужой', 'Другая организация', 0],
      ['Другие исполнители', 'Нет в списке сотрудников', 1],
      ['Нераспределённые', 'Исполнитель не назначен', 1],
    ])
    for (const row of rows) expect(`${row.label} ${row.sublabel}`).not.toMatch(/emp-/)
  })

  it('без пустых, фильтр сотрудника, «Без исполнителя»', () => {
    expect(buildEmployeeRows(res, events, { filters: filters(), showEmpty: false }).map((r) => r.key)).toEqual([
      'employee:emp-1',
      'otherEmployees',
      'unassigned',
    ])
    expect(buildEmployeeRows(res, [], { filters: filters({ employeeIds: ['emp-2'] }), showEmpty: true }).map((r) => r.key)).toEqual([
      'employee:emp-2',
    ])
    expect(
      buildEmployeeRows(res, [events[1]], { filters: filters({ assigned: 'unassigned' }), showEmpty: true }).map((r) => r.key),
    ).toEqual(['unassigned'])
  })

  it('объект без работ, если пришёл в resources, — строка; неизвестный объект не теряется', () => {
    const r = resources(
      [],
      [
        ['loc-1', 'ТЦ'],
        ['loc-empty', 'Склад'],
      ],
    )
    const rows = buildLocationRows(r, [event({ id: 'a' }), event({ id: 'b', locationId: 'loc-ghost' })], {
      filters: filters(),
      showEmpty: true,
    })
    expect(rows.map((row) => [row.key, row.events.length])).toEqual([
      ['location:loc-1', 1],
      ['location:loc-empty', 0],
      ['otherLocations', 1],
    ])
  })
})

describe('переходы из карточки', () => {
  it('область: из адреса; иначе клиент события, если он не своя компания', () => {
    expect(eventScope({ clientCompanyId: 'client-a' }, { linkedClientCompanyId: 'client-z' }, 'provider')).toEqual({
      linkedClientCompanyId: 'client-z',
    })
    expect(eventScope({ clientCompanyId: 'client-a' }, { companyId: 'observed' }, 'provider')).toEqual({ companyId: 'observed' })
    expect(eventScope({ clientCompanyId: 'client-a' }, {}, 'provider')).toEqual({ linkedClientCompanyId: 'client-a' })
    expect(eventScope({ clientCompanyId: 'client-a' }, {}, 'client-a')).toEqual({})
    expect(eventScope({ clientCompanyId: 'client-a' }, {}, null)).toEqual({})
  })

  it('заявка → /tickets/:sourceId с областью; id кодируется', () => {
    expect(eventLinks(event({ id: 'ticket:t-1', sourceId: 't-1' }), {}, 'provider').primary).toEqual({
      label: 'Открыть заявку',
      to: '/tickets/t-1?linkedClientCompanyId=client-a',
    })
    expect(eventLinks(event({ id: 'x', sourceId: 'a/b' }), {}, 'client-a').primary?.to).toBe('/tickets/a%2Fb')
  })

  it('обход → план обходов по объекту, последний обход, карточка объекта', () => {
    const links = eventLinks(
      event({
        id: 'inspection:s-1',
        sourceId: 's-1',
        type: 'INSPECTION',
        ticket: undefined,
        inspection: inspectionPart({ lastRunId: 'run-1' }),
      }),
      {},
      'provider',
    )
    expect(links).toEqual({
      primary: { label: 'Открыть план обходов', to: '/inspection/schedules?linkedClientCompanyId=client-a&locationId=loc-1' },
      lastRun: '/inspection/runs/run-1?linkedClientCompanyId=client-a',
      location: '/locations/loc-1?linkedClientCompanyId=client-a',
    })
  })
})

describe('capabilities и truncated', () => {
  it('недоступное ≠ пустое', () => {
    expect(capabilityNotices(caps())).toEqual([])
    expect(capabilityNotices(caps({ eventTypes: { TICKET: true, INSPECTION: false } }))).toEqual([
      'Планы обходов недоступны вашей роли: в календаре только заявки.',
    ])
    expect(capabilityNotices(caps({ employeeRoster: false }))[0]).toMatch(/сотрудники без работ не видны/)
    const restricted = capabilityNotices(caps({ restrictedEmpty: true, employeeRoster: false }))
    expect(restricted).toHaveLength(1)
    expect(restricted[0]).toMatch(/нет доступа ни к одному объекту/)
    expect(capabilityNotices(caps({ unscheduled: false }))).toEqual(['Работы без плановой даты сервер не показывает.'])
  })

  it('truncated — источники и лимиты из meta', () => {
    const meta: WorkCalendarResponse['meta'] = {
      truncated: true,
      truncatedSources: ['inspections', 'employees'],
      limits: { scheduledTickets: 1000, unscheduledTickets: 200, inspections: 500, employees: 300 },
      counts: { scheduledTickets: 0, unscheduledTickets: 0, inspections: 500 },
      generatedAt: '2026-10-22T12:00:00.000Z',
    }
    expect(truncatedNotice(meta)).toBe(
      'Показаны не все данные: планы обходов — первые 500, сотрудники — первые 300. Сократите период или уточните фильтры.',
    )
    expect(truncatedNotice({ ...meta, truncated: false, truncatedSources: [] })).toBeNull()
  })
})

describe('запрос GET /work-calendar', () => {
  it('только параметры контроллера #453', () => {
    const q = new URLSearchParams(
      buildWorkCalendarQuery({
        from: '2026-10-26',
        to: '2026-11-02',
        timezone: 'Europe/Moscow',
        employeeIds: ['e1', 'e2'],
        locationIds: [],
        types: ['TICKET'],
        statuses: [' NEW ', ''],
        includeUnscheduled: false,
        linkedClientCompanyId: 'client-A',
        companyId: 'observed',
      }),
    )
    expect(Object.fromEntries(q)).toEqual({
      from: '2026-10-26',
      to: '2026-11-02',
      timezone: 'Europe/Moscow',
      employeeIds: 'e1,e2',
      types: 'TICKET',
      statuses: 'NEW',
      includeUnscheduled: 'false',
      linkedClientCompanyId: 'client-A',
    })
    const controllerParams = new Set([
      'from',
      'to',
      'timezone',
      'linkedClientCompanyId',
      'companyId',
      'employeeIds',
      'locationIds',
      'types',
      'statuses',
      'includeUnscheduled',
    ])
    for (const key of q.keys()) expect(controllerParams).toContain(key)
  })

  it('клиент только читает: один GET без тела', async () => {
    vi.resetModules()
    const fixture = (await import('./__fixtures__/workCalendar.contract.json')).default
    const request = vi.fn().mockResolvedValue(fixture.cases.dispatcherWeek.response)
    vi.doMock('./api', () => ({ request }))
    const mod = await import('./workCalendarApi')
    await mod.getWorkCalendar({ from: '2026-10-26', to: '2026-11-02', timezone: 'Europe/Moscow' }, '2026-10-25T21:00:00.000Z')
    expect(request).toHaveBeenCalledTimes(1)
    const [path, options] = request.mock.calls[0]
    expect(path).toBe('/work-calendar?from=2026-10-26&to=2026-11-02&timezone=Europe%2FMoscow')
    expect(options).toBeUndefined()
    vi.doUnmock('./api')
  })
})

describe('вход в раздел — по @Roles контроллера #453', () => {
  it('видят роли, которых пускает сервер; CLIENT — через allow-list', () => {
    expect(railSectionIdForPath('/work-calendar')).toBe('works')
    for (const role of [
      'PLATFORM_ADMIN',
      'ADMIN',
      'MASTER',
      'DISPATCHER',
      'NETWORK_DIRECTOR',
      'TECHNICIAN',
      'TERRITORIAL_MANAGER',
      'CLIENT',
    ] as const) {
      expect(isManagementNavItemVisible('/work-calendar', { role })).toBe(true)
    }
  })

  it('CLIENT_ADMIN и STAFF сервер не пускает — пункта нет', () => {
    for (const role of ['CLIENT_ADMIN', 'STAFF', null] as const) expect(isManagementNavItemVisible('/work-calendar', { role })).toBe(false)
  })

  it('карта маршрутов знает страницу', () => {
    expect(matchManagementRoute('/work-calendar')?.meta).toMatchObject({ section: 'rounds', pageLabel: 'Календарь работ' })
    expect(validateManagementRoutes()).toEqual([])
  })
})
