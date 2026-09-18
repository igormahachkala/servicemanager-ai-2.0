import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TicketStatus, UserRole } from '@prisma/client';

import { MaxTechnicianWorkplaceService } from './max-technician-workplace.service';

const technician = {
  resolved: true as const,
  userId: 'tech-1',
  companyId: 'company-1',
  role: UserRole.TECHNICIAN,
  maxUserId: '4242',
};

function makePrisma() {
  return {
    userPermission: { findFirst: jest.fn().mockResolvedValue(null) },
  };
}

describe('MaxTechnicianWorkplaceService', () => {
  it('counts assigned active tickets, overdue and today rounds without a new aggregator', async () => {
    const now = new Date('2026-09-17T12:00:00.000Z');
    const workforce = {
      getMyState: jest.fn().mockResolvedValue({
        company: { timezone: 'UTC' },
        shift: { openedAt: new Date('2026-09-17T09:00:00.000Z'), closedAt: null, corrections: [] },
        runningWorkLog: { ticket: { location: { name: 'Склад' } } },
        serverNow: now,
      }),
    };
    const tickets = {
      list: jest.fn().mockResolvedValue([
        {
          assignedTechnicianId: 'tech-1',
          status: TicketStatus.IN_PROGRESS,
          slaDueAt: new Date('2026-09-17T10:00:00.000Z'),
          requesterPhone: '79990001122',
        },
        {
          assignedTechnicianId: 'tech-1',
          status: TicketStatus.DONE,
          slaDueAt: new Date('2026-09-16T10:00:00.000Z'),
        },
        { assignedTechnicianId: 'other', status: TicketStatus.NEW, slaDueAt: null },
      ]),
    };
    const inspection = {
      listRuns: jest.fn().mockResolvedValue([
        { id: 'run-1', createdAt: new Date('2026-09-17T08:00:00.000Z') },
        { id: 'run-2', createdAt: new Date('2026-09-17T11:00:00.000Z') },
        { id: 'run-old', createdAt: new Date('2026-09-16T11:00:00.000Z') },
      ]),
    };
    const service = new MaxTechnicianWorkplaceService(
      makePrisma() as any,
      workforce as any,
      tickets as any,
      inspection as any,
    );

    const today = await service.today(technician);
    expect(today).toEqual({
      ok: true,
      value: {
        shiftOpen: true,
        shiftOpenedLabel: expect.stringContaining('09:00'),
        myActiveCount: 1,
        overdueCount: 1,
        roundsTodayCount: 2,
      },
    });
    expect(tickets.list).toHaveBeenCalledWith('company-1', 'tech-1', UserRole.TECHNICIAN, undefined, {
      canTechnicianViewAllCompanyTickets: false,
    });
    expect(inspection.listRuns).toHaveBeenCalledWith({
      id: 'tech-1',
      companyId: 'company-1',
      role: UserRole.TECHNICIAN,
    });

    const shift = await service.shift(technician);
    expect(shift).toEqual({
      ok: true,
      value: { open: true, openedLabel: expect.stringContaining('09:00'), locationName: 'Склад' },
    });
  });

  it('opens and closes through WorkforceService', async () => {
    const workforce = {
      getMyState: jest.fn(),
      openShift: jest.fn().mockResolvedValue({
        company: { timezone: 'UTC' },
        shift: { openedAt: new Date('2026-09-17T09:00:00.000Z'), closedAt: null, corrections: [] },
        runningWorkLog: null,
        serverNow: new Date(),
      }),
      closeShift: jest.fn().mockResolvedValue({
        company: { timezone: 'UTC' },
        shift: null,
        runningWorkLog: null,
        serverNow: new Date(),
      }),
    };
    const service = new MaxTechnicianWorkplaceService(
      makePrisma() as any,
      workforce as any,
      { list: jest.fn() } as any,
      { listRuns: jest.fn() } as any,
    );

    await expect(service.openShift(technician)).resolves.toMatchObject({
      ok: true,
      value: { open: true },
    });
    await expect(service.closeShift(technician)).resolves.toEqual({
      ok: true,
      value: { open: false, openedLabel: null, locationName: null },
    });
    expect(workforce.openShift).toHaveBeenCalled();
    expect(workforce.closeShift).toHaveBeenCalled();
  });

  it('lists assigned active tickets oldest first and drops free NEW plus phones', async () => {
    const tickets = {
      list: jest.fn().mockResolvedValue([
        {
          id: '22222222-2222-4222-8222-222222222222',
          ticketNumber: 22,
          assignedTechnicianId: 'tech-1',
          status: TicketStatus.ASSIGNED,
          createdAt: '2026-09-16T10:00:00Z',
          urgency: 'URGENT',
          problemText: 'Позже',
          requesterPhone: '79990001122',
          location: { name: 'Склад' },
        },
        {
          id: '11111111-1111-4111-8111-111111111111',
          ticketNumber: 11,
          assignedTechnicianId: 'tech-1',
          status: TicketStatus.IN_PROGRESS,
          createdAt: '2026-09-15T10:00:00Z',
          urgency: 'NOT_URGENT',
          problemText: 'Раньше',
          location: { name: 'Кухня' },
        },
        {
          id: '99999999-9999-4999-8999-999999999999',
          ticketNumber: 99,
          assignedTechnicianId: null,
          status: TicketStatus.NEW,
          createdAt: '2026-09-14T10:00:00Z',
          problemText: 'Свободная',
        },
        {
          id: '88888888-8888-4888-8888-888888888888',
          ticketNumber: 88,
          assignedTechnicianId: 'tech-1',
          status: TicketStatus.DONE,
          createdAt: '2026-09-13T10:00:00Z',
          problemText: 'Готово',
        },
      ]),
    };
    const service = new MaxTechnicianWorkplaceService(
      makePrisma() as any,
      { getMyState: jest.fn() } as any,
      tickets as any,
      { listRuns: jest.fn() } as any,
    );

    const page = await service.myTickets(technician, 0);
    expect(page).toEqual({
      ok: true,
      value: {
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            ticketNumber: 11,
            locationName: 'Кухня',
            problemText: 'Раньше',
            urgencyLabel: 'Не срочно',
            statusLabel: 'В работе',
          },
          {
            id: '22222222-2222-4222-8222-222222222222',
            ticketNumber: 22,
            locationName: 'Склад',
            problemText: 'Позже',
            urgencyLabel: 'Срочно',
            statusLabel: 'Назначена',
          },
        ],
        nextOffset: null,
      },
    });
    expect(JSON.stringify(page)).not.toContain('7999');
    expect(tickets.list).toHaveBeenCalledWith('company-1', 'tech-1', UserRole.TECHNICIAN, undefined, {
      canTechnicianViewAllCompanyTickets: false,
    });
  });

  it('pages five at a time through TicketsService.list', async () => {
    const tickets = {
      list: jest.fn().mockResolvedValue(
        Array.from({ length: 6 }, (_, i) => ({
          id: `${i}1111111-1111-4111-8111-111111111111`,
          ticketNumber: i + 1,
          assignedTechnicianId: 'tech-1',
          status: TicketStatus.ASSIGNED,
          createdAt: `2026-09-0${i + 1}T10:00:00Z`,
          problemText: `t${i + 1}`,
          location: { name: 'A' },
        })),
      ),
    };
    const service = new MaxTechnicianWorkplaceService(
      makePrisma() as any,
      { getMyState: jest.fn() } as any,
      tickets as any,
      { listRuns: jest.fn() } as any,
    );
    const first = await service.myTickets(technician, 0);
    const second = await service.myTickets(technician, 5);
    expect(first.ok && first.value.items.map((item) => item.ticketNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(first.ok && first.value.nextOffset).toBe(5);
    expect(second.ok && second.value.items.map((item) => item.ticketNumber)).toEqual([6]);
    expect(second.ok && second.value.nextOffset).toBeNull();
  });

  it('loads a card through getOne and starts work through status + work log', async () => {
    const cardTicket = {
      id: '11111111-1111-4111-8111-111111111111',
      ticketNumber: 11,
      status: TicketStatus.ASSIGNED,
      urgency: 'URGENT',
      problemText: 'Капает',
      requesterPhone: '79990001122',
      location: { name: 'Кухня' },
      problemCategory: { name: 'Сантехника' },
      equipment: { name: 'Кран' },
      assignedTechnician: { firstName: 'Виктор' },
      meta: {
        availableActions: { canStart: true, canComplete: false, canAccept: true },
        availableStatusTransitions: [TicketStatus.IN_PROGRESS],
      },
    };
    const tickets = {
      list: jest.fn(),
      getOne: jest
        .fn()
        .mockResolvedValueOnce(cardTicket)
        .mockResolvedValueOnce(cardTicket)
        .mockResolvedValueOnce({
          ...cardTicket,
          status: TicketStatus.IN_PROGRESS,
          meta: {
            availableActions: { canStart: false, canComplete: true },
            availableStatusTransitions: [TicketStatus.DONE],
          },
        }),
      updateStatus: jest.fn().mockResolvedValue({}),
    };
    const workforce = {
      getMyState: jest.fn(),
      startTicketWork: jest.fn().mockResolvedValue({}),
    };
    const service = new MaxTechnicianWorkplaceService(
      makePrisma() as any,
      workforce as any,
      tickets as any,
      { listRuns: jest.fn() } as any,
    );

    const opened = await service.ticketCard(technician, cardTicket.id);
    expect(opened.ok && opened.value.canStart).toBe(true);
    expect(JSON.stringify(opened)).not.toContain('7999');
    expect(tickets.getOne).toHaveBeenCalledWith(
      'company-1',
      'tech-1',
      UserRole.TECHNICIAN,
      cardTicket.id,
      { canTechnicianViewAllCompanyTickets: false },
    );

    const started = await service.startMyTicket(technician, cardTicket.id);
    expect(tickets.updateStatus).toHaveBeenCalledWith(
      'company-1',
      expect.objectContaining({ id: 'tech-1', role: UserRole.TECHNICIAN }),
      UserRole.TECHNICIAN,
      cardTicket.id,
      { status: TicketStatus.IN_PROGRESS },
    );
    expect(workforce.startTicketWork).toHaveBeenCalled();
    expect(started.ok && started.value.statusLabel).toBe('В работе');
    expect(started.ok && started.value.canComplete).toBe(true);
  });

  it('applies leftover status via updateStatus and reads history via timeline', async () => {
    const cardTicket = {
      id: '11111111-1111-4111-8111-111111111111',
      ticketNumber: 11,
      status: TicketStatus.IN_PROGRESS,
      problemText: 'Капает',
      location: { name: 'Кухня' },
      assignedTechnician: { firstName: 'Виктор' },
      meta: {
        availableActions: { canStart: false, canComplete: true },
        availableStatusTransitions: [TicketStatus.ASSIGNED, TicketStatus.DONE],
      },
    };
    const tickets = {
      getOne: jest.fn().mockResolvedValue(cardTicket),
      updateStatus: jest.fn().mockResolvedValue({}),
      timeline: jest.fn().mockResolvedValue({
        timeline: [
          {
            at: '2026-09-18T11:00:00Z',
            timelineEvent: 'COMMENT_ADDED',
            payload: { comment: 'На месте' },
            actor: { email: 'hide@me' },
          },
        ],
      }),
    };
    const service = new MaxTechnicianWorkplaceService(
      makePrisma() as any,
      { getMyState: jest.fn() } as any,
      tickets as any,
      { listRuns: jest.fn() } as any,
    );

    const applied = await service.changeMyTicketStatus(technician, cardTicket.id, TicketStatus.ASSIGNED);
    expect(tickets.updateStatus).toHaveBeenCalledWith(
      'company-1',
      expect.objectContaining({ id: 'tech-1' }),
      UserRole.TECHNICIAN,
      cardTicket.id,
      { status: TicketStatus.ASSIGNED },
    );
    expect(applied.ok).toBe(true);

    const skipped = await service.changeMyTicketStatus(technician, cardTicket.id, TicketStatus.DONE);
    expect(tickets.updateStatus).toHaveBeenCalledTimes(1);
    expect(skipped.ok).toBe(true);

    const history = await service.ticketHistory(technician, cardTicket.id, 0);
    expect(tickets.timeline).toHaveBeenCalledWith(
      'company-1',
      'tech-1',
      UserRole.TECHNICIAN,
      cardTicket.id,
      { canTechnicianViewAllCompanyTickets: false },
    );
    expect(history.ok && history.value.items[0]?.title).toBe('Комментарий');
    expect(JSON.stringify(history)).not.toContain('hide@me');
  });

  it('hides missing tickets behind one message', async () => {
    const tickets = {
      getOne: jest.fn().mockRejectedValue(new NotFoundException('Ticket not found')),
    };
    const service = new MaxTechnicianWorkplaceService(
      makePrisma() as any,
      { getMyState: jest.fn() } as any,
      tickets as any,
      { listRuns: jest.fn() } as any,
    );
    await expect(service.ticketCard(technician, '11111111-1111-4111-8111-111111111111')).resolves.toEqual({
      ok: false,
      message: 'Заявка недоступна',
    });
  });

  it('posts a comment through TicketsService.addComment', async () => {
    const cardTicket = {
      id: '11111111-1111-4111-8111-111111111111',
      ticketNumber: 11,
      status: TicketStatus.IN_PROGRESS,
      problemText: 'Капает',
      location: { name: 'Кухня' },
      assignedTechnician: { firstName: 'Виктор' },
      meta: { availableActions: { canStart: false, canComplete: true }, availableStatusTransitions: [] },
    };
    const tickets = {
      getOne: jest.fn().mockResolvedValue(cardTicket),
      addComment: jest.fn().mockResolvedValue({ ok: true }),
    };
    const service = new MaxTechnicianWorkplaceService(
      makePrisma() as any,
      { getMyState: jest.fn() } as any,
      tickets as any,
      { listRuns: jest.fn() } as any,
    );

    await expect(service.addMyTicketComment(technician, cardTicket.id, 'На месте')).resolves.toEqual({
      ok: true,
      value: { ticketId: cardTicket.id, ticketNumber: 11 },
    });
    expect(tickets.addComment).toHaveBeenCalledWith(
      'company-1',
      expect.objectContaining({ id: 'tech-1', role: UserRole.TECHNICIAN }),
      UserRole.TECHNICIAN,
      cardTicket.id,
      { comment: 'На месте' },
    );
  });

  it('uploads a work-report photo through TicketsService and counts media', async () => {
    const cardTicket = {
      id: '11111111-1111-4111-8111-111111111111',
      ticketNumber: 11,
      status: TicketStatus.IN_PROGRESS,
      problemText: 'Капает',
      location: { name: 'Кухня' },
      assignedTechnician: { firstName: 'Виктор' },
      meta: { availableActions: { canStart: false, canComplete: true }, availableStatusTransitions: [] },
    };
    const file = { buffer: Buffer.from('jpeg'), size: 4, mimetype: 'image/jpeg', originalname: 'photo.jpg' };
    const tickets = {
      getOne: jest.fn().mockResolvedValue(cardTicket),
      uploadTicketAttachment: jest.fn().mockResolvedValue({ id: 'att-1' }),
      listAttachments: jest.fn().mockResolvedValue([
        { mimeType: 'image/jpeg' },
        { mimeType: 'application/pdf' },
      ]),
    };
    const service = new MaxTechnicianWorkplaceService(
      makePrisma() as any,
      { getMyState: jest.fn() } as any,
      tickets as any,
      { listRuns: jest.fn() } as any,
    );

    await expect(service.addMyTicketPhoto(technician, cardTicket.id, file)).resolves.toEqual({
      ok: true,
      value: { ticketId: cardTicket.id, ticketNumber: 11, count: 1 },
    });
    expect(tickets.uploadTicketAttachment).toHaveBeenCalledWith(
      'company-1',
      'tech-1',
      UserRole.TECHNICIAN,
      cardTicket.id,
      file,
      { canTechnicianViewAllCompanyTickets: false },
    );
  });

  it('completes through updateStatus DONE plus work-log stop, and maps missing photo', async () => {
    const cardTicket = {
      id: '11111111-1111-4111-8111-111111111111',
      ticketNumber: 11,
      status: TicketStatus.IN_PROGRESS,
      problemText: 'Капает',
      location: { name: 'Кухня' },
      assignedTechnician: { firstName: 'Виктор' },
      meta: {
        availableActions: { canStart: false, canComplete: true },
        availableStatusTransitions: [TicketStatus.DONE],
      },
    };
    const doneTicket = {
      ...cardTicket,
      status: TicketStatus.AWAITING_ACCEPTANCE,
      meta: { availableActions: { canStart: false, canComplete: false }, availableStatusTransitions: [] },
    };
    const tickets = {
      getOne: jest.fn().mockResolvedValueOnce(cardTicket).mockResolvedValueOnce(doneTicket),
      updateStatus: jest.fn().mockResolvedValue({}),
    };
    const workforce = { getMyState: jest.fn(), stopTicketWork: jest.fn().mockResolvedValue({}) };
    const service = new MaxTechnicianWorkplaceService(
      makePrisma() as any,
      workforce as any,
      tickets as any,
      { listRuns: jest.fn() } as any,
    );

    const done = await service.completeMyTicket(technician, cardTicket.id, 'Починил');
    expect(tickets.updateStatus).toHaveBeenCalledWith(
      'company-1',
      expect.objectContaining({ id: 'tech-1' }),
      UserRole.TECHNICIAN,
      cardTicket.id,
      { status: TicketStatus.DONE, comment: 'Починил' },
    );
    expect(workforce.stopTicketWork).toHaveBeenCalled();
    expect(done.ok && done.value.statusLabel).toBe('Ожидает приёмки');

    tickets.updateStatus.mockRejectedValueOnce(
      new BadRequestException('Cannot complete ticket without at least 1 work report photo or video'),
    );
    tickets.getOne.mockResolvedValue(cardTicket);
    await expect(service.completeMyTicket(technician, cardTicket.id, 'Починил')).resolves.toEqual({
      ok: false,
      message: 'Нужно хотя бы одно фото результата',
    });
  });
});
