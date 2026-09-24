// backend/scripts/seed-permissions-matrix.ts
//
// Phase 1.5 — идемпотентный seed дефолтной матрицы (role, companyType) → permissions.
// Источник истины: src/common/permissions-matrix.ts
//
// Поведение:
//  - upsert всех PermissionBlock по code (не удаляет блоки);
//  - в транзакции: ПОЛНОСТЬЮ пересоздаёт RolePermission по матрице
//    (удаляет все строки RolePermission и создаёт заново) — гарантирует, что
//    устаревшие/wildcard-гранты (например, старые role-only ADMIN) не остаются.
//  - UserPermission НЕ трогает (per-user overrides).
//
// ВКЛЮЧАЕТ PBAC: после первого запуска PermissionBlock.count() > 0, и
// PermissionsGuard перестаёт работать в fallback-режиме. Запускать только на Stage.
//
// Запуск: dotenv -e .env -- ts-node scripts/seed-permissions-matrix.ts
// (на Stage DATABASE_URL должен указывать на stage-БД)

import { PrismaClient } from '@prisma/client';

import { PERMISSION_BLOCKS, ROLE_GRANTS } from '../src/common/permissions-matrix';

const prisma = new PrismaClient();

async function run() {
  // 1) Блоки
  for (const b of PERMISSION_BLOCKS) {
    await prisma.permissionBlock.upsert({
      where: { code: b.code },
      update: { name: b.name, description: b.description ?? null },
      create: { code: b.code, name: b.name, description: b.description ?? null },
    });
  }

  const blocks = await prisma.permissionBlock.findMany({ select: { id: true, code: true } });
  const codeToId = new Map(blocks.map((b) => [b.code, b.id]));

  // 2) Гранты — полный пересоздаём в транзакции
  const rows: { role: any; companyType: any; permissionBlockId: string }[] = [];
  for (const grant of ROLE_GRANTS) {
    for (const code of grant.codes) {
      const permissionBlockId = codeToId.get(code);
      if (!permissionBlockId) {
        throw new Error(`Seed error: PermissionBlock for code ${code} not found`);
      }
      rows.push({ role: grant.role, companyType: grant.companyType, permissionBlockId });
    }
  }

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({}),
    prisma.rolePermission.createMany({ data: rows, skipDuplicates: true }),
  ]);

  const totalBlocks = await prisma.permissionBlock.count();
  const totalGrants = await prisma.rolePermission.count();
  console.log(`[seed-permissions] PermissionBlock: ${totalBlocks}`);
  console.log(`[seed-permissions] RolePermission rows: ${totalGrants}`);
  console.log(`[seed-permissions] PBAC enabled (fallback OFF). Grants by (role, companyType):`);
  for (const g of ROLE_GRANTS) {
    console.log(`  ${g.role} + ${g.companyType ?? 'ANY'}: ${g.codes.length} codes`);
  }
}

run()
  .catch((e) => {
    console.error('[seed-permissions] failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
