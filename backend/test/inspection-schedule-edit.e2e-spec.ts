import { randomUUID } from 'node:crypto';
import { InspectionFrequency, InspectionRunStatus, Prisma, UserRole } from '@prisma/client';

import { AssignmentEligibilityResolver } from '../src/assignment/assignment-eligibility.resolver';
import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { EditNotStartedScheduleDto } from '../src/inspection/dto/edit-not-started-schedule.dto';
import { InspectionScheduleService } from '../src/inspection/inspection-schedule.service';
import { InspectionService } from '../src/inspection/inspection.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ServiceContractsService } from '../src/service-contracts/service-contracts.service';
import { createCompanyWithUsers, prisma as fixtures } from './helpers';

/**
 * PostgreSQL acceptance, not an in-memory model of row locks. The ordinary CI
 * e2e database supplies DATABASE_URL and migrations; this test creates only its
 * own fixtures. Transaction gates hold a real UPDATE open while the competing
 * service reaches its own guarded UPDATE. No sleeps or schema changes are used.
 *
 * HTTP permission/DTO checks are covered separately. Here the actual services,
 * canonical location/assignment checks and idempotency store use PostgreSQL;
 * only unrelated ticket/export/timeline collaborators are inert.
 */
describe('never-started schedule edit vs run start (PostgreSQL)', () => {
  const db = new PrismaService();
  const contracts = new ServiceContractsService(db);
  const eligibility = new AssignmentEligibilityResolver(db, contracts);
  const schedules = new InspectionScheduleService(db, contracts, eligibility);
  const timeline = { recordLegacy: jest.fn().mockResolvedValue(undefined) };
  const runs = new InspectionService(
    db, {} as never, timeline as never, {} as never, contracts,
    new IdempotencyService(db),
  );
  const dueAt = new Date('2026-11-10T09:00:00.000Z');
  const changedDueAt = new Date('2026-11-12T13:30:00.000Z');
  let companyId = '';
  let admin: { id: string; companyId: string; role: UserRole };
  let templateId = '';
  let locationId = '';

  beforeAll(async () => {
    await db.$connect();
    const suffix = randomUUID();
    const fixture = await createCompanyWithUsers({
      companyName: `Schedule edit race ${suffix}`,
      adminEmail: `schedule-edit-admin-${suffix}@example.com`,
      techEmail: `schedule-edit-tech-${suffix}@example.com`,
      otherTechEmail: `schedule-edit-tech2-${suffix}@example.com`,
    });
    companyId = fixture.company.id;
    admin = { id: fixture.admin.id, companyId, role: UserRole.ADMIN };
    const location = await db.location.create({
      data: { clientCompanyId: companyId, name: 'Race test site', platformCode: suffix },
    });
    locationId = location.id;
    const template = await db.inspectionTemplate.create({
      data: {
        companyId, name: `Race test template ${suffix}`,
        items: { create: [{ title: 'Existing checkpoint', sortOrder: 0 }] },
      },
    });
    templateId = template.id;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    timeline.recordLegacy.mockClear();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    if (companyId) {
      // Never reset the shared e2e database or another test's company.
      await db.inspectionRun.deleteMany({ where: { companyId } });
      await db.inspectionSchedule.deleteMany({ where: { companyId } });
      await db.inspectionTemplate.deleteMany({ where: { companyId } });
      await db.idempotencyRecord.deleteMany({ where: { companyId } });
      await db.domainEvent.deleteMany({ where: { companyId } });
      await db.company.delete({ where: { id: companyId } });
    }
    await db.$disconnect();
    await fixtures.$disconnect();
  });

  async function plan() {
    return schedules.create(admin, {
      templateId, locationId, name: 'Original plan',
      frequency: InspectionFrequency.WEEKLY, startDate: dueAt.toISOString(),
    });
  }

  function editInput(schedule: { updatedAt: Date }): EditNotStartedScheduleDto {
    return {
      templateId, locationId, name: 'Edited plan',
      frequency: InspectionFrequency.WEEKLY, startDate: changedDueAt.toISOString(),
      expectedUpdatedAt: schedule.updatedAt.toISOString(),
      equipmentId: null, assignedToUserId: null, intervalDays: null,
    };
  }

  const start = (scheduleId: string) => runs.startRun(admin, { templateId, locationId, scheduleId });

  type Write = Parameters<Prisma.TransactionClient['inspectionSchedule']['updateMany']>[0];
  type Hooks = {
    beforeWrite?: (args: Write) => Promise<void> | void;
    afterWrite?: (args: Write) => Promise<void> | void;
    beforeRunCreate?: () => Promise<void> | void;
    beforeEventCreate?: () => Promise<void> | void;
  };

  function instrumentTransactions(hooks: Hooks) {
    const transaction = db.$transaction.bind(db);
    // Intercept only delegate boundaries; every intercepted write still runs on
    // the actual transaction connection, with PostgreSQL isolation and rollback.
    return jest.spyOn(db, '$transaction').mockImplementation((async (callback: any, options?: any) => {
      if (typeof callback !== 'function') return transaction(callback, options);
      return transaction(async (tx) => callback(new Proxy(tx, {
        get(target, property) {
          if (property === 'inspectionSchedule') {
            return new Proxy(target.inspectionSchedule, {
              get(delegate, method) {
                if (method === 'updateMany') return async (args: Write) => {
                  await hooks.beforeWrite?.(args);
                  const result = await delegate.updateMany(args);
                  await hooks.afterWrite?.(args);
                  return result;
                };
                return Reflect.get(delegate, method, delegate);
              },
            });
          }
          if (property === 'inspectionRun') {
            return new Proxy(target.inspectionRun, {
              get(delegate, method) {
                if (method === 'create') return async (args: any) => {
                  await hooks.beforeRunCreate?.();
                  return delegate.create(args);
                };
                return Reflect.get(delegate, method, delegate);
              },
            });
          }
          if (property === 'domainEvent') {
            return new Proxy(target.domainEvent, {
              get(delegate, method) {
                if (method === 'create') return async (args: any) => {
                  await hooks.beforeEventCreate?.();
                  return delegate.create(args);
                };
                return Reflect.get(delegate, method, delegate);
              },
            });
          }
          return Reflect.get(target, property, target);
        },
      })), options);
    }) as any);
  }

  function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => { resolve = done; });
    return { promise, resolve };
  }

  async function reached(signal: Promise<void>, operation: Promise<unknown>, label: string) {
    // A failed operation must fail the test immediately rather than leave a gate
    // pending until Jest's timeout. The timeout is a deadlock diagnostic, not a sleep.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        signal,
        operation.then(() => { throw new Error(`${label}: operation ended before reaching the gate`); }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`${label}: transaction gate not reached`)), 4000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const isEdit = (args: Write) => !!args?.data && 'name' in args.data;

  it('edit wins the row lock: a start using the old snapshot is rejected without inserting a run', async () => {
    const schedule = await plan();
    const editorHasLock = deferred();
    const starterReachedWrite = deferred();
    const releaseEditor = deferred();
    instrumentTransactions({
      beforeWrite: (args) => {
        if (args?.where?.id === schedule.id && !isEdit(args)) starterReachedWrite.resolve();
      },
      afterWrite: async (args) => {
        if (args?.where?.id === schedule.id && isEdit(args)) {
          editorHasLock.resolve();
          await releaseEditor.promise;
        }
      },
    });

    const editing = schedules.editNotStarted(admin, schedule.id, editInput(schedule));
    let starting: ReturnType<typeof start> | undefined;
    try {
      await reached(editorHasLock.promise, editing, 'edit lock');
      starting = start(schedule.id);
      // Attach rejection handling before releasing the first transaction.
      const rejectedStart = expect(starting).rejects.toMatchObject({
        response: { code: 'INSPECTION_SCHEDULE_CHANGED' },
      });
      await reached(starterReachedWrite.promise, starting, 'start write');
      releaseEditor.resolve();
      await editing;
      await rejectedStart;
    } finally {
      releaseEditor.resolve();
      await Promise.allSettled([editing, ...(starting ? [starting] : [])]);
    }

    const stored = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(stored.name).toBe('Edited plan');
    expect(stored.nextDueAt).toEqual(changedDueAt);
    expect(stored.lastRunId).toBeNull();
    expect(stored.lastGeneratedAt).toBeNull();
    expect(await db.inspectionRun.count({ where: { scheduleId: schedule.id } })).toBe(0);
  });

  it('start wins the row lock: the pending edit conflicts and the run retains the original plan', async () => {
    const schedule = await plan();
    const starterHasLock = deferred();
    const editorReachedWrite = deferred();
    const releaseStarter = deferred();
    instrumentTransactions({
      beforeWrite: (args) => {
        if (args?.where?.id === schedule.id && isEdit(args)) editorReachedWrite.resolve();
      },
      afterWrite: async (args) => {
        if (args?.where?.id === schedule.id && !isEdit(args)) {
          starterHasLock.resolve();
          await releaseStarter.promise;
        }
      },
    });

    const starting = start(schedule.id);
    let editing: ReturnType<typeof schedules.editNotStarted> | undefined;
    try {
      await reached(starterHasLock.promise, starting, 'start lock');
      editing = schedules.editNotStarted(admin, schedule.id, editInput(schedule));
      const rejectedEdit = expect(editing).rejects.toMatchObject({
        response: { code: 'INSPECTION_SCHEDULE_NOT_EDITABLE' },
      });
      await reached(editorReachedWrite.promise, editing, 'edit write');
      releaseStarter.resolve();
      const run = await starting;
      await rejectedEdit;
      // The start response intentionally omits dueAt; verify the committed row,
      // not an expanded API projection, to prove the original snapshot survived.
      const storedRun = await db.inspectionRun.findUniqueOrThrow({ where: { id: run.id } });
      expect(storedRun.dueAt).toEqual(dueAt);
      expect(storedRun.templateId).toBe(templateId);
      expect(storedRun.locationId).toBe(locationId);
    } finally {
      releaseStarter.resolve();
      await Promise.allSettled([starting, ...(editing ? [editing] : [])]);
    }

    const stored = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(stored.name).toBe('Original plan');
    expect(stored.startDate).toEqual(dueAt);
    expect(stored.nextDueAt).toEqual(dueAt);
    expect(stored.lastRunId).toBeTruthy();
    expect(await db.inspectionRun.count({ where: { scheduleId: schedule.id } })).toBe(1);
  });

  it('rolls back the reserved revision if run insertion fails, then permits edit and retry', async () => {
    const schedule = await plan();
    const before = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    const transactionSpy = instrumentTransactions({
      beforeRunCreate: () => { throw new Error('Injected run insert failure'); },
    });
    await expect(start(schedule.id)).rejects.toThrow('Injected run insert failure');
    transactionSpy.mockRestore();

    const after = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(after).toEqual(before);
    expect(await db.inspectionRun.count({ where: { scheduleId: schedule.id } })).toBe(0);
    expect(await db.idempotencyRecord.count({
      where: { companyId, key: `${schedule.id}:initial`, operationType: 'inspection.start_run' },
    })).toBe(0);

    await schedules.editNotStarted(admin, schedule.id, editInput(schedule));
    const run = await start(schedule.id);
    const storedRun = await db.inspectionRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(storedRun.dueAt).toEqual(changedDueAt);
    expect(await db.inspectionRun.count({ where: { scheduleId: schedule.id } })).toBe(1);
  });

  it('identifies the existing in-progress run on a repeated start instead of creating another', async () => {
    const schedule = await plan();
    const first = await start(schedule.id);
    const before = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    await expect(start(schedule.id)).rejects.toMatchObject({
      response: { code: 'INSPECTION_SCHEDULE_RUN_IN_PROGRESS', runId: first.id },
    });
    expect(await db.inspectionRun.count({ where: { scheduleId: schedule.id } })).toBe(1);
    expect(await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } })).toEqual(before);
  });

  it('does not edit completed history, even with the latest revision token', async () => {
    const schedule = await plan();
    const run = await start(schedule.id);
    await db.inspectionRun.update({
      where: { id: run.id }, data: { status: InspectionRunStatus.COMPLETED, completedAt: new Date() },
    });
    const beforePlan = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    const beforeRun = await db.inspectionRun.findUniqueOrThrow({ where: { id: run.id } });
    await expect(schedules.editNotStarted(admin, schedule.id, editInput(beforePlan))).rejects.toMatchObject({
      response: { code: 'INSPECTION_SCHEDULE_NOT_EDITABLE' },
    });
    expect(await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } })).toEqual(beforePlan);
    expect(await db.inspectionRun.findUniqueOrThrow({ where: { id: run.id } })).toEqual(beforeRun);
  });

  it('rejects a stale editor token after a successful edit', async () => {
    const schedule = await plan();
    const draft = editInput(schedule);
    await schedules.editNotStarted(admin, schedule.id, draft);
    const before = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    await expect(schedules.editNotStarted(admin, schedule.id, { ...draft, name: 'Stale overwrite' }))
      .rejects.toMatchObject({ response: { code: 'INSPECTION_SCHEDULE_NOT_EDITABLE' } });
    expect(await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } })).toEqual(before);
  });

  // All dates below are relative: these acceptance cases must remain future
  // occurrences when CI runs months after this feature was introduced.
  const DAY = 24 * 60 * 60 * 1000;
  async function recurringPlanWithHistory() {
    const anchor = new Date(Date.now() - 3 * DAY);
    const created = await schedules.create(admin, {
      templateId, locationId, name: 'Recurring plan with completed history',
      frequency: InspectionFrequency.WEEKLY, startDate: anchor.toISOString(),
      graceDays: 2,
    });
    const historicalRun = await db.inspectionRun.create({
      data: {
        companyId, templateId, locationId, scheduleId: created.id,
        performedByUserId: admin.id, title: 'Completed historical fact',
        status: InspectionRunStatus.COMPLETED, dueAt: anchor,
        overdueAt: new Date(anchor.getTime() + 2 * DAY),
        completedAt: new Date(anchor.getTime() + 60 * 60 * 1000),
        reportNumber: `historic-${randomUUID()}`,
      },
    });
    const schedule = await db.inspectionSchedule.update({
      where: { id: created.id },
      data: {
        nextDueAt: new Date(anchor.getTime() + 7 * DAY),
        lastRunId: historicalRun.id, lastGeneratedAt: historicalRun.createdAt,
      },
    });
    return { schedule, historicalRun };
  }

  function moveInput(schedule: { updatedAt: Date; nextDueAt: Date }, target: Date) {
    return {
      nextDueAt: target.toISOString(),
      expectedNextDueAt: schedule.nextDueAt.toISOString(),
      expectedUpdatedAt: schedule.updatedAt.toISOString(),
    };
  }

  const isMove = (args: Write) => !!args?.data && 'nextDueAt' in args.data && !isEdit(args);
  const nextMoveConflict = { response: { code: 'INSPECTION_SCHEDULE_NEXT_OCCURRENCE_CONFLICT' } };

  const moveEvents = (scheduleId: string) => db.domainEvent.findMany({
    where: { companyId, entityType: 'InspectionSchedule', entityId: scheduleId, type: 'inspection.schedule_updated' },
  });

  async function expectSingleMoveAudit(
    before: { id: string; nextDueAt: Date; updatedAt: Date }, target: Date, updatedAt: Date,
  ) {
    const events = await moveEvents(before.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      companyId, entityType: 'InspectionSchedule', entityId: before.id,
      type: 'inspection.schedule_updated', actorUserId: admin.id,
      payload: {
        action: 'next_occurrence_rescheduled',
        oldNextDueAt: before.nextDueAt.toISOString(), newNextDueAt: target.toISOString(),
        expectedUpdatedAt: before.updatedAt.toISOString(), updatedAt: updatedAt.toISOString(),
      },
    });
  }

  it('next move wins the row lock: old start conflicts, fresh start uses the moved cursor', async () => {
    const { schedule, historicalRun } = await recurringPlanWithHistory();
    const target = new Date(schedule.nextDueAt.getTime() + DAY);
    const moverHasLock = deferred();
    const starterReachedWrite = deferred();
    const releaseMover = deferred();
    const spy = instrumentTransactions({
      beforeWrite: (args) => {
        if (args?.where?.id === schedule.id && !isMove(args)) starterReachedWrite.resolve();
      },
      afterWrite: async (args) => {
        if (args?.where?.id === schedule.id && isMove(args)) {
          moverHasLock.resolve();
          await releaseMover.promise;
        }
      },
    });
    const moving = schedules.rescheduleNextOccurrence(admin, schedule.id, moveInput(schedule, target));
    let starting: ReturnType<typeof start> | undefined;
    try {
      await reached(moverHasLock.promise, moving, 'next move lock');
      starting = start(schedule.id);
      const rejectedStart = expect(starting).rejects.toMatchObject({
        response: { code: 'INSPECTION_SCHEDULE_CHANGED' },
      });
      await reached(starterReachedWrite.promise, starting, 'next start write');
      releaseMover.resolve();
      await moving;
      await rejectedStart;
    } finally {
      releaseMover.resolve();
      await Promise.allSettled([moving, ...(starting ? [starting] : [])]);
      spy.mockRestore();
    }
    expect(await db.inspectionRun.count({ where: { scheduleId: schedule.id } })).toBe(1);
    const freshRun = await start(schedule.id);
    const storedRun = await db.inspectionRun.findUniqueOrThrow({ where: { id: freshRun.id } });
    expect(storedRun.dueAt).toEqual(target);
    expect(storedRun.overdueAt).toEqual(new Date(target.getTime() + 2 * DAY));
    expect(await db.inspectionRun.findUniqueOrThrow({ where: { id: historicalRun.id } })).toEqual(historicalRun);
    expect(await db.inspectionRun.count({ where: { scheduleId: schedule.id } })).toBe(2);
  });

  it('next start wins the row lock: move conflicts and never changes either run fact', async () => {
    const { schedule, historicalRun } = await recurringPlanWithHistory();
    const starterHasLock = deferred();
    const moverReachedWrite = deferred();
    const releaseStarter = deferred();
    instrumentTransactions({
      beforeWrite: (args) => {
        if (args?.where?.id === schedule.id && isMove(args)) moverReachedWrite.resolve();
      },
      afterWrite: async (args) => {
        if (args?.where?.id === schedule.id && !isMove(args)) {
          starterHasLock.resolve();
          await releaseStarter.promise;
        }
      },
    });
    const starting = start(schedule.id);
    let moving: ReturnType<typeof schedules.rescheduleNextOccurrence> | undefined;
    try {
      await reached(starterHasLock.promise, starting, 'next start lock');
      moving = schedules.rescheduleNextOccurrence(admin, schedule.id,
        moveInput(schedule, new Date(schedule.nextDueAt.getTime() + DAY)));
      const rejectedMove = expect(moving).rejects.toMatchObject(nextMoveConflict);
      await reached(moverReachedWrite.promise, moving, 'next move write');
      releaseStarter.resolve();
      const run = await starting;
      await rejectedMove;
      const storedRun = await db.inspectionRun.findUniqueOrThrow({ where: { id: run.id } });
      expect(storedRun.dueAt).toEqual(schedule.nextDueAt);
      expect(storedRun.status).toBe(InspectionRunStatus.IN_PROGRESS);
    } finally {
      releaseStarter.resolve();
      await Promise.allSettled([starting, ...(moving ? [moving] : [])]);
    }
    const stored = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(stored.startDate).toEqual(schedule.startDate);
    expect(stored.nextDueAt).toEqual(schedule.nextDueAt);
    expect(await db.inspectionRun.findUniqueOrThrow({ where: { id: historicalRun.id } })).toEqual(historicalRun);
    expect(await db.inspectionRun.count({ where: { scheduleId: schedule.id } })).toBe(2);
  });

  it('serializes two next moves from the same snapshot: exactly one date is committed', async () => {
    const { schedule } = await recurringPlanWithHistory();
    const firstTarget = new Date(schedule.nextDueAt.getTime() + DAY);
    const secondTarget = new Date(schedule.nextDueAt.getTime() + 2 * DAY);
    const firstHasLock = deferred();
    const secondReachedWrite = deferred();
    const releaseFirst = deferred();
    instrumentTransactions({
      beforeWrite: (args) => {
        if (args?.where?.id === schedule.id && isMove(args) &&
            args?.data?.nextDueAt instanceof Date && args.data.nextDueAt.getTime() === secondTarget.getTime()) {
          secondReachedWrite.resolve();
        }
      },
      afterWrite: async (args) => {
        if (args?.where?.id === schedule.id && isMove(args) &&
            args?.data?.nextDueAt instanceof Date && args.data.nextDueAt.getTime() === firstTarget.getTime()) {
          firstHasLock.resolve();
          await releaseFirst.promise;
        }
      },
    });
    const first = schedules.rescheduleNextOccurrence(admin, schedule.id, moveInput(schedule, firstTarget));
    let second: ReturnType<typeof schedules.rescheduleNextOccurrence> | undefined;
    try {
      await reached(firstHasLock.promise, first, 'first move lock');
      second = schedules.rescheduleNextOccurrence(admin, schedule.id, moveInput(schedule, secondTarget));
      const rejectedSecond = expect(second).rejects.toMatchObject(nextMoveConflict);
      await reached(secondReachedWrite.promise, second, 'second move write');
      releaseFirst.resolve();
      await first;
      await rejectedSecond;
    } finally {
      releaseFirst.resolve();
      await Promise.allSettled([first, ...(second ? [second] : [])]);
    }
    const stored = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(stored.nextDueAt).toEqual(firstTarget);
    expect(stored.updatedAt.getTime()).toBeGreaterThan(schedule.updatedAt.getTime());
    await expectSingleMoveAudit(schedule, firstTarget, stored.updatedAt);
    expect(await db.inspectionRun.count({ where: { scheduleId: schedule.id } })).toBe(1);
  });

  it('rolls back the next date and revision after a failed move transaction, then accepts the same draft', async () => {
    const { schedule, historicalRun } = await recurringPlanWithHistory();
    const draft = moveInput(schedule, new Date(schedule.nextDueAt.getTime() + DAY));
    const spy = instrumentTransactions({
      afterWrite: (args) => {
        if (args?.where?.id === schedule.id && isMove(args)) throw new Error('Injected next move failure');
      },
    });
    await expect(schedules.rescheduleNextOccurrence(admin, schedule.id, draft))
      .rejects.toThrow('Injected next move failure');
    spy.mockRestore();
    expect(await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } })).toEqual(schedule);
    expect(await db.inspectionRun.findUniqueOrThrow({ where: { id: historicalRun.id } })).toEqual(historicalRun);
    expect(await moveEvents(schedule.id)).toHaveLength(0);
    await schedules.rescheduleNextOccurrence(admin, schedule.id, draft);
    const stored = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(stored.nextDueAt).toEqual(new Date(draft.nextDueAt));
    expect(stored.updatedAt.getTime()).toBeGreaterThan(schedule.updatedAt.getTime());
    await expectSingleMoveAudit(schedule, new Date(draft.nextDueAt), stored.updatedAt);
  });

  it('allows a new draft to move forward then back while rejecting stale revision and stale cursor independently', async () => {
    const { schedule, historicalRun } = await recurringPlanWithHistory();
    const farTarget = new Date(schedule.nextDueAt.getTime() + 5 * DAY);
    const oldDraft = moveInput(schedule, farTarget);
    await schedules.rescheduleNextOccurrence(admin, schedule.id, oldDraft);
    const moved = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    const backTarget = new Date(schedule.nextDueAt.getTime() - DAY);
    await expect(schedules.rescheduleNextOccurrence(admin, schedule.id, {
      ...moveInput(moved, backTarget), expectedUpdatedAt: schedule.updatedAt.toISOString(),
    })).rejects.toMatchObject(nextMoveConflict);
    await expect(schedules.rescheduleNextOccurrence(admin, schedule.id, {
      ...moveInput(moved, backTarget), expectedNextDueAt: schedule.nextDueAt.toISOString(),
    })).rejects.toMatchObject(nextMoveConflict);
    expect(await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } })).toEqual(moved);
    await schedules.rescheduleNextOccurrence(admin, schedule.id, moveInput(moved, backTarget));
    const returned = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(returned.nextDueAt).toEqual(backTarget);
    expect(returned.updatedAt.getTime()).toBeGreaterThan(moved.updatedAt.getTime());
    expect(await moveEvents(schedule.id)).toHaveLength(2);
    // Both moves replace the same original slot.
    expect(returned.replacedDueAt).toEqual(schedule.nextDueAt);
    // A move is not a new anchor, a synthetic run or a history rewrite.
    expect({
      ...returned, nextDueAt: schedule.nextDueAt, replacedDueAt: null, updatedAt: schedule.updatedAt,
    }).toEqual(schedule);
    expect(await db.inspectionRun.findUniqueOrThrow({ where: { id: historicalRun.id } })).toEqual(historicalRun);
    expect(await db.inspectionRun.count({ where: { scheduleId: schedule.id } })).toBe(1);
  });

  it('cannot move an active occurrence or replay a completed historical date', async () => {
    const { schedule, historicalRun } = await recurringPlanWithHistory();
    await expect(schedules.rescheduleNextOccurrence(admin, schedule.id,
      moveInput(schedule, historicalRun.dueAt!))).rejects.toThrow();
    expect(await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } })).toEqual(schedule);
    const run = await start(schedule.id);
    const started = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    const beforeRun = await db.inspectionRun.findUniqueOrThrow({ where: { id: run.id } });
    await expect(schedules.rescheduleNextOccurrence(admin, schedule.id,
      moveInput(started, new Date(schedule.nextDueAt.getTime() + DAY)))).rejects.toMatchObject(nextMoveConflict);
    expect(await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } })).toEqual(started);
    expect(await db.inspectionRun.findUniqueOrThrow({ where: { id: run.id } })).toEqual(beforeRun);
    expect(await db.inspectionRun.findUniqueOrThrow({ where: { id: historicalRun.id } })).toEqual(historicalRun);
  });

  async function completeCurrentVisit(scheduleId: string) {
    const run = await start(scheduleId);
    await runs.completeRun(admin, run.id);
    return db.inspectionRun.findUniqueOrThrow({ where: { id: run.id } });
  }

  // Сетка фикстуры: еженедельно, исходный слот S = schedule.nextDueAt, следующий S + 7 дней.
  it.each([
    ['earlier', -2 * DAY],
    ['later', 3 * DAY],
  ])('a visit moved %s and completed continues with the slot after the replaced one', async (_label, shift) => {
    const { schedule, historicalRun } = await recurringPlanWithHistory();
    const target = new Date(schedule.nextDueAt.getTime() + shift);
    await schedules.rescheduleNextOccurrence(admin, schedule.id, moveInput(schedule, target));
    const moved = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(moved.replacedDueAt).toEqual(schedule.nextDueAt);

    const completed = await completeCurrentVisit(schedule.id);
    expect(completed.dueAt).toEqual(target);
    expect(completed.status).toBe(InspectionRunStatus.COMPLETED);

    const after = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    // Ни лишнего визита на исходном слоте, ни пропуска следующего.
    expect(after.nextDueAt).toEqual(new Date(schedule.nextDueAt.getTime() + 7 * DAY));
    expect(after.replacedDueAt).toBeNull();
    expect(after.startDate).toEqual(schedule.startDate);
    expect(after.frequency).toBe(InspectionFrequency.WEEKLY);
    expect(await db.inspectionRun.findUniqueOrThrow({ where: { id: historicalRun.id } })).toEqual(historicalRun);
    expect(await db.inspectionRun.count({ where: { scheduleId: schedule.id } })).toBe(2);
  });

  it('a visit moved later, then earlier, still replaces the original slot once', async () => {
    const { schedule } = await recurringPlanWithHistory();
    await schedules.rescheduleNextOccurrence(admin, schedule.id,
      moveInput(schedule, new Date(schedule.nextDueAt.getTime() + 3 * DAY)));
    const once = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    const earlier = new Date(schedule.nextDueAt.getTime() - 2 * DAY);
    await schedules.rescheduleNextOccurrence(admin, schedule.id, moveInput(once, earlier));
    const twice = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(twice).toMatchObject({ nextDueAt: earlier, replacedDueAt: schedule.nextDueAt });

    await completeCurrentVisit(schedule.id);
    const after = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(after.nextDueAt).toEqual(new Date(schedule.nextDueAt.getTime() + 7 * DAY));
    expect(after.replacedDueAt).toBeNull();
  });

  it.each([
    ['the next grid slot', 7 * DAY],
    ['past the next grid slot', 9 * DAY],
    ['a far future date', Date.parse('2099-01-01T00:00:00.000Z')],
  ])('rejects a move to %s without changing the plan or writing audit', async (_label, value) => {
    const { schedule } = await recurringPlanWithHistory();
    const target = value > 365 * DAY ? new Date(value) : new Date(schedule.nextDueAt.getTime() + value);
    await expect(schedules.rescheduleNextOccurrence(admin, schedule.id, moveInput(schedule, target)))
      .rejects.toMatchObject({
        response: {
          code: 'INSPECTION_SCHEDULE_NEXT_OCCURRENCE_TOO_LATE',
          nextSlotDueAt: new Date(schedule.nextDueAt.getTime() + 7 * DAY).toISOString(),
        },
      });
    expect(await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } })).toEqual(schedule);
    expect(await moveEvents(schedule.id)).toHaveLength(0);
  });

  it('blocks any older in-progress run even when lastRunId points to a completed run at another date', async () => {
    const { schedule, historicalRun } = await recurringPlanWithHistory();
    const olderActive = await db.inspectionRun.create({
      data: {
        companyId, templateId, locationId, scheduleId: schedule.id,
        title: 'Older unfinished occurrence', status: InspectionRunStatus.IN_PROGRESS,
        dueAt: new Date(schedule.startDate.getTime() - 7 * DAY),
        createdAt: new Date(schedule.startDate.getTime() - 7 * DAY),
      },
    });
    expect(schedule.lastRunId).toBe(historicalRun.id);
    await expect(schedules.rescheduleNextOccurrence(admin, schedule.id,
      moveInput(schedule, new Date(schedule.nextDueAt.getTime() + DAY)))).rejects.toMatchObject(nextMoveConflict);
    expect(await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } })).toEqual(schedule);
    expect(await db.inspectionRun.findUniqueOrThrow({ where: { id: olderActive.id } })).toEqual(olderActive);
    expect(await db.inspectionRun.findUniqueOrThrow({ where: { id: historicalRun.id } })).toEqual(historicalRun);
    expect(await db.inspectionRun.count({ where: { scheduleId: schedule.id } })).toBe(2);
  });


  it('rolls back the guarded write when a future target would replay an already completed future-due fact', async () => {
    const { schedule, historicalRun } = await recurringPlanWithHistory();
    // Completion can happen early. A merely "future" target is not enough:
    // the fact's original planned due date must remain a closed boundary.
    const completedDueAt = new Date(schedule.nextDueAt.getTime() + DAY);
    const futureFact = await db.inspectionRun.update({
      where: { id: historicalRun.id }, data: { dueAt: completedDueAt },
    });
    const before = await db.inspectionSchedule.update({
      where: { id: schedule.id }, data: { nextDueAt: new Date(completedDueAt.getTime() + 7 * DAY) },
    });
    let reachedGuardedWrite = false;
    instrumentTransactions({
      afterWrite: (args) => {
        if (args?.where?.id === schedule.id && isMove(args)) reachedGuardedWrite = true;
      },
    });
    await expect(schedules.rescheduleNextOccurrence(admin, schedule.id,
      moveInput(before, completedDueAt))).rejects.toThrow();
    expect(reachedGuardedWrite).toBe(true);
    expect(await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } })).toEqual(before);
    expect(await db.inspectionRun.findUniqueOrThrow({ where: { id: historicalRun.id } })).toEqual(futureFact);
    expect(await db.inspectionRun.count({ where: { scheduleId: schedule.id } })).toBe(1);
  });


  it('requires durable audit to commit: an event insertion failure rolls back date and revision', async () => {
    const { schedule, historicalRun } = await recurringPlanWithHistory();
    const target = new Date(schedule.nextDueAt.getTime() + DAY);
    const draft = moveInput(schedule, target);
    const spy = instrumentTransactions({
      beforeEventCreate: () => { throw new Error('Injected schedule audit failure'); },
    });
    await expect(schedules.rescheduleNextOccurrence(admin, schedule.id, draft))
      .rejects.toThrow('Injected schedule audit failure');
    spy.mockRestore();
    expect(await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } })).toEqual(schedule);
    expect(await db.inspectionRun.findUniqueOrThrow({ where: { id: historicalRun.id } })).toEqual(historicalRun);
    expect(await moveEvents(schedule.id)).toHaveLength(0);
    await schedules.rescheduleNextOccurrence(admin, schedule.id, draft);
    const stored = await db.inspectionSchedule.findUniqueOrThrow({ where: { id: schedule.id } });
    expect(stored.nextDueAt).toEqual(target);
    await expectSingleMoveAudit(schedule, target, stored.updatedAt);
  });
});
