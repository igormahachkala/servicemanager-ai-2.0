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

describe('MaxChatService rounds', () => {
  const update = { callback: { payload: 'rounds', user: { user_id: 1 } }, message: { sender: { user_id: 1 } } };

  it('lists assigned schedules', async () => {
    const inspection = {
      list: jest.fn().mockResolvedValue([
        { name: 'Холод', location: { name: 'Точка А' }, nextDueAt: '2026-09-17T00:00:00.000Z' },
      ]),
    };
    const chat = new MaxChatService(boundIdentity() as any, undefined, undefined, inspection as any);
    const res = await chat.handleCallback(update, 'rounds');
    expect(res?.text).toContain('Холод · Точка А');
    expect(inspection.list).toHaveBeenCalledWith(
      { id: 'u1', companyId: 'c1', role: UserRole.TECHNICIAN },
      { active: 'true' },
    );
  });
});

describe('MaxChatService shift', () => {
  const update = { callback: { payload: 'shift', user: { user_id: 1 } }, message: { sender: { user_id: 1 } } };

  it('offers open when closed and close when open', async () => {
    const workforce = {
      getMyState: jest
        .fn()
        .mockResolvedValueOnce({ company: { timezone: 'Europe/Moscow' }, shift: null, runningWorkLog: null })
        .mockResolvedValue({
          company: { timezone: 'Europe/Moscow' },
          shift: { openedAt: '2026-09-16T05:00:00.000Z' },
          runningWorkLog: { ticket: { ticketNumber: 12 } },
        }),
      openShift: jest.fn().mockResolvedValue({
        company: { timezone: 'Europe/Moscow' },
        shift: { openedAt: '2026-09-16T05:00:00.000Z' },
        runningWorkLog: null,
      }),
      closeShift: jest.fn().mockResolvedValue({ company: { timezone: 'Europe/Moscow' }, shift: null, runningWorkLog: null }),
    };
    const chat = new MaxChatService(boundIdentity() as any, undefined, workforce as any);
    const closed = await chat.handleCallback(update, 'shift');
    expect(closed?.text).toContain('Смена не открыта');
    expect(buttonsOf(closed!)).toContain('Открыть');
    const opened = await chat.handleCallback(update, 'shift_open');
    expect(workforce.openShift).toHaveBeenCalled();
    expect(opened?.text).toContain('Смена открыта с');
    const busy = await chat.handleCallback(update, 'shift');
    expect(busy?.text).toContain('В работе: №12');
    expect(buttonsOf(busy!)).toContain('Закрыть');
  });
});

describe('MaxChatService search', () => {
  const update = { callback: { payload: 'find', user: { user_id: 1 } }, message: { sender: { user_id: 1 } } };

  it('finds a ticket from the canonical list and hides out-of-scope numbers', async () => {
    const tickets = {
      list: jest.fn().mockResolvedValue([ticket({ ticketNumber: 421, problemText: 'Холод' })]),
      availableForTechnician: jest.fn(),
    };
    const chat = new MaxChatService(boundIdentity() as any, tickets as any);
    const prompt = await chat.handleCallback(update, 'find');
    expect(prompt?.text).toContain('Напишите номер заявки');
    const found = await chat.tryHandleText({ message: { text: '421', sender: { user_id: 1 } } }, '421');
    expect(found?.text).toContain('№421');
    expect(found?.text).not.toContain('Заявитель');
    const missing = await chat.tryHandleText({ message: { text: '999', sender: { user_id: 1 } } }, '999');
    expect(missing?.text).toContain('В вашем списке такой заявки нет');
  });
});
