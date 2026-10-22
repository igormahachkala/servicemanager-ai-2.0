/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { InspectionFrequency, TicketStatus, UserRole } from '@prisma/client';

import * as permissionsGuard from '../common/permissions.guard';
import * as ticketAccess from '../tickets/ticket-access.utils';
import {
  WORK_CALENDAR_LIMITS,
  WorkCalendarService,
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

const TECH = {
  id: UUID_TECH,
  firstName: 'Иван',
  lastName: 'Петров',
  companyId: PROVIDER,
};
const IDLE = {
  id: UUID_IDLE,
  firstName: 'Олег',
  lastName: 'Аксёнов',
  companyId: PROVIDER,
};
const FOREIGN = {
  id: UUID_FOREIGN,
  firstName: 'Чужой',
  lastName: 'Сотрудник',
  companyId: 'provider-2',
};

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
      email: 't@x',
      firstName: TECH.firstName,
      lastName: TECH.lastName,
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
    if (key === 'AND')
      return (condition as any[]).every((part) => matches(row, part));
    if (key === 'OR')
      return (condition as any[]).some((part) => matches(row, part));
    const value = row[key];
    if (condition === null) return value === null || value === undefined;
    if (condition instanceof Date || typeof condition !== 'object')
      return value === condition;
    if ('in' in condition && !condition.in.includes(value)) return false;
    if ('equals' in condition && value !== condition.equals) return false;
    if (
      'gte' in condition &&
      !(value && value.getTime() >= condition.gte.getTime())
    )
      return false;
    if (
      'lt' in condition &&
      !(value && value.getTime() < condition.lt.getTime())
    )
      return false;
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
  locationViewGranted?: boolean;
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

  jest
    .spyOn(permissionsGuard, 'hasAnyPermission')
    .mockResolvedValue(options.locationViewGranted ?? true);
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
    svc: new WorkCalendarService(prisma, ticketsQuery, schedules),
    prisma,
    ticketsQuery,
    schedules,
  };
}

