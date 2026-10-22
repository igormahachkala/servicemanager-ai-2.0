/**
 * SMA-WORK-CALENDAR-V1 — локальные данные для разработки интерфейса.
 *
 * Только dev-сборка: страница грузит модуль динамическим импортом под
 * import.meta.env.DEV и параметром ?mock=…, в production-бандл он не попадает.
 * Нужен, пока GET /work-calendar не влит. Форма — контракт из workCalendarApi.
 *
 * ?mock=1         — полный ответ;
 * ?mock=partial   — обходы и ресурсы недоступны (capabilities);
 * ?mock=truncated — ответ обрезан (meta.truncated).
 */
import type { WorkCalendarEvent, WorkCalendarParams, WorkCalendarResponse } from './workCalendarApi'

const EMPLOYEES = [
  { id: 'emp-ivanov', displayName: 'Иванов Сергей', role: 'TECHNICIAN' },
  { id: 'emp-petrova', displayName: 'Петрова Анна', role: 'MASTER' },
  { id: 'emp-sidorov', displayName: 'Сидоров Олег', role: 'TECHNICIAN' },
  { id: 'emp-kuznetsov', displayName: 'Кузнецов Илья', role: 'TECHNICIAN' },
]

const LOCATIONS = [
  { id: 'loc-1', name: 'ТЦ «Галерея»', city: 'Екатеринбург', address: 'ул. Малышева, 5', clientName: 'Сеть «Север»' },
  { id: 'loc-2', name: 'Магазин №14', city: 'Екатеринбург', address: 'пр. Ленина, 40', clientName: 'Сеть «Север»' },
  { id: 'loc-3', name: 'Склад «Восток»', city: 'Челябинск', address: 'ул. Труда, 101', clientName: 'Логистик' },
  { id: 'loc-4', name: 'Офис «Центр»', city: 'Тюмень', address: 'ул. Республики, 3', clientName: 'Логистик' },
]

function at(from: Date, dayOffset: number, hours: number, minutes = 0): string {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + dayOffset, hours, minutes).toISOString()
}

function ticket(
  id: string,
  title: string,
  status: string,
  employeeId: string | null,
  locationId: string | null,
  dueAt: string | null,
): WorkCalendarEvent {
  return {
    id: `ticket:${id}`,
    kind: 'TICKET',
    source: 'TICKET',
    entityId: id,
    ticketId: id,
    scheduleId: null,
    workOrderId: null,
    companyId: 'company-provider',
    clientCompanyId: 'company-client',
    locationId,
    employeeId,
    title,
    status,
    timing: { mode: dueAt ? 'DUE' : 'UNSCHEDULED', startAt: null, endAt: null, dueAt, hasWindow: false },
  }
}

function inspection(
  id: string,
  title: string,
  employeeId: string | null,
  locationId: string,
  dueAt: string,
  frequency: string,
  isOverdue: boolean,
): WorkCalendarEvent {
  return {
    id: `inspection:${id}`,
    kind: 'INSPECTION',
    source: 'INSPECTION_SCHEDULE',
    entityId: id,
    ticketId: null,
    scheduleId: id,
    workOrderId: null,
    companyId: 'company-provider',
    clientCompanyId: 'company-client',
    locationId,
    employeeId,
    title,
    status: isOverdue ? 'OVERDUE' : 'ACTIVE',
    timing: { mode: 'DUE', startAt: null, endAt: null, dueAt, hasWindow: false },
    recurrence: { frequency, intervalDays: null, nextDueAt: dueAt, overdueAt: isOverdue ? dueAt : null, isOverdue },
  }
}

