import { TicketStatus, TicketUrgency, UserRole, WorkShiftStatus } from '@prisma/client';

import { MaxMasterWorkplaceService } from './max-master-workplace.service';

const master = {
  resolved: true as const,
  userId: 'master-1',
  companyId: 'company-1',
  role: UserRole.MASTER,
  maxUserId: '4242',
};

function makePrisma() {
  return {
    userPermission: { findFirst: jest.fn().mockResolvedValue(null) },
    inspectionRunItem: { findFirst: jest.fn().mockResolvedValue(null) },
  };
}

describe('MaxMasterWorkplaceService', () => {
  it('counts company-wide tickets with identity.role, not TECHNICIAN', async () => {
    const now = new Date('2026-09-17T12:00:00.000Z');
    const workforce = {
      getMyState: jest.fn().mockResolvedValue({
        company: { timezone: 'UTC' },
        serverNow: now,
      }),
      listWorkforce: jest.fn().mockResolvedValue({
        shifts: [
          { status: WorkShiftStatus.OPEN, userId: 'tech-1' },
          { status: WorkShiftStatus.CLOSED, userId: 'tech-2' },
        ],
      }),
    };
    const tickets = {
      list: jest.fn().mockResolvedValue([
        { status: TicketStatus.NEW, assignedTechnicianId: null, slaDueAt: null },
        { status: TicketStatus.NEW, assignedTechnicianId: 'tech-1', slaDueAt: null },
        { status: TicketStatus.IN_PROGRESS, assignedTechnicianId: 'tech-1', slaDueAt: new Date('2026-09-17T10:00:00.000Z') },
        { status: TicketStatus.DONE, assignedTechnicianId: 'tech-1', slaDueAt: new Date('2026-09-16T10:00:00.000Z') },
      ]),
    };
    const inspection = {
      listRuns: jest.fn().mockResolvedValue([{ id: 'run-1' }]),
    };
    const service = new MaxMasterWorkplaceService(
      makePrisma() as any,
      workforce as any,
      tickets as any,
      inspection as any,
      {} as any,
    );

    const today = await service.today(master);
    expect(today).toEqual({
      ok: true,
      value: {
        newCount: 2,
        unassignedCount: 1,
        inProgressCount: 1,
        overdueCount: 1,
        onShiftCount: 1,
        roundsTodayCount: 1,
      },
    });
    expect(tickets.list).toHaveBeenCalledWith('company-1', 'master-1', UserRole.MASTER, undefined, {
      canTechnicianViewAllCompanyTickets: false,
    });
    expect(inspection.listRuns).toHaveBeenCalledWith(
      { id: 'master-1', companyId: 'company-1', role: UserRole.MASTER },
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
    );
  });

  it('sorts master lists urgent then oldest and keeps the same order across screens', async () => {
    const now = new Date('2026-09-17T12:00:00.000Z');
    const workforce = {
      getMyState: jest.fn().mockResolvedValue({ company: { timezone: 'UTC' }, serverNow: now }),
      listWorkforce: jest.fn().mockResolvedValue({ shifts: [] }),
    };
    const tickets = {
      list: jest.fn().mockResolvedValue([
        {
          id: 'a',
          ticketNumber: 1,
          status: TicketStatus.NEW,
          urgency: TicketUrgency.URGENT,
          createdAt: new Date('2026-09-17T08:00:00.000Z'),
          slaDueAt: null,
          location: { name: 'A' },
        },
        {
          id: 'b',
          ticketNumber: 2,
          status: TicketStatus.NEW,
          urgency: TicketUrgency.URGENT,
          createdAt: new Date('2026-09-16T08:00:00.000Z'),
          slaDueAt: null,
          location: { name: 'B' },
        },
        {
          id: 'c',
          ticketNumber: 3,
          status: TicketStatus.NEW,
          urgency: TicketUrgency.NOT_URGENT,
          createdAt: new Date('2026-09-15T08:00:00.000Z'),
          slaDueAt: null,
          location: { name: 'C' },
        },
      ]),
    };
    const service = new MaxMasterWorkplaceService(
      makePrisma() as any,
      workforce as any,
      tickets as any,
      {} as any,
      {} as any,
    );
    const page = await service.listTickets(master, 'new', 0);
    expect(page.ok).toBe(true);
    if (!page.ok) return;
    expect(page.value.items.map((item) => item.ticketNumber)).toEqual([2, 1, 3]);
  });
});
