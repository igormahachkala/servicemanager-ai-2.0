import { CompanyType, UserRole } from '@prisma/client'

import { AuthService } from '../auth/auth.service'
import { CompanyService } from '../company/company.service'
import { STANDARD_FAILURE_CAUSE_NAMES } from './standard-failure-causes'

type CauseRow = { companyId: string; name: string }

function makeCreationPrisma() {
  const companies = new Map<string, { id: string; name: string; type: CompanyType; timezone: string }>()
  const causes: CauseRow[] = []
  let companySequence = 0

  const prisma = {
    company: {
      create: jest.fn(async ({ data }: any) => {
        const company = {
          id: `company-${++companySequence}`,
          name: data.name,
          type: data.type,
          timezone: data.timezone ?? 'UTC',
          brandName: data.brandName ?? null,
          legalName: data.legalName ?? null,
          users: [],
        }
        companies.set(company.id, company)
        return company
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const company = companies.get(where.id)
        return company ? { id: company.id, type: company.type } : null
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        return [...companies.values()].find((company) => company.name === where.name) ?? null
      }),
    },
    user: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async ({ data }: any) => ({
        id: 'user-1',
        email: data.email,
        firstName: null,
        lastName: null,
        avatarUrl: null,
        role: data.role,
        companyId: data.company.connect.id,
        isActive: data.isActive,
      })),
    },
    failureCause: {
      count: jest.fn(async ({ where }: any) => causes.filter((row) => row.companyId === where.companyId).length),
      createMany: jest.fn(async ({ data, skipDuplicates }: any) => {
        let count = 0
        for (const row of data as CauseRow[]) {
          const duplicate = causes.some(
            (existing) => existing.companyId === row.companyId && existing.name === row.name,
          )
          if (duplicate && skipDuplicates) continue
          if (duplicate) throw new Error('unique [companyId, name] violation')
          causes.push({ ...row })
          count++
        }
        return { count }
      }),
    },
  }

  return { prisma, causes }
}

describe('failure-cause default dictionary — behavioral company creation wiring', () => {
  it('createPlatformCompany creates a CLIENT with the 12 company-owned defaults', async () => {
    const { prisma, causes } = makeCreationPrisma()
    const service = new CompanyService(prisma as any, {} as any)

    const company = await service.createPlatformCompany({
      name: 'Client A',
      type: CompanyType.CLIENT,
      timezone: 'Asia/Yekaterinburg',
    })

    expect(company).toEqual(
      expect.objectContaining({
        id: 'company-1',
        name: 'Client A',
        type: CompanyType.CLIENT,
        timezone: 'Asia/Yekaterinburg',
      }),
    )
    expect(causes).toHaveLength(12)
    expect(causes.every((row) => row.companyId === company.id)).toBe(true)
    expect(causes.map((row) => row.name)).toEqual(STANDARD_FAILURE_CAUSE_NAMES)
    expect(prisma.failureCause.createMany).toHaveBeenCalledTimes(1)
  })

  it('createPlatformCompany keeps PROVIDER creation behavior and does not bootstrap defaults', async () => {
    const { prisma, causes } = makeCreationPrisma()
    const service = new CompanyService(prisma as any, {} as any)

    const company = await service.createPlatformCompany({
      name: 'Provider A',
      type: CompanyType.PROVIDER,
    })

    expect(company).toEqual(
      expect.objectContaining({
        name: 'Provider A',
        type: CompanyType.PROVIDER,
      }),
    )
    expect(causes).toEqual([])
    expect(prisma.failureCause.createMany).not.toHaveBeenCalled()
  })

  it('self-registration creates its CLIENT admin and bootstraps the same 12 defaults', async () => {
    const previousNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'test'
    try {
      const { prisma, causes } = makeCreationPrisma()
      const jwt = { sign: jest.fn(() => 'signed-token') }
      const service = new AuthService(prisma as any, jwt as any, {} as any, {} as any)

      const result = await service.register({
        companyName: 'Self Registered Client',
        email: 'owner@example.test',
        password: 'valid-test-password',
      })

      expect(result.access_token).toBe('signed-token')
      expect(result.user).toEqual(
        expect.objectContaining({
          email: 'owner@example.test',
          role: UserRole.ADMIN,
          companyId: 'company-1',
          companyName: 'Self Registered Client',
        }),
      )
      expect(prisma.user.create).toHaveBeenCalledTimes(1)
      expect(causes).toHaveLength(12)
      expect(causes.every((row) => row.companyId === 'company-1')).toBe(true)
      expect(causes.map((row) => row.name)).toEqual(STANDARD_FAILURE_CAUSE_NAMES)
      expect(prisma.failureCause.createMany).toHaveBeenCalledTimes(1)
    } finally {
      process.env.NODE_ENV = previousNodeEnv
    }
  })
})
