import { ForbiddenException } from '@nestjs/common';
import {
  InspectionRunItemStatus,
  InspectionRunStatus,
  UserRole,
  type Prisma,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InspectionService } from './inspection.service';
import { ListRunsDto } from './dto/list-runs.dto';

const actor = {
  id: 'manager-1',
  companyId: 'provider-1',
  role: UserRole.MASTER,
};
const historical = {
  id: 'run-1',
  title: 'Историческое название',
  scheduleId: 'schedule-1',
  status: InspectionRunStatus.COMPLETED,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  completedAt: new Date('2026-10-20T12:00:00Z'),
  dueAt: new Date('2026-10-19T00:00:00Z'),
  overdueAt: new Date('2026-10-20T00:00:00Z'),
  location: {
    id: 'loc-1',
    clientCompanyId: 'client-1',
    name: 'Fixture location',
  },
  performedBy: {
    id: 'old-worker',
    firstName: 'Иван',
    lastName: null,
    email: 'fixture@example.test',
  },
  items: [
    {
      id: 'item-1',
      title: 'Проверить оборудование',
      status: InspectionRunItemStatus.ISSUE,
      ticketId: 'ticket-1',
      ticket: { status: 'DONE', problemText: 'SECRET' },
      attachments: ['SECRET'],
      comment: 'SECRET',
    },
    {
      id: 'item-2',
      title: 'Критический пункт',
      status: InspectionRunItemStatus.CRITICAL,
      ticketId: null,
    },
    {
      id: 'item-3',
      title: 'Норма',
      status: InspectionRunItemStatus.OK,
      ticketId: null,
    },
  ],
};
type QueryArgs = {
  where: Prisma.InspectionRunWhereInput;
  take: number;
  orderBy: unknown;
  select: Record<string, unknown> & {
    items: { select: Record<string, boolean> };
  };
};
type Dependencies = ConstructorParameters<typeof InspectionService>;

function suite(allowed = true) {
  const prisma = {
    inspectionRun: {
      findMany: jest
        .fn<Promise<Array<typeof historical>>, [QueryArgs]>()
        .mockResolvedValue([historical]),
    },
  };
  const getLinkedClientAccess = jest
    .fn()
    .mockResolvedValue(
      allowed
        ? { effectiveLocationScope: { mode: 'tenant_wide', locationIds: [] } }
        : null,
    );
  const service = new InspectionService(
    prisma as unknown as Dependencies[0],
    {} as Dependencies[1],
    {} as Dependencies[2],
    {} as Dependencies[3],
    { getLinkedClientAccess } as unknown as Dependencies[4],
  );
  return { prisma, service, getLinkedClientAccess };
}

describe('plan/fact additive run list contract', () => {
  it('queries completedAt independently of old createdAt, under the same tenant and worker filters', async () => {
    const { prisma, service } = suite();
    const [row] = await service.listRuns(actor, {
      status: InspectionRunStatus.COMPLETED,
      completedFrom: '2026-10-01T00:00:00Z',
      completedTo: '2026-10-31T23:59:59Z',
      locationId: 'loc-1',
      performedByUserId: 'old-worker',
      limit: 200,
    });
    const args = prisma.inspectionRun.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      companyId: 'provider-1',
      locationId: 'loc-1',
      performedByUserId: 'old-worker',
      status: 'COMPLETED',
      completedAt: {
        gte: new Date('2026-10-01T00:00:00Z'),
        lte: new Date('2026-10-31T23:59:59Z'),
      },
    });
    expect(args.where.createdAt).toBeUndefined();
    expect(args.take).toBe(200);
    expect(args.orderBy).toEqual([{ completedAt: 'desc' }, { id: 'desc' }]);
    expect(row.createdAt).toEqual(historical.createdAt);
    expect(row.performedBy?.id).toBe('old-worker');
    expect(row.dueAt).toEqual(historical.dueAt);
    expect(args.select.schedule).toBeUndefined();
    expect(args.select).toMatchObject({
      scheduleId: true,
      dueAt: true,
      overdueAt: true,
    });
  });
  it('keeps legacy createdAt filters and defaults unchanged', async () => {
    const { prisma, service } = suite();
    await service.listRuns(actor, { from: '2026-10-01T00:00:00Z' });
    const args = prisma.inspectionRun.findMany.mock.calls[0][0];
    expect(args.where.createdAt).toEqual({
      gte: new Date('2026-10-01T00:00:00Z'),
    });
    expect(args.where.completedAt).toBeUndefined();
    expect(args.orderBy).toEqual([{ createdAt: 'desc' }]);
    expect(args.take).toBe(50);
  });
  it('projects only defect snapshot and ticket references; no ticket metadata, notes or files', async () => {
    const { prisma, service } = suite();
    const [row] = await service.listRuns(actor);
    expect(row.findings).toEqual([
      {
        id: 'item-1',
        title: 'Проверить оборудование',
        status: 'ISSUE',
        ticketId: 'ticket-1',
      },
      {
        id: 'item-2',
        title: 'Критический пункт',
        status: 'CRITICAL',
        ticketId: null,
      },
    ]);
    expect(row).not.toHaveProperty('items');
    expect(JSON.stringify(row)).not.toContain('SECRET');
    expect(
      prisma.inspectionRun.findMany.mock.calls[0][0].select.items.select,
    ).toEqual({ id: true, title: true, status: true, ticketId: true });
  });
  it('uses the unchanged canonical location contract and drops inaccessible findings', async () => {
    const { service, getLinkedClientAccess } = suite(false);
    expect(
      await service.listRuns(actor, { completedFrom: '2026-10-01T00:00:00Z' }),
    ).toEqual([]);
    expect(getLinkedClientAccess).toHaveBeenCalledWith(
      'provider-1',
      'client-1',
    );
  });
  it('does not grant an inspection role to a client viewer', async () => {
    const { service, prisma } = suite();
    await expect(
      service.listRuns({ ...actor, role: UserRole.CLIENT }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.inspectionRun.findMany).not.toHaveBeenCalled();
  });
  it('validates new dates and retains the bounded limit', async () => {
    const valid = plainToInstance(ListRunsDto, {
      completedFrom: '2026-10-01T00:00:00Z',
      completedTo: '2026-10-31T23:59:59Z',
      limit: '200',
    });
    expect(await validate(valid)).toEqual([]);
    const invalid = await validate(
      plainToInstance(ListRunsDto, {
        completedFrom: 'bad',
        completedTo: 'also-bad',
        limit: '201',
      }),
    );
    expect(invalid.map((error) => error.property).sort()).toEqual([
      'completedFrom',
      'completedTo',
      'limit',
    ]);
  });
});
