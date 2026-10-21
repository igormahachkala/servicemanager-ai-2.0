import { InspectionRunItemStatus, InspectionRunStatus, UserRole } from '@prisma/client';

import { MaxTechnicianRoundsService } from './max-technician-rounds.service';

const technician = {
  resolved: true as const,
  userId: 'tech-1',
  companyId: 'company-1',
  role: UserRole.TECHNICIAN,
  maxUserId: '4242',
};

const SCHEDULE = '11111111-1111-4111-8111-111111111111';
const RUN = '22222222-2222-4222-8222-222222222222';
const ITEM = '33333333-3333-4333-8333-333333333333';
const TICKET = '44444444-4444-4444-8444-444444444444';

function makeDeps(overrides: Record<string, unknown> = {}) {
  const inspection = {
    listRuns: jest.fn().mockResolvedValue([]),
    listTemplates: jest.fn().mockResolvedValue([{ id: 'tpl-1', items: [{ id: 'ti-1' }, { id: 'ti-2' }] }]),
    startRun: jest.fn(),
    getRun: jest.fn(),
    updateRunItem: jest.fn().mockResolvedValue({}),
    uploadRunItemAttachment: jest.fn().mockResolvedValue({ id: 'att-1' }),
    createTicketFromItem: jest.fn(),
    completeRun: jest.fn(),
    getRunReport: jest.fn(),
  };
  const schedules = {
    list: jest.fn().mockResolvedValue([
      {
        id: SCHEDULE,
        name: 'Утро',
        nextDueAt: new Date('2026-09-18T09:00:00.000Z'),
        template: { id: 'tpl-1', name: 'Утро' },
        location: { id: 'loc-1', name: 'Кафе' },
        equipment: { id: 'eq-1', name: 'Холодильник' },
      },
    ]),
    get: jest.fn().mockResolvedValue({
      id: SCHEDULE,
      name: 'Утро',
      template: { id: 'tpl-1', name: 'Утро' },
      location: { id: 'loc-1', name: 'Кафе' },
      equipment: { id: 'eq-1', name: 'Холодильник' },
    }),
  };
  const workforce = {
    getMyState: jest.fn().mockResolvedValue({
      company: { timezone: 'UTC' },
      serverNow: new Date('2026-09-18T12:00:00.000Z'),
      shift: null,
    }),
  };
  const categories = {
    list: jest.fn().mockResolvedValue([{ id: 'cat-1', isActive: true, name: 'Холод' }]),
  };
  Object.assign(inspection, overrides.inspection || {});
  Object.assign(schedules, overrides.schedules || {});
  Object.assign(categories, overrides.categories || {});
  return {
    inspection,
    schedules,
    workforce,
    categories,
    service: new MaxTechnicianRoundsService(
      inspection as any,
      schedules as any,
      workforce as any,
      categories as any,
    ),
  };
}

