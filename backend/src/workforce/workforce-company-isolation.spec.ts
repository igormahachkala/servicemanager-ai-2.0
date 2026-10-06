import { UserRole } from '@prisma/client'

import { WorkforceService } from './workforce.service'

const OWN = 'own-client-company'
const FOREIGN = 'foreign-company'

const COMPANIES: Record<string, { id: string; name: string; timezone: string; shiftAutoCloseTime: string }> = {
  [OWN]: { id: OWN, name: 'Своя клиентская компания', timezone: 'Europe/Moscow', shiftAutoCloseTime: '23:59' },
  [FOREIGN]: { id: FOREIGN, name: 'Чужая компания', timezone: 'Europe/Moscow', shiftAutoCloseTime: '23:59' },
}

function shiftRow(companyId: string, userId: string, lastName: string) {
  const openedAt = new Date('2026-09-17T08:00:00.000Z')
  return {
    id: `shift-${userId}`,
    companyId,
    userId,
    openedAt,
    closedAt: new Date('2026-09-17T17:00:00.000Z'),
    status: 'CLOSED',
    user: { id: userId, firstName: 'Иван', lastName, email: `${userId}@example.com`, role: UserRole.TECHNICIAN },
    corrections: [],
    workLogs: [],
  }
}

const SHIFTS: Record<string, ReturnType<typeof shiftRow>[]> = {
  [OWN]: [shiftRow(OWN, 'user-own', 'Свой')],
  [FOREIGN]: [shiftRow(FOREIGN, 'user-foreign', 'Чужой')],
}

type RecordedQuery = { model: string; where: Record<string, unknown> }

function makeSuite() {
  const queries: RecordedQuery[] = []

  const prisma = {
    company: {
      findUnique: jest.fn(async ({ where }: any) => {
        queries.push({ model: 'company.findUnique', where })
        return COMPANIES[where.id] ?? null
      }),
    },
    workShift: {
      findMany: jest.fn(async ({ where }: any) => {
        queries.push({ model: 'workShift.findMany', where })
        return SHIFTS[where.companyId] ?? []
      }),
    },
  } as any

  const svc = new WorkforceService(prisma, {} as any)

  return { svc, prisma, queries }
}

function companiesTouched(queries: RecordedQuery[]): string[] {
  const seen = new Set<string>()
  for (const query of queries) {
    for (const value of Object.values(query.where)) {
      if (typeof value === 'string' && (value === OWN || value === FOREIGN)) seen.add(value)
    }
  }
  return [...seen].sort()
}

const actor = (role: UserRole, companyId: string) => ({ id: 'actor-1', role, companyId } as any)

describe('Workforce company isolation for read parity', () => {
  it('keeps CLIENT_ADMIN inside own company when observerCompanyId points elsewhere', async () => {
    const { svc, queries } = makeSuite()

    const result: any = await svc.listWorkforce({
      actor: actor(UserRole.CLIENT_ADMIN, OWN),
      observerCompanyId: FOREIGN,
    })

    expect(result.company.id).toBe(OWN)
    expect(result.company.name).toBe('Своя клиентская компания')
    expect(result.employees.map((row: any) => row.user.id)).toEqual(['user-own'])
    expect(result.shifts.map((row: any) => row.companyId)).toEqual([OWN])
    expect(companiesTouched(queries)).toEqual([OWN])
    expect(JSON.stringify(queries)).not.toContain(FOREIGN)
    expect(JSON.stringify(result)).not.toContain(FOREIGN)
    expect(JSON.stringify(result)).not.toContain('Чужой')
  })

  it('keeps CLIENT_ADMIN inside own company without observerCompanyId', async () => {
    const { svc, queries } = makeSuite()

    const result: any = await svc.listWorkforce({ actor: actor(UserRole.CLIENT_ADMIN, OWN) })

    expect(result.company.id).toBe(OWN)
    expect(result.employees).toHaveLength(1)
    expect(companiesTouched(queries)).toEqual([OWN])
  })

  it('keeps PLATFORM_ADMIN observer behavior unchanged', async () => {
    const { svc, queries } = makeSuite()

    const result: any = await svc.listWorkforce({
      actor: actor(UserRole.PLATFORM_ADMIN, OWN),
      observerCompanyId: FOREIGN,
    })

    expect(result.company.id).toBe(FOREIGN)
    expect(result.company.name).toBe('Чужая компания')
    expect(result.employees.map((row: any) => row.user.id)).toEqual(['user-foreign'])
    expect(companiesTouched(queries)).toEqual([FOREIGN])
  })

  it('does not let any non-platform role widen to a foreign company', async () => {
    const roles: UserRole[] = [
      UserRole.CLIENT_ADMIN,
      UserRole.CLIENT,
      UserRole.ADMIN,
      UserRole.MASTER,
      UserRole.DISPATCHER,
      UserRole.NETWORK_DIRECTOR,
      UserRole.TERRITORIAL_MANAGER,
      UserRole.TECHNICIAN,
      UserRole.STAFF,
    ]

    const seen: Array<{ role: UserRole; company: string; touched: string[] }> = []
    for (const role of roles) {
      const { svc, queries } = makeSuite()
      const result: any = await svc.listWorkforce({
        actor: actor(role, OWN),
        observerCompanyId: FOREIGN,
      })
      seen.push({ role, company: result.company.id, touched: companiesTouched(queries) })
    }

    expect(seen).toEqual(roles.map((role) => ({ role, company: OWN, touched: [OWN] })))
  })

  it('keeps userId filtering inside the actor company', async () => {
    const { svc, prisma } = makeSuite()

    await svc.listWorkforce({
      actor: actor(UserRole.CLIENT_ADMIN, OWN),
      observerCompanyId: FOREIGN,
      userId: 'user-foreign',
    })

    const where = prisma.workShift.findMany.mock.calls[0][0].where
    expect(where.companyId).toBe(OWN)
    expect(where.userId).toBe('user-foreign')
  })
})
