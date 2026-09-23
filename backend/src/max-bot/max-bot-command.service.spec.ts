import { UserRole } from '@prisma/client';

import { MaxBotCommandService } from './max-bot-command.service';
import { MaxIdentityService } from './max-identity.service';
import { MaxMasterCommandService } from './max-master-command.service';

/**
 * A prisma double whose every ticket accessor throws. If any command path still reads
 * ticket data, these tests fail loudly instead of silently passing on a mock that
 * happens to return nothing.
 */
function makeForbiddenPrisma() {
  const boom = () => {
    throw new Error('ticket data must never be read from a MAX command');
  };
  return {
    ticket: { findMany: boom, findUnique: boom, findFirst: boom, count: boom },
    maxUserBinding: { findUnique: jest.fn().mockResolvedValue(null) },
  } as any;
}

function makeService(prisma = makeForbiddenPrisma()) {
  return new MaxBotCommandService(prisma, new MaxIdentityService(prisma));
}

const msg = (text: string) => ({ message: { text } });
const botStarted = () => ({
  update_type: 'bot_started',
  chat_id: 4242,
  user: { user_id: 4242 },
});
const callback = (payload: string) => ({
  callback: {
    callback_id: 'cb-1',
    payload,
    message: { recipient: { chat_id: -100 }, body: { text: 'menu' } },
    user: { user_id: 4242 },
  },
});

function buttonsOf(response: Awaited<ReturnType<MaxBotCommandService['handleUpdate']>>) {
  return response?.attachments?.[0]?.payload.buttons.flat() || [];
}

describe('MaxBotCommandService — entry points', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV, MAX_PUBLIC_FRONTEND_URL: 'https://sm.example' };
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('/start returns the menu', async () => {
    const res = await makeService().handleUpdate(msg('/start'));
    expect(res?.text).toContain('Сервис Менеджер');
    expect(buttonsOf(res)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'open_app', text: 'Открыть ServiceManager' }),
        expect.objectContaining({ type: 'callback', text: 'Помощь', payload: 'help' }),
      ]),
    );
  });

  it('/menu is an alias for /start', async () => {
    const start = await makeService().handleUpdate(msg('/start'));
    const menu = await makeService().handleUpdate(msg('/menu'));
    expect(menu).toEqual(start);
  });

  it('bot_started returns the same safe menu as /start', async () => {
    const start = await makeService().handleUpdate(msg('/start'));
    const started = await makeService().handleUpdate(botStarted());
    expect(started).toEqual(start);
  });

  it('/help explains the menu rather than listing commands', async () => {
    const res = await makeService().handleUpdate(msg('/help'));
    expect(res?.text).toContain('Помощь');
    expect(res?.text).not.toContain('/tickets');
    expect(res?.text).not.toContain('/ticket ');
    expect(res?.text).not.toContain('/open');
    expect(buttonsOf(res)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'open_app', text: 'Открыть ServiceManager' }),
        expect.objectContaining({ type: 'callback', text: 'Меню', payload: 'menu' }),
      ]),
    );
  });

  it('/status still answers for operators', async () => {
    const res = await makeService().handleUpdate(msg('/status'));
    expect(res?.text).toContain('бот онлайн');
    expect(buttonsOf(res)).toContainEqual(expect.objectContaining({ type: 'callback', text: 'Меню', payload: 'menu' }));
  });

  it('/test returns server time without reading MaxUserBinding', async () => {
    const prisma = makeForbiddenPrisma();
    prisma.maxUserBinding.findUnique.mockRejectedValue(new Error('db down'));
    const res = await makeService(prisma).handleUpdate(msg('/test'));
    expect(res?.text).toMatch(/^Время сервера: \d{4}-\d{2}-\d{2}T/);
    expect(prisma.maxUserBinding.findUnique).not.toHaveBeenCalled();
    expect(buttonsOf(res)).toEqual([
      expect.objectContaining({ type: 'callback', text: 'Меню', payload: 'menu' }),
    ]);
  });

  it('uses open_app rather than a plain URL when a frontend URL is configured', async () => {
    const res = await makeService().handleUpdate(msg('/start'));
    expect(res?.text).not.toContain('https://');
    expect(buttonsOf(res)).toContainEqual(
      expect.objectContaining({
        type: 'open_app',
        web_app: 'id056001679003_bot',
        payload: 'app',
      }),
    );
  });
});

