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

import { ForbiddenException, NotFoundException } from '@nestjs/common'
import {
  ServiceContractLocationMode,
  ServiceContractRole,
  TicketStatus,
  UserRole,
} from '@prisma/client'

import {
  resolveTechnicianOperationalScope,
  resolveReadableTicketAccess,
} from './ticket-access.utils'
import { TicketsAssignmentService } from './tickets.assignment.service'
import { TicketsPolicy } from '../policy/tickets.policy'

// ── shared constants ──────────────────────────────────────────────────────────

const PRIMARY_PROVIDER_ID = 'provider-primary'
const SECONDARY_PROVIDER_ID = 'provider-secondary'
const CLIENT_ID = 'client-co'
const TECH_ID = 'tech-secondary'
const TICKET_ID = 'ticket-1'
const LOCATION_ID = 'loc-1'
const HVAC_SPEC_ID = 'spec-hvac'
const HVAC_SPEC_NAME = 'Специалист по кондиционерам'

// ── 1. resolveTechnicianOperationalScope — SECONDARY scope ─────────────────────

describe('resolveTechnicianOperationalScope — SECONDARY scope', () => {
  function makeCtx(primaryIds: string[], secondaryIds: string[]) {
    const serviceContractsService = {
      getLinkedClientAccess: jest.fn(),
      listPrimaryLinkedClientIds: jest.fn().mockResolvedValue(primaryIds),
      listSecondaryLinkedClientIds: jest.fn().mockResolvedValue(secondaryIds),
    }

    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: SECONDARY_PROVIDER_ID,
          allowTechnicianClaim: true,
        }),
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
    } as any

    return { serviceContractsService, prisma }
  }

  it('TECHNICIAN at SECONDARY provider gets secondary client in companyIds', async () => {
    const { serviceContractsService, prisma } = makeCtx([], [CLIENT_ID])

    const scope = await resolveTechnicianOperationalScope({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: {
        id: TECH_ID,
        role: UserRole.TECHNICIAN,
        companyId: SECONDARY_PROVIDER_ID,
      },
    })

    expect(scope.companyIds).toContain(CLIENT_ID)
    expect(scope.companyIds).toContain(SECONDARY_PROVIDER_ID)
    expect(scope.visibilityMode).toBe('provider_primary')
    expect(
      serviceContractsService.listSecondaryLinkedClientIds,
    ).toHaveBeenCalledWith(SECONDARY_PROVIDER_ID)
  })

  it('ADMIN executor at SECONDARY provider gets secondary client but NOT primary clients', async () => {
    const { serviceContractsService, prisma } = makeCtx(
      ['primary-client'],
      [CLIENT_ID],
    )

    const scope = await resolveTechnicianOperationalScope({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: {
        id: 'admin-exec',
        role: UserRole.ADMIN,
        companyId: SECONDARY_PROVIDER_ID,
      },
    })

    expect(scope.companyIds).toContain(CLIENT_ID)
    expect(scope.companyIds).not.toContain('primary-client')
    // ADMIN does not get PRIMARY linked clients via executor operational scope
    expect(
      serviceContractsService.listPrimaryLinkedClientIds,
    ).not.toHaveBeenCalled()
    expect(
      serviceContractsService.listSecondaryLinkedClientIds,
    ).toHaveBeenCalledWith(SECONDARY_PROVIDER_ID)
  })

  it('CLIENT role at SECONDARY company does not get secondary clients (not executor-capable)', async () => {
    const { serviceContractsService, prisma } = makeCtx([], [CLIENT_ID])

    const scope = await resolveTechnicianOperationalScope({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: {
        id: 'client-user',
        role: UserRole.CLIENT,
        companyId: SECONDARY_PROVIDER_ID,
      },
    })

    expect(scope.companyIds).toEqual([SECONDARY_PROVIDER_ID])
    expect(
      serviceContractsService.listSecondaryLinkedClientIds,
    ).not.toHaveBeenCalled()
  })

  it('TECHNICIAN with no SECONDARY contracts gets only own company', async () => {
    const { serviceContractsService, prisma } = makeCtx([], [])

    const scope = await resolveTechnicianOperationalScope({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: {
        id: TECH_ID,
        role: UserRole.TECHNICIAN,
        companyId: SECONDARY_PROVIDER_ID,
      },
    })

    expect(scope.companyIds).toEqual([SECONDARY_PROVIDER_ID])
    expect(scope.visibilityMode).toBe('tenant')
  })

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
    }
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: SECONDARY_PROVIDER_ID,
          allowTechnicianClaim: true,
        }),
      },
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: TECH_ID, technicianSpecializations: [] }),
      },
      userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
    } as any

    const scope = await resolveTechnicianOperationalScope({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: {
        id: TECH_ID,
        role: UserRole.TECHNICIAN,
        companyId: SECONDARY_PROVIDER_ID,
      },
      linkedClientCompanyId: CLIENT_ID,
    })

    expect(scope.companyIds).toContain(CLIENT_ID)
    expect(scope.scopeCompanyId).toBe(CLIENT_ID)
    // Uses getLinkedClientAccess instead of list methods when a specific client is requested
    expect(serviceContractsService.getLinkedClientAccess).toHaveBeenCalledWith(
      SECONDARY_PROVIDER_ID,
      CLIENT_ID,
    )
    expect(
      serviceContractsService.listPrimaryLinkedClientIds,
    ).not.toHaveBeenCalled()
    expect(
      serviceContractsService.listSecondaryLinkedClientIds,
    ).not.toHaveBeenCalled()
  })

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
    }
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: SECONDARY_PROVIDER_ID,
          allowTechnicianClaim: true,
        }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'admin-1',
          role: UserRole.ADMIN,
          isExecutor: true,
          technicianSpecializations: [],
        }),
      },
      userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
    } as any

    const scope = await resolveTechnicianOperationalScope({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: {
        id: 'admin-1',
        role: UserRole.ADMIN,
        companyId: SECONDARY_PROVIDER_ID,
      },
      linkedClientCompanyId: CLIENT_ID,
    })

    expect(scope.companyIds).toContain(CLIENT_ID)
    expect(serviceContractsService.getLinkedClientAccess).toHaveBeenCalledWith(
      SECONDARY_PROVIDER_ID,
      CLIENT_ID,
    )
  })

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
    }
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: SECONDARY_PROVIDER_ID,
          allowTechnicianClaim: true,
        }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'admin-1',
          role: UserRole.ADMIN,
          isExecutor: false,
          technicianSpecializations: [],
        }),
      },
      userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
    } as any

    await expect(
      resolveTechnicianOperationalScope({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actor: {
          id: 'admin-1',
          role: UserRole.ADMIN,
          companyId: SECONDARY_PROVIDER_ID,
        },
        linkedClientCompanyId: CLIENT_ID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})

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
      assertPrimaryLinkedClientAccess: jest
        .fn()
        .mockRejectedValue(new Error('SECONDARY blocked')),
    }
  }

  function makePrisma(assignedTechnicianId: string | null, status: string) {
    const operationalTicket = {
      id: TICKET_ID,
      companyId: CLIENT_ID,
      locationId: LOCATION_ID,
      assignedTechnicianId,
    }
    let callCount = 0
    return {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: SECONDARY_PROVIDER_ID,
          allowTechnicianClaim: true,
        }),
      },
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: TECH_ID, technicianSpecializations: [] }),
        findMany: jest.fn().mockResolvedValue([{ id: TECH_ID }]),
      },
      userLocationBinding: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { companyId: SECONDARY_PROVIDER_ID, locationId: LOCATION_ID },
          ]),
      },
      technicianSpecialization: { findMany: jest.fn().mockResolvedValue([]) },
      serviceContract: {
        findFirst: jest.fn().mockResolvedValue({ id: 'contract-1' }),
      },
      serviceContractSpecialization: {
        findMany: jest.fn().mockResolvedValue([
          {
            specializationId: 'contract-default',
            specialization: { name: 'Default' },
          },
        ]),
      },
      ticket: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          callCount++
          // 1st call: own-company check (companyId = providerCompanyId) → null
          if (callCount === 1) return null
          // 2nd call: executor operational scope (AND array, companyIds includes CLIENT_ID)
          if (callCount === 2) {
            const whereStr = JSON.stringify(where)
            const assignedMatch =
              assignedTechnicianId === TECH_ID && whereStr.includes(TECH_ID)
            const newMatch =
              status === TicketStatus.NEW &&
              assignedTechnicianId === null &&
              whereStr.includes(TicketStatus.NEW) &&
              whereStr.includes(LOCATION_ID)
            const matches =
              assignedTechnicianId === TECH_ID ? assignedMatch : newMatch
            return matches ? operationalTicket : null
          }
          return null
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
    } as any
  }

  it('TECHNICIAN at SECONDARY provider can read a NEW unassigned ticket in scope', async () => {
    const prisma = makePrisma(null, TicketStatus.NEW)
    const svc = makeServiceContractsService()

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: svc as any,
      actor: {
        id: TECH_ID,
        role: UserRole.TECHNICIAN,
        companyId: SECONDARY_PROVIDER_ID,
      },
      ticketId: TICKET_ID,
    })

    expect(result.visibilityMode).toBe('provider_primary')
    expect(result.scopeCompanyId).toBe(CLIENT_ID)
  })

  it('ADMIN executor at SECONDARY provider can read their assigned ticket', async () => {
    const prisma = makePrisma(TECH_ID, TicketStatus.ASSIGNED)
    const svc = makeServiceContractsService()

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: svc as any,
      actor: {
        id: TECH_ID,
        role: UserRole.ADMIN,
        companyId: SECONDARY_PROVIDER_ID,
      },
      ticketId: TICKET_ID,
    })

    expect(result.visibilityMode).toBe('provider_primary')
    expect(result.scopeCompanyId).toBe(CLIENT_ID)
  })
})

