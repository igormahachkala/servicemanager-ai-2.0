import { TicketStatus } from '@prisma/client';

import { MaxBotService } from './max-bot.service';

/**
 * MAX печатает строку локации, посчитанную в notifications, и своего формата
 * не строит. Отправку подменяем: проверяется только текст сообщения.
 */
describe('MaxBotService location line', () => {
  function makeService() {
    const service = new MaxBotService();
    const sent: string[] = [];
    jest.spyOn(service as any, 'sendLocationReplyNotification').mockImplementation(async (params: any) => {
      sent.push(typeof params.message === 'string' ? params.message : params.message.text);
      return {};
    });
    return { service, sent };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('новая заявка: «Точка» берёт канонический контекст, а не имя точки', async () => {
    const { service, sent } = makeService();

    await service.sendTicketCreatedMessage({
      companyId: 'company-1',
      locationId: 'location-1',
      locationContext: 'Уфа · Фудзияма',
      ticketId: 'ticket-1',
      ticketNumber: 1001,
      pointName: 'Фудзияма',
      address: 'Проспект Октября, 1',
      description: 'Не работает касса',
    });

    expect(sent[0]).toContain('Точка: Уфа · Фудзияма');
    expect(sent[0]).not.toContain('Точка: Фудзияма\n');
  });

  it('новая заявка без контекста: остаётся прежний порядок падения', async () => {
    const { service, sent } = makeService();

    await service.sendTicketCreatedMessage({
      companyId: 'company-1',
      locationId: 'location-1',
      locationContext: null,
      ticketId: 'ticket-1',
      ticketNumber: 1001,
      pointName: 'Фудзияма',
      address: 'Проспект Октября, 1',
      description: 'Не работает касса',
    });

    expect(sent[0]).toContain('Точка: Фудзияма');
  });

  it('назначение, взятие в работу и смена статуса получают ту же строку', async () => {
    const { service, sent } = makeService();

    await service.sendTicketAssignedMessage({
      companyId: 'company-1',
      locationId: 'location-1',
      locationContext: 'Уфа · Фудзияма',
      ticketId: 'ticket-1',
      ticketNumber: 1001,
      technicianLabel: 'Иван Техников',
    });
    await service.sendTicketClaimedMessage({
      companyId: 'company-1',
      locationId: 'location-1',
      locationContext: 'Уфа · Фудзияма',
      ticketId: 'ticket-1',
      ticketNumber: 1001,
      technicianLabel: 'Иван Техников',
    });
    await service.sendTicketStatusChangedMessage({
      companyId: 'company-1',
      locationId: 'location-1',
      locationContext: 'Уфа · Фудзияма',
      ticketId: 'ticket-1',
      ticketNumber: 1001,
      fromStatus: TicketStatus.NEW,
      toStatus: TicketStatus.IN_PROGRESS,
    });

    expect(sent).toHaveLength(3);
    for (const message of sent) {
      expect(message).toContain('Точка: Уфа · Фудзияма');
    }
  });

  it('локации нет: строка «Точка» не печатается и сообщение не ломается', async () => {
    const { service, sent } = makeService();

    await service.sendTicketStatusChangedMessage({
      companyId: 'company-1',
      locationId: 'location-1',
      locationContext: null,
      locationName: null,
      ticketId: 'ticket-1',
      ticketNumber: 1001,
      fromStatus: TicketStatus.NEW,
      toStatus: TicketStatus.IN_PROGRESS,
    });

    expect(sent[0]).not.toContain('Точка:');
    expect(sent[0]).toContain('🔄 Статус заявки изменён');
  });
});
