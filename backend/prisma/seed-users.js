const { PrismaClient, UserRole } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { readFileSync } = require('fs');
const { join } = require('path');

const prisma = new PrismaClient();

const DEMO_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_COMPANY_NAME = 'Demo Company';
const DEFAULT_PASSWORD = 'Test1234!';

function loadPermissionCodes() {
  const source = readFileSync(join(__dirname, '../src/common/permissions.constants.ts'), 'utf8');
  const entries = Array.from(source.matchAll(/([A-Z_]+):\s*'([^']+)'/g), ([, key, value]) => [key, value]);
  const permissions = Object.fromEntries(entries);

  for (const key of ['TICKETS_CREATE', 'TICKETS_VIEW', 'LOCATIONS_VIEW', 'TICKETS_EDIT']) {
    if (!permissions[key]) {
      throw new Error(`[seed-users] failed to resolve permission code ${key} from permissions.constants.ts`);
    }
  }

  return permissions;
}

const PERMISSIONS = loadPermissionCodes();

const CLIENT_LIKE_SHARED_PERMISSIONS = [
  { code: PERMISSIONS.TICKETS_CREATE, name: 'Create tickets', description: 'Create tickets and child tickets' },
  { code: PERMISSIONS.TICKETS_VIEW, name: 'View tickets', description: 'View tickets list and single ticket' },
  {
    code: PERMISSIONS.LOCATIONS_VIEW,
    name: 'View locations',
    description: 'View locations, categories, and equipment for ticket creation',
  },
];

const CLIENT_LIKE_ROLE_PERMISSIONS = new Map([
  [UserRole.CLIENT, CLIENT_LIKE_SHARED_PERMISSIONS],
  [UserRole.TERRITORIAL_MANAGER, [...CLIENT_LIKE_SHARED_PERMISSIONS, { code: PERMISSIONS.TICKETS_EDIT, name: 'Edit tickets', description: 'Edit ticket fields in current MVP flow' }]],
  [UserRole.NETWORK_DIRECTOR, [...CLIENT_LIKE_SHARED_PERMISSIONS, { code: PERMISSIONS.TICKETS_EDIT, name: 'Edit tickets', description: 'Edit ticket fields in current MVP flow' }]],
]);

const ALL_CLIENT_LIKE_PERMISSIONS = Array.from(
  new Map(
    Array.from(CLIENT_LIKE_ROLE_PERMISSIONS.values())
      .flat()
      .map((permission) => [permission.code, permission]),
  ).values(),
);

async function main() {
  for (const block of ALL_CLIENT_LIKE_PERMISSIONS) {
    await prisma.permissionBlock.upsert({
      where: { code: block.code },
      update: {
        name: block.name,
        description: block.description,
      },
      create: {
        code: block.code,
        name: block.name,
        description: block.description,
      },
    });
  }

  const permissionBlocks = await prisma.permissionBlock.findMany({
    where: { code: { in: ALL_CLIENT_LIKE_PERMISSIONS.map((item) => item.code) } },
    select: { id: true, code: true },
  });

  const permissionBlockByCode = new Map(permissionBlocks.map((block) => [block.code, block.id]));
  const clientLikeRoles = Array.from(CLIENT_LIKE_ROLE_PERMISSIONS.keys());

  await prisma.rolePermission.deleteMany({
    where: {
      role: { in: clientLikeRoles },
    },
  });

  for (const role of clientLikeRoles) {
    const permissions = CLIENT_LIKE_ROLE_PERMISSIONS.get(role) ?? [];

    for (const permission of permissions) {
      const permissionBlockId = permissionBlockByCode.get(permission.code);
      if (!permissionBlockId) {
        throw new Error(`[seed-users] missing PermissionBlock for code ${permission.code}`);
      }

      await prisma.rolePermission.create({
        data: {
          role,
          permissionBlockId,
        },
      });
    }
  }

  const company = await prisma.company.upsert({
    where: { id: DEMO_COMPANY_ID },
    update: {
      name: DEMO_COMPANY_NAME,
    },
    create: {
      id: DEMO_COMPANY_ID,
      name: DEMO_COMPANY_NAME,
    },
  });

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const users = [
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

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        companyId: company.id,
        role: user.role,
        password: passwordHash,
        isActive: true,
      },
      create: {
        companyId: company.id,
        email: user.email,
        role: user.role,
        password: passwordHash,
        isActive: true,
      },
    });
  }

  const count = await prisma.user.count({
    where: { companyId: company.id },
  });

  console.log(`[seed-users] company: ${company.name}`);
  console.log(`[seed-users] users in demo company: ${count}`);
  console.log(`[seed-users] password for all demo users: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('[seed-users] failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
