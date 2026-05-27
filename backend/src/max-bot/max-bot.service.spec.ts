import { BadRequestException } from '@nestjs/common';

import { MaxBotService } from './max-bot.service';

describe('MaxBotService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('extracts chat ids from updates and stores the latest one', async () => {
    process.env.MAX_BOT_API_BASE_URL = 'https://platform-api.max.ru';
    process.env.MAX_BOT_API_TOKEN = 'test-token';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          updates: [
            { update_type: 'message_created', chat_id: 101, timestamp: 1 },
            { update_type: 'message_created', message: { chat_id: 202 }, timestamp: 2 },
          ],
          marker: 77,
        }),
    }) as any;

    const service = new MaxBotService();
    const result = await service.pollUpdates({ limit: 10, timeout: 0, types: ['message_created'] });

    expect(result.chatIds).toEqual([101, 202]);
    expect(result.lastChatId).toBe(202);
    expect(result.savedChatId).toBe(202);
    expect(result.savedMarker).toBe(77);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://platform-api.max.ru/updates?limit=10&timeout=0&types=message_created',
      expect.objectContaining({
        headers: expect.anything(),
      }),
    );
  });

  it('sends a test message using the saved chat id', async () => {
    process.env.MAX_BOT_API_BASE_URL = 'https://platform-api.max.ru';
    process.env.MAX_BOT_API_TOKEN = 'test-token';
    process.env.FRONTEND_URL = 'http://194.67.101.37:4173/';

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            updates: [{ update_type: 'message_created', chat_id: 555, timestamp: 1 }],
            marker: 10,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ message: { message_id: 'abc', chat_id: 555 } }),
      }) as any;

    const service = new MaxBotService();
    await service.pollUpdates({});
    const result = await service.sendTestMessage({});

    expect(result.chatId).toBe(555);
    expect(result.frontendUrl).toBe('http://194.67.101.37:4173');
    expect(result.text).toContain('http://194.67.101.37:4173');
    expect(result.message).toEqual({ message_id: 'abc', chat_id: 555 });
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://platform-api.max.ru/messages?chat_id=555',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('rejects sending a message without a chat id or cached update', async () => {
    process.env.MAX_BOT_API_BASE_URL = 'https://platform-api.max.ru';
    process.env.MAX_BOT_API_TOKEN = 'test-token';
    global.fetch = jest.fn() as any;

    const service = new MaxBotService();

    await expect(service.sendTestMessage({})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses ticket-specific frontend links when ticketId is provided', async () => {
    process.env.MAX_BOT_API_BASE_URL = 'https://platform-api.max.ru';
    process.env.MAX_BOT_API_TOKEN = 'test-token';
    process.env.MAX_PUBLIC_FRONTEND_URL = 'http://194.67.101.37:4174/';

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            updates: [{ update_type: 'message_created', chat_id: 555, timestamp: 1 }],
            marker: 10,
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ message: { message_id: 'abc', chat_id: 555 } }),
      }) as any;

    const service = new MaxBotService();
    await service.pollUpdates({});
    const result = await service.sendTestMessage({ ticketId: 'ticket-123' });

    expect(result.frontendUrl).toBe('http://194.67.101.37:4174/m/tickets/ticket-123');
    expect(result.text).toContain('http://194.67.101.37:4174/m/tickets/ticket-123');
  });

  it('builds operational MAX messages against the configured frontend url and group chat', async () => {
    process.env.MAX_BOT_API_BASE_URL = 'https://platform-api.max.ru';
    process.env.MAX_BOT_API_TOKEN = 'test-token';
    process.env.MAX_GROUP_CHAT_ID = '-75137613795359';
    process.env.MAX_PUBLIC_FRONTEND_URL = '';
    process.env.FRONTEND_URL = 'http://194.67.101.37:4173/';

    const sendResponses = [
      { message: { message_id: 'm1' } },
      { message: { message_id: 'm2' } },
      { message: { message_id: 'm3' } },
    ];

    global.fetch = jest
      .fn()
      .mockImplementation(async (url: string, init?: RequestInit) => {
        if (String(url).includes('/messages?chat_id=-75137613795359')) {
          const payload = sendResponses.shift() || { message: { message_id: 'mX' } };
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify(payload),
          } as any;
        }
        throw new Error(`Unexpected fetch: ${url} ${JSON.stringify(init)}`);
      }) as any;

    const service = new MaxBotService();
    await service.sendTicketCreatedMessage({
      companyId: 'company-1',
      locationId: 'location-1',
      ticketId: 'ticket-123',
      ticketNumber: 123,
      requesterLabel: 'Иван Петров',
      requesterPhone: '+7 999 123-45-67',
      description: '  Не работает вывеска\n\nТребуется проверить  ',
      pointName: 'Уфа 1',
      address: 'ул. Ленина, 1',
      categoryName: 'Электрика',
      urgency: 'URGENT',
    });
    await service.sendTicketAssignedMessage({
      companyId: 'company-1',
      locationId: 'location-1',
      ticketId: 'ticket-123',
      ticketNumber: 123,
      technicianLabel: 'Иван Иванов / ivan@test.local',
    });
    await service.sendTicketStatusChangedMessage({
      companyId: 'company-1',
      locationId: 'location-1',
      ticketId: 'ticket-123',
      ticketNumber: 123,
      fromStatus: 'NEW' as any,
      toStatus: 'IN_PROGRESS' as any,
    });

    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[0][0]).toBe('https://platform-api.max.ru/messages?chat_id=-75137613795359');
    expect(JSON.parse(calls[0][1].body)).toMatchObject({
      text: expect.stringContaining('Отправитель: Иван Петров'),
    });
    expect(JSON.parse(calls[0][1].body)).toMatchObject({
      text: expect.stringContaining('Телефон: +7 999 123-45-67'),
    });
    expect(JSON.parse(calls[0][1].body)).toMatchObject({
      text: expect.stringContaining('Комментарий:\n"Не работает вывеска\n\nТребуется проверить"'),
    });
    expect(JSON.parse(calls[0][1].body)).toMatchObject({
      text: expect.stringContaining('Открыть:\nhttp://194.67.101.37:4173/m/tickets/ticket-123'),
    });
    expect(JSON.parse(calls[1][1].body)).toMatchObject({
      text: expect.stringContaining('Исполнитель: Иван Иванов / ivan@test.local'),
    });
    expect(JSON.parse(calls[2][1].body)).toMatchObject({
      text: expect.stringContaining('Статус: Новая → В работе'),
    });
  });

  it('creates one MAX anchor per location and replies to it', async () => {
    process.env.MAX_BOT_API_BASE_URL = 'https://platform-api.max.ru';
    process.env.MAX_BOT_API_TOKEN = 'test-token';
    process.env.MAX_GROUP_CHAT_ID = '-75137613795359';
    process.env.FRONTEND_URL = 'https://servicemanagerai.ru';

    const threadState: any = { value: null };
    const prisma = {
      location: {
        findFirst: jest.fn().mockResolvedValue({ name: 'Кофейня U' }),
      },
      maxLocationThread: {
        findUnique: jest.fn(async () => threadState.value),
        create: jest.fn(async ({ data }: any) => {
          threadState.value = {
            id: 'thread-1',
            ...data,
            anchorMessageCreatedAt: data.anchorMessageCreatedAt || null,
          };
          return threadState.value;
        }),
        update: jest.fn(async ({ data }: any) => {
          threadState.value = {
            ...threadState.value,
            ...data,
          };
          return threadState.value;
        }),
      },
    };

    const fetchMock = jest.fn().mockImplementation(async () => {
      const payload = sendResponses.shift() || { message: { mid: 1239 } };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(payload),
      } as any;
    });
    const sendResponses = [
      { message: { mid: 1234 } },
      { message: { mid: 1235 } },
      { message: { mid: 1236 } },
      { message: { mid: 1237 } },
    ];
    global.fetch = fetchMock as any;

    const service = new MaxBotService(prisma as any);
    await service.sendTicketCreatedMessage({
      companyId: 'company-1',
      locationId: 'location-1',
      ticketId: 'ticket-1',
      ticketNumber: 1,
      requesterLabel: 'Сергей Тестов',
      requesterPhone: '+7 999 888-77-66',
      description: 'Проблема',
      pointName: 'Кофейня U',
      categoryName: 'Электрика',
      urgency: 'URGENT',
    });
    await service.sendTicketAssignedMessage({
      companyId: 'company-1',
      locationId: 'location-1',
      ticketId: 'ticket-1',
      ticketNumber: 1,
      technicianLabel: 'Иван Иванов',
    });
    await service.sendTicketCreatedMessage({
      companyId: 'company-1',
      locationId: 'location-1',
      ticketId: 'ticket-2',
      ticketNumber: 2,
      requesterLabel: 'Сергей Тестов',
      requesterPhone: '+7 999 888-77-66',
      description: 'Вторая проблема',
      pointName: 'Кофейня U',
      categoryName: 'Электрика',
      urgency: 'URGENT',
    });

    expect(prisma.maxLocationThread.create).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://platform-api.max.ru/messages?chat_id=-75137613795359',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: '🏪 Кофейня U' }),
      }),
    );
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)).toMatchObject({
      reply_to_message_id: '1234',
      reply_to_mid: 1234,
    });
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[2][1].body)).toMatchObject({
      reply_to_message_id: '1234',
      reply_to_mid: 1234,
    });
  });

  it('falls back to normal MAX send if threaded reply fails', async () => {
    process.env.MAX_BOT_API_BASE_URL = 'https://platform-api.max.ru';
    process.env.MAX_BOT_API_TOKEN = 'test-token';
    process.env.MAX_GROUP_CHAT_ID = '-75137613795359';
    process.env.FRONTEND_URL = 'https://servicemanagerai.ru';

    const prisma = {
      location: {
        findFirst: jest.fn().mockResolvedValue({ name: 'Кофейня U' }),
      },
      maxLocationThread: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'thread-1',
          companyId: 'company-1',
          locationId: 'location-1',
          chatId: BigInt(-75137613795359),
          anchorMessageId: '1234',
          anchorMessageCreatedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        update: jest.fn(),
      },
    };

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ message: { mid: 1234 } }),
      })
      .mockRejectedValueOnce(new Error('reply failed'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ message: { mid: 1236 } }),
      }) as any;

    const service = new MaxBotService(prisma as any);
    await service.sendTicketCreatedMessage({
      companyId: 'company-1',
      locationId: 'location-1',
      ticketId: 'ticket-1',
      ticketNumber: 1,
      requesterLabel: 'Сергей Тестов',
      requesterPhone: '+7 999 888-77-66',
      description: 'Проблема',
      pointName: 'Кофейня U',
      categoryName: 'Электрика',
      urgency: 'URGENT',
    });

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[2][1].body)).toMatchObject({
      text: expect.stringContaining('🆕 Новая заявка'),
    });
  });
});
