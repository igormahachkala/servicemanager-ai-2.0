import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  InspectionRunItemStatus,
  ServiceContractLocationMode,
  ServiceContractRole,
  ServiceContractStatus,
  UserRole,
} from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { TicketsService } from '../tickets/tickets.service';
import type { TimelineService } from '../timeline/timeline.service';
import type { InspectionExportService } from './inspection.export.service';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';
import { ListRunsDto } from './dto/list-runs.dto';
import { InspectionService } from './inspection.service';

const actor = { id: 'actor', companyId: 'provider', role: UserRole.TECHNICIAN };
function fixture(status: ServiceContractStatus = ServiceContractStatus.ACTIVE) {
  const contract = {
    id: 'contract',
    clientCompanyId: 'client',
    providerCompanyId: 'provider',
    role: ServiceContractRole.PRIMARY,
    status,
    locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
    locations: [{ locationId: 'allowed' }],
    startsAt: null,
    endsAt: null,
  };
  const contracts = new ServiceContractsService({
    serviceContract: {
      findUnique: jest.fn().mockResolvedValue(contract),
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as unknown as PrismaService);
  const runs = ['allowed', 'outside'].map((id) => ({
    id: `run-${id}`,
    scheduleId: `plan-${id}`,
    title: 'Historical snapshot',
    location: { id, clientCompanyId: 'client' },
    equipment: { id: 'equipment' },
    items: [
      { status: InspectionRunItemStatus.ISSUE, ticketId: 'hidden-ticket' },
    ],
  }));
  const prisma = {
    inspectionRun: { findMany: jest.fn().mockResolvedValue(runs) },
  };
  const tickets = { getOne: jest.fn(), create: jest.fn() };
  return {
    prisma,
    tickets,
    service: new InspectionService(
      prisma as unknown as PrismaService,
      tickets as unknown as TicketsService,
      {} as TimelineService,
      {} as InspectionExportService,
      contracts,
    ),
  };
}

describe('bounded linked service history', () => {
  it('ANDs equipment and location with actor tenant; selects only the schedule reference', async () => {
    const { service, prisma } = fixture();
    await service.listRuns(actor, {
      locationId: 'allowed',
      equipmentId: 'equipment',
      limit: 20,
    });
    expect(prisma.inspectionRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: 'provider',
          locationId: 'allowed',
          equipmentId: 'equipment',
        },
        take: 20,
        orderBy: [{ createdAt: 'desc' }],
        select: expect.objectContaining({
          scheduleId: true,
          items: { select: { status: true, ticketId: true } },
        }) as unknown,
      }),
    );
    expect(prisma.inspectionRun.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          schedule: expect.anything() as unknown,
        }) as unknown,
      }),
    );
  });
  it('equipment-only history retains canonical provider location restriction and no ticket details', async () => {
    const { service, tickets } = fixture();
    const rows = await service.listRuns(actor, {
      equipmentId: 'equipment',
      limit: 20,
    });
    expect(rows.map((row) => row.id)).toEqual(['run-allowed']);
    expect(rows[0].scheduleId).toBe('plan-allowed');
    expect(rows[0]).not.toHaveProperty('items');
    expect(rows[0]).not.toHaveProperty('tickets');
    expect(tickets.getOne).not.toHaveBeenCalled();
  });
  it('a revoked contract still removes all linked equipment records', async () => {
    const { service } = fixture(ServiceContractStatus.INACTIVE);
    await expect(
      service.listRuns(actor, { equipmentId: 'equipment' }),
    ).resolves.toEqual([]);
  });
  it('ignores an injected tenant override even without HTTP validation', async () => {
    const { service, prisma } = fixture();
    await service.listRuns(actor, {
      equipmentId: 'equipment',
      companyId: 'other-tenant',
    } as ListRunsDto);
    expect(prisma.inspectionRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'provider', equipmentId: 'equipment' },
      }),
    );
  });
  it.each([UserRole.CLIENT, UserRole.TERRITORIAL_MANAGER])(
    'does not grant round access to %s',
    async (role) => {
      const { service, prisma } = fixture();
      await expect(
        service.listRuns({ ...actor, role }, { equipmentId: 'equipment' }),
      ).rejects.toThrow();
      expect(prisma.inspectionRun.findMany).not.toHaveBeenCalled();
    },
  );
  it('validates the additive UUID filter and retains limit bounds', async () => {
    expect(
      await validate(
        plainToInstance(ListRunsDto, {
          equipmentId: '8954b38c-29ef-4d70-9f81-6d516319c490',
          limit: '20',
        }),
      ),
    ).toEqual([]);
    const errors = await validate(
      plainToInstance(ListRunsDto, { equipmentId: 'not-an-id', limit: 201 }),
    );
    expect(errors.map((error) => error.property).sort()).toEqual([
      'equipmentId',
      'limit',
    ]);
  });
});
