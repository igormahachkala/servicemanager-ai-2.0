import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PERMISSION_BLOCKS, ROLE_GRANTS } from '../src/common/permissions-matrix';
import { runStandardCatalogSeed } from '../scripts/seed-standard-catalog';

const prisma = new PrismaClient();

const DEMO_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_COMPANY_NAME = 'Demo Company';
const DEFAULT_PASSWORD = 'Test1234!';

async function upsertDemoUsers(companyId: string) {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const users: Array<{ email: string; role: UserRole; isActive?: boolean }> = [
    { email: 'admin@test.com', role: UserRole.ADMIN },
    { email: 'dispatcher@test.com', role: UserRole.DISPATCHER },
    { email: 'master@test.com', role: UserRole.MASTER },
    { email: 'tech1@test.com', role: UserRole.TECHNICIAN },
    { email: 'tech2@test.com', role: UserRole.TECHNICIAN },
    { email: 'tech3@test.com', role: UserRole.TECHNICIAN },
    { email: 'tech4@test.com', role: UserRole.TECHNICIAN },
    { email: 'client@test.com', role: UserRole.CLIENT },
    { email: 'staff@test.com', role: UserRole.STAFF },
    { email: 'tm@test.com', role: UserRole.TERRITORIAL_MANAGER },
    { email: 'director@test.com', role: UserRole.NETWORK_DIRECTOR },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        companyId,
        role: u.role,
        password: passwordHash,
        isActive: u.isActive ?? true,
      },
      create: {
        companyId,
        email: u.email,
        role: u.role,
        password: passwordHash,
        isActive: u.isActive ?? true,
      },
    });
  }

  console.log(`[seed] Demo users created/updated: ${users.length}`);
  console.log(`[seed] Demo password for all users: ${DEFAULT_PASSWORD}`);
}

async function upsertDemoLocations(companyId: string) {
  const locations = [
    {
      platformCode: 'LOC-MSK-001',
      externalCode: '15',
      name: 'Точка Арбат',
      city: 'Москва',
      region: 'Москва',
      address: 'ул. Арбат, 15',
      latitude: 55.749473,
      longitude: 37.591531,
      isActive: true,
    },
    {
      platformCode: 'LOC-MSK-002',
      externalCode: '16',
      name: 'Точка Тверская',
      city: 'Москва',
      region: 'Москва',
      address: 'ул. Тверская, 16',
      latitude: 55.765869,
      longitude: 37.605194,
      isActive: true,
    },
    {
      platformCode: 'LOC-KZN-001',
      externalCode: '15',
      name: 'Точка Пушкина',
      city: 'Казань',
      region: 'Татарстан',
      address: 'ул. Пушкина, 15',
      latitude: 55.78874,
      longitude: 49.12214,
      isActive: true,
    },
  ];

  for (const loc of locations) {
    await prisma.location.upsert({
      where: {
        clientCompanyId_platformCode: {
          clientCompanyId: companyId,
          platformCode: loc.platformCode,
        },
      },
      update: {
        externalCode: loc.externalCode,
        name: loc.name,
        city: loc.city,
        region: loc.region,
        address: loc.address,
        latitude: loc.latitude,
        longitude: loc.longitude,
        isActive: loc.isActive,
      },
      create: {
        clientCompanyId: companyId,
        platformCode: loc.platformCode,
        externalCode: loc.externalCode,
        name: loc.name,
        city: loc.city,
        region: loc.region,
        address: loc.address,
        latitude: loc.latitude,
        longitude: loc.longitude,
        isActive: loc.isActive,
      },
    });
  }

  console.log(`[seed] Demo locations created/updated: ${locations.length}`);
}

async function main() {
  // Phase 1.5: блоки и гранты берём из единого источника (companyType-aware).
  for (const b of PERMISSION_BLOCKS) {
    await prisma.permissionBlock.upsert({
      where: { code: b.code },
      update: { name: b.name, description: b.description ?? null },
      create: { code: b.code, name: b.name, description: b.description ?? null },
    });
  }

  const codeToId = new Map<string, string>();
  const allBlocks = await prisma.permissionBlock.findMany({
    select: { id: true, code: true },
  });
  for (const b of allBlocks) {
    codeToId.set(b.code, b.id);
  }

  // Полный пересоздаём RolePermission по матрице (role, companyType),
  // чтобы demo-seed не оставлял устаревших/wildcard-грантов.
  const grantRows: { role: UserRole; companyType: any; permissionBlockId: string }[] = [];
  for (const grant of ROLE_GRANTS) {
    for (const code of grant.codes) {
      const permissionBlockId = codeToId.get(code);
      if (!permissionBlockId) continue;
      grantRows.push({ role: grant.role, companyType: grant.companyType, permissionBlockId });
    }
  }
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({}),
    prisma.rolePermission.createMany({ data: grantRows, skipDuplicates: true }),
  ]);

  const company = await prisma.company.upsert({
    where: { id: DEMO_COMPANY_ID },
    update: {
      name: DEMO_COMPANY_NAME,
      type: 'CLIENT',
    },
    create: {
      id: DEMO_COMPANY_ID,
      name: DEMO_COMPANY_NAME,
      type: 'CLIENT',
    },
  });

  await upsertDemoUsers(company.id);
  await upsertDemoLocations(company.id);
  await runStandardCatalogSeed(prisma, company.id);

  const totalBlocks = await prisma.permissionBlock.count();
  const totalRolePerms = await prisma.rolePermission.count();
  const totalUsers = await prisma.user.count({
    where: { companyId: company.id },
  });
  const totalLocations = await prisma.location.count({
    where: { clientCompanyId: company.id },
  });

  console.log(`[seed] PermissionBlock: ${totalBlocks}`);
  console.log(`[seed] RolePermission: ${totalRolePerms}`);
  console.log(`[seed] Demo company: ${company.name}`);
  console.log(`[seed] Demo company users: ${totalUsers}`);
  console.log(`[seed] Demo company locations: ${totalLocations}`);
}

main()
  .catch((e) => {
    console.error('[seed] failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
