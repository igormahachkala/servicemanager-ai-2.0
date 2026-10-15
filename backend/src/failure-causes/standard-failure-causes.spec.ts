import { CompanyType } from '@prisma/client'

import { STANDARD_FAILURE_CAUSE_NAMES, ensureDefaultFailureCauses } from './standard-failure-causes'

interface Row {
  companyId: string
  name: string
  active: boolean
}

/**
 * In-memory Prisma-двойник, который соблюдает @@unique([companyId, name]) —
 * так тесты ловят реальные дубли/изоляцию арендаторов, а не только вызовы.
 */
function makeFakePrisma(seed: { companies: { id: string; type: CompanyType }[]; causes?: Row[] }) {
  const companies = new Map(seed.companies.map((c) => [c.id, c]))
  const rows: Row[] = [...(seed.causes ?? [])]

  const prisma = {
    company: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const c = companies.get(where.id)
        return c ? { id: c.id, type: c.type } : null
      },
    },
    failureCause: {
      count: async ({ where }: { where: { companyId: string } }) =>
        rows.filter((r) => r.companyId === where.companyId).length,
      createMany: async ({
        data,
        skipDuplicates,
      }: {
        data: { companyId: string; name: string }[]
        skipDuplicates?: boolean
      }) => {
        let count = 0
        for (const d of data) {
          const dup = rows.some((r) => r.companyId === d.companyId && r.name === d.name)
          if (dup) {
            if (skipDuplicates) continue
            throw new Error('unique [companyId, name] violation')
          }
          rows.push({ companyId: d.companyId, name: d.name, active: true })
          count++
        }
        return { count }
      },
    },
  }
  const countFor = (companyId: string) => rows.filter((r) => r.companyId === companyId).length
  return { prisma: prisma as any, rows, countFor }
}

