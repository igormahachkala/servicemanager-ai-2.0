import { CompanyType, UserAccessLocationMode, UserRole } from '@prisma/client'

const mockAssertActorCanUseLocation = jest.fn()

jest.mock('./ticket-access.utils', () => {
  const actual = jest.requireActual('./ticket-access.utils')
  return {
    ...actual,
    assertActorCanUseLocation: (...args: any[]) => mockAssertActorCanUseLocation(...args),
  }
})

import { TicketsAssignmentService } from './tickets.assignment.service'

describe('TicketsAssignmentService location scope override', () => {
  function makePrismaMock() {
    return {
      company: {
        findUnique: jest.fn(),
      },
      location: {
        findFirst: jest.fn(),
      },
    }
  }

  function makeServiceContractsMock() {
    return {
      getLinkedClientAccess: jest.fn(),
    }
  }

  function makeService(prisma: any) {
    return new TicketsAssignmentService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      makeServiceContractsMock() as any,
      {} as any,
      {} as any,
    )
  }

  beforeEach(() => {
    mockAssertActorCanUseLocation.mockReset()
  })

  it('lets own-company client ADMIN use any active location without bindings', async () => {
    const prisma = makePrismaMock()
    prisma.company.findUnique.mockResolvedValue({ type: CompanyType.CLIENT })
    prisma.location.findFirst.mockResolvedValue({ id: 'loc-1' })
    const svc = makeService(prisma)

    await (svc as any).assertActorCanUseLocationForScope({
      actor: { id: 'user-1', role: UserRole.ADMIN, companyId: 'client-company' },
      scopeCompanyId: 'client-company',
      locationId: 'loc-1',
    })

    expect(prisma.company.findUnique).toHaveBeenCalledWith({
      where: { id: 'client-company' },
      select: { type: true },
    })
    expect(prisma.location.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'loc-1',
          clientCompanyId: 'client-company',
          isActive: true,
        },
      }),
    )
    expect(mockAssertActorCanUseLocation).not.toHaveBeenCalled()
  })

  it('keeps technician scope bound through the shared helper', async () => {
    const prisma = makePrismaMock()
    prisma.company.findUnique.mockResolvedValue({ type: CompanyType.CLIENT })
    const svc = makeService(prisma)

    mockAssertActorCanUseLocation.mockResolvedValue(undefined)

    await (svc as any).assertActorCanUseLocationForScope({
      actor: { id: 'tech-1', role: UserRole.TECHNICIAN, companyId: 'client-company' },
      scopeCompanyId: 'client-company',
      locationId: 'loc-2',
    })

    expect(mockAssertActorCanUseLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeCompanyId: 'client-company',
        locationId: 'loc-2',
      }),
    )
  })

  it('keeps provider linked-client scope bound through the shared helper', async () => {
    const prisma = makePrismaMock()
    prisma.company.findUnique.mockResolvedValue({ type: CompanyType.PROVIDER })
    const svc = makeService(prisma)

    mockAssertActorCanUseLocation.mockResolvedValue(undefined)

    await (svc as any).assertActorCanUseLocationForScope({
      actor: { id: 'provider-1', role: UserRole.NETWORK_DIRECTOR, companyId: 'provider-company' },
      scopeCompanyId: 'linked-client-company',
      locationId: 'loc-3',
    })

    expect(mockAssertActorCanUseLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeCompanyId: 'linked-client-company',
        locationId: 'loc-3',
      }),
    )
    expect(prisma.location.findFirst).not.toHaveBeenCalled()
  })

  it('resolves provider ticket ownership from the linked client location', async () => {
    const prisma = makePrismaMock()
    prisma.company.findUnique.mockResolvedValue({ id: 'provider-company', type: CompanyType.PROVIDER })
    prisma.location.findFirst.mockResolvedValue({ id: 'loc-4', clientCompanyId: 'client-company' })
    const svc = makeService(prisma)
    const contracts = (svc as any).serviceContractsService
    contracts.getLinkedClientAccess.mockResolvedValue({ role: 'SECONDARY' })

    const companyId = await (svc as any).resolveTicketOwnerCompanyId({
      actorCompanyId: 'provider-company',
      locationId: 'loc-4',
      requestedClientCompanyId: null,
    })

    expect(companyId).toBe('client-company')
    expect(contracts.getLinkedClientAccess).toHaveBeenCalledWith('provider-company', 'client-company')
  })
})

