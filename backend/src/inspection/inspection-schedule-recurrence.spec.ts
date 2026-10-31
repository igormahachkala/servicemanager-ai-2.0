/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await -- хранилище Prisma в памяти: строки и where намеренно any, как в technicians.service.spec.ts */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  InspectionFrequency,
  InspectionRunItemStatus,
  InspectionRunStatus,
  Prisma,
  ServiceContractLocationMode,
  ServiceContractRole,
  ServiceContractStatus,
  UserRole,
} from '@prisma/client';

import { ServiceContractsService } from '../service-contracts/service-contracts.service';

import { InspectionService } from './inspection.service';
import { InspectionScheduleService } from './inspection-schedule.service';

/**
 * SMA-ROUNDS-RECURRENCE-FIX — повторение плана обходов от старта до следующего визита.
 *
 * Хранилище в памяти, а не заглушки «вызван ли update»: проверяется, какой срок
 * у плана оказался после завершения и сколько обходов легло на визит. Условия
 * where исполняются (включая OR и сравнение дат), поэтому сравнение с обменом
 * и условие на статус в записи работают так же, как в Postgres.
 */

const PROVIDER_ID = 'provider-1';
const OTHER_PROVIDER_ID = 'provider-2';
const CLIENT_A = 'client-a';
const LOCATION = { id: 'loc-a1', name: 'Объект', clientCompanyId: CLIENT_A };

const DUE_AT = new Date('2026-10-20T06:00:00.000Z');

const technician = {
  id: 'u-tech',
  companyId: PROVIDER_ID,
  role: UserRole.TECHNICIAN,
};
const foreignTechnician = {
  id: 'u-foreign',
  companyId: OTHER_PROVIDER_ID,
  role: UserRole.TECHNICIAN,
};
const admin = { id: 'u-admin', companyId: PROVIDER_ID, role: UserRole.ADMIN };

function matches(row: any, where: any): boolean {
  return Object.entries(where ?? {}).every(([key, expected]: [string, any]) => {
    if (key === 'OR')
      return expected.some((clause: any) => matches(row, clause));
    const actual = row[key];
    if (expected instanceof Date)
      return actual instanceof Date && actual.getTime() === expected.getTime();
    return actual === expected;
  });
}

function notFound() {
  return new Prisma.PrismaClientKnownRequestError(
    'Record to update not found.',
    {
      code: 'P2025',
      clientVersion: 'test',
    },
  );
}

