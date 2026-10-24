import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'crypto'

import { runMaxBotStageSeed } from './seed-max-bot-stage'
import {
  assertStageQaSeedTarget,
  runCanonicalStageSeed,
  SEED_TARGETS,
  STAGE_QA_SEED_GUARD,
} from './seed-stage-qa'

export function ciSeedEnv(baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    [STAGE_QA_SEED_GUARD.confirmEnv]: SEED_TARGETS.ci.confirm,
    [STAGE_QA_SEED_GUARD.releaseEnv]: SEED_TARGETS.ci.releaseEnvironment,
  }
}

export function generateCiSeedPassword() {
  return randomBytes(24).toString('base64url')
}

export async function runCiSeed(
  prisma: PrismaClient,
  options?: { env?: NodeJS.ProcessEnv; now?: Date },
) {
  const env = ciSeedEnv(options?.env)
  await assertStageQaSeedTarget(prisma, env)

  const password = generateCiSeedPassword()
  const canonical = await runCanonicalStageSeed(prisma, { password, env })
  const maxBot = await runMaxBotStageSeed(prisma, { password, env, now: options?.now })

  return { canonical, maxBot }
}

function sanitizeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted DATABASE_URL]')
}

async function main() {
  const prisma = new PrismaClient()
  try {
    const { canonical, maxBot } = await runCiSeed(prisma)
    console.log('[seed-ci] complete')
    console.log(`[seed-ci] canonical companies: ${canonical.companies}`)
    console.log(`[seed-ci] canonical users: ${canonical.users}`)
    console.log(`[seed-ci] canonical locations: ${canonical.locations}`)
    console.log(`[seed-ci] canonical contracts: ${canonical.contracts}`)
    console.log(`[seed-ci] canonical tickets: ${canonical.tickets.length}`)
    console.log(`[seed-ci] PermissionBlock: ${canonical.permissionBlocks}`)
    console.log(`[seed-ci] RolePermission: ${canonical.rolePermissions}`)
    console.log(`[seed-ci] max bot tickets: ${maxBot.tickets.length}`)
    console.log(`[seed-ci] max bot timezone: ${maxBot.timezone}`)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[seed-ci] failed: ${sanitizeErrorMessage(error)}`)
    process.exit(1)
  })
}