describe('MaxBotCommandService — unknown input is never silent', () => {
  it('unknown command returns Меню instead of reprinting the main keyboard', async () => {
    const res = await makeService().handleUpdate(msg('/wat'));
    expect(res).not.toBeNull();
    expect(res?.text).toBe('Не понял запрос.');
    expect(buttonsOf(res)).toEqual([expect.objectContaining({ type: 'callback', text: 'Меню', payload: 'menu' })]);
  });

  it('free text returns Меню', async () => {
    const res = await makeService().handleUpdate(msg('привет'));
    expect(res).not.toBeNull();
    expect(res?.text).toBe('Не понял запрос.');
    expect(buttonsOf(res).map((button) => button.text)).toEqual(['Меню']);
  });

  it('still returns null when the update carries no text at all', async () => {
    expect(await makeService().handleUpdate({ update_type: 'message_created' })).toBeNull();
  });
});

describe('MaxBotCommandService — legacy data commands are closed', () => {
  it.each(['/tickets', '/ticket 1', '/ticket 123', '/ticket 999999', '/open 1', '/open 123', '/open arbitrary-id'])(
    '%s returns navigation and reads no ticket data',
    async (input) => {
      const prisma = makeForbiddenPrisma();
      const res = await makeService(prisma).handleUpdate(msg(input));
      expect(res?.text).toContain('Заявки теперь открываются в приложении');
      expect(buttonsOf(res)).toContainEqual(
        expect.objectContaining({ type: 'open_app', text: 'Открыть ServiceManager' }),
      );
      expect(buttonsOf(res)).toContainEqual(expect.objectContaining({ type: 'callback', text: 'Меню', payload: 'menu' }));
    },
  );

  it.each(['/tickets', '/ticket 1', '/ticket 123', '/ticket 999999', '/open 1', '/open arbitrary-id'])(
    '%s discloses nothing about ticket existence',
    async (input) => {
      const res = await makeService().handleUpdate(msg(input));
      expect(res?.text).not.toMatch(/не найдена|Заявка №|\d{3,}/);
    },
  );

  it('gives an identical reply for an existing-looking and an absurd ticket number', async () => {
    const a = await makeService().handleUpdate(msg('/ticket 1'));
    const b = await makeService().handleUpdate(msg('/ticket 987654321'));
    expect(a).toEqual(b);
  });

  it('never emits requester identity fields', async () => {
    for (const input of ['/tickets', '/ticket 1', '/open 1', '/start', '/help']) {
      const res = await makeService().handleUpdate(msg(input));
      expect(res?.text).not.toContain('Заявитель');
      expect(res?.text).not.toContain('Телефон');
    }
  });
});

describe('MaxBotCommandService — unbound identity leaks nothing', () => {
  it('an unbound MAX user gets only linking and help', async () => {
    const res = await makeService().handleUpdate({
      message: { text: '/start', sender: { user_id: 4242 } },
    });
    expect(buttonsOf(res).map((button) => button.text)).toEqual([
      'Открыть ServiceManager',
      'Помощь',
    ]);
    expect(res?.text).toContain('Бот не показывает данные заявок без входа.');
    expect(res?.text).not.toContain('Мои заявки');
    expect(res?.text).not.toContain('Требуют приёмки');
  });

  it('revoked binding is treated as not logged in', async () => {
    const identity = {
      resolve: jest.fn().mockResolvedValue({ resolved: false, reason: 'binding_revoked' }),
    };
    const service = new MaxBotCommandService(makeForbiddenPrisma(), identity as any);
    const res = await service.handleUpdate({ message: { text: '/start', sender: { user_id: 4242 } } });
    expect(buttonsOf(res).map((button) => button.text)).toEqual(['Открыть ServiceManager', 'Помощь']);
    expect(res?.text).toContain('Бот не показывает данные заявок без входа.');
  });

  it('a bound coordinator gets the master menu, not the login screenshot', async () => {
    const identity = {
      resolve: jest.fn().mockResolvedValue({
        resolved: true,
        userId: 'user-1',
        companyId: 'company-1',
        role: 'ADMIN',
        maxUserId: '4242',
      }),
    };
    const service = new MaxBotCommandService(makeForbiddenPrisma(), identity as any);
    const update = botStarted();

    const res = await service.handleUpdate(update);

    expect(identity.resolve).toHaveBeenCalledWith(update);
    expect(res?.text).toContain('Выберите действие');
    expect(buttonsOf(res).map((button) => button.text)).toEqual([
      'Сегодня',
      'Заявки',
      'Без исполнителя',
      'Техники',
      'Обходы',
      'Просрочено',
    ]);
    expect(res?.text).not.toContain('Мои заявки');
    expect(res?.text).not.toContain('Бот не показывает данные заявок без входа.');
  });

  it('a bound client still gets the unfinished-role stub', async () => {
    const identity = {
      resolve: jest.fn().mockResolvedValue({
        resolved: true,
        userId: 'user-1',
        companyId: 'company-1',
        role: 'CLIENT',
        maxUserId: '4242',
      }),
    };
    const service = new MaxBotCommandService(makeForbiddenPrisma(), identity as any);
    const res = await service.handleUpdate(botStarted());
    expect(res?.text).toBe('Этот функционал в разработке');
    expect(buttonsOf(res).map((button) => button.text)).toEqual(['Меню']);
  });
});