describe('TicketsAssignmentService assignment executor eligibility', () => {
  const providerCompany = {
    id: 'provider-company',
    name: 'Provider',
    legalName: 'ООО «Провайдер»',
    brandName: 'Провайдер',
    type: CompanyType.PROVIDER,
  }

  function makeCandidate(overrides: {
    id: string
    role: UserRole
    isActive: boolean
    specializationIds?: string[]
  }) {
    return {
      id: overrides.id,
      email: `${overrides.id}@example.test`,
      firstName: overrides.id,
      lastName: 'Executor',
      role: overrides.role,
      companyId: providerCompany.id,
      company: providerCompany,
      isActive: overrides.isActive,
      technicianSpecializations: (overrides.specializationIds ?? ['spec-1']).map((id) => ({
        specializationId: id,
        specialization: { id, name: id === 'spec-1' ? 'Сантехника' : 'Электрика', isActive: true },
      })),
      assignedTickets: [],
    }
  }

  function makePrismaWithCandidates(candidates: Array<ReturnType<typeof makeCandidate>>) {
    return {
      user: {
        findMany: jest.fn().mockImplementation(async (query: any) => {
          const where = query?.where ?? {}
          let rows = candidates.slice()
          if (where.companyId?.in) {
            rows = rows.filter((item) => where.companyId.in.includes(item.companyId))
          } else if (typeof where.companyId === 'string') {
            rows = rows.filter((item) => item.companyId === where.companyId)
          }
          if (where.role?.in) {
            rows = rows.filter((item) => where.role.in.includes(item.role))
          }
          if (where.isExecutor === true) {
            rows = rows.filter((item) => item.role !== UserRole.CLIENT)
          }
          if (where.isActive === true) {
            rows = rows.filter((item) => item.isActive === true)
          }
          const requiredIds = where.technicianSpecializations?.some?.specializationId?.in
          if (Array.isArray(requiredIds)) {
            rows = rows.filter((item) =>
              item.technicianSpecializations.some((link) => requiredIds.includes(link.specializationId)),
            )
          }
          return rows
        }),
      },
    }
  }

  function makeServiceWithCandidatePrisma(prisma: any) {
    const serviceContracts = { getLinkedClientAccess: jest.fn() }
    return new TicketsAssignmentService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      serviceContracts as any,
      {} as any,
      {} as any,
    )
  }

  it('excludes inactive executors from specialization-matched candidates', async () => {
    const activeTechnician = makeCandidate({ id: 'active-tech', role: UserRole.TECHNICIAN, isActive: true })
    const inactiveTechnician = makeCandidate({ id: 'inactive-tech', role: UserRole.TECHNICIAN, isActive: false })
    const inactiveMaster = makeCandidate({ id: 'inactive-master', role: UserRole.MASTER, isActive: false })
    const prisma = makePrismaWithCandidates([activeTechnician, inactiveTechnician, inactiveMaster])
    const svc = makeServiceWithCandidatePrisma(prisma)

    const result = await (svc as any).findCandidateTechnicians(providerCompany.id, ['spec-1'])

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: providerCompany.id,
          isExecutor: true,
          isActive: true,
          role: expect.objectContaining({ in: expect.arrayContaining([UserRole.TECHNICIAN, UserRole.MASTER]) }),
        }),
      }),
    )
    expect(result.map((item: any) => item.id)).toEqual(['active-tech'])
  })

  it('excludes inactive technicians and inactive MASTER users from fallback assignment candidates', async () => {
    const activeTechnician = makeCandidate({ id: 'active-tech', role: UserRole.TECHNICIAN, isActive: true })
    const inactiveTechnician = makeCandidate({ id: 'inactive-tech', role: UserRole.TECHNICIAN, isActive: false })
    const activeMaster = makeCandidate({ id: 'active-master', role: UserRole.MASTER, isActive: true })
    const inactiveMaster = makeCandidate({ id: 'inactive-master', role: UserRole.MASTER, isActive: false })
    const prisma = makePrismaWithCandidates([activeTechnician, inactiveTechnician, activeMaster, inactiveMaster])
    const svc = makeServiceWithCandidatePrisma(prisma)

    const result = await (svc as any).listAllTechnicians(providerCompany.id, [], {
      fallbackToAllWhenNoSpecializations: true,
    })

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: providerCompany.id,
          isExecutor: true,
          isActive: true,
          role: expect.objectContaining({ in: expect.arrayContaining([UserRole.TECHNICIAN, UserRole.MASTER]) }),
        }),
      }),
    )
    expect(result.map((item: any) => item.id)).toEqual(['active-tech', 'active-master'])
  })

  it('keeps active executor identity fields in enriched candidate DTOs', async () => {
    const activeTechnician = makeCandidate({ id: 'active-tech', role: UserRole.TECHNICIAN, isActive: true })
    const prisma = makePrismaWithCandidates([activeTechnician])
    const svc = makeServiceWithCandidatePrisma(prisma)

    const result = await (svc as any).findCandidateTechnicians(providerCompany.id, ['spec-1'])

    expect(result).toEqual([
      expect.objectContaining({
        id: 'active-tech',
        email: 'active-tech@example.test',
        firstName: 'active-tech',
        lastName: 'Executor',
        role: UserRole.TECHNICIAN,
        companyId: providerCompany.id,
        company: providerCompany,
      }),
    ])
  })
})

