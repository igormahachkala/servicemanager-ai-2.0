/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import * as fs from 'fs';
import * as path from 'path';

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InspectionFrequency, TicketStatus, UserRole } from '@prisma/client';

import { ROLE_GRANTS } from '../common/permissions-matrix';
import * as permissionsGuard from '../common/permissions.guard';
import * as ticketAccess from '../tickets/ticket-access.utils';
import {
  INSPECTION_SCAN_CAP,
  WORK_CALENDAR_LIMITS,
  WorkCalendarService,
  type WorkCalendarResponse,
} from './work-calendar.service';

/**
 * SMA-WORK-CALENDAR-V1.
 *
 * Scope заявок здесь подменён: его собственные правила покрыты тестами
 * tickets.query. Проверяется другое — что календарь накладывает этот scope
 * на каждую выборку (строки фильтрует вычислитель where, а не доверие к
 * аргументам), не расширяет его фильтрами и не протаскивает лишнего через
 * resources.
 */

const PROVIDER = 'provider-1';
const CLIENT_A = 'client-a';
const CLIENT_B = 'client-b';

const LOC_A1 = {
  id: 'loc-a1',
  name: 'А1',
  city: 'Уфа',
  address: null,
  clientCompanyId: CLIENT_A,
};
const LOC_A2 = {
  id: 'loc-a2',
  name: 'А2',
  city: 'Уфа',
  address: null,
  clientCompanyId: CLIENT_A,
};
const LOC_B1 = {
  id: 'loc-b1',
  name: 'Б1',
  city: 'Казань',
  address: null,
  clientCompanyId: CLIENT_B,
};

const UUID_TECH = '11111111-1111-4111-8111-111111111111';
const UUID_IDLE = '22222222-2222-4222-8222-222222222222';
const UUID_FOREIGN = '33333333-3333-4333-8333-333333333333';

const person = (
  id: string,
  firstName: string,
  lastName: string,
  companyId: string,
  role: UserRole = UserRole.TECHNICIAN,
) => ({
  id,
  firstName,
  lastName,
  companyId,
  role,
  isActive: true,
  isExecutor: true,
});

const TECH = person(UUID_TECH, 'Иван', 'Петров', PROVIDER);
const IDLE = person(UUID_IDLE, 'Олег', 'Аксёнов', PROVIDER, UserRole.MASTER);
const FOREIGN = person(UUID_FOREIGN, 'Чужой', 'Сотрудник', 'provider-2');

const dispatcher = {
  companyId: PROVIDER,
  id: 'u-disp',
  role: UserRole.DISPATCHER,
};
const technician = {
  companyId: PROVIDER,
  id: UUID_TECH,
  role: UserRole.TECHNICIAN,
};
const clientCompanyAdmin = {
  companyId: CLIENT_A,
  id: 'u-client-admin',
  role: UserRole.ADMIN,
};
const clientAdminRole = {
  companyId: CLIENT_A,
  id: 'u-client-admin-role',
  role: UserRole.CLIENT_ADMIN,
};

const WEEK = {
  from: '2026-10-26',
  to: '2026-11-02',
  timezone: 'Europe/Moscow',
};

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: 't-1',
    ticketNumber: 1,
    companyId: CLIENT_A,
    status: TicketStatus.ASSIGNED,
    urgency: 'NOT_URGENT',
    priority: 'NORMAL',
    problemText: 'Протечка',
    plannedDueAt: new Date('2026-10-27T07:00:00.000Z'),
    slaDueAt: null,
    parentId: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    locationId: LOC_A1.id,
    location: LOC_A1,
    assignedTechnicianId: TECH.id,
    assignedTechnician: TECH,
    ...overrides,
  };
}

function schedule(overrides: Record<string, unknown> = {}) {
  const nextDueAt =
    (overrides.nextDueAt as Date) ?? new Date('2026-10-28T06:00:00.000Z');
  return {
    id: 's-1',
    companyId: PROVIDER,
    name: 'ТО',
    frequency: InspectionFrequency.MONTHLY,
    intervalDays: null,
    startDate: nextDueAt,
    nextDueAt,
    graceDays: 0,
    isActive: true,
    overdueAt: nextDueAt,
    isOverdue: false,
    template: { id: 'tpl', name: 'ТО' },
    location: LOC_A1,
    assignedTo: {
      id: TECH.id,
      firstName: TECH.firstName,
      lastName: TECH.lastName,
      role: TECH.role,
      isActive: true,
      isExecutor: true,
    },
    assignedToUserId: TECH.id,
    company: { timezone: 'Europe/Moscow' },
    lastRun: null,
    ...overrides,
  };
}

// ── минимальный вычислитель Prisma where для строк в памяти ──────────────────

function matches(row: any, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]: [string, any]) => {
    if (key === 'AND') {
      return (condition as any[]).every((part) => matches(row, part));
    }
    if (key === 'OR') {
      return (condition as any[]).some((part) => matches(row, part));
    }
    const value = row[key];
    if (condition === null) return value === null || value === undefined;
    if (condition instanceof Date || typeof condition !== 'object') {
      return value === condition;
    }
    if ('in' in condition && !condition.in.includes(value)) return false;
    if ('not' in condition && condition.not === null && value == null) {
      return false;
    }
    if ('equals' in condition && value !== condition.equals) return false;
    if ('gte' in condition && !(value && value >= condition.gte)) return false;
    if ('lt' in condition && !(value && value < condition.lt)) return false;
    return true;
  });
}

