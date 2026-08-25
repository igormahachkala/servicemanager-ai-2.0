import { ForbiddenException } from '@nestjs/common'
import {
  CompanyType,
  ServiceContractRole,
  TicketStatus,
  UserAccessLocationMode,
  UserRole,
} from '@prisma/client'

const mockAssertActorCanUseLocation = jest.fn()
const mockAssertActorCanUseProblemCategory = jest.fn()

jest.mock('./ticket-access.utils', () => {
  const actual = jest.requireActual('./ticket-access.utils')
  return {
    ...actual,
    assertActorCanUseLocation: (...args: any[]) =>
      mockAssertActorCanUseLocation(...args),
    assertActorCanUseProblemCategory: (...args: any[]) =>
      mockAssertActorCanUseProblemCategory(...args),
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
    mockAssertActorCanUseProblemCategory.mockReset()
    mockAssertActorCanUseProblemCategory.mockResolvedValue({
      id: 'category-1',
    })
  })

  it('keeps own-company client ADMIN bound through the shared location helper', async () => {
    const prisma = makePrismaMock()
    const svc = makeService(prisma)
    mockAssertActorCanUseLocation.mockResolvedValue(undefined)

    await (svc as any).assertActorCanUseLocationForScope({
      actor: {
        id: 'user-1',
        role: UserRole.ADMIN,
        companyId: 'client-company',
      },
      scopeCompanyId: 'client-company',
      locationId: 'loc-1',
    })

    expect(mockAssertActorCanUseLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeCompanyId: 'client-company',
        locationId: 'loc-1',
      }),
    )
    expect(prisma.location.findFirst).not.toHaveBeenCalled()
  })

  it('keeps technician scope bound through the shared helper', async () => {
    const prisma = makePrismaMock()
    prisma.company.findUnique.mockResolvedValue({ type: CompanyType.CLIENT })
    const svc = makeService(prisma)

    mockAssertActorCanUseLocation.mockResolvedValue(undefined)

    await (svc as any).assertActorCanUseLocationForScope({
      actor: {
        id: 'tech-1',
        role: UserRole.TECHNICIAN,
        companyId: 'client-company',
      },
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
      actor: {
        id: 'provider-1',
        role: UserRole.NETWORK_DIRECTOR,
        companyId: 'provider-company',
      },
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
    prisma.company.findUnique.mockResolvedValue({
      id: 'provider-company',
      type: CompanyType.PROVIDER,
    })
    prisma.location.findFirst.mockResolvedValue({
      id: 'loc-4',
      clientCompanyId: 'client-company',
    })
    const svc = makeService(prisma)
    const contracts = (svc as any).serviceContractsService
    contracts.getLinkedClientAccess.mockResolvedValue({ role: 'SECONDARY' })

    const companyId = await (svc as any).resolveTicketOwnerCompanyId({
      actorCompanyId: 'provider-company',
      locationId: 'loc-4',
      requestedClientCompanyId: null,
    })

    expect(companyId).toBe('client-company')
    expect(contracts.getLinkedClientAccess).toHaveBeenCalledWith(
      'provider-company',
      'client-company',
    )
  })

  it('hides a linked-client location outside the objects selected in the contract', async () => {
    const prisma = makePrismaMock()
    prisma.company.findUnique.mockResolvedValue({
      id: 'provider-company',
      type: CompanyType.PROVIDER,
    })
    prisma.location.findFirst.mockResolvedValue({
      id: 'loc-outside',
      clientCompanyId: 'client-company',
    })
    const svc = makeService(prisma)
    const contracts = (svc as any).serviceContractsService
    contracts.getLinkedClientAccess.mockResolvedValue({
      role: ServiceContractRole.PRIMARY,
      locations: [{ locationId: 'loc-contract' }],
    })

    await expect(
      (svc as any).resolveTicketOwnerCompanyId({
        actorCompanyId: 'provider-company',
        locationId: 'loc-outside',
        requestedClientCompanyId: null,
      }),
    ).rejects.toBeDefined()
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
    specializationNameById?: Record<string, string>
    companyId?: string
  }) {
    return {
      id: overrides.id,
      email: `${overrides.id}@example.test`,
      firstName: overrides.id,
      lastName: 'Executor',
      role: overrides.role,
      companyId: overrides.companyId ?? providerCompany.id,
      company:
        overrides.companyId && overrides.companyId !== providerCompany.id
          ? { ...providerCompany, id: overrides.companyId }
          : providerCompany,
      isActive: overrides.isActive,
      technicianSpecializations: (
        overrides.specializationIds ?? ['spec-1']
      ).map((id) => ({
        specializationId: id,
        specialization: {
          id,
          name:
            overrides.specializationNameById?.[id] ??
            (id === 'spec-1' ? 'Сантехника' : 'Электрика'),
          isActive: true,
        },
      })),
      assignedTickets: [],
    }
  }

  function makePrismaWithCandidates(
    candidates: Array<ReturnType<typeof makeCandidate>>,
  ) {
    return {
      user: {
        findMany: jest.fn().mockImplementation(async (query: any) => {
          const where = query?.where ?? {}
          let rows = candidates.slice()
          if (where.companyId?.in) {
            rows = rows.filter((item) =>
              where.companyId.in.includes(item.companyId),
            )
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
          const requiredIds =
            where.technicianSpecializations?.some?.specializationId?.in
          if (Array.isArray(requiredIds)) {
            rows = rows.filter((item) =>
              item.technicianSpecializations.some((link) =>
                requiredIds.includes(link.specializationId),
              ),
            )
          }
          return rows
        }),
      },
    }
  }

  function makeServiceWithCandidatePrisma(prisma: any) {
    const serviceContracts = {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        role: ServiceContractRole.PRIMARY,
        locations: [],
      }),
    }
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
    const activeTechnician = makeCandidate({
      id: 'active-tech',
      role: UserRole.TECHNICIAN,
      isActive: true,
    })
    const inactiveTechnician = makeCandidate({
      id: 'inactive-tech',
      role: UserRole.TECHNICIAN,
      isActive: false,
    })
    const inactiveMaster = makeCandidate({
      id: 'inactive-master',
      role: UserRole.MASTER,
      isActive: false,
    })
    const prisma = makePrismaWithCandidates([
      activeTechnician,
      inactiveTechnician,
      inactiveMaster,
    ])
    const svc = makeServiceWithCandidatePrisma(prisma)

    const result = await (svc as any).findCandidateTechnicians(
      providerCompany.id,
      ['spec-1'],
    )

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: providerCompany.id,
          isExecutor: true,
          isActive: true,
          role: expect.objectContaining({
            in: expect.arrayContaining([UserRole.TECHNICIAN, UserRole.MASTER]),
          }),
        }),
      }),
    )
    expect(result.map((item: any) => item.id)).toEqual(['active-tech'])
  })

  it('excludes inactive technicians and inactive MASTER users from fallback assignment candidates', async () => {
    const activeTechnician = makeCandidate({
      id: 'active-tech',
      role: UserRole.TECHNICIAN,
      isActive: true,
    })
    const inactiveTechnician = makeCandidate({
      id: 'inactive-tech',
      role: UserRole.TECHNICIAN,
      isActive: false,
    })
    const activeMaster = makeCandidate({
      id: 'active-master',
      role: UserRole.MASTER,
      isActive: true,
    })
    const inactiveMaster = makeCandidate({
      id: 'inactive-master',
      role: UserRole.MASTER,
      isActive: false,
    })
    const prisma = makePrismaWithCandidates([
      activeTechnician,
      inactiveTechnician,
      activeMaster,
      inactiveMaster,
    ])
    const svc = makeServiceWithCandidatePrisma(prisma)

    const result = await (svc as any).listAllTechnicians(
      providerCompany.id,
      [],
      {
        fallbackToAllWhenNoSpecializations: true,
      },
    )

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: providerCompany.id,
          isExecutor: true,
          isActive: true,
          role: expect.objectContaining({
            in: expect.arrayContaining([UserRole.TECHNICIAN, UserRole.MASTER]),
          }),
        }),
      }),
    )
    expect(result.map((item: any) => item.id)).toEqual([
      'active-tech',
      'active-master',
    ])
  })

  it('keeps active executor identity fields in enriched candidate DTOs', async () => {
    const activeTechnician = makeCandidate({
      id: 'active-tech',
      role: UserRole.TECHNICIAN,
      isActive: true,
    })
    const prisma = makePrismaWithCandidates([activeTechnician])
    const svc = makeServiceWithCandidatePrisma(prisma)

    const result = await (svc as any).findCandidateTechnicians(
      providerCompany.id,
      ['spec-1'],
    )

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

  it('resolves create candidates by canonical specialization labels when subcontractor UUIDs differ', async () => {
    const subcontractorTechnician = makeCandidate({
      id: 'subcontractor-tech',
      role: UserRole.TECHNICIAN,
      isActive: true,
      specializationIds: ['provider-spec-cond'],
      specializationNameById: {
        'provider-spec-cond': 'Специалист по кондиционерам',
      },
    })
    const prisma = {
      ...makePrismaWithCandidates([subcontractorTechnician]),
      userAccessScope: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      userLocationBinding: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }
    const svc = makeServiceWithCandidatePrisma(prisma)

    const result = await (svc as any).resolveCreateCandidates({
      providerCompanyIds: [providerCompany.id],
      clientCompanyId: 'client-company',
      locationId: 'location-1',
      requiredSpecializations: [
        {
          id: 'client-spec-cond',
          name: 'Специалист по кондиционерам',
          isActive: true,
        },
      ],
    })

    expect(result).toEqual([
      expect.objectContaining({
        id: 'subcontractor-tech',
        matched: true,
        matchedBy: ['специалист по кондиционерам'],
      }),
    ])
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          technicianSpecializations: expect.anything(),
        }),
      }),
    )
  })

  it('returns a diagnostic non-match reason when create candidates lack the required specialization', async () => {
    const subcontractorTechnician = makeCandidate({
      id: 'subcontractor-tech',
      role: UserRole.TECHNICIAN,
      isActive: true,
      specializationIds: ['provider-spec-electric'],
      specializationNameById: { 'provider-spec-electric': 'Электрик' },
    })
    const prisma = {
      ...makePrismaWithCandidates([subcontractorTechnician]),
      userAccessScope: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      userLocationBinding: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }
    const svc = makeServiceWithCandidatePrisma(prisma)

    const result = await (svc as any).resolveCreateCandidates({
      providerCompanyIds: [providerCompany.id],
      clientCompanyId: 'client-company',
      locationId: 'location-1',
      requiredSpecializations: [
        {
          id: 'client-spec-cond',
          name: 'Специалист по кондиционерам',
          isActive: true,
        },
      ],
    })

    expect(result).toEqual([
      expect.objectContaining({
        id: 'subcontractor-tech',
        matched: false,
        matchReason: 'no_match',
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

  const locationById: Record<
    string,
    { clientCompanyId: string; isActive: boolean; deletedAt: Date | null }
  > = {
    [allowedLocationId]: { clientCompanyId, isActive: true, deletedAt: null },
    [forbiddenLocationId]: { clientCompanyId, isActive: true, deletedAt: null },
    [otherClientLocationId]: {
      clientCompanyId: 'other-client-company',
      isActive: true,
      deletedAt: null,
    },
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
            .filter((user) =>
              where.isActive === true ? user.isActive !== false : true,
            )
            .filter((user) =>
              where.deletedAt === null ? !user.deletedAt : true,
            )
            .map((user) => ({ id: user.id, companyId: user.companyId }))
        }),
      },
      userAccessScope: {
        findMany: jest.fn().mockImplementation(async (query: any) => {
          const userIds = query?.where?.userId?.in ?? []
          const companyIds = query?.where?.companyId?.in ?? []
          return (params.accessScopes ?? []).filter(
            (scope) =>
              userIds.includes(scope.userId) &&
              companyIds.includes(scope.companyId),
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
            if (clientScope && location.clientCompanyId !== clientScope)
              return false
            if (query?.where?.location?.isActive === true && !location.isActive)
              return false
            if (
              query?.where?.location?.deletedAt === null &&
              location.deletedAt
            )
              return false
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
        {
          getLinkedClientAccess: jest.fn().mockResolvedValue({
            role: ServiceContractRole.PRIMARY,
            locations: [],
          }),
        } as any,
        {} as any,
        {} as any,
      ),
    }
  }

  function activeUser(id: string, companyId = providerCompanyId): UserFixture {
    return { id, companyId, isActive: true, deletedAt: null }
  }

  async function filter(
    service: TicketsAssignmentService,
    userIds: string[],
    locationId: string,
  ) {
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
      bindings: [
        {
          userId: 'tech-selected',
          companyId: providerCompanyId,
          locationId: allowedLocationId,
        },
      ],
    })

    await expect(
      filter(service, ['tech-selected'], allowedLocationId),
    ).resolves.toEqual([{ id: 'tech-selected' }])
    await expect(
      filter(service, ['tech-selected'], forbiddenLocationId),
    ).resolves.toEqual([])
    expect(prisma.userLocationBinding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: {
            in: expect.arrayContaining([providerCompanyId, clientCompanyId]),
          },
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
      bindings: [
        {
          userId: 'tech-selected',
          companyId: providerCompanyId,
          locationId: otherClientLocationId,
        },
      ],
    })

    await expect(
      filter(service, ['tech-selected'], otherClientLocationId),
    ).resolves.toEqual([])
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
      bindings: [
        {
          userId: 'tech-restricted',
          companyId: clientCompanyId,
          locationId: allowedLocationId,
        },
      ],
    })

    await expect(
      filter(service, ['tech-restricted'], allowedLocationId),
    ).resolves.toEqual([])
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
        {
          userId: 'tech-selected',
          companyId: providerCompanyId,
          locationId: allowedLocationId,
        },
        {
          userId: 'tech-selected',
          companyId: clientCompanyId,
          locationId: forbiddenLocationId,
        },
      ],
    })

    await expect(
      filter(service, ['tech-selected'], allowedLocationId),
    ).resolves.toEqual([{ id: 'tech-selected' }])
    await expect(
      filter(service, ['tech-selected'], forbiddenLocationId),
    ).resolves.toEqual([])
  })

  it('supports legacy client-scoped bindings when no explicit access scope exists', async () => {
    const { service } = makeServiceForLocationScope({
      users: [activeUser('tech-legacy')],
      bindings: [
        {
          userId: 'tech-legacy',
          companyId: clientCompanyId,
          locationId: allowedLocationId,
        },
      ],
    })

    await expect(
      filter(service, ['tech-legacy'], allowedLocationId),
    ).resolves.toEqual([{ id: 'tech-legacy' }])
    await expect(
      filter(service, ['tech-legacy'], forbiddenLocationId),
    ).resolves.toEqual([])
  })

  it('supports canonical provider-scoped bindings when no explicit access scope exists', async () => {
    const { service } = makeServiceForLocationScope({
      users: [activeUser('tech-canonical')],
      bindings: [
        {
          userId: 'tech-canonical',
          companyId: providerCompanyId,
          locationId: allowedLocationId,
        },
      ],
    })

    await expect(
      filter(service, ['tech-canonical'], allowedLocationId),
    ).resolves.toEqual([{ id: 'tech-canonical' }])
    await expect(
      filter(service, ['tech-canonical'], forbiddenLocationId),
    ).resolves.toEqual([])
  })

  it('excludes inactive and deleted candidates before location scope evaluation', async () => {
    const { service } = makeServiceForLocationScope({
      users: [
        {
          id: 'tech-inactive',
          companyId: providerCompanyId,
          isActive: false,
          deletedAt: null,
        },
        {
          id: 'tech-deleted',
          companyId: providerCompanyId,
          isActive: true,
          deletedAt: new Date('2026-01-01'),
        },
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
        {
          userId: 'tech-inactive',
          companyId: providerCompanyId,
          locationId: allowedLocationId,
        },
        {
          userId: 'tech-deleted',
          companyId: providerCompanyId,
          locationId: allowedLocationId,
        },
      ],
    })

    await expect(
      filter(service, ['tech-inactive', 'tech-deleted'], allowedLocationId),
    ).resolves.toEqual([])
  })

  it('keeps active MASTER candidates bound and inactive MASTER candidates excluded', async () => {
    const { service } = makeServiceForLocationScope({
      users: [
        activeUser('active-master'),
        {
          id: 'inactive-master',
          companyId: providerCompanyId,
          isActive: false,
          deletedAt: null,
        },
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
        {
          userId: 'active-master',
          companyId: providerCompanyId,
          locationId: allowedLocationId,
        },
        {
          userId: 'inactive-master',
          companyId: providerCompanyId,
          locationId: allowedLocationId,
        },
      ],
    })

    await expect(
      filter(service, ['active-master', 'inactive-master'], allowedLocationId),
    ).resolves.toEqual([{ id: 'active-master' }])
  })

  it('does not duplicate candidates when duplicate location binding rows are returned', async () => {
    const { service } = makeServiceForLocationScope({
      users: [activeUser('tech-duplicate')],
      bindings: [
        {
          userId: 'tech-duplicate',
          companyId: providerCompanyId,
          locationId: allowedLocationId,
        },
        {
          userId: 'tech-duplicate',
          companyId: providerCompanyId,
          locationId: allowedLocationId,
        },
      ],
    })

    await expect(
      filter(service, ['tech-duplicate'], allowedLocationId),
    ).resolves.toEqual([{ id: 'tech-duplicate' }])
  })

  it('preserves legacy tenant-wide behavior only when no explicit scope and no bindings exist', async () => {
    const { service } = makeServiceForLocationScope({
      users: [activeUser('tech-legacy-open')],
    })

    await expect(
      filter(service, ['tech-legacy-open'], forbiddenLocationId),
    ).resolves.toEqual([{ id: 'tech-legacy-open' }])
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

    await expect(
      filter(service, ['tech-empty-selected'], allowedLocationId),
    ).resolves.toEqual([])
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

    await expect(
      filter(service, ['tech-foreign-binding'], allowedLocationId),
    ).resolves.toEqual([])
  })
})

