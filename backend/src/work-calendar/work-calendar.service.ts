import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TicketStatus, UserRole } from '@prisma/client';

import { EXECUTOR_CAPABLE_ROLES } from '../common/executor.utils';
import { hasAnyPermission } from '../common/permissions.guard';
import { PERMISSIONS } from '../common/permissions.constants';
import { nextOccurrenceAfter } from '../inspection/inspection-recurrence';
import { InspectionScheduleService } from '../inspection/inspection-schedule.service';
import { LocationsService } from '../locations/locations.service';
import { InspectionPolicy } from '../policy/inspection.policy';
import { PrismaService } from '../prisma/prisma.service';
import {
  isLocationAllowedByLocationScope,
  isLocationScopeClosed,
  resolveActorLocationScope,
  type LocationScope,
} from '../tickets/ticket-access.utils';
import { TicketsQueryService } from '../tickets/tickets.query.service';
import { scopeForClient } from '../tickets/tickets.service';
import {
  buildEmployeeResources,
  buildLocationResources,
  COMPLETED_TICKET_STATUSES,
  INSPECTION_EVENT_STATUSES,
  inspectionEvent,
  mergeEvents,
  ticketEvent,
  WORK_CALENDAR_EVENT_KINDS,
  type CalendarLocation,
  type CalendarPerson,
  type CalendarScheduleRow,
  type CalendarTicketRow,
  type InspectionEventStatus,
  type WorkCalendarEmployee,
  type WorkCalendarEvent,
  type WorkCalendarEventKind,
  type WorkCalendarLocationResource,
} from './work-calendar-events';
import {
  resolveCalendarRange,
  resolveCalendarTimeZone,
} from './work-calendar-range';

/**
 * SMA-WORK-CALENDAR-V1 — GET /work-calendar.
 *
 * Календарь не решает доступ сам. Заявки берутся по тому же WHERE, что и
 * GET /tickets (TicketsQueryService.resolveListWhere: tenant, PRIMARY и
 * SECONDARY, привязки к объектам, действующие договоры, restricted-empty),
 * а календарь только накладывает поверх диапазон и фильтры. Планы обходов —
 * через InspectionScheduleService с той же видимостью, что у
 * /inspection/schedules, и сверх неё сужаются контуром запроса и привязками
 * актора к объектам: календарь показывает один контур, а не всё сразу.
 * Справочник объектов — LocationsService.list, тот же scope, что у /locations.
 */

export const WORK_CALENDAR_VERSION = 1;

export const WORK_CALENDAR_LIMITS = {
  scheduledTickets: 1000,
  unscheduledTickets: 200,
  inspections: 500,
  employees: 300,
  locations: 300,
} as const;

/**
 * Сколько планов просматривается ради точного total. Видимость планов
 * дорешивается после выборки (договор площадки), поэтому посчитать их
 * запросом count нельзя. За этим пределом total — нижняя граница,
 * meta.totalIsExact = false.
 */
export const INSPECTION_SCAN_CAP = 5000;

const MAX_FILTER_IDS = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Кто видит штат своей компании строками календаря: те, кто планирует работу. */
const ROSTER_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
  UserRole.NETWORK_DIRECTOR,
];

export type WorkCalendarActor = {
  companyId: string;
  id: string;
  role: UserRole;
  accessFlags?: { canTechnicianViewAllCompanyTickets?: boolean };
};

export type WorkCalendarQuery = {
  from?: string;
  to?: string;
  timezone?: string;
  linkedClientCompanyId?: string;
  companyId?: string;
  employeeIds?: string | string[];
  locationIds?: string | string[];
  eventTypes?: string | string[];
  /** Прежнее имя eventTypes, принимается для совместимости. */
  types?: string | string[];
  statuses?: string | string[];
  assigned?: string;
  includeUnscheduled?: string;
  includeCompleted?: string;
};

type TruncatedSource = keyof typeof WORK_CALENDAR_LIMITS;

