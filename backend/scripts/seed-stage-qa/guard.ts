import { PrismaClient } from '@prisma/client'

import { RELEASE_ENV, SEED_CONFIRM_ENV, SEED_TARGETS } from './constants'
import {
  ConfirmationIdentity,
  ConnectedDatabaseIdentityStatus,
  ParsedDatabaseUrlIdentity,
  StageQaSeedGuardEvaluation,
  StageQaSeedTargetIdentity,
} from './types'

function normalizedEnvValue(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseDatabaseUrlIdentity(databaseUrl: string | undefined): ParsedDatabaseUrlIdentity {
  const raw = databaseUrl?.trim()
  if (!raw) {
    return {
      status: 'missing',
      protocol: null,
      host: null,
      port: null,
      database: null,
      schema: null,
    }
  }

  try {
    const url = new URL(raw)
    const protocol = url.protocol.replace(/:$/, '')
    const database = decodeURIComponent(url.pathname.replace(/^\/+/, '').split('/')[0] ?? '')
    const identity: ParsedDatabaseUrlIdentity = {
      status: protocol === 'postgresql' || protocol === 'postgres' ? 'parsed' : 'unsupported_protocol',
      protocol,
      host: url.hostname || null,
      port: url.port || null,
      database: database || null,
      schema: url.searchParams.get('schema'),
    }

    return identity
  } catch {
    return {
      status: 'malformed',
      protocol: null,
      host: null,
      port: null,
      database: null,
      schema: null,
    }
  }
}

function confirmationIdentity(env: NodeJS.ProcessEnv, expectedConfirm: string): ConfirmationIdentity {
  const confirmation = normalizedEnvValue(env, SEED_CONFIRM_ENV)
  if (!confirmation) {
    return 'missing'
  }
  return confirmation === expectedConfirm ? 'valid' : 'invalid'
}

function resolveSeedTarget(releaseEnvironment: string | null) {
  return releaseEnvironment === SEED_TARGETS.ci.releaseEnvironment ? SEED_TARGETS.ci : SEED_TARGETS.stage
}

function safeDisplay(value: string | null) {
  return value ?? 'unknown'
}

export function formatStageQaSeedTargetIdentity(identity: StageQaSeedTargetIdentity) {
  const confirmation =
    identity.confirmation === 'valid' ? 'valid' : identity.confirmation
  const databaseUrl = identity.databaseUrl
  const hostAndPort = databaseUrl.port ? `${databaseUrl.host}:${databaseUrl.port}` : databaseUrl.host

  return [
    `${SEED_CONFIRM_ENV}=${confirmation}`,
    `${RELEASE_ENV}=${safeDisplay(identity.releaseEnvironment)}`,
    `NODE_ENV=${safeDisplay(identity.nodeEnvironment)}`,
    `databaseUrlStatus=${databaseUrl.status}`,
    `databaseHost=${safeDisplay(hostAndPort)}`,
    `databaseName=${safeDisplay(databaseUrl.database)}`,
    `databaseSchema=${safeDisplay(databaseUrl.schema)}`,
    `connectedDatabaseStatus=${identity.connectedDatabaseStatus}`,
    `connectedDatabase=${safeDisplay(identity.connectedDatabase)}`,
  ].join(', ')
}

export function evaluateStageQaSeedTargetGuard(params?: {
  env?: NodeJS.ProcessEnv
  connectedDatabase?: string | null
  connectedDatabaseStatus?: ConnectedDatabaseIdentityStatus
}): StageQaSeedGuardEvaluation {
  const env = params?.env ?? process.env
  const releaseEnvironment = normalizedEnvValue(env, RELEASE_ENV)
  const nodeEnvironment = normalizedEnvValue(env, 'NODE_ENV')
  const databaseUrl = parseDatabaseUrlIdentity(env.DATABASE_URL)
  const connectedDatabaseStatus = params?.connectedDatabaseStatus ?? 'not_checked'
  const connectedDatabase = params?.connectedDatabase?.trim() || null
  const target = resolveSeedTarget(releaseEnvironment)

  const identity: StageQaSeedTargetIdentity = {
    confirmation: confirmationIdentity(env, target.confirm),
    releaseEnvironment,
    nodeEnvironment,
    databaseUrl,
    connectedDatabaseStatus,
    connectedDatabase,
  }

  const failures: string[] = []

  if (identity.confirmation !== 'valid') {
    failures.push(`${SEED_CONFIRM_ENV} must be set to "${target.confirm}"`)
  }
  if (releaseEnvironment !== target.releaseEnvironment) {
    failures.push(`${RELEASE_ENV} must be "${target.releaseEnvironment}"`)
  }
  if (nodeEnvironment && ['prod', 'production'].includes(nodeEnvironment.toLowerCase())) {
    failures.push('NODE_ENV=production is forbidden for the Stage QA seed')
  }
  if (databaseUrl.status !== 'parsed') {
    failures.push('DATABASE_URL must be a valid PostgreSQL URL')
  } else if (databaseUrl.database !== target.database) {
    failures.push(`DATABASE_URL database must be "${target.database}"`)
  }

  if (connectedDatabaseStatus === 'failed') {
    failures.push('connected database identity could not be read')
  } else if (connectedDatabaseStatus !== 'checked') {
    failures.push('connected database identity was not checked')
  } else if (connectedDatabase !== target.database) {
    failures.push(`connected database must be "${target.database}"`)
  }

  if (
    databaseUrl.status === 'parsed' &&
    connectedDatabaseStatus === 'checked' &&
    connectedDatabase &&
    databaseUrl.database !== connectedDatabase
  ) {
    failures.push('DATABASE_URL database and connected database identity disagree')
  }

  return {
    allowed: failures.length === 0,
    identity,
    failures,
  }
}

export function formatStageQaSeedGuardFailure(evaluation: StageQaSeedGuardEvaluation) {
  return [
    '[seed-stage-canonical] Stage QA seed was NOT executed.',
    'Refusing to run against target database.',
    `Reasons: ${evaluation.failures.join('; ') || 'unknown guard failure'}.`,
    `Target identity: ${formatStageQaSeedTargetIdentity(evaluation.identity)}.`,
  ].join(' ')
}

async function readConnectedDatabaseName(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<Array<{ database: string }>>`
    SELECT current_database() AS database
  `
  return rows[0]?.database ?? null
}

export async function inspectStageQaSeedTarget(
  prisma: PrismaClient | undefined,
  env: NodeJS.ProcessEnv = process.env,
) {
  const parsed = parseDatabaseUrlIdentity(env.DATABASE_URL)
  if (!prisma || parsed.status !== 'parsed') {
    return evaluateStageQaSeedTargetGuard({
      env,
      connectedDatabase: null,
      connectedDatabaseStatus: 'not_checked',
    })
  }

  try {
    const connectedDatabase = await readConnectedDatabaseName(prisma)
    return evaluateStageQaSeedTargetGuard({
      env,
      connectedDatabase,
      connectedDatabaseStatus: 'checked',
    })
  } catch {
    return evaluateStageQaSeedTargetGuard({
      env,
      connectedDatabase: null,
      connectedDatabaseStatus: 'failed',
    })
  }
}

export async function assertStageQaSeedTarget(
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
) {
  const evaluation = await inspectStageQaSeedTarget(prisma, env)
  if (!evaluation.allowed) {
    throw new Error(formatStageQaSeedGuardFailure(evaluation))
  }
  return evaluation
}
