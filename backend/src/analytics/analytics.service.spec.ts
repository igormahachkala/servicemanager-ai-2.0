import { BadRequestException } from '@nestjs/common'
import { ServiceContractRole, ServiceContractStatus, UserAccessLocationMode, UserRole } from '@prisma/client'

import { AnalyticsService } from './analytics.service'

describe('AnalyticsService provider linked-client scope', () => {
  function makeService(access: any) {
    const prisma = {
      company: {
        findUnique: jest.fn(),
      },
    }
    const timeline = {}
    const contracts = {
      getLinkedClientAccess: jest.fn().mockResolvedValue(access),
    }
    return {
      service: new AnalyticsService(prisma as any, timeline as any, contracts as any),
      contracts,
    }
  }

  it('allows PRIMARY linked-client analytics scope', async () => {
    const { service } = makeService({
      status: ServiceContractStatus.ACTIVE,
      role: ServiceContractRole.PRIMARY,
    })

    await expect((service as any).resolveScope(
      'provider-company',
      UserRole.ADMIN,
      undefined,
      'client-company',
    )).resolves.toEqual({
      scopeCompanyId: 'client-company',
      visibilityMode: 'provider_primary',
    })
  })

  it('allows SECONDARY linked-client analytics scope without tenant-wide fallback', async () => {
    const { service } = makeService({
      status: ServiceContractStatus.ACTIVE,
      role: ServiceContractRole.SECONDARY,
    })

    await expect((service as any).resolveScope(
      'provider-company',
      UserRole.MASTER,
      undefined,
      'client-company',
    )).resolves.toEqual({
      scopeCompanyId: 'client-company',
      visibilityMode: 'provider_secondary',
    })
  })

  it('rejects linked-client analytics when no active contract exists', async () => {
    const { service } = makeService(null)

    await expect((service as any).resolveScope(
      'provider-company',
      UserRole.ADMIN,
      undefined,
      'client-company',
    )).rejects.toBeInstanceOf(BadRequestException)
  })

  it('fail-closes location analytics for provider ADMIN with SELECTED_LOCATIONS and no bindings', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'admin-1' }),
      },
      userAccessScope: {
        findUnique: jest.fn().mockResolvedValue({
          locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
        }),
      },
      userLocationBinding: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      location: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      problemCategory: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      ticket: {
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    }
    const contracts = {
      getLinkedClientAccess: jest.fn().mockResolvedValue({
        status: ServiceContractStatus.ACTIVE,
        role: ServiceContractRole.PRIMARY,
      }),
    }
    const service = new AnalyticsService(prisma as any, {} as any, contracts as any)

    const result = await service.getLocationsAnalytics(
      'provider-company',
      'admin-1',
      UserRole.ADMIN,
      { linkedClientCompanyId: 'client-company', locationId: 'loc-forbidden' },
    )

    expect(result.summary.totalTickets).toBe(0)
    expect(prisma.location.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ id: { equals: '__no_access__' } }),
          ]),
        }),
      }),
    )
    expect(JSON.stringify(prisma.ticket.groupBy.mock.calls[0][0].where)).toContain('__no_access__')
    expect(JSON.stringify(prisma.ticket.groupBy.mock.calls[0][0].where)).toContain('loc-forbidden')
  })
})