describe('MaxBotCommandService — callbacks are navigation/help only', () => {
  it('renders help for the help callback', async () => {
    const res = await makeService().handleUpdate(callback('help'));
    expect(res?.text).toContain('Помощь');
    expect(JSON.stringify(res)).not.toMatch(/Принять|Отклонить|Взять|Назначить/);
  });

  it('renders the safe menu for unknown callbacks', async () => {
    const res = await makeService().handleUpdate(callback('claim_ticket_123'));
    expect(res?.text).toContain('Сервис Менеджер');
    expect(JSON.stringify(res)).not.toContain('claim_ticket_123');
  });
});

describe('MaxBotCommandService — text extraction regressions', () => {
  it('reads message.body.text (MAX webhook shape)', async () => {
    const res = await makeService().handleUpdate({
      message: { body: { mid: 'm1', seq: 1, text: '/status' } },
    });
    expect(res?.text).toContain('бот онлайн');
  });

  it('reads update.text', async () => {
    const res = await makeService().handleUpdate({ text: '/status' });
    expect(res?.text).toContain('бот онлайн');
  });

  it('is case-insensitive', async () => {
    const res = await makeService().handleUpdate(msg('/START'));
    expect(res?.text).toContain('Сервис Менеджер');
  });

  it('returns null when message.body is an object without text', async () => {
    expect(await makeService().handleUpdate({ message: { body: { mid: 'm1' } } })).toBeNull();
  });

  it('strips a bot mention from /start', async () => {
    const res = await makeService().handleUpdate(msg('/start@id056001679003_1_bot'));
    expect(res?.text).toContain('Сервис Менеджер');
  });
});