describe('TicketsAssignmentService.requestAssignment canonical eligibility', () => {
  const providerCompanyId = 'provider-secondary'
  const clientCompanyId = 'client-company'
  const foreignClientCompanyId = 'foreign-client-company'
  const technicianId = 'tech-secondary'
  const targetTechnicianId = 'target-tech-secondary'
  const foreignTechnicianId = 'foreign-tech'
  const foreignProviderCompanyId = 'foreign-provider'
  const primaryClientCompanyId = 'primary-client-company'
  const ticketId = 'ticket-1'
  const allowedLocationId = 'location-allowed'
  const forbiddenLocationId = 'location-forbidden'
  const categorySpecializationName = 'Специалист по кондиционерам'

  type RequestHarnessOptions = {
    technicianSpecializationNames?: string[]
    categorySpecializationNames?: string[]
    locationMode?: UserAccessLocationMode | null
    bindingLocationIds?: string[]
    isActive?: boolean
    deletedAt?: Date | null
    isExecutor?: boolean
    ticketCompanyId?: string
    ticketLocationId?: string
    contractRole?: ServiceContractRole | null
    contractStatus?: 'ACTIVE' | 'INACTIVE' | 'ENDED'
    requesterId?: string
    requesterRole?: UserRole
    requesterIsExecutor?: boolean
    targetUserId?: string
    targetCompanyId?: string
    targetIsExecutor?: boolean
    targetSpecializationNames?: string[]
    targetBindingLocationIds?: string[]
    existingRequestTargetUserIds?: string[]
  }

  function normalizeName(value: string) {
    return value.trim().toLocaleLowerCase('ru-RU')
  }

  function makeRequestHarness(options: RequestHarnessOptions = {}) {
    const ticketCompanyId = options.ticketCompanyId ?? clientCompanyId
    const ticketLocationId = options.ticketLocationId ?? allowedLocationId
    const technicianSpecializationNames =
      options.technicianSpecializationNames ?? [categorySpecializationName]
    const categorySpecializationNames = options.categorySpecializationNames ?? [
      categorySpecializationName,
    ]
    const locationMode =
      options.locationMode === undefined
        ? UserAccessLocationMode.SELECTED_LOCATIONS
        : options.locationMode
    const bindingLocationIds =
      options.bindingLocationIds === undefined
        ? [ticketLocationId]
        : options.bindingLocationIds
    const isActive = options.isActive ?? true
    const deletedAt = options.deletedAt ?? null
    const isExecutor = options.isExecutor ?? true
    const requesterId = options.requesterId ?? technicianId
    const requesterRole = options.requesterRole ?? UserRole.TECHNICIAN
    const requesterIsExecutor = options.requesterIsExecutor ?? isExecutor
    const requestedTargetUserId = options.targetUserId ?? requesterId
    const targetCompanyId = options.targetCompanyId ?? providerCompanyId
    const targetIsExecutor = options.targetIsExecutor ?? isExecutor
    const targetSpecializationNames =
      options.targetSpecializationNames ?? technicianSpecializationNames
    const targetBindingLocationIds =
      options.targetBindingLocationIds === undefined
        ? bindingLocationIds
        : options.targetBindingLocationIds
    const contractRole =
      options.contractRole === undefined
        ? ServiceContractRole.SECONDARY
        : options.contractRole
    const contractStatus = options.contractStatus ?? 'ACTIVE'

    const locationClientById: Record<string, string> = {
      [allowedLocationId]: ticketCompanyId,
      [forbiddenLocationId]: ticketCompanyId,
      'foreign-location': foreignClientCompanyId,
    }

    const technicianSpecializations = technicianSpecializationNames.map(
      (name, index) => ({
        specializationId: `provider-spec-${index + 1}`,
        specialization: {
          id: `provider-spec-${index + 1}`,
          name,
          isActive: true,
        },
      }),
    )
    const targetSpecializations = targetSpecializationNames.map(
      (name, index) => ({
        specializationId: `target-provider-spec-${index + 1}`,
        specialization: {
          id: `target-provider-spec-${index + 1}`,
          name,
          isActive: true,
        },
      }),
    )
    const categoryLinks = categorySpecializationNames.map((name, index) => ({
      specializationId: `client-spec-${index + 1}`,
      specialization: {
        id: `client-spec-${index + 1}`,
        name,
        isActive: true,
      },
    }))

    const specializationAllowed =
      categorySpecializationNames.length === 0 ||
      technicianSpecializationNames.some((candidateName) =>
        categorySpecializationNames.some(
          (requiredName) =>
            normalizeName(candidateName) === normalizeName(requiredName),
        ),
      )

    const locationAllowed =
      locationMode === null ||
      locationMode === UserAccessLocationMode.ALL_LOCATIONS ||
      (locationMode === UserAccessLocationMode.SELECTED_LOCATIONS &&
        bindingLocationIds.includes(ticketLocationId))
    const targetLocationAllowed =
      locationMode === null ||
      locationMode === UserAccessLocationMode.ALL_LOCATIONS ||
      (locationMode === UserAccessLocationMode.SELECTED_LOCATIONS &&
        targetBindingLocationIds.includes(ticketLocationId))
    const targetSpecializationAllowed =
      categorySpecializationNames.length === 0 ||
      targetSpecializationNames.some((candidateName) =>
        categorySpecializationNames.some(
          (requiredName) =>
            normalizeName(candidateName) === normalizeName(requiredName),
        ),
      )

    const ticket = {
      id: ticketId,
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      ticketNumber: 1001,
      companyId: ticketCompanyId,
      locationId: ticketLocationId,
      problemCategory: { specializationLinks: categoryLinks },
    }

    const transactionDomainEventFindMany = jest.fn().mockResolvedValue(
      (options.existingRequestTargetUserIds ?? []).map((targetId) => ({
        id: `assignment-request-existing-${targetId}`,
        payload: { requestedTargetUserId: targetId },
      })),
    )
    const tx = {
      domainEvent: {
        findMany: transactionDomainEventFindMany,
      },
    }
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: providerCompanyId,
          allowTechnicianClaim: true,
        }),
      },
      user: {
        findFirst: jest.fn().mockImplementation(async (query: any) => {
          const where = query?.where ?? {}
          const id = where.id as string | undefined
          if (id && id !== requesterId && id !== requestedTargetUserId)
            return null
          if (
            where.companyId &&
            where.companyId !==
              (id === requestedTargetUserId
                ? targetCompanyId
                : providerCompanyId)
          )
            return null
          if (where.isActive === true && !isActive) return null
          if (where.deletedAt === null && deletedAt) return null
          if (id === requestedTargetUserId) {
            if (where.isExecutor === true && !targetIsExecutor) return null
            return {
              id: requestedTargetUserId,
              role:
                requestedTargetUserId === requesterId
                  ? requesterRole
                  : UserRole.TECHNICIAN,
              companyId: targetCompanyId,
              isExecutor: targetIsExecutor,
              isActive,
              deletedAt,
              technicianSpecializations: targetSpecializations,
            }
          }
          return {
            id: requesterId,
            role: requesterRole,
            companyId: providerCompanyId,
            isExecutor: requesterIsExecutor,
            isActive,
            deletedAt,
            technicianSpecializations,
          }
        }),
        findMany: jest.fn().mockImplementation(async (query: any) => {
          const where = query?.where ?? {}
          if (where.companyId && where.companyId !== providerCompanyId)
            return []
          if (where.isExecutor === true && !isExecutor) return []
          if (!isActive || deletedAt) return []
          return [{ id: requestedTargetUserId }]
        }),
      },
      technicianSpecialization: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      serviceContract: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          if (
            where?.providerCompanyId !== providerCompanyId ||
            where?.clientCompanyId !== ticketCompanyId ||
            !contractRole ||
            contractStatus !== 'ACTIVE'
          ) {
            return null
          }
          return { id: 'contract-1' }
        }),
      },
      serviceContractSpecialization: {
        findMany: jest.fn().mockResolvedValue(
          (categorySpecializationNames.length > 0
            ? categorySpecializationNames
            : ['Default']
          ).map((name, index) => ({
            specializationId: `contract-spec-${index + 1}`,
            specialization: { name },
          })),
        ),
      },
      userAccessScope: {
        findUnique: jest
          .fn()
          .mockResolvedValue(locationMode ? { locationMode } : null),
      },
      userLocationBinding: {
        findMany: jest.fn().mockImplementation(async (query: any) => {
          const where = query?.where ?? {}
          return bindingLocationIds
            .map((locationId) => ({
              userId: requesterId,
              companyId: providerCompanyId,
              locationId,
              location: {
                clientCompanyId:
                  locationClientById[locationId] ?? ticketCompanyId,
              },
            }))
            .concat(
              targetBindingLocationIds.map((locationId) => ({
                userId: requestedTargetUserId,
                companyId: targetCompanyId,
                locationId,
                location: {
                  clientCompanyId:
                    locationClientById[locationId] ?? ticketCompanyId,
                },
              })),
            )
            .filter((binding) => {
              if (
                where.userId &&
                typeof where.userId === 'string' &&
                where.userId !== binding.userId
              )
                return false
              if (where.userId?.in && !where.userId.in.includes(binding.userId))
                return false
              if (
                where.companyId &&
                typeof where.companyId === 'string' &&
                where.companyId !== binding.companyId
              ) {
                return false
              }
              if (
                where.companyId?.in &&
                !where.companyId.in.includes(binding.companyId)
              )
                return false
              const clientFilter = where.location?.clientCompanyId
              if (
                typeof clientFilter === 'string' &&
                clientFilter !== binding.location.clientCompanyId
              )
                return false
              if (
                clientFilter?.in &&
                !clientFilter.in.includes(binding.location.clientCompanyId)
              )
                return false
              return true
            })
        }),
      },
      ticket: {
        findFirst: jest.fn().mockImplementation(async (query: any) => {
          const where = query?.where ?? {}
          const whereJson = JSON.stringify(where)
          if (!whereJson.includes(ticketId)) return null
          if (
            whereJson.includes(providerCompanyId) &&
            !whereJson.includes(ticketCompanyId)
          )
            return null
          if (whereJson.includes('__no_access__')) {
            return null
          }
          if (
            whereJson.includes('__restricted_empty_location_scope__') &&
            !whereJson.includes(ticketLocationId)
          ) {
            return null
          }
          if (
            where.id === ticketId &&
            where.companyId === ticketCompanyId &&
            !where.status &&
            !where.AND
          ) {
            return ticket
          }
          const checksTarget = whereJson.includes(requestedTargetUserId)
          if (checksTarget ? !targetLocationAllowed : !locationAllowed)
            return null
          if (whereJson.includes('problemCategory')) {
            const ok = checksTarget
              ? targetSpecializationAllowed
              : specializationAllowed
            return ok
              ? {
                  id: ticket.id,
                  companyId: ticket.companyId,
                  locationId: ticket.locationId,
                  assignedTechnicianId: ticket.assignedTechnicianId,
                }
              : null
          }
          return {
            id: ticket.id,
            companyId: ticket.companyId,
            locationId: ticket.locationId,
            assignedTechnicianId: ticket.assignedTechnicianId,
          }
        }),
        findUnique: jest.fn().mockResolvedValue(ticket),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (callback: any) => callback(tx)),
    }

    const serviceContracts = {
      getLinkedClientAccess: jest
        .fn()
        .mockImplementation(
          async (companyId: string, linkedClientId: string) => {
            if (
              companyId !== providerCompanyId ||
              linkedClientId !== ticketCompanyId ||
              !contractRole ||
              contractStatus !== 'ACTIVE'
            ) {
              return null
            }
            return {
              role: contractRole,
              status: contractStatus,
              clientCompanyId: ticketCompanyId,
              providerCompanyId,
            }
          },
        ),
      listPrimaryLinkedClientIds: jest.fn().mockResolvedValue([]),
      listSecondaryLinkedClientIds: jest
        .fn()
        .mockResolvedValue(contractRole ? [ticketCompanyId] : []),
      listLinkedClients: jest.fn().mockResolvedValue([]),
      assertPrimaryLinkedClientAccess: jest.fn(),
    }
    const timeline = {
      recordLegacyTx: jest
        .fn()
        .mockResolvedValue({ id: 'assignment-request-event' }),
    }
    const notifications = {
      notifyTicketAssignmentRequested: jest
        .fn()
        .mockResolvedValue({ notified: 1 }),
    }
    const contractContext = {
      getContractContext: jest.fn(async ({
        providerCompanyId: contractProviderCompanyId,
        clientCompanyId: contractClientCompanyId,
      }: any) => {
        if (
          contractProviderCompanyId !== providerCompanyId ||
          contractClientCompanyId !== ticketCompanyId ||
          !contractRole ||
          contractStatus !== 'ACTIVE'
        ) {
          return null
        }
        const specializationNames =
          categorySpecializationNames.length > 0
            ? categorySpecializationNames
            : []
        return {
          contractId: 'contract-1',
          serviceContractId: 'contract-1',
          clientCompanyId: ticketCompanyId,
          providerCompanyId,
          roleInContract: contractRole,
          locationMode: 'ALL_LOCATIONS',
          locationIds: [],
          specializationMode:
            specializationNames.length > 0 ? 'EXPLICIT' : 'UNCONFIGURED',
          specializationIds: specializationNames.map(
            (_, index) => `contract-spec-${index + 1}`,
          ),
          specializationNames,
          contractLocationScope: { mode: 'tenant_wide', locationIds: [] },
          contractSpecializationScope:
            specializationNames.length > 0
              ? {
                  mode: 'EXPLICIT',
                  specializationIds: specializationNames.map(
                    (_, index) => `contract-spec-${index + 1}`,
                  ),
                  specializationNames,
                }
              : {
                  mode: 'UNCONFIGURED',
                  specializationIds: [],
                  specializationNames: [],
                },
        }
      }),
    }
    const service = new TicketsAssignmentService(
      prisma as any,
      {} as any,
      {} as any,
      timeline as any,
      {} as any,
      serviceContracts as any,
      {} as any,
      notifications as any,
      contractContext as any,
    )

    return {
      service,
      prisma,
      timeline,
      notifications,
      serviceContracts,
      contractContext,
      ticketCompanyId,
      requesterId,
      requesterRole,
      requestedTargetUserId,
    }
  }

  async function requestAssignment(
    harness: ReturnType<typeof makeRequestHarness>,
  ) {
    return harness.service.requestAssignment(
      providerCompanyId,
      harness.requesterId,
      harness.requesterRole,
      ticketId,
      harness.ticketCompanyId,
      harness.requestedTargetUserId === harness.requesterId
        ? undefined
        : harness.requestedTargetUserId,
    )
  }

  async function expectDeniedWithoutSideEffects(
    options: RequestHarnessOptions,
  ) {
    const harness = makeRequestHarness(options)

    await expect(requestAssignment(harness)).rejects.toBeDefined()
    expect(harness.prisma.$transaction).not.toHaveBeenCalled()
    expect(harness.timeline.recordLegacyTx).not.toHaveBeenCalled()
    expect(
      harness.notifications.notifyTicketAssignmentRequested,
    ).not.toHaveBeenCalled()
  }

  it('denies assignment request from a SECONDARY technician with the wrong category specialization', async () => {
    await expectDeniedWithoutSideEffects({
      technicianSpecializationNames: ['Электрик'],
    })
  })

  it('denies assignment request from a SECONDARY technician without required specialization', async () => {
    await expectDeniedWithoutSideEffects({
      technicianSpecializationNames: [],
    })
  })

  it('denies assignment request when the technician has no binding for the ticket location', async () => {
    await expectDeniedWithoutSideEffects({
      bindingLocationIds: [forbiddenLocationId],
    })
  })

  it('denies assignment request for explicit SELECTED_LOCATIONS with an empty location set', async () => {
    await expectDeniedWithoutSideEffects({
      bindingLocationIds: [],
    })
  })

  it('denies assignment request from an inactive technician', async () => {
    await expectDeniedWithoutSideEffects({
      isActive: false,
    })
  })

  it('denies assignment request from a deleted technician', async () => {
    await expectDeniedWithoutSideEffects({
      deletedAt: new Date('2026-01-01T00:00:00.000Z'),
    })
  })

  it('denies assignment request across a foreign tenant without a valid contour', async () => {
    await expectDeniedWithoutSideEffects({
      ticketCompanyId: foreignClientCompanyId,
      ticketLocationId: 'foreign-location',
      contractRole: null,
    })
  })

  it('denies assignment request when the secondary contract is inactive', async () => {
    await expectDeniedWithoutSideEffects({
      contractStatus: 'INACTIVE',
    })
  })

  it('denies assignment request when the secondary contract is ended', async () => {
    await expectDeniedWithoutSideEffects({
      contractStatus: 'ENDED',
    })
  })

  it('denies Request Assignment when the provider is PRIMARY in the current contract', async () => {
    await expectDeniedWithoutSideEffects({
      contractRole: ServiceContractRole.PRIMARY,
    })
  })

  it('keeps the same provider in PRIMARY behavior for another client contract', async () => {
    await expectDeniedWithoutSideEffects({
      ticketCompanyId: primaryClientCompanyId,
      contractRole: ServiceContractRole.PRIMARY,
    })
  })

  it('allows assignment request from a valid ACTIVE SECONDARY technician', async () => {
    const harness = makeRequestHarness()

    await expect(requestAssignment(harness)).resolves.toEqual({
      ok: true,
      alreadyRequested: false,
      notified: 1,
    })
    expect(harness.prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(harness.timeline.recordLegacyTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'ticket.assignment_requested',
        entityId: ticketId,
        actorUserId: technicianId,
      }),
    )
    expect(
      harness.notifications.notifyTicketAssignmentRequested,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        providerCompanyId,
        technicianUserId: technicianId,
        ticketId,
      }),
    )
    expect(harness.contractContext.getContractContext).toHaveBeenCalledWith(
      expect.objectContaining({
        providerCompanyId,
        clientCompanyId: clientCompanyId,
      }),
    )
  })

  it('allows subcontractor ADMIN to request assignment for an own eligible technician', async () => {
    const harness = makeRequestHarness({
      requesterId: 'admin-secondary',
      requesterRole: UserRole.ADMIN,
      requesterIsExecutor: false,
      targetUserId: targetTechnicianId,
    })

    await expect(requestAssignment(harness)).resolves.toEqual({
      ok: true,
      alreadyRequested: false,
      notified: 1,
    })
    expect(harness.timeline.recordLegacyTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        payload: expect.objectContaining({
          requestedByUserId: 'admin-secondary',
          requestedTargetUserId: targetTechnicianId,
        }),
      }),
    )
    expect(
      harness.notifications.notifyTicketAssignmentRequested,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterUserId: 'admin-secondary',
        technicianUserId: targetTechnicianId,
      }),
    )
  })

  it('denies subcontractor ADMIN request to self when the admin is not executor-eligible', async () => {
    await expectDeniedWithoutSideEffects({
      requesterId: 'admin-secondary',
      requesterRole: UserRole.ADMIN,
      requesterIsExecutor: false,
      targetUserId: 'admin-secondary',
      targetIsExecutor: false,
    })
  })

  it('allows subcontractor ADMIN request to self when the admin is executor-eligible', async () => {
    const harness = makeRequestHarness({
      requesterId: 'admin-secondary',
      requesterRole: UserRole.ADMIN,
      requesterIsExecutor: true,
      targetUserId: 'admin-secondary',
      targetIsExecutor: true,
    })

    await expect(requestAssignment(harness)).resolves.toEqual({
      ok: true,
      alreadyRequested: false,
      notified: 1,
    })
  })

  it('denies assignment request for a foreign-company technician target', async () => {
    await expectDeniedWithoutSideEffects({
      requesterId: 'admin-secondary',
      requesterRole: UserRole.ADMIN,
      requesterIsExecutor: false,
      targetUserId: foreignTechnicianId,
      targetCompanyId: foreignProviderCompanyId,
    })
  })

  it('denies assignment request for a target technician without the ticket location', async () => {
    await expectDeniedWithoutSideEffects({
      requesterId: 'admin-secondary',
      requesterRole: UserRole.ADMIN,
      requesterIsExecutor: false,
      targetUserId: targetTechnicianId,
      targetBindingLocationIds: [forbiddenLocationId],
    })
  })

  it('denies assignment request for a target technician without the ticket specialization', async () => {
    await expectDeniedWithoutSideEffects({
      requesterId: 'admin-secondary',
      requesterRole: UserRole.ADMIN,
      requesterIsExecutor: false,
      targetUserId: targetTechnicianId,
      targetSpecializationNames: ['Электрик'],
    })
  })

  it('deduplicates assignment requests by requester and target user', async () => {
    const harness = makeRequestHarness({
      requesterId: 'admin-secondary',
      requesterRole: UserRole.ADMIN,
      requesterIsExecutor: false,
      targetUserId: targetTechnicianId,
      existingRequestTargetUserIds: ['other-tech'],
    })

    await expect(requestAssignment(harness)).resolves.toEqual({
      ok: true,
      alreadyRequested: false,
      notified: 1,
    })
    expect(harness.timeline.recordLegacyTx).toHaveBeenCalled()
  })

  it('preserves idempotent repeated assignment request behavior', async () => {
    const harness = makeRequestHarness({
      existingRequestTargetUserIds: [technicianId],
    })

    await expect(requestAssignment(harness)).resolves.toEqual({
      ok: true,
      alreadyRequested: true,
      notified: 0,
    })
    expect(harness.prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(harness.timeline.recordLegacyTx).not.toHaveBeenCalled()
    expect(
      harness.notifications.notifyTicketAssignmentRequested,
    ).not.toHaveBeenCalled()
  })

  it('does not create events or notifications when canonical eligibility denies the request', async () => {
    await expectDeniedWithoutSideEffects({
      technicianSpecializationNames: ['Электрик'],
    })
  })
})

