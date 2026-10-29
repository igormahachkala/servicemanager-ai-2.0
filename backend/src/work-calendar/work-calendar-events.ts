import { TicketStatus, UserRole } from '@prisma/client';

import { localDateOf } from './work-calendar-range';

/**
 * SMA-WORK-CALENDAR-V1 — события календаря из уже отобранных строк.
 *
 * Здесь нет доступа и нет БД: строки приходят из выборок, суженных
 * действующими scope заявок и обходов. Файл решает только, как строка
 * становится событием, и из чего собираются resources.
 *
 * Форма события — согласованный контракт (аудит Агента 2 от 22.10.2026,
 * раздел 3): kind, source, entityId, ticketId, scheduleId, locationId,
 * employeeId, timing, recurrence.
 *
 * Время начала и длительности в моделях нет. timing несёт плановый срок
 * (dueAt) и местные сутки этого срока, а startAt/endAt всегда null и
 * hasWindow = false: календарь не придумывает окно, которого никто не задавал.
 */

export const WORK_CALENDAR_EVENT_KINDS = ['TICKET', 'INSPECTION'] as const;
export type WorkCalendarEventKind = (typeof WORK_CALENDAR_EVENT_KINDS)[number];
export type WorkCalendarEventSource = 'TICKET' | 'INSPECTION_SCHEDULE';

/** Состояние визита плана обходов. Свой набор: у плана нет статуса заявки. */
export const INSPECTION_EVENT_STATUSES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'OVERDUE',
] as const;
export type InspectionEventStatus = (typeof INSPECTION_EVENT_STATUSES)[number];

export type WorkCalendarEventStatus = TicketStatus | InspectionEventStatus;

/**
 * Завершённые заявки: клиент закрыл или заявку отменили. Сданная подрядчиком
 * (AWAITING_ACCEPTANCE, FIELD_COMPLETE) ещё не завершена — её ждёт приёмка.
 */
export const COMPLETED_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.DONE,
  TicketStatus.CANCELED,
];

export type CalendarPerson = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  companyId: string;
  role?: UserRole | null;
  isActive?: boolean | null;
  isExecutor?: boolean | null;
};

export type CalendarLocation = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  clientCompanyId: string;
};

export type CalendarTicketRow = {
  id: string;
  ticketNumber: number;
  companyId: string;
  status: TicketStatus;
  urgency: string;
  priority: string;
  problemText: string;
  plannedDueAt: Date | null;
  slaDueAt: Date | null;
  parentId: string | null;
  location: CalendarLocation;
  assignedTechnician: CalendarPerson | null;
};

export type CalendarScheduleRow = {
  id: string;
  companyId: string;
  name: string;
  frequency: string;
  intervalDays: number | null;
  nextDueAt: Date;
  /** Следующий срок по сетке плана после текущего — из inspection-recurrence. */
  followingDueAt: Date | null;
  overdueAt: Date;
  isOverdue: boolean;
  template: { id: string; name: string } | null;
  location: CalendarLocation;
  assignedTo: CalendarPerson | null;
  lastRun: { id: string; status: string; dueAt: Date | null } | null;
};

export type WorkCalendarTiming = {
  mode: 'DUE' | 'UNSCHEDULED';
  /** Срок: Ticket.plannedDueAt или InspectionSchedule.nextDueAt. Не время начала. */
  dueAt: string | null;
  /** Местные сутки срока в поясе календаря, YYYY-MM-DD. */
  localDate: string | null;
  startAt: null;
  endAt: null;
  hasWindow: false;
};

export type WorkCalendarRecurrence = {
  frequency: string;
  intervalDays: number | null;
  nextDueAt: string;
  overdueAt: string;
  isOverdue: boolean;
  followingDueAt: string | null;
};

export type WorkCalendarEvent = {
  id: string;
  kind: WorkCalendarEventKind;
  source: WorkCalendarEventSource;
  entityId: string;
  ticketId: string | null;
  scheduleId: string | null;
  /** Владелец записи: компания заявки либо компания, составившая план. */
  companyId: string;
  clientCompanyId: string;
  locationId: string;
  employeeId: string | null;
  title: string;
  status: WorkCalendarEventStatus;
  timing: WorkCalendarTiming;
  recurrence: WorkCalendarRecurrence | null;
  ticket: {
    ticketNumber: number;
    urgency: string;
    priority: string;
    slaDueAt: string | null;
    parentId: string | null;
  } | null;
  inspection: {
    templateName: string | null;
    lastRunId: string | null;
  } | null;
};

