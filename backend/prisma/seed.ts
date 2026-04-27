import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PERMISSIONS, type PermissionCode } from '../src/common/permissions.constants';

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
  const blocks: Array<{ code: PermissionCode; name: string; description?: string }> = [
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
    {
      code: PERMISSIONS.TICKETS_VIEW_ALL_COMPANY,
      name: 'View all company tickets',
      description:
        'Override: technician can view all tickets within company (enable per-user via UserPermission)',
    },
    {
      code: PERMISSIONS.ANALYTICS_VIEW,
      name: 'View analytics',
      description: 'Access analytics dashboards',
    },
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
  ];

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
  const allBlocks = await prisma.permissionBlock.findMany({
    select: { id: true, code: true },
  });

  for (const b of allBlocks) {
    codeToId.set(b.code, b.id);
  }

  const matrix: Record<UserRole, PermissionCode[]> = {
    PLATFORM_ADMIN: [],
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
    DISPATCHER: [
      PERMISSIONS.TICKETS_CREATE,
      PERMISSIONS.TICKETS_VIEW,
      PERMISSIONS.TICKETS_EDIT,
      PERMISSIONS.TICKETS_ASSIGN,
      PERMISSIONS.TICKETS_STATUS_CHANGE,
      PERMISSIONS.ANALYTICS_VIEW,
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
    STAFF: [],
  };

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