export type WorkCalendarResponse = {
  version: typeof WORK_CALENDAR_VERSION;
  range: { from: string; to: string; timezone: string };
  capabilities: {
    tickets: boolean;
    inspections: boolean;
    /** Полные справочники: и штат, и объекты, а не только строки по событиям. */
    resources: boolean;
    employeeDirectory: boolean;
    locationDirectory: boolean;
    readOnly: true;
    unscheduled: true;
    timeWindows: false;
    recurrenceProjection: false;
    restrictedEmpty: boolean;
  };
  resources: {
    employees: WorkCalendarEmployee[];
    locations: WorkCalendarLocationResource[];
  };
  events: WorkCalendarEvent[];
  meta: {
    /** Сколько событий подходит под запрос во всём периоде, а не в ответе. */
    total: number;
    scheduled: number;
    unscheduled: number;
    truncated: boolean;
    /** false — total нижняя граница: планов больше, чем просматривается. */
    totalIsExact: boolean;
    /** Сколько событий в этом ответе. */
    returned: { total: number; scheduled: number; unscheduled: number };
    truncatedSources: TruncatedSource[];
    limits: typeof WORK_CALENDAR_LIMITS;
    generatedAt: string;
  };
};

const locationSelect = {
  id: true,
  name: true,
  city: true,
  address: true,
  clientCompanyId: true,
} as const;

const personSelect = {
  id: true,
  firstName: true,
  lastName: true,
  companyId: true,
  role: true,
  isActive: true,
  isExecutor: true,
} as const;

const ticketSelect = {
  id: true,
  ticketNumber: true,
  companyId: true,
  status: true,
  urgency: true,
  priority: true,
  problemText: true,
  plannedDueAt: true,
  slaDueAt: true,
  parentId: true,
  location: { select: locationSelect },
  assignedTechnician: { select: personSelect },
} satisfies Prisma.TicketSelect;

type SourceResult<T> = { rows: T[]; total: number; truncated: boolean };

