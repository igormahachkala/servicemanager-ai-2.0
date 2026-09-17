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
});
