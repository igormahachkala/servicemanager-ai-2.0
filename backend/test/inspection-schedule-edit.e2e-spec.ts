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
});
