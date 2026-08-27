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
      'https://platform-api2.max.ru/updates?limit=10&timeout=0&types=message_created',
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
    expect(result.text).toContain('Сервис Менеджер MAX bot test');
    expect(result.attachments?.[0]?.payload.buttons[0]?.[0]).toMatchObject({
      type: 'open_app',
      text: 'Открыть ServiceManager',
      web_app: 'id056001679003_bot',
      payload: 'app',
    });
    expect(result.message).toEqual({ message_id: 'abc', chat_id: 555 });
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://platform-api2.max.ru/messages?chat_id=555',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)).toMatchObject({
      attachments: expect.any(Array),
    });
  });

  it('rejects sending a message without a chat id or cached update', async () => {
    process.env.MAX_BOT_API_BASE_URL = 'https://platform-api.max.ru';
    process.env.MAX_BOT_API_TOKEN = 'test-token';
    global.fetch = jest.fn() as any;

    const service = new MaxBotService();

    await expect(service.sendTestMessage({})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('logs status, statusText, path and body on non-2xx — without leaking the token', async () => {
    process.env.MAX_BOT_API_BASE_URL = 'https://platform-api.max.ru';
    process.env.MAX_BOT_API_TOKEN = 'secret-token-do-not-log';

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'verify.token: "Invalid access_token"',
    }) as any;

    const service = new MaxBotService();
    const loggerWarnSpy = jest.spyOn((service as any).logger, 'warn');

    await expect(service.pollUpdates({})).rejects.toBeInstanceOf(BadRequestException);

    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        statusText: 'Unauthorized',
        path: expect.stringContaining('/updates'),
        body: expect.stringContaining('Invalid access_token'),
      }),
      'max_api_request_failed',
    );

    const [loggedObj] = loggerWarnSpy.mock.calls[0];
    expect(JSON.stringify(loggedObj)).not.toContain('secret-token-do-not-log');
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
    expect(result.text).not.toContain('http://194.67.101.37:4174/m/tickets/ticket-123');
    expect(result.attachments?.[0]?.payload.buttons[0]?.[0]).toMatchObject({
      type: 'open_app',
      text: 'Открыть заявку',
      web_app: 'id056001679003_bot',
      payload: 'ticket_ticket-123',
    });
  });

  it('reports health ok when MAX token validation succeeds', async () => {
    process.env.MAX_BOT_API_BASE_URL = 'https://platform-api.max.ru';
    process.env.MAX_BOT_API_TOKEN = 'test-token';
    process.env.MAX_BOT_COMMANDS_ENABLED = 'true';
    process.env.MAX_BOT_WEBHOOK_ENABLED = 'false';
    process.env.MAX_GROUP_CHAT_ID = '-75137613795359';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => '[]',
    }) as any;

    const service = new MaxBotService();
    const health = await service.getHealthDiagnostics();

    expect(health.status).toBe('ok');
    expect(health.tokenValidation.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://platform-api2.max.ru/subscriptions?limit=1',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'test-token',
        }),
      }),
    );
  });

  it('reports health degraded when MAX token validation fails', async () => {
    process.env.MAX_BOT_API_BASE_URL = 'https://platform-api.max.ru';
    process.env.MAX_BOT_API_TOKEN = 'test-token';
    process.env.MAX_BOT_COMMANDS_ENABLED = 'true';
    process.env.MAX_BOT_WEBHOOK_ENABLED = 'false';
    process.env.MAX_GROUP_CHAT_ID = '-75137613795359';

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => '{"code":"verify.token","message":"Invalid access_token"}',
    }) as any;

    const service = new MaxBotService();
    const health = await service.getHealthDiagnostics();

    expect(health.status).toBe('degraded');
    expect(health.tokenValidation.ok).toBe(false);
    expect(health.tokenValidation.status).toBe(401);
    expect(health.tokenValidation.reason).toContain('Invalid access_token');
  });

  it('registers webhook subscriptions for messages, callbacks and bot_started', async () => {
    process.env.MAX_BOT_API_BASE_URL = 'https://platform-api.max.ru';
    process.env.MAX_BOT_API_TOKEN = 'test-token';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    }) as any;

    const service = new MaxBotService();
    await service.registerWebhook({ url: 'https://api.example/max-bot/webhook' });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://platform-api2.max.ru/subscriptions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          url: 'https://api.example/max-bot/webhook',
          update_types: ['message_created', 'message_callback', 'bot_started'],
        }),
      }),
    );
  });

  it('registers only the minimal compatibility command menu', async () => {
    process.env.MAX_BOT_API_BASE_URL = 'https://platform-api.max.ru';
    process.env.MAX_BOT_API_TOKEN = 'test-token';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    }) as any;

    const service = new MaxBotService();
    await service.registerMinimalCommandMenu();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://platform-api2.max.ru/me/commands',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          commands: [
            { name: 'start', description: 'Открыть меню' },
            { name: 'menu', description: 'Показать меню' },
            { name: 'help', description: 'Помощь' },
          ],
        }),
      }),
    );
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
    expect(calls[0][0]).toBe('https://platform-api2.max.ru/messages?chat_id=-75137613795359');
    const createdPayload = JSON.parse(calls[0][1].body);
    expect(createdPayload).toMatchObject({
      text: expect.stringContaining('Отправитель: Иван Петров'),
    });
    expect(createdPayload).toMatchObject({
      text: expect.stringContaining('Телефон: +7 999 123-45-67'),
    });
    expect(createdPayload).toMatchObject({
      text: expect.stringContaining('Комментарий:\n"Не работает вывеска\n\nТребуется проверить"'),
    });
    expect(createdPayload.text).not.toContain('http://194.67.101.37:4173/m/tickets/ticket-123');
    expect(createdPayload.attachments[0].payload.buttons[0][0]).toMatchObject({
      type: 'open_app',
      text: 'Открыть заявку',
      web_app: 'id056001679003_bot',
      payload: 'ticket_ticket-123',
    });
    expect(JSON.parse(calls[1][1].body)).toMatchObject({
      text: expect.stringContaining('Исполнитель: Иван Иванов / ivan@test.local'),
      attachments: expect.any(Array),
    });
    expect(JSON.parse(calls[2][1].body)).toMatchObject({
      text: expect.stringContaining('Статус: Новая → В работе'),
      attachments: expect.any(Array),
    });
  });

  it('uses acceptance navigation text when a ticket moves to awaiting acceptance', async () => {
    process.env.MAX_BOT_API_BASE_URL = 'https://platform-api.max.ru';
    process.env.MAX_BOT_API_TOKEN = 'test-token';
    process.env.MAX_GROUP_CHAT_ID = '-75137613795359';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ message: { message_id: 'm1' } }),
    }) as any;

    const service = new MaxBotService();
    await service.sendTicketStatusChangedMessage({
      companyId: 'company-1',
      locationId: null,
      ticketId: 'ticket-123',
      ticketNumber: 123,
      fromStatus: 'IN_PROGRESS' as any,
      toStatus: 'AWAITING_ACCEPTANCE' as any,
    });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.attachments[0].payload.buttons[0][0]).toMatchObject({
      type: 'open_app',
      text: 'Открыть приёмку',
      web_app: 'id056001679003_bot',
      payload: 'ticket_ticket-123',
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
      'https://platform-api2.max.ru/messages?chat_id=-75137613795359',
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

// ── extractChatId — webhook payload shapes ────────────────────────────────────

describe('MaxBotService.extractChatId — webhook payload shapes', () => {
  // Exercises the private extractChatId via pollUpdates (which calls collectChatIds)
  async function chatIdsFrom(updates: unknown[]) {
    process.env.MAX_BOT_API_BASE_URL = 'https://platform-api.max.ru';
    process.env.MAX_BOT_API_TOKEN = 'test-token';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ updates, marker: 1 }),
    }) as any;
    const svc = new MaxBotService();
    const result = await svc.pollUpdates({});
    return result.chatIds;
  }

  afterEach(() => {
    const orig = (global as any).__originalFetch;
    if (orig) global.fetch = orig;
    jest.restoreAllMocks();
  });

  it('flat chat_id on update root (polling)', async () => {
    expect(await chatIdsFrom([{ update_type: 'message_created', chat_id: -111 }])).toEqual([-111]);
  });

  it('message.chat_id (polling variant)', async () => {
    expect(await chatIdsFrom([{ update_type: 'message_created', message: { chat_id: -222 } }])).toEqual([-222]);
  });

  it('message.recipient.chat_id (MAX webhook actual structure)', async () => {
    const update = {
      update_type: 'message_created',
      timestamp: 1700000000000,
      message: {
        sender: { user_id: 42, name: 'Test' },
        recipient: { chat_id: -75137613795359, chat_type: 'chat' },
        body: { mid: 'mid1', seq: 1, text: '/help' },
        timestamp: 1700000000000,
      },
    };
    expect(await chatIdsFrom([update])).toEqual([-75137613795359]);
  });

  it('message.recipient.chatId (camelCase variant)', async () => {
    expect(await chatIdsFrom([
      { update_type: 'message_created', message: { recipient: { chatId: -333 } } },
    ])).toEqual([-333]);
  });

  it('chat.id on update root', async () => {
    expect(await chatIdsFrom([{ update_type: 'message_created', chat: { id: -444 } }])).toEqual([-444]);
  });

  it('dialog_id on update root', async () => {
    expect(await chatIdsFrom([{ update_type: 'message_created', dialog_id: -555 }])).toEqual([-555]);
  });

  it('returns no chatIds when structure is unrecognised', async () => {
    expect(await chatIdsFrom([{ update_type: 'message_created', unknown_field: 'x' }])).toEqual([]);
  });

  it('reads callback.message.recipient.chat_id', async () => {
    expect(await chatIdsFrom([
      {
        update_type: 'message_callback',
        callback: {
          callback_id: 'cb-1',
          payload: 'help',
          message: { recipient: { chat_id: -666 } },
        },
      },
    ])).toEqual([-666]);
  });

  it('falls back to the sender user_id for private bot_started updates', async () => {
    expect(await chatIdsFrom([
      { update_type: 'bot_started', user: { user_id: 4242 } },
    ])).toEqual([4242]);
  });
});

