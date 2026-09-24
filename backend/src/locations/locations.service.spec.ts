import { CompanyType, UserAccessLocationMode, UserRole } from '@prisma/client'

import { LocationsService } from './locations.service'

describe('LocationsService location scope', () => {
  function makePrismaMock() {
    return {
      company: {
        findUnique: jest.fn(),
      },
      location: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      userAccessScope: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      userLocationBinding: {
        findMany: jest.fn(),
      },
    }
  }

  function makeServiceContractsMock() {
    return {
      assertPrimaryLinkedClientAccess: jest.fn().mockResolvedValue(undefined),
    }
  }

  it('keeps client ADMIN restricted to explicit own-company location bindings', async () => {
    const prisma = makePrismaMock()
    prisma.company.findUnique.mockResolvedValue({ type: CompanyType.CLIENT })
    prisma.location.findMany.mockResolvedValue([
      { id: 'loc-1', clientCompanyId: 'client-company', name: 'Кофейня U', isActive: true },
    ])
    prisma.userLocationBinding.findMany.mockResolvedValue([{ locationId: 'loc-1' }])

    const svc = new LocationsService(prisma as any, makeServiceContractsMock() as any)

    const result = await svc.list('client-company', UserRole.ADMIN, 'user-1', {})

    expect(result).toHaveLength(1)
    expect(prisma.userLocationBinding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          companyId: 'client-company',
        }),
      }),
    )
    expect(prisma.location.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientCompanyId: 'client-company',
          id: { in: ['loc-1'] },
        }),
      }),
    )
  })

  it('keeps restricted NETWORK_DIRECTOR location list scoped to bindings', async () => {
    const prisma = makePrismaMock()
    prisma.company.findUnique.mockResolvedValue({ type: CompanyType.CLIENT })
    prisma.userAccessScope.findUnique.mockResolvedValue({
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
    })
    prisma.userLocationBinding.findMany.mockResolvedValue([{ locationId: 'loc-network' }])
    prisma.location.findMany.mockResolvedValue([
      { id: 'loc-network', clientCompanyId: 'client-company', name: 'Network', isActive: true },
    ])
    const svc = new LocationsService(prisma as any, makeServiceContractsMock() as any)

    await svc.list('client-company', UserRole.NETWORK_DIRECTOR, 'network-1', {})

    expect(prisma.location.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        clientCompanyId: 'client-company',
        id: { in: ['loc-network'] },
      }),
    )
  })

  it('keeps TECHNICIAN restricted to explicit location bindings', async () => {
    const prisma = makePrismaMock()
    prisma.company.findUnique.mockResolvedValue({ type: CompanyType.CLIENT })
    prisma.userLocationBinding.findMany.mockResolvedValue([{ locationId: 'loc-bound' }])
    prisma.location.findMany.mockResolvedValue([
      { id: 'loc-bound', clientCompanyId: 'client-company', name: 'Bound', isActive: true },
    ])

    const svc = new LocationsService(prisma as any, makeServiceContractsMock() as any)

    const result = await svc.list('client-company', UserRole.TECHNICIAN, 'tech-1', {})

    expect(result).toEqual([
      { id: 'loc-bound', clientCompanyId: 'client-company', name: 'Bound', isActive: true },
    ])
    expect(prisma.userLocationBinding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'tech-1',
          companyId: 'client-company',
        }),
      }),
    )
    expect(prisma.location.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        clientCompanyId: 'client-company',
        id: { in: ['loc-bound'] },
      }),
    )
  })

  it('preserves provider linked-client binding scope', async () => {
    const prisma = makePrismaMock()
    // actor (provider-company) resolves as PROVIDER; requested linked scope (client-company) must be CLIENT
    prisma.company.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve({ type: where.id === 'client-company' ? CompanyType.CLIENT : CompanyType.PROVIDER }),
    )
    prisma.userLocationBinding.findMany.mockResolvedValue([{ locationId: 'linked-loc' }])
    prisma.location.findMany.mockResolvedValue([
      { id: 'linked-loc', clientCompanyId: 'client-company', name: 'Linked', isActive: true },
    ])
    const contracts = makeServiceContractsMock()

    const svc = new LocationsService(prisma as any, contracts as any)

    const result = await svc.list('provider-company', UserRole.NETWORK_DIRECTOR, 'user-1', {}, 'client-company')

    expect(contracts.assertPrimaryLinkedClientAccess).toHaveBeenCalledWith('provider-company', 'client-company')
    expect(prisma.userLocationBinding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          companyId: 'provider-company',
          location: expect.objectContaining({
            clientCompanyId: 'client-company',
          }),
        }),
      }),
    )
    expect(result).toEqual([
      { id: 'linked-loc', clientCompanyId: 'client-company', name: 'Linked', isActive: true },
    ])
  })

  it('provider ADMIN with legacy ALL scope sees linked-client locations without binding fallback requirements', async () => {
    const prisma = makePrismaMock()
    prisma.company.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve({ type: where.id === 'client-company' ? CompanyType.CLIENT : CompanyType.PROVIDER }),
    )
    prisma.userAccessScope.findUnique.mockResolvedValue(null)
    prisma.userLocationBinding.findMany.mockResolvedValue([])
    prisma.location.findMany.mockResolvedValue([
      { id: 'loc-1', clientCompanyId: 'client-company', name: 'Allowed 1', isActive: true },
      { id: 'loc-2', clientCompanyId: 'client-company', name: 'Allowed 2', isActive: true },
    ])
    const svc = new LocationsService(prisma as any, makeServiceContractsMock() as any)

    await svc.list('provider-company', UserRole.ADMIN, 'admin-1', {}, 'client-company')

    expect(prisma.location.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        clientCompanyId: 'client-company',
      }),
    )
    expect(prisma.location.findMany.mock.calls[0][0].where).not.toHaveProperty('id')
  })

  it('provider ADMIN with SELECTED_LOCATIONS sees only selected linked-client locations', async () => {
    const prisma = makePrismaMock()
    prisma.company.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve({ type: where.id === 'client-company' ? CompanyType.CLIENT : CompanyType.PROVIDER }),
    )
    prisma.userAccessScope.findUnique.mockResolvedValue({
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
    })
    prisma.userLocationBinding.findMany.mockResolvedValue([{ locationId: 'loc-selected' }])
    prisma.location.findMany.mockResolvedValue([
      { id: 'loc-selected', clientCompanyId: 'client-company', name: 'Selected', isActive: true },
    ])
    const svc = new LocationsService(prisma as any, makeServiceContractsMock() as any)

    await svc.list('provider-company', UserRole.ADMIN, 'admin-1', {}, 'client-company')

    expect(prisma.location.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        clientCompanyId: 'client-company',
        id: { in: ['loc-selected'] },
      }),
    )
  })

  it('provider ADMIN with SELECTED_LOCATIONS and no bindings sees no linked-client locations', async () => {
    const prisma = makePrismaMock()
    prisma.company.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve({ type: where.id === 'client-company' ? CompanyType.CLIENT : CompanyType.PROVIDER }),
    )
    prisma.userAccessScope.findUnique.mockResolvedValue({
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
    })
    prisma.userLocationBinding.findMany.mockResolvedValue([])
    prisma.location.findMany.mockResolvedValue([])
    const svc = new LocationsService(prisma as any, makeServiceContractsMock() as any)

    const result = await svc.list('provider-company', UserRole.ADMIN, 'admin-1', {}, 'client-company')

    expect(result).toEqual([])
    expect(prisma.location.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        clientCompanyId: 'client-company',
        id: { equals: '__no_access__' },
      }),
    )
  })

  it('provider ADMIN with SELECTED_LOCATIONS cannot read an unselected linked-client location directly', async () => {
    const prisma = makePrismaMock()
    prisma.company.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve({ type: where.id === 'client-company' ? CompanyType.CLIENT : CompanyType.PROVIDER }),
    )
    prisma.userAccessScope.findUnique.mockResolvedValue({
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
    })
    prisma.userLocationBinding.findMany.mockResolvedValue([])
    const svc = new LocationsService(prisma as any, makeServiceContractsMock() as any)

    await expect(
      svc.getOne('provider-company', UserRole.ADMIN, 'admin-1', 'loc-forbidden', 'client-company'),
    ).rejects.toThrow('Location not found')
    expect(prisma.location.findFirst).not.toHaveBeenCalled()
  })

  it('inactive provider ADMIN with stale JWT sees no linked-client locations', async () => {
    const prisma = makePrismaMock()
    prisma.company.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve({ type: where.id === 'client-company' ? CompanyType.CLIENT : CompanyType.PROVIDER }),
    )
    prisma.user.findFirst.mockResolvedValue(null)
    prisma.location.findMany.mockResolvedValue([])
    const svc = new LocationsService(prisma as any, makeServiceContractsMock() as any)

    await svc.list('provider-company', UserRole.ADMIN, 'admin-1', {}, 'client-company')

    expect(prisma.location.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        clientCompanyId: 'client-company',
        id: { equals: '__no_access__' },
      }),
    )
  })

  it('create: provider in a linked-client scope creates a CLIENT-owned location', async () => {
    const prisma = makePrismaMock()
    prisma.company.findUnique.mockResolvedValue({ type: CompanyType.CLIENT })
    prisma.location.findFirst.mockResolvedValue(null)
    prisma.location.create.mockResolvedValue({ id: 'new-loc' })
    const contracts = makeServiceContractsMock()

    const svc = new LocationsService(prisma as any, contracts as any)
    await svc.create('provider-company', UserRole.ADMIN, { name: 'Кафе', platformCode: 'CAFE1' }, 'client-company')

    expect(contracts.assertPrimaryLinkedClientAccess).toHaveBeenCalledWith('provider-company', 'client-company')
    expect(prisma.location.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientCompanyId: 'client-company' }) }),
    )
  })

  it('create: provider without a linked-client scope is rejected', async () => {
    const prisma = makePrismaMock()
    prisma.company.findUnique.mockResolvedValue({ type: CompanyType.PROVIDER })
    const svc = new LocationsService(prisma as any, makeServiceContractsMock() as any)

    await expect(
      svc.create('provider-company', UserRole.ADMIN, { name: 'Кафе', platformCode: 'CAFE1' }),
    ).rejects.toThrow(/CLIENT company/)
    expect(prisma.location.create).not.toHaveBeenCalled()
  })

  it('create: client leader creates a location owned by their own client company', async () => {
    const prisma = makePrismaMock()
    prisma.company.findUnique.mockResolvedValue({ type: CompanyType.CLIENT })
    prisma.location.findFirst.mockResolvedValue(null)
    prisma.location.create.mockResolvedValue({ id: 'new-loc' })
    const svc = new LocationsService(prisma as any, makeServiceContractsMock() as any)

    await svc.create('client-company', UserRole.ADMIN, { name: 'Точка', platformCode: 'P1' })

    expect(prisma.location.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientCompanyId: 'client-company' }) }),
    )
  })
})
