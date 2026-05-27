import { MaxBotCommandService } from './max-bot-command.service';

const makeUpdate = (text: string) => ({
  update_type: 'message_created',
  message: { text, chat_id: 123 },
});

describe('MaxBotCommandService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.FRONTEND_URL;
    delete process.env.MAX_PUBLIC_FRONTEND_URL;
  });

  it('returns help text for /help', async () => {
    const service = new MaxBotCommandService();
    const result = await service.handleUpdate(makeUpdate('/help'));
    expect(result).toContain('/tickets');
    expect(result).toContain('/ticket');
    expect(result).toContain('/open');
    expect(result).toContain('/status');
  });

  it('returns status for /status', async () => {
    const service = new MaxBotCommandService();
    const result = await service.handleUpdate(makeUpdate('/status'));
    expect(result).toContain('онлайн');
    expect(result).toContain('Время:');
    expect(result).toContain('Среда:');
  });

  it('returns null for non-command text', async () => {
    const service = new MaxBotCommandService();
    expect(await service.handleUpdate(makeUpdate('Привет, мир!'))).toBeNull();
  });

  it('returns null for unknown command', async () => {
    const service = new MaxBotCommandService();
    expect(await service.handleUpdate(makeUpdate('/unknown'))).toBeNull();
  });

  it('returns null for update without message text', async () => {
    const service = new MaxBotCommandService();
    expect(await service.handleUpdate({ update_type: 'message_created' })).toBeNull();
  });

  it('returns ticket list for /tickets', async () => {
    const prisma = {
      ticket: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'abc', ticketNumber: 7, status: 'NEW', problemText: 'Сломалась дверь', location: { name: 'Кофейня' } },
          { id: 'def', ticketNumber: 8, status: 'IN_PROGRESS', problemText: 'Нет света', location: { name: 'Офис' } },
        ]),
      },
    };
    const service = new MaxBotCommandService(prisma as any);
    const result = await service.handleUpdate(makeUpdate('/tickets'));
    expect(result).toContain('#7');
    expect(result).toContain('#8');
    expect(result).toContain('Кофейня');
    expect(result).toContain('Новая');
    expect(result).toContain('В работе');
  });

  it('returns "no open tickets" message when list is empty', async () => {
    const prisma = { ticket: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new MaxBotCommandService(prisma as any);
    const result = await service.handleUpdate(makeUpdate('/tickets'));
    expect(result).toContain('нет');
  });

  it('returns "db unavailable" for /tickets without prisma', async () => {
    const service = new MaxBotCommandService();
    const result = await service.handleUpdate(makeUpdate('/tickets'));
    expect(result).toContain('недоступна');
  });

  it('returns ticket detail for /ticket <n>', async () => {
    process.env.FRONTEND_URL = 'https://servicemanagerai.ru';
    const prisma = {
      ticket: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ticket-abc',
          ticketNumber: 42,
          status: 'IN_PROGRESS',
          problemText: 'Не работает кондиционер',
          requesterName: 'Иван Иванов',
          requesterPhone: '+7 999 000-00-00',
          location: { name: 'Офис 1' },
          problemCategory: { name: 'Климат' },
        }),
      },
    };
    const service = new MaxBotCommandService(prisma as any);
    const result = await service.handleUpdate(makeUpdate('/ticket 42'));
    expect(result).toContain('#42');
    expect(result).toContain('В работе');
    expect(result).toContain('Иван Иванов');
    expect(result).toContain('+7 999 000-00-00');
    expect(result).toContain('Климат');
    expect(result).toContain('Офис 1');
    expect(result).toContain('https://servicemanagerai.ru/m/tickets/ticket-abc');
  });

  it('returns error for /ticket without number', async () => {
    const service = new MaxBotCommandService();
    const result = await service.handleUpdate(makeUpdate('/ticket'));
    expect(result).toContain('/ticket 123');
  });

  it('returns "not found" for /ticket with unknown number', async () => {
    const prisma = { ticket: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new MaxBotCommandService(prisma as any);
    const result = await service.handleUpdate(makeUpdate('/ticket 999'));
    expect(result).toContain('не найдена');
  });

  it('returns link for /open <n>', async () => {
    process.env.FRONTEND_URL = 'https://servicemanagerai.ru';
    const prisma = {
      ticket: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ticket-xyz', ticketNumber: 5 }),
      },
    };
    const service = new MaxBotCommandService(prisma as any);
    const result = await service.handleUpdate(makeUpdate('/open 5'));
    expect(result).toContain('#5');
    expect(result).toContain('https://servicemanagerai.ru/m/tickets/ticket-xyz');
  });

  it('returns error for /open without number', async () => {
    const service = new MaxBotCommandService();
    const result = await service.handleUpdate(makeUpdate('/open'));
    expect(result).toContain('/open 123');
  });

  it('returns "not found" for /open with unknown number', async () => {
    const prisma = { ticket: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new MaxBotCommandService(prisma as any);
    const result = await service.handleUpdate(makeUpdate('/open 404'));
    expect(result).toContain('не найдена');
  });

  it('extracts text from update.text when message is absent', async () => {
    const service = new MaxBotCommandService();
    const result = await service.handleUpdate({ update_type: 'message_created', text: '/help' });
    expect(result).toContain('/tickets');
  });

  it('handles command case-insensitively', async () => {
    const service = new MaxBotCommandService();
    const result = await service.handleUpdate(makeUpdate('/HELP'));
    expect(result).toContain('/tickets');
  });
});