describe('MaxTechnicianRoundsService', () => {
  it('lists today assignments through InspectionScheduleService and marks an open run as continue', async () => {
    const { service, schedules, inspection } = makeDeps({
      inspection: {
        listRuns: jest.fn().mockResolvedValue([
          {
            id: RUN,
            status: InspectionRunStatus.IN_PROGRESS,
            location: { id: 'loc-1' },
            template: { id: 'tpl-1' },
          },
        ]),
      },
    });
    const page = await service.list(technician, 0);
    expect(page.ok).toBe(true);
    if (!page.ok) return;
    expect(schedules.list).toHaveBeenCalledWith(
      { id: 'tech-1', companyId: 'company-1', role: UserRole.TECHNICIAN },
      expect.objectContaining({ active: 'true' }),
    );
    expect(inspection.listRuns).toHaveBeenCalled();
    expect(page.value.items).toEqual([
      expect.objectContaining({
        scheduleId: SCHEDULE,
        runId: RUN,
        locationName: 'Кафе',
        name: 'Утро',
        itemCount: 2,
      }),
    ]);
  });

  it('starts a run from the schedule template/location and opens the first pending item', async () => {
    const { service, inspection, schedules } = makeDeps();
    inspection.startRun.mockResolvedValue({ id: RUN });
    inspection.getRun.mockResolvedValue({
      id: RUN,
      status: InspectionRunStatus.IN_PROGRESS,
      location: { name: 'Кафе' },
      equipment: { name: 'Холодильник' },
      items: [
        {
          id: ITEM,
          status: InspectionRunItemStatus.PENDING,
          title: 'Уплотнитель',
          description: 'без трещин',
        },
      ],
    });
    const started = await service.start(technician, SCHEDULE);
    expect(schedules.get).toHaveBeenCalled();
    expect(inspection.startRun).toHaveBeenCalledWith(
      { id: 'tech-1', companyId: 'company-1', role: UserRole.TECHNICIAN },
      { templateId: 'tpl-1', locationId: 'loc-1', equipmentId: 'eq-1', title: 'Утро' },
    );
    expect(started).toEqual({
      ok: true,
      value: {
        kind: 'item',
        item: expect.objectContaining({
          runId: RUN,
          itemId: ITEM,
          index: 1,
          total: 1,
          checkText: 'Уплотнитель',
        }),
      },
    });
  });

  it('marks OK through updateRunItem and completes when no pending items remain', async () => {
    const { service, inspection } = makeDeps();
    inspection.getRun
      .mockResolvedValueOnce({
        id: RUN,
        items: [{ id: ITEM, status: InspectionRunItemStatus.PENDING, title: 'Пол' }],
      })
      .mockResolvedValue({
        id: RUN,
        status: InspectionRunStatus.IN_PROGRESS,
        createdAt: new Date('2026-09-18T09:00:00.000Z'),
        items: [{ id: ITEM, status: InspectionRunItemStatus.OK, ticketId: null }],
      });
    inspection.completeRun.mockResolvedValue({
      run: {
        id: RUN,
        status: InspectionRunStatus.COMPLETED,
        createdAt: new Date('2026-09-18T09:00:00.000Z'),
        completedAt: new Date('2026-09-18T09:42:00.000Z'),
      },
      summary: { okCount: 1, issueCount: 0, criticalCount: 0, createdTicketsCount: 0 },
    });
    const done = await service.markOk(technician, RUN);
    expect(inspection.updateRunItem).toHaveBeenCalledWith(
      expect.anything(),
      RUN,
      ITEM,
      { status: InspectionRunItemStatus.OK },
    );
    expect(inspection.completeRun).toHaveBeenCalled();
    expect(done).toEqual({
      ok: true,
      value: {
        kind: 'brief',
        brief: expect.objectContaining({
          runId: RUN,
          okCount: 1,
          durationLabel: '42 мин',
        }),
      },
    });
  });

  it('creates a ticket from the item through the inspection kernel', async () => {
    const { service, inspection, categories } = makeDeps();
    inspection.getRun.mockResolvedValue({
      id: RUN,
      location: { clientCompanyId: 'client-1' },
      items: [
        {
          id: ITEM,
          title: 'Уплотнитель',
          comment: 'трещина',
          status: InspectionRunItemStatus.CRITICAL,
        },
      ],
    });
    inspection.createTicketFromItem.mockResolvedValue({
      ticket: { id: TICKET, ticketNumber: 88 },
    });
    const created = await service.createTicket(technician, RUN, ITEM);
    expect(categories.list).toHaveBeenCalledWith('company-1', UserRole.TECHNICIAN, 'tech-1', 'client-1');
    expect(inspection.createTicketFromItem).toHaveBeenCalled();
    expect(created).toEqual({
      ok: true,
      value: { kind: 'ticket-created', runId: RUN, ticketId: TICKET, ticketNumber: 88 },
    });
  });
});
