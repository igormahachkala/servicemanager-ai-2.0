import { TicketStatus } from '@prisma/client';

import { localDateOf } from './work-calendar-range';

/**
 * SMA-WORK-CALENDAR-V1 — события календаря из уже отобранных строк.
 *
 * Здесь нет доступа и нет БД: строки приходят из выборок, суженных
 * действующими scope заявок и обходов. Файл решает только, как строка
 * становится событием, и из чего собираются resources.
 *
 * Время начала и длительности в моделях нет. Событие несёт плановый срок
 * (dueAt) и местные сутки этого срока, а startAt/endAt всегда null и
 * hasWindow = false: календарь не придумывает окно, которого никто не задавал.
 */

export const WORK_CALENDAR_EVENT_TYPES = ['TICKET', 'INSPECTION'] as const;
export type WorkCalendarEventType = (typeof WORK_CALENDAR_EVENT_TYPES)[number];

/** Состояние визита плана обходов. Свой набор: у плана нет статуса заявки. */
export const INSPECTION_EVENT_STATUSES = [
  'PLANNED',
  'IN_PROGRESS',
  'OVERDUE',
] as const;
export type InspectionEventStatus = (typeof INSPECTION_EVENT_STATUSES)[number];

export type WorkCalendarEventStatus = TicketStatus | InspectionEventStatus;

/** Заявка без плановой даты, которая ещё может потребовать работы. */
export const UNSCHEDULED_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.NEW,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
  TicketStatus.AWAITING_ACCEPTANCE,
  TicketStatus.FIELD_COMPLETE,
];

export type CalendarPerson = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  companyId: string;
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

export type WorkCalendarEvent = {
  id: string;
  type: WorkCalendarEventType;
  sourceId: string;
  title: string;
  status: WorkCalendarEventStatus;
  scheduling: 'SCHEDULED' | 'UNSCHEDULED';
  dueAt: string | null;
  localDate: string | null;
  startAt: null;
  endAt: null;
  hasWindow: false;
  employeeId: string | null;
  locationId: string;
  clientCompanyId: string;
  ticket?: {
    ticketNumber: number;
    urgency: string;
    priority: string;
    slaDueAt: string | null;
    parentId: string | null;
  };
  inspection?: {
    frequency: string;
    intervalDays: number | null;
    templateName: string | null;
    overdueAt: string;
    isOverdue: boolean;
    followingDueAt: string | null;
    lastRunId: string | null;
  };
};

export type WorkCalendarEmployee = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  /** Сотрудник компании актора. Иначе — исполнитель видимой актору заявки. */
  isOwnCompany: boolean;
};

export type WorkCalendarLocationResource = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  clientCompanyId: string;
};

const TITLE_LIMIT = 140;

export function ticketEvent(
  row: CalendarTicketRow,
  timeZone: string,
): WorkCalendarEvent {
  return {
    id: `ticket:${row.id}`,
    type: 'TICKET',
    sourceId: row.id,
    title: `#${row.ticketNumber} ${truncate(row.problemText)}`.trim(),
    status: row.status,
    scheduling: row.plannedDueAt ? 'SCHEDULED' : 'UNSCHEDULED',
    dueAt: row.plannedDueAt ? row.plannedDueAt.toISOString() : null,
    localDate: row.plannedDueAt
      ? localDateOf(row.plannedDueAt, timeZone)
      : null,
    startAt: null,
    endAt: null,
    hasWindow: false,
    employeeId: row.assignedTechnician?.id ?? null,
    locationId: row.location.id,
    clientCompanyId: row.location.clientCompanyId,
    ticket: {
      ticketNumber: row.ticketNumber,
      urgency: row.urgency,
      priority: row.priority,
      slaDueAt: row.slaDueAt ? row.slaDueAt.toISOString() : null,
      parentId: row.parentId,
    },
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
  return row.isOverdue ? 'OVERDUE' : 'PLANNED';
}

export function inspectionEvent(
  row: CalendarScheduleRow,
  timeZone: string,
): WorkCalendarEvent {
  return {
    id: `inspection:${row.id}`,
    type: 'INSPECTION',
    sourceId: row.id,
    title: row.name,
    status: inspectionEventStatus(row),
    scheduling: 'SCHEDULED',
    dueAt: row.nextDueAt.toISOString(),
    localDate: localDateOf(row.nextDueAt, timeZone),
    startAt: null,
    endAt: null,
    hasWindow: false,
    employeeId: row.assignedTo?.id ?? null,
    locationId: row.location.id,
    clientCompanyId: row.location.clientCompanyId,
    inspection: {
      frequency: row.frequency,
      intervalDays: row.intervalDays,
      templateName: row.template?.name ?? null,
      overdueAt: row.overdueAt.toISOString(),
      isOverdue: row.isOverdue,
      followingDueAt: row.followingDueAt
        ? row.followingDueAt.toISOString()
        : null,
      lastRunId: row.lastRun?.id ?? null,
    },
  };
}

/**
 * Одна сущность — одно событие. Выборки заявок по сроку и без срока не
 * пересекаются по условию, но строка может прийти дважды (повтор страницы,
 * будущая выборка по второму контуру), и календарь не должен её удвоить.
 *
 * Порядок: со сроком по сроку, затем без срока; при равенстве — по типу и id,
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
  if (a.dueAt !== b.dueAt) {
    if (a.dueAt === null) return 1;
    if (b.dueAt === null) return -1;
    return a.dueAt < b.dueAt ? -1 : 1;
  }
  if (a.type !== b.type) return a.type < b.type ? -1 : 1;
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
  const assigned = new Set(
    params.events
      .map((event) => event.employeeId)
      .filter((id): id is string => !!id),
  );
  const filter = params.employeeFilter ? new Set(params.employeeFilter) : null;

  const byId = new Map<string, WorkCalendarEmployee>();
  const add = (person: CalendarPerson) => {
    if (byId.has(person.id)) return;
    if (filter && !filter.has(person.id)) return;
    byId.set(person.id, {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      displayName: displayName(person),
      isOwnCompany: person.companyId === params.actorCompanyId,
    });
  };

  for (const person of params.roster) add(person);
  for (const person of params.eventPeople) {
    if (assigned.has(person.id)) add(person);
  }

  return [...byId.values()].sort(
    (a, b) =>
      a.displayName.localeCompare(b.displayName, 'ru') ||
      (a.id < b.id ? -1 : 1),
  );
}

/** Объекты — только те, на которых есть видимые события. */
export function buildLocationResources(
  locations: CalendarLocation[],
  events: WorkCalendarEvent[],
): WorkCalendarLocationResource[] {
  const used = new Set(events.map((event) => event.locationId));
  const byId = new Map<string, WorkCalendarLocationResource>();
  for (const location of locations) {
    if (!used.has(location.id) || byId.has(location.id)) continue;
    byId.set(location.id, {
      id: location.id,
      name: location.name,
      city: location.city,
      address: location.address,
      clientCompanyId: location.clientCompanyId,
    });
  }
  return [...byId.values()].sort(
    (a, b) => a.name.localeCompare(b.name, 'ru') || (a.id < b.id ? -1 : 1),
  );
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
