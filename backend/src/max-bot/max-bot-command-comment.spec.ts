import { UserRole } from '@prisma/client';

import { MaxBotCommandService } from './max-bot-command.service';

const TICKET_ID = '11111111-1111-4111-8111-111111111111';

function makeForbiddenPrisma() {
  const boom = () => {
    throw new Error('ticket data must never be read from a MAX command');
  };
  return {
    ticket: { findMany: boom, findUnique: boom, findFirst: boom, count: boom },
    maxUserBinding: { findUnique: jest.fn().mockResolvedValue(null) },
  } as any;
}

function callback(payload: string) {
  return {
    callback: {
      callback_id: 'cb-1',
      payload,
      message: { recipient: { chat_id: -100 }, body: { text: 'card' } },
      user: { user_id: 4242 },
    },
  };
}

function textFrom(text: string) {
  return { message: { text, sender: { user_id: 4242 } } };
}

function buttonsOf(response: Awaited<ReturnType<MaxBotCommandService['handleUpdate']>>) {
  return response?.attachments?.[0]?.payload.buttons.flat() || [];
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
  const workplace = {
    ticketCard: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        id: TICKET_ID,
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
    addMyTicketComment: jest.fn().mockResolvedValue({
      ok: true,
      value: { ticketId: TICKET_ID, ticketNumber: 12 },
    }),
    myTickets: jest.fn().mockResolvedValue({ ok: true, value: { items: [], nextOffset: null } }),
  };
  return {
    identity,
    workplace,
    service: new MaxBotCommandService(makeForbiddenPrisma(), identity as any, workplace as any),
  };
}

describe('MaxBotCommandService — ticket comment', () => {
  it('asks for text, posts through addComment, then confirms', async () => {
    const { service, workplace } = makeTechnicianService();
    const prompt = await service.handleUpdate(callback(`tkc:${TICKET_ID}`));
    expect(workplace.ticketCard).toHaveBeenCalled();
    expect(prompt?.text).toBe('Введите комментарий к заявке #12');
    expect(buttonsOf(prompt).map((button) => button.text)).toEqual(['Отмена']);

    const blank = await service.handleUpdate(textFrom('   '));
    expect(workplace.addMyTicketComment).not.toHaveBeenCalled();
    expect(blank?.text).toBe('Введите комментарий к заявке #12');

    const saved = await service.handleUpdate(textFrom('Проверил компрессор'));
    expect(workplace.addMyTicketComment).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'tech-1', companyId: 'company-1' }),
      TICKET_ID,
      'Проверил компрессор',
    );
    expect(saved?.text).toBe('Комментарий добавлен к #12');
    expect(buttonsOf(saved).map((button) => button.text)).toContain('К заявке');
  });

  it('cancel and a menu item drop the pending comment without posting', async () => {
    const { service, workplace } = makeTechnicianService();
    await service.handleUpdate(callback(`tkc:${TICKET_ID}`));
    const cancel = await service.handleUpdate(callback(`tk:${TICKET_ID}`));
    expect(cancel?.text).toContain('Заявка #12');
    expect(workplace.addMyTicketComment).not.toHaveBeenCalled();

    await service.handleUpdate(callback(`tkc:${TICKET_ID}`));
    const menu = await service.handleUpdate(textFrom('Мои заявки'));
    expect(workplace.myTickets).toHaveBeenCalled();
    expect(menu?.text).toContain('Мои заявки');
    const leftover = await service.handleUpdate(textFrom('Это уже не комментарий'));
    expect(workplace.addMyTicketComment).not.toHaveBeenCalled();
    expect(leftover?.text).toBe('Не понял запрос.');
  });

  it('/test does not consume the pending comment', async () => {
    const { service, workplace, identity } = makeTechnicianService();
    await service.handleUpdate(callback(`tkc:${TICKET_ID}`));
    const resolveCalls = identity.resolve.mock.calls.length;
    const test = await service.handleUpdate(textFrom('/test'));
    expect(identity.resolve.mock.calls.length).toBe(resolveCalls);
    expect(test?.text).toMatch(/^Время сервера: /);
    const saved = await service.handleUpdate(textFrom('После теста'));
    expect(workplace.addMyTicketComment).toHaveBeenCalledWith(
      expect.anything(),
      TICKET_ID,
      'После теста',
    );
    expect(saved?.text).toBe('Комментарий добавлен к #12');
  });
});
