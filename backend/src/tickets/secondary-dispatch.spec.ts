/**
 * Step 8 — SECONDARY provider operational dispatch tests.
 *
 * Covers:
 *  1. resolveTechnicianOperationalScope includes SECONDARY clients
 *  2. resolveReadableTicketAccess grants SECONDARY executor access to scoped ticket
 *  3. resolveReadableTicketAccess denies SECONDARY executor on out-of-scope ticket
 *  4. assign() succeeds when executor belongs to a SECONDARY provider
 *  5. assign() denies executor from company with no SECONDARY contract (NotFoundException)
 *  6. assign() denies executor from company with PRIMARY (not SECONDARY) contract
 *  7. listAssignmentCandidates queries SECONDARY provider executors
 *  8. Non-executor-capable role at SECONDARY company cannot access executor scope
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ServiceContractRole, TicketStatus, UserRole } from '@prisma/client';

import { resolveTechnicianOperationalScope, resolveReadableTicketAccess } from './ticket-access.utils';
import { TicketsAssignmentService } from './tickets.assignment.service';
import { TicketsPolicy } from '../policy/tickets.policy';

// ── shared constants ──────────────────────────────────────────────────────────

const PRIMARY_PROVIDER_ID = 'provider-primary';
const SECONDARY_PROVIDER_ID = 'provider-secondary';
const CLIENT_ID = 'client-co';
const TECH_ID = 'tech-secondary';
const TICKET_ID = 'ticket-1';
const LOCATION_ID = 'loc-1';

// ── 1. resolveTechnicianOperationalScope — SECONDARY scope ─────────────────────

describe('resolveTechnicianOperationalScope — SECONDARY scope', () => {
  function makeCtx(primaryIds: string[], secondaryIds: string[]) {
    const serviceContractsService = {
      getLinkedClientAccess: jest.fn(),
      listPrimaryLinkedClientIds: jest.fn().mockResolvedValue(primaryIds),
      listSecondaryLinkedClientIds: jest.fn().mockResolvedValue(secondaryIds),
    };

    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: SECONDARY_PROVIDER_ID, allowTechnicianClaim: true }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: TECH_ID,
          technicianSpecializations: [],
        }),
      },
      userLocationBinding: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;

    return { serviceContractsService, prisma };
  }

  it('TECHNICIAN at SECONDARY provider gets secondary client in companyIds', async () => {
    const { serviceContractsService, prisma } = makeCtx([], [CLIENT_ID]);

    const scope = await resolveTechnicianOperationalScope({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: { id: TECH_ID, role: UserRole.TECHNICIAN, companyId: SECONDARY_PROVIDER_ID },
    });

    expect(scope.companyIds).toContain(CLIENT_ID);
    expect(scope.companyIds).toContain(SECONDARY_PROVIDER_ID);
    expect(scope.visibilityMode).toBe('provider_primary');
    expect(serviceContractsService.listSecondaryLinkedClientIds).toHaveBeenCalledWith(SECONDARY_PROVIDER_ID);
  });

  it('ADMIN executor at SECONDARY provider gets secondary client but NOT primary clients', async () => {
    const { serviceContractsService, prisma } = makeCtx(['primary-client'], [CLIENT_ID]);

    const scope = await resolveTechnicianOperationalScope({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: { id: 'admin-exec', role: UserRole.ADMIN, companyId: SECONDARY_PROVIDER_ID },
    });

    expect(scope.companyIds).toContain(CLIENT_ID);
    expect(scope.companyIds).not.toContain('primary-client');
    // ADMIN does not get PRIMARY linked clients via executor operational scope
    expect(serviceContractsService.listPrimaryLinkedClientIds).not.toHaveBeenCalled();
    expect(serviceContractsService.listSecondaryLinkedClientIds).toHaveBeenCalledWith(SECONDARY_PROVIDER_ID);
  });

  it('CLIENT role at SECONDARY company does not get secondary clients (not executor-capable)', async () => {
    const { serviceContractsService, prisma } = makeCtx([], [CLIENT_ID]);

    const scope = await resolveTechnicianOperationalScope({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: { id: 'client-user', role: UserRole.CLIENT, companyId: SECONDARY_PROVIDER_ID },
    });

    expect(scope.companyIds).toEqual([SECONDARY_PROVIDER_ID]);
    expect(serviceContractsService.listSecondaryLinkedClientIds).not.toHaveBeenCalled();
  });

  it('TECHNICIAN with no SECONDARY contracts gets only own company', async () => {
    const { serviceContractsService, prisma } = makeCtx([], []);

    const scope = await resolveTechnicianOperationalScope({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: { id: TECH_ID, role: UserRole.TECHNICIAN, companyId: SECONDARY_PROVIDER_ID },
    });

    expect(scope.companyIds).toEqual([SECONDARY_PROVIDER_ID]);
    expect(scope.visibilityMode).toBe('tenant');
  });

  it('specific linkedClientCompanyId matching SECONDARY contract is accepted', async () => {
    const serviceContractsService = {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        role: ServiceContractRole.SECONDARY,
        status: 'ACTIVE',
        clientCompanyId: CLIENT_ID,
        providerCompanyId: SECONDARY_PROVIDER_ID,
      }),
      listPrimaryLinkedClientIds: jest.fn(),
      listSecondaryLinkedClientIds: jest.fn(),
    };
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: SECONDARY_PROVIDER_ID, allowTechnicianClaim: true }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: TECH_ID, technicianSpecializations: [] }),
      },
      userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;

    const scope = await resolveTechnicianOperationalScope({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: { id: TECH_ID, role: UserRole.TECHNICIAN, companyId: SECONDARY_PROVIDER_ID },
      linkedClientCompanyId: CLIENT_ID,
    });

    expect(scope.companyIds).toContain(CLIENT_ID);
    expect(scope.scopeCompanyId).toBe(CLIENT_ID);
    // Uses getLinkedClientAccess instead of list methods when a specific client is requested
    expect(serviceContractsService.getLinkedClientAccess).toHaveBeenCalledWith(SECONDARY_PROVIDER_ID, CLIENT_ID);
    expect(serviceContractsService.listPrimaryLinkedClientIds).not.toHaveBeenCalled();
    expect(serviceContractsService.listSecondaryLinkedClientIds).not.toHaveBeenCalled();
  });

  it('ADMIN executor with PRIMARY linkedClientCompanyId is allowed via executor scope', async () => {
    const serviceContractsService = {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        role: ServiceContractRole.PRIMARY,
        status: 'ACTIVE',
        clientCompanyId: CLIENT_ID,
        providerCompanyId: SECONDARY_PROVIDER_ID,
      }),
      listPrimaryLinkedClientIds: jest.fn(),
      listSecondaryLinkedClientIds: jest.fn(),
    };
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: SECONDARY_PROVIDER_ID, allowTechnicianClaim: true }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'admin-1', role: UserRole.ADMIN, isExecutor: true, technicianSpecializations: [] }),
      },
      userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;

    const scope = await resolveTechnicianOperationalScope({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: { id: 'admin-1', role: UserRole.ADMIN, companyId: SECONDARY_PROVIDER_ID },
      linkedClientCompanyId: CLIENT_ID,
    });

    expect(scope.companyIds).toContain(CLIENT_ID);
    expect(serviceContractsService.getLinkedClientAccess).toHaveBeenCalledWith(SECONDARY_PROVIDER_ID, CLIENT_ID);
  });

  it('ADMIN without isExecutor is denied for PRIMARY linkedClientCompanyId via executor scope', async () => {
    const serviceContractsService = {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        role: ServiceContractRole.PRIMARY,
        status: 'ACTIVE',
        clientCompanyId: CLIENT_ID,
        providerCompanyId: SECONDARY_PROVIDER_ID,
      }),
      listPrimaryLinkedClientIds: jest.fn(),
      listSecondaryLinkedClientIds: jest.fn(),
    };
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: SECONDARY_PROVIDER_ID, allowTechnicianClaim: true }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'admin-1', role: UserRole.ADMIN, isExecutor: false, technicianSpecializations: [] }),
      },
      userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;

    await expect(
      resolveTechnicianOperationalScope({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actor: { id: 'admin-1', role: UserRole.ADMIN, companyId: SECONDARY_PROVIDER_ID },
        linkedClientCompanyId: CLIENT_ID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

// ── 2. resolveReadableTicketAccess — SECONDARY executor ───────────────────────

describe('resolveReadableTicketAccess — SECONDARY executor sees scoped tickets', () => {
  function makeServiceContractsService() {
    return {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        role: ServiceContractRole.SECONDARY,
        status: 'ACTIVE',
        clientCompanyId: CLIENT_ID,
        providerCompanyId: SECONDARY_PROVIDER_ID,
      }),
      listPrimaryLinkedClientIds: jest.fn().mockResolvedValue([]),
      listSecondaryLinkedClientIds: jest.fn().mockResolvedValue([CLIENT_ID]),
      listLinkedClients: jest.fn().mockResolvedValue([]),
      assertPrimaryLinkedClientAccess: jest.fn().mockRejectedValue(new Error('SECONDARY blocked')),
    };
  }

  function makePrisma(assignedTechnicianId: string | null, status: string) {
    const operationalTicket = {
      id: TICKET_ID,
      companyId: CLIENT_ID,
      locationId: LOCATION_ID,
      assignedTechnicianId,
    };
    let callCount = 0;
    return {
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: SECONDARY_PROVIDER_ID, allowTechnicianClaim: true }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: TECH_ID, technicianSpecializations: [] }),
        findMany: jest.fn().mockResolvedValue([{ id: TECH_ID }]),
      },
      userLocationBinding: { findMany: jest.fn().mockResolvedValue([{ companyId: SECONDARY_PROVIDER_ID, locationId: LOCATION_ID }]) },
      technicianSpecialization: { findMany: jest.fn().mockResolvedValue([]) },
      ticket: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          callCount++;
          // 1st call: own-company check (companyId = providerCompanyId) → null
          if (callCount === 1) return null;
          // 2nd call: executor operational scope (AND array, companyIds includes CLIENT_ID)
          if (callCount === 2) {
            const whereStr = JSON.stringify(where);
            const assignedMatch = assignedTechnicianId === TECH_ID && whereStr.includes(TECH_ID);
            const newMatch =
              status === TicketStatus.NEW &&
              assignedTechnicianId === null &&
              whereStr.includes(TicketStatus.NEW) &&
              whereStr.includes(LOCATION_ID);
            const matches = assignedTechnicianId === TECH_ID ? assignedMatch : newMatch;
            return matches ? operationalTicket : null;
          }
          return null;
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: TICKET_ID,
          companyId: CLIENT_ID,
          locationId: LOCATION_ID,
          status,
          assignedTechnicianId,
          problemCategory: { specializationLinks: [] },
        }),
      },
    } as any;
  }

  it('TECHNICIAN at SECONDARY provider can read a NEW unassigned ticket in scope', async () => {
    const prisma = makePrisma(null, TicketStatus.NEW);
    const svc = makeServiceContractsService();

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: svc as any,
      actor: { id: TECH_ID, role: UserRole.TECHNICIAN, companyId: SECONDARY_PROVIDER_ID },
      ticketId: TICKET_ID,
    });

    expect(result.visibilityMode).toBe('provider_primary');
    expect(result.scopeCompanyId).toBe(CLIENT_ID);
  });

  it('ADMIN executor at SECONDARY provider can read their assigned ticket', async () => {
    const prisma = makePrisma(TECH_ID, TicketStatus.ASSIGNED);
    const svc = makeServiceContractsService();

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: svc as any,
      actor: { id: TECH_ID, role: UserRole.ADMIN, companyId: SECONDARY_PROVIDER_ID },
      ticketId: TICKET_ID,
    });

    expect(result.visibilityMode).toBe('provider_primary');
    expect(result.scopeCompanyId).toBe(CLIENT_ID);
  });
});

// ── 3. assign() — cross-company SECONDARY executor ────────────────────────────

describe('TicketsAssignmentService.assign — SECONDARY executor', () => {
  /** Build a service-contracts mock that returns a given contract role for the SECONDARY lookup. */
  function makeContracts(linkedAccessRole: ServiceContractRole | null) {
    return {
      // Arg-aware: the acting PRIMARY provider holds PRIMARY access to the client
      // (so its detail read is unrestricted), while the cross-company executor's
      // SECONDARY_PROVIDER_ID resolves to the role under test.
      getLinkedClientAccess: jest.fn().mockImplementation(async (providerCompanyId: string) => {
        if (providerCompanyId === PRIMARY_PROVIDER_ID) {
          return {
            role: ServiceContractRole.PRIMARY,
            status: 'ACTIVE',
            clientCompanyId: CLIENT_ID,
            providerCompanyId: PRIMARY_PROVIDER_ID,
          }
        }
        return linkedAccessRole
          ? {
              role: linkedAccessRole,
              status: 'ACTIVE',
              clientCompanyId: CLIENT_ID,
              providerCompanyId: SECONDARY_PROVIDER_ID,
            }
          : null
      }),
      listPrimaryLinkedClientIds: jest.fn().mockResolvedValue([CLIENT_ID]),
      listSecondaryLinkedClientIds: jest.fn().mockResolvedValue([]),
      listSecondaryProviderCompanyIds: jest.fn().mockResolvedValue([SECONDARY_PROVIDER_ID]),
      // For management path resolution in resolveReadableTicketAccess
      listLinkedClients: jest.fn().mockResolvedValue([
        { linkedClientCompanyId: CLIENT_ID, role: ServiceContractRole.PRIMARY },
      ]),
      assertPrimaryLinkedClientAccess: jest.fn().mockResolvedValue(undefined),
    };
  }

  function makeTx(
    techCompanyId: string,
    overrides?: {
      status?: TicketStatus
      assignedTechnicianId?: string | null
      previousAssigneeCompanyId?: string
    },
  ) {
    return {
      ticket: {
        findFirst: jest.fn().mockResolvedValue({
          id: TICKET_ID,
          companyId: CLIENT_ID,
          locationId: LOCATION_ID,
          status: overrides?.status ?? TicketStatus.NEW,
          assignedTechnicianId: overrides?.assignedTechnicianId ?? null,
          problemCategory: { specializationLinks: [] },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: TECH_ID,
          companyId: techCompanyId,
          isActive: true,
          deletedAt: null,
          technicianSpecializations: [],
        }),
        findUnique: jest.fn().mockResolvedValue({
          companyId: overrides?.previousAssigneeCompanyId ?? techCompanyId,
        }),
        findMany: jest.fn().mockResolvedValue([{ id: TECH_ID, companyId: techCompanyId }]),
      },
      userAccessScope: { findMany: jest.fn().mockResolvedValue([]) },
      userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
      ticketStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      domainEvent: { create: jest.fn().mockResolvedValue({ id: 'ev-1' }) },
    };
  }

  function makePrisma(tx: ReturnType<typeof makeTx>) {
    // Track calls to ticket.findFirst to return correct responses per stage:
    // 1st: own-company check → null
    // 2nd: executor operational scope → null (ticket is at CLIENT_ID, not in executor PRIMARY scope)
    // 3rd: management path (PRIMARY linked client) → returns ticket
    let callSeq = 0;
    return {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: PRIMARY_PROVIDER_ID,
          autoAssignEnabled: false,
          allowTechnicianClaim: true,
        }),
      },
      user: {
        // Executor specialization lookup in resolveTechnicianOperationalScope
        findFirst: jest.fn().mockResolvedValue({ id: 'actor', technicianSpecializations: [] }),
        findUnique: jest.fn().mockResolvedValue({ companyId: CLIENT_ID, email: 'tech@example.com' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      technicianSpecialization: { findMany: jest.fn().mockResolvedValue([]) },
      ticket: {
        findFirst: jest.fn().mockImplementation(async () => {
          callSeq++;
          if (callSeq === 1) return null; // own-company check
          if (callSeq === 2) return null; // executor scope (no SECONDARY clients for PRIMARY provider)
          // 3rd: management path
          return { id: TICKET_ID, companyId: CLIENT_ID, assignedTechnicianId: null };
        }),
        findUnique: jest.fn().mockResolvedValue({
          companyId: CLIENT_ID,
          locationId: LOCATION_ID,
          ticketNumber: 42,
          problemText: 'Test',
        }),
      },
      userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
      assignmentDecision: { create: jest.fn().mockResolvedValue({}) },
    } as any;
  }

  function makeService(prisma: any, contracts: any) {
    const query = { getOne: jest.fn().mockResolvedValue({ id: TICKET_ID }) };
    const timeline = {
      recordTx: jest.fn().mockResolvedValue({ id: 'ev-1' }),
      recordLegacyTx: jest.fn().mockResolvedValue({ id: 'ev-2' }),
    };
    const notifications = {
      scheduleTicketAssignedToTechnician: jest.fn(),
      onTicketAssigned: jest.fn(),
    };
    const service = new TicketsAssignmentService(
      prisma,
      {} as any,
      query as any,
      timeline as any,
      {} as any,
      contracts,
      {} as any,
      notifications as any,
    );
    return Object.assign(service, { __testTimeline: timeline });
  }

  it('succeeds when executor belongs to a SECONDARY provider', async () => {
    const contracts = makeContracts(ServiceContractRole.SECONDARY);
    const tx = makeTx(SECONDARY_PROVIDER_ID);
    const prisma = makePrisma(tx);
    const svc = makeService(prisma, contracts);

    const result = await svc.assign(
      PRIMARY_PROVIDER_ID,
      { id: 'actor-admin', role: UserRole.ADMIN, companyId: PRIMARY_PROVIDER_ID },
      TICKET_ID,
      TECH_ID,
    );

    expect(result).toBeDefined();
    expect(tx.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedTechnicianId: TECH_ID }),
      }),
    );
    // Must have verified the SECONDARY contract for the cross-company executor
    expect(contracts.getLinkedClientAccess).toHaveBeenCalledWith(SECONDARY_PROVIDER_ID, CLIENT_ID);
    expect(tx.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: TECH_ID,
          isActive: true,
        }),
      }),
    );
    expect((svc as any).__testTimeline.recordTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event: 'TICKET_ASSIGNMENT_CHANGED',
        actorUserId: 'actor-admin',
        payload: expect.objectContaining({
          operationType: 'provider_assignment',
          previousValue: null,
          newValue: TECH_ID,
          assignedTechnicianId: TECH_ID,
          timestamp: expect.any(String),
        }),
      }),
    );
  });

  it('allows SECONDARY provider admin to reassign internally after the ticket entered its contour', async () => {
    const contracts = makeContracts(ServiceContractRole.SECONDARY);
    const tx = makeTx(SECONDARY_PROVIDER_ID, {
      status: TicketStatus.ASSIGNED,
      assignedTechnicianId: 'old-secondary-tech',
      previousAssigneeCompanyId: SECONDARY_PROVIDER_ID,
    });
    const prisma = makePrisma(tx);
    const svc = makeService(prisma, contracts);

    await expect(
      svc.assign(
        SECONDARY_PROVIDER_ID,
        { id: 'secondary-admin', role: UserRole.ADMIN, companyId: SECONDARY_PROVIDER_ID },
        TICKET_ID,
        TECH_ID,
        CLIENT_ID,
      ),
    ).resolves.toBeDefined();

    expect(tx.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedTechnicianId: TECH_ID }),
      }),
    );
    expect((svc as any).__testTimeline.recordTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event: 'TICKET_ASSIGNMENT_CHANGED',
        actorUserId: 'secondary-admin',
        payload: expect.objectContaining({
          operationType: 'reassign_technician',
          previousValue: 'old-secondary-tech',
          newValue: TECH_ID,
          previousAssignedTechnicianId: 'old-secondary-tech',
          assignedTechnicianId: TECH_ID,
          timestamp: expect.any(String),
        }),
      }),
    );
  });

  it('denies SECONDARY provider admin assigning to another subcontractor company', async () => {
    const otherSecondaryProviderId = 'provider-secondary-other';
    const contracts = makeContracts(ServiceContractRole.SECONDARY);
    const tx = makeTx(otherSecondaryProviderId, {
      status: TicketStatus.ASSIGNED,
      assignedTechnicianId: 'old-secondary-tech',
      previousAssigneeCompanyId: SECONDARY_PROVIDER_ID,
    });
    const prisma = makePrisma(tx);
    const svc = makeService(prisma, contracts);

    await expect(
      svc.assign(
        SECONDARY_PROVIDER_ID,
        { id: 'secondary-admin', role: UserRole.ADMIN, companyId: SECONDARY_PROVIDER_ID },
        TICKET_ID,
        TECH_ID,
        CLIENT_ID,
      ),
    ).rejects.toBeDefined();

    expect(tx.ticket.update).not.toHaveBeenCalled();
  });

  it('rejects direct assignment to inactive executor users', async () => {
    const contracts = makeContracts(ServiceContractRole.SECONDARY);
    const tx = makeTx(SECONDARY_PROVIDER_ID);
    const inactiveExecutor = {
      id: TECH_ID,
      companyId: SECONDARY_PROVIDER_ID,
      isActive: false,
      technicianSpecializations: [],
    };
    tx.user.findFirst.mockImplementation(async (args: any) =>
      args?.where?.isActive === true ? null : inactiveExecutor,
    );
    const prisma = makePrisma(tx);
    const svc = makeService(prisma, contracts);

    await expect(
      svc.assign(
        PRIMARY_PROVIDER_ID,
        { id: 'actor-admin', role: UserRole.ADMIN, companyId: PRIMARY_PROVIDER_ID },
        TICKET_ID,
        TECH_ID,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: TECH_ID,
          isActive: true,
        }),
      }),
    );
    expect(tx.ticket.update).not.toHaveBeenCalled();
  });

  it('allows direct assignment to SECONDARY executor when specialization names match across tenant UUIDs', async () => {
    const contracts = makeContracts(ServiceContractRole.SECONDARY);
    const tx = makeTx(SECONDARY_PROVIDER_ID);
    tx.ticket.findFirst.mockResolvedValue({
      id: TICKET_ID,
      companyId: CLIENT_ID,
      locationId: LOCATION_ID,
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      problemCategory: {
        specializationLinks: [
          {
            specializationId: 'client-spec-cond',
            specialization: { id: 'client-spec-cond', name: 'Специалист по кондиционерам', isActive: true },
          },
        ],
      },
    });
    tx.user.findFirst.mockResolvedValue({
      id: TECH_ID,
      companyId: SECONDARY_PROVIDER_ID,
      isActive: true,
      deletedAt: null,
      technicianSpecializations: [
        {
          specializationId: 'subcontractor-spec-cond',
          specialization: { id: 'subcontractor-spec-cond', name: 'Специалист по кондиционерам', isActive: true },
        },
      ],
    });
    const prisma = makePrisma(tx);
    const svc = makeService(prisma, contracts);

    await expect(
      svc.assign(
        PRIMARY_PROVIDER_ID,
        { id: 'actor-admin', role: UserRole.ADMIN, companyId: PRIMARY_PROVIDER_ID },
        TICKET_ID,
        TECH_ID,
      ),
    ).resolves.toBeDefined();

    expect(tx.ticket.update).toHaveBeenCalled();
  });

  it('rejects direct assignment to SECONDARY executor without required category specialization', async () => {
    const contracts = makeContracts(ServiceContractRole.SECONDARY);
    const tx = makeTx(SECONDARY_PROVIDER_ID);
    tx.ticket.findFirst.mockResolvedValue({
      id: TICKET_ID,
      companyId: CLIENT_ID,
      locationId: LOCATION_ID,
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      problemCategory: {
        specializationLinks: [
          {
            specializationId: 'client-spec-cond',
            specialization: { id: 'client-spec-cond', name: 'Специалист по кондиционерам', isActive: true },
          },
        ],
      },
    });
    tx.user.findFirst.mockResolvedValue({
      id: TECH_ID,
      companyId: SECONDARY_PROVIDER_ID,
      isActive: true,
      deletedAt: null,
      technicianSpecializations: [
        {
          specializationId: 'subcontractor-spec-electric',
          specialization: { id: 'subcontractor-spec-electric', name: 'Электрик', isActive: true },
        },
      ],
    });
    const prisma = makePrisma(tx);
    const svc = makeService(prisma, contracts);

    await expect(
      svc.assign(
        PRIMARY_PROVIDER_ID,
        { id: 'actor-admin', role: UserRole.ADMIN, companyId: PRIMARY_PROVIDER_ID },
        TICKET_ID,
        TECH_ID,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(tx.ticket.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when executor company has no contract with client', async () => {
    const contracts = makeContracts(null);
    const tx = makeTx('unrelated-company');
    const prisma = makePrisma(tx);
    const svc = makeService(prisma, contracts);

    await expect(
      svc.assign(
        PRIMARY_PROVIDER_ID,
        { id: 'actor-admin', role: UserRole.ADMIN, companyId: PRIMARY_PROVIDER_ID },
        TICKET_ID,
        TECH_ID,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when executor company has PRIMARY (not SECONDARY) contract', async () => {
    const contracts = makeContracts(ServiceContractRole.PRIMARY);
    const tx = makeTx('other-primary-provider');
    const prisma = makePrisma(tx);
    const svc = makeService(prisma, contracts);

    await expect(
      svc.assign(
        PRIMARY_PROVIDER_ID,
        { id: 'actor-admin', role: UserRole.ADMIN, companyId: PRIMARY_PROVIDER_ID },
        TICKET_ID,
        TECH_ID,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── 4. TicketsPolicy.canChangeStatus — SECONDARY executor ────────────────────

describe('TicketsPolicy.canChangeStatus — SECONDARY executor', () => {
  const policy = new TicketsPolicy();

  it('allows SECONDARY executor to change status on their assigned ticket', () => {
    // In updateStatus, operationCompanyId = actor.companyId for provider_primary mode,
    // so both user.companyId and ticket.companyId equal SECONDARY_PROVIDER_ID.
    const result = policy.canChangeStatus({
      user: { id: TECH_ID, role: UserRole.TECHNICIAN, isExecutor: true, companyId: SECONDARY_PROVIDER_ID },
      ticket: { companyId: SECONDARY_PROVIDER_ID, assignedTechnicianId: TECH_ID },
    });
    expect(result.allowed).toBe(true);
  });

  it('denies executor status change when ticket is assigned to a different technician', () => {
    const result = policy.canChangeStatus({
      user: { id: TECH_ID, role: UserRole.TECHNICIAN, isExecutor: true, companyId: SECONDARY_PROVIDER_ID },
      ticket: { companyId: SECONDARY_PROVIDER_ID, assignedTechnicianId: 'other-tech' },
    });
    expect(result.allowed).toBe(false);
  });

  it('SECONDARY executor without a contract cannot access the ticket (NotFoundException)', async () => {
    // No PRIMARY clients, no SECONDARY clients → executor scope resolves to own company only.
    // The ticket is at CLIENT_ID, so findFirst returns null and NotFoundException is thrown.
    const svcContracts = {
      getLinkedClientAccess: jest.fn(),
      listPrimaryLinkedClientIds: jest.fn().mockResolvedValue([]),
      listSecondaryLinkedClientIds: jest.fn().mockResolvedValue([]),
      listLinkedClients: jest.fn().mockResolvedValue([]),
    };

    let callCount = 0;
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: SECONDARY_PROVIDER_ID, allowTechnicianClaim: true }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: TECH_ID, technicianSpecializations: [] }),
      },
      userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
      technicianSpecialization: { findMany: jest.fn().mockResolvedValue([]) },
      ticket: {
        findFirst: jest.fn().mockImplementation(async () => {
          callCount++;
          return null; // ticket never found — it belongs to CLIENT_ID, not SECONDARY_PROVIDER_ID
        }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any;

    await expect(
      resolveReadableTicketAccess({
        prisma,
        serviceContractsService: svcContracts as any,
        actor: { id: TECH_ID, role: UserRole.TECHNICIAN, companyId: SECONDARY_PROVIDER_ID },
        ticketId: TICKET_ID,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ── 5. listAssignmentCandidates includes SECONDARY executors ──────────────────

describe('TicketsAssignmentService.listAssignmentCandidates — SECONDARY executors', () => {
  it('queries executors from both PRIMARY and SECONDARY provider companies', async () => {
    const contracts = {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        role: ServiceContractRole.PRIMARY,
        status: 'ACTIVE',
        clientCompanyId: CLIENT_ID,
        providerCompanyId: PRIMARY_PROVIDER_ID,
      }),
      listPrimaryLinkedClientIds: jest.fn().mockResolvedValue([CLIENT_ID]),
      listSecondaryLinkedClientIds: jest.fn().mockResolvedValue([]),
      listSecondaryProviderCompanyIds: jest.fn().mockResolvedValue([SECONDARY_PROVIDER_ID]),
      listLinkedClients: jest.fn().mockResolvedValue([
        { linkedClientCompanyId: CLIENT_ID, role: ServiceContractRole.PRIMARY },
      ]),
      assertPrimaryLinkedClientAccess: jest.fn().mockResolvedValue(undefined),
    };

    const fullTicket = {
      id: TICKET_ID,
      companyId: CLIENT_ID,
      locationId: LOCATION_ID,
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      problemCategory: {
        id: 'cat-1',
        name: 'Test',
        specializationLinks: [],
      },
      location: { id: LOCATION_ID, name: 'Loc', platformCode: null, externalCode: null, city: 'City', address: 'Addr' },
    };

    let ticketFindFirstSeq = 0;
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: PRIMARY_PROVIDER_ID, autoAssignEnabled: false, allowTechnicianClaim: true }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'actor', technicianSpecializations: [] }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      ticket: {
        findFirst: jest.fn().mockImplementation(async () => {
          ticketFindFirstSeq++;
          if (ticketFindFirstSeq === 1) return null; // own-company
          if (ticketFindFirstSeq === 2) return null; // executor scope
          // management path
          if (ticketFindFirstSeq === 3) return { id: TICKET_ID, companyId: CLIENT_ID, assignedTechnicianId: null };
          // full ticket fetch for listAssignmentCandidates
          return fullTicket;
        }),
        findUnique: jest.fn().mockResolvedValue(fullTicket),
      },
      userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
      technicianSpecialization: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;

    const query = { getOne: jest.fn().mockResolvedValue({}) };
    const svc = new TicketsAssignmentService(
      prisma,
      {} as any,
      query as any,
      {} as any,
      {} as any,
      contracts as any,
      {} as any,
      {} as any,
    );

    await svc.listAssignmentCandidates(
      PRIMARY_PROVIDER_ID,
      { id: 'actor', role: UserRole.ADMIN },
      TICKET_ID,
    );

    expect(contracts.listSecondaryProviderCompanyIds).toHaveBeenCalledWith(CLIENT_ID);

    // The user.findMany query must cover both provider company IDs
    const findManyCall = prisma.user.findMany.mock.calls[0][0];
    const whereCompanyId = findManyCall?.where?.companyId;
    const coversSecondary =
      whereCompanyId === PRIMARY_PROVIDER_ID
        ? false // single-company mode only covers primary
        : whereCompanyId?.in?.includes(PRIMARY_PROVIDER_ID) &&
          whereCompanyId?.in?.includes(SECONDARY_PROVIDER_ID);
    expect(coversSecondary).toBe(true);
  });
});
