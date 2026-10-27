/**
 * Entity helpers for Stage QA gap fixtures.
 */

import {
  CompanyType,
  MaxUserBindingStatus,
  PrismaClient,
  ServiceContractLocationMode,
  ServiceContractRole,
  ServiceContractStatus,
  TicketPriority,
  TicketSource,
  TicketStatus,
  TicketUrgency,
  UserAccessLocationMode,
  UserRole,
} from '@prisma/client'

import { GAP_IDS, STAGE_QA_GAP_FIXTURES } from './seed-stage-qa-gaps-ids'

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000)
}

export async function ensureCompany(
  prisma: PrismaClient,
  params: { id: string; name: string; type: CompanyType },
) {
  const existingById = await prisma.company.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  const existing =
    existingById ??
    (await prisma.company.findFirst({
      where: { name: params.name },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }))

  if (existing) {
    const updated = await prisma.company.update({
      where: { id: existing.id },
      data: {
        name: params.name,
        type: params.type,
        autoAssignEnabled: false,
        allowTechnicianClaim: true,
        publicRequestEnabled: false,
        slaStrictMode: false,
      },
      select: { id: true },
    })
    return updated.id
  }

  const created = await prisma.company.create({
    data: {
      id: params.id,
      name: params.name,
      type: params.type,
      autoAssignEnabled: false,
      allowTechnicianClaim: true,
      publicRequestEnabled: false,
      slaStrictMode: false,
    },
    select: { id: true },
  })
  return created.id
}

export async function ensureUser(
  prisma: PrismaClient,
  params: {
    id: string
    email: string
    firstName: string
    lastName: string
    role: UserRole
    companyId: string
    passwordHash: string
    isExecutor?: boolean
  },
) {
  const email = params.email.trim().toLowerCase()
  const existingByEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  const existing =
    existingByEmail ??
    (await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true },
    }))

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        email,
        password: params.passwordHash,
        firstName: params.firstName,
        lastName: params.lastName,
        role: params.role,
        companyId: params.companyId,
        isExecutor: params.isExecutor ?? false,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    })
    return updated.id
  }

  const created = await prisma.user.create({
    data: {
      id: params.id,
      email,
      password: params.passwordHash,
      firstName: params.firstName,
      lastName: params.lastName,
      role: params.role,
      companyId: params.companyId,
      isExecutor: params.isExecutor ?? false,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  })
  return created.id
}

export async function ensureLocation(
  prisma: PrismaClient,
  params: {
    id: string
    clientCompanyId: string
    platformCode: string
    name: string
    city: string
    address: string
  },
) {
  const location = await prisma.location.upsert({
    where: {
      clientCompanyId_platformCode: {
        clientCompanyId: params.clientCompanyId,
        platformCode: params.platformCode,
      },
    },
    update: {
      name: params.name,
      city: params.city,
      address: params.address,
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: params.id,
      clientCompanyId: params.clientCompanyId,
      platformCode: params.platformCode,
      name: params.name,
      city: params.city,
      address: params.address,
      isActive: true,
    },
    select: { id: true },
  })
  return location.id
}

export async function ensureSpecialization(
  prisma: PrismaClient,
  params: { id: string; companyId: string; name: string },
) {
  const existing =
    (await prisma.specialization.findFirst({
      where: { id: params.id },
      select: { id: true },
    })) ??
    (await prisma.specialization.findFirst({
      where: { companyId: params.companyId, name: params.name },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }))

  if (existing) {
    const updated = await prisma.specialization.update({
      where: { id: existing.id },
      data: { companyId: params.companyId, name: params.name, isActive: true },
      select: { id: true },
    })
    return updated.id
  }

  const created = await prisma.specialization.create({
    data: {
      id: params.id,
      companyId: params.companyId,
      name: params.name,
      isActive: true,
    },
    select: { id: true },
  })
  return created.id
}

export async function ensureCategory(
  prisma: PrismaClient,
  params: {
    id: string
    companyId: string
    name: string
    specializationId: string
  },
) {
  const category = await prisma.problemCategory.upsert({
    where: { companyId_name: { companyId: params.companyId, name: params.name } },
    update: { isActive: true, instructions: 'Stage QA foreign isolation fixture' },
    create: {
      id: params.id,
      companyId: params.companyId,
      name: params.name,
      instructions: 'Stage QA foreign isolation fixture',
      isActive: true,
    },
    select: { id: true },
  })

  await prisma.problemCategorySpecialization.deleteMany({
    where: { problemCategoryId: category.id },
  })
  await prisma.problemCategorySpecialization.create({
    data: {
      problemCategoryId: category.id,
      specializationId: params.specializationId,
    },
  })

  return category.id
}

