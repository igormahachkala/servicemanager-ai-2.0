import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

import { DRY_RUN_ENV, PASSWORD_ENV } from './seed-stage-qa/constants'
import {
  ensureCategory,
  ensureCompany,
  ensureLocation,
  ensureServiceContract,
  ensureSpecialization,
  ensureTechnicianClientBindings,
  ensureUser,
  resetCanonicalUserScopes,
  seedPermissions,
  seedPushPreferences,
} from './seed-stage-qa/entities'
import {
  assertStageQaSeedTarget,
  formatStageQaSeedGuardFailure,
  formatStageQaSeedTargetIdentity,
  inspectStageQaSeedTarget,
} from './seed-stage-qa/guard'
import { CANONICAL_STAGE_SEED } from './seed-stage-qa/plan'
import { seedTickets } from './seed-stage-qa/tickets'
import {
  CanonicalStageSeedResult,
  CategoryKey,
  CompanyKey,
  LocationKey,
  ResolvedSeedIds,
  SpecializationKey,
  UserKey,
} from './seed-stage-qa/types'
import { unique } from './seed-stage-qa/utils'
import { validateCanonicalStageSeedPlan } from './seed-stage-qa/validate'

export { STAGE_QA_SEED_GUARD } from './seed-stage-qa/constants'
export {
  assertStageQaSeedTarget,
  evaluateStageQaSeedTargetGuard,
  formatStageQaSeedGuardFailure,
  formatStageQaSeedTargetIdentity,
  inspectStageQaSeedTarget,
} from './seed-stage-qa/guard'
export { CANONICAL_STAGE_SEED } from './seed-stage-qa/plan'
export type {
  CanonicalStageSeedResult,
  StageFixtureKey,
  StageQaSeedGuardEvaluation,
  StageQaSeedTargetIdentity,
} from './seed-stage-qa/types'
export { validateCanonicalStageSeedPlan } from './seed-stage-qa/validate'

function resolveSeedPassword(passwordOverride?: string, env: NodeJS.ProcessEnv = process.env) {
  const password = passwordOverride ?? env[PASSWORD_ENV]
  if (!password) {
    throw new Error(`[seed-stage-canonical] ${PASSWORD_ENV} is required; no password is stored in source`)
  }
  return password
}

export async function runCanonicalStageSeed(
  prisma: PrismaClient,
  options?: { password?: string; env?: NodeJS.ProcessEnv },
): Promise<CanonicalStageSeedResult> {
  const env = options?.env ?? process.env
  await assertStageQaSeedTarget(prisma, env)

  validateCanonicalStageSeedPlan()

  const password = resolveSeedPassword(options?.password, env)
  const passwordHash = await bcrypt.hash(password, 10)

  await seedPermissions(prisma)

  const ids: ResolvedSeedIds = {
    companies: {} as Record<CompanyKey, string>,
    locations: {} as Record<LocationKey, string>,
    specializations: {} as Record<SpecializationKey, string>,
    categories: {} as Record<CategoryKey, string>,
    users: {} as Record<UserKey, string>,
    contracts: {},
  }

  for (const company of CANONICAL_STAGE_SEED.companies) {
    ids.companies[company.key] = await ensureCompany(prisma, company)
  }

  for (const user of CANONICAL_STAGE_SEED.users) {
    ids.users[user.key] = await ensureUser(
      prisma,
      user,
      ids.companies[user.companyKey],
      passwordHash,
    )
  }

  for (const location of CANONICAL_STAGE_SEED.locations) {
    ids.locations[location.key] = await ensureLocation(
      prisma,
      location,
      ids.companies.client,
    )
  }

  for (const specialization of CANONICAL_STAGE_SEED.specializations) {
    ids.specializations[specialization.key] = await ensureSpecialization(
      prisma,
      specialization,
      ids.companies.client,
    )
  }

  for (const category of CANONICAL_STAGE_SEED.categories) {
    ids.categories[category.key] = await ensureCategory(
      prisma,
      category,
      ids.companies.client,
      ids.specializations[category.specializationKey],
    )
  }

  for (const contract of CANONICAL_STAGE_SEED.contracts) {
    ids.contracts[contract.providerCompanyKey] = await ensureServiceContract(prisma, {
      clientCompanyId: ids.companies.client,
      providerCompanyId: ids.companies[contract.providerCompanyKey],
      role: contract.role,
      locationIds: contract.locationKeys.map((key) => ids.locations[key]),
      specializationIds: contract.specializationKeys.map((key) => ids.specializations[key]),
    })
  }

  await resetCanonicalUserScopes(prisma, ids)
  await ensureTechnicianClientBindings(prisma, ids)
  await seedPushPreferences(prisma, Object.values(ids.users))
  const tickets = await seedTickets(prisma, ids)

  const [permissionBlocks, rolePermissions] = await Promise.all([
    prisma.permissionBlock.count(),
    prisma.rolePermission.count(),
  ])

  return {
    companies: CANONICAL_STAGE_SEED.companies.length,
    users: CANONICAL_STAGE_SEED.users.length,
    locations: CANONICAL_STAGE_SEED.locations.length,
    specializations: CANONICAL_STAGE_SEED.specializations.length,
    categories: CANONICAL_STAGE_SEED.categories.length,
    contracts: CANONICAL_STAGE_SEED.contracts.length,
    tickets,
    permissionBlocks,
    rolePermissions,
    providerDelegation: 'not_supported_by_current_schema',
  }
}

