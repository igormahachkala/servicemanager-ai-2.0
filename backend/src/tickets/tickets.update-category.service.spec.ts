import { TicketStatus, TicketUrgency, UserRole } from '@prisma/client';

import type { AssignmentEngine } from '../assignment/assignment.engine';
import type { PrismaService } from '../prisma/prisma.service';
import type { ServiceContractsService } from '../service-contracts/service-contracts.service';
import type { TimelineService } from '../timeline/timeline.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { TechniciansService } from '../technicians/technicians.service';
import type { UpdateTicketDto } from './dto/update-ticket.dto';
import type { TicketAttachmentsService } from './ticket-attachments.service';
import type { TicketsQueryService } from './tickets.query.service';

type ResolveTicketOperationAccessFn =
  typeof import('./ticket-access.utils').resolveTicketOperationAccess;

const mockResolveTicketOperationAccess =
  jest.fn<ResolveTicketOperationAccessFn>();
type ResolveTicketOperationAccessResult = Awaited<
  ReturnType<ResolveTicketOperationAccessFn>
>;

jest.mock('./ticket-access.utils', () => {
  const actual = jest.requireActual<typeof import('./ticket-access.utils')>(
    './ticket-access.utils',
  );
  return {
    ...actual,
    resolveTicketOperationAccess: mockResolveTicketOperationAccess,
  };
});

import { TicketsAssignmentService } from './tickets.assignment.service';

describe('TicketsAssignmentService.update category minimal edit', () => {
  const providerCompanyId = 'provider-company';
  const clientCompanyId = 'client-company';
  const ticketId = 'ticket-1';
  const oldCategoryId = 'category-old';
  const newCategoryId = 'category-new';
  const assignedTechnicianId = 'tech-1';

  function makeUpdateHarness() {
    const existingTicket = {
      id: ticketId,
      companyId: clientCompanyId,
      locationId: 'location-1',
      equipmentId: null,
      problemCategoryId: oldCategoryId,
      problemText: 'Existing problem',
      urgency: TicketUrgency.NOT_URGENT,
      requesterName: null,
      requesterPhone: null,
      address: null,
      pointName: null,
      status: TicketStatus.ASSIGNED,
    };
    const tx = {
      ticket: {
        findFirst: jest.fn().mockResolvedValue(existingTicket),
        update: jest.fn().mockResolvedValue({
          ...existingTicket,
          problemCategoryId: newCategoryId,
          assignedTechnicianId,
        }),
      },
      problemCategory: {
        findFirst: jest.fn().mockResolvedValue({ id: newCategoryId }),
      },
      location: {
        findFirst: jest.fn(),
      },
      equipment: {
        findFirst: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (transaction: typeof tx) => Promise<string>) => callback(tx),
      ),
    };
    const assignmentEngine = {
      selectTechnicianForTicket: jest.fn(),
    };
    const query = {
      getOne: jest.fn().mockResolvedValue({
        id: ticketId,
        problemCategory: { id: newCategoryId, name: 'New category' },
        assignedTechnicianId,
      }),
    };
    const timeline = {
      recordLegacyTx: jest.fn().mockResolvedValue({ id: 'timeline-1' }),
    };
    const service = new TicketsAssignmentService(
      prisma as unknown as PrismaService,
      assignmentEngine as unknown as AssignmentEngine,
      query as unknown as TicketsQueryService,
      timeline as unknown as TimelineService,
      {} as TicketAttachmentsService,
      {} as ServiceContractsService,
      {} as TechniciansService,
      {} as NotificationsService,
    );
    mockResolveTicketOperationAccess.mockResolvedValue({
      ticket: { id: ticketId, companyId: clientCompanyId },
      scopeCompanyId: clientCompanyId,
      operationCompanyId: providerCompanyId,
      visibilityMode: 'provider_primary',
    } as ResolveTicketOperationAccessResult);

    return {
      service,
      prisma,
      tx,
      assignmentEngine,
      query,
      timeline,
    };
  }

  afterEach(() => {
    mockResolveTicketOperationAccess.mockReset();
  });

  it('changes category through update without changing assignment or invoking assignment engine', async () => {
    const { service, tx, assignmentEngine, query, timeline } =
      makeUpdateHarness();

    await expect(
      service.update(
        providerCompanyId,
        { id: 'master-1', role: UserRole.MASTER, companyId: providerCompanyId },
        ticketId,
        { problemCategoryId: newCategoryId } as UpdateTicketDto,
        clientCompanyId,
      ),
    ).resolves.toMatchObject({
      id: ticketId,
      problemCategory: { id: newCategoryId },
      assignedTechnicianId,
    });

    expect(mockResolveTicketOperationAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId,
        linkedClientCompanyId: clientCompanyId,
      }),
    );
    expect(tx.problemCategory.findFirst).toHaveBeenCalledWith({
      where: {
        id: newCategoryId,
        companyId: clientCompanyId,
        isActive: true,
      },
      select: { id: true },
    });
    expect(tx.ticket.update).toHaveBeenCalledWith({
      where: { id: ticketId },
      data: {
        problemCategory: { connect: { id: newCategoryId } },
      },
    });

    expect(assignmentEngine.selectTechnicianForTicket).not.toHaveBeenCalled();
    expect(timeline.recordLegacyTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: 'ticket.category_changed',
        payload: {
          previousProblemCategoryId: oldCategoryId,
          problemCategoryId: newCategoryId,
        },
      }),
    );
    expect(timeline.recordLegacyTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: 'ticket.updated',
        payload: {
          changedFields: ['problemCategoryId'],
          operationCompanyId: providerCompanyId,
        },
      }),
    );
    expect(query.getOne).toHaveBeenCalledWith(
      providerCompanyId,
      'master-1',
      UserRole.MASTER,
      ticketId,
      undefined,
      undefined,
      clientCompanyId,
    );
  });

  it('denies non-edit assignment role before update side effects', async () => {
    const { service, prisma, tx, timeline, assignmentEngine } =
      makeUpdateHarness();

    await expect(
      service.update(
        providerCompanyId,
        {
          id: 'tech-1',
          role: UserRole.TECHNICIAN,
          companyId: providerCompanyId,
        },
        ticketId,
        { problemCategoryId: newCategoryId } as UpdateTicketDto,
        clientCompanyId,
      ),
    ).rejects.toThrow('Role cannot assign tickets');

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.ticket.update).not.toHaveBeenCalled();
    expect(timeline.recordLegacyTx).not.toHaveBeenCalled();
    expect(assignmentEngine.selectTechnicianForTicket).not.toHaveBeenCalled();
  });
});