/**
 * Строка сотрудника.
 *
 * companyId, role, isActive, isExecutor — только у сотрудников компании
 * актора. У исполнителя другой компании (подрядчик на заявке клиента) они
 * null: календарь показывает, кто исполняет видимую работу, но не раскрывает
 * чужой штат, роли и внутренние признаки.
 */
export type WorkCalendarEmployee = {
  id: string;
  displayName: string;
  companyId: string | null;
  role: UserRole | null;
  isActive: boolean | null;
  isExecutor: boolean | null;
  isOwnCompany: boolean;
  /** Событий этого сотрудника в ответе (не в полном периоде при обрезке). */
  eventCount: number;
};

export type WorkCalendarLocationResource = CalendarLocation & {
  /** Событий на объекте в ответе (не в полном периоде при обрезке). */
  eventCount: number;
};

const TITLE_LIMIT = 140;

export function ticketEvent(
  row: CalendarTicketRow,
  timeZone: string,
): WorkCalendarEvent {
  return {
    id: `ticket:${row.id}`,
    kind: 'TICKET',
    source: 'TICKET',
    entityId: row.id,
    ticketId: row.id,
    scheduleId: null,
    companyId: row.companyId,
    clientCompanyId: row.location.clientCompanyId,
    locationId: row.location.id,
    employeeId: row.assignedTechnician?.id ?? null,
    title: `#${row.ticketNumber} ${truncate(row.problemText)}`.trim(),
    status: row.status,
    timing: timing(row.plannedDueAt, timeZone),
    recurrence: null,
    ticket: {
      ticketNumber: row.ticketNumber,
      urgency: row.urgency,
      priority: row.priority,
      slaDueAt: row.slaDueAt ? row.slaDueAt.toISOString() : null,
      parentId: row.parentId,
    },
    inspection: null,
  };
}

/**
 * Визит плана в работе — это обход, запущенный именно на текущий срок:
 * обход прошлого визита план уже сдвинул (inspection-schedule-advance).
 */
export function inspectionEventStatus(
  row: Pick<CalendarScheduleRow, 'nextDueAt' | 'isOverdue' | 'lastRun'>,
): InspectionEventStatus {
  const run = row.lastRun;
  if (
    run &&
    run.status === 'IN_PROGRESS' &&
    run.dueAt &&
    run.dueAt.getTime() === row.nextDueAt.getTime()
  ) {
    return 'IN_PROGRESS';
  }
  return row.isOverdue ? 'OVERDUE' : 'SCHEDULED';
}

export function inspectionEvent(
  row: CalendarScheduleRow,
  timeZone: string,
): WorkCalendarEvent {
  return {
    id: `inspection:${row.id}`,
    kind: 'INSPECTION',
    source: 'INSPECTION_SCHEDULE',
    entityId: row.id,
    ticketId: null,
    scheduleId: row.id,
    companyId: row.companyId,
    clientCompanyId: row.location.clientCompanyId,
    locationId: row.location.id,
    employeeId: row.assignedTo?.id ?? null,
    title: row.name,
    status: inspectionEventStatus(row),
    timing: timing(row.nextDueAt, timeZone),
    recurrence: {
      frequency: row.frequency,
      intervalDays: row.intervalDays,
      nextDueAt: row.nextDueAt.toISOString(),
      overdueAt: row.overdueAt.toISOString(),
      isOverdue: row.isOverdue,
      followingDueAt: row.followingDueAt
        ? row.followingDueAt.toISOString()
        : null,
    },
    ticket: null,
    inspection: {
      templateName: row.template?.name ?? null,
      lastRunId: row.lastRun?.id ?? null,
    },
  };
}

function timing(dueAt: Date | null, timeZone: string): WorkCalendarTiming {
  return {
    mode: dueAt ? 'DUE' : 'UNSCHEDULED',
    dueAt: dueAt ? dueAt.toISOString() : null,
    localDate: dueAt ? localDateOf(dueAt, timeZone) : null,
    startAt: null,
    endAt: null,
    hasWindow: false,
  };
}