@Injectable()
export class WorkCalendarService {
  private readonly inspectionPolicy = new InspectionPolicy();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsQuery: TicketsQueryService,
    private readonly schedules: InspectionScheduleService,
    private readonly locations: LocationsService,
  ) {}

  async getCalendar(
    actor: WorkCalendarActor,
    query: WorkCalendarQuery,
  ): Promise<WorkCalendarResponse> {
    const company = await this.prisma.company.findUnique({
      where: { id: actor.companyId },
      select: { timezone: true },
    });
    const timeZone = resolveCalendarTimeZone(query.timezone, company?.timezone);
    const range = resolveCalendarRange({
      from: query.from,
      to: query.to,
      timeZone,
    });
    const filters = parseFilters(query);

    // Контур проверяется всегда, даже если заявки не запрошены: чужой
    // linkedClientCompanyId отклоняется тем же отказом, что и в GET /tickets.
    const scope = scopeForClient(
      actor.role,
      query.linkedClientCompanyId,
      query.companyId,
    );
    const ticketScope = await this.ticketsQuery.resolveListWhere(
      actor.companyId,
      actor.id,
      actor.role,
      undefined,
      actor.accessFlags,
      scope.linkedClientCompanyId,
      scope.observerCompanyId,
    );
    const observer = ticketScope.visibilityMode === 'platform_observer';
    const technician = ticketScope.technicianCompanyIds !== null;

    const locationScopes = new Map<string, Promise<LocationScope>>();
    const actorLocationScope = (clientCompanyId: string) => {
      let pending = locationScopes.get(clientCompanyId);
      if (!pending) {
        pending = resolveActorLocationScope({
          prisma: this.prisma,
          actor,
          scopeCompanyId: clientCompanyId,
        });
        locationScopes.set(clientCompanyId, pending);
      }
      return pending;
    };

    const restrictedEmpty =
      !observer &&
      !technician &&
      isLocationScopeClosed(
        await actorLocationScope(ticketScope.scopeCompanyId),
      );

    const locationsViewGranted =
      !observer &&
      (await hasAnyPermission(this.prisma, actor, [
        PERMISSIONS.LOCATIONS_VIEW,
      ]));

    // ── заявки ──────────────────────────────────────────────────────────────
    const ticketStatuses = allowedTicketStatuses(filters);
    let scheduledTickets: SourceResult<CalendarTicketRow> = emptySource();
    let unscheduledTickets: SourceResult<CalendarTicketRow> = emptySource();

    if (
      filters.kinds.has('TICKET') &&
      ticketScope.where &&
      ticketStatuses.length > 0
    ) {
      scheduledTickets = await this.findTickets(
        ticketScope.where,
        {
          plannedDueAt: { gte: range.from, lt: range.to },
          status: { in: ticketStatuses },
        },
        filters,
        [{ plannedDueAt: 'asc' }, { id: 'asc' }],
        WORK_CALENDAR_LIMITS.scheduledTickets,
      );
      // Без даты — только незавершённые и при includeCompleted=true: закрытая
      // заявка без плановой даты к периоду не относится, а их история
      // заполнила бы корзину целиком.
      const openStatuses = ticketStatuses.filter(
        (status) => !COMPLETED_TICKET_STATUSES.includes(status),
      );
      if (filters.includeUnscheduled && openStatuses.length > 0) {
        unscheduledTickets = await this.findTickets(
          ticketScope.where,
          { plannedDueAt: null, status: { in: openStatuses } },
          filters,
          [{ createdAt: 'asc' }, { id: 'asc' }],
          WORK_CALENDAR_LIMITS.unscheduledTickets,
        );
      }
    }

    // ── планы обходов ───────────────────────────────────────────────────────
    const inspectionsAvailable =
      locationsViewGranted &&
      this.inspectionPolicy.canViewSchedules(actor).allowed;

    let inspections: SourceResult<CalendarScheduleRow> & { exact: boolean } = {
      ...emptySource<CalendarScheduleRow>(),
      exact: true,
    };
    if (
      inspectionsAvailable &&
      filters.kinds.has('INSPECTION') &&
      (!filters.inspectionStatuses || filters.inspectionStatuses.length > 0)
    ) {
      const contourClientIds = new Set<string>(
        technician
          ? [
              ...(ticketScope.technicianCompanyIds ?? []),
              ...(scope.linkedClientCompanyId ? [] : [actor.companyId]),
            ]
          : [ticketScope.scopeCompanyId],
      );
      const result = await this.schedules.listForCalendar(actor, {
        from: range.from,
        to: range.to,
        assignedToUserIds: filters.employeeIds ?? undefined,
        assigned: filters.assigned ?? undefined,
        locationIds: filters.locationIds ?? undefined,
        take: INSPECTION_SCAN_CAP,
      });

      const visible: CalendarScheduleRow[] = [];
      for (const schedule of result.rows.slice(0, INSPECTION_SCAN_CAP)) {
        const location = schedule.location;
        if (!location || !contourClientIds.has(location.clientCompanyId)) {
          continue;
        }
        const locationScope = await actorLocationScope(
          location.clientCompanyId,
        );
        if (
          locationScope.mode !== 'tenant_wide' &&
          !isLocationAllowedByLocationScope(locationScope, location.id)
        ) {
          continue;
        }
        const row = toScheduleRow(schedule);
        if (
          filters.inspectionStatuses &&
          !filters.inspectionStatuses.includes(
            inspectionEvent(row, timeZone).status as InspectionEventStatus,
          )
        ) {
          continue;
        }
        visible.push(row);
      }
      inspections = {
        rows: visible.slice(0, WORK_CALENDAR_LIMITS.inspections),
        total: visible.length,
        truncated:
          visible.length > WORK_CALENDAR_LIMITS.inspections ||
          result.fetched > INSPECTION_SCAN_CAP,
        exact: result.fetched <= INSPECTION_SCAN_CAP,
      };
    }

    const events = mergeEvents([
      ...scheduledTickets.rows.map((row) => ticketEvent(row, timeZone)),
      ...unscheduledTickets.rows.map((row) => ticketEvent(row, timeZone)),
      ...inspections.rows.map((row) => inspectionEvent(row, timeZone)),
    ]);

    // ── resources ───────────────────────────────────────────────────────────
    const employeeDirectory =
      !observer &&
      !restrictedEmpty &&
      (ROSTER_ROLES.includes(actor.role) || actor.role === UserRole.TECHNICIAN);
    const roster = employeeDirectory
      ? await this.loadRoster(actor, filters.employeeIds)
      : { people: [], truncated: false };

    const directory =
      locationsViewGranted && !technician && !restrictedEmpty
        ? await this.loadLocationDirectory(
            actor,
            ticketScope.scopeCompanyId,
            filters.locationIds,
          )
        : null;
    const locationDirectory = directory !== null;

    const ticketRows = [...scheduledTickets.rows, ...unscheduledTickets.rows];
    const eventPeople: CalendarPerson[] = [
      ...ticketRows.map((row) => row.assignedTechnician),
      ...inspections.rows.map((row) => row.assignedTo),
    ].filter((person): person is CalendarPerson => !!person);
    const eventLocations: CalendarLocation[] = [
      ...ticketRows.map((row) => row.location),
      ...inspections.rows.map((row) => row.location),
    ];

    const truncatedSources: TruncatedSource[] = [];
    if (scheduledTickets.truncated) truncatedSources.push('scheduledTickets');
    if (unscheduledTickets.truncated) {
      truncatedSources.push('unscheduledTickets');
    }
    if (inspections.truncated) truncatedSources.push('inspections');
    if (roster.truncated) truncatedSources.push('employees');
    if (directory?.truncated) truncatedSources.push('locations');

    const scheduledTotal = scheduledTickets.total + inspections.total;
    const returnedUnscheduled = events.filter(
      (event) => event.timing.mode === 'UNSCHEDULED',
    ).length;

    return {
      version: WORK_CALENDAR_VERSION,
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        timezone: timeZone,
      },
      capabilities: {
        tickets: true,
        inspections: inspectionsAvailable,
        resources: employeeDirectory && locationDirectory,
        employeeDirectory,
        locationDirectory,
        readOnly: true,
        unscheduled: true,
        timeWindows: false,
        recurrenceProjection: false,
        restrictedEmpty,
      },
      resources: {
        employees: buildEmployeeResources({
          actorCompanyId: actor.companyId,
          roster: roster.people,
          events,
          eventPeople,
          employeeFilter: filters.employeeIds,
        }),
        locations: buildLocationResources({
          directory: directory?.locations ?? [],
          eventLocations,
          events,
          locationFilter: filters.locationIds,
        }),
      },
      events,
      meta: {
        total: scheduledTotal + unscheduledTickets.total,
        scheduled: scheduledTotal,
        unscheduled: unscheduledTickets.total,
        truncated: truncatedSources.length > 0,
        totalIsExact: inspections.exact,
        returned: {
          total: events.length,
          scheduled: events.length - returnedUnscheduled,
          unscheduled: returnedUnscheduled,
        },
        truncatedSources,
        limits: WORK_CALENDAR_LIMITS,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Выборка заявок с лимитом. total точный: при обрезке он считается тем же
   * WHERE запросом count, а не подменяется числом полученных строк.
   */
  private async findTickets(
    scopeWhere: Prisma.TicketWhereInput,
    sourceWhere: Prisma.TicketWhereInput,
    filters: ParsedFilters,
    orderBy: Prisma.TicketOrderByWithRelationInput[],
    limit: number,
  ): Promise<SourceResult<CalendarTicketRow>> {
    const and: Prisma.TicketWhereInput[] = [scopeWhere, sourceWhere];
    if (filters.employeeIds) {
      and.push({ assignedTechnicianId: { in: filters.employeeIds } });
    }
    if (filters.assigned === 'assigned') {
      and.push({ assignedTechnicianId: { not: null } });
    } else if (filters.assigned === 'unassigned') {
      and.push({ assignedTechnicianId: null });
    }
    if (filters.locationIds) {
      and.push({ locationId: { in: filters.locationIds } });
    }
    const where: Prisma.TicketWhereInput = { AND: and };
    const rows = await this.prisma.ticket.findMany({
      where,
      orderBy,
      take: limit + 1,
      select: ticketSelect,
    });
    if (rows.length <= limit) {
      return { rows, total: rows.length, truncated: false };
    }
    const total = await this.prisma.ticket.count({ where });
    return { rows: rows.slice(0, limit), total, truncated: true };
  }

  /**
   * Штат строками календаря. Планирующим ролям — исполнители своей компании,
   * технику — он сам. Исполнители других компаний сюда не попадают: они
   * появляются строками, только если исполняют видимое актору событие.
   */
  private async loadRoster(
    actor: WorkCalendarActor,
    employeeIds: string[] | null,
  ): Promise<{ people: CalendarPerson[]; truncated: boolean }> {
    const where: Prisma.UserWhereInput = {
      companyId: actor.companyId,
      isActive: true,
      deletedAt: null,
    };
    if (actor.role === UserRole.TECHNICIAN) {
      where.id = actor.id;
    } else {
      where.isExecutor = true;
      where.role = { in: [...EXECUTOR_CAPABLE_ROLES] };
      if (employeeIds) where.id = { in: employeeIds };
    }
    const rows = await this.prisma.user.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
      take: WORK_CALENDAR_LIMITS.employees + 1,
      select: personSelect,
    });
    return {
      people: rows.slice(0, WORK_CALENDAR_LIMITS.employees),
      truncated: rows.length > WORK_CALENDAR_LIMITS.employees,
    };
  }

  /**
   * Объекты без событий — тем же списком, что отдаёт /locations: компания
   * контура, привязки актора и область договора решает LocationsService.
   * Отказ там — справочник недоступен, а не ошибка календаря: заявки и обходы
   * этот же контур уже прошли.
   */
  private async loadLocationDirectory(
    actor: WorkCalendarActor,
    scopeCompanyId: string,
    locationIds: string[] | null,
  ): Promise<{ locations: CalendarLocation[]; truncated: boolean } | null> {
    let rows: CalendarLocation[];
    try {
      rows = await this.locations.list(
        actor.companyId,
        actor.role,
        actor.id,
        { isActive: 'true' },
        scopeCompanyId,
      );
    } catch {
      return null;
    }
    const filtered = locationIds
      ? rows.filter((row) => locationIds.includes(row.id))
      : rows;
    return {
      locations: filtered
        .slice(0, WORK_CALENDAR_LIMITS.locations)
        .map((row) => ({
          id: row.id,
          name: row.name,
          city: row.city,
          address: row.address,
          clientCompanyId: row.clientCompanyId,
        })),
      truncated: filtered.length > WORK_CALENDAR_LIMITS.locations,
    };
  }
}

