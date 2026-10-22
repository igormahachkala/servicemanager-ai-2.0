import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TicketStatus, UserRole } from '@prisma/client';

import { EXECUTOR_CAPABLE_ROLES } from '../common/executor.utils';
import { hasAnyPermission } from '../common/permissions.guard';
import { PERMISSIONS } from '../common/permissions.constants';
import { nextOccurrenceAfter } from '../inspection/inspection-recurrence';
import { InspectionScheduleService } from '../inspection/inspection-schedule.service';
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
  INSPECTION_EVENT_STATUSES,
  inspectionEvent,
  mergeEvents,
  ticketEvent,
  UNSCHEDULED_TICKET_STATUSES,
  WORK_CALENDAR_EVENT_TYPES,
  type CalendarLocation,
  type CalendarPerson,
  type CalendarScheduleRow,
  type CalendarTicketRow,
  type InspectionEventStatus,
  type WorkCalendarEmployee,
  type WorkCalendarEvent,
  type WorkCalendarEventType,
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
 */

export const WORK_CALENDAR_LIMITS = {
  scheduledTickets: 1000,
  unscheduledTickets: 200,
  inspections: 500,
  employees: 300,
} as const;

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
  types?: string | string[];
  statuses?: string | string[];
  includeUnscheduled?: string;
};

type TruncatedSource = keyof typeof WORK_CALENDAR_LIMITS;

export type WorkCalendarResponse = {
  range: { from: string; to: string; timezone: string };
  resources: {
    employees: WorkCalendarEmployee[];
    locations: WorkCalendarLocationResource[];
  };
  events: WorkCalendarEvent[];
  capabilities: {
    readOnly: true;
    eventTypes: Record<WorkCalendarEventType, boolean>;
    unscheduled: boolean;
    timeWindows: false;
    recurrenceProjection: false;
    employeeRoster: boolean;
    restrictedEmpty: boolean;
  };
  meta: {
    truncated: boolean;
    truncatedSources: TruncatedSource[];
    limits: typeof WORK_CALENDAR_LIMITS;
    counts: {
      scheduledTickets: number;
      unscheduledTickets: number;
      inspections: number;
    };
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

@Injectable()
export class WorkCalendarService {
  private readonly inspectionPolicy = new InspectionPolicy();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsQuery: TicketsQueryService,
    private readonly schedules: InspectionScheduleService,
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

    const truncatedSources: TruncatedSource[] = [];
    const ticketRows: CalendarTicketRow[] = [];
    let scheduledTickets = 0;
    let unscheduledTickets = 0;

    if (filters.types.has('TICKET') && ticketScope.where) {
      const scheduledStatuses = filters.ticketStatuses;
      if (!scheduledStatuses || scheduledStatuses.length > 0) {
        const rows = await this.findTickets(
          ticketScope.where,
          {
            plannedDueAt: { gte: range.from, lt: range.to },
            ...(scheduledStatuses ? { status: { in: scheduledStatuses } } : {}),
          },
          filters,
          [{ plannedDueAt: 'asc' }, { id: 'asc' }],
          WORK_CALENDAR_LIMITS.scheduledTickets,
        );
        if (rows.length > WORK_CALENDAR_LIMITS.scheduledTickets) {
          truncatedSources.push('scheduledTickets');
        }
        const kept = rows.slice(0, WORK_CALENDAR_LIMITS.scheduledTickets);
        scheduledTickets = kept.length;
        ticketRows.push(...kept);
      }

      const unscheduledStatuses = UNSCHEDULED_TICKET_STATUSES.filter(
        (status) =>
          !filters.ticketStatuses || filters.ticketStatuses.includes(status),
      );
      if (filters.includeUnscheduled && unscheduledStatuses.length > 0) {
        const rows = await this.findTickets(
          ticketScope.where,
          { plannedDueAt: null, status: { in: unscheduledStatuses } },
          filters,
          [{ createdAt: 'asc' }, { id: 'asc' }],
          WORK_CALENDAR_LIMITS.unscheduledTickets,
        );
        if (rows.length > WORK_CALENDAR_LIMITS.unscheduledTickets) {
          truncatedSources.push('unscheduledTickets');
        }
        const kept = rows.slice(0, WORK_CALENDAR_LIMITS.unscheduledTickets);
        unscheduledTickets = kept.length;
        ticketRows.push(...kept);
      }
    }

    const inspectionsAvailable =
      !observer &&
      this.inspectionPolicy.canViewSchedules(actor).allowed &&
      (await hasAnyPermission(this.prisma, actor, [
        PERMISSIONS.LOCATIONS_VIEW,
      ]));

    let scheduleRows: CalendarScheduleRow[] = [];
    if (
      inspectionsAvailable &&
      filters.types.has('INSPECTION') &&
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
        locationIds: filters.locationIds ?? undefined,
        take: WORK_CALENDAR_LIMITS.inspections,
      });
      if (result.fetched > WORK_CALENDAR_LIMITS.inspections) {
        truncatedSources.push('inspections');
      }

      const rows: CalendarScheduleRow[] = [];
      for (const schedule of result.rows.slice(
        0,
        WORK_CALENDAR_LIMITS.inspections,
      )) {
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
        rows.push(toScheduleRow(schedule));
      }
      scheduleRows = rows.filter(
        (row) =>
          !filters.inspectionStatuses ||
          filters.inspectionStatuses.includes(
            inspectionEvent(row, timeZone).status as InspectionEventStatus,
          ),
      );
    }

    const events = mergeEvents([
      ...ticketRows.map((row) => ticketEvent(row, timeZone)),
      ...scheduleRows.map((row) => inspectionEvent(row, timeZone)),
    ]);

    const rosterAllowed =
      !observer &&
      !restrictedEmpty &&
      (ROSTER_ROLES.includes(actor.role) || actor.role === UserRole.TECHNICIAN);
    const roster = rosterAllowed
      ? await this.loadRoster(actor, filters.employeeIds)
      : { people: [], truncated: false };
    if (roster.truncated) truncatedSources.push('employees');

    const eventPeople: CalendarPerson[] = [
      ...ticketRows.map((row) => row.assignedTechnician),
      ...scheduleRows.map((row) => row.assignedTo),
    ].filter((person): person is CalendarPerson => !!person);
    const eventLocations: CalendarLocation[] = [
      ...ticketRows.map((row) => row.location),
      ...scheduleRows.map((row) => row.location),
    ];

    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        timezone: timeZone,
      },
      resources: {
        employees: buildEmployeeResources({
          actorCompanyId: actor.companyId,
          roster: roster.people,
          events,
          eventPeople,
          employeeFilter: filters.employeeIds,
        }),
        locations: buildLocationResources(eventLocations, events),
      },
      events,
      capabilities: {
        readOnly: true,
        eventTypes: { TICKET: true, INSPECTION: inspectionsAvailable },
        unscheduled: true,
        timeWindows: false,
        recurrenceProjection: false,
        employeeRoster: rosterAllowed,
        restrictedEmpty,
      },
      meta: {
        truncated: truncatedSources.length > 0,
        truncatedSources,
        limits: WORK_CALENDAR_LIMITS,
        counts: {
          scheduledTickets,
          unscheduledTickets,
          inspections: scheduleRows.length,
        },
        generatedAt: new Date().toISOString(),
      },
    };
  }

  private async findTickets(
    scopeWhere: Prisma.TicketWhereInput,
    sourceWhere: Prisma.TicketWhereInput,
    filters: ParsedFilters,
    orderBy: Prisma.TicketOrderByWithRelationInput[],
    limit: number,
  ): Promise<CalendarTicketRow[]> {
    const and: Prisma.TicketWhereInput[] = [scopeWhere, sourceWhere];
    if (filters.employeeIds) {
      and.push({ assignedTechnicianId: { in: filters.employeeIds } });
    }
    if (filters.locationIds) {
      and.push({ locationId: { in: filters.locationIds } });
    }
    return this.prisma.ticket.findMany({
      where: { AND: and },
      orderBy,
      take: limit + 1,
      select: ticketSelect,
    });
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
}

