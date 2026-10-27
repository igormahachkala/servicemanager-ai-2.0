import {
  Prisma,
  PrismaClient,
  TicketAttachmentPurpose,
  TicketPriority,
  TicketSource,
  TicketStatus,
} from '@prisma/client'

import { CANONICAL_STAGE_SEED } from './plan'
import { CanonicalTicket, ResolvedSeedIds, SeedTicketResult } from './types'
import { addMinutes, hasTicketStatus } from './utils'

async function assertTicketNumberAvailable(
  prisma: PrismaClient,
  ticketId: string,
  ticketNumber: number,
) {
  const existing = await prisma.ticket.findUnique({
    where: { ticketNumber },
    select: { id: true },
  })
  if (existing && existing.id !== ticketId) {
    throw new Error(
      `[seed-stage-canonical] ticket number ${ticketNumber} is already used by non-canonical ticket ${existing.id}`,
    )
  }
}

function ticketLifecycle(ticket: CanonicalTicket, ids: ResolvedSeedIds) {
  const actorId = ids.users[ticket.createdByUserKey]
  const assigneeId = ticket.assignedUserKey ? ids.users[ticket.assignedUserKey] : null
  const rows: Array<{
    fromStatus: TicketStatus | null
    toStatus: TicketStatus
    changedByUserId: string | null
    comment: string
    at: Date
  }> = [
    {
      fromStatus: null,
      toStatus: TicketStatus.NEW,
      changedByUserId: actorId,
      comment: `Stage fixture ${ticket.key} created`,
      at: ticket.createdAt,
    },
  ]

  if (
    hasTicketStatus([
      TicketStatus.ASSIGNED,
      TicketStatus.IN_PROGRESS,
      TicketStatus.AWAITING_ACCEPTANCE,
      TicketStatus.DONE,
    ], ticket.status)
  ) {
    rows.push({
      fromStatus: TicketStatus.NEW,
      toStatus: TicketStatus.ASSIGNED,
      changedByUserId: ids.users.primaryAdmin,
      comment: assigneeId ? 'Stage fixture assigned' : 'Stage fixture assigned without executor',
      at: addMinutes(ticket.createdAt, 10),
    })
  }

  if (
    hasTicketStatus([
      TicketStatus.IN_PROGRESS,
      TicketStatus.AWAITING_ACCEPTANCE,
      TicketStatus.DONE,
    ], ticket.status)
  ) {
    rows.push({
      fromStatus: TicketStatus.ASSIGNED,
      toStatus: TicketStatus.IN_PROGRESS,
      changedByUserId: assigneeId,
      comment: 'Stage fixture work started',
      at: addMinutes(ticket.createdAt, 20),
    })
  }

  if (hasTicketStatus([TicketStatus.AWAITING_ACCEPTANCE, TicketStatus.DONE], ticket.status)) {
    rows.push({
      fromStatus: TicketStatus.IN_PROGRESS,
      toStatus: TicketStatus.AWAITING_ACCEPTANCE,
      changedByUserId: assigneeId,
      comment: 'Stage fixture work completed and sent to acceptance',
      at: addMinutes(ticket.createdAt, 40),
    })
  }

  if (ticket.status === TicketStatus.DONE) {
    rows.push({
      fromStatus: TicketStatus.AWAITING_ACCEPTANCE,
      toStatus: TicketStatus.DONE,
      changedByUserId: ids.users.clientAdmin,
      comment: 'Stage fixture accepted by client',
      at: addMinutes(ticket.createdAt, 60),
    })
  }

  return rows
}

