import { PrismaClient, UserRole } from '@prisma/client'

import { PERMISSIONS, type PermissionCode } from '../src/common/permissions.constants'

type CanonicalPermission = {
  code: PermissionCode
  name: string
  description: string
}

type RoleMatrix = Record<UserRole, PermissionCode[]>

const prisma = new PrismaClient()

const canonicalPermissions: CanonicalPermission[] = [
  {
    code: PERMISSIONS.TICKETS_CREATE,
    name: 'Create tickets',
    description: 'Create tickets and child tickets',
  },
  {
    code: PERMISSIONS.TICKETS_VIEW,
    name: 'View tickets',
    description: 'View tickets list and single ticket',
  },
  {
    code: PERMISSIONS.TICKETS_VIEW_AVAILABLE,
    name: 'View available tickets',
    description: 'View available NEW tickets for technician',
  },
  {
    code: PERMISSIONS.TICKETS_EDIT,
    name: 'Edit tickets',
    description: 'Edit ticket fields in allowed scope',
  },
  {
    code: PERMISSIONS.TICKETS_ASSIGN,
    name: 'Assign tickets',
    description: 'Assign ticket to technician',
  },
  {
    code: PERMISSIONS.TICKETS_CLAIM,
    name: 'Claim tickets',
    description: 'Claim available NEW ticket (assign to self)',
  },
  {
    code: PERMISSIONS.TICKETS_STATUS_CHANGE,
    name: 'Change ticket status',
    description: 'Change ticket status',
  },
  {
    code: PERMISSIONS.TICKETS_VIEW_ALL_COMPANY,
    name: 'View all company tickets',
    description: 'Override: technician can view all tickets within company (enable per-user via UserPermission)',
  },
  {
    code: PERMISSIONS.ANALYTICS_VIEW,
    name: 'View analytics',
    description: 'Access analytics dashboards',
  },
  {
    code: PERMISSIONS.USERS_MANAGE,
    name: 'Manage users',
    description: 'Create/update users and user-level overrides',
  },
  {
    code: PERMISSIONS.COMPANY_SETTINGS_EDIT,
    name: 'Edit company settings',
    description: 'Edit company settings like auto-assign',
  },
  {
    code: PERMISSIONS.LOCATIONS_VIEW,
    name: 'View locations',
    description: 'View locations list and single location',
  },
  {
    code: PERMISSIONS.LOCATIONS_MANAGE,
    name: 'Manage locations',
    description: 'Create/update locations and change their status',
  },
]

const allPermissionCodes = canonicalPermissions.map((item) => item.code)

const roleMatrix: RoleMatrix = {
  PLATFORM_ADMIN: [...allPermissionCodes],
  ADMIN: [
    PERMISSIONS.TICKETS_CREATE,
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.TICKETS_EDIT,
    PERMISSIONS.TICKETS_ASSIGN,
    PERMISSIONS.TICKETS_STATUS_CHANGE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.COMPANY_SETTINGS_EDIT,
    PERMISSIONS.LOCATIONS_VIEW,
    PERMISSIONS.LOCATIONS_MANAGE,
  ],
  DISPATCHER: [
    PERMISSIONS.TICKETS_CREATE,
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.TICKETS_EDIT,
    PERMISSIONS.TICKETS_ASSIGN,
    PERMISSIONS.TICKETS_STATUS_CHANGE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.LOCATIONS_VIEW,
  ],
  MASTER: [
    PERMISSIONS.TICKETS_CREATE,
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.TICKETS_EDIT,
    PERMISSIONS.TICKETS_ASSIGN,
    PERMISSIONS.TICKETS_STATUS_CHANGE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.LOCATIONS_VIEW,
    PERMISSIONS.LOCATIONS_MANAGE,
  ],
  TECHNICIAN: [
    PERMISSIONS.TICKETS_CREATE,
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.TICKETS_VIEW_AVAILABLE,
    PERMISSIONS.TICKETS_CLAIM,
    PERMISSIONS.TICKETS_STATUS_CHANGE,
    PERMISSIONS.LOCATIONS_VIEW,
  ],
  CLIENT: [
    PERMISSIONS.TICKETS_CREATE,
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.TICKETS_EDIT,
    PERMISSIONS.LOCATIONS_VIEW,
  ],
  TERRITORIAL_MANAGER: [
    PERMISSIONS.TICKETS_CREATE,
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.TICKETS_EDIT,
    PERMISSIONS.LOCATIONS_VIEW,
  ],
  NETWORK_DIRECTOR: [
    PERMISSIONS.TICKETS_CREATE,
    PERMISSIONS.TICKETS_VIEW,
    PERMISSIONS.TICKETS_EDIT,
    PERMISSIONS.TICKETS_STATUS_CHANGE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.LOCATIONS_VIEW,
  ],
  STAFF: [],
}

function normalizeCodes(input: string[]) {
  return Array.from(new Set(input.map((value) => value.trim()).filter(Boolean))).sort()
}

