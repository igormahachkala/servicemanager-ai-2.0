import { BadRequestException, NotFoundException } from '@nestjs/common'
import { CompanyType, ServiceContractLocationMode, ServiceContractRole, ServiceContractStatus } from '@prisma/client'

import { ServiceContractsService } from './service-contracts.service'

const PROVIDER_ID = 'provider-1'
const CLIENT_ID = 'client-1'

function makeContract(overrides: any = {}) {
  return {
    id: 'sc-1',
    status: ServiceContractStatus.ACTIVE,
    role: ServiceContractRole.PRIMARY,
    locationMode: ServiceContractLocationMode.ALL_LOCATIONS,
    clientCompanyId: CLIENT_ID,
    providerCompanyId: PROVIDER_ID,
    startsAt: null,
    endsAt: null,
    locations: [],
    ...overrides,
  }
}

function makeService(prismaPartial: any = {}) {
  const tx = {
    serviceContract: {
      create: jest.fn(),
      update: jest.fn(),
    },
    domainEvent: {
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
    },
  }
  const prisma = {
    serviceContract: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      create: jest.fn(),
    },
    company: {
      findUnique: jest.fn().mockResolvedValue({ id: PROVIDER_ID }),
      findMany: jest.fn().mockResolvedValue([
        { id: CLIENT_ID, name: 'Client', type: CompanyType.CLIENT },
        { id: PROVIDER_ID, name: 'Provider', type: CompanyType.PROVIDER },
      ]),
    },
    location: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    ticket: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    domainEvent: {
      create: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn(tx)),
    ...prismaPartial,
  } as any
  return { svc: new ServiceContractsService(prisma), prisma, tx }
}

// ── getLinkedClientAccess ─────────────────────────────────────────────────────