function makeWorkplace() {
  return {
    today: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        shiftOpen: true,
        shiftOpenedLabel: '17.09, 09:14',
        myActiveCount: 2,
        overdueCount: 1,
        roundsTodayCount: 0,
      },
    }),
    shift: jest.fn().mockResolvedValue({
      ok: true,
      value: { open: false, openedLabel: null, locationName: null },
    }),
    openShift: jest.fn().mockResolvedValue({
      ok: true,
      value: { open: true, openedLabel: '17.09, 09:14', locationName: null },
    }),
    closeShift: jest.fn().mockResolvedValue({
      ok: true,
      value: { open: false, openedLabel: null, locationName: null },
    }),
    myTickets: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            ticketNumber: 12,
            locationName: 'Склад',
            problemText: 'Не морозит',
            urgencyLabel: 'Срочно',
            statusLabel: 'Назначена',
          },
        ],
        prevOffset: null,
        nextOffset: null,
      },
    }),
    searchTickets: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        kind: 'page',
        page: {
          items: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              ticketNumber: 12,
              locationName: 'Склад',
              problemText: 'Не морозит',
              urgencyLabel: 'Срочно',
              statusLabel: 'Назначена',
            },
          ],
          prevOffset: null,
          nextOffset: null,
        },
      },
    }),
    availableTickets: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            ticketNumber: 12,
            locationName: 'Склад',
            problemText: 'Не морозит',
            urgencyLabel: 'Срочно',
            statusLabel: 'Новая',
            canClaim: true,
          },
        ],
        prevOffset: null,
        nextOffset: null,
      },
    }),
    claimAvailableTicket: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        kind: 'claimed',
        card: {
          id: '11111111-1111-4111-8111-111111111111',
          ticketNumber: 12,
          locationName: 'Склад',
          categoryName: 'Холод',
          problemText: 'Не морозит',
          urgencyLabel: 'Срочно',
          statusLabel: 'Назначена',
          assigneeName: 'Виктор',
          equipmentName: 'Шкаф',
          canStart: true,
          canComplete: false,
          pickerTransitions: [],
        },
      },
    }),
    ticketCard: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        id: '11111111-1111-4111-8111-111111111111',
        ticketNumber: 12,
        locationName: 'Склад',
        categoryName: 'Холод',
        problemText: 'Не морозит',
        urgencyLabel: 'Срочно',
        statusLabel: 'Назначена',
        assigneeName: 'Виктор',
        equipmentName: 'Шкаф',
        canStart: true,
        canComplete: false,
        pickerTransitions: [],
      },
    }),
    startMyTicket: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        id: '11111111-1111-4111-8111-111111111111',
        ticketNumber: 12,
        locationName: 'Склад',
        categoryName: 'Холод',
        problemText: 'Не морозит',
        urgencyLabel: 'Срочно',
        statusLabel: 'В работе',
        assigneeName: 'Виктор',
        equipmentName: 'Шкаф',
        canStart: false,
        canComplete: true,
        pickerTransitions: [],
      },
    }),
    changeMyTicketStatus: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        id: '11111111-1111-4111-8111-111111111111',
        ticketNumber: 12,
        locationName: 'Склад',
        categoryName: 'Холод',
        problemText: 'Не морозит',
        urgencyLabel: 'Срочно',
        statusLabel: 'Назначена',
        assigneeName: 'Виктор',
        equipmentName: 'Шкаф',
        canStart: true,
        canComplete: false,
        pickerTransitions: [],
      },
    }),
    ticketHistory: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        ticketId: '11111111-1111-4111-8111-111111111111',
        ticketNumber: 12,
        items: [{ atLabel: '18.09, 11:00', title: 'Комментарий', detail: 'Проверил' }],
        prevOffset: null,
        nextOffset: null,
      },
    }),
    addMyTicketComment: jest.fn().mockResolvedValue({
      ok: true,
      value: { ticketId: '11111111-1111-4111-8111-111111111111', ticketNumber: 12 },
    }),
    addMyTicketPhoto: jest.fn().mockResolvedValue({
      ok: true,
      value: { ticketId: '11111111-1111-4111-8111-111111111111', ticketNumber: 12, count: 1 },
    }),
    completeMyTicket: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        id: '11111111-1111-4111-8111-111111111111',
        ticketNumber: 12,
        locationName: 'Склад',
        categoryName: 'Холод',
        problemText: 'Не морозит',
        urgencyLabel: 'Срочно',
        statusLabel: 'Ожидает приёмки',
        assigneeName: 'Виктор',
        equipmentName: 'Шкаф',
        canStart: false,
        canComplete: false,
        pickerTransitions: [],
      },
    }),
  };
}

function makeRounds() {
  const item = {
    runId: '22222222-2222-4222-8222-222222222222',
    itemId: '33333333-3333-4333-8333-333333333333',
    locationName: 'Кафе',
    index: 1,
    total: 2,
    equipmentName: 'Холодильник',
    checkText: 'Уплотнитель',
    normText: 'без трещин',
  };
  return {
    list: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        items: [
          {
            scheduleId: '11111111-1111-4111-8111-111111111111',
            runId: null,
            timeLabel: '09:00',
            locationName: 'Кафе',
            name: 'Утро',
            itemCount: 12,
          },
        ],
        prevOffset: null,
        nextOffset: null,
      },
    }),
    start: jest.fn().mockResolvedValue({ ok: true, value: { kind: 'item', item } }),
    continueRun: jest.fn().mockResolvedValue({ ok: true, value: { kind: 'item', item } }),
    markOk: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        kind: 'brief',
        brief: {
          runId: '22222222-2222-4222-8222-222222222222',
          okCount: 2,
          issueCount: 0,
          criticalCount: 0,
          createdTicketsCount: 0,
          durationLabel: '12 мин',
        },
      },
    }),
    nextItem: jest.fn(),
    report: jest.fn(),
    pendingItem: jest.fn().mockResolvedValue({ ok: true, value: item }),
    saveIssue: jest.fn(),
    attachPhoto: jest.fn(),
    createTicket: jest.fn(),
  };
}