function emptySource<T>(): SourceResult<T> {
  return { rows: [], total: 0, truncated: false };
}

type ScheduleForCalendar = Awaited<
  ReturnType<InspectionScheduleService['listForCalendar']>
>['rows'][number];

function toScheduleRow(schedule: ScheduleForCalendar): CalendarScheduleRow {
  return {
    id: schedule.id,
    companyId: schedule.companyId,
    name: schedule.name,
    frequency: schedule.frequency,
    intervalDays: schedule.intervalDays,
    nextDueAt: schedule.nextDueAt,
    followingDueAt: nextOccurrenceAfter(
      schedule,
      schedule.nextDueAt,
      schedule.company?.timezone,
    ),
    overdueAt: schedule.overdueAt,
    isOverdue: schedule.isOverdue,
    template: schedule.template,
    location: {
      id: schedule.location.id,
      name: schedule.location.name,
      city: schedule.location.city,
      address: schedule.location.address,
      clientCompanyId: schedule.location.clientCompanyId,
    },
    // Исполнитель плана — сотрудник компании плана: так его выбирает
    // resolveAssigneeId при создании и правке.
    assignedTo: schedule.assignedTo
      ? { ...schedule.assignedTo, companyId: schedule.companyId }
      : null,
    lastRun: schedule.lastRun
      ? {
          id: schedule.lastRun.id,
          status: String(schedule.lastRun.status),
          dueAt: schedule.lastRun.dueAt,
        }
      : null,
  };
}