/**
 * Одна сущность — одно событие. Выборки заявок по сроку и без срока не
 * пересекаются по условию, но строка может прийти дважды (повтор страницы,
 * будущая выборка по второму контуру), и календарь не должен её удвоить.
 *
 * Порядок: со сроком по сроку, затем без срока; при равенстве — по виду и id,
 * чтобы ответ был стабильным между запросами.
 */
export function mergeEvents(events: WorkCalendarEvent[]): WorkCalendarEvent[] {
  const byId = new Map<string, WorkCalendarEvent>();
  for (const event of events) {
    if (!byId.has(event.id)) byId.set(event.id, event);
  }
  return [...byId.values()].sort(compareEvents);
}

function compareEvents(a: WorkCalendarEvent, b: WorkCalendarEvent): number {
  const aDue = a.timing.dueAt;
  const bDue = b.timing.dueAt;
  if (aDue !== bDue) {
    if (aDue === null) return 1;
    if (bDue === null) return -1;
    return aDue < bDue ? -1 : 1;
  }
  if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Строки сотрудников.
 *
 * Источники только два: штат компании актора, который ему разрешено видеть
 * (roster, собирает сервис), и исполнители уже видимых событий. Идентификаторы
 * из фильтра запроса сюда не попадают никогда: чужой id в employeeIds не
 * превращается в строку с именем. Сотрудник без событий остаётся строкой —
 * пустой день диспетчеру тоже нужен.
 */
export function buildEmployeeResources(params: {
  actorCompanyId: string;
  roster: CalendarPerson[];
  events: WorkCalendarEvent[];
  eventPeople: CalendarPerson[];
  employeeFilter: string[] | null;
}): WorkCalendarEmployee[] {
  const counts = countBy(params.events.map((event) => event.employeeId));
  const filter = params.employeeFilter ? new Set(params.employeeFilter) : null;

  const byId = new Map<string, WorkCalendarEmployee>();
  const add = (person: CalendarPerson) => {
    if (byId.has(person.id)) return;
    if (filter && !filter.has(person.id)) return;
    const own = person.companyId === params.actorCompanyId;
    byId.set(person.id, {
      id: person.id,
      displayName: displayName(person),
      companyId: own ? person.companyId : null,
      role: own ? (person.role ?? null) : null,
      isActive: own ? (person.isActive ?? null) : null,
      isExecutor: own ? (person.isExecutor ?? null) : null,
      isOwnCompany: own,
      eventCount: counts.get(person.id) ?? 0,
    });
  };

  for (const person of params.roster) add(person);
  for (const person of params.eventPeople) {
    if (counts.has(person.id)) add(person);
  }

  return [...byId.values()].sort(
    (a, b) =>
      a.displayName.localeCompare(b.displayName, 'ru') ||
      (a.id < b.id ? -1 : 1),
  );
}

/**
 * Объекты: справочник, который актору разрешено видеть (directory, собирает
 * сервис тем же scope, что /locations), плюс объекты видимых событий.
 * Справочник пуст, если доступа к нему нет: тогда строки только по событиям.
 */
export function buildLocationResources(params: {
  directory: CalendarLocation[];
  eventLocations: CalendarLocation[];
  events: WorkCalendarEvent[];
  locationFilter: string[] | null;
}): WorkCalendarLocationResource[] {
  const counts = countBy(params.events.map((event) => event.locationId));
  const filter = params.locationFilter ? new Set(params.locationFilter) : null;

  const byId = new Map<string, WorkCalendarLocationResource>();
  const add = (location: CalendarLocation) => {
    if (byId.has(location.id)) return;
    if (filter && !filter.has(location.id)) return;
    byId.set(location.id, {
      id: location.id,
      name: location.name,
      city: location.city,
      address: location.address,
      clientCompanyId: location.clientCompanyId,
      eventCount: counts.get(location.id) ?? 0,
    });
  };

  for (const location of params.directory) add(location);
  for (const location of params.eventLocations) {
    if (counts.has(location.id)) add(location);
  }

  return [...byId.values()].sort(
    (a, b) => a.name.localeCompare(b.name, 'ru') || (a.id < b.id ? -1 : 1),
  );
}

function countBy(keys: Array<string | null>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const key of keys) {
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function displayName(person: CalendarPerson): string {
  const name = [person.lastName, person.firstName]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return name || 'Без имени';
}

function truncate(text: string): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > TITLE_LIMIT
    ? `${flat.slice(0, TITLE_LIMIT - 1)}…`
    : flat;
}
