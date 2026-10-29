import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  InspectionFrequency,
  InspectionRunStatus,
  UserRole,
} from '@prisma/client';

import { moveNextOccurrence } from './inspection-schedule-reschedule';
import { InspectionScheduleService } from './inspection-schedule.service';
import { advanceScheduleAfterRun } from './inspection-schedule-advance';

const DAY = 86400000;
const now = new Date('2027-03-01T12:00:00.000Z');
const admin = { id: 'manager-1', companyId: 'company-1', role: UserRole.ADMIN };
const date = (days: number) => new Date(now.getTime() + days * DAY);

function suite(changes: Record<string, unknown> = {}) {
  const current = {
    id: 'schedule-1',
    companyId: admin.companyId,
    isActive: true,
    frequency: InspectionFrequency.WEEKLY,
    intervalDays: null,
    startDate: date(-3),
    nextDueAt: date(4),
    updatedAt: date(-1),
    location: { id: 'site-1', clientCompanyId: admin.companyId },
    graceDays: 2,
    lastGeneratedAt: date(-3),
    lastRunId: 'old-run',
    _count: { runs: 1 },
    runs: [],
    ...changes,
  };
  let row = structuredClone(current);
  const tx = {
    inspectionSchedule: {
      updateMany: jest.fn(async ({ data }: any) => {
        Object.assign(row, data);
        return { count: 1 };
      }),
      findFirst: jest.fn(async () => row),
    },
    inspectionRun: {
      aggregate: jest.fn(async () => ({
        _max: { dueAt: date(-3), completedAt: date(-2) },
      })),
    },
    domainEvent: { create: jest.fn(async ({ data }: any) => data) },
  };
  const prisma = {
    inspectionSchedule: {
      findFirst: jest.fn(async ({ where }: any) =>
        where.companyId === current.companyId ? current : null,
      ),
    },
    $transaction: jest.fn(async (fn: any) => {
      const before = structuredClone(row);
      try {
        return await fn(tx);
      } catch (error) {
        row = before;
        throw error;
      }
    }),
  };
  const contracts = {
    getLinkedClientAccess: jest.fn().mockResolvedValue(null),
  };
  const service = new InspectionScheduleService(
    prisma as never,
    contracts as never,
    {} as never,
  );
  const input = {
    nextDueAt: date(5).toISOString(),
    expectedNextDueAt: current.nextDueAt.toISOString(),
    expectedUpdatedAt: current.updatedAt.toISOString(),
  };
  const move = (override: Partial<typeof input> = {}) =>
    moveNextOccurrence(
      prisma as never,
      admin.companyId,
      admin.id,
      current,
      { ...input, ...override },
      async () => row,
    );
  return {
    current,
    input,
    tx,
    prisma,
    contracts,
    service,
    move,
    row: () => row,
  };
}

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
});
afterEach(() => jest.restoreAllMocks());

