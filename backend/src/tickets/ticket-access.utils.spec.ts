import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { ServiceContractRole, UserAccessLocationMode, UserRole } from '@prisma/client'

import {
  resolveActorLocationScope,
  resolveReadableTicketAccess,
  resolveTechnicianOperationalScope,
  resolveTicketOperationAccess,
  resolveTicketReadScope,
} from './ticket-access.utils'

describe('ticket-access utils SECONDARY provider visibility', () => {
  const providerCompanyId = 'provider-1'
  const clientCompanyId = 'client-1'
  const ticketId = 'ticket-1'

  function makeServiceContractsService(contractRole: ServiceContractRole) {
    return {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        role: contractRole,
        status: 'ACTIVE',
        clientCompanyId,
        providerCompanyId,
      }),
      listLinkedClients: jest.fn().mockResolvedValue([
        {
          linkedClientCompanyId: clientCompanyId,
          role: contractRole,
        },
      ]),
      listPrimaryLinkedClientIds: jest.fn().mockResolvedValue([]),
      listSecondaryLinkedClientIds: jest.fn().mockResolvedValue([]),
    }
  }

  // Evaluates a SECONDARY operational-scope WHERE (the shape produced by
  // buildSecondaryOperationalScopeWhere) against a ticket row.
  function fieldMatches(condition: any, value: any): boolean {
    if (condition === undefined) return true
    if (condition === null || typeof condition !== 'object' || condition instanceof Date) {
      return value === condition
    }
    if ('equals' in condition) return value === condition.equals
    if ('in' in condition) return Array.isArray(condition.in) && condition.in.includes(value)
    if ('notIn' in condition) return Array.isArray(condition.notIn) && !condition.notIn.includes(value)
    if ('not' in condition) return value !== condition.not
    return true
  }

  function ticketMatchesScope(scopeWhere: any, ticket: any): boolean {
    if (!scopeWhere) return true
    if (scopeWhere.id?.equals === '__no_access__') return false
    if (Array.isArray(scopeWhere.AND)) {
      return scopeWhere.AND.every((part: any) => ticketMatchesScope(part, ticket))
    }
    if (Array.isArray(scopeWhere.OR)) {
      return scopeWhere.OR.some((clause: any) => ticketMatchesScope(clause, ticket))
    }
    if (!fieldMatches(scopeWhere.id, ticket.id)) return false
    if (!fieldMatches(scopeWhere.companyId, ticket.companyId)) return false
    if (!fieldMatches(scopeWhere.locationId, ticket.locationId)) return false
    if (!fieldMatches(scopeWhere.assignedTechnicianId, ticket.assignedTechnicianId)) return false
    if (!fieldMatches(scopeWhere.status, ticket.status)) return false
    return true
  }

  function makePrismaTicketMock(
    opts: {
      ticketCompanyId?: string
      ticketAssignedTechnicianId?: string | null
      ticketLocationId?: string | null
      executorIds?: string[]
      boundLocationIds?: string[]
      boundLocationBindings?: Array<{ companyId: string; locationId: string; clientCompanyId?: string }>
      accessLocationMode?: UserAccessLocationMode | null
      contractLocationIds?: string[]
      directTicket?: any
    } = {},
  ) {
    const ticket = {
      id: ticketId,
      companyId: opts.ticketCompanyId ?? clientCompanyId,
      locationId: opts.ticketLocationId ?? null,
      assignedTechnicianId: opts.ticketAssignedTechnicianId ?? null,
      status: opts.directTicket?.status ?? 'NEW',
    }
    const executorIds = opts.executorIds ?? []
    const bindingRows = opts.boundLocationBindings ?? (opts.boundLocationIds ?? []).map((locationId) => ({
      companyId: providerCompanyId,
      locationId,
      clientCompanyId: undefined,
    }))

    return {
      ticket: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          return ticketMatchesScope(where, ticket) ? { ...ticket } : null
        }),
        findUnique: jest.fn().mockResolvedValue(opts.directTicket ?? null),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: providerCompanyId }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ isExecutor: false, technicianSpecializations: [] }),
        findMany: jest.fn().mockResolvedValue(executorIds.map((id) => ({ id }))),
      },
      userLocationBinding: {
        findMany: jest.fn().mockImplementation(async ({ where }: any = {}) =>
          bindingRows
            .filter((binding) => fieldMatches(where?.companyId, binding.companyId))
            .filter((binding) => binding.clientCompanyId === undefined || fieldMatches(where?.location?.clientCompanyId, binding.clientCompanyId))
            .map((binding) => ({
              companyId: binding.companyId,
              locationId: binding.locationId,
              location: { clientCompanyId: binding.clientCompanyId },
            })),
        ),
      },
      userAccessScope: {
        findUnique: jest.fn().mockResolvedValue(
          opts.accessLocationMode ? { locationMode: opts.accessLocationMode } : null,
        ),
      },
      serviceContract: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'ACTIVE',
          startsAt: null,
          endsAt: null,
          locations: (opts.contractLocationIds ?? []).map((locationId) => ({ locationId })),
        }),
      },
    } as any
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('runtime location scope preserves legacy tenant-wide fallback when no scope row and no bindings exist', async () => {
    const prisma = makePrismaTicketMock()

    const scope = await resolveActorLocationScope({
      prisma,
      actor: {
        id: 'user-1',
        role: UserRole.TECHNICIAN,
        companyId: providerCompanyId,
      },
      scopeCompanyId: providerCompanyId,
    })

    expect(scope).toEqual({ mode: 'tenant_wide', locationIds: [] })
  })

  it('runtime location scope treats explicit restricted-empty as fail-closed', async () => {
    const prisma = makePrismaTicketMock({
      accessLocationMode: UserAccessLocationMode.RESTRICTED_EMPTY,
    })

    const scope = await resolveActorLocationScope({
      prisma,
      actor: {
        id: 'user-1',
        role: UserRole.TECHNICIAN,
        companyId: providerCompanyId,
      },
      scopeCompanyId: providerCompanyId,
    })

    expect(scope).toEqual({ mode: 'restricted_empty', locationIds: [] })
  })

  it('runtime location scope applies explicit restricted-empty to STAFF linked-client visibility', async () => {
    const prisma = makePrismaTicketMock({
      accessLocationMode: UserAccessLocationMode.RESTRICTED_EMPTY,
    })

    const scope = await resolveActorLocationScope({
      prisma,
      actor: {
        id: 'staff-1',
        role: UserRole.STAFF,
        companyId: providerCompanyId,
      },
      scopeCompanyId: clientCompanyId,
    })

    expect(scope).toEqual({ mode: 'restricted_empty', locationIds: [] })
    expect(prisma.userAccessScope.findUnique).toHaveBeenCalledWith({
      where: {
        userId_companyId: {
          userId: 'staff-1',
          companyId: providerCompanyId,
        },
      },
      select: { locationMode: true },
    })
  })

  it('runtime selected-location mode uses bindings and fail-closes when selected set is empty', async () => {
    const withBinding = makePrismaTicketMock({
      accessLocationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      boundLocationIds: ['loc-1', 'loc-1'],
    })
    const emptySelected = makePrismaTicketMock({
      accessLocationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
    })

    await expect(resolveActorLocationScope({
      prisma: withBinding,
      actor: {
        id: 'user-1',
        role: UserRole.TECHNICIAN,
        companyId: providerCompanyId,
      },
      scopeCompanyId: providerCompanyId,
    })).resolves.toEqual({ mode: 'bound_locations', locationIds: ['loc-1'] })
    await expect(resolveActorLocationScope({
      prisma: emptySelected,
      actor: {
        id: 'user-1',
        role: UserRole.TECHNICIAN,
        companyId: providerCompanyId,
      },
      scopeCompanyId: providerCompanyId,
    })).resolves.toEqual({ mode: 'bound_locations', locationIds: [] })
  })

  it('intersects employee bindings with the objects selected in the service contract', async () => {
    const prisma = makePrismaTicketMock({
      accessLocationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      boundLocationIds: ['loc-contract', 'loc-outside'],
      contractLocationIds: ['loc-contract', 'loc-other'],
    })

    await expect(resolveActorLocationScope({
      prisma,
      actor: { id: 'user-1', role: UserRole.TECHNICIAN, companyId: providerCompanyId },
      scopeCompanyId: clientCompanyId,
    })).resolves.toEqual({ mode: 'bound_locations', locationIds: ['loc-contract'] })
  })

  it('uses contract objects as the ceiling for a tenant-wide provider employee', async () => {
    const prisma = makePrismaTicketMock({ contractLocationIds: ['loc-contract'] })

    await expect(resolveActorLocationScope({
      prisma,
      actor: { id: 'admin-1', role: UserRole.ADMIN, companyId: providerCompanyId },
      scopeCompanyId: clientCompanyId,
    })).resolves.toEqual({ mode: 'bound_locations', locationIds: ['loc-contract'] })
  })

  it('runtime location scope fail-closes inactive ADMIN even with a stale JWT', async () => {
    const prisma = makePrismaTicketMock()
    prisma.user.findFirst = jest.fn().mockResolvedValue(null)

    const scope = await resolveActorLocationScope({
      prisma,
      actor: {
        id: 'admin-1',
        role: UserRole.ADMIN,
        companyId: providerCompanyId,
      },
      scopeCompanyId: clientCompanyId,
    })

    expect(scope).toEqual({ mode: 'restricted_empty', locationIds: [] })
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'admin-1',
          companyId: providerCompanyId,
          isActive: true,
          deletedAt: null,
        }),
      }),
    )
  })

  it('TECHNICIAN operational scope rejects inactive JWT actors through the database guard', async () => {
    const prisma = makePrismaTicketMock()
    prisma.user.findFirst = jest.fn(async ({ where }: any) => {
      if (where.isActive === true && where.deletedAt === null) return null
      return {
        id: 'tech-1',
        role: UserRole.TECHNICIAN,
        isExecutor: true,
        technicianSpecializations: [],
      }
    })

    await expect(
      resolveTechnicianOperationalScope({
        prisma,
        serviceContractsService: makeServiceContractsService(ServiceContractRole.PRIMARY) as any,
        actor: {
          id: 'tech-1',
          role: UserRole.TECHNICIAN,
          companyId: providerCompanyId,
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundException)

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'tech-1',
          companyId: providerCompanyId,
          isActive: true,
          deletedAt: null,
        }),
      }),
    )
  })

  it('keeps SECONDARY contract blocked by default for ticket reads (management path, non-executor role)', async () => {
    // Use NETWORK_DIRECTOR: in PROVIDER_LINKED_OVERVIEW_ROLES but NOT executor-capable.
    // This exercises the management board path without hitting the executor scope.
    const prisma = makePrismaTicketMock()
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.SECONDARY)

    await expect(
      resolveReadableTicketAccess({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actor: {
          id: 'user-1',
          role: UserRole.NETWORK_DIRECTOR,
          companyId: providerCompanyId,
        },
        ticketId,
        linkedClientCompanyId: clientCompanyId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(serviceContractsService.getLinkedClientAccess).toHaveBeenCalledWith(providerCompanyId, clientCompanyId)
  })

  it('SECONDARY management path: grants detail only within operational scope (assigned executor)', async () => {
    // Ticket is assigned to the provider's executor, so it falls inside the SECONDARY
    // operational scope and detail access is granted — matching the board/list view.
    const prisma = makePrismaTicketMock({
      executorIds: ['exec-1'],
      ticketAssignedTechnicianId: 'exec-1',
    })
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.SECONDARY)

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: {
        id: 'user-1',
        role: UserRole.NETWORK_DIRECTOR,
        companyId: providerCompanyId,
      },
      ticketId,
      linkedClientCompanyId: clientCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    expect(result.ticket.id).toBe(ticketId)
    expect(result.scopeCompanyId).toBe(clientCompanyId)
    expect(result.visibilityMode).toBe('provider_primary')
  })

  it('linked-client detail: explicit RESTRICTED_EMPTY denies PRIMARY provider detail access', async () => {
    const prisma = makePrismaTicketMock({
      accessLocationMode: UserAccessLocationMode.RESTRICTED_EMPTY,
      ticketLocationId: 'loc-allowed',
    })
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.PRIMARY)

    await expect(
      resolveReadableTicketAccess({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actor: {
          id: 'user-1',
          role: UserRole.ADMIN,
          companyId: providerCompanyId,
        },
        ticketId,
        linkedClientCompanyId: clientCompanyId,
        allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('linked-client detail: SELECTED_LOCATIONS allows only selected location tickets', async () => {
    const prisma = makePrismaTicketMock({
      accessLocationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      boundLocationIds: ['loc-allowed'],
      ticketLocationId: 'loc-allowed',
    })
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.PRIMARY)

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: {
        id: 'user-1',
        role: UserRole.ADMIN,
        companyId: providerCompanyId,
      },
      ticketId,
      linkedClientCompanyId: clientCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    expect(result.ticket.id).toBe(ticketId)

    const outsidePrisma = makePrismaTicketMock({
      accessLocationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      boundLocationIds: ['loc-allowed'],
      ticketLocationId: 'loc-outside',
    })
    await expect(
      resolveReadableTicketAccess({
        prisma: outsidePrisma,
        serviceContractsService: serviceContractsService as any,
        actor: {
          id: 'user-1',
          role: UserRole.ADMIN,
          companyId: providerCompanyId,
        },
        ticketId,
        linkedClientCompanyId: clientCompanyId,
        allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('linked-client detail: SELECTED_LOCATIONS with no bindings denies provider ADMIN direct ticket access', async () => {
    const prisma = makePrismaTicketMock({
      accessLocationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      ticketLocationId: 'loc-any',
    })
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.PRIMARY)

    await expect(
      resolveReadableTicketAccess({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actor: {
          id: 'admin-1',
          role: UserRole.ADMIN,
          companyId: providerCompanyId,
        },
        ticketId,
        linkedClientCompanyId: clientCompanyId,
        allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  function makeSelectedLocationTechnicianPrisma(ticketLocationId: string, ticketCompanyId = clientCompanyId) {
    const directTicket = {
      id: ticketId,
      companyId: ticketCompanyId,
      locationId: ticketLocationId,
      assignedTechnicianId: 'tech-1',
      status: 'ASSIGNED',
      problemCategory: { specializationLinks: [] },
    }
    const prisma = makePrismaTicketMock({
      accessLocationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      executorIds: ['tech-1'],
      ticketAssignedTechnicianId: 'tech-1',
      ticketLocationId,
      ticketCompanyId,
      directTicket,
      boundLocationBindings: [
        { companyId: providerCompanyId, locationId: 'loc-allowed', clientCompanyId },
        { companyId: clientCompanyId, locationId: 'loc-forbidden', clientCompanyId },
      ],
    })
    prisma.user.findFirst.mockResolvedValue({
      id: 'tech-1',
      role: UserRole.TECHNICIAN,
      isExecutor: true,
      technicianSpecializations: [],
    })
    return prisma
  }

  it('TECHNICIAN SELECTED_LOCATIONS ignores stale client-company legacy bindings', async () => {
    const prisma = makeSelectedLocationTechnicianPrisma('loc-allowed')
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.PRIMARY)

    const scope = await resolveTechnicianOperationalScope({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: {
        id: 'tech-1',
        role: UserRole.TECHNICIAN,
        companyId: providerCompanyId,
      },
      linkedClientCompanyId: clientCompanyId,
    })

    expect(scope.locationScopeByCompany[clientCompanyId]).toEqual(['loc-allowed'])
    expect(scope.locationScopeByCompany[clientCompanyId]).not.toContain('loc-forbidden')
    expect(prisma.userLocationBinding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: { in: [providerCompanyId] },
        }),
      }),
    )
  })

  it('TECHNICIAN without explicit scope keeps all permitted linked-client locations readable', async () => {
    const prisma = makePrismaTicketMock({
      executorIds: ['tech-1'],
      ticketAssignedTechnicianId: 'tech-1',
      ticketLocationId: 'loc-any',
      directTicket: {
        id: ticketId,
        companyId: clientCompanyId,
        locationId: 'loc-any',
        assignedTechnicianId: 'tech-1',
        status: 'ASSIGNED',
        problemCategory: { specializationLinks: [] },
      },
    })
    prisma.user.findFirst.mockResolvedValue({
      id: 'tech-1',
      role: UserRole.TECHNICIAN,
      isExecutor: true,
      technicianSpecializations: [],
    })
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.PRIMARY)

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: {
        id: 'tech-1',
        role: UserRole.TECHNICIAN,
        companyId: providerCompanyId,
      },
      ticketId,
      linkedClientCompanyId: clientCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    expect(result.ticket.id).toBe(ticketId)
  })

  it('TECHNICIAN SELECTED_LOCATIONS can read an allowed linked-client ticket', async () => {
    const prisma = makeSelectedLocationTechnicianPrisma('loc-allowed')
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.PRIMARY)

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: {
        id: 'tech-1',
        role: UserRole.TECHNICIAN,
        companyId: providerCompanyId,
      },
      ticketId,
      linkedClientCompanyId: clientCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    expect(result.ticket.id).toBe(ticketId)
    expect(result.visibilityMode).toBe('provider_primary')
  })

  it('TECHNICIAN SELECTED_LOCATIONS cannot read a forbidden linked-client ticket', async () => {
    const prisma = makeSelectedLocationTechnicianPrisma('loc-forbidden')
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.PRIMARY)

    await expect(
      resolveReadableTicketAccess({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actor: {
          id: 'tech-1',
          role: UserRole.TECHNICIAN,
          companyId: providerCompanyId,
        },
        ticketId,
        linkedClientCompanyId: clientCompanyId,
        allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('TECHNICIAN SELECTED_LOCATIONS rejects forbidden status/comment operations', async () => {
    const prisma = makeSelectedLocationTechnicianPrisma('loc-forbidden')
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.PRIMARY)

    await expect(
      resolveTicketOperationAccess({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actor: {
          id: 'tech-1',
          role: UserRole.TECHNICIAN,
          companyId: providerCompanyId,
        },
        ticketId,
        linkedClientCompanyId: clientCompanyId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('TECHNICIAN selected-location scope still denies another tenant', async () => {
    const prisma = makeSelectedLocationTechnicianPrisma('loc-allowed', 'other-client')
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.PRIMARY)
    serviceContractsService.getLinkedClientAccess.mockResolvedValue(null)

    await expect(
      resolveReadableTicketAccess({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actor: {
          id: 'tech-1',
          role: UserRole.TECHNICIAN,
          companyId: providerCompanyId,
        },
        ticketId,
        linkedClientCompanyId: 'other-client',
        allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('PLATFORM_ADMIN can still read tickets outside selected-location scopes', async () => {
    const prisma = makePrismaTicketMock({
      directTicket: {
        id: ticketId,
        companyId: clientCompanyId,
        locationId: 'loc-forbidden',
        assignedTechnicianId: null,
        status: 'NEW',
        problemCategory: { specializationLinks: [] },
      },
    })
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.PRIMARY)

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: {
        id: 'platform-admin',
        role: UserRole.PLATFORM_ADMIN,
        companyId: 'platform-company',
      },
      ticketId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    expect(result.ticket.id).toBe(ticketId)
    expect(result.visibilityMode).toBe('platform_observer')
  })

  it('SECONDARY management path: explicit RESTRICTED_EMPTY does not inherit provider-wide executor scope', async () => {
    const prisma = makePrismaTicketMock({
      accessLocationMode: UserAccessLocationMode.RESTRICTED_EMPTY,
      executorIds: ['exec-1'],
      ticketAssignedTechnicianId: 'exec-1',
      ticketLocationId: 'loc-allowed',
    })
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.SECONDARY)

    await expect(
      resolveReadableTicketAccess({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actor: {
          id: 'user-1',
          role: UserRole.NETWORK_DIRECTOR,
          companyId: providerCompanyId,
        },
        ticketId,
        linkedClientCompanyId: clientCompanyId,
        allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('SECONDARY management path: denies detail outside operational scope (leak closed)', async () => {
    // No executors and no location bindings ⇒ empty operational scope ⇒ deny-all.
    // The unrelated linked-client ticket must NOT leak through the management path.
    const prisma = makePrismaTicketMock({
      executorIds: [],
      ticketAssignedTechnicianId: 'someone-else',
      directTicket: {
        id: ticketId,
        companyId: clientCompanyId,
        locationId: 'loc-x',
        assignedTechnicianId: 'someone-else',
        status: 'IN_PROGRESS',
        problemCategory: { specializationLinks: [] },
      },
    })
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.SECONDARY)

    await expect(
      resolveReadableTicketAccess({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actor: {
          id: 'user-1',
          role: UserRole.NETWORK_DIRECTOR,
          companyId: providerCompanyId,
        },
        ticketId,
        linkedClientCompanyId: clientCompanyId,
        allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('SECONDARY direct fallback: denies detail outside operational scope (leak closed)', async () => {
    // linkedClientCompanyId is not supplied and the provider has no linked-clients listed,
    // so resolution reaches the direct-ticket fallback. SECONDARY with empty scope must deny.
    const prisma = makePrismaTicketMock({
      executorIds: [],
      ticketAssignedTechnicianId: 'someone-else',
      directTicket: {
        id: ticketId,
        companyId: clientCompanyId,
        locationId: 'loc-x',
        assignedTechnicianId: 'someone-else',
        status: 'IN_PROGRESS',
        problemCategory: { specializationLinks: [] },
      },
    })
    const serviceContractsService = {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        role: ServiceContractRole.SECONDARY,
        status: 'ACTIVE',
        clientCompanyId,
        providerCompanyId,
      }),
      listLinkedClients: jest.fn().mockResolvedValue([]),
      listPrimaryLinkedClientIds: jest.fn().mockResolvedValue([]),
      listSecondaryLinkedClientIds: jest.fn().mockResolvedValue([]),
    }

    await expect(
      resolveReadableTicketAccess({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actor: {
          id: 'user-1',
          role: UserRole.NETWORK_DIRECTOR,
          companyId: providerCompanyId,
        },
        ticketId,
        allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('SECONDARY direct fallback: grants detail within operational scope (assigned executor)', async () => {
    const prisma = makePrismaTicketMock({
      executorIds: ['exec-1'],
      ticketAssignedTechnicianId: 'exec-1',
      directTicket: {
        id: ticketId,
        companyId: clientCompanyId,
        locationId: null,
        assignedTechnicianId: 'exec-1',
        status: 'ASSIGNED',
        problemCategory: { specializationLinks: [] },
      },
    })
    const serviceContractsService = {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        role: ServiceContractRole.SECONDARY,
        status: 'ACTIVE',
        clientCompanyId,
        providerCompanyId,
      }),
      listLinkedClients: jest.fn().mockResolvedValue([]),
      listPrimaryLinkedClientIds: jest.fn().mockResolvedValue([]),
      listSecondaryLinkedClientIds: jest.fn().mockResolvedValue([]),
    }

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: {
        id: 'user-1',
        role: UserRole.NETWORK_DIRECTOR,
        companyId: providerCompanyId,
      },
      ticketId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    expect(result.ticket.id).toBe(ticketId)
    expect(result.visibilityMode).toBe('provider_primary')
  })

  it('SECONDARY technician direct fallback: denies NEW outside allowed locations (fail-closed)', async () => {
    const prisma = makePrismaTicketMock({
      executorIds: ['tech-1'],
      boundLocationIds: [],
      ticketLocationId: 'loc-outside',
      directTicket: {
        id: ticketId,
        companyId: clientCompanyId,
        locationId: 'loc-outside',
        assignedTechnicianId: null,
        status: 'NEW',
        problemCategory: { specializationLinks: [] },
      },
    })
    prisma.user.findFirst.mockResolvedValue({ id: 'tech-1', role: UserRole.TECHNICIAN, isExecutor: true, technicianSpecializations: [] })
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.SECONDARY)
    serviceContractsService.listSecondaryLinkedClientIds.mockResolvedValue([clientCompanyId])

    await expect(
      resolveReadableTicketAccess({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actor: {
          id: 'tech-1',
          role: UserRole.TECHNICIAN,
          companyId: providerCompanyId,
        },
        ticketId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('SECONDARY technician direct fallback: explicit restricted-empty denies NEW without tenant-wide fallback', async () => {
    const prisma = makePrismaTicketMock({
      executorIds: ['tech-1'],
      boundLocationIds: [],
      accessLocationMode: UserAccessLocationMode.RESTRICTED_EMPTY,
      ticketLocationId: 'loc-outside',
      directTicket: {
        id: ticketId,
        companyId: clientCompanyId,
        locationId: 'loc-outside',
        assignedTechnicianId: null,
        status: 'NEW',
        problemCategory: { specializationLinks: [] },
      },
    })
    prisma.user.findFirst.mockResolvedValue({ id: 'tech-1', role: UserRole.TECHNICIAN, isExecutor: true, technicianSpecializations: [] })
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.SECONDARY)
    serviceContractsService.listSecondaryLinkedClientIds.mockResolvedValue([clientCompanyId])

    await expect(
      resolveReadableTicketAccess({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actor: {
          id: 'tech-1',
          role: UserRole.TECHNICIAN,
          companyId: providerCompanyId,
        },
        ticketId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('SECONDARY technician direct fallback: grants NEW only in allowed locations', async () => {
    const prisma = makePrismaTicketMock({
      executorIds: ['tech-1'],
      boundLocationIds: ['loc-allowed'],
      accessLocationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      ticketLocationId: 'loc-allowed',
      directTicket: {
        id: ticketId,
        companyId: clientCompanyId,
        locationId: 'loc-allowed',
        assignedTechnicianId: null,
        status: 'NEW',
        problemCategory: { specializationLinks: [] },
      },
    })
    prisma.user.findFirst.mockResolvedValue({ id: 'tech-1', role: UserRole.TECHNICIAN, isExecutor: true, technicianSpecializations: [] })
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.SECONDARY)
    serviceContractsService.listSecondaryLinkedClientIds.mockResolvedValue([clientCompanyId])

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: {
        id: 'tech-1',
        role: UserRole.TECHNICIAN,
        companyId: providerCompanyId,
      },
      ticketId,
    })

    expect(result.ticket.id).toBe(ticketId)
    expect(result.visibilityMode).toBe('provider_primary')
  })

  it('SECONDARY technician direct fallback: selected locations deny NEW outside selected bindings', async () => {
    const prisma = makePrismaTicketMock({
      executorIds: ['tech-1'],
      boundLocationIds: ['loc-allowed'],
      accessLocationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      ticketLocationId: 'loc-outside',
      directTicket: {
        id: ticketId,
        companyId: clientCompanyId,
        locationId: 'loc-outside',
        assignedTechnicianId: null,
        status: 'NEW',
        problemCategory: { specializationLinks: [] },
      },
    })
    prisma.user.findFirst.mockResolvedValue({ id: 'tech-1', role: UserRole.TECHNICIAN, isExecutor: true, technicianSpecializations: [] })
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.SECONDARY)
    serviceContractsService.listSecondaryLinkedClientIds.mockResolvedValue([clientCompanyId])

    await expect(
      resolveReadableTicketAccess({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actor: {
          id: 'tech-1',
          role: UserRole.TECHNICIAN,
          companyId: providerCompanyId,
        },
        ticketId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('SECONDARY technician direct fallback: grants personally assigned ticket without location binding', async () => {
    const prisma = makePrismaTicketMock({
      executorIds: ['tech-1'],
      boundLocationIds: [],
      ticketLocationId: 'loc-outside',
      directTicket: {
        id: ticketId,
        companyId: clientCompanyId,
        locationId: 'loc-outside',
        assignedTechnicianId: 'tech-1',
        status: 'ASSIGNED',
        problemCategory: { specializationLinks: [] },
      },
    })
    prisma.user.findFirst.mockResolvedValue({ id: 'tech-1', role: UserRole.TECHNICIAN, isExecutor: true, technicianSpecializations: [] })
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.SECONDARY)
    serviceContractsService.listSecondaryLinkedClientIds.mockResolvedValue([clientCompanyId])

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actor: {
        id: 'tech-1',
        role: UserRole.TECHNICIAN,
        companyId: providerCompanyId,
      },
      ticketId,
    })

    expect(result.ticket.id).toBe(ticketId)
    expect(result.visibilityMode).toBe('provider_primary')
  })

  it('SECONDARY technician direct fallback: explicit RESTRICTED_EMPTY denies personally assigned ticket', async () => {
    const prisma = makePrismaTicketMock({
      executorIds: ['tech-1'],
      boundLocationIds: [],
      accessLocationMode: UserAccessLocationMode.RESTRICTED_EMPTY,
      ticketLocationId: 'loc-outside',
      directTicket: {
        id: ticketId,
        companyId: clientCompanyId,
        locationId: 'loc-outside',
        assignedTechnicianId: 'tech-1',
        status: 'ASSIGNED',
        problemCategory: { specializationLinks: [] },
      },
    })
    prisma.user.findFirst.mockResolvedValue({ id: 'tech-1', role: UserRole.TECHNICIAN, isExecutor: true, technicianSpecializations: [] })
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.SECONDARY)
    serviceContractsService.listSecondaryLinkedClientIds.mockResolvedValue([clientCompanyId])

    await expect(
      resolveReadableTicketAccess({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actor: {
          id: 'tech-1',
          role: UserRole.TECHNICIAN,
          companyId: providerCompanyId,
        },
        ticketId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('SECONDARY technician direct fallback: empty SELECTED_LOCATIONS denies personally assigned ticket', async () => {
    const prisma = makePrismaTicketMock({
      executorIds: ['tech-1'],
      boundLocationIds: [],
      accessLocationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      ticketLocationId: 'loc-outside',
      directTicket: {
        id: ticketId,
        companyId: clientCompanyId,
        locationId: 'loc-outside',
        assignedTechnicianId: 'tech-1',
        status: 'ASSIGNED',
        problemCategory: { specializationLinks: [] },
      },
    })
    prisma.user.findFirst.mockResolvedValue({ id: 'tech-1', role: UserRole.TECHNICIAN, isExecutor: true, technicianSpecializations: [] })
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.SECONDARY)
    serviceContractsService.listSecondaryLinkedClientIds.mockResolvedValue([clientCompanyId])

    await expect(
      resolveReadableTicketAccess({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actor: {
          id: 'tech-1',
          role: UserRole.TECHNICIAN,
          companyId: providerCompanyId,
        },
        ticketId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('keeps company/analytics scope PRIMARY-only by default', async () => {
    const prisma = makePrismaTicketMock()
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.SECONDARY)

    await expect(
      resolveTicketReadScope({
        prisma,
        serviceContractsService: serviceContractsService as any,
        actorCompanyId: providerCompanyId,
        role: UserRole.ADMIN,
        linkedClientCompanyId: clientCompanyId,
        allowedLinkedClientRoles: [UserRole.ADMIN],
      }),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(serviceContractsService.getLinkedClientAccess).toHaveBeenCalledWith(providerCompanyId, clientCompanyId)
    expect(serviceContractsService.listLinkedClients).not.toHaveBeenCalled()
  })

  it('allows explicit SECONDARY contract scope for operational ticket read scope when enabled', async () => {
    const prisma = makePrismaTicketMock()
    const serviceContractsService = makeServiceContractsService(ServiceContractRole.SECONDARY)

    const result = await resolveTicketReadScope({
      prisma,
      serviceContractsService: serviceContractsService as any,
      actorCompanyId: providerCompanyId,
      role: UserRole.ADMIN,
      linkedClientCompanyId: clientCompanyId,
      allowedLinkedClientRoles: [UserRole.ADMIN],
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    expect(result).toEqual({
      scopeCompanyId: clientCompanyId,
      visibilityMode: 'provider_primary',
    })
  })
})

describe('resolveReadableTicketAccess — cross-company ticket with no contract (403→404 leak fix)', () => {
  const providerCompanyId = 'provider-co'
  const unrelatedCompanyId = 'unrelated-co'
  const ticketId = 'ticket-x'

  function makeServiceContracts() {
    return {
      getLinkedClientAccess: jest.fn().mockResolvedValue(null),
      listLinkedClients: jest.fn().mockResolvedValue([]),
      listPrimaryLinkedClientIds: jest.fn().mockResolvedValue([]),
      listSecondaryLinkedClientIds: jest.fn().mockResolvedValue([]),
    }
  }

  function makePrisma() {
    const directTicket = {
      id: ticketId,
      companyId: unrelatedCompanyId,
      locationId: 'loc-1',
      assignedTechnicianId: null,
      status: 'NEW',
      problemCategory: { specializationLinks: [] },
    }
    return {
      ticket: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(directTicket),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: providerCompanyId, allowTechnicianClaim: false }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'tech-1', isExecutor: true, technicianSpecializations: [] }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      userLocationBinding: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      userAccessScope: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any
  }

  afterEach(() => jest.restoreAllMocks())

  it('TECHNICIAN getOne on ticket in unrelated company (no contract) → NotFoundException not ForbiddenException', async () => {
    const prisma = makePrisma()
    const svc = makeServiceContracts()

    await expect(
      resolveReadableTicketAccess({
        prisma,
        serviceContractsService: svc as any,
        actor: { id: 'tech-1', role: UserRole.TECHNICIAN, companyId: providerCompanyId },
        ticketId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('ADMIN getOne on ticket in unrelated company (no contract) → NotFoundException', async () => {
    const prisma = makePrisma()
    const svc = makeServiceContracts()

    await expect(
      resolveReadableTicketAccess({
        prisma,
        serviceContractsService: svc as any,
        actor: { id: 'admin-1', role: UserRole.ADMIN, companyId: providerCompanyId },
        ticketId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe('resolveReadableTicketAccess — PRIMARY provider ADMIN with linkedClientCompanyId', () => {
  // Regression test for Failure 2:
  // PRIMARY_PROVIDER_ADMIN calling getOne/assign with linkedClientCompanyId was hitting
  // resolveTechnicianOperationalScope which guards PRIMARY against non-TECHNICIAN roles,
  // causing a false 403.  The fix: skip executor scope when linkedClientCompanyId is provided
  // and the role is a management role (PROVIDER_LINKED_OVERVIEW_ROLES).

  const providerCompanyId = 'primary-provider'
  const clientCompanyId = 'client-co'
  const ticketId = 'ticket-42'
  const adminUserId = 'admin-user'

  function makeServiceContracts() {
    return {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        role: ServiceContractRole.PRIMARY,
        status: 'ACTIVE',
        clientCompanyId,
        providerCompanyId,
      }),
      listLinkedClients: jest.fn().mockResolvedValue([
        { linkedClientCompanyId: clientCompanyId, role: ServiceContractRole.PRIMARY },
      ]),
      listPrimaryLinkedClientIds: jest.fn().mockResolvedValue([clientCompanyId]),
      listSecondaryLinkedClientIds: jest.fn().mockResolvedValue([]),
    }
  }

  function makePrisma() {
    const ticket = { id: ticketId, companyId: clientCompanyId, assignedTechnicianId: null }
    return {
      ticket: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          // Return null for own-company check (companyId = providerCompanyId)
          if (where?.companyId === providerCompanyId) return null
          // Return ticket for linked-client lookup (companyId: { in: [clientCompanyId] })
          if (where?.companyId?.in?.includes(clientCompanyId)) return ticket
          return null
        }),
        findUnique: jest.fn().mockResolvedValue(ticket),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: providerCompanyId }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: adminUserId, technicianSpecializations: [] }),
      },
      userLocationBinding: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      userAccessScope: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any
  }

  afterEach(() => jest.restoreAllMocks())

  it('ADMIN with linkedClientCompanyId (PRIMARY contract) resolves via management path, not executor scope', async () => {
    const prisma = makePrisma()
    const svc = makeServiceContracts()

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: svc as any,
      actor: { id: adminUserId, role: UserRole.ADMIN, companyId: providerCompanyId },
      ticketId,
      linkedClientCompanyId: clientCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    expect(result.ticket.id).toBe(ticketId)
    expect(result.visibilityMode).toBe('provider_primary')
    // listPrimaryLinkedClientIds must NOT have been called — that's only in the executor scope path
    expect(svc.listPrimaryLinkedClientIds).not.toHaveBeenCalled()
  })

  it('MASTER with linkedClientCompanyId (PRIMARY contract) also resolves via management path', async () => {
    const prisma = makePrisma()
    const svc = makeServiceContracts()

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: svc as any,
      actor: { id: adminUserId, role: UserRole.MASTER, companyId: providerCompanyId },
      ticketId,
      linkedClientCompanyId: clientCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    expect(result.ticket.id).toBe(ticketId)
    expect(result.visibilityMode).toBe('provider_primary')
  })

  it('DISPATCHER with linkedClientCompanyId (PRIMARY contract) also resolves via management path', async () => {
    const prisma = makePrisma()
    const svc = makeServiceContracts()

    const result = await resolveReadableTicketAccess({
      prisma,
      serviceContractsService: svc as any,
      actor: { id: adminUserId, role: UserRole.DISPATCHER, companyId: providerCompanyId },
      ticketId,
      linkedClientCompanyId: clientCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    expect(result.ticket.id).toBe(ticketId)
    expect(result.visibilityMode).toBe('provider_primary')
  })
})
