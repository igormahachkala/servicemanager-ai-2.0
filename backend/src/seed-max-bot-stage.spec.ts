import { TicketStatus, UserRole } from '@prisma/client'

import { evaluateStageQaSeedTargetGuard, STAGE_QA_SEED_GUARD } from '../scripts/seed-stage-qa'
import {
  buildMaxBotStageSchedules,
  buildMaxBotStageTickets,
  MAX_BOT_STAGE_MASTER_MENU_KEYS,
  MAX_BOT_STAGE_OPEN_SHIFT_KEYS,
  MAX_BOT_STAGE_PASSWORD_ENV,
  MAX_BOT_STAGE_TECH_KEYS,
  MAX_BOT_STAGE_TEMPLATE_ITEM_COUNT,
  MAX_BOT_STAGE_TIMEZONE,
  MAX_BOT_STAGE_USERS,
  maxBotStageInstants,
  maxBotStageTemplateItemTitles,
} from '../scripts/seed-max-bot-stage-plan'

const stageDatabaseUrl =
  'postgresql://stage_user:stage_password@stage_postgres:5432/sma_stage_db?schema=public'

function guardEnv(databaseUrl: string): NodeJS.ProcessEnv {
  return {
    [STAGE_QA_SEED_GUARD.confirmEnv]: STAGE_QA_SEED_GUARD.expectedConfirm,
    [STAGE_QA_SEED_GUARD.releaseEnv]: STAGE_QA_SEED_GUARD.expectedReleaseEnvironment,
    NODE_ENV: 'development',
    DATABASE_URL: databaseUrl,
  }
}

describe('max bot stage seed plan', () => {
  const tickets = buildMaxBotStageTickets()
  const schedules = buildMaxBotStageSchedules()

  it('defines six technicians and three master-menu accounts', () => {
    const technicians = MAX_BOT_STAGE_USERS.filter((row) => row.role === UserRole.TECHNICIAN)
    const masters = MAX_BOT_STAGE_USERS.filter((row) =>
      MAX_BOT_STAGE_MASTER_MENU_KEYS.includes(row.key),
    )
    expect(technicians).toHaveLength(6)
    expect(technicians.every((row) => row.isExecutor)).toBe(true)
    expect(masters.map((row) => row.role)).toEqual([
      UserRole.MASTER,
      UserRole.ADMIN,
      UserRole.DISPATCHER,
    ])
    expect(new Set(MAX_BOT_STAGE_USERS.map((row) => row.email)).size).toBe(9)
    expect(MAX_BOT_STAGE_PASSWORD_ENV).toBe('STAGE_TEST_MAX_PASSWORD')
  })

  it('splits tickets into 12 new, 12 in progress and 8 overdue', () => {
    expect(tickets.filter((row) => row.status === TicketStatus.NEW && row.assigneeKey === null)).toHaveLength(12)
    expect(tickets.filter((row) => row.status === TicketStatus.IN_PROGRESS)).toHaveLength(12)
    expect(tickets.filter((row) => row.status === TicketStatus.ASSIGNED && row.sla === 'past')).toHaveLength(8)
    for (const key of MAX_BOT_STAGE_TECH_KEYS) {
      expect(tickets.filter((row) => row.status === TicketStatus.IN_PROGRESS && row.assigneeKey === key)).toHaveLength(2)
    }
    expect(
      MAX_BOT_STAGE_TECH_KEYS.map(
        (key) => tickets.filter((row) => row.status === TicketStatus.ASSIGNED && row.assigneeKey === key).length,
      ),
    ).toEqual([2, 2, 1, 1, 1, 1])
    expect(new Set(tickets.map((row) => row.problemText)).size).toBe(tickets.length)
    expect(new Set(tickets.map((row) => row.ticketNumber)).size).toBe(tickets.length)
  })

  it('plans 12 assigned rounds, 6 unassigned rounds and 5 template items', () => {
    expect(schedules.filter((row) => row.assigneeKey)).toHaveLength(12)
    expect(schedules.filter((row) => row.assigneeKey === null)).toHaveLength(6)
    for (const key of MAX_BOT_STAGE_TECH_KEYS) {
      expect(schedules.filter((row) => row.assigneeKey === key)).toHaveLength(2)
    }
    expect(new Set(schedules.map((row) => row.name)).size).toBe(schedules.length)
    expect(maxBotStageTemplateItemTitles()).toHaveLength(MAX_BOT_STAGE_TEMPLATE_ITEM_COUNT)
    expect(MAX_BOT_STAGE_TEMPLATE_ITEM_COUNT).toBeGreaterThanOrEqual(5)
  })

  it('opens a shift only for the second and third technicians', () => {
    expect(MAX_BOT_STAGE_OPEN_SHIFT_KEYS).toEqual(['tech2', 'tech3'])
  })

  it('keeps future SLA ahead of now and today rounds inside the company day', () => {
    const now = new Date('2026-09-28T11:00:00.000Z')
    const instants = maxBotStageInstants(now, MAX_BOT_STAGE_TIMEZONE)
    expect(instants.slaFuture.getTime()).toBeGreaterThan(now.getTime())
    expect(instants.slaPast.getTime()).toBeLessThan(now.getTime())
    expect(instants.nextDueAt.getTime()).toBeGreaterThanOrEqual(instants.dayStart.getTime())
    expect(instants.nextDueAt.getTime()).toBeLessThanOrEqual(instants.dayEnd.getTime())
    expect(instants.openedAt).toEqual(now)
  })

  it('refuses a database that is not sma_stage_db', () => {
    const result = evaluateStageQaSeedTargetGuard({
      env: guardEnv('postgresql://stage_user:stage_password@stage_postgres:5432/sma_prod_db?schema=public'),
      connectedDatabase: 'sma_prod_db',
      connectedDatabaseStatus: 'checked',
    })
    expect(result.allowed).toBe(false)
  })

  it('allows the stage database when confirm and release match', () => {
    const result = evaluateStageQaSeedTargetGuard({
      env: guardEnv(stageDatabaseUrl),
      connectedDatabase: STAGE_QA_SEED_GUARD.expectedDatabase,
      connectedDatabaseStatus: 'checked',
    })
    expect(result.allowed).toBe(true)
    expect(result.failures).toEqual([])
  })
})