export async function ensureContractById(
  prisma: PrismaClient,
  params: {
    id: string
    clientCompanyId: string
    providerCompanyId: string
    role: ServiceContractRole
    status: ServiceContractStatus
    locationIds: string[]
    specializationIds: string[]
    notes: string
  },
) {
  const byPair = await prisma.serviceContract.findUnique({
    where: {
      clientCompanyId_providerCompanyId: {
        clientCompanyId: params.clientCompanyId,
        providerCompanyId: params.providerCompanyId,
      },
    },
    select: { id: true },
  })

  const contract = byPair
    ? await prisma.serviceContract.update({
        where: { id: byPair.id },
        data: {
          status: params.status,
          role: params.role,
          locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
          startsAt: null,
          endsAt: params.status === ServiceContractStatus.ENDED ? new Date('2026-01-01T00:00:00.000Z') : null,
          notes: params.notes,
        },
        select: { id: true },
      })
    : await prisma.serviceContract.create({
        data: {
          id: params.id,
          clientCompanyId: params.clientCompanyId,
          providerCompanyId: params.providerCompanyId,
          status: params.status,
          role: params.role,
          locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
          startsAt: null,
          endsAt: params.status === ServiceContractStatus.ENDED ? new Date('2026-01-01T00:00:00.000Z') : null,
          notes: params.notes,
        },
        select: { id: true },
      })

  await prisma.serviceContractLocation.deleteMany({
    where: { serviceContractId: contract.id },
  })
  if (params.locationIds.length > 0) {
    await prisma.serviceContractLocation.createMany({
      data: params.locationIds.map((locationId) => ({
        serviceContractId: contract.id,
        clientCompanyId: params.clientCompanyId,
        locationId,
      })),
      skipDuplicates: true,
    })
  }

  await prisma.serviceContractSpecialization.deleteMany({
    where: { serviceContractId: contract.id },
  })
  if (params.specializationIds.length > 0) {
    await prisma.serviceContractSpecialization.createMany({
      data: params.specializationIds.map((specializationId) => ({
        serviceContractId: contract.id,
        specializationId,
      })),
      skipDuplicates: true,
    })
  }

  return contract.id
}

export async function ensureUserSelectedScope(
  prisma: PrismaClient,
  params: {
    userId: string
    companyId: string
    locationIds: string[]
    specializationIds: string[]
  },
) {
  await prisma.$transaction([
    prisma.userLocationBinding.deleteMany({ where: { userId: params.userId } }),
    prisma.technicianSpecialization.deleteMany({ where: { userId: params.userId } }),
    prisma.userAccessScope.deleteMany({ where: { userId: params.userId } }),
  ])

  await prisma.userAccessScope.create({
    data: {
      userId: params.userId,
      companyId: params.companyId,
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
    },
  })

  if (params.locationIds.length > 0) {
    await prisma.userLocationBinding.createMany({
      data: params.locationIds.map((locationId) => ({
        userId: params.userId,
        companyId: params.companyId,
        locationId,
      })),
      skipDuplicates: true,
    })
  }

  if (params.specializationIds.length > 0) {
    await prisma.technicianSpecialization.createMany({
      data: params.specializationIds.map((specializationId) => ({
        userId: params.userId,
        specializationId,
      })),
      skipDuplicates: true,
    })
  }
}

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
      `[seed-stage-gaps] ticket number ${ticketNumber} is already used by non-gap ticket ${existing.id}`,
    )
  }
}

