import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed PBAC v1
 * - PermissionBlock: справочник блоков прав
 * - RolePermission: матрица прав по ролям (глобально, без companyId)
 *
 * Идемпотентно: upsert по уникальным ключам.
 */
async function main() {
  const blocks: Array<{ code: string; name: string; description?: string }> = [
    // Tickets
    { code: 'TICKETS_CREATE', name: 'Create tickets', description: 'Create tickets and child tickets' },
    { code: 'TICKETS_VIEW', name: 'View tickets', description: 'View tickets list and single ticket' },
    { code: 'TICKETS_VIEW_AVAILABLE', name: 'View available tickets', description: 'View available NEW tickets for technician' },
    { code: 'TICKETS_CLAIM', name: 'Claim tickets', description: 'Claim available NEW ticket (assign to self)' },
    { code: 'TICKETS_ASSIGN', name: 'Assign tickets', description: 'Assign ticket to technician' },
    { code: 'TICKETS_STATUS_CHANGE', name: 'Change ticket status', description: 'Change ticket status' },

    // Future-friendly базовые
    { code: 'ANALYTICS_VIEW', name: 'View analytics', description: 'Access analytics dashboards' },
    { code: 'USERS_MANAGE', name: 'Manage users', description: 'Create/update users' },
    { code: 'COMPANY_SETTINGS_EDIT', name: 'Edit company settings', description: 'Edit company settings like auto-assign' },
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

  // 2) Матрица прав по ролям (MVP: максимально близко к текущей role-модели)
  // Важно: TECHNICIAN видит только свои в service (scope), но permission на чтение нужен чтобы пройти guard.
  const matrix: Record<UserRole, string[]> = {
    ADMIN: [
      'TICKETS_CREATE',
      'TICKETS_VIEW',
      'TICKETS_ASSIGN',
      'TICKETS_STATUS_CHANGE',
      'ANALYTICS_VIEW',
      'USERS_MANAGE',
      'COMPANY_SETTINGS_EDIT',
    ],
    MASTER: [
      'TICKETS_CREATE',
      'TICKETS_VIEW',
      'TICKETS_ASSIGN',
      'TICKETS_STATUS_CHANGE',
      'ANALYTICS_VIEW',
    ],
    DISPATCHER: [
      'TICKETS_CREATE',
      'TICKETS_VIEW',
      'TICKETS_ASSIGN',
      'TICKETS_STATUS_CHANGE',
    ],
    NETWORK_DIRECTOR: [
      'TICKETS_VIEW',
      'TICKETS_STATUS_CHANGE',
      'ANALYTICS_VIEW',
    ],
    TECHNICIAN: [
      'TICKETS_VIEW',
      'TICKETS_VIEW_AVAILABLE',
      'TICKETS_CLAIM',
      'TICKETS_STATUS_CHANGE',
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

  // Не удаляем лишние RolePermission специально (чтобы не снести enterprise кастомизацию).
  // Если нужно будет “синхронизировать строго” — сделаем отдельную admin-команду.

  // Итоговая инфа
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
