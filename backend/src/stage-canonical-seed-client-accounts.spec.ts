import { CompanyType, UserAccessLocationMode, UserRole } from '@prisma/client'

import { ROLE_GRANTS } from './common/permissions-matrix'
import {
  CANONICAL_STAGE_SEED,
  runCanonicalStageSeed,
  STAGE_QA_SEED_GUARD,
  validateCanonicalStageSeedPlan,
} from '../scripts/seed-stage-qa'

/**
 * SMA-STAGE-QA-CLIENT-ACCOUNTS-FOUNDATION-122S.
 *
 * На Stage не было учётных записей с ролями CLIENT и CLIENT_ADMIN: пробел
 * обнаружили подготовка приёмки уведомлений (122O) и аудит Workforce (122J).
 * Здесь проверяется не «добавлены ли строки в массив», а то, что повторный
 * прогон сида даёт ровно те же учётные записи и не трогает существующие.
 *
 * Права ролей эта проверка не касается намеренно: материализация RolePermission
 * идёт через PATCH /permissions/matrix и от появления пользователя не зависит.
 */

const CLIENT_USER_EMAIL = 'stage.client.client@stage.local'
const CLIENT_ADMIN_ROLE_EMAIL = 'stage.client.clientadmin@stage.local'

/** Прогон останавливается после сброса scope: остальная часть сида здесь не нужна. */
const HALT_AFTER_SCOPES = 'stage-qa-seed-halted-after-scopes'

const PRE_EXISTING_EMAILS = [
  'stage.client.admin@stage.local',
  'stage.network.director@stage.local',
  'stage.territorial.manager@stage.local',
  'stage.primary.admin@stage.local',
  'stage.primary.dispatcher@stage.local',
  'stage.primary.master@stage.local',
  'stage.primary.tech@stage.local',
  'stage.secondary.admin@stage.local',
  'stage.secondary.dispatcher@stage.local',
  'stage.secondary.master@stage.local',
  'stage.secondary.tech@stage.local',
  'stage.mobile.tech@stage.local',
]

function stageEnv(): NodeJS.ProcessEnv {
  return {
    [STAGE_QA_SEED_GUARD.confirmEnv]: STAGE_QA_SEED_GUARD.expectedConfirm,
    [STAGE_QA_SEED_GUARD.releaseEnv]: STAGE_QA_SEED_GUARD.expectedReleaseEnvironment,
    NODE_ENV: 'development',
    DATABASE_URL:
      'postgresql://stage_user:stage_password@stage_postgres:5432/sma_stage_db?schema=public',
    [STAGE_QA_SEED_GUARD.passwordEnv]: 'StagePassword_122S',
  }
}

type StoredUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  companyId: string
  isExecutor: boolean
}

type StoredLocationBinding = {
  userId: string
  companyId: string
  locationId: string
}

function deleteRowsByUserId<T extends { userId: string }>(rows: Map<string, T>, userIds: string[]) {
  const selected = new Set(userIds)
  for (const [key, row] of rows) {
    if (selected.has(row.userId)) rows.delete(key)
  }
}

/**
 * Хранилище в памяти, а не заглушки: идемпотентность нельзя доказать моками,
 * которые ничего не помнят. Пользователи, компании и scope-привязки живут
 * между прогонами, поэтому второй прогон видит результат первого — как база.
 */
