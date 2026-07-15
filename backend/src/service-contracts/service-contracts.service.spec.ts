import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ServiceContractRole, ServiceContractStatus } from '@prisma/client'

import { ServiceContractsService } from './service-contracts.service'

const PROVIDER_ID = 'provider-1'
const CLIENT_ID = 'client-1'

function makeContract(overrides: any = {}) {
  return {
    id: 'sc-1',
    status: ServiceContractStatus.ACTIVE,
    role: ServiceContractRole.PRIMARY,
    clientCompanyId: CLIENT_ID,
    providerCompanyId: PROVIDER_ID,
    ...overrides,
  }
}

function makeService(prismaPartial: any = {}) {
  const prisma = {
    serviceContract: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    company: {
      findUnique: jest.fn().mockResolvedValue({ id: PROVIDER_ID }),
    },
    ...prismaPartial,
  } as any
  return { svc: new ServiceContractsService(prisma), prisma }
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
  })

  it('returns ACTIVE SECONDARY contract', async () => {
    const { svc, prisma } = makeService()
    prisma.serviceContract.findUnique.mockResolvedValue(makeContract({ role: ServiceContractRole.SECONDARY }))
    const result = await svc.getLinkedClientAccess(PROVIDER_ID, CLIENT_ID)
    expect(result?.role).toBe(ServiceContractRole.SECONDARY)
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

  it('returns null when providerCompanyId is empty string', async () => {
    const { svc, prisma } = makeService()
    const result = await svc.getLinkedClientAccess('', CLIENT_ID)
    expect(result).toBeNull()
    expect(prisma.serviceContract.findUnique).not.toHaveBeenCalled()
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
