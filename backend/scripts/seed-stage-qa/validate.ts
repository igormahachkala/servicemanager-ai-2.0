import { TicketStatus } from '@prisma/client'

import { CANONICAL_STAGE_SEED } from './plan'
import { StageFixtureKey } from './types'
import { assertUnique, lowerEmail } from './utils'

export function validateCanonicalStageSeedPlan() {
  assertUnique('company id', CANONICAL_STAGE_SEED.companies.map((row) => row.id))
  assertUnique('user id', CANONICAL_STAGE_SEED.users.map((row) => row.id))
  assertUnique('user email', CANONICAL_STAGE_SEED.users.map((row) => lowerEmail(row.email)))
  assertUnique('location id', CANONICAL_STAGE_SEED.locations.map((row) => row.id))
  assertUnique('location platformCode', CANONICAL_STAGE_SEED.locations.map((row) => row.platformCode))
  assertUnique('specialization id', CANONICAL_STAGE_SEED.specializations.map((row) => row.id))
  assertUnique('category id', CANONICAL_STAGE_SEED.categories.map((row) => row.id))
  assertUnique('ticket id', CANONICAL_STAGE_SEED.tickets.map((row) => row.id))
  assertUnique('ticket number', CANONICAL_STAGE_SEED.tickets.map((row) => String(row.ticketNumber)))

  const statuses = new Set(CANONICAL_STAGE_SEED.tickets.map((row) => row.status))
  for (const status of [
    TicketStatus.NEW,
    TicketStatus.ASSIGNED,
    TicketStatus.IN_PROGRESS,
    TicketStatus.AWAITING_ACCEPTANCE,
    TicketStatus.DONE,
  ]) {
    if (!statuses.has(status)) {
      throw new Error(`[seed-stage-canonical] missing ticket status fixture: ${status}`)
    }
  }

  for (const key of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] satisfies StageFixtureKey[]) {
    if (!CANONICAL_STAGE_SEED.tickets.some((row) => row.key === key)) {
      throw new Error(`[seed-stage-canonical] missing acceptance fixture ${key}`)
    }
  }
}