function createSeedHarness() {
  const companies = new Map<string, { id: string; name: string; type: CompanyType }>()
  const users = new Map<string, StoredUser>()
  const permissionBlocks = new Map<string, string>()
  const locations = new Map<string, any>()
  const specializations = new Map<string, any>()
  const categories = new Map<string, any>()
  const contracts = new Map<string, any>()
  const contractLocations = new Map<string, any>()
  const contractSpecializations = new Map<string, any>()
  const userAccessScopes = new Map<string, any>()
  const userLocationBindings = new Map<string, StoredLocationBinding>()
  const technicianSpecializations = new Map<string, any>()
  const locationBindingCreateBatches: StoredLocationBinding[][] = []
  const counters = { userCreate: 0, userUpdate: 0, companyCreate: 0 }

  const prisma = {
    $queryRaw: async () => [{ database: STAGE_QA_SEED_GUARD.expectedDatabase }],
    $transaction: async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]),
    permissionBlock: {
      upsert: async ({ where }: any) => {
        if (!permissionBlocks.has(where.code)) {
          permissionBlocks.set(where.code, `pb-${permissionBlocks.size + 1}`)
        }
        return { code: where.code, id: permissionBlocks.get(where.code) }
      },
      findMany: async () =>
        [...permissionBlocks.entries()].map(([code, id]) => ({ id, code })),
      count: async () => permissionBlocks.size,
    },
    rolePermission: {
      deleteMany: async () => ({ count: 0 }),
      createMany: async () => ({ count: 0 }),
      count: async () => 0,
    },
    company: {
      findUnique: async ({ where }: any) => companies.get(where.id) ?? null,
      findFirst: async ({ where }: any) =>
        [...companies.values()].find((row) => row.name === where.name) ?? null,
      update: async ({ where, data }: any) => {
        const next = { ...companies.get(where.id)!, ...data }
        companies.set(where.id, next)
        return next
      },
      create: async ({ data }: any) => {
        counters.companyCreate += 1
        companies.set(data.id, { ...data })
        return { ...data }
      },
    },
    user: {
      findUnique: async ({ where }: any) => {
        if (where.email) {
          return [...users.values()].find((row) => row.email === where.email) ?? null
        }
        return users.get(where.id) ?? null
      },
      update: async ({ where, data }: any) => {
        counters.userUpdate += 1
        const next = { ...users.get(where.id)!, ...data }
        users.set(where.id, next)
        return next
      },
      create: async ({ data }: any) => {
        counters.userCreate += 1
        users.set(data.id, { ...data })
        return { ...data }
      },
    },
    location: {
      upsert: async ({ where, update, create }: any) => {
        const key = `${where.clientCompanyId_platformCode.clientCompanyId}|${where.clientCompanyId_platformCode.platformCode}`
        const previous = locations.get(key)
        const next = previous ? { ...previous, ...update } : { ...create }
        locations.set(key, next)
        return { id: next.id }
      },
    },
    specialization: {
      findFirst: async ({ where }: any) => {
        if (where.id) return specializations.get(where.id) ?? null
        return (
          [...specializations.values()].find(
            (row) => row.companyId === where.companyId && row.name === where.name,
          ) ?? null
        )
      },
      update: async ({ where, data }: any) => {
        const next = {
          ...specializations.get(where.id),
          ...data,
          id: where.id,
        }
        specializations.set(where.id, next)
        return { id: where.id }
      },
      create: async ({ data }: any) => {
        specializations.set(data.id, { ...data })
        return { id: data.id }
      },
    },
    problemCategory: {
      upsert: async ({ where, update, create }: any) => {
        const key = `${where.companyId_name.companyId}|${where.companyId_name.name}`
        const previous = categories.get(key)
        const next = previous ? { ...previous, ...update } : { ...create }
        categories.set(key, next)
        return { id: next.id }
      },
    },
    problemCategorySpecialization: {
      deleteMany: async ({ where }: any) => {
        for (const [key, row] of contractSpecializations) {
          if (row.problemCategoryId === where.problemCategoryId) contractSpecializations.delete(key)
        }
        return { count: 0 }
      },
      create: async ({ data }: any) => {
        contractSpecializations.set(`category|${data.problemCategoryId}|${data.specializationId}`, {
          ...data,
        })
        return { ...data }
      },
    },
    serviceContract: {
      upsert: async ({ where, update, create }: any) => {
        const relation = where.clientCompanyId_providerCompanyId
        const key = `${relation.clientCompanyId}|${relation.providerCompanyId}`
        const previous = contracts.get(key)
        const next = previous
          ? { ...previous, ...update }
          : { id: `contract-${contracts.size + 1}`, ...create }
        contracts.set(key, next)
        return { id: next.id }
      },
    },
    serviceContractLocation: {
      deleteMany: async ({ where }: any) => {
        const allowed = new Set(where.locationId.notIn)
        for (const [key, row] of contractLocations) {
          if (row.serviceContractId === where.serviceContractId && !allowed.has(row.locationId)) {
            contractLocations.delete(key)
          }
        }
        return { count: 0 }
      },
      createMany: async ({ data }: any) => {
        for (const row of data) {
          contractLocations.set(`${row.serviceContractId}|${row.locationId}`, {
            ...row,
          })
        }
        return { count: data.length }
      },
    },
    serviceContractSpecialization: {
      deleteMany: async ({ where }: any) => {
        const allowed = new Set(where.specializationId.notIn)
        for (const [key, row] of contractSpecializations) {
          if (
            row.serviceContractId === where.serviceContractId &&
            !allowed.has(row.specializationId)
          ) {
            contractSpecializations.delete(key)
          }
        }
        return { count: 0 }
      },
      createMany: async ({ data }: any) => {
        for (const row of data) {
          contractSpecializations.set(`${row.serviceContractId}|${row.specializationId}`, {
            ...row,
          })
        }
        return { count: data.length }
      },
    },
    userAccessScope: {
      deleteMany: async ({ where }: any) => {
        deleteRowsByUserId(userAccessScopes, where.userId.in)
        return { count: 0 }
      },
      createMany: async ({ data }: any) => {
        for (const row of data) userAccessScopes.set(row.userId, { ...row })
        return { count: data.length }
      },
    },
    userLocationBinding: {
      deleteMany: async ({ where }: any) => {
        deleteRowsByUserId(userLocationBindings, where.userId.in)
        return { count: 0 }
      },
      createMany: async ({ data }: { data: StoredLocationBinding[] }) => {
        locationBindingCreateBatches.push(data.map((row) => ({ ...row })))
        for (const row of data) {
          const key = `${row.userId}|${row.locationId}`
          if (!userLocationBindings.has(key)) userLocationBindings.set(key, { ...row })
        }
        return { count: data.length }
      },
    },
    technicianSpecialization: {
      deleteMany: async ({ where }: any) => {
        deleteRowsByUserId(technicianSpecializations, where.userId.in)
        return { count: 0 }
      },
      createMany: async ({ data }: any) => {
        for (const row of data) {
          technicianSpecializations.set(`${row.userId}|${row.specializationId}`, { ...row })
        }
        return { count: data.length }
      },
    },
    technicianClientBinding: {
      deleteMany: async () => {
        throw new Error(HALT_AFTER_SCOPES)
      },
    },
  } as any

  async function seedOnce() {
    await expect(runCanonicalStageSeed(prisma, { env: stageEnv() })).rejects.toThrow(
      HALT_AFTER_SCOPES,
    )
  }

  return {
    prisma,
    companies,
    users,
    permissionBlocks,
    userAccessScopes,
    userLocationBindings,
    technicianSpecializations,
    locationBindingCreateBatches,
    counters,
    seedOnce,
  }
}