describe('TicketsAssignmentService canonical claim isolation', () => {
  const providerCompanyId = 'secondary-provider'
  const clientCompanyId = 'client-company'
  const technicianId = 'tech-secondary'
  const ticketId = 'ticket-claim-1'
  const allowedLocationId = 'location-allowed'
  const categorySpecializationName = 'Климатическое оборудование'

  type ClaimIsolationOptions = {
    contractRole?: ServiceContractRole | null
    locationMode?: UserAccessLocationMode | null
    bindingLocationIds?: string[]
    technicianSpecializationNames?: string[]
    categorySpecializationNames?: string[]
    createdByUserId?: string | null
  }

  function normalized(value: string) {
    return value.trim().toLocaleLowerCase('ru-RU')
  }

  function makeClaimIsolationHarness(options: ClaimIsolationOptions = {}) {
    const contractRole =
      options.contractRole === undefined
        ? ServiceContractRole.SECONDARY
        : options.contractRole
    const locationMode =
      options.locationMode === undefined ? null : options.locationMode
    const bindingLocationIds = options.bindingLocationIds ?? []
    const technicianSpecializationNames =
      options.technicianSpecializationNames ?? [categorySpecializationName]
    const categorySpecializationNames = options.categorySpecializationNames ?? [
      categorySpecializationName,
    ]
    const specializationAllowed =
      categorySpecializationNames.length === 0 ||
      technicianSpecializationNames.some((candidate) =>
        categorySpecializationNames.some(
          (required) => normalized(candidate) === normalized(required),
        ),
      )

    const ticket = {
      id: ticketId,
      companyId: clientCompanyId,
      locationId: allowedLocationId,
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      createdByUserId: options.createdByUserId ?? 'client-requester',
      ticketNumber: 42,
      problemText: 'Test claim isolation',
      problemCategory: {
        specializationLinks: categorySpecializationNames.map((name, index) => ({
          specializationId: `client-spec-${index + 1}`,
          specialization: {
            id: `client-spec-${index + 1}`,
            name,
            isActive: true,
          },
        })),
      },
    }
    const technicianSpecializations = technicianSpecializationNames.map(
      (name, index) => ({
        specializationId: `provider-spec-${index + 1}`,
        specialization: {
          id: `provider-spec-${index + 1}`,
          name,
          isActive: true,
        },
      }),
    )
    const bindingRows = bindingLocationIds.map((locationId) => ({
      userId: technicianId,
      companyId: providerCompanyId,
      locationId,
      location: { clientCompanyId },
    }))

    function denyByCanonicalWhere(where: any) {
      const whereJson = JSON.stringify(where ?? {})
      if (!whereJson.includes(ticketId) && whereJson.includes('"id"'))
        return true
      if (whereJson.includes('__no_access__')) return true
      if (
        whereJson.includes('__restricted_empty_location_scope__') &&
        !whereJson.includes(allowedLocationId)
      ) {
        return true
      }
      if (
        ticket.assignedTechnicianId === null &&
        whereJson.includes('"assignedTechnicianId":{"in"') &&
        !whereJson.includes(`"locationId":{"in":["${allowedLocationId}"]}`)
      ) {
        return true
      }
      if (whereJson.includes('problemCategory') && !specializationAllowed)
        return true
      if (
        whereJson.includes(providerCompanyId) &&
        !whereJson.includes(clientCompanyId)
      )
        return true
      return false
    }

    const tx = {
      ticket: {
        findFirst: jest
          .fn()
          .mockImplementation(async ({ where }: any) =>
            denyByCanonicalWhere(where) ? null : ticket,
          ),
        update: jest.fn().mockResolvedValue({}),
      },
      ticketStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    }
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: providerCompanyId,
          allowTechnicianClaim: true,
        }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: technicianId,
          role: UserRole.TECHNICIAN,
          companyId: providerCompanyId,
          isExecutor: true,
          technicianSpecializations,
        }),
        findMany: jest.fn().mockResolvedValue([{ id: technicianId }]),
      },
      technicianSpecialization: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      serviceContract: {
        findFirst: jest.fn().mockResolvedValue({ id: 'contract-1' }),
      },
      serviceContractSpecialization: {
        findMany: jest.fn().mockResolvedValue(
          (categorySpecializationNames.length > 0
            ? categorySpecializationNames
            : ['Default']
          ).map((name, index) => ({
            specializationId: `contract-spec-${index + 1}`,
            specialization: { name },
          })),
        ),
      },
      userAccessScope: {
        findUnique: jest
          .fn()
          .mockResolvedValue(locationMode ? { locationMode } : null),
      },
      userLocationBinding: {
        findMany: jest.fn().mockImplementation(async (query: any) => {
          const where = query?.where ?? {}
          return bindingRows.filter((binding) => {
            if (where.userId && where.userId !== binding.userId) return false
            if (
              where.companyId &&
              typeof where.companyId === 'string' &&
              where.companyId !== binding.companyId
            ) {
              return false
            }
            if (
              where.companyId?.in &&
              !where.companyId.in.includes(binding.companyId)
            )
              return false
            const clientFilter = where.location?.clientCompanyId
            if (
              clientFilter &&
              clientFilter !== binding.location.clientCompanyId
            )
              return false
            return true
          })
        }),
      },
      ticket: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) =>
          denyByCanonicalWhere(where)
            ? null
            : {
                id: ticket.id,
                companyId: ticket.companyId,
                locationId: ticket.locationId,
                createdByUserId: ticket.createdByUserId,
                assignedTechnicianId: ticket.assignedTechnicianId,
              },
        ),
        findMany: jest
          .fn()
          .mockImplementation(async ({ where }: any) =>
            denyByCanonicalWhere(where) ? [] : [ticket],
          ),
        findUnique: jest.fn().mockResolvedValue(ticket),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (callback: any) => callback(tx)),
    }
    const serviceContracts = {
      getLinkedClientAccess: jest.fn().mockImplementation(async () =>
        contractRole
          ? {
              role: contractRole,
              status: 'ACTIVE',
              clientCompanyId,
              providerCompanyId,
            }
          : null,
      ),
      listPrimaryLinkedClientIds: jest
        .fn()
        .mockResolvedValue(
          contractRole === ServiceContractRole.PRIMARY ? [clientCompanyId] : [],
        ),
      listSecondaryLinkedClientIds: jest
        .fn()
        .mockResolvedValue(
          contractRole === ServiceContractRole.SECONDARY
            ? [clientCompanyId]
            : [],
        ),
      listLinkedClients: jest
        .fn()
        .mockResolvedValue(
          contractRole
            ? [{ linkedClientCompanyId: clientCompanyId, role: contractRole }]
            : [],
        ),
    }
    const contractContext = {
      getContractContext: jest.fn(async ({
        providerCompanyId: contractProviderCompanyId,
        clientCompanyId: contractClientCompanyId,
      }: any) => {
        if (
          contractProviderCompanyId !== providerCompanyId ||
          contractClientCompanyId !== clientCompanyId ||
          !contractRole
        ) {
          return null
        }
        const specializationNames =
          categorySpecializationNames.length > 0
            ? categorySpecializationNames
            : []
        return {
          contractId: 'contract-1',
          serviceContractId: 'contract-1',
          clientCompanyId,
          providerCompanyId,
          roleInContract: contractRole,
          locationMode: 'ALL_LOCATIONS',
          locationIds: [],
          specializationMode:
            specializationNames.length > 0 ? 'EXPLICIT' : 'UNCONFIGURED',
          specializationIds: specializationNames.map(
            (_, index) => `contract-spec-${index + 1}`,
          ),
          specializationNames,
          contractLocationScope: { mode: 'tenant_wide', locationIds: [] },
          contractSpecializationScope:
            specializationNames.length > 0
              ? {
                  mode: 'EXPLICIT',
                  specializationIds: specializationNames.map(
                    (_, index) => `contract-spec-${index + 1}`,
                  ),
                  specializationNames,
                }
              : {
                  mode: 'UNCONFIGURED',
                  specializationIds: [],
                  specializationNames: [],
                },
        }
      }),
    }
    const query = {
      getOne: jest.fn().mockResolvedValue({ id: ticketId }),
    }
    const timeline = {
      recordTx: jest.fn().mockResolvedValue({ id: 'claim-event-1' }),
    }
    const notifications = {
      scheduleTicketClaimedDispatchers: jest.fn(),
    }
    const service = new TicketsAssignmentService(
      prisma as any,
      {} as any,
      query as any,
      timeline as any,
      {} as any,
      serviceContracts as any,
      {} as any,
      notifications as any,
      contractContext as any,
    )

    return {
      service,
      prisma,
      tx,
      query,
      timeline,
      notifications,
      contractContext,
      serviceContracts,
    }
  }

  it('denies SECONDARY available tickets when the provider has no location bindings', async () => {
    const { service, prisma } = makeClaimIsolationHarness({
      contractRole: ServiceContractRole.SECONDARY,
      bindingLocationIds: [],
    })

    await expect(
      service.availableForTechnician(
        providerCompanyId,
        technicianId,
        clientCompanyId,
      ),
    ).resolves.toEqual([])

    expect(
      JSON.stringify(prisma.ticket.findMany.mock.calls[0][0].where),
    ).toContain('"assignedTechnicianId":{"in"')
  })

  it('denies SECONDARY claim without location bindings before transaction side effects', async () => {
    const { service, prisma, timeline, notifications } =
      makeClaimIsolationHarness({
        contractRole: ServiceContractRole.SECONDARY,
        bindingLocationIds: [],
      })

    await expect(
      service.claim(providerCompanyId, technicianId, ticketId, clientCompanyId),
    ).rejects.toBeDefined()

    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(timeline.recordTx).not.toHaveBeenCalled()
    expect(
      notifications.scheduleTicketClaimedDispatchers,
    ).not.toHaveBeenCalled()
  })

  it('denies SECONDARY direct claim for a client-created ticket even when location and specialization match', async () => {
    const { service, prisma, timeline, notifications } =
      makeClaimIsolationHarness({
        contractRole: ServiceContractRole.SECONDARY,
        bindingLocationIds: [allowedLocationId],
      })

    const available = await service.availableForTechnician(providerCompanyId, technicianId, clientCompanyId)
    expect(available).toHaveLength(1)
    expect(available[0]).toMatchObject({
      canClaim: false,
      canClaimByCurrentUser: false,
      canRequestAssignment: true,
      claimAvailabilityReason: 'Субподрядчик может запросить назначение; прямое взятие доступно только для собственных заявок.',
    })
    await expect(service.claim(providerCompanyId, technicianId, ticketId, clientCompanyId)).rejects.toBeDefined()

    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(timeline.recordTx).not.toHaveBeenCalled()
    expect(
      notifications.scheduleTicketClaimedDispatchers,
    ).not.toHaveBeenCalled()
  })

  it('denies claim for an unrelated client ticket before transaction side effects', async () => {
    const { service, prisma, timeline, notifications } =
      makeClaimIsolationHarness({
        contractRole: null,
        bindingLocationIds: [allowedLocationId],
      })

    await expect(
      service.claim(providerCompanyId, technicianId, ticketId, clientCompanyId),
    ).rejects.toBeDefined()

    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(timeline.recordTx).not.toHaveBeenCalled()
    expect(
      notifications.scheduleTicketClaimedDispatchers,
    ).not.toHaveBeenCalled()
  })

  it('allows SECONDARY direct claim for a self-created ticket inside the canonical contour', async () => {
    const {
      service,
      prisma,
      tx,
      query,
      timeline,
      notifications,
      serviceContracts,
    } = makeClaimIsolationHarness({
      contractRole: ServiceContractRole.SECONDARY,
      bindingLocationIds: [allowedLocationId],
      createdByUserId: technicianId,
    })

    const available = await service.availableForTechnician(providerCompanyId, technicianId, clientCompanyId)
    expect(available).toHaveLength(1)
    expect(available[0]).toMatchObject({
      canClaim: true,
      canClaimByCurrentUser: true,
      canRequestAssignment: false,
      claimAvailabilityReason: null,
    })
    await expect(service.claim(providerCompanyId, technicianId, ticketId, clientCompanyId)).resolves.toEqual({ id: ticketId })

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedTechnicianId: technicianId,
          status: TicketStatus.ASSIGNED,
        }),
      }),
    )
    expect(query.getOne).toHaveBeenCalledWith(
      providerCompanyId,
      technicianId,
      UserRole.TECHNICIAN,
      ticketId,
      undefined,
      undefined,
      clientCompanyId,
    )
    expect(timeline.recordTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        event: 'TICKET_ASSIGNMENT_CHANGED',
        actorUserId: technicianId,
        payload: expect.objectContaining({
          operationType: 'self_claim',
          previousValue: null,
          newValue: technicianId,
          assignedTechnicianId: technicianId,
          timestamp: expect.any(String),
        }),
      }),
    )
    expect(notifications.scheduleTicketClaimedDispatchers).toHaveBeenCalled()
    expect(serviceContracts.getLinkedClientAccess).toHaveBeenCalledWith(
      providerCompanyId,
      clientCompanyId,
    )
  })

  it('preserves PRIMARY claim availability through the same eligibility builder', async () => {
    const { service, prisma, serviceContracts } = makeClaimIsolationHarness({
      contractRole: ServiceContractRole.PRIMARY,
      bindingLocationIds: [],
    })

    const available = await service.availableForTechnician(providerCompanyId, technicianId, clientCompanyId)
    expect(available).toHaveLength(1)
    expect(available[0]).toMatchObject({
      canClaim: true,
      canClaimByCurrentUser: true,
      canRequestAssignment: false,
      claimAvailabilityReason: null,
    })
    await expect(service.claim(providerCompanyId, technicianId, ticketId, clientCompanyId)).resolves.toEqual({ id: ticketId })

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(serviceContracts.getLinkedClientAccess).toHaveBeenCalledWith(
      providerCompanyId,
      clientCompanyId,
    )
  })
})

