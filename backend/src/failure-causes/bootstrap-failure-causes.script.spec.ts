import { CompanyType } from '@prisma/client'

import { runFailureCauseBackfill } from '../../scripts/bootstrap-failure-causes'
import { STANDARD_FAILURE_CAUSE_NAMES } from './standard-failure-causes'

type CompanyRow = {
  id: string
  name: string
  type: CompanyType
  createdAt: Date
}
type CauseRow = { companyId: string; name: string }

function makeBackfillPrisma(seed: { companies: CompanyRow[]; causes: CauseRow[] }) {
  const companies = [...seed.companies]
  const causes = seed.causes.map((row) => ({ ...row }))
  let createManyCalls = 0

  const prisma = {
    company: {
      findMany: jest.fn(async ({ where }: any) =>
        companies
          .filter((company) => company.type === where.type)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map(({ id, name }) => ({ id, name })),
      ),
      findUnique: jest.fn(async ({ where }: any) => {
        const company = companies.find((row) => row.id === where.id)
        return company ? { id: company.id, type: company.type } : null
      }),
    },
    failureCause: {
      findMany: jest.fn(async ({ where }: any) =>
        causes.filter((row) => row.companyId === where.companyId).map(({ name }) => ({ name })),
      ),
      count: jest.fn(async ({ where }: any) => causes.filter((row) => row.companyId === where.companyId).length),
      createMany: jest.fn(async ({ data, skipDuplicates }: any) => {
        createManyCalls++
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

  return {
    prisma: prisma as any,
    causes,
    createManyCalls: () => createManyCalls,
    namesFor: (companyId: string) => causes.filter((row) => row.companyId === companyId).map((row) => row.name),
  }
}

const createdAt = (day: number) => new Date(`2026-01-${String(day).padStart(2, '0')}T00:00:00.000Z`)

function classifiedSeed() {
  return {
    companies: [
      {
        id: 'empty',
        name: 'Empty Client',
        type: CompanyType.CLIENT,
        createdAt: createdAt(1),
      },
      {
        id: 'partial',
        name: 'Partial Client',
        type: CompanyType.CLIENT,
        createdAt: createdAt(2),
      },
      {
        id: 'full',
        name: 'Full Client',
        type: CompanyType.CLIENT,
        createdAt: createdAt(3),
      },
      {
        id: 'custom',
        name: 'Custom Client',
        type: CompanyType.CLIENT,
        createdAt: createdAt(4),
      },
      {
        id: 'provider',
        name: 'Provider',
        type: CompanyType.PROVIDER,
        createdAt: createdAt(5),
      },
    ],
    causes: [
      { companyId: 'partial', name: STANDARD_FAILURE_CAUSE_NAMES[0] },
      ...STANDARD_FAILURE_CAUSE_NAMES.map((name) => ({
        companyId: 'full',
        name,
      })),
      { companyId: 'custom', name: 'Custom cause' },
    ],
  }
}

describe('bootstrap-failure-causes script', () => {
  it('dry-run classifies CLIENT dictionaries and performs zero mutations', async () => {
    const fake = makeBackfillPrisma(classifiedSeed())
    const before = fake.causes.map((row) => ({ ...row }))

    const report = await runFailureCauseBackfill(fake.prisma, {
      log: () => undefined,
    })

    expect(report).toEqual({
      mode: 'dry-run',
      clientsTotal: 4,
      counts: {
        empty: 1,
        'partial-standard': 1,
        'full-standard': 1,
        'has-custom': 1,
      },
      eligibleCompanyIds: ['empty'],
      seededCompanies: 0,
    })
    expect(fake.causes).toEqual(before)
    expect(fake.createManyCalls()).toBe(0)
    expect(fake.prisma.failureCause.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'provider' } }),
    )
  })

  it('--apply seeds only an empty CLIENT, preserves all other dictionaries, and is idempotent', async () => {
    const fake = makeBackfillPrisma(classifiedSeed())
    const partialBefore = fake.namesFor('partial')
    const fullBefore = fake.namesFor('full')
    const customBefore = fake.namesFor('custom')

    const first = await runFailureCauseBackfill(fake.prisma, {
      apply: true,
      log: () => undefined,
    })

    expect(first.eligibleCompanyIds).toEqual(['empty'])
    expect(first.seededCompanies).toBe(1)
    expect(fake.namesFor('empty')).toEqual(STANDARD_FAILURE_CAUSE_NAMES)
    expect(fake.namesFor('partial')).toEqual(partialBefore)
    expect(fake.namesFor('full')).toEqual(fullBefore)
    expect(fake.namesFor('custom')).toEqual(customBefore)
    expect(fake.namesFor('provider')).toEqual([])

    const second = await runFailureCauseBackfill(fake.prisma, {
      apply: true,
      log: () => undefined,
    })

    expect(second.seededCompanies).toBe(0)
    expect(second.counts).toEqual({
      empty: 0,
      'partial-standard': 1,
      'full-standard': 2,
      'has-custom': 1,
    })
    expect(fake.namesFor('empty')).toEqual(STANDARD_FAILURE_CAUSE_NAMES)
    expect(fake.createManyCalls()).toBe(1)
  })
})
