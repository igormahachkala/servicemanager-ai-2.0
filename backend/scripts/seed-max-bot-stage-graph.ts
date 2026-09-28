import {
  CompanyType,
  PrismaClient,
  ServiceContractLocationMode,
  ServiceContractRole,
  ServiceContractStatus,
  UserAccessLocationMode,
} from '@prisma/client'

import {
  MAX_BOT_STAGE_IDS,
  MAX_BOT_STAGE_MASTER_MENU_KEYS,
  MAX_BOT_STAGE_TECH_KEYS,
  MAX_BOT_STAGE_TIMEZONE,
  MAX_BOT_STAGE_USERS,
  maxBotStageTemplateItemTitles,
  MaxBotStageUserKey,
} from './seed-max-bot-stage-plan'

const PLATFORM_CODE = 'MAX-BOT-SITE'

export type MaxBotStageIds = {
  clientCompanyId: string
  providerCompanyId: string
  locationId: string
  categoryId: string
  specializationId: string
  contractId: string
  templateId: string
  users: Record<MaxBotStageUserKey, string>
}

export async function ensureMaxBotStageGraph(prisma: PrismaClient, passwordHash: string): Promise<MaxBotStageIds> {
  const clientCompanyId = await upsertCompany(prisma, {
    id: MAX_BOT_STAGE_IDS.clientCompany,
    name: 'Макс-бот клиент',
    type: CompanyType.CLIENT,
    timezone: null,
  })
  const providerCompanyId = await upsertCompany(prisma, {
    id: MAX_BOT_STAGE_IDS.providerCompany,
    name: 'Макс-бот подрядчик',
    type: CompanyType.PROVIDER,
    timezone: MAX_BOT_STAGE_TIMEZONE,
  })
  const locationId = await upsertLocation(prisma, clientCompanyId)
  const categoryId = await upsertCategory(prisma, clientCompanyId)
  const specializationId = await upsertSpecialization(prisma, clientCompanyId)
  const contractId = await upsertContract(prisma, clientCompanyId, providerCompanyId, locationId, specializationId)
  const users = await upsertUsers(prisma, providerCompanyId, passwordHash)
  await upsertBindings(prisma, {
    clientCompanyId,
    providerCompanyId,
    locationId,
    users,
  })
  const templateId = await upsertTemplate(prisma, providerCompanyId)
  return {
    clientCompanyId,
    providerCompanyId,
    locationId,
    categoryId,
    specializationId,
    contractId,
    templateId,
    users,
  }
}

async function upsertCompany(
  prisma: PrismaClient,
  row: { id: string; name: string; type: CompanyType; timezone: string | null },
) {
  const saved = await prisma.company.upsert({
    where: { id: row.id },
    update: {
      name: row.name,
      type: row.type,
      timezone: row.timezone,
      allowTechnicianClaim: true,
      autoAssignEnabled: false,
      requireActiveShiftForWork: false,
      shiftAutoCloseTime: '23:59',
    },
    create: {
      id: row.id,
      name: row.name,
      type: row.type,
      timezone: row.timezone,
      allowTechnicianClaim: true,
      autoAssignEnabled: false,
      requireActiveShiftForWork: false,
      shiftAutoCloseTime: '23:59',
    },
    select: { id: true },
  })
  return saved.id
}

async function upsertLocation(prisma: PrismaClient, clientCompanyId: string) {
  const saved = await prisma.location.upsert({
    where: {
      clientCompanyId_platformCode: { clientCompanyId, platformCode: PLATFORM_CODE },
    },
    update: {
      name: 'Объект макс-бота',
      city: 'Новосибирск',
      address: 'Новосибирск, объект макс-бота, 1',
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: MAX_BOT_STAGE_IDS.location,
      clientCompanyId,
      platformCode: PLATFORM_CODE,
      name: 'Объект макс-бота',
      city: 'Новосибирск',
      address: 'Новосибирск, объект макс-бота, 1',
      isActive: true,
    },
    select: { id: true },
  })
  return saved.id
}

async function upsertCategory(prisma: PrismaClient, clientCompanyId: string) {
  const saved = await prisma.problemCategory.upsert({
    where: {
      companyId_name: { companyId: clientCompanyId, name: 'Макс-бот категория' },
    },
    update: { isActive: true },
    create: {
      id: MAX_BOT_STAGE_IDS.category,
      companyId: clientCompanyId,
      name: 'Макс-бот категория',
      isActive: true,
    },
    select: { id: true },
  })
  await prisma.problemCategorySpecialization.deleteMany({ where: { problemCategoryId: saved.id } })
  return saved.id
}

async function upsertSpecialization(prisma: PrismaClient, clientCompanyId: string) {
  const saved = await prisma.specialization.upsert({
    where: { id: MAX_BOT_STAGE_IDS.specialization },
    update: { name: 'Макс-бот специализация', companyId: clientCompanyId, isActive: true },
    create: {
      id: MAX_BOT_STAGE_IDS.specialization,
      companyId: clientCompanyId,
      name: 'Макс-бот специализация',
      isActive: true,
    },
    select: { id: true },
  })
  return saved.id
}