describe('TicketsAssignmentService create post-action policy', () => {
  function makePrismaMock(opts?: {
    blocksCount?: number
    rolePermission?: boolean
    userPermission?: boolean
    companyType?: CompanyType
  }) {
    return {
      permissionBlock: {
        count: jest.fn().mockResolvedValue(opts?.blocksCount ?? 1),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({
          type: opts?.companyType ?? CompanyType.PROVIDER,
        }),
      },
      rolePermission: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            opts?.rolePermission === false ? null : { id: 'role-perm' },
          ),
      },
      userPermission: {
        findFirst: jest
          .fn()
          .mockResolvedValue(opts?.userPermission ? { id: 'user-perm' } : null),
      },
    }
  }

  function makeService(prisma: any) {
    return new TicketsAssignmentService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    )
  }

  const baseCandidates = [
    {
      id: 'master-1',
      email: 'master@example.test',
      role: UserRole.MASTER,
      companyId: 'provider-1',
      matched: true,
    },
    {
      id: 'tech-1',
      email: 'tech@example.test',
      role: UserRole.TECHNICIAN,
      companyId: 'provider-1',
      matched: true,
    },
    {
      id: 'foreign-1',
      email: 'foreign@example.test',
      role: UserRole.TECHNICIAN,
      companyId: 'provider-foreign',
      matched: true,
    },
  ]

  it('allows create+claim only when the creator is an eligible in-scope candidate', async () => {
    const svc = makeService(makePrismaMock())

    await expect(
      (svc as any).assertCreatePostActionAllowed({
        actorCompanyId: 'provider-1',
        actorUserId: 'tech-1',
        actorRole: UserRole.TECHNICIAN,
        action: 'claim_self',
        technicianId: null,
        candidates: baseCandidates,
        providerCompanyIds: ['provider-1'],
      }),
    ).resolves.toBe('tech-1')
  })

  it('denies create+claim when TICKETS_CLAIM is missing', async () => {
    const svc = makeService(makePrismaMock({ rolePermission: false }))

    await expect(
      (svc as any).assertCreatePostActionAllowed({
        actorCompanyId: 'provider-1',
        actorUserId: 'tech-1',
        actorRole: UserRole.TECHNICIAN,
        action: 'claim_self',
        technicianId: null,
        candidates: baseCandidates,
        providerCompanyIds: ['provider-1'],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Missing permission: TICKETS_CLAIM',
      }),
    })
  })

  it('denies create+claim when PermissionBlock catalog is empty', async () => {
    const prisma = makePrismaMock({ blocksCount: 0 })
    const svc = makeService(prisma)

    await expect(
      (svc as any).assertCreatePostActionAllowed({
        actorCompanyId: 'provider-1',
        actorUserId: 'tech-1',
        actorRole: UserRole.TECHNICIAN,
        action: 'claim_self',
        technicianId: null,
        candidates: baseCandidates,
        providerCompanyIds: ['provider-1'],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Missing permission: TICKETS_CLAIM',
      }),
    })
    expect(prisma.rolePermission.findFirst).not.toHaveBeenCalled()
    expect(prisma.userPermission.findFirst).not.toHaveBeenCalled()
  })

  it('denies create+claim when the creator is outside the location/category candidate scope', async () => {
    const svc = makeService(makePrismaMock())

    await expect(
      (svc as any).assertCreatePostActionAllowed({
        actorCompanyId: 'provider-1',
        actorUserId: 'dispatcher-1',
        actorRole: UserRole.DISPATCHER,
        action: 'claim_self',
        technicianId: null,
        candidates: baseCandidates,
        providerCompanyIds: ['provider-1'],
      }),
    ).rejects.toThrow(
      'Current user is not available for this ticket location/category',
    )
  })

  it('allows create+assign to an in-scope employee of the actor provider company', async () => {
    const svc = makeService(makePrismaMock())

    await expect(
      (svc as any).assertCreatePostActionAllowed({
        actorCompanyId: 'provider-1',
        actorUserId: 'master-1',
        actorRole: UserRole.MASTER,
        action: 'assign_employee',
        technicianId: 'tech-1',
        candidates: baseCandidates,
        providerCompanyIds: ['provider-1'],
      }),
    ).resolves.toBe('tech-1')
  })

  it('denies create+assign when the candidate was excluded by specialization diagnostics', async () => {
    const svc = makeService(makePrismaMock())

    await expect(
      (svc as any).assertCreatePostActionAllowed({
        actorCompanyId: 'provider-1',
        actorUserId: 'master-1',
        actorRole: UserRole.MASTER,
        action: 'assign_employee',
        technicianId: 'tech-no-specialization',
        candidates: [
          ...baseCandidates,
          {
            id: 'tech-no-specialization',
            email: 'tech-no-specialization@example.test',
            role: UserRole.TECHNICIAN,
            companyId: 'provider-1',
            matched: false,
            matchReason: 'no_match',
          },
        ],
        providerCompanyIds: ['provider-1'],
      }),
    ).rejects.toThrow('Technician not found')
  })

  it('denies create+assign to a foreign provider employee even when they are otherwise bound', async () => {
    const svc = makeService(makePrismaMock())

    await expect(
      (svc as any).assertCreatePostActionAllowed({
        actorCompanyId: 'provider-1',
        actorUserId: 'master-1',
        actorRole: UserRole.MASTER,
        action: 'assign_employee',
        technicianId: 'foreign-1',
        candidates: baseCandidates,
        providerCompanyIds: ['provider-1'],
      }),
    ).rejects.toThrow('Technician not found')
  })

  it('denies create+assign when TICKETS_ASSIGN is missing', async () => {
    const svc = makeService(makePrismaMock({ rolePermission: false }))

    await expect(
      (svc as any).assertCreatePostActionAllowed({
        actorCompanyId: 'provider-1',
        actorUserId: 'master-1',
        actorRole: UserRole.MASTER,
        action: 'assign_employee',
        technicianId: 'tech-1',
        candidates: baseCandidates,
        providerCompanyIds: ['provider-1'],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Missing permission: TICKETS_ASSIGN',
      }),
    })
  })

  it('denies create+assign when PermissionBlock catalog is empty', async () => {
    const prisma = makePrismaMock({ blocksCount: 0 })
    const svc = makeService(prisma)

    await expect(
      (svc as any).assertCreatePostActionAllowed({
        actorCompanyId: 'provider-1',
        actorUserId: 'master-1',
        actorRole: UserRole.MASTER,
        action: 'assign_employee',
        technicianId: 'tech-1',
        candidates: baseCandidates,
        providerCompanyIds: ['provider-1'],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Missing permission: TICKETS_ASSIGN',
      }),
    })
    expect(prisma.rolePermission.findFirst).not.toHaveBeenCalled()
    expect(prisma.userPermission.findFirst).not.toHaveBeenCalled()
  })

  it('keeps explicit leave_unassigned from auto-assigning', () => {
    const svc = makeService(makePrismaMock())

    expect(
      (svc as any).resolveCreatePostAction({
        requestedAction: 'leave_unassigned',
        assignTechnicianId: null,
        shouldAutoAssign: true,
      }),
    ).toEqual({
      action: 'leave_unassigned',
      technicianId: null,
      autoAssignAllowed: false,
    })
  })

  it('requires assignTechnicianId for assign_employee', () => {
    const svc = makeService(makePrismaMock())

    expect(() =>
      (svc as any).resolveCreatePostAction({
        requestedAction: 'assign_employee',
        assignTechnicianId: null,
        shouldAutoAssign: false,
      }),
    ).toThrow('assignTechnicianId is required for assign_employee')
  })
})