// ── handleWebhookUpdate — full MAX webhook payload ────────────────────────────

describe('MaxBotService.handleWebhookUpdate — MAX webhook payload', () => {
  const GROUP_CHAT_ID = -75137613795359;

  function makeWebhookUpdate(text: string) {
    return {
      update_type: 'message_created',
      timestamp: 1700000000000,
      message: {
        sender: { user_id: 42, name: 'Dispatcher' },
        recipient: { chat_id: GROUP_CHAT_ID, chat_type: 'chat' },
        body: { mid: 'mid1', seq: 1, text },
        timestamp: 1700000000000,
      },
    };
  }

  function makePrivateUpdate(text: string) {
    return {
      update_type: 'message_created',
      timestamp: 1700000000000,
      message: {
        sender: { user_id: 4242, name: 'Private User' },
        recipient: { chat_id: 4242, chat_type: 'dialog' },
        body: { mid: 'mid-private', seq: 1, text },
        timestamp: 1700000000000,
      },
    };
  }

  function makeBotStartedUpdate() {
    return {
      update_type: 'bot_started',
      timestamp: 1700000000000,
      user: { user_id: 4242, name: 'Private User' },
    };
  }

  function makeCallbackUpdate(payload: string) {
    return {
      update_type: 'message_callback',
      timestamp: 1700000000000,
      callback: {
        callback_id: 'cb-1',
        payload,
        user: { user_id: 42 },
        message: {
          recipient: { chat_id: GROUP_CHAT_ID, chat_type: 'chat' },
          body: { mid: 'mid1', seq: 1, text: 'Помощь' },
        },
      },
    };
  }

  beforeEach(() => {
    process.env.MAX_BOT_API_BASE_URL = 'https://platform-api.max.ru';
    process.env.MAX_BOT_API_TOKEN = 'test-token';
    process.env.MAX_GROUP_CHAT_ID = String(GROUP_CHAT_ID);
    process.env.MAX_BOT_COMMANDS_ENABLED = 'true';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.MAX_GROUP_CHAT_ID;
    delete process.env.MAX_BOT_COMMANDS_ENABLED;
  });

  it('parses /help from message.recipient.chat_id + message.body.text and sends response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ message: { mid: 'resp1' } }),
    }) as any;

    const commandService = { handleUpdate: jest.fn().mockResolvedValue('📋 Доступные команды...') } as any;
    const svc = new MaxBotService(undefined, commandService);
    const logSpy = jest.spyOn((svc as any).logger, 'log');

    await svc.handleWebhookUpdate(makeWebhookUpdate('/help'));

    expect(commandService.handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ update_type: 'message_created' }),
    );

    const loggedEvents = logSpy.mock.calls.map(([, event]) => event);
    expect(loggedEvents).toContain('max_bot_update_received');
    expect(loggedEvents).toContain('max_bot_command_handled');
    expect(loggedEvents).toContain('max_bot_command_response_sent');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/messages?chat_id=${encodeURIComponent(String(GROUP_CHAT_ID))}`),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it.each(['/start', '/menu', '/help', 'Привет'])(
    'allows private %s command flow and replies to the private chat',
    async (text) => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ message: { mid: 'private-response' } }),
      }) as any;

      const commandService = { handleUpdate: jest.fn().mockResolvedValue({ text: 'safe menu' }) } as any;
      const svc = new MaxBotService(undefined, commandService);

      await svc.handleWebhookUpdate(makePrivateUpdate(text));

      expect(commandService.handleUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ update_type: 'message_created' }),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        'https://platform-api2.max.ru/messages?chat_id=4242',
        expect.objectContaining({ method: 'POST' }),
      );
    },
  );

  it('allows private bot_started and replies with the command service response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ message: { mid: 'started-response' } }),
    }) as any;

    const commandService = { handleUpdate: jest.fn().mockResolvedValue({ text: 'safe menu' }) } as any;
    const svc = new MaxBotService(undefined, commandService);

    await svc.handleWebhookUpdate(makeBotStartedUpdate());

    expect(commandService.handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ update_type: 'bot_started' }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'https://platform-api2.max.ru/messages?chat_id=4242',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('blocks other group chats', async () => {
    const commandService = { handleUpdate: jest.fn() } as any;
    const svc = new MaxBotService(undefined, commandService);
    const logSpy = jest.spyOn((svc as any).logger, 'log');

    const wrongChatUpdate = {
      update_type: 'message_created',
      message: {
        recipient: { chat_id: -999, chat_type: 'chat' },
        body: { text: '/help' },
      },
    };
    await svc.handleWebhookUpdate(wrongChatUpdate);

    expect(commandService.handleUpdate).not.toHaveBeenCalled();
    const ignored = logSpy.mock.calls.find(([obj, event]) => event === 'max_bot_update_ignored' && obj?.reason === 'other_group_chat');
    expect(ignored).toBeDefined();
  });

  it('ignores non-command text silently', async () => {
    const fetchMock = jest.fn() as jest.Mock;
    global.fetch = fetchMock;

    const commandService = { handleUpdate: jest.fn().mockResolvedValue(null) } as any;
    const svc = new MaxBotService(undefined, commandService);

    await svc.handleWebhookUpdate(makeWebhookUpdate('Привет!'));

    expect(commandService.handleUpdate).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers callback updates through POST /answers', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true }),
    }) as any;

    const commandService = {
      handleUpdate: jest.fn().mockResolvedValue({
        text: 'Помощь',
        attachments: [
          {
            type: 'inline_keyboard',
            payload: { buttons: [[{ type: 'callback', text: 'Меню', payload: 'menu' }]] },
          },
        ],
      }),
    } as any;
    const svc = new MaxBotService(undefined, commandService);

    await svc.handleWebhookUpdate(makeCallbackUpdate('help'));

    expect(commandService.handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ update_type: 'message_callback' }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'https://platform-api2.max.ru/answers?callback_id=cb-1',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          message: {
            text: 'Помощь',
            attachments: [
              {
                type: 'inline_keyboard',
                payload: { buttons: [[{ type: 'callback', text: 'Меню', payload: 'menu' }]] },
              },
            ],
          },
        }),
      }),
    );
  });
});
