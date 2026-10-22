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
  employeeSublabel,
  eventDueAt,
  eventLinks,
  eventScope,
  filterParams,
  isServerOverdue,
  shiftAnchor,
  splitByTiming,
  truncatedNotice,
  type CalendarFilters,
} from './workCalendar'
import {
  buildWorkCalendarQuery,
  type WorkCalendarCapabilities,
  type WorkCalendarEmployee,
  type WorkCalendarEvent,
  type WorkCalendarMeta,
  type WorkCalendarResponse,
} from './workCalendarApi'
import { isManagementNavItemVisible, railSectionIdForPath } from './navigation'
import { matchManagementRoute, validateManagementRoutes } from './managementRouteMeta'

function event(overrides: Partial<WorkCalendarEvent> & { id: string }): WorkCalendarEvent {
  return {
    kind: 'TICKET',
    source: 'TICKET',
    entityId: overrides.id,
    ticketId: overrides.id,
    scheduleId: null,
    companyId: 'client-a',
    clientCompanyId: 'client-a',
    locationId: 'loc-1',
    employeeId: 'emp-1',
    title: `Работа ${overrides.id}`,
    status: 'ASSIGNED',
    timing: { mode: 'DUE', dueAt: '2026-10-21T08:00:00.000Z', localDate: '2026-10-21', startAt: null, endAt: null, hasWindow: false },
    recurrence: null,
    ticket: { ticketNumber: 1, urgency: 'NOT_URGENT', priority: 'NORMAL', slaDueAt: null, parentId: null },
    inspection: null,
    ...overrides,
  }
}

const due = (dueAt: string, localDate: string): WorkCalendarEvent['timing'] => ({
  mode: 'DUE',
  dueAt,
  localDate,
  startAt: null,
  endAt: null,
  hasWindow: false,
})
const UNSCHEDULED: WorkCalendarEvent['timing'] = {
  mode: 'UNSCHEDULED',
  dueAt: null,
  localDate: null,
  startAt: null,
  endAt: null,
  hasWindow: false,
}

function inspection(
  id: string,
  extra: Partial<WorkCalendarEvent> = {},
  recurrence: Partial<NonNullable<WorkCalendarEvent['recurrence']>> = {},
  lastRunId: string | null = null,
) {
  return event({
    id,
    kind: 'INSPECTION',
    source: 'INSPECTION_SCHEDULE',
    ticketId: null,
    scheduleId: id,
    companyId: 'provider-1',
    status: 'SCHEDULED',
    ticket: null,
    recurrence: {
      frequency: 'MONTHLY',
      intervalDays: null,
      nextDueAt: '2026-10-21T08:00:00.000Z',
      overdueAt: '2026-10-22T08:00:00.000Z',
      isOverdue: false,
      followingDueAt: null,
      ...recurrence,
    },
    inspection: { templateName: null, lastRunId },
    ...extra,
  })
}

const employee = (id: string, displayName: string, own = true, patch: Partial<WorkCalendarEmployee> = {}): WorkCalendarEmployee => ({
  id,
  displayName,
  companyId: own ? 'provider-1' : null,
  role: own ? 'TECHNICIAN' : null,
  isActive: own ? true : null,
  isExecutor: own ? true : null,
  isOwnCompany: own,
  eventCount: 0,
  ...patch,
})

const resources = (
  employees: WorkCalendarEmployee[],
  locations: Array<[string, string]> = [],
): Pick<WorkCalendarResponse, 'resources'> => ({
  resources: {
    employees,
    locations: locations.map(([id, name]) => ({ id, name, city: null, address: null, clientCompanyId: 'client-a', eventCount: 0 })),
  },
})

const filters = (patch: Partial<CalendarFilters> = {}): CalendarFilters => ({ ...EMPTY_FILTERS, ...patch })

const caps = (patch: Partial<WorkCalendarCapabilities> = {}): WorkCalendarCapabilities => ({
  tickets: true,
  inspections: true,
  resources: true,
  employeeDirectory: true,
  locationDirectory: true,
  readOnly: true,
  unscheduled: true,
  timeWindows: false,
  recurrenceProjection: false,
  restrictedEmpty: false,
  ...patch,
})