async function upsertPermissionBlocks(apply: boolean) {
  const existing = await prisma.permissionBlock.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
    },
  })

  const existingByCode = new Map(existing.map((row) => [row.code, row]))
  const missingCodes: string[] = []
  const canonicalChanged: string[] = []

  for (const block of canonicalPermissions) {
    const current = existingByCode.get(block.code)
    if (!current) {
      missingCodes.push(block.code)
      if (apply) {
        await prisma.permissionBlock.create({
          data: {
            code: block.code,
            name: block.name,
            description: block.description,
          },
        })
      }
      continue
    }

    const needsUpdate = current.name !== block.name || (current.description || '') !== block.description
    if (needsUpdate) {
      canonicalChanged.push(block.code)
      if (apply) {
        await prisma.permissionBlock.update({
          where: { id: current.id },
          data: {
            name: block.name,
            description: block.description,
          },
        })
      }
    }
  }

  const unknownExtraCodes = existing
    .map((row) => row.code)
    .filter((code) => !allPermissionCodes.includes(code as PermissionCode))
    .sort()

  return {
    missingCodes: normalizeCodes(missingCodes),
    canonicalChanged: normalizeCodes(canonicalChanged),
    unknownExtraCodes,
  }
}

async function syncRolePermissions(apply: boolean) {
  const blocks = await prisma.permissionBlock.findMany({
    select: {
      id: true,
      code: true,
    },
  })
  const codeToId = new Map(blocks.map((row) => [row.code, row.id]))

  const allRoles = Object.keys(roleMatrix) as UserRole[]

  const existing = await prisma.rolePermission.findMany({
    where: { role: { in: allRoles } },
    select: {
      role: true,
      permissionBlock: {
        select: {
          code: true,
        },
      },
    },
  })

  const existingPairs = new Set(existing.map((row) => `${row.role}|${row.permissionBlock.code}`))
  const missingPairs: Array<{ role: UserRole; code: PermissionCode; permissionBlockId: string }> = []

  for (const role of allRoles) {
    for (const code of roleMatrix[role]) {
      const key = `${role}|${code}`
      if (existingPairs.has(key)) continue
      const permissionBlockId = codeToId.get(code)
      if (!permissionBlockId) continue
      missingPairs.push({ role, code, permissionBlockId })
    }
  }

  if (apply && missingPairs.length > 0) {
    await prisma.rolePermission.createMany({
      data: missingPairs.map((row) => ({
        role: row.role,
        permissionBlockId: row.permissionBlockId,
      })),
      skipDuplicates: true,
    })
  }

  const roleCoverage: Record<string, string[]> = {}
  for (const role of allRoles) {
    roleCoverage[role] = normalizeCodes(roleMatrix[role])
  }

  return {
    missingPairs: missingPairs.map((row) => `${row.role}|${row.code}`).sort(),
    roleCoverage,
  }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const mode = apply ? 'apply' : 'report'

  console.log(`[pbac-freeze] mode=${mode}`)

  const beforeBlockCount = await prisma.permissionBlock.count()
  const beforeRolePermissionCount = await prisma.rolePermission.count()
  const beforeUserPermissionCount = await prisma.userPermission.count()

  const blockResult = await upsertPermissionBlocks(apply)
  const roleResult = await syncRolePermissions(apply)

  const afterBlockCount = await prisma.permissionBlock.count()
  const afterRolePermissionCount = await prisma.rolePermission.count()
  const afterUserPermissionCount = await prisma.userPermission.count()

  const requiredLocationCodes = await prisma.permissionBlock.findMany({
    where: { code: { in: [PERMISSIONS.LOCATIONS_VIEW, PERMISSIONS.LOCATIONS_MANAGE] } },
    select: { code: true },
    orderBy: { code: 'asc' },
  })

  const output = {
    mode,
    expectedPermissionCodes: allPermissionCodes,
    before: {
      permissionBlockCount: beforeBlockCount,
      rolePermissionCount: beforeRolePermissionCount,
      userPermissionCount: beforeUserPermissionCount,
    },
    changes: {
      missingPermissionBlocks: blockResult.missingCodes,
      canonicalPermissionMetadataChanged: blockResult.canonicalChanged,
      extraUnknownPermissionBlocks: blockResult.unknownExtraCodes,
      missingRolePermissions: roleResult.missingPairs,
    },
    after: {
      permissionBlockCount: afterBlockCount,
      rolePermissionCount: afterRolePermissionCount,
      userPermissionCount: afterUserPermissionCount,
      locationPermissionCodesPresent: requiredLocationCodes.map((row) => row.code),
    },
    roleMatrix: roleResult.roleCoverage,
    safety: {
      deletesPerformed: false,
      userPermissionOverridesChanged: false,
      idempotent: true,
    },
  }

  console.log(JSON.stringify(output, null, 2))
}

main()
  .catch((error) => {
    console.error('[pbac-freeze] failed', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
