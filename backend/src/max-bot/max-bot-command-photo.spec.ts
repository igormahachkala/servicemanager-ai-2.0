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

function photoFrom(url = 'https://cdn.example/a.jpg') {
  return {
    message: {
      sender: { user_id: 4242 },
      body: { attachments: [{ type: 'image', payload: { url, size: 12 } }] },
    },
  };
}

function buttonsOf(response: Awaited<ReturnType<MaxBotCommandService['handleUpdate']>>) {
  return response?.attachments?.[0]?.payload.buttons.flat() || [];
}

function makeTechnicianService(overrides: Record<string, unknown> = {}) {
  const identity = {
    resolve: jest.fn().mockResolvedValue({
      resolved: true,
      userId: 'tech-1',
      companyId: 'company-1',
      role: UserRole.TECHNICIAN,
      maxUserId: '4242',
    }),
  };
  const card = {
    id: TICKET_ID,
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
  };
  const workplace = {
    ticketCard: jest.fn().mockResolvedValue({ ok: true, value: card }),
    addMyTicketPhoto: jest.fn().mockResolvedValue({
      ok: true,
      value: { ticketId: TICKET_ID, ticketNumber: 12, count: 2 },
    }),
    completeMyTicket: jest.fn().mockResolvedValue({
      ok: true,
      value: { ...card, statusLabel: 'Ожидает приёмки', canComplete: false },
    }),
    ...overrides,
  };
  const files = {
    download: jest.fn().mockResolvedValue({
      buffer: Buffer.from('jpeg'),
      size: 4,
      mimetype: 'image/jpeg',
      originalname: 'photo.jpg',
    }),
  };
  return {
    identity,
    workplace,
    files,
    service: new MaxBotCommandService(makeForbiddenPrisma(), identity as any, workplace as any, files as any),
  };
}

describe('MaxBotCommandService — ticket photo and complete', () => {
  it('accepts sequential photos and rejects text while waiting', async () => {
    const { service, workplace, files } = makeTechnicianService();
    const prompt = await service.handleUpdate(callback(`tkf:${TICKET_ID}`));
    expect(prompt?.text).toContain('Отправьте фотографию для заявки #12');
    expect(buttonsOf(prompt).map((button) => button.text)).toEqual(['Отмена', 'Меню']);

    const text = await service.handleUpdate(textFrom('это не фото'));
    expect(workplace.addMyTicketPhoto).not.toHaveBeenCalled();
    expect(text?.text).toBe('ожидаю фото');

    const saved = await service.handleUpdate(photoFrom());
    expect(files.download).toHaveBeenCalled();
    expect(workplace.addMyTicketPhoto).toHaveBeenCalled();
    expect(saved?.text).toContain('Фото добавлено к #12');
    expect(saved?.text).toContain('Всего фото: 2');

    const second = await service.handleUpdate(photoFrom('https://cdn.example/b.jpg'));
    expect(workplace.addMyTicketPhoto).toHaveBeenCalledTimes(2);
    expect(second?.text).toContain('Фото добавлено к #12');
  });

  it('completes with report text, optional photo, and skip that hits the kernel', async () => {
    const { service, workplace, files } = makeTechnicianService();
    const report = await service.handleUpdate(callback(`tku:${TICKET_ID}`));
    expect(report?.text).toBe('Опишите выполненные работы');

    const ask = await service.handleUpdate(textFrom('Заменил компрессор'));
    expect(ask?.text).toContain('Добавить фото результата?');
    expect(buttonsOf(ask).map((button) => button.text)).toEqual(['Добавить фото', 'Пропустить', 'Отмена', 'Меню']);

    workplace.completeMyTicket.mockResolvedValueOnce({
      ok: false,
      message: 'Нужно хотя бы одно фото результата',
    });
    const skipped = await service.handleUpdate(callback(`tkz:${TICKET_ID}`));
    expect(workplace.completeMyTicket).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'tech-1' }),
      TICKET_ID,
      'Заменил компрессор',
      undefined,
    );
    expect(skipped?.text).toContain('Нужно хотя бы одно фото результата');
    expect(buttonsOf(skipped).map((button) => button.text)).toContain('Добавить фото');

    await service.handleUpdate(callback(`tkq:${TICKET_ID}`));
    const done = await service.handleUpdate(photoFrom());
    expect(files.download).toHaveBeenCalled();
    expect(workplace.completeMyTicket).toHaveBeenLastCalledWith(
      expect.anything(),
      TICKET_ID,
      'Заменил компрессор',
      expect.objectContaining({ mimetype: 'image/jpeg' }),
    );
    expect(done?.text).toContain('Статус: Ожидает приёмки');
    expect(buttonsOf(done).map((button) => button.text)).toEqual(
      expect.arrayContaining(['К заявке', 'Мои заявки', 'Меню']),
    );
  });

  it('does not enter complete when the kernel hid canComplete', async () => {
    const { service, workplace } = makeTechnicianService({
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
    });
    const res = await service.handleUpdate(callback(`tku:${TICKET_ID}`));
    expect(workplace.completeMyTicket).not.toHaveBeenCalled();
    expect(res?.text).toContain('Заявка #12');
    expect(buttonsOf(res).map((button) => button.text)).not.toContain('Завершить');
  });

  it('accepts several photos in one MAX message', async () => {
    const { service, workplace, files } = makeTechnicianService();
    workplace.addMyTicketPhoto
      .mockResolvedValueOnce({ ok: true, value: { ticketId: TICKET_ID, ticketNumber: 12, count: 1 } })
      .mockResolvedValueOnce({ ok: true, value: { ticketId: TICKET_ID, ticketNumber: 12, count: 2 } });
    await service.handleUpdate(callback(`tkf:${TICKET_ID}`));
    const saved = await service.handleUpdate({
      message: {
        sender: { user_id: 4242 },
        body: {
          attachments: [
            { type: 'image', payload: { url: 'https://cdn.example/a.jpg', size: 12 } },
            { type: 'image', payload: { url: 'https://cdn.example/b.jpg', size: 12 } },
          ],
        },
      },
    });
    expect(files.download).toHaveBeenCalledTimes(2);
    expect(workplace.addMyTicketPhoto).toHaveBeenCalledTimes(2);
    expect(saved?.text).toContain('Всего фото: 2');
  });

  it('uploads extra complete photos then finishes with the last file', async () => {
    const { service, workplace } = makeTechnicianService();
    await service.handleUpdate(callback(`tku:${TICKET_ID}`));
    await service.handleUpdate(textFrom('Заменил компрессор'));
    await service.handleUpdate(callback(`tkq:${TICKET_ID}`));
    const done = await service.handleUpdate({
      message: {
        sender: { user_id: 4242 },
        body: {
          attachments: [
            { type: 'image', payload: { url: 'https://cdn.example/a.jpg', size: 12 } },
            { type: 'image', payload: { url: 'https://cdn.example/b.jpg', size: 12 } },
          ],
        },
      },
    });
    expect(workplace.addMyTicketPhoto).toHaveBeenCalledTimes(1);
    expect(workplace.completeMyTicket).toHaveBeenCalledWith(
      expect.anything(),
      TICKET_ID,
      'Заменил компрессор',
      expect.objectContaining({ mimetype: 'image/jpeg' }),
    );
    expect(done?.text).toContain('Статус: Ожидает приёмки');
  });
});