describe('ensureDefaultFailureCauses (standard dictionary bootstrap)', () => {
  it('seeds exactly the 12 standard causes into an empty CLIENT company', async () => {
    const { prisma, countFor, rows } = makeFakePrisma({
      companies: [{ id: 'client-a', type: CompanyType.CLIENT }],
    })

    const res = await ensureDefaultFailureCauses(prisma, 'client-a')

    expect(res).toEqual({ companyId: 'client-a', created: 12, skipped: null })
    expect(countFor('client-a')).toBe(12)
    expect(rows.map((r) => r.name).sort()).toEqual([...STANDARD_FAILURE_CAUSE_NAMES].sort())
    expect(rows.every((r) => r.active)).toBe(true)
  })

  it('is idempotent: a second bootstrap keeps exactly 12 with no duplicates', async () => {
    const { prisma, countFor } = makeFakePrisma({
      companies: [{ id: 'client-a', type: CompanyType.CLIENT }],
    })

    await ensureDefaultFailureCauses(prisma, 'client-a')
    const second = await ensureDefaultFailureCauses(prisma, 'client-a')

    expect(second).toEqual({
      companyId: 'client-a',
      created: 0,
      skipped: 'already-has-causes',
    })
    expect(countFor('client-a')).toBe(12)
  })

  it('is race-safe: two concurrent bootstraps create 12 unique rows for only the requested company', async () => {
    const rows: Row[] = [{ companyId: 'client-b', name: 'Client B custom cause', active: true }]
    let countCalls = 0
    let releaseCounts!: () => void
    const bothCountsStarted = new Promise<void>((resolve) => {
      releaseCounts = resolve
    })

    const prisma = {
      company: {
        findUnique: async ({ where }: { where: { id: string } }) => ({
          id: where.id,
          type: CompanyType.CLIENT,
        }),
      },
      failureCause: {
        count: async () => {
          countCalls++
          if (countCalls === 2) releaseCounts()
          await bothCountsStarted
          return 0
        },
        createMany: async ({
          data,
          skipDuplicates,
        }: {
          data: { companyId: string; name: string }[]
          skipDuplicates?: boolean
        }) => {
          let count = 0
          for (const row of data) {
            const duplicate = rows.some(
              (existing) => existing.companyId === row.companyId && existing.name === row.name,
            )
            if (duplicate && skipDuplicates) continue
            if (duplicate) throw new Error('unique [companyId, name] violation')
            rows.push({ ...row, active: true })
            count++
          }
          return { count }
        },
      },
    }

    const results = await Promise.all([
      ensureDefaultFailureCauses(prisma, 'client-a'),
      ensureDefaultFailureCauses(prisma, 'client-a'),
    ])

    const clientARows = rows.filter((row) => row.companyId === 'client-a')
    expect(results.map((result) => result.created).sort((a, b) => a - b)).toEqual([0, 12])
    expect(clientARows).toHaveLength(12)
    expect(new Set(clientARows.map((row) => row.name))).toEqual(new Set(STANDARD_FAILURE_CAUSE_NAMES))
    expect(rows.filter((row) => row.companyId === 'client-b')).toEqual([
      { companyId: 'client-b', name: 'Client B custom cause', active: true },
    ])
    expect(new Set(rows.map((row) => row.companyId))).toEqual(new Set(['client-a', 'client-b']))
  })

  it('partial existing dictionary: no duplicates, nothing re-created', async () => {
    const { prisma, countFor } = makeFakePrisma({
      companies: [{ id: 'client-a', type: CompanyType.CLIENT }],
      causes: [
        { companyId: 'client-a', name: 'Внешнее воздействие', active: true },
        {
          companyId: 'client-a',
          name: 'Перегрев / нарушение охлаждения',
          active: true,
        },
      ],
    })

    const res = await ensureDefaultFailureCauses(prisma, 'client-a')

    expect(res.created).toBe(0)
    expect(res.skipped).toBe('already-has-causes')
    expect(countFor('client-a')).toBe(2) // не плодим, не добиваем до 12
  })

  it('preserves a custom cause and does not add standard ones on top of it', async () => {
    const { prisma, rows, countFor } = makeFakePrisma({
      companies: [{ id: 'client-a', type: CompanyType.CLIENT }],
      causes: [
        {
          companyId: 'client-a',
          name: 'Корпоративная причина X',
          active: true,
        },
      ],
    })

    await ensureDefaultFailureCauses(prisma, 'client-a')

    expect(countFor('client-a')).toBe(1)
    expect(rows[0]).toEqual({
      companyId: 'client-a',
      name: 'Корпоративная причина X',
      active: true,
    })
  })

  it('does NOT reactivate / overwrite an edited or deactivated cause (no destructive sync)', async () => {
    const { prisma, rows } = makeFakePrisma({
      companies: [{ id: 'client-a', type: CompanyType.CLIENT }],
      // админ деактивировал стандартную причину
      causes: [{ companyId: 'client-a', name: 'Естественный износ', active: false }],
    })

    const res = await ensureDefaultFailureCauses(prisma, 'client-a')

    expect(res.skipped).toBe('already-has-causes')
    expect(rows.find((r) => r.name === 'Естественный износ')?.active).toBe(false)
  })

  it('isolates tenants: seeding CLIENT A leaves CLIENT B untouched', async () => {
    const { prisma, countFor } = makeFakePrisma({
      companies: [
        { id: 'client-a', type: CompanyType.CLIENT },
        { id: 'client-b', type: CompanyType.CLIENT },
      ],
    })

    await ensureDefaultFailureCauses(prisma, 'client-a')

    expect(countFor('client-a')).toBe(12)
    expect(countFor('client-b')).toBe(0) // B не наследует справочник A

    await ensureDefaultFailureCauses(prisma, 'client-b')
    expect(countFor('client-b')).toBe(12)
    expect(countFor('client-a')).toBe(12)
  })

  it('never gives a PROVIDER company a dictionary', async () => {
    const { prisma, countFor } = makeFakePrisma({
      companies: [{ id: 'provider-1', type: CompanyType.PROVIDER }],
    })

    const res = await ensureDefaultFailureCauses(prisma, 'provider-1')

    expect(res).toEqual({
      companyId: 'provider-1',
      created: 0,
      skipped: 'not-client',
    })
    expect(countFor('provider-1')).toBe(0)
  })

  it('skips a missing company safely', async () => {
    const { prisma } = makeFakePrisma({ companies: [] })

    const res = await ensureDefaultFailureCauses(prisma, 'ghost')

    expect(res).toEqual({
      companyId: 'ghost',
      created: 0,
      skipped: 'company-missing',
    })
  })

  it('declares exactly the 12 required standard names', () => {
    expect(STANDARD_FAILURE_CAUSE_NAMES).toHaveLength(12)
    expect(STANDARD_FAILURE_CAUSE_NAMES).toEqual([
      'Естественный износ',
      'Загрязнение / засор',
      'Механическое повреждение',
      'Неисправность электрики / электропитания',
      'Перегрев / нарушение охлаждения',
      'Утечка / разгерметизация',
      'Ослабление контакта / крепления / соединения',
      'Неправильная эксплуатация',
      'Нарушение настройки / регулировки',
      'Неисправность узла / компонента',
      'Внешнее воздействие',
      'Причина не установлена',
    ])
    expect(new Set(STANDARD_FAILURE_CAUSE_NAMES).size).toBe(12) // без повторов
  })
})
