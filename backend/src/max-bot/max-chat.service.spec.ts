import { UserRole } from '@prisma/client';

import { MaxChatService } from './max-chat.service';

function buttonsOf(response: Awaited<ReturnType<MaxChatService['handleMenu']>>) {
  return response.attachments?.[0]?.payload.buttons.flat().map((button) => button.text) || [];
}

function boundIdentity(role: UserRole = UserRole.TECHNICIAN) {
  return {
    resolve: jest.fn().mockResolvedValue({
      resolved: true,
      userId: 'u1',
      companyId: 'c1',
      role,
      maxUserId: '1',
    }),
  };
}

function ticket(partial: Record<string, unknown>) {
  return {
    ticketNumber: 1,
    status: 'ASSIGNED',
    assignedTechnicianId: 'u1',
    location: { name: 'Точка А' },
    problemText: 'Сломался холодильник',
    createdAt: '2026-09-15T10:00:00.000Z',
    ...partial,
  };
}

describe('MaxChatService menu', () => {
  it('unbound viewer gets the linking menu, not technician actions', async () => {
    const identity = { resolve: jest.fn().mockResolvedValue({ resolved: false, reason: 'not_bound' }) };
    const chat = new MaxChatService(identity as any);
    const res = await chat.handleMenu({ message: { text: '/start', sender: { user_id: 1 } } });
    expect(buttonsOf(res)).toEqual(['Открыть ServiceManager', 'Помощь']);
    expect(res.text).not.toContain('Мои заявки');
  });

  it('bound technician gets the six chat actions', async () => {
    const chat = new MaxChatService(boundIdentity() as any);
    const res = await chat.handleMenu({ message: { text: '/start', sender: { user_id: 1 } } });
    expect(buttonsOf(res)).toEqual([
      'Сегодня',
      'Мои заявки',
      'Доступные',
      'Обходы',
      'Моя смена',
      'Поиск заявки',
    ]);
  });

  it('bound client is treated as unbound and does not see others tickets', async () => {
    const chat = new MaxChatService(boundIdentity(UserRole.CLIENT) as any);
    const res = await chat.handleCallback(
      { callback: { payload: 'my', user: { user_id: 1 } } },
      'my',
    );
    expect(buttonsOf(res!)).toEqual(['Открыть ServiceManager', 'Помощь']);
    expect(res?.text).not.toContain('№');
  });
});

describe('MaxChatService today', () => {
  const update = { callback: { payload: 'today', user: { user_id: 1 } }, message: { sender: { user_id: 1 } } };

  it('today composes shift, own tickets, available and rounds', async () => {
    const tickets = {
      list: jest.fn().mockResolvedValue([
        ticket({ ticketNumber: 10 }),
        ticket({ ticketNumber: 11, assignedTechnicianId: 'other' }),
      ]),
      availableForTechnician: jest.fn().mockResolvedValue([ticket({ ticketNumber: 20, status: 'NEW', assignedTechnicianId: null })]),
    };
    const workforce = {
      getMyState: jest.fn().mockResolvedValue({
        company: { timezone: 'Europe/Moscow' },
        shift: { openedAt: '2026-09-16T05:00:00.000Z' },
        runningWorkLog: null,
      }),
    };
    const inspection = { list: jest.fn().mockResolvedValue([{ name: 'Холод', location: { name: 'Точка А' } }]) };
    const chat = new MaxChatService(boundIdentity() as any, tickets as any, workforce as any, inspection as any);
    const res = await chat.handleCallback(update, 'today');
    expect(res?.text).toContain('Сегодня');
    expect(res?.text).toContain('Смена: открыта с');
    expect(res?.text).toContain('Мои заявки: 1');
    expect(res?.text).toContain('Доступные: 1');
    expect(res?.text).toContain('Обходы: 1');
    expect(tickets.list).toHaveBeenCalledWith('c1', 'u1', UserRole.TECHNICIAN);
  });
});

describe('MaxChatService my tickets', () => {
  const update = { callback: { payload: 'my', user: { user_id: 1 } }, message: { sender: { user_id: 1 } } };

  it('shows five oldest assigned active cards and a next button', async () => {
    const rows = Array.from({ length: 6 }, (_, index) =>
      ticket({
        ticketNumber: index + 1,
        createdAt: `2026-09-${10 + index}T10:00:00.000Z`,
      }),
    );
    const tickets = { list: jest.fn().mockResolvedValue(rows), availableForTechnician: jest.fn() };
    const chat = new MaxChatService(boundIdentity() as any, tickets as any);
    const first = await chat.handleCallback(update, 'my');
    expect(first?.text).toContain('№1');
    expect(first?.text).toContain('№5');
    expect(first?.text).not.toContain('№6');
    expect(buttonsOf(first!)).toContain('Следующие');
    const next = await chat.handleCallback(update, 'my:5');
    expect(next?.text).toContain('№6');
    expect(next?.text).not.toContain('№1');
  });
});

describe('MaxChatService available', () => {
  const update = { callback: { payload: 'avail', user: { user_id: 1 } }, message: { sender: { user_id: 1 } } };

  it('comes from availableForTechnician, not from the mixed list', async () => {
    const tickets = {
      list: jest.fn().mockResolvedValue([ticket({ ticketNumber: 1 })]),
      availableForTechnician: jest.fn().mockResolvedValue([
        ticket({ ticketNumber: 88, status: 'NEW', assignedTechnicianId: null, problemText: 'Кран' }),
      ]),
    };
    const chat = new MaxChatService(boundIdentity() as any, tickets as any);
    const res = await chat.handleCallback(update, 'avail');
    expect(res?.text).toContain('№88');
    expect(res?.text).not.toContain('№1');
    expect(tickets.list).not.toHaveBeenCalled();
  });
});