function makeSchedule(overrides: any = {}) {
  return {
    id: 'sch-1',
    companyId: PROVIDER_ID,
    name: 'Ежедневный обход',
    templateId: 'tpl-1',
    locationId: LOCATION.id,
    equipmentId: null,
    assignedToUserId: technician.id,
    frequency: InspectionFrequency.DAILY,
    intervalDays: null,
    startDate: DUE_AT,
    nextDueAt: DUE_AT,
    leadTimeDays: 0,
    graceDays: 1,
    isActive: true,
    lastGeneratedAt: null,
    lastRunId: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeSuite(
  options: { schedules?: any[]; runs?: any[]; timezone?: string } = {},
) {
  const schedules: any[] = options.schedules ?? [makeSchedule()];
  const runs: any[] = options.runs ?? [];
  const timezones: Record<string, string> = {
    [PROVIDER_ID]: options.timezone ?? 'Europe/Moscow',
  };
  let runSeq = runs.length;

  const contract = {
    id: 'sc-1',
    status: ServiceContractStatus.ACTIVE,
    role: ServiceContractRole.PRIMARY,
    locationMode: ServiceContractLocationMode.ALL_LOCATIONS,
    clientCompanyId: CLIENT_A,
    providerCompanyId: PROVIDER_ID,
    startsAt: null,
    endsAt: null,
    locations: [],
  };
  const serviceContracts = new ServiceContractsService({
    serviceContract: {
      findUnique: jest.fn(async ({ where }: any) => {
        const key = where.clientCompanyId_providerCompanyId;
        return key.clientCompanyId === CLIENT_A &&
          key.providerCompanyId === PROVIDER_ID
          ? contract
          : null;
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any);

  const runView = (run: any) => ({
    ...run,
    location: { ...LOCATION },
    items: run.items ?? [],
  });
  const scheduleView = (schedule: any) => ({
    ...schedule,
    template: { id: schedule.templateId, name: 'ТО' },
    location: { ...LOCATION, city: null, address: null, platformCode: null },
    equipment: null,
    assignedTo: {
      id: schedule.assignedToUserId,
      email: 't@x',
      firstName: null,
      lastName: null,
    },
    company: { timezone: timezones[schedule.companyId] ?? 'UTC' },
    _count: { runs: runs.filter((r) => r.scheduleId === schedule.id).length },
    runs: runs
      .filter((r) => r.scheduleId === schedule.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 1)
      .map((r) => ({
        id: r.id,
        status: r.status,
        completedAt: r.completedAt,
        dueAt: r.dueAt,
      })),
  });

  const prisma: any = {
    userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
    inspectionTemplate: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.companyId === PROVIDER_ID
          ? {
              id: where.id,
              name: 'ТО',
              items: [
                {
                  id: 'ti-1',
                  title: 'Щит',
                  description: null,
                  sortOrder: 0,
                  zoneName: null,
                  zoneSortOrder: 0,
                  checkpointSortOrder: 0,
                  responseType: 'NORMAL_PROBLEM',
                  numericMin: null,
                  numericMax: null,
                  numericUnit: null,
                  isRequired: true,
                },
              ],
            }
          : null,
      ),
    },
    location: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.id === LOCATION.id ? { ...LOCATION } : null,
      ),
    },
    equipment: { findFirst: jest.fn(async () => null) },
    inspectionSchedule: {
      findFirst: jest.fn(async ({ where }: any) => {
        const row = schedules.find((s) => matches(s, where));
        return row ? scheduleView(row) : null;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        const { nextDueAt, ...rest } = where;
        return schedules
          .filter((s) => matches(s, rest))
          .filter((s) => !nextDueAt?.gte || s.nextDueAt >= nextDueAt.gte)
          .filter((s) => !nextDueAt?.lte || s.nextDueAt <= nextDueAt.lte)
          .map(scheduleView);
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = schedules.find((s) => s.id === where.id);
        if (!row) throw notFound();
        Object.assign(row, data);
        return scheduleView(row);
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const hit = schedules.filter((s) => matches(s, where));
        hit.forEach((row) => Object.assign(row, data));
        return { count: hit.length };
      }),
    },
    inspectionRun: {
      findFirst: jest.fn(async ({ where }: any) => {
        const row = runs.find((r) => matches(r, where));
        return row ? runView(row) : null;
      }),
      create: jest.fn(async ({ data }: any) => {
        runSeq += 1;
        const { items, ...scalars } = data;
        const row = {
          ...scalars,
          id: `run-${runSeq}`,
          completedAt: null,
          createdAt: new Date(Date.now() + runSeq),
          items: (items?.create ?? []).map((item: any, i: number) => ({
            id: `item-${runSeq}-${i}`,
            ...item,
          })),
        };
        runs.push(row);
        return runView(row);
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = runs.find((r) => matches(r, where));
        if (!row) throw notFound();
        Object.assign(row, data);
        return runView(row);
      }),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };

  const timeline = {
    recordLegacy: jest.fn().mockResolvedValue(undefined),
  } as any;
  const inspection = new InspectionService(
    prisma,
    {} as any,
    timeline,
    {} as any,
    serviceContracts,
  );
  const scheduleService = new InspectionScheduleService(
    prisma,
    serviceContracts,
    {} as any,
  );

  return { inspection, scheduleService, prisma, schedules, runs, timeline };
}

/** Час спустя после срока визита: обход закрыт вовремя, следующий срок — завтра. */
const NOW = new Date('2026-10-20T07:00:00.000Z');
const freezeAt = (now: Date) =>
  jest.useFakeTimers({
    now,
    doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
  });

beforeEach(() => freezeAt(NOW));
afterEach(() => jest.useRealTimers());

const startByPlan = (svc: InspectionService, user: any = technician) =>
  svc.startRun(user, {
    templateId: 'tpl-1',
    locationId: LOCATION.id,
    scheduleId: 'sch-1',
  } as any);

// ── завершение двигает план ─────────────────────────────────────────────────

describe('завершение обхода по плану', () => {
  it('ежедневный план после завершения встаёт на следующий срок', async () => {
    const { inspection, schedules, prisma } = makeSuite();

    const run = await startByPlan(inspection);
    await inspection.completeRun(technician, run.id);

    expect(schedules[0].nextDueAt.toISOString()).toBe(
      '2026-10-21T06:00:00.000Z',
    );
    expect(schedules[0].isActive).toBe(true);
    // Обход закрыт и план сдвинут одной транзакцией.
    const updateManyCall =
      prisma.inspectionSchedule.updateMany.mock.calls.find(([call]) => call.where.nextDueAt)?.[0];
    expect(updateManyCall.where).toEqual({
      id: 'sch-1',
      companyId: PROVIDER_ID,
      nextDueAt: DUE_AT,
    });
  });

  it.each([
    [InspectionFrequency.WEEKLY, null, '2026-10-27T06:00:00.000Z'],
    [InspectionFrequency.BIWEEKLY, null, '2026-11-03T06:00:00.000Z'],
    [InspectionFrequency.MONTHLY, null, '2026-11-20T06:00:00.000Z'],
    [InspectionFrequency.QUARTERLY, null, '2027-01-20T06:00:00.000Z'],
    [InspectionFrequency.SEMIANNUAL, null, '2027-04-20T06:00:00.000Z'],
    [InspectionFrequency.ANNUAL, null, '2027-10-20T06:00:00.000Z'],
    [InspectionFrequency.CUSTOM, 3, '2026-10-23T06:00:00.000Z'],
  ])(
    '%s (%s): следующий срок %s',
    async (frequency, intervalDays, expected) => {
      const { inspection, schedules } = makeSuite({
        schedules: [makeSchedule({ frequency, intervalDays })],
      });

      const run = await startByPlan(inspection);
      await inspection.completeRun(technician, run.id);

      expect(schedules[0].nextDueAt.toISOString()).toBe(expected);
    },
  );

  it('однократный план после своего визита выключается, срок не трогается', async () => {
    const { inspection, schedules } = makeSuite({
      schedules: [makeSchedule({ frequency: InspectionFrequency.ONCE })],
    });

    const run = await startByPlan(inspection);
    await inspection.completeRun(technician, run.id);

    expect(schedules[0].isActive).toBe(false);
    expect(schedules[0].nextDueAt).toEqual(DUE_AT);
  });

  it('полный цикл: следующий визит начинается с новым сроком и не упирается в прошлый', async () => {
    const { inspection, runs } = makeSuite();

    const first = await startByPlan(inspection);
    await inspection.completeRun(technician, first.id);
    const second = await startByPlan(inspection);

    expect(runs).toHaveLength(2);
    expect(runs[0].dueAt).toEqual(DUE_AT);
    expect(second.dueAt.toISOString()).toBe('2026-10-21T06:00:00.000Z');
    // Просрочка визита зафиксирована в обходе: срок + 1 льготный день.
    expect(second.overdueAt.toISOString()).toBe('2026-10-22T06:00:00.000Z');
  });

  it('обход «от руки» план не двигает', async () => {
    const { inspection, schedules } = makeSuite();

    const run: any = await inspection.startRun(technician, {
      templateId: 'tpl-1',
      locationId: LOCATION.id,
    } as any);
    await inspection.completeRun(technician, run.id);

    expect(schedules[0].nextDueAt).toEqual(DUE_AT);
  });

  it('обход прошлого визита план не двигает', async () => {
    const { inspection, schedules } = makeSuite({
      schedules: [
        makeSchedule({ nextDueAt: new Date('2026-10-25T06:00:00.000Z') }),
      ],
      runs: [
        {
          id: 'run-old',
          companyId: PROVIDER_ID,
          scheduleId: 'sch-1',
          status: InspectionRunStatus.IN_PROGRESS,
          dueAt: DUE_AT,
          createdAt: new Date('2026-10-20T06:00:00.000Z'),
          completedAt: null,
        },
      ],
    });

    await inspection.completeRun(technician, 'run-old');

    expect(schedules[0].nextDueAt.toISOString()).toBe(
      '2026-10-25T06:00:00.000Z',
    );
  });
});

// ── дублирование ────────────────────────────────────────────────────────────

describe('дублирование обходов и сдвигов', () => {
  it('повторное завершение отклоняется, план сдвинут один раз', async () => {
    const { inspection, schedules } = makeSuite();

    const run = await startByPlan(inspection);
    await inspection.completeRun(technician, run.id);
    await expect(inspection.completeRun(technician, run.id)).rejects.toThrow(
      new BadRequestException('Inspection run is already completed'),
    );

    expect(schedules[0].nextDueAt.toISOString()).toBe(
      '2026-10-21T06:00:00.000Z',
    );
  });

  it('два завершения, прошедшие проверку одновременно: запись по статусу пропускает одно', async () => {
    const { inspection, prisma, schedules } = makeSuite();
    const run = await startByPlan(inspection);

    // Оба вызова прочитали обход ещё незакрытым.
    const stale = {
      ...(await prisma.inspectionRun.findFirst({ where: { id: run.id } })),
    };
    prisma.inspectionRun.findFirst
      .mockResolvedValueOnce(stale)
      .mockResolvedValueOnce(stale);

    const results = await Promise.allSettled([
      inspection.completeRun(technician, run.id),
      inspection.completeRun(technician, run.id),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(schedules[0].nextDueAt.toISOString()).toBe(
      '2026-10-21T06:00:00.000Z',
    );
  });

  it('сдвиг сравнением с обменом: уже сдвинутый план второй раз не сдвигается', async () => {
    const { inspection, prisma, schedules } = makeSuite();
    const run = await startByPlan(inspection);

    // Между чтением плана и записью его успел сдвинуть другой путь.
    const original =
      prisma.inspectionSchedule.updateMany.getMockImplementation();
    prisma.inspectionSchedule.updateMany.mockImplementationOnce(
      async (args: any) => {
        schedules[0].nextDueAt = new Date('2026-10-21T06:00:00.000Z');
        return original(args);
      },
    );
    await inspection.completeRun(technician, run.id);

    expect(schedules[0].nextDueAt.toISOString()).toBe(
      '2026-10-21T06:00:00.000Z',
    );
  });

  it('второй старт того же визита — 409 с начатым обходом, второй строки нет', async () => {
    const { inspection, runs } = makeSuite();

    const first = await startByPlan(inspection);
    await expect(startByPlan(inspection)).rejects.toMatchObject({
      response: {
        code: 'INSPECTION_SCHEDULE_RUN_IN_PROGRESS',
        runId: first.id,
      },
    });
    expect(runs).toHaveLength(1);
  });
});

// ── данные до исправления ───────────────────────────────────────────────────

describe('план, завершённый до исправления', () => {
  const legacyRun = (overrides: any = {}) => ({
    id: 'run-legacy',
    companyId: PROVIDER_ID,
    scheduleId: 'sch-1',
    status: InspectionRunStatus.COMPLETED,
    dueAt: DUE_AT,
    createdAt: new Date('2026-10-20T06:00:00.000Z'),
    completedAt: new Date('2026-10-20T07:00:00.000Z'),
    ...overrides,
  });

  it('старт сдвигает застрявший план и начинает уже следующий визит', async () => {
    const { inspection, schedules, runs } = makeSuite({
      schedules: [
        makeSchedule({ lastRunId: 'run-legacy', lastGeneratedAt: new Date() }),
      ],
      runs: [legacyRun()],
    });

    const run = await startByPlan(inspection);

    expect(run.dueAt.toISOString()).toBe('2026-10-21T06:00:00.000Z');
    expect(schedules[0].nextDueAt.toISOString()).toBe(
      '2026-10-21T06:00:00.000Z',
    );
    expect(runs).toHaveLength(2);
  });

  it('однократный план с выполненным визитом второй обход не получает', async () => {
    const { inspection, runs } = makeSuite({
      schedules: [
        makeSchedule({
          frequency: InspectionFrequency.ONCE,
          lastRunId: 'run-legacy',
        }),
      ],
      runs: [legacyRun()],
    });

    await expect(startByPlan(inspection)).rejects.toMatchObject({
      response: {
        code: 'INSPECTION_SCHEDULE_OCCURRENCE_COMPLETED',
        runId: 'run-legacy',
      },
    });
    expect(runs).toHaveLength(1);
  });
});

// ── доступ и изоляция ───────────────────────────────────────────────────────

describe('права и tenant isolation', () => {
  it('техник другого провайдера не завершает чужой обход и не двигает план', async () => {
    const { inspection, schedules } = makeSuite();
    const run = await startByPlan(inspection);

    await expect(
      inspection.completeRun(foreignTechnician, run.id),
    ).rejects.toThrow(new NotFoundException('Inspection run not found'));
    expect(schedules[0].nextDueAt).toEqual(DUE_AT);
  });

  it('план другой компании с тем же id в строке обхода не трогается', async () => {
    const foreign = makeSchedule({ companyId: OTHER_PROVIDER_ID });
    const { inspection, schedules } = makeSuite({
      schedules: [foreign],
      runs: [
        {
          id: 'run-x',
          companyId: PROVIDER_ID,
          scheduleId: 'sch-1',
          status: InspectionRunStatus.IN_PROGRESS,
          dueAt: DUE_AT,
          createdAt: new Date(),
          completedAt: null,
          items: [{ id: 'i', status: InspectionRunItemStatus.OK }],
        },
      ],
    });

    await inspection.completeRun(technician, 'run-x');

    expect(schedules[0].nextDueAt).toEqual(DUE_AT);
    expect(schedules[0].isActive).toBe(true);
  });

  it('техник не стартует план, назначенный другому — план не сдвигается', async () => {
    const { inspection, schedules, runs } = makeSuite({
      schedules: [makeSchedule({ assignedToUserId: 'u-someone-else' })],
    });

    await expect(startByPlan(inspection)).rejects.toThrow(
      new NotFoundException('Inspection schedule not found'),
    );
    expect(runs).toHaveLength(0);
    expect(schedules[0].nextDueAt).toEqual(DUE_AT);
  });
});

// ── просрочка в выдаче плана ────────────────────────────────────────────────

describe('просрочка плана в выдаче', () => {
  beforeEach(() => freezeAt(new Date('2026-10-21T12:00:00.000Z')));

  it('визит с прошедшей льготой просрочен, после завершения — нет', async () => {
    const { inspection, scheduleService } = makeSuite({
      schedules: [makeSchedule({ graceDays: 0 })],
    });

    const before: any = await scheduleService.get(admin, 'sch-1');
    expect(before.isOverdue).toBe(true);
    expect(before.overdueAt).toEqual(DUE_AT);

    const run = await startByPlan(inspection);
    await inspection.completeRun(technician, run.id);

    const after: any = await scheduleService.get(admin, 'sch-1');
    // Закрыт 21-го в 12:00 — следующий срок 22-го в 06:00, ещё впереди.
    expect(after.nextDueAt.toISOString()).toBe('2026-10-22T06:00:00.000Z');
    expect(after.isOverdue).toBe(false);
    expect(after.lastRun).toMatchObject({
      id: run.id,
      status: InspectionRunStatus.COMPLETED,
      dueAt: DUE_AT,
    });
  });

  it('внутри льготных дней визит ещё не просрочен', async () => {
    const { scheduleService } = makeSuite({
      schedules: [makeSchedule({ graceDays: 2 })],
    });

    const schedule: any = await scheduleService.get(admin, 'sch-1');

    expect(schedule.isOverdue).toBe(false);
    expect(schedule.overdueAt.toISOString()).toBe('2026-10-22T06:00:00.000Z');
  });

  it('выполненный однократный план просроченным не числится', async () => {
    const { inspection, scheduleService } = makeSuite({
      schedules: [
        makeSchedule({ frequency: InspectionFrequency.ONCE, graceDays: 0 }),
      ],
    });

    const run = await startByPlan(inspection);
    await inspection.completeRun(technician, run.id);

    const schedule: any = await scheduleService.get(admin, 'sch-1');
    expect(schedule.isActive).toBe(false);
    expect(schedule.isOverdue).toBe(false);
  });
});