describe('ServiceContractsService.getLinkedClientAccess', () => {
  it('returns synthetic PRIMARY when providerCompanyId === clientCompanyId', async () => {
    const { svc } = makeService()
    const result = await svc.getLinkedClientAccess(PROVIDER_ID, PROVIDER_ID)
    expect(result?.role).toBe(ServiceContractRole.PRIMARY)
    expect(result?.status).toBe(ServiceContractStatus.ACTIVE)
  })

  it('returns ACTIVE PRIMARY contract', async () => {
    const { svc, prisma } = makeService()
    prisma.serviceContract.findUnique.mockResolvedValue(makeContract())
    const result = await svc.getLinkedClientAccess(PROVIDER_ID, CLIENT_ID)
    expect(result?.role).toBe(ServiceContractRole.PRIMARY)
    expect(result?.effectiveLocationScope).toEqual({ mode: 'tenant_wide', locationIds: [] })
  })

  it('returns ACTIVE SECONDARY contract', async () => {
    const { svc, prisma } = makeService()
    prisma.serviceContract.findUnique.mockResolvedValue(makeContract({ role: ServiceContractRole.SECONDARY }))
    const result = await svc.getLinkedClientAccess(PROVIDER_ID, CLIENT_ID)
    expect(result?.role).toBe(ServiceContractRole.SECONDARY)
  })

  it('returns selected contract locations as the effective scope', async () => {
    const { svc, prisma } = makeService()
    prisma.serviceContract.findUnique.mockResolvedValue(
      makeContract({
        locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
        locations: [{ locationId: 'loc-1' }, { locationId: 'loc-2' }],
      }),
    )

    const result = await svc.getLinkedClientAccess(PROVIDER_ID, CLIENT_ID)

    expect(result?.effectiveLocationScope).toEqual({
      mode: 'bound_locations',
      locationIds: ['loc-1', 'loc-2'],
    })
    expect(result?.locations).toEqual([{ locationId: 'loc-1' }, { locationId: 'loc-2' }])
  })

  it('fail-closes selected contract scope with an empty object list', async () => {
    const { svc, prisma } = makeService()
    prisma.serviceContract.findUnique.mockResolvedValue(
      makeContract({
        locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
        locations: [],
      }),
    )

    const result = await svc.getLinkedClientAccess(PROVIDER_ID, CLIENT_ID)

    expect(result?.effectiveLocationScope).toEqual({ mode: 'restricted_empty', locationIds: [] })
    expect(result?.locations).toEqual([])
  })

  it('resolves SECONDARY inherited objects from active PRIMARY contracts', async () => {
    const { svc, prisma } = makeService()
    prisma.serviceContract.findUnique.mockResolvedValue(
      makeContract({
        id: 'secondary-contract',
        role: ServiceContractRole.SECONDARY,
        locationMode: ServiceContractLocationMode.INHERIT_PRIMARY,
      }),
    )
    prisma.serviceContract.findMany.mockResolvedValue([
      makeContract({
        id: 'primary-contract',
        locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
        locations: [{ locationId: 'loc-primary' }, { locationId: 'loc-primary' }],
      }),
    ])

    const result = await svc.getLinkedClientAccess(PROVIDER_ID, CLIENT_ID)

    expect(result?.effectiveLocationScope).toEqual({
      mode: 'bound_locations',
      locationIds: ['loc-primary'],
    })
    expect(result?.locations).toEqual([{ locationId: 'loc-primary' }])
  })

  it('fail-closes inherited SECONDARY scope when no PRIMARY source exists', async () => {
    const { svc, prisma } = makeService()
    prisma.serviceContract.findUnique.mockResolvedValue(
      makeContract({
        id: 'secondary-contract',
        role: ServiceContractRole.SECONDARY,
        locationMode: ServiceContractLocationMode.INHERIT_PRIMARY,
      }),
    )
    prisma.serviceContract.findMany.mockResolvedValue([])

    const result = await svc.getLinkedClientAccess(PROVIDER_ID, CLIENT_ID)

    expect(result?.effectiveLocationScope).toEqual({ mode: 'restricted_empty', locationIds: [] })
  })

  it('returns null when no contract exists', async () => {
    const { svc } = makeService()
    const result = await svc.getLinkedClientAccess(PROVIDER_ID, CLIENT_ID)
    expect(result).toBeNull()
  })

  it('returns null for INACTIVE contract', async () => {
    const { svc, prisma } = makeService()
    prisma.serviceContract.findUnique.mockResolvedValue(
      makeContract({ status: ServiceContractStatus.INACTIVE }),
    )
    const result = await svc.getLinkedClientAccess(PROVIDER_ID, CLIENT_ID)
    expect(result).toBeNull()
  })

  it('returns null before the contract start date', async () => {
    const { svc, prisma } = makeService()
    prisma.serviceContract.findUnique.mockResolvedValue(
      makeContract({ startsAt: new Date(Date.now() + 60_000) }),
    )

    await expect(svc.getLinkedClientAccess(PROVIDER_ID, CLIENT_ID)).resolves.toBeNull()
  })

  it('returns null after the contract end date', async () => {
    const { svc, prisma } = makeService()
    prisma.serviceContract.findUnique.mockResolvedValue(
      makeContract({ endsAt: new Date(Date.now() - 60_000) }),
    )

    await expect(svc.getLinkedClientAccess(PROVIDER_ID, CLIENT_ID)).resolves.toBeNull()
  })

  it('returns null when providerCompanyId is empty string', async () => {
    const { svc, prisma } = makeService()
    const result = await svc.getLinkedClientAccess('', CLIENT_ID)
    expect(result).toBeNull()
    expect(prisma.serviceContract.findUnique).not.toHaveBeenCalled()
  })
})

describe('ServiceContractsService.update', () => {
  it('validates a partial date update against the stored opposite boundary', async () => {
    const { svc, prisma } = makeService()
    prisma.serviceContract.findUnique.mockResolvedValue({
      startsAt: new Date('2026-08-10T00:00:00.000Z'),
      endsAt: new Date('2026-08-20T00:00:00.000Z'),
    })

    await expect(
      svc.update('sc-1', { endsAt: '2026-08-01T00:00:00.000Z' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.serviceContract.update).not.toHaveBeenCalled()
  })

  it('rejects contract objects that do not belong to its client', async () => {
    const { svc, prisma } = makeService()
    prisma.serviceContract.findUnique.mockResolvedValue({
      startsAt: null,
      endsAt: null,
      clientCompanyId: CLIENT_ID,
    })

    await expect(svc.update('sc-1', { locationIds: ['00000000-0000-4000-8000-000000000001'] }))
      .rejects.toBeInstanceOf(BadRequestException)
    expect(prisma.serviceContract.update).not.toHaveBeenCalled()
  })

  it('does not turn explicit SELECTED_LOCATIONS with an empty list into ALL_LOCATIONS', async () => {
    const { svc, prisma, tx } = makeService()
    prisma.serviceContract.findUnique
      .mockResolvedValueOnce(makeContract({
        locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
        locations: [{ locationId: 'loc-old' }],
      }))
      .mockResolvedValueOnce({
        ...makeContract({
          locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
          locations: [],
          clientCompany: { id: CLIENT_ID, name: 'Client', type: CompanyType.CLIENT, publicRequestEnabled: false },
          providerCompany: { id: PROVIDER_ID, name: 'Provider', type: CompanyType.PROVIDER, publicRequestEnabled: false },
        }),
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        updatedAt: new Date('2026-08-01T00:00:00.000Z'),
      })
    tx.serviceContract.update.mockResolvedValue({ id: 'sc-1' })

    await svc.update('sc-1', {
      locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
      locationIds: [],
    }, 'platform-admin-1')

    expect(tx.serviceContract.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          locations: {
            deleteMany: {},
            create: [],
          },
        }),
      }),
    )
    expect(tx.domainEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'service_contract.updated',
          actorUserId: 'platform-admin-1',
          payload: expect.objectContaining({
            after: expect.objectContaining({
              locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
              locationIds: [],
            }),
          }),
        }),
      }),
    )
  })

  it('rejects INHERIT_PRIMARY for PRIMARY contracts', async () => {
    const { svc, prisma } = makeService()
    prisma.serviceContract.findUnique.mockResolvedValue(makeContract())

    await expect(svc.update('sc-1', {
      locationMode: ServiceContractLocationMode.INHERIT_PRIMARY,
    })).rejects.toBeInstanceOf(BadRequestException)
  })
})