describe('диапазон [from, to)', () => {
  it('день, неделя с понедельника, месяц — от локальной полуночи', () => {
    const anchor = new Date(2026, 9, 22, 15, 30) // четверг
    expect(calendarRange('day', anchor).days).toEqual(['2026-10-22'])
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

  it('неделя — 7 суток, 169 часов; день перевода — 25 часов', () => {
    const week = calendarRange('week', new Date(2026, 9, 22))
    expect(week.from.toISOString()).toBe('2026-10-18T22:00:00.000Z')
    expect(week.to.toISOString()).toBe('2026-10-25T23:00:00.000Z')
    expect((week.to.getTime() - week.from.getTime()) / 3_600_000).toBe(169)
    const day = calendarRange('day', new Date(2026, 9, 25, 12))
    expect(day.to.getHours()).toBe(0)
    expect((day.to.getTime() - day.from.getTime()) / 3_600_000).toBe(25)
  })
})

describe('время события: срок, а не слот', () => {
  it('срок только у timing.mode = DUE', () => {
    expect(eventDueAt(event({ id: 'a' }))?.toISOString()).toBe('2026-10-21T08:00:00.000Z')
    expect(eventDueAt(event({ id: 'b', timing: UNSCHEDULED }))).toBeNull()
  })

  it('подпись — «срок HH:mm» в поясе ответа; дата — localDate сервера', () => {
    expect(dueChipLabel(event({ id: 'a' }), 'Asia/Yekaterinburg')).toBe('срок 13:00')
    expect(dueChipLabel(event({ id: 'b', timing: UNSCHEDULED }), 'UTC')).toBe('')
    expect(dueFullLabel(event({ id: 'b', timing: UNSCHEDULED }), 'UTC')).toBe('Без плановой даты')
    const late = event({ id: 'late', timing: due('2026-10-27T22:30:00.000Z', '2026-10-28') })
    expect(dueFullLabel(late, 'Europe/Moscow')).toMatch(/^до 28 октября 2026 г\., 01:30$/)
  })

  it('раскладка по localDate: по дням, «без времени», за границей — ничего не теряется', () => {
    const events = [
      event({ id: 'late', timing: due('2026-10-21T15:00:00Z', '2026-10-21') }),
      event({ id: 'early', timing: due('2026-10-21T06:00:00Z', '2026-10-21') }),
      // UTC-дата 21-е, но сервер отнёс к 22-му — верим серверу.
      event({ id: 'zoned', timing: due('2026-10-21T20:00:00Z', '2026-10-22') }),
      event({ id: 'far', timing: due('2026-12-01T06:00:00Z', '2026-12-01') }),
      event({ id: 'none', timing: UNSCHEDULED }),
    ]
    const split = splitByTiming(events, ['2026-10-21', '2026-10-22'])
    expect(split.byDay.get('2026-10-21')?.map((e) => e.id)).toEqual(['early', 'late'])
    expect(split.byDay.get('2026-10-22')?.map((e) => e.id)).toEqual(['zoned'])
    expect(split.unscheduled.map((e) => e.id)).toEqual(['none'])
    expect(split.outside.map((e) => e.id)).toEqual(['far'])
  })

  it('просрочка — только recurrence.isOverdue с сервера', () => {
    expect(isServerOverdue(event({ id: 'p', timing: due('2000-01-01T00:00:00Z', '2000-01-01') }))).toBe(false)
    expect(isServerOverdue(inspection('i', { status: 'OVERDUE' }, { isOverdue: true }))).toBe(true)
  })
})

describe('фильтры → параметры сервера', () => {
  it('по умолчанию: includeCompleted=false, statuses не отправляются', () => {
    expect(filterParams(EMPTY_FILTERS)).toEqual({
      employeeIds: [],
      locationIds: [],
      eventTypes: [],
      statuses: undefined,
      assigned: 'all',
      includeUnscheduled: true,
      includeCompleted: false,
    })
  })

  it('завершённые статусы без флага не уходят: сервер их всё равно не вернёт', () => {
    expect(filterParams(filters({ statuses: ['DONE', 'NEW'] })).statuses).toEqual(['NEW'])
    expect(filterParams(filters({ statuses: ['DONE', 'NEW'], includeCompleted: true }))).toMatchObject({
      statuses: ['DONE', 'NEW'],
      includeCompleted: true,
    })
  })

  it('строка запроса — новые параметры контроллера: eventTypes, assigned, includeCompleted', () => {
    const q = new URLSearchParams(
      buildWorkCalendarQuery({
        from: '2026-10-26',
        to: '2026-11-02',
        timezone: 'Europe/Moscow',
        ...filterParams(filters({ eventTypes: ['TICKET'], assigned: 'unassigned', employeeIds: ['e1', 'e2'], statuses: ['NEW'] })),
        linkedClientCompanyId: 'client-A',
        companyId: 'observed',
      }),
    )
    expect(Object.fromEntries(q)).toEqual({
      from: '2026-10-26',
      to: '2026-11-02',
      timezone: 'Europe/Moscow',
      employeeIds: 'e1,e2',
      eventTypes: 'TICKET',
      statuses: 'NEW',
      assigned: 'unassigned',
      includeUnscheduled: 'true',
      includeCompleted: 'false',
      linkedClientCompanyId: 'client-A',
    })
    expect(q.has('types')).toBe(false)
  })
})

describe('фильтры поверх ответа — только сужают', () => {
  const events = [
    event({ id: 't1', employeeId: 'emp-1', locationId: 'loc-1', status: 'NEW' }),
    event({ id: 't2', employeeId: null, locationId: 'loc-2' }),
    event({ id: 'done', status: 'DONE' }),
    event({ id: 'canceled', status: 'CANCELED', employeeId: null }),
    inspection('i1', { employeeId: 'emp-2' }),
    event({ id: 'u1', timing: UNSCHEDULED, locationId: 'loc-3' }),
  ]
  const ids = (list: WorkCalendarEvent[]) => list.map((e) => e.id)

  it('DONE/CANCELED скрыты без «Завершённых»', () => {
    expect(ids(applyFilters(events, filters()))).toEqual(['t1', 't2', 'i1', 'u1'])
    expect(ids(applyFilters(events, filters({ includeCompleted: true })))).toEqual(['t1', 't2', 'done', 'canceled', 'i1', 'u1'])
  })

  it('каждый фильтр по отдельности', () => {
    const all = { includeCompleted: true }
    expect(ids(applyFilters(events, filters({ ...all, employeeIds: ['emp-1'] })))).toEqual(['t1', 'done', 'u1'])
    expect(ids(applyFilters(events, filters({ ...all, locationIds: ['loc-1'] })))).toEqual(['t1', 'done', 'canceled', 'i1'])
    expect(ids(applyFilters(events, filters({ ...all, eventTypes: ['INSPECTION'] })))).toEqual(['i1'])
    expect(ids(applyFilters(events, filters({ statuses: ['NEW', 'SCHEDULED'] })))).toEqual(['t1', 'i1'])
    expect(ids(applyFilters(events, filters({ ...all, assigned: 'unassigned' })))).toEqual(['t2', 'canceled'])
    expect(ids(applyFilters(events, filters({ ...all, includeUnscheduled: false })))).toEqual(['t1', 't2', 'done', 'canceled', 'i1'])
  })

  it('статусы фильтра — ровно набор сервера (визит плана — SCHEDULED)', () => {
    expect(STATUS_OPTIONS).toEqual([
      'NEW',
      'ASSIGNED',
      'IN_PROGRESS',
      'AWAITING_ACCEPTANCE',
      'FIELD_COMPLETE',
      'DONE',
      'CANCELED',
      'SCHEDULED',
      'OVERDUE',
    ])
  })
})

describe('строки и раскрытие данных', () => {
  const contractor = employee('emp-x', 'Субподрядов Артём', false)
  const res = resources([employee('emp-2', 'Аксёнов Олег', true, { role: 'MASTER' }), employee('emp-1', 'Петров Иван'), contractor])
  const events = [
    event({ id: 't1', employeeId: 'emp-1' }),
    event({ id: 't2', employeeId: null }),
    event({ id: 't3', employeeId: 'emp-ghost' }),
  ]

  it('сотрудник без работ — строка; своему — роль, подрядчику — только «Другая организация»', () => {
    const rows = buildEmployeeRows(res, events, { filters: filters(), showEmpty: true })
    expect(rows.map((r) => [r.label, r.sublabel, r.events.length])).toEqual([
      ['Аксёнов Олег', 'Мастер', 0],
      ['Петров Иван', 'Техник', 1],
      ['Субподрядов Артём', 'Другая организация', 0],
      ['Другие исполнители', 'Нет в списке сотрудников', 1],
      ['Нераспределённые', 'Исполнитель не назначен', 1],
    ])
    for (const row of rows) expect(`${row.label} ${row.sublabel}`).not.toMatch(/emp-|provider/)
  })

  it('подпись подрядчика не выводит роль и признаки, даже если бы они пришли', () => {
    expect(employeeSublabel({ isOwnCompany: false, role: 'TECHNICIAN', isActive: false })).toBe('Другая организация')
    expect(employeeSublabel({ isOwnCompany: true, role: 'TECHNICIAN', isActive: false })).toBe('Техник · неактивен')
    expect(employeeSublabel({ isOwnCompany: true, role: null, isActive: null })).toBe('')
  })

  it('объект без работ — строка при «Объекты без работ»; неизвестный объект не теряется', () => {
    const r = resources(
      [],
      [
        ['loc-1', 'ТЦ'],
        ['loc-empty', 'Склад'],
      ],
    )
    const list = [event({ id: 'a' }), event({ id: 'b', locationId: 'loc-ghost' })]
    expect(buildLocationRows(r, list, { filters: filters(), showEmpty: true }).map((row) => [row.key, row.events.length])).toEqual([
      ['location:loc-1', 1],
      ['location:loc-empty', 0],
      ['otherLocations', 1],
    ])
    expect(buildLocationRows(r, list, { filters: filters(), showEmpty: false }).map((row) => row.key)).toEqual([
      'location:loc-1',
      'otherLocations',
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
  })

  it('заявка → /tickets/:ticketId; обход → план, последний обход, объект', () => {
    expect(eventLinks(event({ id: 't-1' }), {}, 'provider').primary).toEqual({
      label: 'Открыть заявку',
      to: '/tickets/t-1?linkedClientCompanyId=client-a',
    })
    expect(eventLinks(event({ id: 'a/b' }), {}, 'client-a').primary?.to).toBe('/tickets/a%2Fb')
    expect(eventLinks(inspection('s-1', {}, {}, 'run-1'), {}, 'provider')).toEqual({
      primary: { label: 'Открыть план обходов', to: '/inspection/schedules?linkedClientCompanyId=client-a&locationId=loc-1' },
      lastRun: '/inspection/runs/run-1?linkedClientCompanyId=client-a',
      location: '/locations/loc-1?linkedClientCompanyId=client-a',
    })
  })
})

describe('capabilities и truncated', () => {
  it('недоступное ≠ пустое', () => {
    expect(capabilityNotices(caps())).toEqual([])
    expect(capabilityNotices(caps({ inspections: false }))).toEqual(['Планы обходов недоступны вашей роли: в календаре только заявки.'])
    expect(capabilityNotices(caps({ employeeDirectory: false, resources: false }))).toEqual([
      'Штат недоступен: строки — только исполнители показанных работ, сотрудники без работ не видны.',
    ])
    expect(capabilityNotices(caps({ locationDirectory: false, resources: false }))).toEqual([
      'Справочник объектов недоступен: строки — только объекты с работами.',
    ])
    const restricted = capabilityNotices(caps({ restrictedEmpty: true, employeeDirectory: false, locationDirectory: false }))
    expect(restricted).toEqual(['У вас нет доступа ни к одному объекту в этом контуре — календарь пуст не потому, что работ нет.'])
  })

  it('truncated — показано/всего, источники и лимиты из meta', () => {
    const meta: WorkCalendarMeta = {
      total: 5200,
      scheduled: 5000,
      unscheduled: 200,
      truncated: true,
      totalIsExact: false,
      returned: { total: 700, scheduled: 500, unscheduled: 200 },
      truncatedSources: ['inspections', 'locations'],
      limits: { scheduledTickets: 1000, unscheduledTickets: 200, inspections: 500, employees: 300, locations: 300 },
      generatedAt: '2026-10-22T09:00:00.000Z',
    }
    expect(truncatedNotice(meta)).toBe(
      'Показаны не все данные: работ в ответе 700 из не менее 5200; обрезаны планы обходов — первые 500, объекты — первые 300. Сократите период или уточните фильтры.',
    )
    expect(truncatedNotice({ ...meta, truncated: false, truncatedSources: [] })).toBeNull()
  })
})

describe('запрос GET /work-calendar', () => {
  it('клиент только читает: один GET без тела', async () => {
    vi.resetModules()
    const canonical = (await import('./__fixtures__/work-calendar.response.v1.json')).default
    const request = vi.fn().mockResolvedValue(canonical)
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

describe('вход в раздел — решение владельца', () => {
  it('видят управленческие роли и CLIENT_ADMIN', () => {
    expect(railSectionIdForPath('/work-calendar')).toBe('works')
    for (const role of [
      'PLATFORM_ADMIN',
      'ADMIN',
      'CLIENT_ADMIN',
      'MASTER',
      'DISPATCHER',
      'NETWORK_DIRECTOR',
      'TERRITORIAL_MANAGER',
    ] as const) {
      expect(isManagementNavItemVisible('/work-calendar', { role })).toBe(true)
    }
  })

  it('TECHNICIAN, CLIENT и STAFF пункта не видят', () => {
    for (const role of ['TECHNICIAN', 'CLIENT', 'STAFF', null] as const)
      expect(isManagementNavItemVisible('/work-calendar', { role })).toBe(false)
  })

  it('карта маршрутов знает страницу', () => {
    expect(matchManagementRoute('/work-calendar')?.meta).toMatchObject({ section: 'rounds', pageLabel: 'Календарь работ' })
    expect(validateManagementRoutes()).toEqual([])
  })
})
