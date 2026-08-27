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
  it('unknown command returns the menu', async () => {
    const res = await makeService().handleUpdate(msg('/wat'));
    expect(res).not.toBeNull();
    expect(res?.text).toContain('Не понял запрос');
    expect(res?.text).toContain('Сервис Менеджер');
    expect(buttonsOf(res)).toContainEqual(
      expect.objectContaining({ type: 'open_app', text: 'Открыть ServiceManager' }),
    );
  });

  it('free text returns the menu', async () => {
    const res = await makeService().handleUpdate(msg('привет'));
    expect(res).not.toBeNull();
    expect(res?.text).toContain('Не понял запрос');
  });

  it('still returns null when the update carries no text at all', async () => {
    expect(await makeService().handleUpdate({ update_type: 'message_created' })).toBeNull();
  });
});

describe('MaxBotCommandService — legacy data commands are closed', () => {
  it.each(['/tickets', '/ticket 123', '/open 123'])(
    '%s returns navigation and reads no ticket data',
    async (input) => {
      const prisma = makeForbiddenPrisma();
      const res = await makeService(prisma).handleUpdate(msg(input));
      expect(res?.text).toContain('Заявки теперь открываются в приложении');
      expect(buttonsOf(res)).toContainEqual(
        expect.objectContaining({ type: 'open_app', text: 'Открыть ServiceManager' }),
      );
    },
  );

  it.each(['/ticket 123', '/ticket 999999', '/open 1'])(
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
    expect(res?.text).not.toContain('Мои заявки');
    expect(res?.text).not.toContain('Требуют приёмки');
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
});
