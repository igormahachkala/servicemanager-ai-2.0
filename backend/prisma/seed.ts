import { PrismaClient, UserRole } from '@prisma/client';

import { PERMISSIONS, type PermissionCode } from '../src/common/permissions.constants';

const prisma = new PrismaClient();

/**
 * Seed PBAC v1
 * - PermissionBlock: справочник блоков прав
 * - RolePermission: матрица прав по ролям (глобально, без companyId)
 *
 * Идемпотентно: upsert по уникальным ключам.
 */
async function main() {
  const blocks: Array<{ code: PermissionCode; name: string; description?: string }> = [
    // Tickets
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
      code: PERMISSIONS.TICKETS_CLAIM,
      name: 'Claim tickets',
      description: 'Claim available NEW ticket (assign to self)',
    },
    {
      code: PERMISSIONS.TICKETS_ASSIGN,
      name: 'Assign tickets',
      description: 'Assign ticket to technician',
    },
    {
      code: PERMISSIONS.TICKETS_STATUS_CHANGE,
      name: 'Change ticket status',
      description: 'Change ticket status',
    },

    // Override scope (per-user)
    {
      code: PERMISSIONS.TICKETS_VIEW_ALL_COMPANY,
      name: 'View all company tickets',
      description: 'Override: technician can view all tickets within company (enable per-user via UserPermission)',
    },

    // Analytics
    {
      code: PERMISSIONS.ANALYTICS_VIEW,
      name: 'View analytics',
      description: 'Access analytics dashboards',
    },

    // Users / Company
    {
      code: PERMISSIONS.USERS_MANAGE,
      name: 'Manage users',
      description: 'Create/update users',
    },
    {
      code: PERMISSIONS.COMPANY_SETTINGS_EDIT,
      name: 'Edit company settings',
      description: 'Edit company settings like auto-assign',
    },
  ];

  // 1) Upsert PermissionBlock
  for (const b of blocks) {
    await prisma.permissionBlock.upsert({
      where: { code: b.code },
      update: {
        name: b.name,
        description: b.description ?? null,
      },
      create: {
        code: b.code,
        name: b.name,
        description: b.description ?? null,
      },
    });
  }

  const codeToId = new Map<string, string>();
  const allBlocks = await prisma.permissionBlock.findMany({ select: { id: true, code: true } });
  for (const b of allBlocks) codeToId.set(b.code, b.id);

  // 2) Матрица прав по ролям (MVP)
  // Важно: TECHNICIAN по умолчанию НЕ получает TICKETS_VIEW_ALL_COMPANY — это включается точечно через UserPermission (тумблер).
  const matrix: Record<UserRole, PermissionCode[]> = {
    ADMIN: [
      PERMISSIONS.TICKETS_CREATE,
      PERMISSIONS.TICKETS_VIEW,
      PERMISSIONS.TICKETS_ASSIGN,
      PERMISSIONS.TICKETS_STATUS_CHANGE,
      PERMISSIONS.ANALYTICS_VIEW,
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.COMPANY_SETTINGS_EDIT,
    ],
    MASTER: [
      PERMISSIONS.TICKETS_CREATE,
      PERMISSIONS.TICKETS_VIEW,
      PERMISSIONS.TICKETS_ASSIGN,
      PERMISSIONS.TICKETS_STATUS_CHANGE,
      PERMISSIONS.ANALYTICS_VIEW,
    ],
    DISPATCHER: [
      PERMISSIONS.TICKETS_CREATE,
      PERMISSIONS.TICKETS_VIEW,
      PERMISSIONS.TICKETS_ASSIGN,
      PERMISSIONS.TICKETS_STATUS_CHANGE,
    ],
    NETWORK_DIRECTOR: [
      PERMISSIONS.TICKETS_VIEW,
      PERMISSIONS.TICKETS_STATUS_CHANGE,
      PERMISSIONS.ANALYTICS_VIEW,
    ],
    TECHNICIAN: [
      PERMISSIONS.TICKETS_VIEW,
      PERMISSIONS.TICKETS_VIEW_AVAILABLE,
      PERMISSIONS.TICKETS_CLAIM,
      PERMISSIONS.TICKETS_STATUS_CHANGE,
    ],
    CLIENT: [],
    TERRITORIAL_MANAGER: [],
    STAFF: [],
  };

  // 3) Upsert RolePermission (по уникальному (role, permissionBlockId))
  for (const role of Object.keys(matrix) as UserRole[]) {
    for (const code of matrix[role]) {
      const permissionBlockId = codeToId.get(code);
      if (!permissionBlockId) continue;

      await prisma.rolePermission.upsert({
        where: {
          role_permissionBlockId: {
            role,
            permissionBlockId,
          },
        },
        update: {},
        create: {
          role,
          permissionBlockId,
        },
      });
    }
  }

  const totalBlocks = await prisma.permissionBlock.count();
  const totalRolePerms = await prisma.rolePermission.count();

  console.log(`[seed] PermissionBlock: ${totalBlocks}`);
  console.log(`[seed] RolePermission: ${totalRolePerms}`);
}

main()
  .catch((e) => {
    console.error('[seed] failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