function ticketEvents(ticket: CanonicalTicket, ids: ResolvedSeedIds) {
  const actorId = ids.users[ticket.createdByUserKey]
  const assigneeId = ticket.assignedUserKey ? ids.users[ticket.assignedUserKey] : null
  const rows: Array<{
    type: string
    actorUserId: string | null
    payload: Prisma.InputJsonValue
    createdAt: Date
  }> = [
    {
      type: 'ticket.created',
      actorUserId: actorId,
      payload: {
        fixtureKey: ticket.key,
        purpose: ticket.purpose,
        locationId: ids.locations[ticket.locationKey],
        problemCategoryId: ids.categories[ticket.categoryKey],
        status: TicketStatus.NEW,
      },
      createdAt: ticket.createdAt,
    },
    {
      type: 'ticket.comment_added',
      actorUserId: actorId,
      payload: {
        comment: `Canonical Stage comment for fixture ${ticket.key}`,
        source: 'stage_seed',
      },
      createdAt: addMinutes(ticket.createdAt, 5),
    },
    {
      type: 'ticket.updated',
      actorUserId: ids.users.clientAdmin,
      payload: {
        fixtureKey: ticket.key,
        changes: [
          {
            field: 'priority',
            oldValue: TicketPriority.NORMAL,
            newValue: ticket.priority,
          },
        ],
      },
      createdAt: addMinutes(ticket.createdAt, 6),
    },
  ]

  if (assigneeId) {
    rows.push({
      type: 'ticket.assigned',
      actorUserId: ids.users.primaryAdmin,
      payload: {
        previousAssignedTechnicianId: null,
        assignedTechnicianId: assigneeId,
        assignerUserId: ids.users.primaryAdmin,
        mode: 'stage_seed',
      },
      createdAt: addMinutes(ticket.createdAt, 10),
    })
  }

  if (
    hasTicketStatus([
      TicketStatus.IN_PROGRESS,
      TicketStatus.AWAITING_ACCEPTANCE,
      TicketStatus.DONE,
    ], ticket.status)
  ) {
    rows.push({
      type: 'ticket.status_changed',
      actorUserId: assigneeId,
      payload: {
        fromStatus: TicketStatus.ASSIGNED,
        toStatus: TicketStatus.IN_PROGRESS,
        comment: 'Stage fixture work started',
      },
      createdAt: addMinutes(ticket.createdAt, 20),
    })
  }

  if (hasTicketStatus([TicketStatus.AWAITING_ACCEPTANCE, TicketStatus.DONE], ticket.status)) {
    rows.push({
      type: 'ticket.ready_for_acceptance',
      actorUserId: assigneeId,
      payload: {
        fromStatus: TicketStatus.IN_PROGRESS,
        toStatus: TicketStatus.AWAITING_ACCEPTANCE,
      },
      createdAt: addMinutes(ticket.createdAt, 40),
    })
  }

  if (ticket.status === TicketStatus.DONE) {
    rows.push({
      type: 'ticket.accepted',
      actorUserId: ids.users.clientAdmin,
      payload: {
        decision: 'ACCEPT',
        comment: 'Stage fixture accepted by client',
      },
      createdAt: addMinutes(ticket.createdAt, 60),
    })
  }

  return rows
}

