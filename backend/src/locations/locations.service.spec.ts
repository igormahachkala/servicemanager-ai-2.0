import { CompanyType, UserRole } from '@prisma/client'

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

  it('lets client ADMIN see all own-company locations without binding truncation', async () => {
    const prisma = makePrismaMock()
    prisma.company.findUnique.mockResolvedValue({ type: CompanyType.CLIENT })
    prisma.location.findMany.mockResolvedValue([
      { id: 'loc-1', clientCompanyId: 'client-company', name: 'Кофейня U', isActive: true },
      { id: 'loc-2', clientCompanyId: 'client-company', name: 'Уфа 1', isActive: true },
      { id: 'loc-3', clientCompanyId: 'client-company', name: 'Уфа 11', isActive: true },
    ])
    prisma.userLocationBinding.findMany.mockResolvedValue([{ locationId: 'loc-1' }])

    const svc = new LocationsService(prisma as any, makeServiceContractsMock() as any)

    const result = await svc.list('client-company', UserRole.ADMIN, 'user-1', {})

    expect(result).toHaveLength(3)
    expect(prisma.userLocationBinding.findMany).not.toHaveBeenCalled()
    expect(prisma.location.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientCompanyId: 'client-company',
        }),
      }),
    )
    expect(prisma.location.findMany.mock.calls[0][0].where).not.toHaveProperty('id')
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
    prisma.company.findUnique.mockResolvedValue({ type: CompanyType.PROVIDER })
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
})
