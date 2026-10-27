import {
  CompanyType,
  PrismaClient,
  ServiceContractLocationMode,
  ServiceContractRole,
  ServiceContractStatus,
  UserAccessLocationMode,
  UserRole,
} from '@prisma/client'

import { PERMISSION_BLOCKS, ROLE_GRANTS } from '../../src/common/permissions-matrix'
import { CANONICAL_STAGE_SEED } from './plan'
import {
  CanonicalCategory,
  CanonicalCompany,
  CanonicalLocation,
  CanonicalSpecialization,
  CanonicalUser,
  CompanyKey,
  LocationKey,
  ResolvedSeedIds,
  UserKey,
} from './types'
import { lowerEmail } from './utils'

export async function seedPermissions(prisma: PrismaClient) {
  for (const block of PERMISSION_BLOCKS) {
    await prisma.permissionBlock.upsert({
      where: { code: block.code },
      update: { name: block.name, description: block.description ?? null },
      create: {
        code: block.code,
        name: block.name,
        description: block.description ?? null,
      },
    })
  }

  const blocks = await prisma.permissionBlock.findMany({
    select: { id: true, code: true },
  })
  const codeToId = new Map(blocks.map((block) => [block.code, block.id]))

  const rows: Array<{
    role: UserRole
    companyType: CompanyType | null
    permissionBlockId: string
  }> = []
  for (const grant of ROLE_GRANTS) {
    for (const code of grant.codes) {
      const permissionBlockId = codeToId.get(code)
      if (!permissionBlockId) {
        throw new Error(`[seed-stage-canonical] missing PermissionBlock for ${code}`)
      }
      rows.push({
        role: grant.role,
        companyType: grant.companyType,
        permissionBlockId,
      })
    }
  }

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({}),
    prisma.rolePermission.createMany({ data: rows, skipDuplicates: true }),
  ])
}