// ── listSecondaryLinkedClientIds ──────────────────────────────────────────────

describe('ServiceContractsService.listSecondaryLinkedClientIds', () => {
  it('returns client IDs from SECONDARY contracts', async () => {
    const { svc, prisma } = makeService()
    prisma.serviceContract.findMany.mockResolvedValue([
      { clientCompanyId: CLIENT_ID },
      { clientCompanyId: 'client-2' },
    ])
    const result = await svc.listSecondaryLinkedClientIds(PROVIDER_ID)
    expect(result).toEqual([CLIENT_ID, 'client-2'])
  })

  it('skips DB call and returns [] when providerCompanyId is blank', async () => {
    const { svc, prisma } = makeService()
    const result = await svc.listSecondaryLinkedClientIds('   ')
    expect(result).toEqual([])
    expect(prisma.serviceContract.findMany).not.toHaveBeenCalled()
  })

  it('returns [] when no SECONDARY contracts exist', async () => {
    const { svc } = makeService()
    const result = await svc.listSecondaryLinkedClientIds(PROVIDER_ID)
    expect(result).toEqual([])
  })

  it('queries with correct role and status filters', async () => {
    const { svc, prisma } = makeService()
    await svc.listSecondaryLinkedClientIds(PROVIDER_ID)
    expect(prisma.serviceContract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: ServiceContractRole.SECONDARY,
          status: ServiceContractStatus.ACTIVE,
        }),
      }),
    )
  })
})

// ── listSecondaryProviderCompanyIds ───────────────────────────────────────────

describe('ServiceContractsService.listSecondaryProviderCompanyIds', () => {
  it('returns provider IDs from SECONDARY contracts', async () => {
    const { svc, prisma } = makeService()
    prisma.serviceContract.findMany.mockResolvedValue([
      { providerCompanyId: PROVIDER_ID },
      { providerCompanyId: 'provider-2' },
    ])
    const result = await svc.listSecondaryProviderCompanyIds(CLIENT_ID)
    expect(result).toEqual([PROVIDER_ID, 'provider-2'])
  })

  it('skips DB call and returns [] when clientCompanyId is blank', async () => {
    const { svc, prisma } = makeService()
    const result = await svc.listSecondaryProviderCompanyIds('')
    expect(result).toEqual([])
    expect(prisma.serviceContract.findMany).not.toHaveBeenCalled()
  })
})

// ── assertPrimaryLinkedClientAccess ──────────────────────────────────────────

describe('ServiceContractsService.assertPrimaryLinkedClientAccess', () => {
  it('returns access for PRIMARY contract', async () => {
    const { svc, prisma } = makeService()
    prisma.serviceContract.findUnique.mockResolvedValue(makeContract())
    const result = await svc.assertPrimaryLinkedClientAccess(PROVIDER_ID, CLIENT_ID)
    expect(result.role).toBe(ServiceContractRole.PRIMARY)
  })

  it('throws BadRequestException for SECONDARY contract', async () => {
    const { svc, prisma } = makeService()
    prisma.serviceContract.findUnique.mockResolvedValue(makeContract({ role: ServiceContractRole.SECONDARY }))
    await expect(svc.assertPrimaryLinkedClientAccess(PROVIDER_ID, CLIENT_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('throws NotFoundException when no contract exists', async () => {
    const { svc } = makeService()
    await expect(svc.assertPrimaryLinkedClientAccess(PROVIDER_ID, CLIENT_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })
})
