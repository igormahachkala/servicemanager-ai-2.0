import { CompanyType, ServiceContractRole, TicketStatus, UserRole } from '@prisma/client';

import * as ticketAccess from '../tickets/ticket-access.utils';
import { NotificationsService } from './notifications.service';

describe('NotificationsService access resolver delivery gate', () => {
  const ticketCompanyId = 'client-company';
  const providerCompanyId = 'provider-company';
  const ticketId = 'ticket-1';

  let resolveReadableSpy: jest.SpyInstance;

  function candidate(id: string, companyId = ticketCompanyId, role = UserRole.ADMIN) {
    return { id, companyId, role };
  }

  function makeService(options?: {
    allowedUserIds?: string[];
    usersByCompany?: Record<string, Array<{ id: string; companyId: string; role: UserRole }>>;
    allUsers?: Array<{ id: string; companyId: string; role: UserRole }>;
  }) {
    const allowedUserIds = new Set(options?.allowedUserIds ?? []);
    resolveReadableSpy = jest
      .spyOn(ticketAccess, 'resolveReadableTicketAccess')
      .mockImplementation(async (params: any) => {
        if (!allowedUserIds.has(params.actor.id)) {
          throw new Error('denied');
        }
        return {
          ticket: { id: params.ticketId, companyId: ticketCompanyId, assignedTechnicianId: null },
          scopeCompanyId: ticketCompanyId,
          visibilityMode: params.linkedClientCompanyId ? 'provider_primary' : 'tenant',
        };
      });

    const usersByCompany = options?.usersByCompany ?? {};
    const allUsers = options?.allUsers ?? Object.values(usersByCompany).flat();
    const prisma = {
      company: {
        findMany: jest.fn().mockResolvedValue([
          { id: ticketCompanyId, type: CompanyType.CLIENT },
          { id: providerCompanyId, type: CompanyType.PROVIDER },
        ]),
        findUnique: jest.fn().mockResolvedValue({ type: CompanyType.CLIENT }),
      },
      serviceContract: {
        findFirst: jest.fn().mockResolvedValue({
          providerCompanyId,
          role: ServiceContractRole.PRIMARY,
        }),
        findMany: jest.fn().mockResolvedValue([{ providerCompanyId }]),
      },
      user: {
        findMany: jest.fn().mockImplementation(async (query: any) => {
          const where = query?.where ?? {};
          if (typeof where.companyId === 'string') {
            return usersByCompany[where.companyId] ?? [];
          }
          if (where.companyId?.in) {
            return allUsers.filter((user) => where.companyId.in.includes(user.companyId));
          }
          if (Array.isArray(where.OR)) {
            const companyIds = new Set<string>();
            const userIds = new Set<string>();
            for (const clause of where.OR) {
              for (const companyId of clause.companyId?.in ?? []) companyIds.add(companyId);
              for (const userId of clause.id?.in ?? []) userIds.add(userId);
            }
            return allUsers.filter((user) => companyIds.has(user.companyId) || userIds.has(user.id));
          }
          return allUsers;
        }),
        findFirst: jest.fn().mockImplementation(async (query: any) => {
          const id = query?.where?.id;
          return allUsers.find((user) => user.id === id) ?? null;
        }),
      },
      ticket: {
        findUnique: jest.fn().mockResolvedValue({ assignedTechnicianId: null }),
      },
      notification: {
        createMany: jest.fn().mockImplementation(async ({ data }: any) => ({ count: data.length })),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'notification-1', ...data })),
      },
    };
    const push = { sendToUser: jest.fn().mockResolvedValue({}) };
    const service = new NotificationsService(
      prisma as any,
      {} as any,
      push as any,
      {} as any,
    );
    return { service, prisma, push };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ticket created recipients are filtered through resolveReadableTicketAccess', async () => {
    const { service, prisma } = makeService({
      allowedUserIds: ['allowed-client', 'allowed-provider'],
      usersByCompany: {
        [ticketCompanyId]: [
          candidate('allowed-client'),
          candidate('denied-client'),
        ],
        [providerCompanyId]: [
          candidate('allowed-provider', providerCompanyId, UserRole.DISPATCHER),
          candidate('denied-provider', providerCompanyId, UserRole.DISPATCHER),
        ],
      },
    });

    await (service as any).emitTicketCreatedWatchers({
      actorCompanyId: providerCompanyId,
      creatorUserId: null,
      targetCompanyId: ticketCompanyId,
      locationId: 'location-1',
      ticketId,
      ticketNumber: 1001,
      summary: 'Test ticket',
    });

    const data = prisma.notification.createMany.mock.calls[0][0].data;
    expect(data.map((item: any) => item.userId).sort()).toEqual([
      'allowed-client',
      'allowed-provider',
    ]);
    expect(data.find((item: any) => item.userId === 'allowed-provider').linkedClientCompanyId)
      .toBe(ticketCompanyId);
    expect(data.find((item: any) => item.userId === 'allowed-client').linkedClientCompanyId)
      .toBeNull();
    expect(resolveReadableSpy).toHaveBeenCalledWith(expect.objectContaining({
      actor: expect.objectContaining({ id: 'denied-client' }),
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    }));
  });

  it('recipient access checks are bounded without changing the allowed recipient set', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const allowedUserIds = new Set(
      Array.from({ length: 12 }, (_, index) => `user-${index}`).filter((_, index) => index % 3 !== 1),
    );

    resolveReadableSpy = jest
      .spyOn(ticketAccess, 'resolveReadableTicketAccess')
      .mockImplementation(async (params: any) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
        if (!allowedUserIds.has(params.actor.id)) {
          throw new Error('denied');
        }
        return {
          ticket: { id: params.ticketId, companyId: ticketCompanyId, assignedTechnicianId: null },
          scopeCompanyId: ticketCompanyId,
          visibilityMode: params.linkedClientCompanyId ? 'provider_primary' : 'tenant',
        };
      });

    const users = Array.from({ length: 12 }, (_, index) =>
      candidate(`user-${index}`, index % 2 ? providerCompanyId : ticketCompanyId, UserRole.ADMIN),
    );
    const service = new NotificationsService({} as any, {} as any, {} as any, {} as any);

    const result = await (service as any).filterRecipientsByTicketAccess({
      users,
      ticketId,
      ticketCompanyId,
    });

    expect(result.map((item: any) => item.id)).toEqual([
      'user-0',
      'user-2',
      'user-3',
      'user-5',
      'user-6',
      'user-8',
      'user-9',
      'user-11',
    ]);
    expect(resolveReadableSpy).toHaveBeenCalledTimes(users.length);
    expect(maxInFlight).toBeLessThanOrEqual(8);
  });

  it('deduplicates candidates before bounded access checks and keeps first-seen order', async () => {
    const { service } = makeService({
      allowedUserIds: ['same-user', 'second-user'],
    });
    const result = await (service as any).filterRecipientsByTicketAccess({
      users: [
        candidate('same-user'),
        candidate('same-user'),
        candidate('denied-user'),
        candidate('second-user', providerCompanyId, UserRole.DISPATCHER),
      ],
      ticketId,
      ticketCompanyId,
    });

    expect(result.map((item: any) => item.id)).toEqual(['same-user', 'second-user']);
    expect(resolveReadableSpy).toHaveBeenCalledTimes(3);
  });

  it('assignment request recipients do not bypass ticket access', async () => {
    const { service, prisma } = makeService({
      allowedUserIds: ['dispatcher-allowed'],
      usersByCompany: {
        [providerCompanyId]: [
          candidate('dispatcher-allowed', providerCompanyId, UserRole.DISPATCHER),
          candidate('dispatcher-denied', providerCompanyId, UserRole.DISPATCHER),
          candidate('tech-1', providerCompanyId, UserRole.TECHNICIAN),
        ],
      },
    });

    const result = await service.notifyTicketAssignmentRequested({
      providerCompanyId,
      technicianUserId: 'tech-1',
      ticketId,
      ticketNumber: 1001,
      ticketCompanyId,
    });

    expect(result).toEqual({ ok: true, notified: 1 });
    const data = prisma.notification.createMany.mock.calls[0][0].data;
    expect(data.map((item: any) => item.userId)).toEqual(['dispatcher-allowed']);
    expect(data[0].linkedClientCompanyId).toBe(ticketCompanyId);
  });

  it('comment notifications gate both watchers and assignee through ticket access', async () => {
    const { service, prisma, push } = makeService({
      allowedUserIds: ['watcher-allowed', 'assignee-allowed'],
      usersByCompany: {
        [ticketCompanyId]: [
          candidate('watcher-allowed'),
          candidate('watcher-denied'),
        ],
        [providerCompanyId]: [
          candidate('assignee-allowed', providerCompanyId, UserRole.TECHNICIAN),
        ],
      },
      allUsers: [
        candidate('watcher-allowed'),
        candidate('watcher-denied'),
        candidate('assignee-allowed', providerCompanyId, UserRole.TECHNICIAN),
      ],
    });

    await (service as any).emitTicketCommentAddedInternal({
      ticketCompanyId,
      ticketId,
      ticketNumber: 1001,
      summary: 'Comment',
      actorUserId: 'actor-1',
      assigneeUserId: 'assignee-allowed',
      assigneeCompanyId: providerCompanyId,
    });

    const watcherData = prisma.notification.createMany.mock.calls[0][0].data;
    expect(watcherData.map((item: any) => item.userId)).toEqual(['watcher-allowed']);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'assignee-allowed',
          linkedClientCompanyId: ticketCompanyId,
        }),
      }),
    );
    expect(push.sendToUser).toHaveBeenCalledWith(
      'assignee-allowed',
      expect.objectContaining({ linkedClientCompanyId: ticketCompanyId }),
      'chat',
      ticketId,
    );
  });

  it('status change client-company notifications use the access resolver gate', async () => {
    const { service, prisma } = makeService({
      allowedUserIds: ['status-allowed'],
      usersByCompany: {
        [ticketCompanyId]: [
          candidate('status-allowed'),
          candidate('status-denied'),
        ],
      },
    });

    await (service as any).emitTicketStatusForClientCompanyInternal({
      ticketCompanyId,
      actorUserId: null,
      ticketId,
      ticketNumber: 1001,
      summary: 'Status',
      fromStatus: TicketStatus.NEW,
      toStatus: TicketStatus.IN_PROGRESS,
    });

    const data = prisma.notification.createMany.mock.calls[0][0].data;
    expect(data.map((item: any) => item.userId)).toEqual(['status-allowed']);
    expect(data[0].type).toBe('ticket.in_progress');
  });

  it('acceptance-required notifications use the access resolver gate', async () => {
    const { service, prisma } = makeService({
      allowedUserIds: ['acceptance-allowed'],
      usersByCompany: {
        [ticketCompanyId]: [
          candidate('acceptance-allowed'),
          candidate('acceptance-denied'),
        ],
      },
    });

    await (service as any).emitTicketAwaitingAcceptanceInternal({
      ticketCompanyId,
      actorUserId: null,
      ticketId,
      ticketNumber: 1001,
    });

    const data = prisma.notification.createMany.mock.calls[0][0].data;
    expect(data.map((item: any) => item.userId)).toEqual(['acceptance-allowed']);
    expect(data[0].type).toBe('ticket.awaiting_acceptance');
  });

  it('SLA delivery uses accessible users only across client and provider contours', async () => {
    const { service, prisma } = makeService({
      allowedUserIds: ['client-admin', 'provider-master'],
      allUsers: [
        candidate('client-admin'),
        candidate('client-denied'),
        candidate('provider-master', providerCompanyId, UserRole.MASTER),
        candidate('provider-denied', providerCompanyId, UserRole.MASTER),
      ],
    });

    await (service as any).emitTicketSlaInternal({
      ticketCompanyId,
      ticketId,
      ticketNumber: 1001,
      notificationType: 'ticket.sla_warning',
      title: 'Заявка близка к сроку',
      body: 'SLA',
      dedupeKind: 'ticket.sla_warning',
    });

    const data = prisma.notification.createMany.mock.calls[0][0].data;
    expect(data.map((item: any) => item.userId).sort()).toEqual([
      'client-admin',
      'provider-master',
    ]);
    expect(data.find((item: any) => item.userId === 'provider-master').linkedClientCompanyId)
      .toBe(ticketCompanyId);
  });
});
