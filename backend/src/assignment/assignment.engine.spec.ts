import { TicketStatus, UserRole } from '@prisma/client';

import { AssignmentEngine } from './assignment.engine';

describe('AssignmentEngine', () => {
  function createPrismaMock() {
    return {
      user: {
        findMany: jest.fn(),
      },
      problemCategorySpecialization: {
        findMany: jest.fn(),
      },
    };
  }

  it('selects the least loaded technician with location and category match', async () => {
    const prisma = createPrismaMock();
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'tech-b',
        locationBindings: [{ locationId: 'loc-1' }],
        technicianSpecializations: [{ specializationId: 'spec-1' }],
        assignedTickets: [{ id: 't-1' }],
      },
      {
        id: 'tech-a',
        locationBindings: [{ locationId: 'loc-1' }],
        technicianSpecializations: [{ specializationId: 'spec-1' }],
        assignedTickets: [{ id: 't-2' }, { id: 't-3' }],
      },
      {
        id: 'tech-c',
        locationBindings: [{ locationId: 'loc-2' }],
        technicianSpecializations: [{ specializationId: 'spec-1' }],
        assignedTickets: [],
      },
    ]);
    prisma.problemCategorySpecialization.findMany.mockResolvedValue([
      { specializationId: 'spec-1' },
    ]);

    const engine = new AssignmentEngine(prisma as any);

    const result = await engine.selectTechnician({
      ticketId: 'ticket-1',
      companyId: 'company-1',
      locationId: 'loc-1',
      categoryId: 'category-1',
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        role: UserRole.TECHNICIAN,
        isActive: true,
      },
      select: {
        id: true,
        locationBindings: {
          where: {
            companyId: 'company-1',
            location: { clientCompanyId: 'company-1', isActive: true },
          },
          select: { locationId: true },
        },
        technicianSpecializations: {
          select: { specializationId: true },
        },
        assignedTickets: {
          where: {
            status: { in: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS] },
          },
          select: { id: true },
        },
      },
    });
    expect(result).toEqual({
      technicianId: 'tech-b',
      reason: 'least_loaded + location_match + category_match',
      candidatesCount: 2,
    });
  });

  it('returns null when there are no candidates after filters', async () => {
    const prisma = createPrismaMock();
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'tech-a',
        locationBindings: [{ locationId: 'loc-2' }],
        technicianSpecializations: [{ specializationId: 'spec-1' }],
        assignedTickets: [],
      },
    ]);
    prisma.problemCategorySpecialization.findMany.mockResolvedValue([]);

    const engine = new AssignmentEngine(prisma as any);

    const result = await engine.selectTechnician({
      ticketId: 'ticket-2',
      companyId: 'company-1',
      locationId: 'loc-1',
      categoryId: 'category-1',
    });

    expect(result).toBeNull();
  });
});
