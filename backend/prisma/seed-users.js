const { PrismaClient, UserRole } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const DEMO_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_COMPANY_NAME = 'Demo Company';
const DEFAULT_PASSWORD = 'Test1234!';
const CLIENT_LIKE_REQUIRED_PERMISSIONS = [
  { code: 'TICKETS_CREATE', name: 'Create tickets', description: 'Create tickets and child tickets' },
  { code: 'TICKETS_VIEW', name: 'View tickets', description: 'View tickets list and single ticket' },
];

async function main() {
  for (const block of CLIENT_LIKE_REQUIRED_PERMISSIONS) {
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

  const clientLikePermissionBlocks = await prisma.permissionBlock.findMany({
    where: { code: { in: CLIENT_LIKE_REQUIRED_PERMISSIONS.map((item) => item.code) } },
    select: { id: true, code: true },
  });

  for (const role of [UserRole.CLIENT, UserRole.TERRITORIAL_MANAGER, UserRole.NETWORK_DIRECTOR]) {
    for (const block of clientLikePermissionBlocks) {
      await prisma.rolePermission.upsert({
        where: {
          role_permissionBlockId: {
            role,
            permissionBlockId: block.id,
          },
        },
        update: {},
        create: {
          role,
          permissionBlockId: block.id,
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
