import { CompanyType, UserRole } from '@prisma/client'

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
