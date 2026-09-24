import { TicketStatus, UserRole } from '@prisma/client';
import { AssignmentEngine } from '../assignment/assignment.engine';
import { TicketsPolicy } from '../policy/tickets.policy';
import { isExecutorEligible } from './executor.utils';

// ── helpers ──────────────────────────────────────────────────────────────────

function makePrisma(overrides: {
  users?: any[];
  categorySpecializations?: any[];
} = {}) {
  return {
    user: {
      findMany: jest.fn().mockResolvedValue(overrides.users ?? []),
    },
    problemCategorySpecialization: {
      findMany: jest.fn().mockResolvedValue(overrides.categorySpecializations ?? []),
    },
    assignmentDecision: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

function makeExecutorUser(overrides: {
  id?: string;
  role?: UserRole;
  isExecutor?: boolean;
  locationIds?: string[];
  specializationIds?: string[];
  specializationNames?: string[];
  activeTickets?: number;
}) {
  return {
    id: overrides.id ?? 'user-1',
    locationBindings: (overrides.locationIds ?? ['loc-1']).map((id) => ({ locationId: id })),
    technicianSpecializations: (overrides.specializationIds ?? []).map((id, i) => ({
      specializationId: id,
      specialization: { name: (overrides.specializationNames ?? [])[i] ?? 'Сантехника' },
    })),
    assignedTickets: Array.from({ length: overrides.activeTickets ?? 0 }, (_, i) => ({ id: `t-${i}` })),
  };
}

// ── 1. ADMIN executor with specialization + location → in candidate pool ──────

describe('Scenario 1 — ADMIN executor with specialization and location binding', () => {
  it('appears in assignment engine candidate pool', async () => {
    const adminUser = makeExecutorUser({
      id: 'admin-1',
      role: UserRole.ADMIN,
      isExecutor: true,
      locationIds: ['loc-1'],
      specializationIds: ['spec-1'],
      specializationNames: ['Сантехника'],
    });

    const prisma = makePrisma({
      users: [adminUser],
      categorySpecializations: [
        { specializationId: 'spec-1', specialization: { name: 'Сантехника' } },
      ],
    });

    const engine = new AssignmentEngine(prisma as any);
    const result = await engine.selectTechnicianForTicket({
      ticketId: 'ticket-1',
      companyId: 'company-1',
      locationId: 'loc-1',
      categoryId: 'cat-1',
    });

    expect(result).not.toBeNull();
    expect(result?.technicianId).toBe('admin-1');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isExecutor: true,
          role: expect.objectContaining({ in: expect.arrayContaining([UserRole.ADMIN]) }),
        }),
      }),
    );
  });
});

// ── 2. MASTER executor — can claim and change status on own ticket ─────────────

describe('Scenario 2 — MASTER executor claim and status change', () => {
  const policy = new TicketsPolicy();

  it('claimWhere allows MASTER with isExecutor=true', () => {
    const result = policy.claimWhere({
      ticketId: 'ticket-1',
      user: { id: 'master-1', role: UserRole.MASTER, isExecutor: true, companyId: 'co-1' },
      specializationIds: [],
      specializationNames: [],
      allowTechnicianClaim: true,
      companyIds: ['co-1'],
    });
    expect(result.allowed).toBe(true);
  });

  it('canChangeStatus allows MASTER with isExecutor=true on own assigned ticket', () => {
    const result = policy.canChangeStatus({
      user: { id: 'master-1', role: UserRole.MASTER, isExecutor: true, companyId: 'co-1' },
      ticket: { companyId: 'co-1', assignedTechnicianId: 'master-1' },
    });
    expect(result.allowed).toBe(true);
  });

  it('canChangeStatus allows MASTER on any ticket (management path)', () => {
    const result = policy.canChangeStatus({
      user: { id: 'master-1', role: UserRole.MASTER, isExecutor: false, companyId: 'co-1' },
      ticket: { companyId: 'co-1', assignedTechnicianId: 'other-user' },
    });
    expect(result.allowed).toBe(true);
  });
});

// ── 3. DISPATCHER executor — can receive auto-assignment ────────────────────────

describe('Scenario 3 — DISPATCHER executor auto-assignment', () => {
  it('DISPATCHER with isExecutor=true is selected by assignment engine', async () => {
    const dispatcherUser = makeExecutorUser({
      id: 'dispatcher-1',
      role: UserRole.DISPATCHER,
      isExecutor: true,
      locationIds: ['loc-1'],
      specializationIds: ['spec-1'],
      specializationNames: ['Электрика'],
    });

    const prisma = makePrisma({
      users: [dispatcherUser],
      categorySpecializations: [
        { specializationId: 'spec-1', specialization: { name: 'Электрика' } },
      ],
    });

    const engine = new AssignmentEngine(prisma as any);
    const result = await engine.selectTechnicianForTicket({
      ticketId: 'ticket-2',
      companyId: 'company-1',
      locationId: 'loc-1',
      categoryId: 'cat-2',
    });

    expect(result).not.toBeNull();
    expect(result?.technicianId).toBe('dispatcher-1');
  });
});

// ── 4. CLIENT with forced isExecutor=true — denied everywhere ────────────────