function makeTechnicianService() {
  const identity = {
    resolve: jest.fn().mockResolvedValue({
      resolved: true,
      userId: 'tech-1',
      companyId: 'company-1',
      role: UserRole.TECHNICIAN,
      maxUserId: '4242',
    }),
  };
  const workplace = makeWorkplace();
  const rounds = makeRounds();
  return {
    identity,
    workplace,
    rounds,
    service: new MaxBotCommandService(
      makeForbiddenPrisma(),
      identity as any,
      workplace as any,
      undefined as any,
      rounds as any,
    ),
  };
}

describe('MaxBotCommandService — technician chat menu', () => {
  it('/start and /menu show the same ready section callbacks', async () => {
    const { service, identity } = makeTechnicianService();
    const start = await service.handleUpdate({ message: { text: '/start', sender: { user_id: 4242 } } });
    const menu = await service.handleUpdate({ message: { text: '/menu', sender: { user_id: 4242 } } });
    expect(identity.resolve).toHaveBeenCalled();
    expect(start).toEqual(menu);
    expect(start?.text).toContain('Выберите действие');
    expect(buttonsOf(start).map((button) => button.text)).toEqual([
      'Сегодня',
      'Мои заявки',
      'Доступные',
      'Обходы',
      'Моя смена',
      'Поиск заявки',
    ]);
    expect(buttonsOf(start).every((button) => button.type === 'callback')).toBe(true);
  });

  it('callback Сегодня replies with the day summary', async () => {
    const { service, workplace } = makeTechnicianService();
    const res = await service.handleUpdate(callback('today'));
    expect(workplace.today).toHaveBeenCalled();
    expect(res?.text).toContain('Сегодня');
    expect(res?.text).toContain('Заявки: 2, просрочено 1');
    expect(buttonsOf(res).map((button) => button.text)).toContain('Мои заявки');
    expect(res?.text).not.toContain('7999');
  });

  it('callback Моя смена replies with shift state and open/close', async () => {
    const { service, workplace } = makeTechnicianService();
    const res = await service.handleUpdate(callback('shift'));
    expect(workplace.shift).toHaveBeenCalled();
    expect(res?.text).toContain('Моя смена');
    expect(buttonsOf(res).map((button) => button.text)).toContain('Открыть смену');
  });

  it('asks before closing a shift, then closes through WorkforceService', async () => {
    const { service, workplace } = makeTechnicianService();
    workplace.shift.mockResolvedValue({
      ok: true,
      value: { open: true, openedLabel: '09:14', locationName: null },
    });
    const ask = await service.handleUpdate(callback('shift_close'));
    expect(ask?.text).toBe('Закрыть смену?');
    const closed = await service.handleUpdate(callback('shift_yes'));
    expect(workplace.closeShift).toHaveBeenCalled();
    expect(closed?.text).toContain('Смена не открыта');
  });

  it('Меню callback returns the ready-section menu', async () => {
    const { service } = makeTechnicianService();
    const res = await service.handleUpdate(callback('menu'));
    expect(buttonsOf(res).map((button) => button.text)).toEqual([
      'Сегодня',
      'Мои заявки',
      'Доступные',
      'Обходы',
      'Моя смена',
      'Поиск заявки',
    ]);
  });

  it('message Мои заявки opens the assigned list, not a stub title', async () => {
    const { service, workplace } = makeTechnicianService();
    const res = await service.handleUpdate({
      message: { text: 'Мои заявки', sender: { user_id: 4242 } },
    });
    expect(workplace.myTickets).toHaveBeenCalled();
    expect(res?.text).toContain('Мои заявки');
    expect(res?.text).toContain('#12 · Назначена · Срочно');
    expect(res?.text).not.toContain('Телефон');
    expect(buttonsOf(res).map((button) => button.text)).toContain('#12');
  });

  it('Открыть opens the card from getOne, Начать работу mutates through the workplace', async () => {
    const { service, workplace } = makeTechnicianService();
    const card = await service.handleUpdate(callback('tk:11111111-1111-4111-8111-111111111111'));
    expect(workplace.ticketCard).toHaveBeenCalled();
    expect(card?.text).toContain('Заявка #12');
    expect(card?.text).toContain('Исполнитель: Виктор');
    expect(buttonsOf(card).map((button) => button.text)).toContain('Начать работу');
    const started = await service.handleUpdate(callback('tks:11111111-1111-4111-8111-111111111111'));
    expect(workplace.startMyTicket).toHaveBeenCalled();
    expect(started?.text).toContain('Статус: В работе');
    expect(buttonsOf(started).map((button) => button.text)).toEqual([
      'Комментарий',
      'Фото',
      'История',
      'Завершить',
      'Меню',
    ]);
    const history = await service.handleUpdate(callback('tkh:11111111-1111-4111-8111-111111111111'));
    expect(workplace.ticketHistory).toHaveBeenCalled();
    expect(history?.text).toContain('История #12');
    expect(history?.text).toContain('Проверил');
  });

  it('Поиск заявки asks for a query, then filters through TicketsService.list', async () => {
    const { service, workplace } = makeTechnicianService();
    const prompt = await service.handleUpdate(callback('find'));
    expect(prompt?.text).toContain('Напишите номер, описание, имя или адрес заявки');
    const found = await service.handleUpdate({
      message: { text: 'морозит', sender: { user_id: 4242 } },
    });
    expect(workplace.searchTickets).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'tech-1', companyId: 'company-1' }),
      'морозит',
      0,
    );
    expect(found?.text).toContain('Поиск заявки');
    expect(found?.text).toContain('#12 · Назначена · Срочно');
    expect(found?.text).not.toContain('7999');
    expect(buttonsOf(found).map((button) => button.text)).toContain('#12');
  });

  it('Доступные lists claimable tickets and claim goes through the workplace', async () => {
    const { service, workplace } = makeTechnicianService();
    const list = await service.handleUpdate(callback('avail'));
    expect(workplace.availableTickets).toHaveBeenCalled();
    expect(list?.text).toContain('Доступные');
    expect(list?.text).toContain('#12 · Новая · Срочно');
    expect(buttonsOf(list).map((button) => button.text)).toEqual(['Взять #12', 'Подробнее', 'Меню']);
    const claimed = await service.handleUpdate(callback('avc:11111111-1111-4111-8111-111111111111'));
    expect(workplace.claimAvailableTicket).toHaveBeenCalled();
    expect(claimed?.text).toContain('Заявка #12 назначена вам.');
    expect(claimed?.text).toContain('Исполнитель: Виктор');
  });

  it('Обходы list assigned schedules and start opens the first pending item', async () => {
    const { service, rounds } = makeTechnicianService();
    const list = await service.handleUpdate(callback('rounds'));
    expect(rounds.list).toHaveBeenCalled();
    expect(list?.text).toContain('Обходы');
    expect(list?.text).toContain('09:00 · Кафе');
    expect(buttonsOf(list).map((button) => button.text)).toEqual(['Начать', 'Меню']);
    const started = await service.handleUpdate(callback('rst:11111111-1111-4111-8111-111111111111'));
    expect(rounds.start).toHaveBeenCalled();
    expect(started?.text).toContain('Пункт 1 из 2');
    expect(buttonsOf(started).map((button) => button.text)).toEqual(['Норма', 'Проблема', 'Критично', 'Отмена']);
  });

  it('unbound user sending Мои заявки does not get ticket rows', async () => {
    const res = await makeService().handleUpdate({
      message: { text: 'Мои заявки', sender: { user_id: 4242 } },
    });
    expect(res?.text).toContain('Бот не показывает данные заявок без входа.');
    expect(res?.text).not.toContain('#');
  });

  it('unbound user sending Сегодня does not get technician counters', async () => {
    const res = await makeService().handleUpdate({
      message: { text: 'Сегодня', sender: { user_id: 4242 } },
    });
    expect(res?.text).toContain('Бот не показывает данные заявок без входа.');
    expect(res?.text).not.toContain('Заявки:');
  });

  it('/test for a bound technician still returns only server time', async () => {
    const { service, identity } = makeTechnicianService();
    const res = await service.handleUpdate({ message: { text: '/test', sender: { user_id: 4242 } } });
    expect(identity.resolve).not.toHaveBeenCalled();
    expect(res?.text).toMatch(/^Время сервера: \d{4}-\d{2}-\d{2}T/);
    expect(buttonsOf(res).map((button) => button.text)).toEqual(['Меню']);
  });
});