export function buildWorkCalendarMock(params: WorkCalendarParams, mode: string): WorkCalendarResponse {
  const from = new Date(params.from)
  const to = new Date(params.to)
  const spanDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000))
  const day = (n: number) => n % spanDays

  let events: WorkCalendarEvent[] = [
    ticket('t-101', 'Не работает кондиционер в торговом зале', 'ASSIGNED', 'emp-ivanov', 'loc-1', at(from, day(0), 11)),
    ticket('t-102', 'Замена ламп на складе', 'IN_PROGRESS', 'emp-ivanov', 'loc-3', at(from, day(0), 16, 30)),
    ticket('t-103', 'Протечка кровли', 'NEW', null, 'loc-2', at(from, day(1), 10)),
    ticket('t-104', 'Ремонт входной группы', 'AWAITING_ACCEPTANCE', 'emp-petrova', 'loc-2', at(from, day(2), 18)),
    ticket('t-105', 'Шум вентиляции в офисе', 'ASSIGNED', 'emp-sidorov', 'loc-1', at(from, day(3), 9, 45)),
    ticket('t-106', 'Проверка щитовой', 'DONE', 'emp-sidorov', 'loc-3', at(from, day(4), 12)),
    ticket('t-107', 'Заменить замок служебной двери', 'NEW', null, 'loc-1', null),
    ticket('t-108', 'Покраска ограждения', 'ASSIGNED', 'emp-petrova', 'loc-3', null),
    ticket('t-109', 'Осмотр фасада после ветра', 'NEW', null, null, null),
    inspection('s-201', 'Ежедневный обход ТЦ', 'emp-petrova', 'loc-1', at(from, day(0), 8), 'DAILY', true),
    inspection('s-202', 'Обход холодильного оборудования', 'emp-ivanov', 'loc-2', at(from, day(2), 14), 'WEEKLY', false),
    inspection('s-203', 'Пожарная безопасность склада', null, 'loc-3', at(from, day(5), 10), 'MONTHLY', false),
  ]
  for (let i = 7; i < spanDays; i += 3) {
    events.push(
      ticket(
        `t-3${i}`,
        `Плановое ТО, партия ${i}`,
        'ASSIGNED',
        i % 2 ? 'emp-sidorov' : 'emp-ivanov',
        i % 2 ? 'loc-2' : 'loc-3',
        at(from, i, 13),
      ),
    )
  }

  const capabilities = { tickets: true, inspections: mode !== 'partial', resources: mode !== 'partial' }
  if (!capabilities.inspections) events = events.filter((e) => e.kind !== 'INSPECTION')

  // Как сервер: фильтры сужают ответ.
  const has = (list: readonly string[] | undefined, value: string | null) => !list?.length || (value != null && list.includes(value))
  events = events.filter(
    (e) =>
      has(params.employeeIds, e.employeeId) &&
      has(params.locationIds, e.locationId) &&
      has(params.eventTypes, e.kind) &&
      has(params.statuses, e.status) &&
      (params.includeCompleted || !['DONE', 'CANCELED'].includes(e.status ?? '')) &&
      (params.includeUnscheduled !== false || e.timing.mode === 'DUE') &&
      (params.assigned !== 'assigned' || e.employeeId) &&
      (params.assigned !== 'unassigned' || !e.employeeId),
  )

  const total = events.length
  if (mode === 'truncated') events = events.slice(0, Math.max(1, Math.floor(total / 2)))

  const count = (id: string, key: 'employeeId' | 'locationId') => events.filter((e) => e[key] === id).length
  return {
    version: 1,
    range: { from: params.from, to: params.to, timezone: params.timezone || 'UTC' },
    capabilities,
    resources: capabilities.resources
      ? {
          employees: EMPLOYEES.map((e) => ({
            ...e,
            companyId: 'company-provider',
            isActive: true,
            isExecutor: true,
            eventCount: count(e.id, 'employeeId'),
          })),
          locations: LOCATIONS.map((l) => ({ ...l, clientCompanyId: 'company-client', eventCount: count(l.id, 'locationId') })),
        }
      : { employees: [], locations: [] },
    events,
    meta: {
      total,
      scheduled: events.filter((e) => e.timing.mode === 'DUE').length,
      unscheduled: events.filter((e) => e.timing.mode === 'UNSCHEDULED').length,
      truncated: mode === 'truncated',
    },
  }
}