export async function seedCanceledTicket(
  prisma: PrismaClient,
  params: {
    mainClientCompanyId: string
    locationId: string
    categoryId: string
    createdByUserId: string
  },
) {
  const ticketId = GAP_IDS.ticket.canceled
  const ticketNumber = STAGE_QA_GAP_FIXTURES.canceledTicketNumber
  const createdAt = new Date('2026-08-20T09:00:00.000Z')
  const canceledAt = addMinutes(createdAt, 30)

  await assertTicketNumberAvailable(prisma, ticketId, ticketNumber)

  await prisma.$transaction([
    prisma.assignmentDecision.deleteMany({ where: { ticketId } }),
    prisma.ticketAttachment.deleteMany({ where: { ticketId } }),
    prisma.ticketStatusHistory.deleteMany({ where: { ticketId } }),
    prisma.domainEvent.deleteMany({
      where: { entityType: 'Ticket', entityId: ticketId },
    }),
  ])

  await prisma.ticket.upsert({
    where: { id: ticketId },
    update: {
      ticketNumber,
      companyId: params.mainClientCompanyId,
      locationId: params.locationId,
      problemCategoryId: params.categoryId,
      problemText: 'CANCELED — client canceled before assignment',
      requesterName: 'Stage QA Client Admin',
      requesterPhone: '+7 900 000-00-00',
      source: TicketSource.INTERNAL,
      urgency: TicketUrgency.NOT_URGENT,
      priority: TicketPriority.NORMAL,
      status: TicketStatus.CANCELED,
      assignedTechnicianId: null,
      createdByUserId: params.createdByUserId,
      slaMinutes: 240,
      slaDueAt: addMinutes(createdAt, 240),
      slaBreachedAt: null,
      statusUpdatedAt: canceledAt,
      closedAt: canceledAt,
    },
    create: {
      id: ticketId,
      ticketNumber,
      companyId: params.mainClientCompanyId,
      locationId: params.locationId,
      problemCategoryId: params.categoryId,
      problemText: 'CANCELED — client canceled before assignment',
      requesterName: 'Stage QA Client Admin',
      requesterPhone: '+7 900 000-00-00',
      source: TicketSource.INTERNAL,
      urgency: TicketUrgency.NOT_URGENT,
      priority: TicketPriority.NORMAL,
      status: TicketStatus.CANCELED,
      assignedTechnicianId: null,
      createdByUserId: params.createdByUserId,
      slaMinutes: 240,
      slaDueAt: addMinutes(createdAt, 240),
      slaBreachedAt: null,
      statusUpdatedAt: canceledAt,
      closedAt: canceledAt,
      createdAt,
    },
  })

  await prisma.ticketStatusHistory.createMany({
    data: [
      {
        ticketId,
        fromStatus: null,
        toStatus: TicketStatus.NEW,
        changedByUserId: params.createdByUserId,
        comment: 'Stage gap fixture CANCELED created',
        createdAt,
      },
      {
        ticketId,
        fromStatus: TicketStatus.NEW,
        toStatus: TicketStatus.CANCELED,
        changedByUserId: params.createdByUserId,
        comment: 'Stage gap fixture canceled by client',
        createdAt: canceledAt,
      },
    ],
  })

  await prisma.domainEvent.createMany({
    data: [
      {
        companyId: params.mainClientCompanyId,
        entityType: 'Ticket',
        entityId: ticketId,
        type: 'ticket.created',
        actorUserId: params.createdByUserId,
        payload: {
          fixtureKey: 'CANCELED',
          purpose: 'Canceled ticket visibility and lifecycle fixture',
          status: TicketStatus.NEW,
        },
        createdAt,
      },
      {
        companyId: params.mainClientCompanyId,
        entityType: 'Ticket',
        entityId: ticketId,
        type: 'ticket.status_changed',
        actorUserId: params.createdByUserId,
        payload: {
          fromStatus: TicketStatus.NEW,
          toStatus: TicketStatus.CANCELED,
          comment: 'Stage gap fixture canceled by client',
        },
        createdAt: canceledAt,
      },
    ],
  })

  return ticketId
}