describe('TicketsAssignmentService linked-provider create assignment contour', () => {
  const providerCompanyId = 'provider-company'
  const clientCompanyId = 'client-company'
  const locationId = 'location-1'
  const categoryId = 'category-1'
  const providerTech = {
    id: 'provider-tech',
    email: 'provider-tech@example.test',
    firstName: 'Provider',
    lastName: 'Tech',
    role: UserRole.TECHNICIAN,
    companyId: providerCompanyId,
    matched: true,
  }

  function makeCreateHarness(options?: {
    candidates?: any[]
    autoAssignEnabled?: boolean
    autoAssignedTechnicianId?: string | null
    linkedAccessRole?: 'PRIMARY' | 'SECONDARY'
    secondaryProviderIds?: string[]
    blocksCount?: number
    rolePermission?: boolean
    userPermission?: boolean
  }) {
    const createdTicket = {
      id: 'ticket-1',
      ticketNumber: 1001,
      companyId: clientCompanyId,
      locationId,
      problemCategoryId: categoryId,
      problemText: 'Generated problem',
      urgency: 'NOT_URGENT',
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
    }
    const assignedTicket = {
      ...createdTicket,
      status: TicketStatus.ASSIGNED,
      assignedTechnicianId:
        options?.autoAssignedTechnicianId ?? providerTech.id,
    }
    const tx = {
      ticket: {
        create: jest.fn().mockResolvedValue(createdTicket),
        update: jest.fn().mockResolvedValue(assignedTicket),
      },
      ticketStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 'status-history-1' }),
      },
      ticketAttachment: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    }
    const prisma = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
      permissionBlock: {
        count: jest.fn().mockResolvedValue(options?.blocksCount ?? 1),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({ type: CompanyType.PROVIDER }),
      },
      rolePermission: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            options?.rolePermission === false
              ? null
              : { id: 'role-permission' },
          ),
      },
      userPermission: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            options?.userPermission ? { id: 'user-permission' } : null,
          ),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          companyId:
            options?.autoAssignedTechnicianId === 'client-tech'
              ? clientCompanyId
              : providerCompanyId,
          email: 'provider-tech@example.test',
        }),
      },
    }
    const assignmentEngine = {
      selectTechnicianForTicket: jest
        .fn()
        .mockResolvedValue(
          options?.autoAssignedTechnicianId
            ? { technicianId: options.autoAssignedTechnicianId }
            : null,
        ),
    }
    const timeline = {
      recordTx: jest.fn().mockResolvedValue({ id: 'timeline-event-1' }),
      recordLegacyTx: jest.fn().mockResolvedValue({ id: 'legacy-event-1' }),
    }
    const attachments = {
      bindAttachmentsToTicketTx: jest.fn().mockResolvedValue([]),
    }
    const serviceContracts = {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        role: options?.linkedAccessRole ?? 'SECONDARY',
        status: 'ACTIVE',
      }),
      listSecondaryProviderCompanyIds: jest
        .fn()
        .mockResolvedValue(options?.secondaryProviderIds ?? []),
    }
    const technicians = {
      resolveBoundCreateScope: jest
        .fn()
        .mockResolvedValue({ companyId: clientCompanyId }),
    }
    const notifications = {
      onTicketCreated: jest.fn(),
      scheduleTicketCommentAdded: jest.fn(),
      onTicketAssigned: jest.fn(),
    }
    const service = new TicketsAssignmentService(
      prisma as any,
      assignmentEngine as any,
      {} as any,
      timeline as any,
      attachments as any,
      serviceContracts as any,
      technicians as any,
      notifications as any,
    )
    jest
      .spyOn(service as any, 'resolveTicketOwnerCompanyId')
      .mockResolvedValue(clientCompanyId)
    jest
      .spyOn(service as any, 'assertActorCanUseLocationForScope')
      .mockResolvedValue(undefined)
    jest.spyOn(service as any, 'getCompany').mockResolvedValue({
      id: clientCompanyId,
      type: CompanyType.CLIENT,
      autoAssignEnabled: options?.autoAssignEnabled ?? false,
      allowTechnicianClaim: true,
    })
    jest.spyOn(service as any, 'getCategory').mockResolvedValue({
      id: categoryId,
      name: 'Electrical',
      instructions: null,
      specializationLinks: [
        {
          specializationId: 'spec-1',
          specialization: { id: 'spec-1', name: 'Electrical', isActive: true },
        },
      ],
    })
    jest.spyOn(service as any, 'getLocation').mockResolvedValue({
      id: locationId,
      name: 'Client location',
      address: 'Address 1',
      city: 'Ufa',
      region: null,
      platformCode: null,
      externalCode: null,
    })
    const resolveCreateCandidatesSpy = jest
      .spyOn(service as any, 'resolveCreateCandidates')
      .mockResolvedValue(options?.candidates ?? [providerTech])

    return {
      service,
      prisma,
      tx,
      assignmentEngine,
      resolveCreateCandidatesSpy,
    }
  }

  function baseDto(overrides?: Record<string, any>) {
    return {
      clientCompanyId,
      locationId,
      categoryId,
      description: 'Broken equipment',
      ...overrides,
    }
  }

  it('provider ADMIN creates a linked-client ticket and assigns own provider employee', async () => {
    const { service, tx, resolveCreateCandidatesSpy } = makeCreateHarness()

    const result = await service.create(
      providerCompanyId,
      'admin-1',
      UserRole.ADMIN,
      baseDto({
        postCreateAction: 'assign_employee',
        assignTechnicianId: providerTech.id,
      }) as any,
    )

    expect(resolveCreateCandidatesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        providerCompanyIds: [providerCompanyId],
        clientCompanyId,
        locationId,
      }),
    )
    expect(mockAssertActorCanUseProblemCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({
          id: 'admin-1',
          role: UserRole.ADMIN,
          companyId: providerCompanyId,
        }),
        scopeCompanyId: clientCompanyId,
        problemCategoryId: categoryId,
      }),
    )
    expect(tx.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: clientCompanyId,
          createdByUserId: 'admin-1',
        }),
      }),
    )
    expect(tx.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedTechnicianId: providerTech.id,
          status: TicketStatus.ASSIGNED,
        }),
      }),
    )
    expect(result.ticket.companyId).toBe(clientCompanyId)
    expect(result.autoAssigned).toBe(true)
  })

  it('provider MASTER creates a linked-client ticket and assigns own provider employee', async () => {
    const { service, tx, resolveCreateCandidatesSpy } = makeCreateHarness()

    await expect(
      service.create(
        providerCompanyId,
        'master-1',
        UserRole.MASTER,
        baseDto({
          postCreateAction: 'assign_employee',
          assignTechnicianId: providerTech.id,
        }) as any,
      ),
    ).resolves.toMatchObject({
      ticket: expect.objectContaining({ companyId: clientCompanyId }),
    })

    expect(resolveCreateCandidatesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        providerCompanyIds: [providerCompanyId],
        clientCompanyId,
      }),
    )
    expect(tx.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedTechnicianId: providerTech.id,
        }),
      }),
    )
  })

  it('denies create when category specialization is outside actor scope', async () => {
    const { service, tx } = makeCreateHarness()
    mockAssertActorCanUseProblemCategory.mockRejectedValueOnce(
      new ForbiddenException(
        'Problem category is not available in current user scope',
      ),
    )

    await expect(
      service.create(
        providerCompanyId,
        'admin-1',
        UserRole.ADMIN,
        baseDto() as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException)

    expect(tx.ticket.create).not.toHaveBeenCalled()
  })

  it('provider TECHNICIAN creates a linked-client ticket and claims from provider workforce', async () => {
    const { service, tx, resolveCreateCandidatesSpy } = makeCreateHarness()

    const result = await service.create(
      providerCompanyId,
      providerTech.id,
      UserRole.TECHNICIAN,
      baseDto({
        postCreateAction: 'claim_self',
      }) as any,
    )

    expect(resolveCreateCandidatesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        providerCompanyIds: [providerCompanyId],
        clientCompanyId,
        locationId,
      }),
    )
    expect(tx.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: clientCompanyId }),
      }),
    )
    expect(tx.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedTechnicianId: providerTech.id,
          status: TicketStatus.ASSIGNED,
        }),
      }),
    )
    expect(result.ticket.companyId).toBe(clientCompanyId)
  })

  it('client-side creation keeps client ticket ownership and client workforce', async () => {
    const clientTech = {
      ...providerTech,
      id: 'client-own-tech',
      companyId: clientCompanyId,
    }
    const { service, tx, resolveCreateCandidatesSpy } = makeCreateHarness({
      candidates: [clientTech],
    })

    const result = await service.create(
      clientCompanyId,
      'client-admin-1',
      UserRole.ADMIN,
      baseDto({
        postCreateAction: 'assign_employee',
        assignTechnicianId: clientTech.id,
      }) as any,
    )

    expect(resolveCreateCandidatesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        providerCompanyIds: [clientCompanyId],
        clientCompanyId,
        locationId,
      }),
    )
    expect(tx.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: clientCompanyId }),
      }),
    )
    expect(tx.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedTechnicianId: clientTech.id }),
      }),
    )
    expect(result.ticket.companyId).toBe(clientCompanyId)
  })

  it('auto-assign uses provider workforce while keeping linked-client ticket ownership', async () => {
    const { service, tx, assignmentEngine } = makeCreateHarness({
      autoAssignEnabled: true,
      autoAssignedTechnicianId: providerTech.id,
    })

    const result = await service.create(
      providerCompanyId,
      'admin-1',
      UserRole.ADMIN,
      baseDto() as any,
    )

    expect(assignmentEngine.selectTechnicianForTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: providerCompanyId,
        locationId,
        categoryId,
      }),
    )
    expect(tx.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: clientCompanyId }),
      }),
    )
    expect(result.ticket.companyId).toBe(clientCompanyId)
    expect(result.autoAssigned).toBe(true)
  })

  it('denies assigning a client-company employee from provider linked-client create', async () => {
    const clientEmployee = {
      ...providerTech,
      id: 'client-tech',
      companyId: clientCompanyId,
    }
    const { service } = makeCreateHarness({ candidates: [clientEmployee] })

    await expect(
      service.create(
        providerCompanyId,
        'admin-1',
        UserRole.ADMIN,
        baseDto({
          postCreateAction: 'assign_employee',
          assignTechnicianId: clientEmployee.id,
        }) as any,
      ),
    ).rejects.toThrow('Technician not found')
  })

  it('denies assigning another provider employee from provider linked-client create', async () => {
    const foreignProviderEmployee = {
      ...providerTech,
      id: 'foreign-provider-tech',
      companyId: 'foreign-provider',
    }
    const { service } = makeCreateHarness({
      candidates: [foreignProviderEmployee],
    })

    await expect(
      service.create(
        providerCompanyId,
        'admin-1',
        UserRole.ADMIN,
        baseDto({
          postCreateAction: 'assign_employee',
          assignTechnicianId: foreignProviderEmployee.id,
        }) as any,
      ),
    ).rejects.toThrow('Technician not found')
  })

  it('denies inactive or deleted provider employees because they are absent from create candidates', async () => {
    const { service } = makeCreateHarness({ candidates: [] })

    await expect(
      service.create(
        providerCompanyId,
        'admin-1',
        UserRole.ADMIN,
        baseDto({
          postCreateAction: 'assign_employee',
          assignTechnicianId: 'inactive-or-deleted-tech',
        }) as any,
      ),
    ).rejects.toThrow('Technician not found')
  })

  it('keeps create-assignment-candidates and create(assign_employee) on the same provider workforce contour', async () => {
    const { service, resolveCreateCandidatesSpy } = makeCreateHarness()
    jest
      .spyOn(service as any, 'assertExecutorOperationsAllowed')
      .mockResolvedValue(undefined)

    const candidateList = await service.listCreateAssignmentCandidates(
      providerCompanyId,
      {
        id: 'admin-1',
        role: UserRole.ADMIN,
      },
      {
        clientCompanyId,
        locationId,
        categoryId,
      },
    )
    await expect(
      service.create(
        providerCompanyId,
        'admin-1',
        UserRole.ADMIN,
        baseDto({
          postCreateAction: 'assign_employee',
          assignTechnicianId: providerTech.id,
        }) as any,
      ),
    ).resolves.toBeTruthy()

    expect(
      candidateList.matched.map((candidate: any) => candidate.id),
    ).toContain(providerTech.id)
    expect(resolveCreateCandidatesSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        providerCompanyIds: [providerCompanyId],
        clientCompanyId,
        locationId,
      }),
    )
    expect(resolveCreateCandidatesSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        providerCompanyIds: [providerCompanyId],
        clientCompanyId,
        locationId,
      }),
    )
  })

  it('denies create-assignment-candidates when PermissionBlock catalog is empty', async () => {
    const { service, prisma, resolveCreateCandidatesSpy } = makeCreateHarness({
      blocksCount: 0,
    })
    jest
      .spyOn(service as any, 'assertExecutorOperationsAllowed')
      .mockResolvedValue(undefined)

    await expect(
      service.listCreateAssignmentCandidates(
        providerCompanyId,
        {
          id: 'admin-1',
          role: UserRole.ADMIN,
        },
        {
          clientCompanyId,
          locationId,
          categoryId,
        },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Missing permission: TICKETS_ASSIGN',
      }),
    })
    expect(prisma.rolePermission.findFirst).not.toHaveBeenCalled()
    expect(prisma.userPermission.findFirst).not.toHaveBeenCalled()
    expect(resolveCreateCandidatesSpy).not.toHaveBeenCalled()
  })

  it('denies create-assignment-candidates when RolePermission is missing', async () => {
    const { service, resolveCreateCandidatesSpy } = makeCreateHarness({
      rolePermission: false,
    })
    jest
      .spyOn(service as any, 'assertExecutorOperationsAllowed')
      .mockResolvedValue(undefined)

    await expect(
      service.listCreateAssignmentCandidates(
        providerCompanyId,
        {
          id: 'admin-1',
          role: UserRole.ADMIN,
        },
        {
          clientCompanyId,
          locationId,
          categoryId,
        },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Missing permission: TICKETS_ASSIGN',
      }),
    })
    expect(resolveCreateCandidatesSpy).not.toHaveBeenCalled()
  })

  it('keeps primary create and create-assignment-candidates aligned with SECONDARY provider candidates', async () => {
    const secondaryProviderId = 'secondary-provider'
    const secondaryTech = {
      ...providerTech,
      id: 'secondary-tech',
      email: 'secondary-tech@example.test',
      companyId: secondaryProviderId,
    }
    const { service, resolveCreateCandidatesSpy } = makeCreateHarness({
      candidates: [providerTech, secondaryTech],
      linkedAccessRole: 'PRIMARY',
      secondaryProviderIds: [secondaryProviderId],
    })
    jest
      .spyOn(service as any, 'assertExecutorOperationsAllowed')
      .mockResolvedValue(undefined)

    const candidateList = await service.listCreateAssignmentCandidates(
      providerCompanyId,
      {
        id: 'admin-1',
        role: UserRole.ADMIN,
      },
      {
        clientCompanyId,
        locationId,
        categoryId,
      },
    )
    await expect(
      service.create(
        providerCompanyId,
        'admin-1',
        UserRole.ADMIN,
        baseDto({
          postCreateAction: 'assign_employee',
          assignTechnicianId: secondaryTech.id,
        }) as any,
      ),
    ).resolves.toBeTruthy()

    expect(
      candidateList.matched.map((candidate: any) => candidate.id),
    ).toContain(secondaryTech.id)
    expect(resolveCreateCandidatesSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        providerCompanyIds: [providerCompanyId, secondaryProviderId],
        clientCompanyId,
        locationId,
      }),
    )
    expect(resolveCreateCandidatesSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        providerCompanyIds: [providerCompanyId, secondaryProviderId],
        clientCompanyId,
        locationId,
      }),
    )
  })
})
