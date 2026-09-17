import { UserRole } from '@prisma/client';

import { MaxBotCommandService } from './max-bot-command.service';
import { MaxIdentityService } from './max-identity.service';

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

  it('a bound non-technician gets the unfinished-role stub, not the login screenshot', async () => {
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
    expect(res?.text).toBe('Этот функционал в разработке');
    expect(buttonsOf(res).map((button) => button.text)).toEqual(['Меню']);
    expect(res?.text).not.toContain('Мои заявки');
    expect(res?.text).not.toContain('Бот не показывает данные заявок без входа.');
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
  return {
    identity,
    workplace,
    service: new MaxBotCommandService(makeForbiddenPrisma(), identity as any, workplace as any),
  };
}

describe('MaxBotCommandService — technician chat menu', () => {
  it('/start and /menu show the same six section callbacks', async () => {
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

  it('Меню callback returns the six-button menu', async () => {
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

  it('message button label replies with the same section name and footer', async () => {
    const { service } = makeTechnicianService();
    const res = await service.handleUpdate({
      message: { text: 'Мои заявки', sender: { user_id: 4242 } },
    });
    expect(res?.text).toBe('Мои заявки');
    expect(buttonsOf(res).map((button) => button.text)).toEqual(['Сегодня', 'Моя смена', 'Мои заявки']);
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
