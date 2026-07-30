import { BadRequestException } from '@nestjs/common'
import { ServiceContractRole, ServiceContractStatus, UserRole } from '@prisma/client'

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
})