const TICKET_ID = '11111111-1111-4111-8111-111111111111';
const TECH_ID = '22222222-2222-4222-8222-222222222222';

function makeMasterWorkplace() {
  const ticket = {
    id: TICKET_ID,
    ticketNumber: 12,
    locationName: 'Склад',
    problemText: 'Не морозит',
    urgencyLabel: 'Срочно',
    statusLabel: 'Новая',
    assigneeName: 'Не назначен',
    categoryName: 'Холод',
    createdLabel: '21.09, 09:00',
    slaLabel: '21.09, 12:00',
  };
  return {
    today: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        newCount: 2,
        unassignedCount: 1,
        inProgressCount: 3,
        overdueCount: 4,
        onShiftCount: 2,
        roundsTodayCount: 1,
      },
    }),
    listTickets: jest.fn().mockResolvedValue({
      ok: true,
      value: { title: 'Новые', filter: 'new', items: [ticket], prevOffset: null, nextOffset: null },
    }),
    unassigned: jest.fn().mockResolvedValue({
      ok: true,
      value: { title: 'Без исполнителя', filter: 'unassigned', items: [ticket], prevOffset: null, nextOffset: null },
    }),
    technicianTickets: jest.fn().mockResolvedValue({
      ok: true,
      value: { title: 'Заявки техника', filter: 'tech', extra: TECH_ID, items: [ticket], prevOffset: null, nextOffset: null },
    }),
    card: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        id: TICKET_ID,
        ticketNumber: 12,
        locationName: 'Склад',
        equipmentName: 'Шкаф',
        sourceLabel: null,
        sourceRunId: null,
        attachmentCount: 0,
        historyPreview: '',
        canAssign: true,
        hasAssignee: false,
      },
    }),
    history: jest.fn().mockResolvedValue({
      ok: true,
      value: { ticketId: TICKET_ID, ticketNumber: 12, items: ['комментарий: Проверил'], prevOffset: null, nextOffset: null },
    }),
    attachments: jest.fn().mockResolvedValue({
      ok: true,
      value: { ticketId: TICKET_ID, ticketNumber: 12, lines: [] },
    }),
    comment: jest.fn().mockResolvedValue({ ok: true, value: { ticketNumber: 12 } }),
    candidates: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        ticketId: TICKET_ID,
        ticketNumber: 12,
        back: 'u',
        hasAssignee: false,
        assigneeName: 'Не назначен',
        items: [{ id: TECH_ID, name: 'Иван Петров', onShift: true, activeCount: 1, specialization: 'Холод' }],
        prevOffset: null,
        nextOffset: null,
      },
    }),
    findCandidate: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        ticketId: TICKET_ID,
        ticketNumber: 12,
        back: 'u',
        hasAssignee: false,
        assigneeName: 'Не назначен',
        items: [],
        chosen: { id: TECH_ID, name: 'Иван Петров', onShift: true, activeCount: 1, specialization: 'Холод' },
      },
    }),
    assign: jest.fn().mockResolvedValue({
      ok: true,
      value: { ticketId: TICKET_ID, ticketNumber: 12, technicianName: 'Иван Петров' },
    }),
    technicians: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        items: [{ userId: TECH_ID, name: 'Иван Петров', openedLabel: '09:00', inProgressCount: 1, doneTodayCount: 0 }],
        prevOffset: null,
        nextOffset: null,
      },
    }),
    rounds: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        items: [
          {
            scheduleId: TICKET_ID,
            runId: null,
            locationName: 'Кафе',
            timeLabel: '09:00',
            technicianName: 'Иван Петров',
            statusLabel: 'не начат',
            progressLabel: '0/4',
          },
        ],
        prevOffset: null,
        nextOffset: null,
      },
    }),
    roundPending: jest.fn().mockResolvedValue({ ok: true, value: { locationName: 'Кафе' } }),
    roundProgress: jest.fn(),
    roundReport: jest.fn(),
  };
}

