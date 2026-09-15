import { ServiceContractRole, TicketStatus, UserRole } from '@prisma/client'

import {
  evaluateStageQaSeedTargetGuard,
  CANONICAL_STAGE_SEED,
  formatStageQaSeedGuardFailure,
  formatStageQaSeedTargetIdentity,
  printCanonicalStageSeedDryRun,
  runCanonicalStageSeed,
  STAGE_QA_SEED_GUARD,
  validateCanonicalStageSeedPlan,
} from '../scripts/seed-stage-qa'

const stageDatabaseUrl =
  'postgresql://stage_user:stage_password@stage_postgres:5432/sma_stage_db?schema=public'

function stageGuardEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    [STAGE_QA_SEED_GUARD.confirmEnv]: STAGE_QA_SEED_GUARD.expectedConfirm,
    [STAGE_QA_SEED_GUARD.releaseEnv]: STAGE_QA_SEED_GUARD.expectedReleaseEnvironment,
    NODE_ENV: 'development',
    DATABASE_URL: stageDatabaseUrl,
    STAGE_CANONICAL_PASSWORD: 'StagePassword_115A',
    ...overrides,
  }
}

function evaluateGuard(
  env: NodeJS.ProcessEnv,
  connectedDatabase = STAGE_QA_SEED_GUARD.expectedDatabase,
) {
  return evaluateStageQaSeedTargetGuard({
    env,
    connectedDatabase,
    connectedDatabaseStatus: 'checked',
  })
}

describe('canonical Stage acceptance seed plan', () => {
  it('is internally consistent and covers required ticket states', () => {
    expect(() => validateCanonicalStageSeedPlan()).not.toThrow()

    const statuses = Array.from(new Set(CANONICAL_STAGE_SEED.tickets.map((ticket) => ticket.status)))
    expect(statuses).toEqual(
      expect.arrayContaining([
        TicketStatus.NEW,
        TicketStatus.ASSIGNED,
        TicketStatus.IN_PROGRESS,
        TicketStatus.AWAITING_ACCEPTANCE,
        TicketStatus.DONE,
      ]),
    )
  })

  it('defines the canonical Stage account matrix', () => {
    expect(CANONICAL_STAGE_SEED.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: 'stage.client.admin@stage.local', role: UserRole.ADMIN }),
        expect.objectContaining({ email: 'stage.network.director@stage.local', role: UserRole.NETWORK_DIRECTOR }),
        expect.objectContaining({ email: 'stage.territorial.manager@stage.local', role: UserRole.TERRITORIAL_MANAGER }),
        expect.objectContaining({ email: 'stage.primary.admin@stage.local', role: UserRole.ADMIN }),
        expect.objectContaining({ email: 'stage.primary.dispatcher@stage.local', role: UserRole.DISPATCHER }),
        expect.objectContaining({ email: 'stage.primary.master@stage.local', role: UserRole.MASTER }),
        expect.objectContaining({ email: 'stage.primary.tech@stage.local', role: UserRole.TECHNICIAN, isExecutor: true }),
        expect.objectContaining({ email: 'stage.secondary.admin@stage.local', role: UserRole.ADMIN }),
        expect.objectContaining({ email: 'stage.secondary.dispatcher@stage.local', role: UserRole.DISPATCHER }),
        expect.objectContaining({ email: 'stage.secondary.master@stage.local', role: UserRole.MASTER }),
        expect.objectContaining({ email: 'stage.secondary.tech@stage.local', role: UserRole.TECHNICIAN, isExecutor: true }),
        expect.objectContaining({ email: 'stage.mobile.tech@stage.local', role: UserRole.TECHNICIAN, isExecutor: true }),
      ]),
    )
  })

  it('defines explicit PRIMARY and SECONDARY contract context fixtures', () => {
    expect(CANONICAL_STAGE_SEED.contracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerCompanyKey: 'primaryProvider',
          role: ServiceContractRole.PRIMARY,
          locationKeys: expect.arrayContaining(['primary', 'secondary']),
          specializationKeys: expect.arrayContaining(['hvac', 'electrical']),
        }),
        expect.objectContaining({
          providerCompanyKey: 'secondaryProvider',
          role: ServiceContractRole.SECONDARY,
          locationKeys: ['secondary'],
          specializationKeys: ['electrical'],
        }),
      ]),
    )
  })

  it('keeps acceptance fixtures A-I deterministic and identifiable', () => {
    for (const key of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']) {
      expect(CANONICAL_STAGE_SEED.tickets).toContainEqual(
        expect.objectContaining({
          key,
          title: expect.stringContaining(`${key} `),
        }),
      )
    }
  })
})