export async function ensureCompany(prisma: PrismaClient, row: CanonicalCompany) {
  const existingById = await prisma.company.findUnique({
    where: { id: row.id },
    select: { id: true },
  })
  const existing =
    existingById ??
    (await prisma.company.findFirst({
      where: { name: row.name },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }))

  if (existing) {
    const updated = await prisma.company.update({
      where: { id: existing.id },
      data: {
        name: row.name,
        type: row.type,
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
      id: row.id,
      name: row.name,
      type: row.type,
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
  row: CanonicalUser,
  companyId: string,
  passwordHash: string,
) {
  const email = lowerEmail(row.email)
  const existingByEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  const existing =
    existingByEmail ??
    (await prisma.user.findUnique({
      where: { id: row.id },
      select: { id: true },
    }))

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        email,
        password: passwordHash,
        firstName: row.firstName,
        lastName: row.lastName,
        role: row.role,
        companyId,
        isExecutor: row.isExecutor,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    })
    return updated.id
  }

  const created = await prisma.user.create({
    data: {
      id: row.id,
      email,
      password: passwordHash,
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role,
      companyId,
      isExecutor: row.isExecutor,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true },
  })
  return created.id
}

export async function ensureLocation(
  prisma: PrismaClient,
  row: CanonicalLocation,
  clientCompanyId: string,
) {
  const location = await prisma.location.upsert({
    where: {
      clientCompanyId_platformCode: {
        clientCompanyId,
        platformCode: row.platformCode,
      },
    },
    update: {
      name: row.name,
      city: row.city,
      address: row.address,
      isActive: true,
      deletedAt: null,
    },
    create: {
      id: row.id,
      clientCompanyId,
      platformCode: row.platformCode,
      name: row.name,
      city: row.city,
      address: row.address,
      isActive: true,
    },
    select: { id: true },
  })
  return location.id
}

export async function ensureSpecialization(
  prisma: PrismaClient,
  row: CanonicalSpecialization,
  companyId: string,
) {
  const existing =
    (await prisma.specialization.findFirst({
      where: { id: row.id },
      select: { id: true },
    })) ??
    (await prisma.specialization.findFirst({
      where: { companyId, name: row.name },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }))

  if (existing) {
    const updated = await prisma.specialization.update({
      where: { id: existing.id },
      data: { companyId, name: row.name, isActive: true },
      select: { id: true },
    })
    return updated.id
  }

  const created = await prisma.specialization.create({
    data: { id: row.id, companyId, name: row.name, isActive: true },
    select: { id: true },
  })
  return created.id
}

export async function ensureCategory(
  prisma: PrismaClient,
  row: CanonicalCategory,
  companyId: string,
  specializationId: string,
) {
  const category = await prisma.problemCategory.upsert({
    where: { companyId_name: { companyId, name: row.name } },
    update: { isActive: true, instructions: `Canonical Stage QA fixture: ${row.key}` },
    create: {
      id: row.id,
      companyId,
      name: row.name,
      instructions: `Canonical Stage QA fixture: ${row.key}`,
      isActive: true,
    },
    select: { id: true },
  })

  await prisma.problemCategorySpecialization.deleteMany({
    where: { problemCategoryId: category.id },
  })
  await prisma.problemCategorySpecialization.create({
    data: { problemCategoryId: category.id, specializationId },
  })

  return category.id
}

export async function ensureServiceContract(
  prisma: PrismaClient,
  params: {
    clientCompanyId: string
    providerCompanyId: string
    role: ServiceContractRole
    locationIds: string[]
    specializationIds: string[]
  },
) {
  const contract = await prisma.serviceContract.upsert({
    where: {
      clientCompanyId_providerCompanyId: {
        clientCompanyId: params.clientCompanyId,
        providerCompanyId: params.providerCompanyId,
      },
    },
    update: {
      status: ServiceContractStatus.ACTIVE,
      role: params.role,
      locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
      startsAt: null,
      endsAt: null,
      notes: `Canonical Stage ${params.role} contract context fixture`,
    },
    create: {
      clientCompanyId: params.clientCompanyId,
      providerCompanyId: params.providerCompanyId,
      status: ServiceContractStatus.ACTIVE,
      role: params.role,
      locationMode: ServiceContractLocationMode.SELECTED_LOCATIONS,
      startsAt: null,
      endsAt: null,
      notes: `Canonical Stage ${params.role} contract context fixture`,
    },
    select: { id: true },
  })

  await prisma.serviceContractLocation.deleteMany({
    where: {
      serviceContractId: contract.id,
      locationId: { notIn: params.locationIds },
    },
  })
  await prisma.serviceContractLocation.createMany({
    data: params.locationIds.map((locationId) => ({
      serviceContractId: contract.id,
      clientCompanyId: params.clientCompanyId,
      locationId,
    })),
    skipDuplicates: true,
  })

  await prisma.serviceContractSpecialization.deleteMany({
    where: {
      serviceContractId: contract.id,
      specializationId: { notIn: params.specializationIds },
    },
  })
  await prisma.serviceContractSpecialization.createMany({
    data: params.specializationIds.map((specializationId) => ({
      serviceContractId: contract.id,
      specializationId,
    })),
    skipDuplicates: true,
  })

  return contract.id
}

export async function resetCanonicalUserScopes(prisma: PrismaClient, ids: ResolvedSeedIds) {
  const userIds = Object.values(ids.users)
  await prisma.$transaction([
    prisma.userLocationBinding.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.technicianSpecialization.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.userAccessScope.deleteMany({ where: { userId: { in: userIds } } }),
  ])

  const scopeRows = CANONICAL_STAGE_SEED.userScopes.map((scope) => {
    const user = CANONICAL_STAGE_SEED.users.find((row) => row.key === scope.userKey)!
    return {
      userId: ids.users[scope.userKey],
      companyId: ids.companies[user.companyKey],
      locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
    }
  })

  await prisma.userAccessScope.createMany({
    data: scopeRows,
    skipDuplicates: true,
  })

  const locationRows = CANONICAL_STAGE_SEED.userScopes.flatMap((scope) => {
    const user = CANONICAL_STAGE_SEED.users.find((row) => row.key === scope.userKey)!
    return scope.locationKeys.map((locationKey) => ({
      userId: ids.users[scope.userKey],
      companyId: ids.companies[user.companyKey],
      locationId: ids.locations[locationKey],
    }))
  })

  await prisma.userLocationBinding.createMany({
    data: locationRows,
    skipDuplicates: true,
  })

  const specializationRows = CANONICAL_STAGE_SEED.userScopes.flatMap((scope) =>
    scope.specializationKeys.map((specializationKey) => ({
      userId: ids.users[scope.userKey],
      specializationId: ids.specializations[specializationKey],
    })),
  )

  await prisma.technicianSpecialization.createMany({
    data: specializationRows,
    skipDuplicates: true,
  })
}

export async function ensureTechnicianClientBindings(prisma: PrismaClient, ids: ResolvedSeedIds) {
  const rows = [
    {
      providerCompanyKey: 'primaryProvider' as CompanyKey,
      technicianUserKey: 'primaryTechnician' as UserKey,
      locationKey: 'primary' as LocationKey,
    },
    {
      providerCompanyKey: 'secondaryProvider' as CompanyKey,
      technicianUserKey: 'secondaryTechnician' as UserKey,
      locationKey: 'secondary' as LocationKey,
    },
    {
      providerCompanyKey: 'secondaryProvider' as CompanyKey,
      technicianUserKey: 'mobileTechnician' as UserKey,
      locationKey: 'secondary' as LocationKey,
    },
  ]

  await prisma.technicianClientBinding.deleteMany({
    where: {
      technicianUserId: { in: rows.map((row) => ids.users[row.technicianUserKey]) },
      clientCompanyId: ids.companies.client,
    },
  })

  await prisma.technicianClientBinding.createMany({
    data: rows.map((row, index) => ({
      id: `70000000-0000-4000-8000-00000000100${index + 1}`,
      providerCompanyId: ids.companies[row.providerCompanyKey],
      technicianUserId: ids.users[row.technicianUserKey],
      clientCompanyId: ids.companies.client,
      locationId: ids.locations[row.locationKey],
    })),
    skipDuplicates: true,
  })
}

export async function seedPushPreferences(prisma: PrismaClient, userIds: string[]) {
  for (const userId of userIds) {
    await prisma.pushPreference.upsert({
      where: { userId },
      update: {
        chat: true,
        ticketNew: true,
        assignment: true,
        statusChange: true,
        acceptance: true,
        acceptanceReject: true,
        sla: true,
      },
      create: {
        userId,
        chat: true,
        ticketNew: true,
        assignment: true,
        statusChange: true,
        acceptance: true,
        acceptanceReject: true,
        sla: true,
      },
    })
  }
}