function makeMasterService(role: UserRole = UserRole.MASTER) {
  const identity = {
    resolve: jest.fn().mockResolvedValue({
      resolved: true,
      userId: 'master-1',
      companyId: 'company-1',
      role,
      maxUserId: '4242',
    }),
  };
  const workplace = makeMasterWorkplace();
  const master = new MaxMasterCommandService(workplace as any);
  return {
    identity,
    workplace,
    service: new MaxBotCommandService(
      makeForbiddenPrisma(),
      identity as any,
      undefined,
      undefined as any,
      undefined,
      master,
    ),
  };
}

describe('MaxBotCommandService — master chat menu', () => {
  it('/start and /menu show the six coordinator sections', async () => {
    const { service, identity } = makeMasterService();
    const start = await service.handleUpdate({ message: { text: '/start', sender: { user_id: 4242 } } });
    const menu = await service.handleUpdate({ message: { text: '/menu', sender: { user_id: 4242 } } });
    expect(identity.resolve).toHaveBeenCalled();
    expect(start).toEqual(menu);
    expect(buttonsOf(start).map((button) => button.text)).toEqual([
      'Сегодня',
      'Заявки',
      'Без исполнителя',
      'Техники',
      'Обходы',
      'Просрочено',
    ]);
  });

  it.each([UserRole.ADMIN, UserRole.DISPATCHER])('%s gets the same master menu', async (role) => {
    const { service } = makeMasterService(role);
    const res = await service.handleUpdate({ message: { text: '/start', sender: { user_id: 4242 } } });
    expect(buttonsOf(res).map((button) => button.text)).toContain('Без исполнителя');
  });

  it('NETWORK_DIRECTOR gets the bound stub, not the master menu', async () => {
    const { service } = makeMasterService(UserRole.NETWORK_DIRECTOR);
    const res = await service.handleUpdate({ message: { text: '/start', sender: { user_id: 4242 } } });
    expect(res?.text).toContain('Этот функционал в разработке');
    expect(buttonsOf(res).map((button) => button.text)).toEqual(['Меню']);
  });

  it('callback Сегодня replies with coordinator counters, not technician ones', async () => {
    const { service, workplace } = makeMasterService();
    const res = await service.handleUpdate(callback('today'));
    expect(workplace.today).toHaveBeenCalled();
    expect(res?.text).toContain('Новых: 2');
    expect(res?.text).toContain('На смене: 2');
    expect(res?.text).not.toContain('Мои заявки');
    expect(buttonsOf(res).map((button) => button.text)).toEqual([
      'Без исполнителя',
      'Техники',
      'Обходы',
      'Просрочено',
      'Меню',
    ]);
    expect(res?.attachments?.[0]?.payload.buttons.at(-1)).toEqual([
      { type: 'callback', text: 'Меню', payload: 'menu' },
    ]);
  });

  it('/tickets opens the filter, not the legacy Mini App redirect', async () => {
    const { service } = makeMasterService();
    const res = await service.handleUpdate({ message: { text: '/tickets', sender: { user_id: 4242 } } });
    expect(res?.text).toBe('Какие заявки показать');
    expect(buttonsOf(res).map((button) => button.text)).toEqual([
      'Новые',
      'В работе',
      'Просрочено',
      'Отмена',
      'Меню',
    ]);
  });

  it('Без исполнителя lists NEW tickets and assign goes through TicketsService', async () => {
    const { service, workplace } = makeMasterService();
    const list = await service.handleUpdate(callback('unassigned'));
    expect(workplace.unassigned).toHaveBeenCalled();
    expect(list?.text).toContain('Без исполнителя');
    expect(buttonsOf(list).map((button) => button.text)).toEqual(['#12', 'Назначить #12', 'Меню']);
    const candidates = await service.handleUpdate(callback(`ma:${TICKET_ID}:u`));
    expect(workplace.candidates).toHaveBeenCalled();
    expect(candidates?.text).toContain('Кого назначить?');
    const assigned = await service.handleUpdate(callback(`mpk:${TICKET_ID}:${TECH_ID}:u`));
    expect(workplace.findCandidate).toHaveBeenCalled();
    expect(workplace.assign).toHaveBeenCalled();
    expect(assigned?.text).toContain('Заявка #12 назначена Иван Петров');
  });

  it('message Заявки opens the filter, technician Сегодня is not used', async () => {
    const { service, workplace } = makeMasterService();
    const res = await service.handleUpdate({ message: { text: 'Заявки', sender: { user_id: 4242 } } });
    expect(workplace.today).not.toHaveBeenCalled();
    expect(res?.text).toBe('Какие заявки показать');
  });

  it('Техники and Обходы stay on the master workplace', async () => {
    const { service, workplace } = makeMasterService();
    const techs = await service.handleUpdate(callback('techs'));
    expect(workplace.technicians).toHaveBeenCalled();
    expect(techs?.text).toContain('Техники на смене');
    const rounds = await service.handleUpdate(callback('rounds'));
    expect(workplace.rounds).toHaveBeenCalled();
    expect(rounds?.text).toContain('Обходы сегодня');
    expect(rounds?.text).toContain('не начат');
  });
});