type ScheduleForCalendar = Awaited<
  ReturnType<InspectionScheduleService['listForCalendar']>
>['rows'][number];

function toScheduleRow(schedule: ScheduleForCalendar): CalendarScheduleRow {
  return {
    id: schedule.id,
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
    assignedTo: schedule.assignedTo
      ? {
          id: schedule.assignedTo.id,
          firstName: schedule.assignedTo.firstName,
          lastName: schedule.assignedTo.lastName,
          companyId: schedule.companyId,
        }
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
  types: Set<WorkCalendarEventType>;
  ticketStatuses: TicketStatus[] | null;
  inspectionStatuses: InspectionEventStatus[] | null;
  includeUnscheduled: boolean;
};

const TICKET_STATUSES = Object.values(TicketStatus) as string[];

export function parseFilters(query: WorkCalendarQuery): ParsedFilters {
  const employeeIds = parseIdList(query.employeeIds, 'employeeIds');
  const locationIds = parseIdList(query.locationIds, 'locationIds');

  const rawTypes = splitList(query.types);
  for (const type of rawTypes) {
    if (!(WORK_CALENDAR_EVENT_TYPES as readonly string[]).includes(type)) {
      throw new BadRequestException(`Unknown event type: ${type}`);
    }
  }
  const types = new Set<WorkCalendarEventType>(
    (rawTypes.length > 0
      ? rawTypes
      : [...WORK_CALENDAR_EVENT_TYPES]) as WorkCalendarEventType[],
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

  const flag = (query.includeUnscheduled ?? '').trim();
  if (flag && flag !== 'true' && flag !== 'false') {
    throw new BadRequestException('includeUnscheduled must be true or false');
  }

  return {
    employeeIds,
    locationIds,
    types,
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
    includeUnscheduled: flag !== 'false',
  };
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
    if (!UUID.test(item))
      throw new BadRequestException(`Invalid id in ${name}`);
  }
  return items;
}