export async function seedTickets(prisma: PrismaClient, ids: ResolvedSeedIds) {
  const ticketIds = CANONICAL_STAGE_SEED.tickets.map((ticket) => ticket.id)

  await prisma.$transaction([
    prisma.assignmentDecision.deleteMany({ where: { ticketId: { in: ticketIds } } }),
    prisma.ticketAttachment.deleteMany({ where: { ticketId: { in: ticketIds } } }),
    prisma.ticketStatusHistory.deleteMany({ where: { ticketId: { in: ticketIds } } }),
    prisma.domainEvent.deleteMany({
      where: {
        entityType: 'Ticket',
        entityId: { in: ticketIds },
      },
    }),
  ])

  const results: SeedTicketResult[] = []

  for (const ticket of CANONICAL_STAGE_SEED.tickets) {
    await assertTicketNumberAvailable(prisma, ticket.id, ticket.ticketNumber)

    const locationId = ids.locations[ticket.locationKey]
    const createdByUserId = ids.users[ticket.createdByUserKey]
    const assignedTechnicianId = ticket.assignedUserKey ? ids.users[ticket.assignedUserKey] : null
    const lifecycle = ticketLifecycle(ticket, ids)
    const statusUpdatedAt = lifecycle[lifecycle.length - 1]?.at ?? ticket.createdAt

    const row = await prisma.ticket.upsert({
      where: { id: ticket.id },
      update: {
        ticketNumber: ticket.ticketNumber,
        companyId: ids.companies.client,
        locationId,
        problemCategoryId: ids.categories[ticket.categoryKey],
        problemText: ticket.title,
        requesterName: ticket.requesterName,
        requesterPhone: '+7 900 000-00-00',
        pointName: CANONICAL_STAGE_SEED.locations.find((item) => item.key === ticket.locationKey)?.name ?? null,
        address: CANONICAL_STAGE_SEED.locations.find((item) => item.key === ticket.locationKey)?.address ?? null,
        source: TicketSource.INTERNAL,
        urgency: ticket.urgency,
        priority: ticket.priority,
        status: ticket.status,
        assignedTechnicianId,
        createdByUserId,
        slaMinutes: ticket.slaMinutes,
        slaDueAt: addMinutes(ticket.createdAt, ticket.slaMinutes),
        slaBreachedAt: null,
        statusUpdatedAt,
        closedAt: ticket.status === TicketStatus.DONE ? statusUpdatedAt : null,
      },
      create: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        companyId: ids.companies.client,
        locationId,
        problemCategoryId: ids.categories[ticket.categoryKey],
        problemText: ticket.title,
        requesterName: ticket.requesterName,
        requesterPhone: '+7 900 000-00-00',
        pointName: CANONICAL_STAGE_SEED.locations.find((item) => item.key === ticket.locationKey)?.name ?? null,
        address: CANONICAL_STAGE_SEED.locations.find((item) => item.key === ticket.locationKey)?.address ?? null,
        source: TicketSource.INTERNAL,
        urgency: ticket.urgency,
        priority: ticket.priority,
        status: ticket.status,
        assignedTechnicianId,
        createdByUserId,
        slaMinutes: ticket.slaMinutes,
        slaDueAt: addMinutes(ticket.createdAt, ticket.slaMinutes),
        slaBreachedAt: null,
        statusUpdatedAt,
        closedAt: ticket.status === TicketStatus.DONE ? statusUpdatedAt : null,
        createdAt: ticket.createdAt,
      },
      select: { id: true, ticketNumber: true, status: true },
    })

    await prisma.ticketStatusHistory.createMany({
      data: lifecycle.map((item) => ({
        ticketId: ticket.id,
        fromStatus: item.fromStatus,
        toStatus: item.toStatus,
        changedByUserId: item.changedByUserId,
        comment: item.comment,
        createdAt: item.at,
      })),
    })

    const events = ticketEvents(ticket, ids)
    await prisma.domainEvent.createMany({
      data: events.map((event) => ({
        companyId: ids.companies.client,
        entityType: 'Ticket',
        entityId: ticket.id,
        type: event.type,
        actorUserId: event.actorUserId,
        payload: event.payload,
        createdAt: event.createdAt,
      })),
    })

    const requestAttachmentId = `80000000-0000-4000-8000-${ticket.ticketNumber.toString().padStart(12, '0')}`
    await prisma.ticketAttachment.create({
      data: {
        id: requestAttachmentId,
        companyId: ids.companies.client,
        ticketId: ticket.id,
        uploadedByUserId: createdByUserId,
        originalName: `stage-fixture-${ticket.key}-request.jpg`,
        storageKey: `stage-fixtures/${ticket.key}/request.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        url: `/uploads/stage-fixtures/${ticket.key}/request.jpg`,
        purpose: TicketAttachmentPurpose.REQUEST,
        createdAt: addMinutes(ticket.createdAt, 2),
      },
    })

    if (
      hasTicketStatus([
        TicketStatus.IN_PROGRESS,
        TicketStatus.AWAITING_ACCEPTANCE,
        TicketStatus.DONE,
      ], ticket.status)
    ) {
      const reportAttachmentId = `81000000-0000-4000-8000-${ticket.ticketNumber.toString().padStart(12, '0')}`
      await prisma.ticketAttachment.create({
        data: {
          id: reportAttachmentId,
          companyId: ids.companies.client,
          ticketId: ticket.id,
          uploadedByUserId: assignedTechnicianId,
          originalName: `stage-fixture-${ticket.key}-work-report.jpg`,
          storageKey: `stage-fixtures/${ticket.key}/work-report.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 2048,
          url: `/uploads/stage-fixtures/${ticket.key}/work-report.jpg`,
          purpose: TicketAttachmentPurpose.WORK_REPORT,
          createdAt: addMinutes(ticket.createdAt, 35),
        },
      })

      await prisma.domainEvent.create({
        data: {
          companyId: ids.companies.client,
          entityType: 'Ticket',
          entityId: ticket.id,
          type: 'ticket.attachment_uploaded',
          actorUserId: assignedTechnicianId,
          payload: {
            attachmentId: reportAttachmentId,
            purpose: TicketAttachmentPurpose.WORK_REPORT,
          },
          createdAt: addMinutes(ticket.createdAt, 35),
        },
      })
    }

    if (assignedTechnicianId) {
      await prisma.assignmentDecision.create({
        data: {
          ticketId: ticket.id,
          technicianId: assignedTechnicianId,
          candidatesCount: 1,
          reason: 'stage_seed',
          createdAt: addMinutes(ticket.createdAt, 10),
        },
      })
    }

    results.push({
      key: ticket.key,
      id: row.id,
      ticketNumber: row.ticketNumber,
      status: row.status,
      purpose: ticket.purpose,
    })
  }

  return results
}