function byEmail(users: Map<string, StoredUser>, email: string) {
  return [...users.values()].find((row) => row.email === email)
}

describe('122S план сида: личности CLIENT и CLIENT_ADMIN', () => {
  it('план остаётся внутренне непротиворечивым', () => {
    // Уникальность id и email проверяет сам план — новые строки её не нарушают.
    expect(() => validateCanonicalStageSeedPlan()).not.toThrow()
  })

  it('обе недостающие роли описаны и принадлежат компании-клиенту', () => {
    expect(CANONICAL_STAGE_SEED.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: CLIENT_USER_EMAIL,
          role: UserRole.CLIENT,
          companyKey: 'client',
          isExecutor: false,
        }),
        expect.objectContaining({
          email: CLIENT_ADMIN_ROLE_EMAIL,
          role: UserRole.CLIENT_ADMIN,
          companyKey: 'client',
          isExecutor: false,
        }),
      ]),
    )
  })

  it('ни одна новая учётка не принадлежит компании-поставщику', () => {
    for (const email of [CLIENT_USER_EMAIL, CLIENT_ADMIN_ROLE_EMAIL]) {
      const row = CANONICAL_STAGE_SEED.users.find((user) => user.email === email)!
      expect(row.companyKey).toBe('client')
      expect(['primaryProvider', 'secondaryProvider']).not.toContain(row.companyKey)
    }

    const clientCompany = CANONICAL_STAGE_SEED.companies.find((row) => row.key === 'client')!
    expect(clientCompany.type).toBe(CompanyType.CLIENT)
  })

  it('обе учётки видят хотя бы одну локацию', () => {
    /*
     * resetCanonicalUserScopes ставит SELECTED_LOCATIONS каждому, кто перечислен
     * в userScopes, а SELECTED_LOCATIONS без привязок трактуется как fail-closed.
     * Пустой набор дал бы учётку, которая входит в систему и не видит ничего,
     * то есть для приёмки бесполезна.
     */
    for (const userKey of ['clientUser', 'clientAdminRole']) {
      const scope = CANONICAL_STAGE_SEED.userScopes.find((row) => row.userKey === userKey)
      expect({ userKey, hasScope: Boolean(scope) }).toEqual({ userKey, hasScope: true })
      expect({ userKey, locations: scope!.locationKeys.length > 0 }).toEqual({
        userKey,
        locations: true,
      })
    }
  })
})