// ── 3. assign() — cross-company SECONDARY executor ────────────────────────────

describe('TicketsAssignmentService.assign — SECONDARY executor', () => {
  /** Build a service-contracts mock that returns a given contract role for the SECONDARY lookup. */
  function makeContracts(linkedAccessRole: ServiceContractRole | null) {
    return {
      __linkedAccessRole: linkedAccessRole,
      // Arg-aware: the acting PRIMARY provider holds PRIMARY access to the client
      // (so its detail read is unrestricted), while the cross-company executor's
      // SECONDARY_PROVIDER_ID resolves to the role under test.
      getLinkedClientAccess: jest
        .fn()
        .mockImplementation(async (providerCompanyId: string) => {
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
      listSecondaryProviderCompanyIds: jest
        .fn()
        .mockResolvedValue([SECONDARY_PROVIDER_ID]),
      // For management path resolution in resolveReadableTicketAccess
      listLinkedClients: jest.fn().mockResolvedValue([
        {
          linkedClientCompanyId: CLIENT_ID,
          role: ServiceContractRole.PRIMARY,
        },
      ]),
      assertPrimaryLinkedClientAccess: jest.fn().mockResolvedValue(undefined),
    }
  }

  function makeContractContextMock(
    linkedAccessRole: ServiceContractRole | null,
    options?: {
      primarySpecializationNames?: string[]
      secondarySpecializationNames?: string[]
      secondaryLocationIds?: string[]
    },
  ) {
    const buildContext = (
      providerCompanyId: string,
      roleInContract: ServiceContractRole,
      specializationNames: string[],
      locationIds: string[] = [],
    ) => ({
      contractId: `contract-${providerCompanyId}`,
      serviceContractId: `contract-${providerCompanyId}`,
      clientCompanyId: CLIENT_ID,
      providerCompanyId,
      roleInContract,
      locationMode:
        locationIds.length > 0
          ? ServiceContractLocationMode.SELECTED_LOCATIONS
          : ServiceContractLocationMode.ALL_LOCATIONS,
      locationIds,
      specializationMode:
        specializationNames.length > 0 ? 'EXPLICIT' : 'UNCONFIGURED',
      specializationIds: specializationNames.map((name) => `${providerCompanyId}-${name}`),
      specializationNames,
      contractLocationScope:
        locationIds.length > 0
          ? { mode: 'bound_locations' as const, locationIds }
          : { mode: 'tenant_wide' as const, locationIds: [] },
      contractSpecializationScope:
        specializationNames.length > 0
          ? {
              mode: 'EXPLICIT' as const,
              specializationIds: specializationNames.map((name) => `${providerCompanyId}-${name}`),
              specializationNames,
            }
          : {
              mode: 'UNCONFIGURED' as const,
              specializationIds: [],
              specializationNames: [],
            },
    })

    return {
      getContractContext: jest.fn(async ({ providerCompanyId }: any) => {
        if (providerCompanyId === PRIMARY_PROVIDER_ID) {
          return buildContext(
            PRIMARY_PROVIDER_ID,
            ServiceContractRole.PRIMARY,
            options?.primarySpecializationNames ?? [],
          )
        }
        if (providerCompanyId === SECONDARY_PROVIDER_ID && linkedAccessRole) {
          return buildContext(
            SECONDARY_PROVIDER_ID,
            linkedAccessRole,
            options?.secondarySpecializationNames ?? [],
            options?.secondaryLocationIds,
          )
        }
        return null
      }),
    }
  }

  function makeTechnicianRow(
    companyId: string,
    overrides?: {
      id?: string
      isActive?: boolean
      specializations?: Array<{ id: string; name: string; isActive?: boolean }>
    },
  ) {
    return {
      id: overrides?.id ?? TECH_ID,
      email: `${overrides?.id ?? TECH_ID}@example.com`,
      firstName: null,
      lastName: null,
      role: UserRole.TECHNICIAN,
      companyId,
      company: null,
      isActive: overrides?.isActive ?? true,
      deletedAt: null,
      technicianSpecializations: (overrides?.specializations ?? []).map((specialization) => ({
        specializationId: specialization.id,
        specialization: {
          id: specialization.id,
          name: specialization.name,
          isActive: specialization.isActive ?? true,
        },
      })),
      assignedTickets: [],
    }
  }

  function makeTx(
    techCompanyId: string,
    overrides?: {
      status?: TicketStatus
      assignedTechnicianId?: string | null
      previousAssigneeCompanyId?: string
      technicianRows?: any[]
    },
  ) {
    const assignedTechnicianId = overrides?.assignedTechnicianId ?? null
    const technicianRows = overrides?.technicianRows ?? [makeTechnicianRow(techCompanyId)]
    return {
      ticket: {
        findFirst: jest.fn().mockResolvedValue({
          id: TICKET_ID,
          companyId: CLIENT_ID,
          locationId: LOCATION_ID,
          status: overrides?.status ?? TicketStatus.NEW,
          assignedTechnicianId,
          assignedTechnician: assignedTechnicianId
            ? { companyId: overrides?.previousAssigneeCompanyId ?? techCompanyId }
            : null,
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
        findMany: jest.fn().mockResolvedValue(technicianRows),
      },
      userAccessScope: { findMany: jest.fn().mockResolvedValue([]) },
      userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
      ticketStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      domainEvent: { create: jest.fn().mockResolvedValue({ id: 'ev-1' }) },
    }
  }

  function makePrisma(tx: ReturnType<typeof makeTx>) {
    // Track calls to ticket.findFirst to return correct responses per stage:
    // 1st: own-company check → null
    // 2nd: executor operational scope → null (ticket is at CLIENT_ID, not in executor PRIMARY scope)
    // 3rd: management path (PRIMARY linked client) → returns ticket
    let callSeq = 0
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
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'actor', technicianSpecializations: [] }),
        findUnique: jest.fn().mockResolvedValue({
          companyId: CLIENT_ID,
          email: 'tech@example.com',
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      technicianSpecialization: { findMany: jest.fn().mockResolvedValue([]) },
      serviceContract: {
        findFirst: jest.fn().mockResolvedValue({ id: 'contract-1' }),
      },
      serviceContractSpecialization: {
        findMany: jest.fn().mockResolvedValue([
          {
            specializationId: 'contract-default',
            specialization: { name: 'Default' },
          },
        ]),
      },
      ticket: {
        findFirst: jest.fn().mockImplementation(async () => {
          callSeq++
          if (callSeq === 1) return null // own-company check
          if (callSeq === 2) return null // executor scope (no SECONDARY clients for PRIMARY provider)
          // 3rd: management path
          return {
            id: TICKET_ID,
            companyId: CLIENT_ID,
            locationId: LOCATION_ID,
            status: TicketStatus.NEW,
            assignedTechnicianId: null,
            problemCategory: { specializationLinks: [] },
          }
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
    } as any
  }

  function makeService(prisma: any, contracts: any, contractContext?: any) {
    const query = { getOne: jest.fn().mockResolvedValue({ id: TICKET_ID }) }
    const timeline = {
      recordTx: jest.fn().mockResolvedValue({ id: 'ev-1' }),
      recordLegacyTx: jest.fn().mockResolvedValue({ id: 'ev-2' }),
    }
    const notifications = {
      scheduleTicketAssignedToTechnician: jest.fn(),
      onTicketAssigned: jest.fn(),
    }
    const service = new TicketsAssignmentService(
      prisma,
      {} as any,
      query as any,
      timeline as any,
      {} as any,
      contracts,
      {} as any,
      notifications as any,
      (contractContext ?? makeContractContextMock(contracts.__linkedAccessRole ?? null)) as any,
    )
    return Object.assign(service, { __testTimeline: timeline })
  }

  it('succeeds when executor belongs to a SECONDARY provider', async () => {
    const contracts = makeContracts(ServiceContractRole.SECONDARY)
    const tx = makeTx(SECONDARY_PROVIDER_ID)
    const prisma = makePrisma(tx)
    const svc = makeService(prisma, contracts)

    const result = await svc.assign(
      PRIMARY_PROVIDER_ID,
      {
        id: 'actor-admin',
        role: UserRole.ADMIN,
        companyId: PRIMARY_PROVIDER_ID,
      },
      TICKET_ID,
      TECH_ID,
    )

    expect(result).toBeDefined()
    expect(tx.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedTechnicianId: TECH_ID }),
      }),
    )
    // Must have verified the SECONDARY contract for the cross-company executor
    expect(contracts.getLinkedClientAccess).toHaveBeenCalledWith(
      SECONDARY_PROVIDER_ID,
      CLIENT_ID,
    )
    expect(tx.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          deletedAt: null,
        }),
      }),
    )
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
    )
  })

  it('allows SECONDARY provider admin to reassign internally after the ticket entered its contour', async () => {
    const contracts = makeContracts(ServiceContractRole.SECONDARY)
    const tx = makeTx(SECONDARY_PROVIDER_ID, {
      status: TicketStatus.ASSIGNED,
      assignedTechnicianId: 'old-secondary-tech',
      previousAssigneeCompanyId: SECONDARY_PROVIDER_ID,
    })
    const prisma = makePrisma(tx)
    const svc = makeService(prisma, contracts)

    await expect(
      svc.assign(
        SECONDARY_PROVIDER_ID,
        {
          id: 'secondary-admin',
          role: UserRole.ADMIN,
          companyId: SECONDARY_PROVIDER_ID,
        },
        TICKET_ID,
        TECH_ID,
        CLIENT_ID,
      ),
    ).resolves.toBeDefined()

    expect(tx.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedTechnicianId: TECH_ID }),
      }),
    )
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
    )
  })

  it('denies SECONDARY provider admin direct assignment before the ticket enters its contour', async () => {
    const contracts = makeContracts(ServiceContractRole.SECONDARY)
    const tx = makeTx(SECONDARY_PROVIDER_ID)
    const prisma = makePrisma(tx)
    const svc = makeService(prisma, contracts)

    await expect(
      svc.assign(
        SECONDARY_PROVIDER_ID,
        {
          id: 'secondary-admin',
          role: UserRole.ADMIN,
          companyId: SECONDARY_PROVIDER_ID,
        },
        TICKET_ID,
        TECH_ID,
        CLIENT_ID,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)

    expect(tx.ticket.update).not.toHaveBeenCalled()
  })

  it('denies SECONDARY provider admin reassigning work owned by another provider', async () => {
    const contracts = makeContracts(ServiceContractRole.SECONDARY)
    const tx = makeTx(SECONDARY_PROVIDER_ID, {
      status: TicketStatus.ASSIGNED,
      assignedTechnicianId: 'old-other-provider-tech',
      previousAssigneeCompanyId: 'provider-secondary-other',
    })
    const prisma = makePrisma(tx)
    const svc = makeService(prisma, contracts)

    await expect(
      svc.assign(
        SECONDARY_PROVIDER_ID,
        {
          id: 'secondary-admin',
          role: UserRole.ADMIN,
          companyId: SECONDARY_PROVIDER_ID,
        },
        TICKET_ID,
        TECH_ID,
        CLIENT_ID,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)

    expect(tx.ticket.update).not.toHaveBeenCalled()
  })

  it('denies SECONDARY provider admin assigning to another subcontractor company', async () => {
    const otherSecondaryProviderId = 'provider-secondary-other'
    const contracts = makeContracts(ServiceContractRole.SECONDARY)
    const tx = makeTx(otherSecondaryProviderId, {
      status: TicketStatus.ASSIGNED,
      assignedTechnicianId: 'old-secondary-tech',
      previousAssigneeCompanyId: SECONDARY_PROVIDER_ID,
    })
    const prisma = makePrisma(tx)
    const svc = makeService(prisma, contracts)

    await expect(
      svc.assign(
        SECONDARY_PROVIDER_ID,
        {
          id: 'secondary-admin',
          role: UserRole.ADMIN,
          companyId: SECONDARY_PROVIDER_ID,
        },
        TICKET_ID,
        TECH_ID,
        CLIENT_ID,
      ),
    ).rejects.toBeDefined()

    expect(tx.ticket.update).not.toHaveBeenCalled()
  })

  it('rejects direct assignment to inactive executor users', async () => {
    const contracts = makeContracts(ServiceContractRole.SECONDARY)
    const tx = makeTx(SECONDARY_PROVIDER_ID, { technicianRows: [] })
    const prisma = makePrisma(tx)
    const svc = makeService(prisma, contracts)

    await expect(
      svc.assign(
        PRIMARY_PROVIDER_ID,
        {
          id: 'actor-admin',
          role: UserRole.ADMIN,
          companyId: PRIMARY_PROVIDER_ID,
        },
        TICKET_ID,
        TECH_ID,
      ),
    ).rejects.toBeInstanceOf(NotFoundException)

    expect(tx.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          deletedAt: null,
        }),
      }),
    )
    expect(tx.ticket.update).not.toHaveBeenCalled()
  })

  it('allows direct assignment to SECONDARY executor when specialization names match across tenant UUIDs', async () => {
    const contracts = makeContracts(ServiceContractRole.SECONDARY)
    const tx = makeTx(SECONDARY_PROVIDER_ID, {
      technicianRows: [
        makeTechnicianRow(SECONDARY_PROVIDER_ID, {
          specializations: [
            {
              id: 'subcontractor-spec-cond',
              name: HVAC_SPEC_NAME,
            },
          ],
        }),
      ],
    })
    tx.ticket.findFirst.mockResolvedValue({
      id: TICKET_ID,
      companyId: CLIENT_ID,
      locationId: LOCATION_ID,
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      assignedTechnician: null,
      problemCategory: {
        specializationLinks: [
          {
            specializationId: HVAC_SPEC_ID,
            specialization: {
              id: HVAC_SPEC_ID,
              name: HVAC_SPEC_NAME,
              isActive: true,
            },
          },
        ],
      },
    })
    const prisma = makePrisma(tx)
    const svc = makeService(
      prisma,
      contracts,
      makeContractContextMock(ServiceContractRole.SECONDARY, {
        primarySpecializationNames: [HVAC_SPEC_NAME],
        secondarySpecializationNames: [HVAC_SPEC_NAME],
      }),
    )

    await expect(
      svc.assign(
        PRIMARY_PROVIDER_ID,
        {
          id: 'actor-admin',
          role: UserRole.ADMIN,
          companyId: PRIMARY_PROVIDER_ID,
        },
        TICKET_ID,
        TECH_ID,
      ),
    ).resolves.toBeDefined()

    expect(tx.ticket.update).toHaveBeenCalled()
  })

  it('rejects direct assignment to SECONDARY executor without required category specialization', async () => {
    const contracts = makeContracts(ServiceContractRole.SECONDARY)
    const tx = makeTx(SECONDARY_PROVIDER_ID, {
      technicianRows: [
        makeTechnicianRow(SECONDARY_PROVIDER_ID, {
          specializations: [
            {
              id: 'subcontractor-spec-electric',
              name: 'Электрик',
            },
          ],
        }),
      ],
    })
    tx.ticket.findFirst.mockResolvedValue({
      id: TICKET_ID,
      companyId: CLIENT_ID,
      locationId: LOCATION_ID,
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      assignedTechnician: null,
      problemCategory: {
        specializationLinks: [
          {
            specializationId: HVAC_SPEC_ID,
            specialization: {
              id: HVAC_SPEC_ID,
              name: HVAC_SPEC_NAME,
              isActive: true,
            },
          },
        ],
      },
    })
    const prisma = makePrisma(tx)
    const svc = makeService(
      prisma,
      contracts,
      makeContractContextMock(ServiceContractRole.SECONDARY, {
        primarySpecializationNames: [HVAC_SPEC_NAME],
        secondarySpecializationNames: [HVAC_SPEC_NAME],
      }),
    )

    await expect(
      svc.assign(
        PRIMARY_PROVIDER_ID,
        {
          id: 'actor-admin',
          role: UserRole.ADMIN,
          companyId: PRIMARY_PROVIDER_ID,
        },
        TICKET_ID,
        TECH_ID,
      ),
    ).rejects.toBeInstanceOf(NotFoundException)

    expect(tx.ticket.update).not.toHaveBeenCalled()
  })

  it('throws NotFoundException when executor company has no contract with client', async () => {
    const contracts = makeContracts(null)
    const tx = makeTx('unrelated-company')
    const prisma = makePrisma(tx)
    const svc = makeService(prisma, contracts)

    await expect(
      svc.assign(
        PRIMARY_PROVIDER_ID,
        {
          id: 'actor-admin',
          role: UserRole.ADMIN,
          companyId: PRIMARY_PROVIDER_ID,
        },
        TICKET_ID,
        TECH_ID,
      ),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('throws NotFoundException when executor company has PRIMARY (not SECONDARY) contract', async () => {
    const contracts = makeContracts(ServiceContractRole.PRIMARY)
    const tx = makeTx('other-primary-provider')
    const prisma = makePrisma(tx)
    const svc = makeService(prisma, contracts)

    await expect(
      svc.assign(
        PRIMARY_PROVIDER_ID,
        {
          id: 'actor-admin',
          role: UserRole.ADMIN,
          companyId: PRIMARY_PROVIDER_ID,
        },
        TICKET_ID,
        TECH_ID,
      ),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})

// ── 4. TicketsPolicy.canChangeStatus — SECONDARY executor ────────────────────

describe('TicketsPolicy.canChangeStatus — SECONDARY executor', () => {
  const policy = new TicketsPolicy()

  it('allows SECONDARY executor to change status on their assigned ticket', () => {
    // In updateStatus, operationCompanyId = actor.companyId for provider_primary mode,
    // so both user.companyId and ticket.companyId equal SECONDARY_PROVIDER_ID.
    const result = policy.canChangeStatus({
      user: {
        id: TECH_ID,
        role: UserRole.TECHNICIAN,
        isExecutor: true,
        companyId: SECONDARY_PROVIDER_ID,
      },
      ticket: {
        companyId: SECONDARY_PROVIDER_ID,
        assignedTechnicianId: TECH_ID,
      },
    })
    expect(result.allowed).toBe(true)
  })

  it('denies executor status change when ticket is assigned to a different technician', () => {
    const result = policy.canChangeStatus({
      user: {
        id: TECH_ID,
        role: UserRole.TECHNICIAN,
        isExecutor: true,
        companyId: SECONDARY_PROVIDER_ID,
      },
      ticket: {
        companyId: SECONDARY_PROVIDER_ID,
        assignedTechnicianId: 'other-tech',
      },
    })
    expect(result.allowed).toBe(false)
  })

  it('SECONDARY executor without a contract cannot access the ticket (NotFoundException)', async () => {
    // No PRIMARY clients, no SECONDARY clients → executor scope resolves to own company only.
    // The ticket is at CLIENT_ID, so findFirst returns null and NotFoundException is thrown.
    const svcContracts = {
      getLinkedClientAccess: jest.fn(),
      listPrimaryLinkedClientIds: jest.fn().mockResolvedValue([]),
      listSecondaryLinkedClientIds: jest.fn().mockResolvedValue([]),
      listLinkedClients: jest.fn().mockResolvedValue([]),
    }

    let callCount = 0
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: SECONDARY_PROVIDER_ID,
          allowTechnicianClaim: true,
        }),
      },
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: TECH_ID, technicianSpecializations: [] }),
      },
      userLocationBinding: { findMany: jest.fn().mockResolvedValue([]) },
      technicianSpecialization: { findMany: jest.fn().mockResolvedValue([]) },
      ticket: {
        findFirst: jest.fn().mockImplementation(async () => {
          callCount++
          return null // ticket never found — it belongs to CLIENT_ID, not SECONDARY_PROVIDER_ID
        }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any

    await expect(
      resolveReadableTicketAccess({
        prisma,
        serviceContractsService: svcContracts as any,
        actor: {
          id: TECH_ID,
          role: UserRole.TECHNICIAN,
          companyId: SECONDARY_PROVIDER_ID,
        },
        ticketId: TICKET_ID,
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})

// ── 5. listAssignmentCandidates follows current ContractContext ──────────────

describe('TicketsAssignmentService.listAssignmentCandidates — contract context authority', () => {
  const OTHER_SECONDARY_PROVIDER_ID = 'provider-secondary-other'
  const CLIENT_Y_ID = 'client-y'

  function pairKey(providerCompanyId: string, clientCompanyId: string) {
    return `${providerCompanyId}:${clientCompanyId}`
  }

  function makeCandidateRow(
    id: string,
    companyId: string,
    specializations: Array<{ id: string; name: string; isActive?: boolean }> = [],
  ) {
    return {
      id,
      email: `${id}@example.com`,
      firstName: null,
      lastName: null,
      role: UserRole.TECHNICIAN,
      companyId,
      company: null,
      technicianSpecializations: specializations.map((specialization) => ({
        specializationId: specialization.id,
        specialization: {
          id: specialization.id,
          name: specialization.name,
          isActive: specialization.isActive ?? true,
        },
      })),
      assignedTickets: [],
    }
  }

  function makeTicket(overrides: any = {}) {
    const assignedTechnicianId = overrides.assignedTechnicianId ?? null
    return {
      id: TICKET_ID,
      companyId: overrides.companyId ?? CLIENT_ID,
      locationId: overrides.locationId ?? LOCATION_ID,
      status: overrides.status ?? TicketStatus.NEW,
      assignedTechnicianId,
      assignedTechnician: assignedTechnicianId
        ? { companyId: overrides.assignedTechnicianCompanyId }
        : null,
      problemCategory: {
        id: 'cat-1',
        name: 'Test',
        specializationLinks: overrides.specializationLinks ?? [],
      },
      location: {
        id: overrides.locationId ?? LOCATION_ID,
        name: 'Loc',
        platformCode: null,
        externalCode: null,
        city: 'City',
        address: 'Addr',
      },
    }
  }

  function makeContracts(params: {
    roles: Record<string, ServiceContractRole | null>
    secondaryProviderIdsByClient?: Record<string, string[]>
  }) {
    const roleFor = (providerCompanyId: string, clientCompanyId: string) =>
      params.roles[pairKey(providerCompanyId, clientCompanyId)] ?? null

    return {
      getLinkedClientAccess: jest.fn(async (providerCompanyId: string, clientCompanyId: string) => {
        const role = roleFor(providerCompanyId, clientCompanyId)
        if (!role) return null
        return {
          role,
          status: 'ACTIVE',
          clientCompanyId,
          providerCompanyId,
          locationMode: ServiceContractLocationMode.ALL_LOCATIONS,
          effectiveLocationScope: { mode: 'tenant_wide' as const, locationIds: [] },
          locations: [],
        }
      }),
      listPrimaryLinkedClientIds: jest.fn(async (providerCompanyId: string) =>
        Object.entries(params.roles)
          .filter(([key, role]) => key.startsWith(`${providerCompanyId}:`) && role === ServiceContractRole.PRIMARY)
          .map(([key]) => key.split(':')[1]),
      ),
      listSecondaryLinkedClientIds: jest.fn(async (providerCompanyId: string) =>
        Object.entries(params.roles)
          .filter(([key, role]) => key.startsWith(`${providerCompanyId}:`) && role === ServiceContractRole.SECONDARY)
          .map(([key]) => key.split(':')[1]),
      ),
      listSecondaryProviderCompanyIds: jest.fn(async (clientCompanyId: string) =>
        params.secondaryProviderIdsByClient?.[clientCompanyId] ?? [],
      ),
      listLinkedClients: jest.fn(async (providerCompanyId: string) =>
        Object.entries(params.roles)
          .filter(([key, role]) => key.startsWith(`${providerCompanyId}:`) && !!role)
          .map(([key, role]) => ({
            linkedClientCompanyId: key.split(':')[1],
            role,
          })),
      ),
      assertPrimaryLinkedClientAccess: jest.fn().mockResolvedValue(undefined),
    }
  }

  function makeContractContext(params: {
    roles: Record<string, ServiceContractRole | null>
    specializationNamesByPair?: Record<string, string[]>
    locationIdsByPair?: Record<string, string[]>
  }) {
    return {
      getContractContext: jest.fn(async ({ providerCompanyId, clientCompanyId }: any) => {
        const key = pairKey(providerCompanyId, clientCompanyId)
        const role = params.roles[key]
        if (!role) return null
        const specializationNames = params.specializationNamesByPair?.[key] ?? []
        const specializationIds = specializationNames.map((name) => `${providerCompanyId}-${name}`)
        const locationIds = params.locationIdsByPair?.[key] ?? []
        return {
          contractId: `contract-${key}`,
          serviceContractId: `contract-${key}`,
          clientCompanyId,
          providerCompanyId,
          roleInContract: role,
          locationMode:
            locationIds.length > 0
              ? ServiceContractLocationMode.SELECTED_LOCATIONS
              : ServiceContractLocationMode.ALL_LOCATIONS,
          locationIds,
          specializationMode: specializationNames.length > 0 ? 'EXPLICIT' : 'UNCONFIGURED',
          specializationIds,
          specializationNames,
          contractLocationScope:
            locationIds.length > 0
              ? { mode: 'bound_locations' as const, locationIds }
              : { mode: 'tenant_wide' as const, locationIds: [] },
          contractSpecializationScope:
            specializationNames.length > 0
              ? {
                  mode: 'EXPLICIT' as const,
                  specializationIds,
                  specializationNames,
                }
              : {
                  mode: 'UNCONFIGURED' as const,
                  specializationIds: [],
                  specializationNames: [],
                },
        }
      }),
    }
  }

  function makeCandidatePrisma(params: {
    ticket: ReturnType<typeof makeTicket>
    rows?: any[]
    userLocationBindings?: any[]
  }) {
    const rows = params.rows ?? []
    const candidateUserFindMany = jest.fn(async ({ where }: any) => {
      if (where?.id?.in) {
        return rows.filter((row) => where.id.in.includes(row.id))
      }
      const filter = where?.companyId
      const companyIds =
        typeof filter === 'string'
          ? [filter]
          : Array.isArray(filter?.in)
            ? filter.in
            : []
      return rows.filter((row) => companyIds.includes(row.companyId))
    })
    return {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: PRIMARY_PROVIDER_ID,
          autoAssignEnabled: false,
          allowTechnicianClaim: true,
        }),
      },
      user: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'actor', isExecutor: true, technicianSpecializations: [] }),
        findMany: candidateUserFindMany,
      },
      ticket: {
        findFirst: jest.fn(async ({ where, include }: any) => {
          if (include?.problemCategory) return params.ticket
          const serializedWhere = JSON.stringify(where ?? {})
          if (!serializedWhere.includes(TICKET_ID)) return null
          if (serializedWhere.includes(params.ticket.companyId)) {
            return {
              id: params.ticket.id,
              companyId: params.ticket.companyId,
              locationId: params.ticket.locationId,
              assignedTechnicianId: params.ticket.assignedTechnicianId,
              status: params.ticket.status,
              problemCategory: params.ticket.problemCategory,
            }
          }
          return null
        }),
        findUnique: jest.fn().mockResolvedValue(params.ticket),
      },
      userAccessScope: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      userLocationBinding: {
        findMany: jest.fn().mockResolvedValue(params.userLocationBindings ?? []),
      },
      technicianSpecialization: { findMany: jest.fn().mockResolvedValue([]) },
      serviceContract: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'contract-access',
          locationMode: ServiceContractLocationMode.ALL_LOCATIONS,
          locations: [],
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      serviceContractSpecialization: {
        findMany: jest.fn().mockResolvedValue([
          {
            specializationId: HVAC_SPEC_ID,
            specialization: { name: HVAC_SPEC_NAME },
          },
        ]),
      },
    } as any
  }

  function makeService(prisma: any, contracts: any, contractContext: any) {
    return new TicketsAssignmentService(
      prisma,
      {} as any,
      { getOne: jest.fn().mockResolvedValue({}) } as any,
      {} as any,
      {} as any,
      contracts as any,
      {} as any,
      {} as any,
      contractContext as any,
    )
  }

  it('PRIMARY candidates include own workforce and eligible SECONDARY providers in the same contract context', async () => {
    const roles = {
      [pairKey(PRIMARY_PROVIDER_ID, CLIENT_ID)]: ServiceContractRole.PRIMARY,
      [pairKey(SECONDARY_PROVIDER_ID, CLIENT_ID)]: ServiceContractRole.SECONDARY,
    }
    const contracts = makeContracts({
      roles,
      secondaryProviderIdsByClient: { [CLIENT_ID]: [SECONDARY_PROVIDER_ID] },
    })
    const prisma = makeCandidatePrisma({ ticket: makeTicket(), rows: [] })
    const svc = makeService(prisma, contracts, makeContractContext({ roles }))

    const result = await svc.listAssignmentCandidates(
      PRIMARY_PROVIDER_ID,
      { id: 'actor', role: UserRole.ADMIN },
      TICKET_ID,
      CLIENT_ID,
    )

    expect(contracts.listSecondaryProviderCompanyIds).toHaveBeenCalledWith(CLIENT_ID)
    const findManyCall = prisma.user.findMany.mock.calls[0][0]
    expect(findManyCall.where.companyId.in).toEqual(
      expect.arrayContaining([PRIMARY_PROVIDER_ID, SECONDARY_PROVIDER_ID]),
    )
    expect(result.meta.roleInContract).toBe(ServiceContractRole.PRIMARY)
    expect(result.meta.directAssignmentAllowed).toBe(true)
  })

  it('SECONDARY candidates contain only own employees after the ticket is assigned to that provider', async () => {
    const roles = {
      [pairKey(SECONDARY_PROVIDER_ID, CLIENT_ID)]: ServiceContractRole.SECONDARY,
      [pairKey(OTHER_SECONDARY_PROVIDER_ID, CLIENT_ID)]: ServiceContractRole.SECONDARY,
    }
    const ticket = makeTicket({
      status: TicketStatus.ASSIGNED,
      assignedTechnicianId: 'old-secondary-tech',
      assignedTechnicianCompanyId: SECONDARY_PROVIDER_ID,
    })
    const prisma = makeCandidatePrisma({
      ticket,
      rows: [
        makeCandidateRow(TECH_ID, SECONDARY_PROVIDER_ID),
        makeCandidateRow('other-tech', OTHER_SECONDARY_PROVIDER_ID),
      ],
    })
    const svc = makeService(
      prisma,
      makeContracts({ roles, secondaryProviderIdsByClient: { [CLIENT_ID]: [OTHER_SECONDARY_PROVIDER_ID] } }),
      makeContractContext({ roles }),
    )

    const result = await svc.listAssignmentCandidates(
      SECONDARY_PROVIDER_ID,
      { id: 'secondary-admin', role: UserRole.ADMIN },
      TICKET_ID,
      CLIENT_ID,
    )

    expect(result.matched.map((candidate: any) => candidate.id)).toEqual([TECH_ID])
    expect(result.meta.workforceCompanyIds).toEqual([SECONDARY_PROVIDER_ID])
    expect(result.meta.roleInContract).toBe(ServiceContractRole.SECONDARY)
    expect(result.meta.directAssignmentAllowed).toBe(true)
    expect(prisma.user.findMany.mock.calls[0][0].where.companyId).toBe(SECONDARY_PROVIDER_ID)
  })

  it('SECONDARY returns no direct candidates for a NEW ticket before delegation', async () => {
    const roles = {
      [pairKey(SECONDARY_PROVIDER_ID, CLIENT_ID)]: ServiceContractRole.SECONDARY,
    }
    const prisma = makeCandidatePrisma({
      ticket: makeTicket(),
      rows: [makeCandidateRow(TECH_ID, SECONDARY_PROVIDER_ID)],
    })
    const svc = makeService(
      prisma,
      makeContracts({ roles }),
      makeContractContext({ roles }),
    )

    const result = await svc.listAssignmentCandidates(
      SECONDARY_PROVIDER_ID,
      { id: 'secondary-admin', role: UserRole.ADMIN },
      TICKET_ID,
      CLIENT_ID,
    )

    expect(result.matched).toEqual([])
    expect(result.others).toEqual([])
    expect(result.meta.directAssignmentAllowed).toBe(false)
    expect(result.meta.blockReason).toBe('secondary_requires_existing_assignment')
    const candidateQueries = prisma.user.findMany.mock.calls.filter(
      ([call]: any[]) => !!call?.where?.role,
    )
    expect(candidateQueries).toHaveLength(0)
  })

  it('SECONDARY returns no direct candidates when another provider currently owns the work', async () => {
    const roles = {
      [pairKey(SECONDARY_PROVIDER_ID, CLIENT_ID)]: ServiceContractRole.SECONDARY,
      [pairKey(OTHER_SECONDARY_PROVIDER_ID, CLIENT_ID)]: ServiceContractRole.SECONDARY,
    }
    const prisma = makeCandidatePrisma({
      ticket: makeTicket({
        status: TicketStatus.ASSIGNED,
        assignedTechnicianId: 'old-other-tech',
        assignedTechnicianCompanyId: OTHER_SECONDARY_PROVIDER_ID,
      }),
      rows: [makeCandidateRow(TECH_ID, SECONDARY_PROVIDER_ID)],
    })
    const svc = makeService(
      prisma,
      makeContracts({ roles }),
      makeContractContext({ roles }),
    )

    const result = await svc.listAssignmentCandidates(
      SECONDARY_PROVIDER_ID,
      { id: 'secondary-admin', role: UserRole.ADMIN },
      TICKET_ID,
      CLIENT_ID,
    )

    expect(result.matched).toEqual([])
    expect(result.meta.workforceCompanyIds).toEqual([])
    expect(result.meta.blockReason).toBe('secondary_requires_existing_assignment')
    const candidateQueries = prisma.user.findMany.mock.calls.filter(
      ([call]: any[]) => !!call?.where?.role,
    )
    expect(candidateQueries).toHaveLength(0)
  })

  it('same provider receives PRIMARY assignment authority in another client contract', async () => {
    const roles = {
      [pairKey(SECONDARY_PROVIDER_ID, CLIENT_Y_ID)]: ServiceContractRole.PRIMARY,
      [pairKey(OTHER_SECONDARY_PROVIDER_ID, CLIENT_Y_ID)]: ServiceContractRole.SECONDARY,
    }
    const prisma = makeCandidatePrisma({
      ticket: makeTicket({ companyId: CLIENT_Y_ID }),
      rows: [],
    })
    const svc = makeService(
      prisma,
      makeContracts({
        roles,
        secondaryProviderIdsByClient: { [CLIENT_Y_ID]: [OTHER_SECONDARY_PROVIDER_ID] },
      }),
      makeContractContext({ roles }),
    )

    const result = await svc.listAssignmentCandidates(
      SECONDARY_PROVIDER_ID,
      { id: 'provider-admin', role: UserRole.ADMIN },
      TICKET_ID,
      CLIENT_Y_ID,
    )

    const findManyCall = prisma.user.findMany.mock.calls[0][0]
    expect(findManyCall.where.companyId.in).toEqual(
      expect.arrayContaining([SECONDARY_PROVIDER_ID, OTHER_SECONDARY_PROVIDER_ID]),
    )
    expect(result.meta.roleInContract).toBe(ServiceContractRole.PRIMARY)
    expect(result.meta.directAssignmentAllowed).toBe(true)
  })

  it('excludes technicians without the required ticket specialization', async () => {
    const roles = {
      [pairKey(PRIMARY_PROVIDER_ID, CLIENT_ID)]: ServiceContractRole.PRIMARY,
      [pairKey(SECONDARY_PROVIDER_ID, CLIENT_ID)]: ServiceContractRole.SECONDARY,
    }
    const specializationLinks = [
      {
        specializationId: HVAC_SPEC_ID,
        specialization: {
          id: HVAC_SPEC_ID,
          name: HVAC_SPEC_NAME,
          isActive: true,
        },
      },
    ]
    const prisma = makeCandidatePrisma({
      ticket: makeTicket({ specializationLinks }),
      rows: [
        makeCandidateRow('hvac-tech', SECONDARY_PROVIDER_ID, [
          { id: 'secondary-hvac', name: HVAC_SPEC_NAME },
        ]),
        makeCandidateRow('electric-tech', SECONDARY_PROVIDER_ID, [
          { id: 'secondary-electric', name: 'Электрик' },
        ]),
      ],
    })
    const svc = makeService(
      prisma,
      makeContracts({
        roles,
        secondaryProviderIdsByClient: { [CLIENT_ID]: [SECONDARY_PROVIDER_ID] },
      }),
      makeContractContext({
        roles,
        specializationNamesByPair: {
          [pairKey(PRIMARY_PROVIDER_ID, CLIENT_ID)]: [HVAC_SPEC_NAME],
          [pairKey(SECONDARY_PROVIDER_ID, CLIENT_ID)]: [HVAC_SPEC_NAME],
        },
      }),
    )

    const result = await svc.listAssignmentCandidates(
      PRIMARY_PROVIDER_ID,
      { id: 'actor', role: UserRole.ADMIN },
      TICKET_ID,
      CLIENT_ID,
    )

    expect(result.matched.map((candidate: any) => candidate.id)).toEqual(['hvac-tech'])
    expect(result.others).toEqual([])
  })

  it('excludes technicians outside their employee location bindings', async () => {
    const roles = {
      [pairKey(PRIMARY_PROVIDER_ID, CLIENT_ID)]: ServiceContractRole.PRIMARY,
      [pairKey(SECONDARY_PROVIDER_ID, CLIENT_ID)]: ServiceContractRole.SECONDARY,
    }
    const prisma = makeCandidatePrisma({
      ticket: makeTicket(),
      rows: [makeCandidateRow(TECH_ID, SECONDARY_PROVIDER_ID)],
      userLocationBindings: [
        {
          userId: TECH_ID,
          companyId: SECONDARY_PROVIDER_ID,
          locationId: 'different-location',
        },
      ],
    })
    const svc = makeService(
      prisma,
      makeContracts({
        roles,
        secondaryProviderIdsByClient: { [CLIENT_ID]: [SECONDARY_PROVIDER_ID] },
      }),
      makeContractContext({ roles }),
    )

    const result = await svc.listAssignmentCandidates(
      PRIMARY_PROVIDER_ID,
      { id: 'actor', role: UserRole.ADMIN },
      TICKET_ID,
      CLIENT_ID,
    )

    expect(result.matched).toEqual([])
    expect(result.others).toEqual([])
  })
})
