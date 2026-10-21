const { PrismaClient, UserRole } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const DEMO_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_COMPANY_NAME = 'Demo Company';
const DEFAULT_PASSWORD = 'Test1234!';

// Keep this helper aligned with prisma/seed.ts for every overlapping role.
const ROLE_PERMISSION_MATRIX = new Map([
  [UserRole.CLIENT, [
    { code: 'TICKETS_CREATE', name: 'Create tickets', description: 'Create tickets and child tickets' },
    { code: 'TICKETS_VIEW', name: 'View tickets', description: 'View tickets list and single ticket' },
    { code: 'TICKETS_EDIT', name: 'Edit tickets', description: 'Edit ticket fields in current MVP flow' },
    { code: 'LOCATIONS_VIEW', name: 'View locations', description: 'View locations for ticket create/edit forms' },
  ]],
  [UserRole.TERRITORIAL_MANAGER, [
    { code: 'TICKETS_CREATE', name: 'Create tickets', description: 'Create tickets and child tickets' },
    { code: 'TICKETS_VIEW', name: 'View tickets', description: 'View tickets list and single ticket' },
    { code: 'TICKETS_EDIT', name: 'Edit tickets', description: 'Edit ticket fields in current MVP flow' },
    { code: 'LOCATIONS_VIEW', name: 'View locations', description: 'View locations for ticket create/edit forms' },
  ]],
  [UserRole.NETWORK_DIRECTOR, [
    { code: 'TICKETS_CREATE', name: 'Create tickets', description: 'Create tickets and child tickets' },
    { code: 'TICKETS_VIEW', name: 'View tickets', description: 'View tickets list and single ticket' },
    { code: 'TICKETS_EDIT', name: 'Edit tickets', description: 'Edit ticket fields in current MVP flow' },
    { code: 'TICKETS_STATUS_CHANGE', name: 'Change ticket status', description: 'Change ticket status in current MVP flow' },
    { code: 'ANALYTICS_VIEW', name: 'View analytics', description: 'Access analytics dashboards' },
    { code: 'LOCATIONS_VIEW', name: 'View locations', description: 'View locations for ticket create/edit forms' },
  ]],
  [UserRole.TECHNICIAN, [
    { code: 'TICKETS_CREATE', name: 'Create tickets', description: 'Create tickets in bound client location scope' },
    { code: 'TICKETS_VIEW', name: 'View tickets', description: 'View tickets list and single ticket' },
    { code: 'TICKETS_VIEW_AVAILABLE', name: 'View available tickets', description: 'View available NEW tickets for technician' },
    { code: 'TICKETS_CLAIM', name: 'Claim tickets', description: 'Claim available NEW ticket (assign to self)' },
    { code: 'TICKETS_STATUS_CHANGE', name: 'Change ticket status', description: 'Change ticket status in executor flow' },
    { code: 'LOCATIONS_VIEW', name: 'View locations', description: 'View locations for ticket operations' },
  ]],
  [UserRole.MASTER, [
    { code: 'TICKETS_CREATE', name: 'Create tickets', description: 'Create tickets in linked client location scope' },
    { code: 'TICKETS_VIEW', name: 'View tickets', description: 'View tickets list and single ticket' },
    { code: 'TICKETS_EDIT', name: 'Edit tickets', description: 'Edit ticket fields in current MVP flow' },
    { code: 'TICKETS_ASSIGN', name: 'Assign tickets', description: 'Assign ticket to technician' },
    { code: 'TICKETS_STATUS_CHANGE', name: 'Change ticket status', description: 'Change ticket status in executor flow' },
    { code: 'ANALYTICS_VIEW', name: 'View analytics', description: 'Access analytics dashboards' },
    { code: 'LOCATIONS_VIEW', name: 'View locations', description: 'View locations for ticket operations' },
    { code: 'LOCATIONS_MANAGE', name: 'Manage locations', description: 'Create/update locations and change their status' },
  ]],
]);

const CLIENT_REQUIRED_PERMISSION_CODES = ['TICKETS_EDIT'];

const CLIENT_LIKE_REQUIRED_PERMISSIONS = Array.from(
  new Map(
    Array.from(ROLE_PERMISSION_MATRIX.values())
      .flat()
      .map((permission) => [permission.code, permission]),
  ).values(),
);

async function main() {
  const targetRoles = Array.from(ROLE_PERMISSION_MATRIX.keys());
  await prisma.$transaction(async (tx) => {
    for (const block of CLIENT_LIKE_REQUIRED_PERMISSIONS) {
      await tx.permissionBlock.upsert({
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

    const permissionBlocks = await tx.permissionBlock.findMany({
      where: { code: { in: CLIENT_LIKE_REQUIRED_PERMISSIONS.map((item) => item.code) } },
      select: { id: true, code: true },
    });
    const permissionBlockByCode = new Map(permissionBlocks.map((block) => [block.code, block]));

    await tx.rolePermission.deleteMany({
      where: {
        role: { in: targetRoles },
      },
    });

    for (const role of targetRoles) {
      const targetPermissions = ROLE_PERMISSION_MATRIX.get(role) ?? [];
      for (const permission of targetPermissions) {
        const block = permissionBlockByCode.get(permission.code);
        if (!block) {
          throw new Error(`[seed-users] missing PermissionBlock for code ${permission.code}`);
        }
        await tx.rolePermission.create({
          data: {
            role,
            permissionBlockId: block.id,
          },
        });
      }
    }

    const clientRolePermissions = await tx.rolePermission.findMany({
      where: {
        role: UserRole.CLIENT,
      },
      select: {
        permissionBlock: {
          select: {
            code: true,
          },
        },
      },
    });
    const clientPermissionCodes = new Set(
      clientRolePermissions
        .map((item) => item.permissionBlock?.code)
        .filter(Boolean),
    );

    for (const requiredCode of CLIENT_REQUIRED_PERMISSION_CODES) {
      if (!clientPermissionCodes.has(requiredCode)) {
        throw new Error(`[seed-users] invariant failed: CLIENT is missing ${requiredCode}`);
      }
    }
  });

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
