import { TicketStatus, UserRole } from '@prisma/client';

import { AssignmentEngine } from './assignment.engine';

describe('AssignmentEngine cross-tenant category matching', () => {
  function makePrismaMock() {
    return {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'tech-1',
            locationBindings: [{ locationId: 'loc-1' }],
            technicianSpecializations: [
              {
                specializationId: 'provider-spec-1',
                specialization: { name: 'Сантехника' },
              },
            ],
            assignedTickets: [],
          },
        ]),
      },
      problemCategorySpecialization: {
        findMany: jest.fn().mockResolvedValue([
          {
            specializationId: 'client-spec-1',
            specialization: { name: 'Сантехника' },
          },
        ]),
      },
      assignmentDecision: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
  }

  it('adds category_match reason when ids differ but names match', async () => {
    const prisma = makePrismaMock();
    const engine = new AssignmentEngine(prisma as any);

    const selected = await engine.selectTechnicianForTicket({
      ticketId: 'ticket-1',
      companyId: 'provider-company',
      categoryCompanyId: 'client-company',
      locationId: 'loc-1',
      categoryId: 'cat-1',
    });

    expect(selected).not.toBeNull();
    expect(selected?.technicianId).toBe('tech-1');
    expect(selected?.reason).toContain('category_match');
    expect(prisma.problemCategorySpecialization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          problemCategory: { companyId: 'client-company', isActive: true },
        }),
      }),
    );
  });
});

describe('AssignmentEngine', () => {
  function createPrismaMock() {
    return {
      user: {
        findMany: jest.fn(),
      },
      problemCategorySpecialization: {
        findMany: jest.fn(),
      },
      assignmentDecision: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
  }

  it('selects the least loaded technician with location and category match', async () => {
    const prisma = createPrismaMock();
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'tech-b',
        locationBindings: [{ locationId: 'loc-1' }],
        technicianSpecializations: [{ specializationId: 'spec-1', specialization: { name: 'Сантехника' } }],
        assignedTickets: [{ id: 't-1' }],
      },
      {
        id: 'tech-a',
        locationBindings: [{ locationId: 'loc-1' }],
        technicianSpecializations: [{ specializationId: 'spec-1', specialization: { name: 'Сантехника' } }],
        assignedTickets: [{ id: 't-2' }, { id: 't-3' }],
      },
      {
        id: 'tech-c',
        locationBindings: [{ locationId: 'loc-2' }],
        technicianSpecializations: [{ specializationId: 'spec-1', specialization: { name: 'Сантехника' } }],
        assignedTickets: [],
      },
    ]);
    prisma.problemCategorySpecialization.findMany.mockResolvedValue([
      { specializationId: 'spec-1', specialization: { name: 'Сантехника' } },
    ]);

    const engine = new AssignmentEngine(prisma as any);
    const result = await engine.selectTechnicianForTicket({
      ticketId: 'ticket-1',
      companyId: 'company-1',
      locationId: 'loc-1',
      categoryId: 'category-1',
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        isExecutor: true,
        role: { in: [UserRole.TECHNICIAN, UserRole.MASTER, UserRole.DISPATCHER, UserRole.ADMIN] },
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
          select: {
            specializationId: true,
            specialization: { select: { name: true } },
          },
        },
        assignedTickets: {
          where: {
            status: { in: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS] },
          },
          select: { id: true },
        },
      },
    });

    // tech-b: score = location(+50) + category(+30) - tickets(1×10) = 70
    // tech-a: score = 50 + 30 - 20 = 60 — loses on score
    // tech-c: filtered out (loc-2 ≠ loc-1)
    expect(result).toEqual({
      technicianId: 'tech-b',
      reason: 'least_loaded + location_match + category_match',
      candidatesCount: 2,
      score: 70,
    });
  });

  it('returns null when there are no candidates after filters', async () => {
    const prisma = createPrismaMock();
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'tech-a',
        locationBindings: [{ locationId: 'loc-2' }],
        technicianSpecializations: [{ specializationId: 'spec-1', specialization: { name: 'Сантехника' } }],
        assignedTickets: [],
      },
    ]);
    prisma.problemCategorySpecialization.findMany.mockResolvedValue([]);

    const engine = new AssignmentEngine(prisma as any);
    const result = await engine.selectTechnicianForTicket({
      ticketId: 'ticket-2',
      companyId: 'company-1',
      locationId: 'loc-1',
      categoryId: 'category-1',
    });

    expect(result).toBeNull();
  });
});
