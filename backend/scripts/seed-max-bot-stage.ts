import {
  InspectionFrequency,
  PrismaClient,
  WorkShiftStatus,
} from '@prisma/client'
import * as bcrypt from 'bcrypt'

import { assertStageQaSeedTarget } from './seed-stage-qa'
import { ensureMaxBotStageGraph, MaxBotStageIds } from './seed-max-bot-stage-graph'
import {
  buildMaxBotStageSchedules,
  buildMaxBotStageTickets,
  MAX_BOT_STAGE_OPEN_SHIFT_KEYS,
  MAX_BOT_STAGE_PASSWORD_ENV,
  MAX_BOT_STAGE_TECH_KEYS,
  MAX_BOT_STAGE_TIMEZONE,
  maxBotStageInstants,
} from './seed-max-bot-stage-plan'

export async function runMaxBotStageSeed(
  prisma: PrismaClient,
  options?: { password?: string; env?: NodeJS.ProcessEnv; now?: Date },
) {
  const env = options?.env ?? process.env
  await assertStageQaSeedTarget(prisma, env)
  const password = options?.password ?? env[MAX_BOT_STAGE_PASSWORD_ENV]
  if (!password) {
    throw new Error(`[seed-max-bot-stage] ${MAX_BOT_STAGE_PASSWORD_ENV} is required`)
  }

  const now = options?.now ?? new Date()
  const instants = maxBotStageInstants(now, MAX_BOT_STAGE_TIMEZONE)
  const passwordHash = await bcrypt.hash(password, 10)
  const ids = await ensureMaxBotStageGraph(prisma, passwordHash)
  const tickets = await ensureTickets(prisma, ids, instants)
  await ensureRounds(prisma, ids, instants.nextDueAt)
  await ensureShifts(prisma, ids, instants.openedAt)
  return { tickets, timezone: MAX_BOT_STAGE_TIMEZONE }
}

async function ensureTickets(
  prisma: PrismaClient,
  ids: MaxBotStageIds,
  instants: ReturnType<typeof maxBotStageInstants>,
) {
  const tickets = buildMaxBotStageTickets()
  for (const ticket of tickets) {
    const taken = await prisma.ticket.findUnique({
      where: { ticketNumber: ticket.ticketNumber },
      select: { id: true },
    })
    if (taken && taken.id !== ticket.id) {
      throw new Error(
        `[seed-max-bot-stage] ticket number ${ticket.ticketNumber} belongs to ${taken.id}`,
      )
    }
    const slaDueAt = ticket.sla === 'future' ? instants.slaFuture : instants.slaPast
    const assignedTechnicianId = ticket.assigneeKey ? ids.users[ticket.assigneeKey] : null
    await prisma.ticket.upsert({
      where: { id: ticket.id },
      update: {
        ticketNumber: ticket.ticketNumber,
        companyId: ids.clientCompanyId,
        locationId: ids.locationId,
        problemCategoryId: ids.categoryId,
        problemText: ticket.problemText,
        status: ticket.status,
        assignedTechnicianId,
        slaDueAt,
        slaBreachedAt: null,
      },
      create: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        companyId: ids.clientCompanyId,
        locationId: ids.locationId,
        problemCategoryId: ids.categoryId,
        problemText: ticket.problemText,
        status: ticket.status,
        assignedTechnicianId,
        slaDueAt,
        slaBreachedAt: null,
        createdByUserId: ids.users.master,
      },
    })
  }
  return tickets
}

async function ensureRounds(prisma: PrismaClient, ids: MaxBotStageIds, nextDueAt: Date) {
  for (const schedule of buildMaxBotStageSchedules()) {
    const assignedToUserId = schedule.assigneeKey ? ids.users[schedule.assigneeKey] : null
    await prisma.inspectionSchedule.upsert({
      where: { id: schedule.id },
      update: {
        companyId: ids.providerCompanyId,
        templateId: ids.templateId,
        locationId: ids.locationId,
        name: schedule.name,
        assignedToUserId,
        isActive: true,
        frequency: InspectionFrequency.ONCE,
        intervalDays: null,
        startDate: nextDueAt,
        nextDueAt,
      },
      create: {
        id: schedule.id,
        companyId: ids.providerCompanyId,
        templateId: ids.templateId,
        locationId: ids.locationId,
        name: schedule.name,
        assignedToUserId,
        isActive: true,
        frequency: InspectionFrequency.ONCE,
        startDate: nextDueAt,
        nextDueAt,
        createdByUserId: ids.users.master,
      },
    })
  }
}

async function ensureShifts(prisma: PrismaClient, ids: MaxBotStageIds, openedAt: Date) {
  const closedKeys = MAX_BOT_STAGE_TECH_KEYS.filter((key) => !MAX_BOT_STAGE_OPEN_SHIFT_KEYS.includes(key))
  await prisma.workShift.updateMany({
    where: {
      userId: { in: closedKeys.map((key) => ids.users[key]) },
      status: WorkShiftStatus.OPEN,
    },
    data: {
      status: WorkShiftStatus.CLOSED,
      closedAt: openedAt,
      closeReason: 'max bot seed keeps this shift closed',
    },
  })

  for (const key of MAX_BOT_STAGE_OPEN_SHIFT_KEYS) {
    const userId = ids.users[key]
    const open = await prisma.workShift.findFirst({
      where: { userId, status: WorkShiftStatus.OPEN },
      select: { id: true },
    })
    if (open) {
      await prisma.workShift.update({
        where: { id: open.id },
        data: {
          companyId: ids.providerCompanyId,
          openedAt,
          closedAt: null,
          status: WorkShiftStatus.OPEN,
        },
      })
      continue
    }
    await prisma.workShift.create({
      data: {
        id: key === 'tech2'
          ? '81000000-0000-4000-8000-000000003002'
          : '81000000-0000-4000-8000-000000003003',
        companyId: ids.providerCompanyId,
        userId,
        status: WorkShiftStatus.OPEN,
        openedAt,
      },
    })
  }
}

function sanitizeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted DATABASE_URL]')
}

async function main() {
  const prisma = new PrismaClient()
  try {
    const result = await runMaxBotStageSeed(prisma)
    console.log('[seed-max-bot-stage] complete')
    console.log(`[seed-max-bot-stage] timezone: ${result.timezone}`)
    for (const ticket of result.tickets) {
      console.log(
        `[seed-max-bot-stage] #${ticket.ticketNumber} ${ticket.status} ${ticket.assigneeKey ?? 'unassigned'} ${ticket.problemText}`,
      )
    }
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[seed-max-bot-stage] failed: ${sanitizeErrorMessage(error)}`)
    process.exit(1)
  })
}