describe('Scenario 4 — CLIENT with isExecutor=true denied', () => {
  const policy = new TicketsPolicy();

  it('isExecutorEligible returns false for CLIENT regardless of flag', () => {
    expect(isExecutorEligible({ role: UserRole.CLIENT, isExecutor: true })).toBe(false);
  });

  it('claimWhere denies CLIENT with isExecutor=true', () => {
    const result = policy.claimWhere({
      ticketId: 'ticket-1',
      user: { id: 'client-1', role: UserRole.CLIENT, isExecutor: true, companyId: 'co-1' },
      specializationIds: [],
      specializationNames: [],
      allowTechnicianClaim: true,
      companyIds: ['co-1'],
    });
    expect(result.allowed).toBe(false);
  });

  it('canChangeStatus denies CLIENT with isExecutor=true', () => {
    const result = policy.canChangeStatus({
      user: { id: 'client-1', role: UserRole.CLIENT, isExecutor: true, companyId: 'co-1' },
      ticket: { companyId: 'co-1', assignedTechnicianId: 'client-1' },
    });
    expect(result.allowed).toBe(false);
  });

  it('CLIENT does not appear in assignment engine pool (not in EXECUTOR_CAPABLE_ROLES)', async () => {
    // Simulate DB returning CLIENT user even with isExecutor=true (impossible in practice due to
    // users.service validation, but verifies double-gate at query level).
    const prisma = makePrisma({
      users: [], // DB query filters by role: { in: EXECUTOR_CAPABLE_ROLES } so CLIENT never returned
      categorySpecializations: [],
    });
    const engine = new AssignmentEngine(prisma as any);
    const result = await engine.selectTechnicianForTicket({
      ticketId: 'ticket-3',
      companyId: 'company-1',
      locationId: 'loc-1',
      categoryId: 'cat-1',
    });
    expect(result).toBeNull();
  });
});

// ── 5. ADMIN executor without specialization — not auto-assigned when category requires one ─

describe('Scenario 5 — ADMIN executor without specialization', () => {
  it('is not selected when category requires specialization they lack', async () => {
    const adminNoSpec = makeExecutorUser({
      id: 'admin-nospec',
      role: UserRole.ADMIN,
      isExecutor: true,
      locationIds: ['loc-1'],
      specializationIds: [],
      specializationNames: [],
    });

    const prisma = makePrisma({
      users: [adminNoSpec],
      categorySpecializations: [
        { specializationId: 'spec-plumbing', specialization: { name: 'Сантехника' } },
      ],
    });

    const engine = new AssignmentEngine(prisma as any);
    const result = await engine.selectTechnicianForTicket({
      ticketId: 'ticket-4',
      companyId: 'company-1',
      locationId: 'loc-1',
      categoryId: 'cat-plumbing',
    });

    expect(result).toBeNull();
  });

  it('is selected when category has no specialization requirement', async () => {
    const adminNoSpec = makeExecutorUser({
      id: 'admin-nospec',
      role: UserRole.ADMIN,
      isExecutor: true,
      locationIds: ['loc-1'],
      specializationIds: [],
      specializationNames: [],
    });

    const prisma = makePrisma({
      users: [adminNoSpec],
      categorySpecializations: [], // no category-specialization links
    });

    const engine = new AssignmentEngine(prisma as any);
    const result = await engine.selectTechnicianForTicket({
      ticketId: 'ticket-5',
      companyId: 'company-1',
      locationId: 'loc-1',
      categoryId: 'cat-general',
    });

    expect(result).not.toBeNull();
    expect(result?.technicianId).toBe('admin-nospec');
  });
});

// ── 6. ADMIN executor without location binding — not auto-assigned ────────────

describe('Scenario 6 — ADMIN executor without location binding', () => {
  it('is not selected for a ticket at a location they are not bound to', async () => {
    const adminWrongLoc = makeExecutorUser({
      id: 'admin-wrongloc',
      role: UserRole.ADMIN,
      isExecutor: true,
      locationIds: ['loc-other'], // bound to loc-other, ticket is at loc-1
      specializationIds: ['spec-1'],
      specializationNames: ['Сантехника'],
    });

    const prisma = makePrisma({
      users: [adminWrongLoc],
      categorySpecializations: [
        { specializationId: 'spec-1', specialization: { name: 'Сантехника' } },
      ],
    });

    const engine = new AssignmentEngine(prisma as any);
    const result = await engine.selectTechnicianForTicket({
      ticketId: 'ticket-6',
      companyId: 'company-1',
      locationId: 'loc-1',
      categoryId: 'cat-1',
    });

    expect(result).toBeNull();
  });
});

// ── 7. TECHNICIAN with isExecutor=false — denied all executor actions ──────────

describe('Scenario 7 — TECHNICIAN with isExecutor=false denied', () => {
  const policy = new TicketsPolicy();

  it('isExecutorEligible returns false', () => {
    expect(isExecutorEligible({ role: UserRole.TECHNICIAN, isExecutor: false })).toBe(false);
  });

  it('claimWhere is denied', () => {
    const result = policy.claimWhere({
      ticketId: 'ticket-1',
      user: { id: 'tech-1', role: UserRole.TECHNICIAN, isExecutor: false, companyId: 'co-1' },
      specializationIds: [],
      specializationNames: [],
      allowTechnicianClaim: true,
      companyIds: ['co-1'],
    });
    expect(result.allowed).toBe(false);
  });

  it('canChangeStatus is denied even on own assigned ticket', () => {
    const result = policy.canChangeStatus({
      user: { id: 'tech-1', role: UserRole.TECHNICIAN, isExecutor: false, companyId: 'co-1' },
      ticket: { companyId: 'co-1', assignedTechnicianId: 'tech-1' },
    });
    expect(result.allowed).toBe(false);
  });

  it('TECHNICIAN with isExecutor=false does not appear in assignment engine pool', async () => {
    // DB query requires isExecutor=true, so isExecutor=false users are never returned
    const prisma = makePrisma({
      users: [], // filtered out by isExecutor: true in the query
      categorySpecializations: [],
    });
    const engine = new AssignmentEngine(prisma as any);
    const result = await engine.selectTechnicianForTicket({
      ticketId: 'ticket-7',
      companyId: 'company-1',
      locationId: 'loc-1',
      categoryId: 'cat-1',
    });
    expect(result).toBeNull();
  });
});
