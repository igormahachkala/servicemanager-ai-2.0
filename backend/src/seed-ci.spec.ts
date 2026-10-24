jest.mock('../scripts/seed-stage-qa', () => ({
  ...jest.requireActual('../scripts/seed-stage-qa'),
  runCanonicalStageSeed: jest.fn(),
}))
jest.mock('../scripts/seed-max-bot-stage', () => ({
  runMaxBotStageSeed: jest.fn(),
}))

import { runCiSeed } from '../scripts/seed-ci'
import { runMaxBotStageSeed } from '../scripts/seed-max-bot-stage'
import { runCanonicalStageSeed, SEED_TARGETS, STAGE_QA_SEED_GUARD } from '../scripts/seed-stage-qa'

const runCanonical = runCanonicalStageSeed as jest.MockedFunction<typeof runCanonicalStageSeed>
const runMaxBot = runMaxBotStageSeed as jest.MockedFunction<typeof runMaxBotStageSeed>

const ciDatabaseUrl = `postgresql://sma:sma@localhost:5432/${SEED_TARGETS.ci.database}?schema=public`
const stageDatabaseUrl = `postgresql://stage_user:stage_password@stage_postgres:5432/${SEED_TARGETS.stage.database}?schema=public`

function prismaConnectedTo(database: string) {
  return { $queryRaw: jest.fn().mockResolvedValue([{ database }]) } as any
}

describe('CI seed', () => {
  beforeEach(() => {
    runCanonical.mockReset().mockResolvedValue({ tickets: [] } as any)
    runMaxBot.mockReset().mockResolvedValue({ tickets: [], timezone: 'Europe/Moscow' } as any)
  })

  it('runs both seeders against the CI target with one generated password', async () => {
    const prisma = prismaConnectedTo(SEED_TARGETS.ci.database)
    const now = new Date('2026-10-22T09:00:00.000Z')

    await runCiSeed(prisma, { env: { NODE_ENV: 'test', DATABASE_URL: ciDatabaseUrl }, now })

    expect(runCanonical).toHaveBeenCalledTimes(1)
    expect(runMaxBot).toHaveBeenCalledTimes(1)
    expect(runCanonical.mock.invocationCallOrder[0]).toBeLessThan(runMaxBot.mock.invocationCallOrder[0])

    const canonicalOptions = runCanonical.mock.calls[0][1]!
    const maxBotOptions = runMaxBot.mock.calls[0][1]!
    expect(canonicalOptions.password).toEqual(expect.any(String))
    expect(canonicalOptions.password!.length).toBeGreaterThanOrEqual(32)
    expect(maxBotOptions.password).toBe(canonicalOptions.password)
    expect(maxBotOptions.now).toBe(now)

    for (const env of [canonicalOptions.env!, maxBotOptions.env!]) {
      expect(env[STAGE_QA_SEED_GUARD.confirmEnv]).toBe(SEED_TARGETS.ci.confirm)
      expect(env[STAGE_QA_SEED_GUARD.releaseEnv]).toBe(SEED_TARGETS.ci.releaseEnvironment)
      expect(env.DATABASE_URL).toBe(ciDatabaseUrl)
    }
  })

  it('generates a new password on every run', async () => {
    const env = { NODE_ENV: 'test', DATABASE_URL: ciDatabaseUrl }

    await runCiSeed(prismaConnectedTo(SEED_TARGETS.ci.database), { env })
    await runCiSeed(prismaConnectedTo(SEED_TARGETS.ci.database), { env })

    expect(runCanonical.mock.calls[0][1]!.password).not.toBe(runCanonical.mock.calls[1][1]!.password)
  })

  it('refuses the Stage database even when the caller asks for the Stage target', async () => {
    const prisma = prismaConnectedTo(SEED_TARGETS.stage.database)

    await expect(
      runCiSeed(prisma, {
        env: {
          NODE_ENV: 'development',
          DATABASE_URL: stageDatabaseUrl,
          [STAGE_QA_SEED_GUARD.confirmEnv]: SEED_TARGETS.stage.confirm,
          [STAGE_QA_SEED_GUARD.releaseEnv]: SEED_TARGETS.stage.releaseEnvironment,
        },
      }),
    ).rejects.toThrow('Stage QA seed was NOT executed')

    expect(runCanonical).not.toHaveBeenCalled()
    expect(runMaxBot).not.toHaveBeenCalled()
  })

  it('refuses the Production database', async () => {
    const prisma = prismaConnectedTo('sma_db')

    await expect(
      runCiSeed(prisma, {
        env: {
          NODE_ENV: 'production',
          DATABASE_URL: 'postgresql://prod_user:prod_password@postgres:5432/sma_db?schema=public',
        },
      }),
    ).rejects.toThrow('Stage QA seed was NOT executed')

    expect(runCanonical).not.toHaveBeenCalled()
    expect(runMaxBot).not.toHaveBeenCalled()
  })
})