describe('TicketsAssignmentService assignment candidate location scope filtering', () => {
  const clientCompanyId = 'client-company'
  const providerCompanyId = 'provider-company'
  const otherProviderCompanyId = 'other-provider-company'
  const allowedLocationId = 'loc-allowed'
  const forbiddenLocationId = 'loc-forbidden'
  const otherClientLocationId = 'loc-other-client'

  type UserFixture = {
    id: string
    companyId: string
    isActive?: boolean
    deletedAt?: Date | null
  }

  type AccessScopeFixture = {
    userId: string
    companyId: string
    locationMode: UserAccessLocationMode
  }

  type LocationBindingFixture = {
    userId: string
    companyId: string
    locationId: string
  }

  const locationById: Record<string, { clientCompanyId: string; isActive: boolean; deletedAt: Date | null }> = {
    [allowedLocationId]: { clientCompanyId, isActive: true, deletedAt: null },
    [forbiddenLocationId]: { clientCompanyId, isActive: true, deletedAt: null },
    [otherClientLocationId]: { clientCompanyId: 'other-client-company', isActive: true, deletedAt: null },
  }

  function makeServiceForLocationScope(params: {
    users: UserFixture[]
    accessScopes?: AccessScopeFixture[]
    bindings?: LocationBindingFixture[]
  }) {
    const prisma = {
      user: {
        findMany: jest.fn().mockImplementation(async (query: any) => {
          const where = query?.where ?? {}
          const ids = where.id?.in ?? []
          return params.users
            .filter((user) => ids.includes(user.id))
            .filter((user) => (where.isActive === true ? user.isActive !== false : true))
            .filter((user) => (where.deletedAt === null ? !user.deletedAt : true))
            .map((user) => ({ id: user.id, companyId: user.companyId }))
        }),
      },
      userAccessScope: {
        findMany: jest.fn().mockImplementation(async (query: any) => {
          const userIds = query?.where?.userId?.in ?? []
          const companyIds = query?.where?.companyId?.in ?? []
          return (params.accessScopes ?? []).filter(
            (scope) => userIds.includes(scope.userId) && companyIds.includes(scope.companyId),
          )
        }),
      },
      userLocationBinding: {
        findMany: jest.fn().mockImplementation(async (query: any) => {
          const userIds = query?.where?.userId?.in ?? []
          const companyIds = query?.where?.companyId?.in ?? []
          const clientScope = query?.where?.location?.clientCompanyId
          return (params.bindings ?? []).filter((binding) => {
            const location = locationById[binding.locationId]
            if (!location) return false
            if (!userIds.includes(binding.userId)) return false
            if (!companyIds.includes(binding.companyId)) return false
            if (clientScope && location.clientCompanyId !== clientScope) return false
            if (query?.where?.location?.isActive === true && !location.isActive) return false
            if (query?.where?.location?.deletedAt === null && location.deletedAt) return false
            return true
          })
        }),
      },
    }

    return {
      prisma,
      service: new TicketsAssignmentService(
        prisma as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        { getLinkedClientAccess: jest.fn() } as any,
        {} as any,
        {} as any,
      ),
    }
  }

  function activeUser(id: string, companyId = providerCompanyId): UserFixture {
    return { id, companyId, isActive: true, deletedAt: null }
  }

  async function filter(service: TicketsAssignmentService, userIds: string[], locationId: string) {
    return (service as any).filterTechniciansByLocationBindings(
      userIds.map((id) => ({ id })),
      clientCompanyId,
      locationId,
    )
  }

  it('allows SELECTED_LOCATIONS candidates only on canonical provider-scoped selected locations', async () => {
    const { service, prisma } = makeServiceForLocationScope({
      users: [activeUser('tech-selected')],
      accessScopes: [
        {
          userId: 'tech-selected',
          companyId: providerCompanyId,
          locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
        },
      ],
      bindings: [{ userId: 'tech-selected', companyId: providerCompanyId, locationId: allowedLocationId }],
    })

    await expect(filter(service, ['tech-selected'], allowedLocationId)).resolves.toEqual([{ id: 'tech-selected' }])
    await expect(filter(service, ['tech-selected'], forbiddenLocationId)).resolves.toEqual([])
    expect(prisma.userLocationBinding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: { in: expect.arrayContaining([providerCompanyId, clientCompanyId]) },
          location: expect.objectContaining({ clientCompanyId }),
        }),
      }),
    )
  })

  it('does not let a selected binding from another client authorize the current client scope', async () => {
    const { service } = makeServiceForLocationScope({
      users: [activeUser('tech-selected')],
      accessScopes: [
        {
          userId: 'tech-selected',
          companyId: providerCompanyId,
          locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
        },
      ],
      bindings: [{ userId: 'tech-selected', companyId: providerCompanyId, locationId: otherClientLocationId }],
    })

    await expect(filter(service, ['tech-selected'], otherClientLocationId)).resolves.toEqual([])
  })

  it('keeps RESTRICTED_EMPTY fail-closed even when stale legacy client bindings exist', async () => {
    const { service } = makeServiceForLocationScope({
      users: [activeUser('tech-restricted')],
      accessScopes: [
        {
          userId: 'tech-restricted',
          companyId: providerCompanyId,
          locationMode: UserAccessLocationMode.RESTRICTED_EMPTY,
        },
      ],
      bindings: [{ userId: 'tech-restricted', companyId: clientCompanyId, locationId: allowedLocationId }],
    })

    await expect(filter(service, ['tech-restricted'], allowedLocationId)).resolves.toEqual([])
  })

  it('does not let stale legacy client bindings broaden explicit selected provider scope', async () => {
    const { service } = makeServiceForLocationScope({
      users: [activeUser('tech-selected')],
      accessScopes: [
        {
          userId: 'tech-selected',
          companyId: providerCompanyId,
          locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
        },
      ],
      bindings: [
        { userId: 'tech-selected', companyId: providerCompanyId, locationId: allowedLocationId },
        { userId: 'tech-selected', companyId: clientCompanyId, locationId: forbiddenLocationId },
      ],
    })

    await expect(filter(service, ['tech-selected'], allowedLocationId)).resolves.toEqual([{ id: 'tech-selected' }])
    await expect(filter(service, ['tech-selected'], forbiddenLocationId)).resolves.toEqual([])
  })

  it('supports legacy client-scoped bindings when no explicit access scope exists', async () => {
    const { service } = makeServiceForLocationScope({
      users: [activeUser('tech-legacy')],
      bindings: [{ userId: 'tech-legacy', companyId: clientCompanyId, locationId: allowedLocationId }],
    })

    await expect(filter(service, ['tech-legacy'], allowedLocationId)).resolves.toEqual([{ id: 'tech-legacy' }])
    await expect(filter(service, ['tech-legacy'], forbiddenLocationId)).resolves.toEqual([])
  })

  it('supports canonical provider-scoped bindings when no explicit access scope exists', async () => {
    const { service } = makeServiceForLocationScope({
      users: [activeUser('tech-canonical')],
      bindings: [{ userId: 'tech-canonical', companyId: providerCompanyId, locationId: allowedLocationId }],
    })

    await expect(filter(service, ['tech-canonical'], allowedLocationId)).resolves.toEqual([{ id: 'tech-canonical' }])
    await expect(filter(service, ['tech-canonical'], forbiddenLocationId)).resolves.toEqual([])
  })

  it('excludes inactive and deleted candidates before location scope evaluation', async () => {
    const { service } = makeServiceForLocationScope({
      users: [
        { id: 'tech-inactive', companyId: providerCompanyId, isActive: false, deletedAt: null },
        { id: 'tech-deleted', companyId: providerCompanyId, isActive: true, deletedAt: new Date('2026-01-01') },
      ],
      accessScopes: [
        {
          userId: 'tech-inactive',
          companyId: providerCompanyId,
          locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
        },
        {
          userId: 'tech-deleted',
          companyId: providerCompanyId,
          locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
        },
      ],
      bindings: [
        { userId: 'tech-inactive', companyId: providerCompanyId, locationId: allowedLocationId },
        { userId: 'tech-deleted', companyId: providerCompanyId, locationId: allowedLocationId },
      ],
    })

    await expect(filter(service, ['tech-inactive', 'tech-deleted'], allowedLocationId)).resolves.toEqual([])
  })

  it('keeps active MASTER candidates bound and inactive MASTER candidates excluded', async () => {
    const { service } = makeServiceForLocationScope({
      users: [
        activeUser('active-master'),
        { id: 'inactive-master', companyId: providerCompanyId, isActive: false, deletedAt: null },
      ],
      accessScopes: [
        {
          userId: 'active-master',
          companyId: providerCompanyId,
          locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
        },
        {
          userId: 'inactive-master',
          companyId: providerCompanyId,
          locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
        },
      ],
      bindings: [
        { userId: 'active-master', companyId: providerCompanyId, locationId: allowedLocationId },
        { userId: 'inactive-master', companyId: providerCompanyId, locationId: allowedLocationId },
      ],
    })

    await expect(filter(service, ['active-master', 'inactive-master'], allowedLocationId)).resolves.toEqual([
      { id: 'active-master' },
    ])
  })

  it('does not duplicate candidates when duplicate location binding rows are returned', async () => {
    const { service } = makeServiceForLocationScope({
      users: [activeUser('tech-duplicate')],
      bindings: [
        { userId: 'tech-duplicate', companyId: providerCompanyId, locationId: allowedLocationId },
        { userId: 'tech-duplicate', companyId: providerCompanyId, locationId: allowedLocationId },
      ],
    })

    await expect(filter(service, ['tech-duplicate'], allowedLocationId)).resolves.toEqual([{ id: 'tech-duplicate' }])
  })

  it('preserves legacy tenant-wide behavior only when no explicit scope and no bindings exist', async () => {
    const { service } = makeServiceForLocationScope({
      users: [activeUser('tech-legacy-open')],
    })

    await expect(filter(service, ['tech-legacy-open'], forbiddenLocationId)).resolves.toEqual([
      { id: 'tech-legacy-open' },
    ])
  })

  it('does not interpret empty explicit SELECTED_LOCATIONS scope as unrestricted', async () => {
    const { service } = makeServiceForLocationScope({
      users: [activeUser('tech-empty-selected')],
      accessScopes: [
        {
          userId: 'tech-empty-selected',
          companyId: providerCompanyId,
          locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
        },
      ],
    })

    await expect(filter(service, ['tech-empty-selected'], allowedLocationId)).resolves.toEqual([])
  })

  it('does not let bindings from a foreign provider company authorize a candidate', async () => {
    const { service } = makeServiceForLocationScope({
      users: [activeUser('tech-foreign-binding')],
      accessScopes: [
        {
          userId: 'tech-foreign-binding',
          companyId: providerCompanyId,
          locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
        },
      ],
      bindings: [
        {
          userId: 'tech-foreign-binding',
          companyId: otherProviderCompanyId,
          locationId: allowedLocationId,
        },
      ],
    })

    await expect(filter(service, ['tech-foreign-binding'], allowedLocationId)).resolves.toEqual([])
  })
})