type SuiteOptions = {
  tickets?: any[];
  schedules?: any[];
  fetchedSchedules?: number;
  scope?: Partial<{
    where: any;
    scopeCompanyId: string;
    visibilityMode: string;
    technicianCompanyIds: string[] | null;
  }>;
  users?: any[];
  directory?: any[] | Error;
  locationViewGranted?: boolean;
  /** Права из матрицы ROLE_GRANTS по роли актора вместо флага. */
  permissionsFromMatrix?: boolean;
  locationScopes?: Record<string, ticketAccess.LocationScope>;
  companyTimeZone?: string | null;
};

function makeSuite(options: SuiteOptions = {}) {
  const tickets = options.tickets ?? [];
  const users = options.users ?? [TECH, IDLE];

  const prisma = {
    company: {
      findUnique: jest.fn(() =>
        Promise.resolve({
          timezone:
            options.companyTimeZone === undefined
              ? 'Europe/Moscow'
              : options.companyTimeZone,
        }),
      ),
    },
    ticket: {
      findMany: jest.fn(({ where, take }: any) =>
        Promise.resolve(
          tickets.filter((row) => matches(row, where)).slice(0, take),
        ),
      ),
      count: jest.fn(({ where }: any) =>
        Promise.resolve(tickets.filter((row) => matches(row, where)).length),
      ),
    },
    user: {
      findMany: jest.fn(({ where, take }: any) =>
        Promise.resolve(
          users
            .filter(
              (user) =>
                user.companyId === where.companyId &&
                (typeof where.id === 'string'
                  ? user.id === where.id
                  : !where.id || where.id.in.includes(user.id)),
            )
            .slice(0, take),
        ),
      ),
    },
  } as any;

  const ticketsQuery = {
    resolveListWhere: jest.fn(() =>
      Promise.resolve({
        where: { companyId: CLIENT_A },
        scopeCompanyId: CLIENT_A,
        visibilityMode: 'provider_primary',
        technicianCompanyIds: null,
        ...options.scope,
      }),
    ),
  } as any;

  const scheduleRows = options.schedules ?? [];
  const schedules = {
    listForCalendar: jest.fn(() =>
      Promise.resolve({
        rows: scheduleRows,
        fetched: options.fetchedSchedules ?? scheduleRows.length,
      }),
    ),
  } as any;

  const directory = options.directory ?? [LOC_A1, LOC_A2];
  const locations = {
    list: jest.fn(() =>
      directory instanceof Error
        ? Promise.reject(directory)
        : Promise.resolve(directory),
    ),
  } as any;

  const hasPermission = jest.spyOn(permissionsGuard, 'hasAnyPermission');
  if (options.permissionsFromMatrix) {
    hasPermission.mockImplementation((_prisma, user, codes) =>
      Promise.resolve(
        ROLE_GRANTS.some(
          (grant) =>
            grant.role === user.role &&
            grant.codes.some((code) => codes.includes(code)),
        ),
      ),
    );
  } else {
    hasPermission.mockResolvedValue(options.locationViewGranted ?? true);
  }
  jest
    .spyOn(ticketAccess, 'resolveActorLocationScope')
    .mockImplementation(({ scopeCompanyId }) =>
      Promise.resolve(
        options.locationScopes?.[scopeCompanyId ?? ''] ?? {
          mode: 'tenant_wide',
          locationIds: [],
        },
      ),
    );

  return {
    svc: new WorkCalendarService(prisma, ticketsQuery, schedules, locations),
    prisma,
    ticketsQuery,
    schedules,
    locations,
  };
}

