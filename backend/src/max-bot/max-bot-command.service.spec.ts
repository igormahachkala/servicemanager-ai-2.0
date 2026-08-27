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
    expect(res).toContain('Сервис Менеджер');
    expect(res).toContain('Помощь');
  });

  it('/menu is an alias for /start', async () => {
    const start = await makeService().handleUpdate(msg('/start'));
    const menu = await makeService().handleUpdate(msg('/menu'));
    expect(menu).toBe(start);
  });

  it('/help explains the menu rather than listing commands', async () => {
    const res = (await makeService().handleUpdate(msg('/help'))) as string;
    expect(res).toContain('Как пользоваться');
    expect(res).not.toContain('/tickets');
    expect(res).not.toContain('/ticket ');
    expect(res).not.toContain('/open');
  });

  it('/status still answers for operators', async () => {
    const res = (await makeService().handleUpdate(msg('/status'))) as string;
    expect(res).toContain('бот онлайн');
  });

  it('includes the application link when a frontend URL is configured', async () => {
    const res = (await makeService().handleUpdate(msg('/start'))) as string;
    expect(res).toContain('https://sm.example/max');
  });
});

describe('MaxBotCommandService — unknown input is never silent', () => {
  it('unknown command returns the menu', async () => {
    const res = (await makeService().handleUpdate(msg('/wat'))) as string;
    expect(res).not.toBeNull();
    expect(res).toContain('Не понял запрос');
    expect(res).toContain('Сервис Менеджер');
  });

  it('free text returns the menu', async () => {
    const res = (await makeService().handleUpdate(msg('привет'))) as string;
    expect(res).not.toBeNull();
    expect(res).toContain('Не понял запрос');
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
      const res = (await makeService(prisma).handleUpdate(msg(input))) as string;
      expect(res).toContain('Заявки теперь открываются в приложении');
    },
  );

  it.each(['/ticket 123', '/ticket 999999', '/open 1'])(
    '%s discloses nothing about ticket existence',
    async (input) => {
      const res = (await makeService().handleUpdate(msg(input))) as string;
      expect(res).not.toMatch(/не найдена|Заявка №|\d{3,}/);
    },
  );

  it('gives an identical reply for an existing-looking and an absurd ticket number', async () => {
    const a = await makeService().handleUpdate(msg('/ticket 1'));
    const b = await makeService().handleUpdate(msg('/ticket 987654321'));
    expect(a).toBe(b);
  });

  it('never emits requester identity fields', async () => {
    for (const input of ['/tickets', '/ticket 1', '/open 1', '/start', '/help']) {
      const res = (await makeService().handleUpdate(msg(input))) as string;
      expect(res).not.toContain('Заявитель');
      expect(res).not.toContain('Телефон');
    }
  });
});

describe('MaxBotCommandService — unbound identity leaks nothing', () => {
  it('an unbound MAX user gets only linking and help', async () => {
    const res = (await makeService().handleUpdate({
      message: { text: '/start', sender: { user_id: 4242 } },
    })) as string;
    expect(res).toContain('Привязать аккаунт');
    expect(res).not.toContain('Мои заявки');
    expect(res).not.toContain('Требуют приёмки');
  });
});

describe('MaxBotCommandService — text extraction regressions', () => {
  it('reads message.body.text (MAX webhook shape)', async () => {
    const res = (await makeService().handleUpdate({
      message: { body: { mid: 'm1', seq: 1, text: '/status' } },
    })) as string;
    expect(res).toContain('бот онлайн');
  });

  it('reads update.text', async () => {
    const res = (await makeService().handleUpdate({ text: '/status' })) as string;
    expect(res).toContain('бот онлайн');
  });

  it('is case-insensitive', async () => {
    const res = (await makeService().handleUpdate(msg('/START'))) as string;
    expect(res).toContain('Сервис Менеджер');
  });

  it('returns null when message.body is an object without text', async () => {
    expect(await makeService().handleUpdate({ message: { body: { mid: 'm1' } } })).toBeNull();
  });
});