describe('122S прогон сида', () => {
  it('создаёт обе учётки с нужными ролями в компании-клиенте', async () => {
    const harness = createSeedHarness()
    await harness.seedOnce()

    const clientCompanyId = CANONICAL_STAGE_SEED.companies.find((row) => row.key === 'client')!.id
    const providerIds = CANONICAL_STAGE_SEED.companies
      .filter((row) => row.type === CompanyType.PROVIDER)
      .map((row) => row.id)

    const clientUser = byEmail(harness.users, CLIENT_USER_EMAIL)!
    const clientAdminRole = byEmail(harness.users, CLIENT_ADMIN_ROLE_EMAIL)!

    expect(clientUser.role).toBe(UserRole.CLIENT)
    expect(clientAdminRole.role).toBe(UserRole.CLIENT_ADMIN)

    for (const row of [clientUser, clientAdminRole]) {
      expect(row.companyId).toBe(clientCompanyId)
      expect(providerIds).not.toContain(row.companyId)
      expect(row.isExecutor).toBe(false)
    }
  })

  it('повторный прогон не создаёт дублей', async () => {
    const harness = createSeedHarness()

    await harness.seedOnce()
    const afterFirst = harness.counters.userCreate
    const snapshot = [...harness.users.values()].map((row) => ({ ...row }))

    await harness.seedOnce()

    // Второй прогон не создал ни одного пользователя — только обновил на месте.
    expect(harness.counters.userCreate).toBe(afterFirst)
    expect(harness.users.size).toBe(CANONICAL_STAGE_SEED.users.length)

    const emails = [...harness.users.values()].map((row) => row.email)
    expect(new Set(emails).size).toBe(emails.length)

    // Личности устойчивы: те же id у тех же адресов.
    for (const before of snapshot) {
      const after = byEmail(harness.users, before.email)!
      expect({ email: before.email, id: after.id }).toEqual({
        email: before.email,
        id: before.id,
      })
      expect(after.role).toBe(before.role)
      expect(after.companyId).toBe(before.companyId)
    }
  })

  it('повторный прогон сохраняет каждую selected-location привязку ровно один раз', async () => {
    const harness = createSeedHarness()

    await harness.seedOnce()
    await harness.seedOnce()

    const persistedPairs = [...harness.userLocationBindings.values()].map(
      (row) => `${row.userId}|${row.locationId}`,
    )
    expect(new Set(persistedPairs).size).toBe(persistedPairs.length)
    const expectedPairs = CANONICAL_STAGE_SEED.userScopes.flatMap((scope) => {
      const user = CANONICAL_STAGE_SEED.users.find((row) => row.key === scope.userKey)!
      const storedUser = byEmail(harness.users, user.email)!
      return scope.locationKeys.map((locationKey) => {
        const location = CANONICAL_STAGE_SEED.locations.find((row) => row.key === locationKey)!
        return `${storedUser.id}|${location.id}`
      })
    })
    expect([...persistedPairs].sort()).toEqual([...expectedPairs].sort())

    for (const userKey of ['clientUser', 'clientAdminRole'] as const) {
      const user = CANONICAL_STAGE_SEED.users.find((row) => row.key === userKey)!
      const scope = CANONICAL_STAGE_SEED.userScopes.find((row) => row.userKey === userKey)!
      const storedUser = byEmail(harness.users, user.email)!
      const expectedLocationIds = scope.locationKeys.map(
        (locationKey) => CANONICAL_STAGE_SEED.locations.find((row) => row.key === locationKey)!.id,
      )
      const stored = [...harness.userLocationBindings.values()].filter(
        (row) => row.userId === storedUser.id,
      )

      expect(stored.map((row) => row.locationId).sort()).toEqual([...expectedLocationIds].sort())
      expect(stored).toHaveLength(expectedLocationIds.length)
      expect(harness.userAccessScopes.get(storedUser.id)).toMatchObject({
        userId: storedUser.id,
        companyId:
          user.companyKey === 'client'
            ? CANONICAL_STAGE_SEED.companies.find((row) => row.key === 'client')!.id
            : undefined,
        locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      })
      expect(
        [...harness.technicianSpecializations.values()].filter(
          (row) => row.userId === storedUser.id,
        ),
      ).toEqual([])
    }

    for (const batch of harness.locationBindingCreateBatches) {
      const requestedPairs = batch.map((row) => `${row.userId}|${row.locationId}`)
      expect(new Set(requestedPairs).size).toBe(requestedPairs.length)
    }
  })

  it('существующие учётки PRIMARY и SECONDARY сохранены без изменений', async () => {
    const harness = createSeedHarness()
    await harness.seedOnce()

    for (const email of PRE_EXISTING_EMAILS) {
      const planned = CANONICAL_STAGE_SEED.users.find((row) => row.email === email)!
      const stored = byEmail(harness.users, email)

      expect({ email, present: Boolean(stored) }).toEqual({ email, present: true })
      expect({ email, id: stored!.id }).toEqual({ email, id: planned.id })
      expect({ email, role: stored!.role }).toEqual({ email, role: planned.role })
    }

    // Ровно двенадцать прежних плюс две новые.
    expect(harness.users.size).toBe(PRE_EXISTING_EMAILS.length + 2)
  })

  it('сид не выдаёт ни одного права сверх ROLE_GRANTS', async () => {
    /*
     * 122J установил: во время выполнения источник прав — таблица RolePermission,
     * а канонический способ её изменить — PATCH /permissions/matrix.
     *
     * Сид перестраивает матрицу целиком из ROLE_GRANTS — это его прежнее
     * поведение, не вводимое здесь. Проверяется именно то, что добавляет 122S:
     * появление учётной записи само по себе прав не выдаёт, и никакой строки
     * «под новых пользователей» сверх ROLE_GRANTS не возникает.
     *
     * Утверждение намеренно сформулировано через сам ROLE_GRANTS, а не через
     * перечень ролей: иначе оно ломалось бы при любом законном изменении
     * матрицы в другой задаче, ничего при этом не проверяя.
     */
    const harness = createSeedHarness()
    const rolePermissionCreate = jest.spyOn(harness.prisma.rolePermission, 'createMany')

    await harness.seedOnce()

    const blockCodeById = new Map(
      [...harness.permissionBlocks.entries()].map(([code, id]) => [id, code]),
    )
    const created = rolePermissionCreate.mock.calls
      .flatMap((call: any[]) => call[0]?.data ?? [])
      .map(
        (row: any) =>
          `${row.role}|${row.companyType ?? '*'}|${blockCodeById.get(row.permissionBlockId)}`,
      )
      .sort()

    const fromGrants = ROLE_GRANTS.flatMap((grant) =>
      grant.codes.map((code) => `${grant.role}|${grant.companyType ?? '*'}|${code}`),
    ).sort()

    expect(created).toEqual(fromGrants)
  })
})

describe('122S сид остаётся исключительно стендовым', () => {
  it('на боевой личности прогон отказывает до создания пользователей', async () => {
    const harness = createSeedHarness()

    await expect(
      runCanonicalStageSeed(harness.prisma, {
        env: {
          ...stageEnv(),
          DATABASE_URL: 'postgresql://prod_user:prod_password@postgres:5432/sma_db?schema=public',
        },
      }),
    ).rejects.toThrow('Stage QA seed was NOT executed')

    // Ни одной новой учётной записи в боевом контуре не появилось.
    expect(harness.counters.userCreate).toBe(0)
    expect(harness.users.size).toBe(0)
  })

  it('без подтверждения стенда прогон отказывает', async () => {
    const harness = createSeedHarness()
    const env = stageEnv()
    delete env[STAGE_QA_SEED_GUARD.confirmEnv]

    await expect(runCanonicalStageSeed(harness.prisma, { env })).rejects.toThrow(
      'Stage QA seed was NOT executed',
    )
    expect(harness.users.size).toBe(0)
  })
})
