// backend/scripts/rollback-permissions.ts
//
// Phase 1.5 — откат PBAC в режим совместимости.
// Удаляет все RolePermission, UserPermission и PermissionBlock.
// После этого PermissionBlock.count() === 0 → PermissionsGuard снова работает
// в fallback-режиме (только RolesGuard + scope), как до seed.
//
// Идемпотентно. Схему (колонку companyType) НЕ откатывает — она безвредна.
//
// Запуск: dotenv -e .env -- ts-node scripts/rollback-permissions.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  // Порядок: дочерние гранты раньше блоков (FK onDelete: Cascade всё равно покрыл бы,
  // но делаем явно и считаем удалённое).
  const rp = await prisma.rolePermission.deleteMany({});
  const up = await prisma.userPermission.deleteMany({});
  const pb = await prisma.permissionBlock.deleteMany({});

  console.log(`[rollback-permissions] RolePermission deleted: ${rp.count}`);
  console.log(`[rollback-permissions] UserPermission deleted: ${up.count}`);
  console.log(`[rollback-permissions] PermissionBlock deleted: ${pb.count}`);
  console.log('[rollback-permissions] PBAC disabled → fallback (RolesGuard) restored.');
}

run()
  .catch((e) => {
    console.error('[rollback-permissions] failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