afterEach(() => jest.restoreAllMocks());

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

    expect(result.events.map((event) => event.sourceId)).toEqual([
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
    const { svc, prisma, ticketsQuery, schedules } = makeSuite({
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
  });

  it('фильтры только сужают видимое', async () => {
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

    expect(result.events.map((event) => event.sourceId)).toEqual(['a1', 'a2']);
    const [args] = prisma.ticket.findMany.mock.calls[0];
    expect(args.where.AND).toEqual([
      { companyId: CLIENT_A },
      expect.anything(),
      { assignedTechnicianId: { in: [UUID_TECH, UUID_FOREIGN] } },
    ]);
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
    expect(result.events.map((event) => event.sourceId)).toEqual(['at-from']);
    expect(result.events[0].localDate).toBe('2026-10-26');
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
    expect(result.events[0].localDate).toBe('2026-11-01');
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

  it('без плановой даты — только незакрытые заявки, startAt/endAt пустые', async () => {
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

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(result.events).toEqual([
      expect.objectContaining({
        sourceId: 'open',
        scheduling: 'UNSCHEDULED',
        dueAt: null,
        startAt: null,
        endAt: null,
        hasWindow: false,
      }),
    ]);
    expect(result.meta.counts.unscheduledTickets).toBe(1);
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

describe('SMA-WORK-CALENDAR-V1 типы и статусы', () => {
  it('статус DONE: плановые закрытые есть, выборки без даты и планов обходов нет', async () => {
    const { svc, prisma, schedules } = makeSuite({
      tickets: [
        ticket({ id: 'done', status: TicketStatus.DONE }),
        ticket({ id: 'open' }),
      ],
      schedules: [schedule()],
    });

    const result = await svc.getCalendar(dispatcher, {
      ...WEEK,
      statuses: 'DONE',
    });

    expect(result.events.map((event) => event.sourceId)).toEqual(['done']);
    expect(prisma.ticket.findMany).toHaveBeenCalledTimes(1);
    expect(schedules.listForCalendar).not.toHaveBeenCalled();
  });

  it('types=INSPECTION: заявки не читаются, контур всё равно проверяется', async () => {
    const { svc, prisma, ticketsQuery } = makeSuite({
      tickets: [ticket()],
      schedules: [schedule()],
    });

    const result = await svc.getCalendar(dispatcher, {
      ...WEEK,
      types: 'INSPECTION',
    });

    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
    expect(ticketsQuery.resolveListWhere).toHaveBeenCalledTimes(1);
    expect(result.events.map((event) => event.id)).toEqual(['inspection:s-1']);
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

    expect(result.events.map((event) => event.sourceId)).toEqual(['late']);
  });

  it('неизвестные тип, статус, id и флаг — 400', async () => {
    const { svc } = makeSuite();
    await expect(
      svc.getCalendar(dispatcher, { ...WEEK, types: 'SHIFT' }),
    ).rejects.toThrow('Unknown event type');
    await expect(
      svc.getCalendar(dispatcher, { ...WEEK, statuses: 'LOST' }),
    ).rejects.toThrow('Unknown status');
    await expect(
      svc.getCalendar(dispatcher, { ...WEEK, employeeIds: 'u-1' }),
    ).rejects.toThrow('Invalid id');
    await expect(
      svc.getCalendar(dispatcher, { ...WEEK, includeUnscheduled: 'yes' }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('SMA-WORK-CALENDAR-V1 доступ к планам обходов', () => {
  it('без права LOCATIONS_VIEW планы не читаются, capabilities это говорят', async () => {
    const { svc, schedules } = makeSuite({
      schedules: [schedule()],
      locationViewGranted: false,
    });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(schedules.listForCalendar).not.toHaveBeenCalled();
    expect(result.capabilities.eventTypes).toEqual({
      TICKET: true,
      INSPECTION: false,
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
      expect(result.capabilities.eventTypes.INSPECTION).toBe(false);
    },
  );

  it('наблюдатель платформы: ни планов, ни штата', async () => {
    const { svc, schedules, prisma } = makeSuite({
      schedules: [schedule()],
      scope: { visibilityMode: 'platform_observer' },
    });

    const result = await svc.getCalendar(
      { companyId: 'platform', id: 'u-pa', role: UserRole.PLATFORM_ADMIN },
      { ...WEEK, companyId: CLIENT_A },
    );

    expect(schedules.listForCalendar).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(result.capabilities.employeeRoster).toBe(false);
  });

  it('планы другого клиента вне контура запроса не показываются', async () => {
    const { svc } = makeSuite({
      schedules: [
        schedule({ id: 'a' }),
        schedule({ id: 'b', location: LOC_B1 }),
      ],
    });

    const result = await svc.getCalendar(dispatcher, {
      ...WEEK,
      linkedClientCompanyId: CLIENT_A,
    });

    expect(result.events.map((event) => event.sourceId)).toEqual(['a']);
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

    expect(result.events.map((event) => event.sourceId)).toEqual(['bound']);
  });

  it('restricted-empty: ни планов, ни штата, признак в capabilities', async () => {
    const { svc, prisma } = makeSuite({
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
    expect(result.events[0].inspection?.followingDueAt).toBe(
      '2026-11-02T14:00:00.000Z',
    );
  });
});

describe('SMA-WORK-CALENDAR-V1 resources и сотрудники', () => {
  it('штат диспетчера включает сотрудника без событий', async () => {
    const { svc } = makeSuite({ tickets: [ticket()] });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(result.resources.employees.map((employee) => employee.id)).toEqual([
      UUID_IDLE,
      UUID_TECH,
    ]);
    expect(result.capabilities.employeeRoster).toBe(true);
  });

  it('пустой штат и нет событий — пустые resources без ошибки', async () => {
    const { svc } = makeSuite({ users: [] });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(result.resources).toEqual({ employees: [], locations: [] });
    expect(result.events).toEqual([]);
  });

  it('технику — только он сам, а планы — из его контуров', async () => {
    const { svc, prisma, schedules } = makeSuite({
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
    expect(result.events.map((event) => event.sourceId)).toEqual(['a']);
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

  it('исполнитель другой компании на видимой заявке — строка без лишних полей', async () => {
    const { svc } = makeSuite({
      tickets: [
        ticket({
          assignedTechnician: FOREIGN,
          assignedTechnicianId: FOREIGN.id,
        }),
      ],
      users: [],
    });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(result.resources.employees).toEqual([
      {
        id: UUID_FOREIGN,
        firstName: 'Чужой',
        lastName: 'Сотрудник',
        displayName: 'Сотрудник Чужой',
        isOwnCompany: false,
      },
    ]);
  });
});

describe('SMA-WORK-CALENDAR-V1 дублирование и обрезка', () => {
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
    expect(
      new Set(result.resources.locations.map((location) => location.id)).size,
    ).toBe(result.resources.locations.length);
  });

  it('сверх лимита — meta.truncated с источником, событий не больше лимита', async () => {
    const many = Array.from(
      { length: WORK_CALENDAR_LIMITS.scheduledTickets + 5 },
      (_, index) => ticket({ id: `t-${String(index).padStart(5, '0')}` }),
    );
    const { svc } = makeSuite({
      tickets: many,
      schedules: [schedule()],
      fetchedSchedules: 501,
    });

    const result = await svc.getCalendar(dispatcher, {
      ...WEEK,
      includeUnscheduled: 'false',
    });

    expect(result.meta.truncated).toBe(true);
    expect(result.meta.truncatedSources).toEqual([
      'scheduledTickets',
      'inspections',
    ]);
    expect(result.meta.counts.scheduledTickets).toBe(
      WORK_CALENDAR_LIMITS.scheduledTickets,
    );
  });

  it('без обрезки meta.truncated = false', async () => {
    const { svc } = makeSuite({ tickets: [ticket()] });

    const result = await svc.getCalendar(dispatcher, WEEK);

    expect(result.meta).toMatchObject({
      truncated: false,
      truncatedSources: [],
    });
    expect(result.capabilities).toMatchObject({
      readOnly: true,
      timeWindows: false,
      recurrenceProjection: false,
    });
  });
});
