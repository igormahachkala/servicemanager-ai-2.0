/**
 * SMA-WORK-CALENDAR-V1 — правила отображения календаря работ.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  EMPTY_FILTERS,
  applyFilters,
  buildEmployeeRows,
  buildLocationRows,
  calendarRange,
  capabilityNotices,
  dueChipLabel,
  dueFullLabel,
  eventDueAt,
  eventLinks,
  isServerOverdue,
  shiftAnchor,
  splitByTiming,
  statusOptions,
  truncatedNotice,
  zonedDayKey,
  type CalendarFilters,
} from './workCalendar'
import type { WorkCalendarEvent, WorkCalendarResponse } from './workCalendarApi'
import { buildWorkCalendarQuery, normalizeWorkCalendarResponse } from './workCalendarApi'
import { isManagementNavItemVisible, railSectionIdForPath } from './navigation'
import { matchManagementRoute, validateManagementRoutes } from './managementRouteMeta'

function event(overrides: Partial<WorkCalendarEvent> & { id: string }): WorkCalendarEvent {
  return {
    kind: 'TICKET',
    source: 'TICKET',
    entityId: overrides.id,
    ticketId: overrides.id,
    companyId: 'c1',
    locationId: 'loc-1',
    employeeId: 'emp-1',
    title: `Работа ${overrides.id}`,
    status: 'ASSIGNED',
    timing: { mode: 'DUE', startAt: null, endAt: null, dueAt: '2026-10-21T08:00:00.000Z', hasWindow: false },
    ...overrides,
  }
}

const unscheduled = (id: string, extra: Partial<WorkCalendarEvent> = {}) =>
  event({ id, timing: { mode: 'UNSCHEDULED', startAt: null, endAt: null, dueAt: null, hasWindow: false }, ...extra })

const resources = (
  employees: Array<[string, string]>,
  locations: Array<[string, string]> = [],
): Pick<WorkCalendarResponse, 'resources'> => ({
  resources: {
    employees: employees.map(([id, displayName]) => ({
      id,
      displayName,
      companyId: 'c1',
      role: 'TECHNICIAN',
      isActive: true,
      isExecutor: true,
      eventCount: 0,
    })),
    locations: locations.map(([id, name]) => ({ id, name })),
  },
})

const filters = (patch: Partial<CalendarFilters> = {}): CalendarFilters => ({ ...EMPTY_FILTERS, ...patch })

describe('диапазон [from, to)', () => {
  it('день, неделя с понедельника, месяц — от локальной полуночи', () => {
    const anchor = new Date(2026, 9, 22, 15, 30) // четверг
    const day = calendarRange('day', anchor)
    expect(day.days).toEqual(['2026-10-22'])
    expect(day.from).toEqual(new Date(2026, 9, 22))
    expect(day.to).toEqual(new Date(2026, 9, 23))

    const week = calendarRange('week', anchor)
    expect(week.days).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'])
    expect(week.to).toEqual(new Date(2026, 9, 26))

    // Воскресенье относится к неделе, начатой в понедельник до него.
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
    expect(week.from.toISOString()).toBe('2026-10-18T22:00:00.000Z') // CEST, +2
    expect(week.to.toISOString()).toBe('2026-10-25T23:00:00.000Z') // CET, +1
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
  it('срок только из mode = DUE; startAt/endAt не читаются', () => {
    expect(eventDueAt(event({ id: 'a' }))?.toISOString()).toBe('2026-10-21T08:00:00.000Z')
    expect(eventDueAt(unscheduled('b'))).toBeNull()
    expect(eventDueAt(event({ id: 'c', timing: { mode: 'DUE', startAt: null, endAt: null, dueAt: null, hasWindow: false } }))).toBeNull()
    expect(
      eventDueAt(event({ id: 'd', timing: { mode: 'DUE', startAt: null, endAt: null, dueAt: 'not-a-date', hasWindow: false } })),
    ).toBeNull()
    // Даже если сервер прислал startAt у события без срока — оно без даты.
    expect(
      eventDueAt(
        event({
          id: 'e',
          timing: { mode: 'UNSCHEDULED', startAt: '2026-10-21T09:00:00Z', endAt: '2026-10-21T10:00:00Z', dueAt: null, hasWindow: false },
        }),
      ),
    ).toBeNull()
  })

  it('подпись — «срок HH:mm» в поясе календаря, без длительности и без «с … по …»', () => {
    const e = event({ id: 'a' })
    expect(dueChipLabel(e, 'Asia/Yekaterinburg')).toBe('срок 13:00')
    expect(dueChipLabel(e, 'UTC')).toBe('срок 08:00')
    expect(dueChipLabel(unscheduled('b'), 'UTC')).toBe('')
    expect(dueFullLabel(unscheduled('b'), 'UTC')).toBe('Без плановой даты')
    expect(dueFullLabel(e, 'UTC')).toMatch(/^до 21 октября 2026 г\., 08:00$/)
  })

  it('день срока — в поясе календаря; неизвестный пояс не роняет', () => {
    const late = new Date('2026-10-21T20:30:00Z')
    expect(zonedDayKey(late, 'UTC')).toBe('2026-10-21')
    expect(zonedDayKey(late, 'Asia/Yekaterinburg')).toBe('2026-10-22')
    expect(zonedDayKey(late, 'Not/AZone')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('раскладка: по дням, «Без назначенного времени», за границей периода — ничего не теряется', () => {
    const events = [
      event({ id: 'late', timing: { mode: 'DUE', startAt: null, endAt: null, dueAt: '2026-10-21T15:00:00Z', hasWindow: false } }),
      event({ id: 'early', timing: { mode: 'DUE', startAt: null, endAt: null, dueAt: '2026-10-21T06:00:00Z', hasWindow: false } }),
      event({ id: 'next', timing: { mode: 'DUE', startAt: null, endAt: null, dueAt: '2026-10-22T06:00:00Z', hasWindow: false } }),
      event({ id: 'far', timing: { mode: 'DUE', startAt: null, endAt: null, dueAt: '2026-12-01T06:00:00Z', hasWindow: false } }),
      unscheduled('none'),
    ]
    const split = splitByTiming(events, ['2026-10-21', '2026-10-22'], 'UTC')
    expect(split.byDay.get('2026-10-21')?.map((e) => e.id)).toEqual(['early', 'late'])
    expect(split.byDay.get('2026-10-22')?.map((e) => e.id)).toEqual(['next'])
    expect(split.unscheduled.map((e) => e.id)).toEqual(['none'])
    expect(split.outside.map((e) => e.id)).toEqual(['far'])
  })

  it('просрочка — только флаг recurrence с сервера, своего расчёта нет', () => {
    const past = event({ id: 'p', timing: { mode: 'DUE', startAt: null, endAt: null, dueAt: '2000-01-01T00:00:00Z', hasWindow: false } })
    expect(isServerOverdue(past)).toBe(false)
    expect(
      isServerOverdue(
        event({
          id: 'i',
          kind: 'INSPECTION',
          recurrence: {
            frequency: 'DAILY',
            intervalDays: null,
            nextDueAt: '2026-10-21T00:00:00Z',
            overdueAt: '2026-10-22T00:00:00Z',
            isOverdue: true,
          },
        }),
      ),
    ).toBe(true)
  })
})

describe('фильтры только сужают', () => {
  const events = [
    event({ id: 't1', employeeId: 'emp-1', locationId: 'loc-1', status: 'NEW' }),
    event({ id: 't2', employeeId: null, locationId: 'loc-2', status: 'ASSIGNED' }),
    event({ id: 'i1', kind: 'INSPECTION', source: 'INSPECTION_SCHEDULE', employeeId: 'emp-2', locationId: 'loc-1', status: 'ACTIVE' }),
    unscheduled('u1', { employeeId: 'emp-1' }),
  ]
  const ids = (list: WorkCalendarEvent[]) => list.map((e) => e.id)

  it('каждый фильтр по отдельности', () => {
    expect(ids(applyFilters(events, filters()))).toEqual(['t1', 't2', 'i1', 'u1'])
    expect(ids(applyFilters(events, filters({ employeeIds: ['emp-1'] })))).toEqual(['t1', 'u1'])
    expect(ids(applyFilters(events, filters({ locationIds: ['loc-1'] })))).toEqual(['t1', 'i1', 'u1'])
    expect(ids(applyFilters(events, filters({ eventTypes: ['INSPECTION'] })))).toEqual(['i1'])
    expect(ids(applyFilters(events, filters({ statuses: ['NEW', 'ACTIVE'] })))).toEqual(['t1', 'i1'])
    expect(ids(applyFilters(events, filters({ assigned: 'unassigned' })))).toEqual(['t2'])
    expect(ids(applyFilters(events, filters({ assigned: 'assigned' })))).toEqual(['t1', 'i1', 'u1'])
    expect(ids(applyFilters(events, filters({ includeUnscheduled: false })))).toEqual(['t1', 't2', 'i1'])
  })

  it('результат — всегда подмножество ответа', () => {
    const combos: Partial<CalendarFilters>[] = [
      { employeeIds: ['emp-9'] },
      { locationIds: ['loc-1'], eventTypes: ['TICKET'] },
      { statuses: ['DONE'] },
      { assigned: 'unassigned', employeeIds: ['emp-1'] },
    ]
    for (const combo of combos) {
      const out = applyFilters(events, filters(combo))
      for (const e of out) expect(events).toContain(e)
    }
  })

  it('варианты статусов: статусы заявок всегда + встреченные в ответе', () => {
    const options = statusOptions(events)
    expect(options.slice(0, 7)).toEqual(['NEW', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_ACCEPTANCE', 'FIELD_COMPLETE', 'DONE', 'CANCELED'])
    expect(options).toContain('ACTIVE')
  })
})

describe('строки сотрудников', () => {
  const res = resources([
    ['emp-2', 'Петрова Анна'],
    ['emp-1', 'Иванов Сергей'],
    ['emp-idle', 'Сидоров Олег'],
  ])
  const events = [
    event({ id: 't1', employeeId: 'emp-1' }),
    event({ id: 't2', employeeId: null }),
    event({ id: 't3', employeeId: 'emp-ghost' }),
  ]

  it('сотрудник без работ — строка; порядок по имени; «Нераспределённые» отдельно', () => {
    const rows = buildEmployeeRows(res, events, { filters: filters(), showEmpty: true })
    expect(rows.map((r) => [r.label, r.events.length])).toEqual([
      ['Иванов Сергей', 1],
      ['Петрова Анна', 0],
      ['Сидоров Олег', 0],
      ['Другие исполнители', 1],
      ['Нераспределённые', 1],
    ])
  })

  it('без пустых — только строки с работами', () => {
    const rows = buildEmployeeRows(res, events, { filters: filters(), showEmpty: false })
    expect(rows.map((r) => r.key)).toEqual(['employee:emp-1', 'otherEmployees', 'unassigned'])
  })

  it('исполнитель не из ресурсов не теряется и не показывает идентификатор', () => {
    const rows = buildEmployeeRows(res, events, { filters: filters(), showEmpty: false })
    const other = rows.find((r) => r.kind === 'otherEmployees')!
    expect(other.events.map((e) => e.id)).toEqual(['t3'])
    for (const row of rows) expect(`${row.label} ${row.sublabel}`).not.toMatch(/emp-/)
  })

  it('фильтр по сотруднику: выбранный остаётся даже пустым, нераспределённые скрыты', () => {
    const rows = buildEmployeeRows(res, [], { filters: filters({ employeeIds: ['emp-idle'] }), showEmpty: true })
    expect(rows.map((r) => r.key)).toEqual(['employee:emp-idle'])
  })

  it('«Без исполнителя» — только строка нераспределённых', () => {
    const rows = buildEmployeeRows(res, [events[1]], { filters: filters({ assigned: 'unassigned' }), showEmpty: true })
    expect(rows.map((r) => r.key)).toEqual(['unassigned'])
  })

  it('ресурсы недоступны — строки только по событиям', () => {
    const rows = buildEmployeeRows(resources([]), events, { filters: filters(), showEmpty: true })
    expect(rows.map((r) => r.key)).toEqual(['otherEmployees', 'unassigned'])
  })
})

describe('строки объектов', () => {
  it('пустые объекты по флагу, без объекта — отдельно, порядок по городу и названию', () => {
    const res: Pick<WorkCalendarResponse, 'resources'> = {
      resources: {
        employees: [],
        locations: [
          { id: 'loc-b', name: 'Склад', city: 'Челябинск', address: 'ул. Труда, 1' },
          { id: 'loc-a', name: 'ТЦ', city: 'Екатеринбург', clientName: 'Сеть' },
        ],
      },
    }
    const events = [event({ id: 't1', locationId: 'loc-b' }), event({ id: 't2', locationId: null })]
    const rows = buildLocationRows(res, events, { filters: filters(), showEmpty: true })
    expect(rows.map((r) => [r.label, r.sublabel, r.events.length])).toEqual([
      ['ТЦ', 'Екатеринбург · Сеть', 0],
      ['Склад', 'Челябинск · ул. Труда, 1', 1],
      ['Без объекта', '', 1],
    ])
    expect(buildLocationRows(res, events, { filters: filters(), showEmpty: false }).map((r) => r.key)).toEqual([
      'location:loc-b',
      'noLocation',
    ])
    expect(buildLocationRows(res, events, { filters: filters({ locationIds: ['loc-a'] }), showEmpty: true }).map((r) => r.key)).toEqual([
      'location:loc-a',
    ])
  })
})

describe('переходы из карточки события', () => {
  it('заявка → существующая страница заявки, с областью', () => {
    expect(eventLinks(event({ id: 't-1' })).primary).toEqual({ label: 'Открыть заявку', to: '/tickets/t-1' })
    expect(eventLinks(event({ id: 't-1' }), { linkedClientCompanyId: 'client-A' }).primary?.to).toBe(
      '/tickets/t-1?linkedClientCompanyId=client-A',
    )
  })

  it('обход → план обходов, суженный до объекта, с областью; карточка объекта', () => {
    const links = eventLinks(
      event({ id: 's-1', kind: 'INSPECTION', source: 'INSPECTION_SCHEDULE', ticketId: null, scheduleId: 's-1', locationId: 'loc-1' }),
      {
        linkedClientCompanyId: 'client-A',
      },
    )
    expect(links.primary).toEqual({
      label: 'Открыть план обходов',
      to: '/inspection/schedules?linkedClientCompanyId=client-A&locationId=loc-1',
    })
    expect(links.location).toBe('/locations/loc-1?linkedClientCompanyId=client-A')
  })

  it('links из ответа адресом не становятся; нет заявки — нет перехода', () => {
    const e = event({
      id: 'x',
      ticketId: null,
      source: 'TICKET',
      entityId: '',
      locationId: null,
      links: { ticket: 'https://evil.example/t', location: '/api/locations/1' },
    })
    expect(eventLinks(e)).toEqual({ primary: null, location: null })
  })

  it('идентификатор кодируется в пути', () => {
    expect(eventLinks(event({ id: 'a/b' })).primary?.to).toBe('/tickets/a%2Fb')
  })
})

describe('ответ сервера', () => {
  it('нет флага capabilities — источник недоступен, а не пуст', () => {
    const r = normalizeWorkCalendarResponse({ events: [{ id: 'e1' }], capabilities: { tickets: true } })
    expect(r.capabilities).toEqual({ tickets: true, inspections: false, resources: false })
    expect(r.resources).toEqual({ employees: [], locations: [] })
    expect(r.meta).toEqual({ total: 1, scheduled: 0, unscheduled: 0, truncated: false })
    expect(normalizeWorkCalendarResponse(null).events).toEqual([])
  })

  it('предупреждения по capabilities', () => {
    expect(capabilityNotices({ tickets: true, inspections: true, resources: true })).toEqual([])
    expect(capabilityNotices({ tickets: true, inspections: false, resources: true })).toEqual([
      'Обходы недоступны вашей роли: в календаре только заявки.',
    ])
    expect(capabilityNotices({ tickets: false, inspections: true, resources: false })).toHaveLength(2)
    expect(capabilityNotices({ tickets: false, inspections: false, resources: true })[0]).toMatch(/не потому, что работ нет/)
  })

  it('truncated — с числами, если сервер их дал', () => {
    expect(truncatedNotice({ meta: { total: 10, scheduled: 0, unscheduled: 0, truncated: false }, events: [] })).toBeNull()
    expect(
      truncatedNotice({
        meta: { total: 500, scheduled: 0, unscheduled: 0, truncated: true },
        events: new Array(200).fill(event({ id: 'x' })),
      }),
    ).toBe('Показаны не все события: показано 200 из 500. Сократите период или уточните фильтры.')
    expect(truncatedNotice({ meta: { total: 0, scheduled: 0, unscheduled: 0, truncated: true }, events: [] })).toBe(
      'Показаны не все события. Сократите период или уточните фильтры.',
    )
  })
})

describe('запрос GET /work-calendar', () => {
  it('строка запроса по контракту: списки через запятую, пустые не отправляются', () => {
    const q = new URLSearchParams(
      buildWorkCalendarQuery({
        from: '2026-10-18T22:00:00.000Z',
        to: '2026-10-25T23:00:00.000Z',
        timezone: 'Etc/GMT+5',
        view: 'week',
        employeeIds: ['e1', 'e2'],
        locationIds: [],
        eventTypes: ['TICKET'],
        statuses: [' NEW ', ''],
        assigned: 'all',
        includeUnscheduled: true,
        includeCompleted: false,
        linkedClientCompanyId: 'client-A',
        companyId: 'observed',
      }),
    )
    expect(Object.fromEntries(q)).toEqual({
      from: '2026-10-18T22:00:00.000Z',
      to: '2026-10-25T23:00:00.000Z',
      timezone: 'Etc/GMT+5',
      view: 'week',
      employeeIds: 'e1,e2',
      eventTypes: 'TICKET',
      statuses: 'NEW',
      linkedClientCompanyId: 'client-A',
      includeUnscheduled: 'true',
      includeCompleted: 'false',
    })
    expect(buildWorkCalendarQuery({ from: 'a', to: 'b', timezone: 'Etc/GMT+5' })).toContain('timezone=Etc%2FGMT%2B5')
    expect(buildWorkCalendarQuery({ from: 'a', to: 'b', assigned: 'unassigned' })).toContain('assigned=unassigned')
  })

  it('клиент только читает: один GET без тела', async () => {
    vi.resetModules()
    const request = vi.fn().mockResolvedValue({ capabilities: { tickets: true, inspections: true, resources: true } })
    vi.doMock('./api', () => ({ request }))
    const mod = await import('./workCalendarApi')
    const r = await mod.getWorkCalendar({ from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' })
    expect(request).toHaveBeenCalledTimes(1)
    const [path, options] = request.mock.calls[0]
    expect(path).toBe('/work-calendar?from=2026-10-01T00%3A00%3A00.000Z&to=2026-11-01T00%3A00%3A00.000Z')
    expect(options).toBeUndefined()
    expect(r.capabilities.resources).toBe(true)
    vi.doUnmock('./api')
  })
})

describe('вход в раздел', () => {
  it('пункт «Календарь работ» — в «Работах», управленческие роли', () => {
    expect(railSectionIdForPath('/work-calendar')).toBe('works')
    for (const role of [
      'PLATFORM_ADMIN',
      'ADMIN',
      'ADMIN_PROVIDER',
      'CLIENT_ADMIN',
      'MASTER',
      'DISPATCHER',
      'NETWORK_DIRECTOR',
      'TERRITORIAL_MANAGER',
    ] as const) {
      expect(isManagementNavItemVisible('/work-calendar', { role })).toBe(true)
    }
    for (const role of ['TECHNICIAN', 'CLIENT', 'STAFF', null] as const) {
      expect(isManagementNavItemVisible('/work-calendar', { role })).toBe(false)
    }
  })

  it('карта маршрутов знает страницу', () => {
    expect(matchManagementRoute('/work-calendar')?.meta).toMatchObject({ section: 'rounds', pageLabel: 'Календарь работ' })
    expect(validateManagementRoutes()).toEqual([])
  })
})