/** Каждая ссылка события находит свою строку resources и свою сущность. */
function expectReferencesResolve(result: WorkCalendarResponse) {
  const employees = new Set(result.resources.employees.map((row) => row.id));
  const locations = new Set(result.resources.locations.map((row) => row.id));
  for (const event of result.events) {
    if (event.employeeId) expect(employees.has(event.employeeId)).toBe(true);
    expect(locations.has(event.locationId)).toBe(true);
    if (event.kind === 'TICKET') {
      expect(event).toMatchObject({
        source: 'TICKET',
        ticketId: event.entityId,
        scheduleId: null,
      });
      expect(event.id).toBe(`ticket:${event.entityId}`);
    } else {
      expect(event).toMatchObject({
        source: 'INSPECTION_SCHEDULE',
        scheduleId: event.entityId,
        ticketId: null,
      });
      expect(event.id).toBe(`inspection:${event.entityId}`);
    }
  }
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('SMA-WORK-CALENDAR-V1 доступ к заявкам', () => {
  it('каждая выборка заявок идёт через действующий scope: чужие строки не попадают', async () => {
    const { svc, prisma, ticketsQuery } = makeSuite({
      tickets: [
        ticket({ id: 'own' }),
        ticket({
          id: 'foreign',
          companyId: CLIENT_B,
          location: LOC_B1,
          locationId: LOC_B1.id,
        }),
        ticket({ id: 'own-unscheduled', plannedDueAt: null }),
        ticket({
          id: 'foreign-unscheduled',
          plannedDueAt: null,
          companyId: CLIENT_B,
        }),
      ],
    });

    const result = await svc.getCalendar(dispatcher, {
      ...WEEK,
      linkedClientCompanyId: CLIENT_A,
    });

    expect(result.events.map((event) => event.entityId)).toEqual([
      'own',
      'own-unscheduled',
    ]);
    expect(ticketsQuery.resolveListWhere).toHaveBeenCalledWith(
      PROVIDER,
      'u-disp',
      UserRole.DISPATCHER,
      undefined,
      undefined,
      CLIENT_A,
      undefined,
    );
    for (const [args] of prisma.ticket.findMany.mock.calls) {
      expect(args.where.AND[0]).toEqual({ companyId: CLIENT_A });
    }
  });

  it('пустой scope (restricted) — ни одного запроса заявок', async () => {
    const { svc, prisma } = makeSuite({
      tickets: [ticket()],
      scope: { where: null },
    });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
    expect(result.events).toEqual([]);
  });

  it('клиенту контур и наблюдение не передаются, как в GET /tickets', async () => {
    const { svc, ticketsQuery } = makeSuite();

    await svc.getCalendar(
      { companyId: CLIENT_A, id: 'u-client', role: UserRole.CLIENT },
      { ...WEEK, linkedClientCompanyId: CLIENT_B, companyId: CLIENT_B },
    );

    const args = ticketsQuery.resolveListWhere.mock.calls[0];
    expect(args[5]).toBeUndefined();
    expect(args[6]).toBeUndefined();
  });

  it('чужой контур — тот же отказ, что у списка заявок, и ничего не читается', async () => {
    const { svc, prisma, ticketsQuery, schedules, locations } = makeSuite({
      schedules: [schedule()],
    });
    ticketsQuery.resolveListWhere.mockRejectedValueOnce(
      new ForbiddenException('No access to linked client'),
    );

    await expect(
      svc.getCalendar(dispatcher, { ...WEEK, linkedClientCompanyId: CLIENT_B }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
    expect(schedules.listForCalendar).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(locations.list).not.toHaveBeenCalled();
  });

  it('фильтр сотрудников только сужает видимое', async () => {
    const { svc, prisma } = makeSuite({
      tickets: [
        ticket({ id: 'a1' }),
        ticket({ id: 'a2', locationId: LOC_A2.id, location: LOC_A2 }),
      ],
    });

    const result = await svc.getCalendar(dispatcher, {
      ...WEEK,
      employeeIds: `${UUID_TECH},${UUID_FOREIGN}`,
    });

    expect(result.events.map((event) => event.entityId)).toEqual(['a1', 'a2']);
    const [args] = prisma.ticket.findMany.mock.calls[0];
    expect(args.where.AND).toEqual([
      { companyId: CLIENT_A },
      expect.anything(),
      { assignedTechnicianId: { in: [UUID_TECH, UUID_FOREIGN] } },
    ]);
  });
});

describe('SMA-WORK-CALENDAR-V1 ADMIN клиентской компании', () => {
  const clientScope = {
    where: { companyId: CLIENT_A },
    scopeCompanyId: CLIENT_A,
    visibilityMode: 'tenant',
  };

  it('свой контур: заявки своего tenant, планы своей компании, свой штат и объекты', async () => {
    const own = person(
      UUID_IDLE,
      'Анна',
      'Клиентова',
      CLIENT_A,
      UserRole.ADMIN,
    );
    const { svc, ticketsQuery, schedules, locations, prisma } = makeSuite({
      scope: clientScope,
      tickets: [ticket()],
      schedules: [
        schedule({ id: 'own-plan', companyId: CLIENT_A }),
        schedule({ id: 'other-client', location: LOC_B1, companyId: CLIENT_A }),
      ],
      users: [own, TECH],
    });

    const result = await svc.getCalendar(clientCompanyAdmin, WEEK);

    expect(ticketsQuery.resolveListWhere.mock.calls[0].slice(5)).toEqual([
      undefined,
      undefined,
    ]);
    // Планы — та же выборка, что /inspection/schedules: компания актора.
    expect(schedules.listForCalendar.mock.calls[0][0]).toBe(clientCompanyAdmin);
    expect(
      result.events
        .filter((event) => event.kind === 'INSPECTION')
        .map((event) => event.entityId),
    ).toEqual(['own-plan']);
    expect(prisma.user.findMany.mock.calls[0][0].where.companyId).toBe(
      CLIENT_A,
    );
    expect(locations.list).toHaveBeenCalledWith(
      CLIENT_A,
      UserRole.ADMIN,
      'u-client-admin',
      { isActive: 'true' },
      CLIENT_A,
    );
  });

  it('исполнитель подрядчика на заявке клиента — без компании и роли', async () => {
    const { svc } = makeSuite({
      scope: clientScope,
      tickets: [
        ticket({ assignedTechnician: TECH, assignedTechnicianId: TECH.id }),
      ],
      users: [],
    });

    const result = await svc.getCalendar(clientCompanyAdmin, WEEK);

    expect(result.resources.employees).toEqual([
      {
        id: UUID_TECH,
        displayName: 'Петров Иван',
        companyId: null,
        role: null,
        isActive: null,
        isExecutor: null,
        isOwnCompany: false,
        eventCount: 1,
      },
    ]);
  });

  it('чужой linkedClientCompanyId — отказ контура, расширения нет', async () => {
    const { svc, ticketsQuery } = makeSuite({ scope: clientScope });
    ticketsQuery.resolveListWhere.mockRejectedValueOnce(
      new ForbiddenException('No access to linked client'),
    );

    await expect(
      svc.getCalendar(clientCompanyAdmin, {
        ...WEEK,
        linkedClientCompanyId: CLIENT_B,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('SMA-WORK-CALENDAR-V1 роль CLIENT_ADMIN', () => {
  const ownScope = {
    where: { companyId: CLIENT_A },
    scopeCompanyId: CLIENT_A,
    visibilityMode: 'tenant',
  };
  const ownStaff = person(
    UUID_IDLE,
    'Анна',
    'Клиентова',
    CLIENT_A,
    UserRole.ADMIN,
  );

  it('свой tenant: заявки своей компании; обходов, штата и справочника объектов нет', async () => {
    const { svc, ticketsQuery, schedules, locations, prisma } = makeSuite({
      permissionsFromMatrix: true,
      scope: ownScope,
      tickets: [
        ticket({ id: 'own' }),
        ticket({
          id: 'foreign',
          companyId: CLIENT_B,
          location: LOC_B1,
          locationId: LOC_B1.id,
        }),
      ],
      schedules: [schedule({ companyId: CLIENT_A })],
      users: [ownStaff, TECH],
    });

    const result = await svc.getCalendar(clientAdminRole, WEEK);

    expect(ticketsQuery.resolveListWhere).toHaveBeenCalledWith(
      CLIENT_A,
      'u-client-admin-role',
      UserRole.CLIENT_ADMIN,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(result.events.map((event) => event.entityId)).toEqual(['own']);
    expect(schedules.listForCalendar).not.toHaveBeenCalled();
    expect(locations.list).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(result.capabilities).toMatchObject({
      tickets: true,
      inspections: false,
      resources: false,
      employeeDirectory: false,
      locationDirectory: false,
      restrictedEmpty: false,
    });
    expect(result.resources.locations.map((location) => location.id)).toEqual([
      LOC_A1.id,
    ]);
  });

  it('чужой tenant: отказ контура, ничего не читается', async () => {
    const { svc, ticketsQuery, prisma, schedules, locations } = makeSuite({
      permissionsFromMatrix: true,
      scope: ownScope,
      tickets: [ticket()],
    });
    ticketsQuery.resolveListWhere.mockRejectedValueOnce(
      new ForbiddenException('Role cannot access linked client tickets'),
    );

    await expect(
      svc.getCalendar(clientAdminRole, {
        ...WEEK,
        linkedClientCompanyId: CLIENT_B,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ticketsQuery.resolveListWhere.mock.calls[0][5]).toBe(CLIENT_B);
    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(schedules.listForCalendar).not.toHaveBeenCalled();
    expect(locations.list).not.toHaveBeenCalled();
  });

  it('restricted-empty: пусто, признак в capabilities', async () => {
    const { svc, prisma } = makeSuite({
      permissionsFromMatrix: true,
      scope: { ...ownScope, where: null },
      tickets: [ticket()],
      locationScopes: {
        [CLIENT_A]: { mode: 'restricted_empty', locationIds: [] },
      },
    });

    const result = await svc.getCalendar(clientAdminRole, WEEK);

    expect(result.events).toEqual([]);
    expect(result.resources).toEqual({ employees: [], locations: [] });
    expect(result.capabilities.restrictedEmpty).toBe(true);
    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
  });

  it('чужого штата нет: подрядчик на заявке — без компании и роли, остальные не видны', async () => {
    const { svc, prisma } = makeSuite({
      permissionsFromMatrix: true,
      scope: ownScope,
      tickets: [
        ticket({
          id: 'by-contractor',
          assignedTechnician: TECH,
          assignedTechnicianId: TECH.id,
        }),
        ticket({
          id: 'unassigned',
          plannedDueAt: null,
          assignedTechnician: null,
          assignedTechnicianId: null,
        }),
      ],
      users: [ownStaff, TECH, FOREIGN],
    });

    const result = await svc.getCalendar(clientAdminRole, WEEK);

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(result.resources.employees).toEqual([
      {
        id: UUID_TECH,
        displayName: 'Петров Иван',
        companyId: null,
        role: null,
        isActive: null,
        isExecutor: null,
        isOwnCompany: false,
        eventCount: 1,
      },
    ]);

    const filtered = await svc.getCalendar(clientAdminRole, {
      ...WEEK,
      employeeIds: [UUID_FOREIGN, UUID_IDLE],
    });
    expect(filtered.resources.employees).toEqual([]);
    expect(filtered.events).toEqual([]);
  });
});

describe('SMA-WORK-CALENDAR-V1 даты заявок', () => {
  it('диапазон полуоткрытый: срок ровно в to не попадает, ровно в from попадает', async () => {
    const { svc } = makeSuite({
      tickets: [
        ticket({
          id: 'at-from',
          plannedDueAt: new Date('2026-10-25T21:00:00.000Z'),
        }),
        ticket({
          id: 'before',
          plannedDueAt: new Date('2026-10-25T20:59:59.999Z'),
        }),
        ticket({
          id: 'at-to',
          plannedDueAt: new Date('2026-11-01T21:00:00.000Z'),
        }),
      ],
    });

    const result = await svc.getCalendar(dispatcher, {
      ...WEEK,
      includeUnscheduled: 'false',
    });

    expect(result.range).toEqual({
      from: '2026-10-25T21:00:00.000Z',
      to: '2026-11-01T21:00:00.000Z',
      timezone: 'Europe/Moscow',
    });
    expect(result.events.map((event) => event.entityId)).toEqual(['at-from']);
    expect(result.events[0].timing.localDate).toBe('2026-10-26');
  });

  it('границы ISO в UTC, как их шлёт frontend, принимаются как есть', async () => {
    const { svc } = makeSuite();

    const result = await svc.getCalendar(dispatcher, {
      from: '2026-10-25T21:00:00.000Z',
      to: '2026-11-01T21:00:00.000Z',
      timezone: 'Europe/Moscow',
    });

    expect(result.range.from).toBe('2026-10-25T21:00:00.000Z');
    expect(result.range.to).toBe('2026-11-01T21:00:00.000Z');
  });

  it('DST: сутки 1 ноября в Нью-Йорке включают 23:30 EST, и событие в своих сутках', async () => {
    const { svc } = makeSuite({
      tickets: [
        ticket({
          id: 'late',
          plannedDueAt: new Date('2026-11-02T04:30:00.000Z'),
        }),
      ],
    });

    const result = await svc.getCalendar(dispatcher, {
      from: '2026-11-01',
      to: '2026-11-02',
      timezone: 'America/New_York',
      includeUnscheduled: 'false',
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].timing.localDate).toBe('2026-11-01');
  });

  it('без пояса — пояс компании; неизвестный пояс — 400 до любых выборок', async () => {
    const withCompanyZone = makeSuite({
      companyTimeZone: 'Asia/Yekaterinburg',
    });
    const result = await withCompanyZone.svc.getCalendar(dispatcher, {
      from: '2026-10-26',
      to: '2026-10-27',
    });
    expect(result.range).toEqual({
      from: '2026-10-25T19:00:00.000Z',
      to: '2026-10-26T19:00:00.000Z',
      timezone: 'Asia/Yekaterinburg',
    });

    const invalid = makeSuite();
    await expect(
      invalid.svc.getCalendar(dispatcher, {
        ...WEEK,
        timezone: 'Mars/Olympus',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(invalid.ticketsQuery.resolveListWhere).not.toHaveBeenCalled();
  });

  it('без плановой даты — только незакрытые заявки, timing без окна', async () => {
    const { svc } = makeSuite({
      tickets: [
        ticket({ id: 'open', plannedDueAt: null, status: TicketStatus.NEW }),
        ticket({ id: 'done', plannedDueAt: null, status: TicketStatus.DONE }),
        ticket({
          id: 'canceled',
          plannedDueAt: null,
          status: TicketStatus.CANCELED,
        }),
      ],
    });

    const result = await svc.getCalendar(dispatcher, {
      ...WEEK,
      includeCompleted: 'true',
    });

    expect(result.events).toEqual([
      expect.objectContaining({
        entityId: 'open',
        timing: {
          mode: 'UNSCHEDULED',
          dueAt: null,
          localDate: null,
          startAt: null,
          endAt: null,
          hasWindow: false,
        },
      }),
    ]);
    expect(result.meta.unscheduled).toBe(1);
  });

  it('includeUnscheduled=false убирает заявки без даты', async () => {
    const { svc, prisma } = makeSuite({
      tickets: [ticket({ plannedDueAt: null })],
    });

    const result = await svc.getCalendar(dispatcher, {
      ...WEEK,
      includeUnscheduled: 'false',
    });

    expect(result.events).toEqual([]);
    expect(prisma.ticket.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('SMA-WORK-CALENDAR-V1 includeCompleted, assigned, eventTypes, statuses', () => {
  const mixed = [
    ticket({ id: 'open' }),
    ticket({ id: 'accepting', status: TicketStatus.AWAITING_ACCEPTANCE }),
    ticket({ id: 'done', status: TicketStatus.DONE }),
    ticket({ id: 'canceled', status: TicketStatus.CANCELED }),
  ];

  it('по умолчанию завершённых нет; сданная подрядчиком заявка не завершена', async () => {
    const { svc } = makeSuite({ tickets: mixed });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(result.events.map((event) => event.entityId)).toEqual([
      'accepting',
      'open',
    ]);
  });

  it('includeCompleted=true добавляет DONE и CANCELED', async () => {
    const { svc } = makeSuite({ tickets: mixed });

    const result = await svc.getCalendar(dispatcher, {
      ...WEEK,
      includeCompleted: 'true',
    });

    expect(result.events.map((event) => event.entityId).sort()).toEqual([
      'accepting',
      'canceled',
      'done',
      'open',
    ]);
  });

  it('statuses=DONE без includeCompleted завершённых не возвращает', async () => {
    const { svc, prisma, schedules } = makeSuite({
      tickets: mixed,
      schedules: [schedule()],
    });

    const result = await svc.getCalendar(dispatcher, {
      ...WEEK,
      statuses: 'DONE',
    });

    expect(result.events).toEqual([]);
    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
    expect(schedules.listForCalendar).not.toHaveBeenCalled();
  });

  it('statuses=DONE с includeCompleted — только плановые закрытые, без корзины без даты', async () => {
    const { svc, prisma } = makeSuite({
      tickets: [
        ...mixed,
        ticket({ id: 'old', plannedDueAt: null, status: TicketStatus.DONE }),
      ],
    });

    const result = await svc.getCalendar(dispatcher, {
      ...WEEK,
      statuses: 'DONE',
      includeCompleted: 'true',
    });

    expect(result.events.map((event) => event.entityId)).toEqual(['done']);
    expect(prisma.ticket.findMany).toHaveBeenCalledTimes(1);
  });

  it('assigned=unassigned / assigned — по наличию исполнителя, и для планов тоже', async () => {
    const rows = [
      ticket({ id: 'mine' }),
      ticket({
        id: 'nobody',
        assignedTechnicianId: null,
        assignedTechnician: null,
      }),
    ];
    const unassigned = makeSuite({ tickets: rows, schedules: [schedule()] });
    const free = await unassigned.svc.getCalendar(dispatcher, {
      ...WEEK,
      assigned: 'unassigned',
    });
    expect(free.events.map((event) => event.entityId)).toContain('nobody');
    expect(free.events.map((event) => event.entityId)).not.toContain('mine');
    expect(unassigned.schedules.listForCalendar.mock.calls[0][1].assigned).toBe(
      'unassigned',
    );

    const assigned = makeSuite({ tickets: rows });
    const taken = await assigned.svc.getCalendar(dispatcher, {
      ...WEEK,
      assigned: 'assigned',
    });
    expect(taken.events.map((event) => event.entityId)).toEqual(['mine']);

    const all = makeSuite({ tickets: rows });
    const both = await all.svc.getCalendar(dispatcher, {
      ...WEEK,
      assigned: 'all',
    });
    expect(both.events).toHaveLength(2);
  });

  it('eventTypes=INSPECTION: заявки не читаются, контур всё равно проверяется', async () => {
    const { svc, prisma, ticketsQuery } = makeSuite({
      tickets: [ticket()],
      schedules: [schedule()],
    });

    const result = await svc.getCalendar(dispatcher, {
      ...WEEK,
      eventTypes: 'INSPECTION',
    });

    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
    expect(ticketsQuery.resolveListWhere).toHaveBeenCalledTimes(1);
    expect(result.events.map((event) => event.id)).toEqual(['inspection:s-1']);
  });

  it('прежнее имя types принимается, eventTypes важнее', async () => {
    const { svc, prisma } = makeSuite({
      tickets: [ticket()],
      schedules: [schedule()],
    });

    const result = await svc.getCalendar(dispatcher, {
      ...WEEK,
      types: 'INSPECTION',
      eventTypes: 'TICKET',
    });

    expect(prisma.ticket.findMany).toHaveBeenCalled();
    expect(result.events.every((event) => event.kind === 'TICKET')).toBe(true);
  });

  it('статус обхода OVERDUE отбирает только просроченные визиты', async () => {
    const { svc } = makeSuite({
      schedules: [
        schedule({ id: 'late', isOverdue: true }),
        schedule({ id: 'ok' }),
      ],
    });

    const result = await svc.getCalendar(dispatcher, {
      ...WEEK,
      statuses: ['OVERDUE'],
    });

    expect(result.events.map((event) => event.entityId)).toEqual(['late']);
  });

  it('неизвестные тип, статус, id, assigned и флаги — 400', async () => {
    const { svc } = makeSuite();
    await expect(
      svc.getCalendar(dispatcher, { ...WEEK, eventTypes: 'SHIFT' }),
    ).rejects.toThrow('Unknown event type');
    await expect(
      svc.getCalendar(dispatcher, { ...WEEK, statuses: 'LOST' }),
    ).rejects.toThrow('Unknown status');
    await expect(
      svc.getCalendar(dispatcher, { ...WEEK, employeeIds: 'u-1' }),
    ).rejects.toThrow('Invalid id');
    await expect(
      svc.getCalendar(dispatcher, { ...WEEK, assigned: 'mine' }),
    ).rejects.toThrow('assigned must be');
    await expect(
      svc.getCalendar(dispatcher, { ...WEEK, includeUnscheduled: 'yes' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      svc.getCalendar(dispatcher, { ...WEEK, includeCompleted: '1' }),
    ).rejects.toThrow('includeCompleted must be true or false');
  });
});

describe('SMA-WORK-CALENDAR-V1 доступ к планам обходов', () => {
  it('без права LOCATIONS_VIEW нет ни планов, ни справочника объектов', async () => {
    const { svc, schedules, locations } = makeSuite({
      schedules: [schedule()],
      locationViewGranted: false,
    });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(schedules.listForCalendar).not.toHaveBeenCalled();
    expect(locations.list).not.toHaveBeenCalled();
    expect(result.capabilities).toMatchObject({
      tickets: true,
      inspections: false,
      resources: false,
      locationDirectory: false,
    });
  });

  it.each([UserRole.CLIENT, UserRole.TERRITORIAL_MANAGER])(
    '%s не видит планы обходов, как и в /inspection/schedules',
    async (role) => {
      const { svc, schedules } = makeSuite({ schedules: [schedule()] });

      const result = await svc.getCalendar(
        { companyId: CLIENT_A, id: 'u-x', role },
        WEEK,
      );

      expect(schedules.listForCalendar).not.toHaveBeenCalled();
      expect(result.capabilities.inspections).toBe(false);
    },
  );

  it('наблюдатель платформы: ни планов, ни штата, ни справочника', async () => {
    const { svc, schedules, prisma, locations } = makeSuite({
      schedules: [schedule()],
      scope: { visibilityMode: 'platform_observer' },
    });

    const result = await svc.getCalendar(
      { companyId: 'platform', id: 'u-pa', role: UserRole.PLATFORM_ADMIN },
      { ...WEEK, companyId: CLIENT_A },
    );

    expect(schedules.listForCalendar).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(locations.list).not.toHaveBeenCalled();
    expect(result.capabilities).toMatchObject({
      inspections: false,
      resources: false,
      employeeDirectory: false,
    });
  });

  it('планы другого клиента вне контура запроса не показываются', async () => {
    const { svc } = makeSuite({
      schedules: [
        schedule({ id: 'a' }),
        schedule({ id: 'b', location: LOC_B1 }),
      ],
      directory: [],
    });

    const result = await svc.getCalendar(dispatcher, {
      ...WEEK,
      linkedClientCompanyId: CLIENT_A,
    });

    expect(result.events.map((event) => event.entityId)).toEqual(['a']);
    expect(result.resources.locations.map((location) => location.id)).toEqual([
      LOC_A1.id,
    ]);
  });

  it('привязки актора к объектам сужают планы', async () => {
    const { svc } = makeSuite({
      schedules: [
        schedule({ id: 'bound' }),
        schedule({ id: 'unbound', location: LOC_A2 }),
      ],
      locationScopes: {
        [CLIENT_A]: { mode: 'bound_locations', locationIds: [LOC_A1.id] },
      },
    });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(result.events.map((event) => event.entityId)).toEqual(['bound']);
  });

  it('restricted-empty: ни событий, ни штата, ни объектов, признак в capabilities', async () => {
    const { svc, prisma, locations } = makeSuite({
      schedules: [schedule()],
      scope: { where: null },
      locationScopes: {
        [CLIENT_A]: { mode: 'restricted_empty', locationIds: [] },
      },
    });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(result.events).toEqual([]);
    expect(result.resources).toEqual({ employees: [], locations: [] });
    expect(result.capabilities.restrictedEmpty).toBe(true);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(locations.list).not.toHaveBeenCalled();
  });

  it('следующий срок плана считается действующей логикой повторения, через DST', async () => {
    const { svc } = makeSuite({
      schedules: [
        schedule({
          frequency: InspectionFrequency.WEEKLY,
          startDate: new Date('2026-10-26T13:00:00.000Z'),
          nextDueAt: new Date('2026-10-26T13:00:00.000Z'),
          company: { timezone: 'America/New_York' },
        }),
      ],
    });

    const result = await svc.getCalendar(dispatcher, WEEK);

    // 09:00 EDT → следующий визит в 09:00 EST, то есть на час позже по UTC.
    expect(result.events[0].recurrence?.followingDueAt).toBe(
      '2026-11-02T14:00:00.000Z',
    );
  });
});

describe('SMA-WORK-CALENDAR-V1 resources', () => {
  it('штат диспетчера включает сотрудника без событий', async () => {
    const { svc } = makeSuite({ tickets: [ticket()] });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(
      result.resources.employees.map((employee) => [
        employee.id,
        employee.eventCount,
      ]),
    ).toEqual([
      [UUID_IDLE, 0],
      [UUID_TECH, 1],
    ]);
    expect(result.capabilities).toMatchObject({
      resources: true,
      employeeDirectory: true,
      locationDirectory: true,
    });
  });

  it('пустые объекты — из справочника /locations контура, с лимитом', async () => {
    const { svc } = makeSuite({ tickets: [ticket()] });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(
      result.resources.locations.map((location) => [
        location.id,
        location.eventCount,
      ]),
    ).toEqual([
      [LOC_A1.id, 1],
      [LOC_A2.id, 0],
    ]);
  });

  it('справочник объектов сверх лимита обрезается и отмечается', async () => {
    const many = Array.from(
      { length: WORK_CALENDAR_LIMITS.locations + 3 },
      (_, index) => ({
        ...LOC_A2,
        id: `loc-${index}`,
        name: `Объект ${index}`,
      }),
    );
    const { svc } = makeSuite({ directory: many });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(result.resources.locations).toHaveLength(
      WORK_CALENDAR_LIMITS.locations,
    );
    expect(result.meta.truncatedSources).toContain('locations');
  });

  it('отказ справочника объектов — объекты только по событиям, без ошибки', async () => {
    const { svc } = makeSuite({
      tickets: [ticket()],
      directory: new NotFoundException('Linked client not found'),
    });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(result.resources.locations.map((location) => location.id)).toEqual([
      LOC_A1.id,
    ]);
    expect(result.capabilities).toMatchObject({
      resources: false,
      locationDirectory: false,
    });
  });

  it('пустой штат и нет событий — пустые сотрудники без ошибки', async () => {
    const { svc } = makeSuite({ users: [], directory: [] });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(result.resources).toEqual({ employees: [], locations: [] });
    expect(result.events).toEqual([]);
  });

  it('технику — только он сам, планы — из его контуров, справочника нет', async () => {
    const { svc, prisma, schedules, locations } = makeSuite({
      scope: {
        technicianCompanyIds: [CLIENT_A],
        scopeCompanyId: PROVIDER,
        visibilityMode: 'tenant',
      },
      schedules: [
        schedule({ id: 'a' }),
        schedule({ id: 'b', location: LOC_B1 }),
      ],
    });

    const result = await svc.getCalendar(technician, WEEK);

    expect(prisma.user.findMany.mock.calls[0][0].where).toMatchObject({
      companyId: PROVIDER,
      id: UUID_TECH,
    });
    expect(result.resources.employees.map((employee) => employee.id)).toEqual([
      UUID_TECH,
    ]);
    expect(schedules.listForCalendar.mock.calls[0][0]).toBe(technician);
    expect(result.events.map((event) => event.entityId)).toEqual(['a']);
    expect(locations.list).not.toHaveBeenCalled();
  });

  it('чужой id в фильтре сотрудников не попадает в resources', async () => {
    const { svc } = makeSuite({
      tickets: [ticket()],
      users: [TECH, IDLE, FOREIGN],
    });

    const result = await svc.getCalendar(dispatcher, {
      ...WEEK,
      employeeIds: [UUID_FOREIGN],
    });

    expect(result.resources.employees).toEqual([]);
    expect(result.events).toEqual([]);
  });

  it('ссылки событий ведут на строки resources и на свою сущность', async () => {
    const { svc } = makeSuite({
      tickets: [
        ticket(),
        ticket({
          id: 't-foreign',
          assignedTechnician: FOREIGN,
          assignedTechnicianId: FOREIGN.id,
          plannedDueAt: null,
        }),
        ticket({
          id: 't-off-directory',
          location: LOC_B1,
          locationId: LOC_B1.id,
          assignedTechnician: null,
          assignedTechnicianId: null,
        }),
      ],
      schedules: [schedule()],
      users: [IDLE],
    });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(result.events).toHaveLength(4);
    expectReferencesResolve(result);
  });
});

describe('SMA-WORK-CALENDAR-V1 meta, дублирование и обрезка', () => {
  it('строка, пришедшая дважды, даёт одно событие', async () => {
    const row = ticket();
    const { svc } = makeSuite({
      tickets: [row, row],
      schedules: [schedule(), schedule()],
    });

    const result = await svc.getCalendar(dispatcher, {
      ...WEEK,
      includeUnscheduled: 'false',
    });

    expect(result.events.map((event) => event.id)).toEqual([
      'ticket:t-1',
      'inspection:s-1',
    ]);
  });

  it('без обрезки total = scheduled + unscheduled = событиям ответа', async () => {
    const { svc } = makeSuite({
      tickets: [ticket(), ticket({ id: 'u', plannedDueAt: null })],
      schedules: [schedule()],
    });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(result.meta).toMatchObject({
      total: 3,
      scheduled: 2,
      unscheduled: 1,
      truncated: false,
      totalIsExact: true,
      returned: { total: 3, scheduled: 2, unscheduled: 1 },
      truncatedSources: [],
    });
  });

  it('при обрезке total — полный счёт по тому же WHERE, а не число полученных', async () => {
    const many = Array.from(
      { length: WORK_CALENDAR_LIMITS.scheduledTickets + 5 },
      (_, index) => ticket({ id: `t-${String(index).padStart(5, '0')}` }),
    );
    const { svc, prisma } = makeSuite({
      tickets: [...many, ticket({ id: 'u', plannedDueAt: null })],
    });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(result.meta).toMatchObject({
      total: WORK_CALENDAR_LIMITS.scheduledTickets + 6,
      scheduled: WORK_CALENDAR_LIMITS.scheduledTickets + 5,
      unscheduled: 1,
      truncated: true,
      totalIsExact: true,
      truncatedSources: ['scheduledTickets'],
    });
    expect(result.meta.returned.total).toBe(
      WORK_CALENDAR_LIMITS.scheduledTickets + 1,
    );
    expect(prisma.ticket.count).toHaveBeenCalledTimes(1);
    expect(prisma.ticket.count.mock.calls[0][0].where).toEqual(
      prisma.ticket.findMany.mock.calls[0][0].where,
    );
  });

  it('планы сверх лимита: total — все видимые, ответ — в пределах лимита', async () => {
    const plans = Array.from(
      { length: WORK_CALENDAR_LIMITS.inspections + 7 },
      (_, index) => schedule({ id: `s-${String(index).padStart(4, '0')}` }),
    );
    const { svc, schedules } = makeSuite({ schedules: plans });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(schedules.listForCalendar.mock.calls[0][1].take).toBe(
      INSPECTION_SCAN_CAP,
    );
    expect(result.events).toHaveLength(WORK_CALENDAR_LIMITS.inspections);
    expect(result.meta).toMatchObject({
      total: WORK_CALENDAR_LIMITS.inspections + 7,
      truncated: true,
      totalIsExact: true,
      truncatedSources: ['inspections'],
    });
  });

  it('за пределом просмотра планов total — нижняя граница, totalIsExact = false', async () => {
    const { svc } = makeSuite({
      schedules: [schedule()],
      fetchedSchedules: INSPECTION_SCAN_CAP + 1,
    });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(result.meta).toMatchObject({ truncated: true, totalIsExact: false });
  });
});

describe('SMA-WORK-CALENDAR-V1 contract fixture', () => {
  /**
   * Файл — реальный ответ сервиса на детерминированных данных, им пользуются
   * frontend-тесты. Тест падает, если форма ответа разошлась с файлом.
   * Обновить после осознанного изменения контракта:
   * UPDATE_WORK_CALENDAR_FIXTURE=1 npx jest work-calendar.service
   */
  const fixturePath = path.join(
    __dirname,
    '__fixtures__',
    'work-calendar.response.v1.json',
  );

  it('ответ совпадает с contract fixture', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date('2026-10-22T09:00:00.000Z'));

    const contractor = person(
      '44444444-4444-4444-8444-444444444444',
      'Артём',
      'Субподрядов',
      'provider-secondary',
    );
    const locA = {
      id: 'aaaaaaaa-0000-4000-8000-000000000001',
      name: 'Магазин №14',
      city: 'Екатеринбург',
      address: 'пр. Ленина, 40',
      clientCompanyId: CLIENT_A,
    };
    const locEmpty = {
      id: 'aaaaaaaa-0000-4000-8000-000000000002',
      name: 'Склад «Восток»',
      city: 'Екатеринбург',
      address: 'ул. Труда, 101',
      clientCompanyId: CLIENT_A,
    };
    const { svc } = makeSuite({
      tickets: [
        ticket({
          id: 'bbbbbbbb-0000-4000-8000-000000000001',
          ticketNumber: 1042,
          problemText: 'Не холодит витрина',
          plannedDueAt: new Date('2026-10-27T11:00:00.000Z'),
          slaDueAt: new Date('2026-10-28T11:00:00.000Z'),
          location: locA,
          locationId: locA.id,
        }),
        ticket({
          id: 'bbbbbbbb-0000-4000-8000-000000000002',
          ticketNumber: 1043,
          status: TicketStatus.NEW,
          problemText: 'Течёт кран',
          plannedDueAt: null,
          location: locA,
          locationId: locA.id,
          assignedTechnician: contractor,
          assignedTechnicianId: contractor.id,
        }),
      ],
      schedules: [
        schedule({
          id: 'cccccccc-0000-4000-8000-000000000001',
          name: 'ТО холодильного оборудования',
          nextDueAt: new Date('2026-10-29T06:00:00.000Z'),
          startDate: new Date('2026-09-29T06:00:00.000Z'),
          overdueAt: new Date('2026-10-30T06:00:00.000Z'),
          graceDays: 1,
          location: locA,
        }),
      ],
      directory: [locA, locEmpty],
    });

    const result = await svc.getCalendar(dispatcher, {
      from: '2026-10-26',
      to: '2026-11-02',
      timezone: 'Europe/Moscow',
      linkedClientCompanyId: CLIENT_A,
    });
    expectReferencesResolve(result);

    const actual = `${JSON.stringify(result, null, 2)}\n`;
    if (process.env.UPDATE_WORK_CALENDAR_FIXTURE === '1') {
      fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
      fs.writeFileSync(fixturePath, actual);
    }
    expect(actual).toBe(fs.readFileSync(fixturePath, 'utf8'));
  });
});