// ── фильтры запроса ─────────────────────────────────────────────────────────

type ParsedFilters = {
  employeeIds: string[] | null;
  locationIds: string[] | null;
  kinds: Set<WorkCalendarEventKind>;
  ticketStatuses: TicketStatus[] | null;
  inspectionStatuses: InspectionEventStatus[] | null;
  assigned: 'assigned' | 'unassigned' | null;
  includeUnscheduled: boolean;
  includeCompleted: boolean;
};

const TICKET_STATUSES = Object.values(TicketStatus) as string[];

/**
 * Статусы заявок для выборки: фильтр запроса, из которого без
 * includeCompleted=true убраны завершённые. Явный statuses=DONE без
 * includeCompleted завершённых не возвращает: флаг — единственный способ их
 * запросить, и фильтр статусов его не обходит.
 */
function allowedTicketStatuses(filters: ParsedFilters): TicketStatus[] {
  const base =
    filters.ticketStatuses ?? (Object.values(TicketStatus) as TicketStatus[]);
  return filters.includeCompleted
    ? base
    : base.filter((status) => !COMPLETED_TICKET_STATUSES.includes(status));
}

export function parseFilters(query: WorkCalendarQuery): ParsedFilters {
  const employeeIds = parseIdList(query.employeeIds, 'employeeIds');
  const locationIds = parseIdList(query.locationIds, 'locationIds');

  const rawKinds = splitList(query.eventTypes ?? query.types);
  for (const kind of rawKinds) {
    if (!(WORK_CALENDAR_EVENT_KINDS as readonly string[]).includes(kind)) {
      throw new BadRequestException(`Unknown event type: ${kind}`);
    }
  }
  const kinds = new Set<WorkCalendarEventKind>(
    (rawKinds.length > 0
      ? rawKinds
      : [...WORK_CALENDAR_EVENT_KINDS]) as WorkCalendarEventKind[],
  );

  const rawStatuses = splitList(query.statuses);
  for (const status of rawStatuses) {
    if (
      !TICKET_STATUSES.includes(status) &&
      !(INSPECTION_EVENT_STATUSES as readonly string[]).includes(status)
    ) {
      throw new BadRequestException(`Unknown status: ${status}`);
    }
  }
  const hasStatuses = rawStatuses.length > 0;

  const assignedRaw = (query.assigned ?? '').trim();
  if (assignedRaw && !['all', 'assigned', 'unassigned'].includes(assignedRaw)) {
    throw new BadRequestException(
      'assigned must be all, assigned or unassigned',
    );
  }

  return {
    employeeIds,
    locationIds,
    kinds,
    ticketStatuses: hasStatuses
      ? (rawStatuses.filter((status) =>
          TICKET_STATUSES.includes(status),
        ) as TicketStatus[])
      : null,
    inspectionStatuses: hasStatuses
      ? (rawStatuses.filter((status) =>
          (INSPECTION_EVENT_STATUSES as readonly string[]).includes(status),
        ) as InspectionEventStatus[])
      : null,
    assigned:
      assignedRaw === 'assigned' || assignedRaw === 'unassigned'
        ? assignedRaw
        : null,
    includeUnscheduled: parseFlag(
      query.includeUnscheduled,
      'includeUnscheduled',
      true,
    ),
    includeCompleted: parseFlag(
      query.includeCompleted,
      'includeCompleted',
      false,
    ),
  };
}

function parseFlag(
  value: string | undefined,
  name: string,
  fallback: boolean,
): boolean {
  const flag = (value ?? '').trim();
  if (!flag) return fallback;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  throw new BadRequestException(`${name} must be true or false`);
}

function splitList(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const items = values
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set(items)];
}

/**
 * Пустой список — отсутствие фильтра. Иначе фильтр сужает, и только сужает:
 * календарь пересекает его с видимым, а не подставляет вместо видимого.
 */
function parseIdList(
  value: string | string[] | undefined,
  name: string,
): string[] | null {
  const items = splitList(value);
  if (items.length === 0) return null;
  if (items.length > MAX_FILTER_IDS) {
    throw new BadRequestException(`${name}: at most ${MAX_FILTER_IDS} ids`);
  }
  for (const item of items) {
    if (!UUID.test(item)) {
      throw new BadRequestException(`Invalid id in ${name}`);
    }
  }
  return items;
}