export async function printCanonicalStageSeedDryRun(
  prisma: PrismaClient | undefined,
  env: NodeJS.ProcessEnv = process.env,
) {
  validateCanonicalStageSeedPlan()
  const guard = await inspectStageQaSeedTarget(prisma, env)
  const statuses = unique(CANONICAL_STAGE_SEED.tickets.map((ticket) => ticket.status))
  console.log(`[seed-stage-canonical] target: ${formatStageQaSeedTargetIdentity(guard.identity)}`)
  if (!guard.allowed) {
    throw new Error(formatStageQaSeedGuardFailure(guard))
  }
  console.log('[seed-stage-canonical] dry-run OK')
  console.log(`[seed-stage-canonical] companies: ${CANONICAL_STAGE_SEED.companies.length}`)
  console.log(`[seed-stage-canonical] users: ${CANONICAL_STAGE_SEED.users.length}`)
  console.log(`[seed-stage-canonical] contracts: ${CANONICAL_STAGE_SEED.contracts.length}`)
  console.log(`[seed-stage-canonical] tickets: ${CANONICAL_STAGE_SEED.tickets.length}`)
  console.log(`[seed-stage-canonical] statuses: ${statuses.join(', ')}`)
  console.log('[seed-stage-canonical] providerDelegation: not supported by current schema')
}

function sanitizeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted DATABASE_URL]')
}

async function main() {
  const prisma = new PrismaClient()
  try {
    if (process.env[DRY_RUN_ENV] === '1') {
      await printCanonicalStageSeedDryRun(prisma)
      return
    }

    const result = await runCanonicalStageSeed(prisma)
    console.log('[seed-stage-canonical] complete')
    console.log(`[seed-stage-canonical] companies: ${result.companies}`)
    console.log(`[seed-stage-canonical] users: ${result.users}`)
    console.log(`[seed-stage-canonical] locations: ${result.locations}`)
    console.log(`[seed-stage-canonical] specializations: ${result.specializations}`)
    console.log(`[seed-stage-canonical] categories: ${result.categories}`)
    console.log(`[seed-stage-canonical] contracts: ${result.contracts}`)
    console.log(`[seed-stage-canonical] PermissionBlock: ${result.permissionBlocks}`)
    console.log(`[seed-stage-canonical] RolePermission: ${result.rolePermissions}`)
    for (const ticket of result.tickets) {
      console.log(
        `[seed-stage-canonical] fixture ${ticket.key}: #${ticket.ticketNumber} ${ticket.status} — ${ticket.purpose}`,
      )
    }
    console.log('[seed-stage-canonical] providerDelegation: not supported by current schema')
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[seed-stage-canonical] failed: ${sanitizeErrorMessage(error)}`)
    process.exit(1)
  })
}