describe('next occurrence move (unit contracts; DB races are separate)', () => {
  it('changes only cursor/revision, serializes with start and stores durable audit atomically', async () => {
    const s = suite();
    const result = await s.service.rescheduleNextOccurrence(
      admin,
      s.current.id,
      s.input,
    );
    expect(s.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(s.tx.inspectionSchedule.updateMany).toHaveBeenCalledWith({
      where: {
        id: s.current.id,
        companyId: admin.companyId,
        isActive: true,
        updatedAt: s.current.updatedAt,
        nextDueAt: s.current.nextDueAt,
        runs: {
          none: { status: InspectionRunStatus.IN_PROGRESS },
          some: { status: InspectionRunStatus.COMPLETED },
        },
      },
      data: { nextDueAt: date(5), updatedAt: now },
    });
    expect(s.tx.inspectionRun.aggregate).toHaveBeenCalledWith({
      where: { scheduleId: s.current.id, companyId: admin.companyId },
      _max: { dueAt: true, completedAt: true },
    });
    expect(result.nextDueAt).toEqual(date(5));
    expect(result.overdueAt).toEqual(date(7));
    expect(result.startDate).toEqual(s.current.startDate);
    expect(s.tx.domainEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: admin.companyId,
        actorUserId: admin.id,
        entityId: s.current.id,
        entityType: 'InspectionSchedule',
        type: 'inspection.schedule_updated',
        payload: {
          action: 'next_occurrence_rescheduled',
          oldNextDueAt: s.input.expectedNextDueAt,
          newNextDueAt: s.input.nextDueAt,
          expectedUpdatedAt: s.input.expectedUpdatedAt,
          updatedAt: now.toISOString(),
        },
      }),
    });
  });

  it('allows moving a next occurrence earlier than its cursor, across future periods', async () => {
    const s = suite({ nextDueAt: date(20) });
    await expect(
      s.move({ nextDueAt: date(1).toISOString() }),
    ).resolves.toMatchObject({ nextDueAt: date(1) });
  });

  it.each([
    { isActive: false },
    { frequency: InspectionFrequency.ONCE },
    { frequency: InspectionFrequency.CUSTOM, intervalDays: null },
  ])('rejects ineligible plan %p', async (state) => {
    const s = suite(state);
    await expect(s.move()).rejects.toBeInstanceOf(ConflictException);
    expect(s.prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['expectedUpdatedAt', 'expectedNextDueAt'] as const)(
    'checks %s independently',
    async (field) => {
      const s = suite();
      await expect(
        s.move({ [field]: date(50).toISOString() }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(s.prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each([
    'invalid',
    '2027-02-30T12:00:00.000Z',
    '2027-03-04',
    '2027-03-04T12:00:00',
    '2027-03-04T25:00:00Z',
    '2027-03-04T12:00:00+25:00',
  ])('rejects invalid/ambiguous date %s', async (value) => {
    const s = suite();
    await expect(s.move({ nextDueAt: value })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(s.prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['expectedUpdatedAt', 'expectedNextDueAt'] as const)(
    'also validates malformed %s in service calls',
    async (field) => {
      const s = suite();
      await expect(
        s.move({ [field]: '2027-02-30T12:00:00Z' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(s.prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each([-1, 0, 4])(
    'rejects past, present or unchanged cursor (%s days)',
    async (days) => {
      const s = suite();
      await expect(
        s.move({ nextDueAt: date(days).toISOString() }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(s.prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('handles an explicit timezone offset as the same instant, without changing anchor/grace', async () => {
    const s = suite();
    await s.move({ nextDueAt: '2027-03-06T15:00:00+03:00' });
    expect(s.row().nextDueAt).toEqual(date(5));
    expect(s.row().startDate).toEqual(date(-3));
    expect(s.row().graceDays).toBe(2);
  });

  it('rejects a failed same-row CAS before reading history or recording audit', async () => {
    const s = suite();
    s.tx.inspectionSchedule.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(s.move()).rejects.toBeInstanceOf(ConflictException);
    expect(s.tx.inspectionRun.aggregate).not.toHaveBeenCalled();
    expect(s.tx.domainEvent.create).not.toHaveBeenCalled();
  });

  it.each(['dueAt', 'completedAt'] as const)(
    'rejects a future historical %s collision and rolls back',
    async (field) => {
      const s = suite();
      s.tx.inspectionRun.aggregate.mockResolvedValueOnce({
        _max: { dueAt: date(-3), completedAt: date(-2), [field]: date(6) },
      });
      await expect(s.move()).rejects.toBeInstanceOf(BadRequestException);
      expect(s.row()).toEqual(s.current);
      expect(s.tx.domainEvent.create).not.toHaveBeenCalled();
    },
  );

  it('rejects a duplicate historical dueAt even if that prior visit finished early', async () => {
    const s = suite();
    s.tx.inspectionRun.aggregate.mockResolvedValueOnce({
      _max: { dueAt: date(5), completedAt: date(-2) },
    });
    await expect(s.move()).rejects.toBeInstanceOf(BadRequestException);
    expect(s.row()).toEqual(s.current);
  });

  it('fails closed when completed history has neither a due date nor a completion fact', async () => {
    const s = suite();
    s.tx.inspectionRun.aggregate.mockResolvedValueOnce({
      _max: { dueAt: null, completedAt: null },
    } as never);
    await expect(s.move()).rejects.toBeInstanceOf(ConflictException);
    expect(s.row()).toEqual(s.current);
  });

  it('rolls back the cursor/revision if existing audit storage fails', async () => {
    const s = suite();
    s.tx.domainEvent.create.mockRejectedValueOnce(
      new Error('Audit unavailable'),
    );
    await expect(s.move()).rejects.toThrow('Audit unavailable');
    expect(s.row()).toEqual(s.current);
  });

  it('makes even same-millisecond successful moves invalidate the old revision', async () => {
    const s = suite({ updatedAt: now });
    await s.move();
    expect(s.row().updatedAt.getTime()).toBe(now.getTime() + 1);
  });

  it('rejects a target that became past while waiting for the row lock', async () => {
    const s = suite();
    s.tx.inspectionRun.aggregate.mockImplementationOnce(async () => {
      jest.spyOn(Date, 'now').mockReturnValue(date(6).getTime());
      return { _max: { dueAt: date(-3), completedAt: date(-2) } };
    });
    await expect(s.move()).rejects.toBeInstanceOf(BadRequestException);
    expect(s.row()).toEqual(s.current);
  });
});

describe('same canonical management and scope access', () => {
  it('denies a technician before any database read/write', async () => {
    const s = suite();
    await expect(
      s.service.rescheduleNextOccurrence(
        { ...admin, role: UserRole.TECHNICIAN },
        s.current.id,
        s.input,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(s.prisma.inspectionSchedule.findFirst).not.toHaveBeenCalled();
  });
  it('cannot access a different company schedule', async () => {
    const s = suite();
    await expect(
      s.service.rescheduleNextOccurrence(
        { ...admin, companyId: 'other-company' },
        s.current.id,
        s.input,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(s.prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rechecks canonical linked-client contract for the existing location', async () => {
    const s = suite({
      location: { id: 'linked-site', clientCompanyId: 'linked-client' },
    });
    await expect(
      s.service.rescheduleNextOccurrence(admin, s.current.id, s.input),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(s.contracts.getLinkedClientAccess).toHaveBeenCalledWith(
      admin.companyId,
      'linked-client',
    );
    expect(s.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('completion after a moved visit retains canonical company-timezone grid', () => {
  it.each([
    {
      frequency: InspectionFrequency.MONTHLY,
      startDate: '2027-01-31T06:00:00Z',
      dueAt: '2027-03-05T10:00:00Z',
      completedAt: '2027-03-06T12:00:00Z',
      timezone: 'Europe/Moscow',
      expected: '2027-03-31T06:00:00.000Z',
    },
    {
      frequency: InspectionFrequency.WEEKLY,
      startDate: '2027-03-07T14:00:00Z',
      dueAt: '2027-03-13T16:00:00Z',
      completedAt: '2027-03-13T17:00:00Z',
      timezone: 'America/New_York',
      expected: '2027-03-14T13:00:00.000Z',
    },
    {
      frequency: InspectionFrequency.WEEKLY,
      startDate: '2027-03-07T14:00:00Z',
      dueAt: '2027-03-13T16:00:00Z',
      completedAt: '2027-04-01T17:00:00Z',
      timezone: 'America/New_York',
      expected: '2027-04-04T13:00:00.000Z',
    },
  ])(
    'advances anchored $frequency in $timezone after max(dueAt, completedAt)',
    async (test) => {
      const schedule = {
        id: 'schedule-1',
        frequency: test.frequency,
        startDate: new Date(test.startDate),
        nextDueAt: new Date(test.dueAt),
        intervalDays: null,
        company: { timezone: test.timezone },
      };
      const tx = {
        inspectionSchedule: {
          findFirst: jest.fn().mockResolvedValue(schedule),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      await advanceScheduleAfterRun(tx as never, {
        scheduleId: schedule.id,
        companyId: admin.companyId,
        dueAt: schedule.nextDueAt,
        completedAt: new Date(test.completedAt),
      });
      expect(tx.inspectionSchedule.updateMany).toHaveBeenCalledWith({
        where: {
          id: schedule.id,
          companyId: admin.companyId,
          nextDueAt: schedule.nextDueAt,
        },
        data: { nextDueAt: new Date(test.expected) },
      });
    },
  );
});
