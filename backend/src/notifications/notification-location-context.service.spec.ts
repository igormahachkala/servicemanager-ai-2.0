import { CompanyType, TicketStatus, UserRole } from '@prisma/client';

import * as ticketAccess from '../tickets/ticket-access.utils';
import { NotificationsService } from './notifications.service';

/**
 * Контекст локации в тексте уведомления. Проверяется на канонических точках
 * записи (createNotification / createNotifications), на push и на MAX —
 * отдельного форматирования на канал быть не должно.
 */
describe('NotificationsService location context', () => {
  const ticketCompanyId = 'client-company';
  const ticketId = 'ticket-1';
  const ticketLocationId = 'location-1';

  function makeService(location: { name: string | null; city: string | null } | null) {
    jest.spyOn(ticketAccess, 'resolveReadableTicketAccess').mockImplementation(
      async (params: any) =>
        ({
          ticket: {
            id: params.ticketId,
            companyId: ticketCompanyId,
            assignedTechnicianId: null,
          },
          scopeCompanyId: ticketCompanyId,
          visibilityMode: 'tenant',
        }) as any,
    );

    const users = [
      { id: 'user-a', companyId: ticketCompanyId, role: UserRole.ADMIN },
      { id: 'user-b', companyId: ticketCompanyId, role: UserRole.DISPATCHER },
    ];

    const prisma = {
      company: {
        findMany: jest.fn().mockResolvedValue([{ id: ticketCompanyId, type: CompanyType.CLIENT }]),
        findUnique: jest.fn().mockResolvedValue({ type: CompanyType.CLIENT }),
        findFirst: jest.fn().mockResolvedValue({ phone: '+70000000000' }),
      },
      serviceContract: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue(users),
        findFirst: jest
          .fn()
          .mockImplementation(
            async (query: any) => users.find((user) => user.id === query?.where?.id) ?? null,
          ),
      },
      ticket: {
        // Резолвер контекста локации — единственный потребитель findUnique с select.location.
        findUnique: jest.fn().mockResolvedValue(location ? { location } : { location: null }),
        findFirst: jest.fn().mockResolvedValue({
          id: ticketId,
          companyId: ticketCompanyId,
          locationId: ticketLocationId,
          assignedTechnicianId: null,
          problemCategory: { specializationLinks: [] },
        }),
      },
      notification: {
        createMany: jest.fn().mockImplementation(async ({ data }: any) => ({
          count: data.length,
        })),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'notification-1',
          ...data,
        })),
      },
    };
    const push = { sendToUser: jest.fn().mockResolvedValue({}) };
    const maxBot = {
      sendTicketCreatedMessage: jest.fn().mockResolvedValue({}),
      sendTicketAssignedMessage: jest.fn().mockResolvedValue({}),
      sendTicketClaimedMessage: jest.fn().mockResolvedValue({}),
      sendTicketStatusChangedMessage: jest.fn().mockResolvedValue({}),
    };
    const contractContext = {
      getContractContext: jest.fn().mockResolvedValue(null),
    };

    const service = new NotificationsService(
      prisma as any,
      maxBot as any,
      push as any,
      {} as any,
      contractContext as any,
    );
    return { service, prisma, push, maxBot };
  }

  async function emitCreated(service: NotificationsService) {
    await (service as any).emitTicketCreatedWatchers({
      actorCompanyId: ticketCompanyId,
      creatorUserId: null,
      targetCompanyId: ticketCompanyId,
      locationId: ticketLocationId,
      ticketId,
      ticketNumber: 1001,
      summary: 'Не работает касса',
    });
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('новая заявка: город и точка идут первой строкой в in-app и в push', async () => {
    const { service, prisma, push } = makeService({
      city: 'Уфа',
      name: 'Фудзияма, Проспект Октября',
    });

    await emitCreated(service);

    const rows = prisma.notification.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.message).toBe('Уфа · Фудзияма, Проспект Октября\nЗаявка #1001 — Не работает касса');
    }
    expect(push.sendToUser).toHaveBeenCalledTimes(2);
    for (const call of push.sendToUser.mock.calls) {
      expect(call[1].body).toBe('Уфа · Фудзияма, Проспект Октября\nЗаявка #1001 — Не работает касса');
    }
  });

  it('город отсутствует: остаётся имя точки', async () => {
    const { service, prisma, push } = makeService({
      city: null,
      name: 'Фудзияма',
    });

    await emitCreated(service);

    expect(prisma.notification.createMany.mock.calls[0][0].data[0].message).toBe(
      'Фудзияма\nЗаявка #1001 — Не работает касса',
    );
    expect(push.sendToUser.mock.calls[0][1].body).toBe('Фудзияма\nЗаявка #1001 — Не работает касса');
  });

  it('точка отсутствует: остаётся город', async () => {
    const { service, prisma } = makeService({ city: 'Уфа', name: null });

    await emitCreated(service);

    expect(prisma.notification.createMany.mock.calls[0][0].data[0].message).toBe(
      'Уфа\nЗаявка #1001 — Не работает касса',
    );
  });

  it('локации нет вовсе: текст уведомления сохраняется как был', async () => {
    const { service, prisma, push } = makeService(null);

    await emitCreated(service);

    expect(prisma.notification.createMany.mock.calls[0][0].data[0].message).toBe(
      'Заявка #1001 — Не работает касса',
    );
    expect(push.sendToUser.mock.calls[0][1].body).toBe('Заявка #1001 — Не работает касса');
  });

  it('смена статуса: контекст есть и в записи, и в push', async () => {
    const { service, prisma, push } = makeService({
      city: 'Уфа',
      name: 'Фудзияма',
    });

    await (service as any).emitTicketStatusChangedForAssignee({
      assigneeUserId: 'user-a',
      actorUserId: 'user-b',
      ticketId,
      ticketCompanyId,
      ticketNumber: 1001,
      summary: 'Не работает касса',
      fromStatus: TicketStatus.NEW,
      toStatus: TicketStatus.IN_PROGRESS,
      linkedClientCompanyId: null,
    });

    const row = prisma.notification.create.mock.calls[0][0].data;
    expect(row.message.startsWith('Уфа · Фудзияма\n')).toBe(true);
    expect(push.sendToUser.mock.calls[0][1].body.startsWith('Уфа · Фудзияма\n')).toBe(true);
  });

  it('комментарий: контекст есть и на пачке наблюдателей, и на одиночной записи исполнителю', async () => {
    const { service, prisma } = makeService({ city: 'Уфа', name: 'Фудзияма' });

    await (service as any).emitTicketCommentAddedInternal({
      ticketCompanyId,
      ticketId,
      ticketNumber: 1001,
      summary: 'Приеду завтра',
      actorUserId: null,
      assigneeUserId: 'user-a',
      assigneeCompanyId: ticketCompanyId,
    });

    expect(prisma.notification.createMany.mock.calls[0][0].data[0].message).toBe(
      'Уфа · Фудзияма\nЗаявка #1001 — Приеду завтра',
    );
    expect(prisma.notification.create.mock.calls[0][0].data.message).toBe(
      'Уфа · Фудзияма\nЗаявка #1001 — Приеду завтра',
    );
  });

  it('deep link не меняется: navigationTarget тот же, что и без контекста', async () => {
    const { service, prisma, push } = makeService({
      city: 'Уфа',
      name: 'Фудзияма',
    });

    await emitCreated(service);

    const row = prisma.notification.createMany.mock.calls[0][0].data[0];
    expect(row.entityType).toBe('Ticket');
    expect(row.entityId).toBe(ticketId);
    expect(row.navigationTarget).toEqual({
      kind: 'ticket',
      ticketId,
      section: 'overview',
    });
    expect(push.sendToUser.mock.calls[0][1].navigate).toBe(`/m/tickets/${ticketId}`);
    expect(push.sendToUser.mock.calls[0][1].url).toBe(`/m/tickets/${ticketId}`);
    expect(push.sendToUser.mock.calls[0][1].navigationTarget).toEqual({
      kind: 'ticket',
      ticketId,
      section: 'overview',
    });
  });

  it('веер получателей одного события стоит одного запроса локации', async () => {
    const { service, prisma } = makeService({ city: 'Уфа', name: 'Фудзияма' });

    await emitCreated(service);

    const locationCalls = prisma.ticket.findUnique.mock.calls.filter(
      (call: any[]) => call[0]?.select?.location,
    );
    expect(locationCalls).toHaveLength(1);
  });

  it('MAX получает ту же строку контекста, своего формата не строит', async () => {
    const { service, maxBot } = makeService({ city: 'Уфа', name: 'Фудзияма' });

    await (service as any).sendMaxTicketStatusChanged({
      companyId: ticketCompanyId,
      locationId: ticketLocationId,
      locationName: 'Фудзияма',
      ticketId,
      ticketNumber: 1001,
      fromStatus: TicketStatus.NEW,
      toStatus: TicketStatus.IN_PROGRESS,
    });

    expect(maxBot.sendTicketStatusChangedMessage).toHaveBeenCalledWith(
      expect.objectContaining({ locationContext: 'Уфа · Фудзияма' }),
    );
  });

  it('получатели и роли контекстом не затрагиваются', async () => {
    const { service, prisma } = makeService({ city: 'Уфа', name: 'Фудзияма' });

    await emitCreated(service);

    const rows = prisma.notification.createMany.mock.calls[0][0].data;
    expect(rows.map((row: any) => row.userId).sort()).toEqual(['user-a', 'user-b']);
    expect(rows.every((row: any) => row.type === 'ticket.created')).toBe(true);
    expect(rows.every((row: any) => row.linkedClientCompanyId === null)).toBe(true);
  });
});