async function upsertContract(
  prisma: PrismaClient,
  clientCompanyId: string,
  providerCompanyId: string,
  locationId: string,
  specializationId: string,
) {
  const saved = await prisma.serviceContract.upsert({
    where: {
      clientCompanyId_providerCompanyId: { clientCompanyId, providerCompanyId },
    },
    update: {
      status: ServiceContractStatus.ACTIVE,
      role: ServiceContractRole.PRIMARY,
      locationMode: ServiceContractLocationMode.ALL_LOCATIONS,
      startsAt: null,
      endsAt: null,
    },
    create: {
      id: MAX_BOT_STAGE_IDS.contract,
      clientCompanyId,
      providerCompanyId,
      status: ServiceContractStatus.ACTIVE,
      role: ServiceContractRole.PRIMARY,
      locationMode: ServiceContractLocationMode.ALL_LOCATIONS,
    },
    select: { id: true },
  })
  await prisma.serviceContractLocation.upsert({
    where: {
      serviceContractId_locationId: { serviceContractId: saved.id, locationId },
    },
    update: { clientCompanyId },
    create: {
      serviceContractId: saved.id,
      clientCompanyId,
      locationId,
    },
  })
  await prisma.serviceContractSpecialization.upsert({
    where: {
      serviceContractId_specializationId: {
        serviceContractId: saved.id,
        specializationId,
      },
    },
    update: {},
    create: {
      serviceContractId: saved.id,
      specializationId,
    },
  })
  return saved.id
}

async function upsertUsers(prisma: PrismaClient, providerCompanyId: string, passwordHash: string) {
  const users = {} as Record<MaxBotStageUserKey, string>
  for (const row of MAX_BOT_STAGE_USERS) {
    const email = row.email.toLowerCase()
    const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (byEmail && byEmail.id !== row.id) {
      throw new Error(`[seed-max-bot-stage] email ${email} belongs to ${byEmail.id}`)
    }
    const saved = await prisma.user.upsert({
      where: { id: row.id },
      update: {
        email,
        password: passwordHash,
        firstName: row.firstName,
        lastName: row.lastName,
        role: row.role,
        companyId: providerCompanyId,
        isExecutor: row.isExecutor,
        isActive: true,
        deletedAt: null,
      },
      create: {
        id: row.id,
        email,
        password: passwordHash,
        firstName: row.firstName,
        lastName: row.lastName,
        role: row.role,
        companyId: providerCompanyId,
        isExecutor: row.isExecutor,
        isActive: true,
      },
      select: { id: true },
    })
    users[row.key] = saved.id
  }
  return users
}

async function upsertBindings(
  prisma: PrismaClient,
  params: {
    clientCompanyId: string
    providerCompanyId: string
    locationId: string
    users: Record<MaxBotStageUserKey, string>
  },
) {
  for (const key of MAX_BOT_STAGE_TECH_KEYS) {
    await prisma.technicianClientBinding.upsert({
      where: {
        technicianUserId_clientCompanyId_locationId: {
          technicianUserId: params.users[key],
          clientCompanyId: params.clientCompanyId,
          locationId: params.locationId,
        },
      },
      update: { providerCompanyId: params.providerCompanyId },
      create: {
        providerCompanyId: params.providerCompanyId,
        technicianUserId: params.users[key],
        clientCompanyId: params.clientCompanyId,
        locationId: params.locationId,
      },
    })
  }

  for (const key of MAX_BOT_STAGE_MASTER_MENU_KEYS) {
    const userId = params.users[key]
    await prisma.userAccessScope.upsert({
      where: { userId_companyId: { userId, companyId: params.providerCompanyId } },
      update: { locationMode: UserAccessLocationMode.SELECTED_LOCATIONS },
      create: {
        userId,
        companyId: params.providerCompanyId,
        locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      },
    })
    await prisma.userLocationBinding.upsert({
      where: { userId_locationId: { userId, locationId: params.locationId } },
      update: { companyId: params.providerCompanyId },
      create: {
        userId,
        locationId: params.locationId,
        companyId: params.providerCompanyId,
      },
    })
  }
}

async function upsertTemplate(prisma: PrismaClient, providerCompanyId: string) {
  const saved = await prisma.inspectionTemplate.upsert({
    where: {
      companyId_name: { companyId: providerCompanyId, name: 'Шаблон обхода макс-бота' },
    },
    update: { isActive: true },
    create: {
      id: MAX_BOT_STAGE_IDS.template,
      companyId: providerCompanyId,
      name: 'Шаблон обхода макс-бота',
      isActive: true,
    },
    select: { id: true },
  })
  const titles = maxBotStageTemplateItemTitles()
  for (const [index, title] of titles.entries()) {
    const id = `81000000-0000-4000-8000-0000000002${String(11 + index)}`
    await prisma.inspectionTemplateItem.upsert({
      where: { id },
      update: { templateId: saved.id, title, sortOrder: index + 1 },
      create: {
        id,
        templateId: saved.id,
        title,
        sortOrder: index + 1,
      },
    })
  }
  return saved.id
}