export async function seedForeignTicket(
  prisma: PrismaClient,
  params: {
    foreignClientCompanyId: string
    locationId: string
    categoryId: string
    createdByUserId: string
  },
) {
  const ticketId = GAP_IDS.ticket.foreign
  const ticketNumber = STAGE_QA_GAP_FIXTURES.foreignTicketNumber
  const createdAt = new Date('2026-08-20T09:10:00.000Z')

  await assertTicketNumberAvailable(prisma, ticketId, ticketNumber)

  await prisma.$transaction([
    prisma.assignmentDecision.deleteMany({ where: { ticketId } }),
    prisma.ticketAttachment.deleteMany({ where: { ticketId } }),
    prisma.ticketStatusHistory.deleteMany({ where: { ticketId } }),
    prisma.domainEvent.deleteMany({
      where: { entityType: 'Ticket', entityId: ticketId },
    }),
  ])

  await prisma.ticket.upsert({
    where: { id: ticketId },
    update: {
      ticketNumber,
      companyId: params.foreignClientCompanyId,
      locationId: params.locationId,
      problemCategoryId: params.categoryId,
      problemText: 'FOREIGN — other CLIENT tenant isolation',
      requesterName: 'Stage Foreign Client Admin',
      requesterPhone: '+7 900 000-00-11',
      source: TicketSource.INTERNAL,
      urgency: TicketUrgency.NOT_URGENT,
      priority: TicketPriority.NORMAL,
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      createdByUserId: params.createdByUserId,
      slaMinutes: 240,
      slaDueAt: addMinutes(createdAt, 240),
      slaBreachedAt: null,
      statusUpdatedAt: createdAt,
      closedAt: null,
    },
    create: {
      id: ticketId,
      ticketNumber,
      companyId: params.foreignClientCompanyId,
      locationId: params.locationId,
      problemCategoryId: params.categoryId,
      problemText: 'FOREIGN — other CLIENT tenant isolation',
      requesterName: 'Stage Foreign Client Admin',
      requesterPhone: '+7 900 000-00-11',
      source: TicketSource.INTERNAL,
      urgency: TicketUrgency.NOT_URGENT,
      priority: TicketPriority.NORMAL,
      status: TicketStatus.NEW,
      assignedTechnicianId: null,
      createdByUserId: params.createdByUserId,
      slaMinutes: 240,
      slaDueAt: addMinutes(createdAt, 240),
      slaBreachedAt: null,
      statusUpdatedAt: createdAt,
      closedAt: null,
      createdAt,
    },
  })

  await prisma.ticketStatusHistory.create({
    data: {
      ticketId,
      fromStatus: null,
      toStatus: TicketStatus.NEW,
      changedByUserId: params.createdByUserId,
      comment: 'Stage gap fixture FOREIGN created',
      createdAt,
    },
  })

  await prisma.domainEvent.create({
    data: {
      companyId: params.foreignClientCompanyId,
      entityType: 'Ticket',
      entityId: ticketId,
      type: 'ticket.created',
      actorUserId: params.createdByUserId,
      payload: {
        fixtureKey: 'FOREIGN',
        purpose: 'Foreign CLIENT isolation negative fixture',
        status: TicketStatus.NEW,
      },
      createdAt,
    },
  })

  return ticketId
}

export async function ensureMaxUserBinding(
  prisma: PrismaClient,
  params: {
    id: string
    userId: string
    companyId: string
    maxUserId: string
  },
) {
  const byMaxUser = await prisma.maxUserBinding.findUnique({
    where: { maxUserId: params.maxUserId },
    select: { id: true },
  })

  if (byMaxUser) {
    await prisma.maxUserBinding.update({
      where: { id: byMaxUser.id },
      data: {
        userId: params.userId,
        companyId: params.companyId,
        status: MaxUserBindingStatus.ACTIVE,
        maxChatId: null,
        lastVerifiedAt: new Date('2026-08-20T10:00:00.000Z'),
      },
    })
    return byMaxUser.id
  }

  const byId = await prisma.maxUserBinding.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (byId) {
    await prisma.maxUserBinding.update({
      where: { id: params.id },
      data: {
        userId: params.userId,
        companyId: params.companyId,
        maxUserId: params.maxUserId,
        status: MaxUserBindingStatus.ACTIVE,
        maxChatId: null,
        lastVerifiedAt: new Date('2026-08-20T10:00:00.000Z'),
      },
    })
    return params.id
  }

  const created = await prisma.maxUserBinding.create({
    data: {
      id: params.id,
      userId: params.userId,
      companyId: params.companyId,
      maxUserId: params.maxUserId,
      status: MaxUserBindingStatus.ACTIVE,
      maxChatId: null,
      lastVerifiedAt: new Date('2026-08-20T10:00:00.000Z'),
    },
    select: { id: true },
  })
  return created.id
}