describe('canonical Stage seed Production guard', () => {
  it('allows the canonical Stage identity', () => {
    const result = evaluateGuard(stageGuardEnv())

    expect(result.allowed).toBe(true)
    expect(result.failures).toEqual([])
  })

  it('denies a missing confirmation', () => {
    const result = evaluateGuard(
      stageGuardEnv({
        [STAGE_QA_SEED_GUARD.confirmEnv]: undefined,
      }),
    )

    expect(result.allowed).toBe(false)
    expect(result.failures).toContain(
      `${STAGE_QA_SEED_GUARD.confirmEnv} must be set to "${STAGE_QA_SEED_GUARD.expectedConfirm}"`,
    )
  })

  it('denies a wrong confirmation', () => {
    const result = evaluateGuard(
      stageGuardEnv({
        [STAGE_QA_SEED_GUARD.confirmEnv]: 'production',
      }),
    )

    expect(result.allowed).toBe(false)
    expect(result.failures).toContain(
      `${STAGE_QA_SEED_GUARD.confirmEnv} must be set to "${STAGE_QA_SEED_GUARD.expectedConfirm}"`,
    )
  })

  it('denies a Production identity', () => {
    const result = evaluateGuard(
      stageGuardEnv({
        [STAGE_QA_SEED_GUARD.releaseEnv]: 'prod',
        DATABASE_URL: 'postgresql://prod_user:prod_password@postgres:5432/sma_db?schema=public',
      }),
      'sma_db',
    )

    expect(result.allowed).toBe(false)
    expect(result.failures).toEqual(
      expect.arrayContaining([
        `${STAGE_QA_SEED_GUARD.releaseEnv} must be "${STAGE_QA_SEED_GUARD.expectedReleaseEnvironment}"`,
        `DATABASE_URL database must be "${STAGE_QA_SEED_GUARD.expectedDatabase}"`,
        `connected database must be "${STAGE_QA_SEED_GUARD.expectedDatabase}"`,
      ]),
    )
  })

  it('denies a wrong parsed database name even if the connected database is Stage', () => {
    const result = evaluateGuard(
      stageGuardEnv({
        DATABASE_URL: 'postgresql://stage_user:stage_password@stage_postgres:5432/not_stage?schema=public',
      }),
      STAGE_QA_SEED_GUARD.expectedDatabase,
    )

    expect(result.allowed).toBe(false)
    expect(result.failures).toContain(
      `DATABASE_URL database must be "${STAGE_QA_SEED_GUARD.expectedDatabase}"`,
    )
  })

  it('denies NODE_ENV=development with a Production database', () => {
    const result = evaluateGuard(
      stageGuardEnv({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://prod_user:prod_password@postgres:5432/sma_db?schema=public',
      }),
      'sma_db',
    )

    expect(result.allowed).toBe(false)
    expect(result.failures).toEqual(
      expect.arrayContaining([
        `DATABASE_URL database must be "${STAGE_QA_SEED_GUARD.expectedDatabase}"`,
        `connected database must be "${STAGE_QA_SEED_GUARD.expectedDatabase}"`,
      ]),
    )
  })

  it('denies NODE_ENV=production even with a Stage database', () => {
    const result = evaluateGuard(stageGuardEnv({ NODE_ENV: 'production' }))

    expect(result.allowed).toBe(false)
    expect(result.failures).toContain('NODE_ENV=production is forbidden for the Stage QA seed')
  })

  it('denies a missing database identity', () => {
    const result = evaluateStageQaSeedTargetGuard({
      env: stageGuardEnv({ DATABASE_URL: '' }),
      connectedDatabase: null,
      connectedDatabaseStatus: 'not_checked',
    })

    expect(result.allowed).toBe(false)
    expect(result.failures).toEqual(
      expect.arrayContaining([
        'DATABASE_URL must be a valid PostgreSQL URL',
        'connected database identity was not checked',
      ]),
    )
  })

  it('denies current_database mismatch and conflicting parsed/connected database signals', () => {
    const result = evaluateGuard(stageGuardEnv(), 'sma_db')

    expect(result.allowed).toBe(false)
    expect(result.failures).toEqual(
      expect.arrayContaining([
        `connected database must be "${STAGE_QA_SEED_GUARD.expectedDatabase}"`,
        'DATABASE_URL database and connected database identity disagree',
      ]),
    )
  })

  it('denies a malformed database URL', () => {
    const result = evaluateStageQaSeedTargetGuard({
      env: stageGuardEnv({ DATABASE_URL: 'not-a-database-url' }),
      connectedDatabase: null,
      connectedDatabaseStatus: 'not_checked',
    })

    expect(result.allowed).toBe(false)
    expect(result.failures).toEqual(
      expect.arrayContaining([
        'DATABASE_URL must be a valid PostgreSQL URL',
        'connected database identity was not checked',
      ]),
    )
  })

  it('keeps dry-run free of destructive Prisma writes', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ database: STAGE_QA_SEED_GUARD.expectedDatabase }]),
      permissionBlock: { upsert: jest.fn() },
      rolePermission: { deleteMany: jest.fn(), createMany: jest.fn() },
      company: { update: jest.fn(), create: jest.fn() },
      user: { update: jest.fn(), create: jest.fn() },
      ticket: { upsert: jest.fn() },
    } as any
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)

    try {
      await printCanonicalStageSeedDryRun(prisma, stageGuardEnv())
    } finally {
      logSpy.mockRestore()
    }

    expect(prisma.$queryRaw).toHaveBeenCalled()
    expect(prisma.permissionBlock.upsert).not.toHaveBeenCalled()
    expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled()
    expect(prisma.rolePermission.createMany).not.toHaveBeenCalled()
    expect(prisma.company.update).not.toHaveBeenCalled()
    expect(prisma.company.create).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(prisma.ticket.upsert).not.toHaveBeenCalled()
  })

  it('runs the guard before the first destructive mutation', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ database: 'sma_db' }]),
      permissionBlock: { upsert: jest.fn() },
      rolePermission: { deleteMany: jest.fn(), createMany: jest.fn() },
      company: { update: jest.fn(), create: jest.fn() },
      user: { update: jest.fn(), create: jest.fn() },
      ticket: { upsert: jest.fn() },
    } as any

    await expect(
      runCanonicalStageSeed(prisma, {
        env: stageGuardEnv({
          DATABASE_URL: 'postgresql://prod_user:prod_password@postgres:5432/sma_db?schema=public',
        }),
      }),
    ).rejects.toThrow('Stage QA seed was NOT executed')

    expect(prisma.$queryRaw).toHaveBeenCalled()
    expect(prisma.permissionBlock.upsert).not.toHaveBeenCalled()
    expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled()
    expect(prisma.rolePermission.createMany).not.toHaveBeenCalled()
    expect(prisma.company.update).not.toHaveBeenCalled()
    expect(prisma.company.create).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(prisma.ticket.upsert).not.toHaveBeenCalled()
  })

  it('denies before password resolution or hashing', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ database: 'sma_db' }]),
      permissionBlock: { upsert: jest.fn() },
      rolePermission: { deleteMany: jest.fn(), createMany: jest.fn() },
      company: { update: jest.fn(), create: jest.fn() },
      user: { update: jest.fn(), create: jest.fn() },
      ticket: { upsert: jest.fn() },
    } as any

    await expect(
      runCanonicalStageSeed(prisma, {
        env: stageGuardEnv({
          DATABASE_URL: 'postgresql://prod_user:prod_password@postgres:5432/sma_db?schema=public',
          STAGE_CANONICAL_PASSWORD: undefined,
        }),
      }),
    ).rejects.toThrow('Stage QA seed was NOT executed')
  })

  it('does not expose database credentials in guard errors or identity output', () => {
    const result = evaluateGuard(
      stageGuardEnv({
        [STAGE_QA_SEED_GUARD.releaseEnv]: 'prod',
        DATABASE_URL: 'postgresql://prod_user:super-secret-password@prod-db:5432/sma_db?schema=public',
      }),
      'sma_db',
    )
    const text = `${formatStageQaSeedTargetIdentity(result.identity)} ${formatStageQaSeedGuardFailure(result)}`

    expect(text).toContain('prod-db')
    expect(text).toContain('sma_db')
    expect(text).not.toContain('prod_user')
    expect(text).not.toContain('super-secret-password')
    expect(text).not.toContain('postgresql://')
  })
})
