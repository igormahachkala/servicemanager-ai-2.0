import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CompanyType, ServiceContractRole, ServiceContractStatus, UserAccessLocationMode, UserRole } from '@prisma/client';

import { PERMISSIONS } from '../common/permissions.constants';
import { PermissionsService } from './permissions.service';

type FakeCompany = { id: string; name: string; type: CompanyType };
type FakeUser = {
  id: string;
  companyId: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
  isExecutor?: boolean;
  deletedAt?: Date | null;
};
type FakeBlock = { id: string; code: string; name?: string; description?: string | null };
type FakeRolePermission = { role: UserRole; companyType: CompanyType | null; code: string };
type FakeUserPermission = { userId: string; code: string };
type FakeLocation = {
  id: string;
  clientCompanyId: string;
  name: string;
  city?: string | null;
  address?: string | null;
  isActive?: boolean;
  deletedAt?: Date | null;
};
type FakeBinding = { id: string; userId: string; companyId: string; locationId: string; createdAt: Date };
type FakeAccessScope = { userId: string; companyId: string; locationMode: UserAccessLocationMode };

function publicUser(user: FakeUser) {
  return {
    id: user.id,
    email: user.email,
    firstName: null,
    lastName: null,
    avatarUrl: null,
    phone: null,
    role: user.role,
    isActive: user.isActive ?? true,
    isExecutor: user.isExecutor ?? false,
    deletedAt: user.deletedAt ?? null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    technicianSpecializations: [],
  };
}

function makeService(seed: {
  companies: FakeCompany[];
  users: FakeUser[];
  blocks: FakeBlock[];
  rolePermissions?: FakeRolePermission[];
  userPermissions?: FakeUserPermission[];
  locations?: FakeLocation[];
  bindings?: FakeBinding[];
  accessScopes?: FakeAccessScope[];
  linkedClients?: any[];
}) {
  const state = {
    ...seed,
    rolePermissions: seed.rolePermissions ?? [],
    userPermissions: seed.userPermissions ?? [],
    locations: seed.locations ?? [],
    bindings: seed.bindings ?? [],
    accessScopes: seed.accessScopes ?? [],
    linkedClients: seed.linkedClients ?? [],
  };

  const findBlock = (code: string) => state.blocks.find((block) => block.code === code)!;
  const findLocation = (id: string) => state.locations.find((location) => location.id === id);

  const prisma: any = {
    permissionBlock: {
      count: jest.fn(async () => state.blocks.length),
      findMany: jest.fn(async (args?: any) => {
        const codes = args?.where?.code?.in as string[] | undefined;
        return state.blocks
          .filter((block) => (!codes ? true : codes.includes(block.code)))
          .map((block) => ({
            id: block.id,
            code: block.code,
            name: block.name ?? block.code,
            description: block.description ?? null,
          }));
      }),
    },
    rolePermission: {
      findMany: jest.fn(async (args?: any) => {
        const roles = args?.where?.role?.in as UserRole[] | undefined;
        const companyTypes = args?.where?.OR?.[0]?.companyType?.in as CompanyType[] | undefined;
        const wantsWildcard = args?.where?.OR?.some((item: any) => item.companyType === null) ?? false;
        return state.rolePermissions
          .filter((grant) => (!roles ? true : roles.includes(grant.role)))
          .filter((grant) => {
            if (!companyTypes) return true;
            return (grant.companyType && companyTypes.includes(grant.companyType)) || (wantsWildcard && grant.companyType === null);
          })
          .map((grant) => {
            const block = findBlock(grant.code);
            return {
              role: grant.role,
              companyType: grant.companyType,
              permissionBlock: {
                code: block.code,
                name: block.name ?? block.code,
                description: block.description ?? null,
              },
            };
          });
      }),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    userPermission: {
      findMany: jest.fn(async (args?: any) => {
        const userIds = args?.where?.userId?.in as string[] | undefined;
        const userId = typeof args?.where?.userId === 'string' ? (args.where.userId as string) : undefined;
        return state.userPermissions
          .filter((grant) => (userIds ? userIds.includes(grant.userId) : true))
          .filter((grant) => (userId ? grant.userId === userId : true))
          .map((grant) => {
            const block = findBlock(grant.code);
            return {
              userId: grant.userId,
              permissionBlock: {
                code: block.code,
                name: block.name ?? block.code,
                description: block.description ?? null,
              },
            };
          });
      }),
      createMany: jest.fn(async (args: any) => {
        for (const item of args.data) {
          const block = state.blocks.find((candidate) => candidate.id === item.permissionBlockId)!;
          if (!state.userPermissions.some((grant) => grant.userId === item.userId && grant.code === block.code)) {
            state.userPermissions.push({ userId: item.userId, code: block.code });
          }
        }
        return { count: args.data.length };
      }),
      deleteMany: jest.fn(async (args: any) => {
        const before = state.userPermissions.length;
        const userId = args.where.userId;
        const codes = args.where.permissionBlock?.code?.in as string[];
        state.userPermissions = state.userPermissions.filter(
          (grant) => !(grant.userId === userId && codes.includes(grant.code)),
        );
        return { count: before - state.userPermissions.length };
      }),
    },
    company: {
      findUnique: jest.fn(async (args: any) => state.companies.find((company) => company.id === args.where.id) ?? null),
    },
    user: {
      findFirst: jest.fn(async (args: any) => {
        const user = state.users.find((candidate) => {
          if (args.where.id && candidate.id !== args.where.id) return false;
          if (args.where.companyId && candidate.companyId !== args.where.companyId) return false;
          if (args.where.deletedAt === null && candidate.deletedAt) return false;
          return true;
        });
        if (!user) return null;
        const company = state.companies.find((item) => item.id === user.companyId)!;
        return args.select?.company ? { ...publicUser(user), company } : publicUser(user);
      }),
      findMany: jest.fn(async (args: any) =>
        state.users
          .filter((user) => {
            if (args?.where?.companyId && user.companyId !== args.where.companyId) return false;
            if (args?.where?.role && user.role !== args.where.role) return false;
            if (typeof args?.where?.isActive === 'boolean' && (user.isActive ?? true) !== args.where.isActive) return false;
            if (args?.where?.deletedAt === null && user.deletedAt) return false;
            if (args?.where?.id?.not && user.id === args.where.id.not) return false;
            return true;
          })
          .map(publicUser),
      ),
    },
    location: {
      findMany: jest.fn(async (args: any) => {
        const ids = args?.where?.id?.in as string[] | undefined;
        const clientCompanyId = typeof args?.where?.clientCompanyId === 'string' ? (args.where.clientCompanyId as string) : undefined;
        const clientCompanyIds = args?.where?.clientCompanyId?.in as string[] | undefined;
        return state.locations
          .filter((location) => (!ids ? true : ids.includes(location.id)))
          .filter((location) => (!clientCompanyId ? true : location.clientCompanyId === clientCompanyId))
          .filter((location) => (!clientCompanyIds ? true : clientCompanyIds.includes(location.clientCompanyId)))
          .filter((location) => (args?.where?.isActive === true ? location.isActive !== false : true))
          .filter((location) => (args?.where?.deletedAt === null ? !location.deletedAt : true))
          .map((location) => ({
            ...location,
            platformCode: location.id,
            city: location.city ?? null,
            region: null,
            address: location.address ?? null,
            isActive: location.isActive ?? true,
            deletedAt: location.deletedAt ?? null,
          }));
      }),
      count: jest.fn(async (args: any) => {
        const clientIds = args.where.clientCompanyId?.in as string[] | undefined;
        return state.locations.filter((location) => (!clientIds ? true : clientIds.includes(location.clientCompanyId))).length;
      }),
    },
    userLocationBinding: {
      findMany: jest.fn(async (args: any) => {
        const userId = typeof args.where.userId === 'string' ? args.where.userId : undefined;
        const userIds = args.where.userId?.in as string[] | undefined;
        const companyId = args.where.companyId;
        const clientCompanyId = args.where.location?.clientCompanyId as string | undefined;
        return state.bindings
          .filter((binding) => (userId ? binding.userId === userId : true))
          .filter((binding) => (!userIds ? true : userIds.includes(binding.userId)))
          .filter((binding) => (companyId ? binding.companyId === companyId : true))
          .filter((binding) => {
            if (!clientCompanyId) return true;
            return findLocation(binding.locationId)?.clientCompanyId === clientCompanyId;
          })
          .map((binding) => ({
            ...binding,
            location: {
              ...findLocation(binding.locationId)!,
              platformCode: binding.locationId,
              city: findLocation(binding.locationId)?.city ?? null,
              region: null,
              address: findLocation(binding.locationId)?.address ?? null,
              isActive: findLocation(binding.locationId)?.isActive ?? true,
              deletedAt: findLocation(binding.locationId)?.deletedAt ?? null,
            },
          }));
      }),
      count: jest.fn(async (args: any) => {
        const userId = args.where.userId;
        const companyId = args.where.companyId;
        const clientCompanyId = args.where.location?.clientCompanyId as string | undefined;
        const notIn = args.where.locationId?.notIn as string[] | undefined;
        return state.bindings
          .filter((binding) => binding.userId === userId && binding.companyId === companyId)
          .filter((binding) => (!clientCompanyId ? true : findLocation(binding.locationId)?.clientCompanyId === clientCompanyId))
          .filter((binding) => (!notIn ? true : !notIn.includes(binding.locationId))).length;
      }),
      deleteMany: jest.fn(async (args: any) => {
        const before = state.bindings.length;
        const locationIds = args.where.locationId?.in as string[] | undefined;
        const clientCompanyId = args.where.location?.clientCompanyId as string | undefined;
        state.bindings = state.bindings.filter((binding) => {
          if (args.where.userId && binding.userId !== args.where.userId) return true;
          if (args.where.companyId && binding.companyId !== args.where.companyId) return true;
          if (locationIds && !locationIds.includes(binding.locationId)) return true;
          if (clientCompanyId && findLocation(binding.locationId)?.clientCompanyId !== clientCompanyId) return true;
          return false;
        });
        return { count: before - state.bindings.length };
      }),
      createMany: jest.fn(async (args: any) => {
        for (const item of args.data) {
          if (!state.bindings.some((binding) => binding.userId === item.userId && binding.locationId === item.locationId)) {
            state.bindings.push({
              id: `binding-${state.bindings.length + 1}`,
              userId: item.userId,
              companyId: item.companyId,
              locationId: item.locationId,
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
            });
          }
        }
        return { count: args.data.length };
      }),
    },
    userAccessScope: {
      findUnique: jest.fn(async (args: any) => {
        const key = args.where.userId_companyId;
        const scope = state.accessScopes.find((item) => item.userId === key.userId && item.companyId === key.companyId);
        return scope ? { locationMode: scope.locationMode, userId: scope.userId, companyId: scope.companyId } : null;
      }),
      findMany: jest.fn(async (args: any) => {
        const userIds = args.where.userId?.in as string[] | undefined;
        const companyId = args.where.companyId as string | undefined;
        return state.accessScopes
          .filter((scope) => (!userIds ? true : userIds.includes(scope.userId)))
          .filter((scope) => (!companyId ? true : scope.companyId === companyId))
          .map((scope) => ({ ...scope }));
      }),
      upsert: jest.fn(async (args: any) => {
        const key = args.where.userId_companyId;
        const existing = state.accessScopes.find((item) => item.userId === key.userId && item.companyId === key.companyId);
        if (existing) {
          existing.locationMode = args.update.locationMode;
          return { ...existing };
        }
        const created = {
          userId: args.create.userId,
          companyId: args.create.companyId,
          locationMode: args.create.locationMode,
        };
        state.accessScopes.push(created);
        return { ...created };
      }),
    },
    $transaction: jest.fn(async (cb: any) => cb(prisma)),
    domainEvent: { create: jest.fn() },
  };

  const serviceContractsService: any = {
    listLinkedClients: jest.fn(async () => state.linkedClients),
  };

  return {
    service: new PermissionsService(prisma, serviceContractsService),
    prisma,
    serviceContractsService,
    state,
  };
}

const blocks: FakeBlock[] = [
  { id: 'pb-view', code: PERMISSIONS.TICKETS_VIEW },
  { id: 'pb-create', code: PERMISSIONS.TICKETS_CREATE },
  { id: 'pb-assign', code: PERMISSIONS.TICKETS_ASSIGN },
  { id: 'pb-users', code: PERMISSIONS.USERS_MANAGE },
  { id: 'pb-analytics', code: PERMISSIONS.ANALYTICS_VIEW },
  { id: 'pb-all-company', code: PERMISSIONS.TICKETS_VIEW_ALL_COMPANY },
  { id: 'pb-locations-view', code: PERMISSIONS.LOCATIONS_VIEW },
  { id: 'pb-locations-manage', code: PERMISSIONS.LOCATIONS_MANAGE },
  { id: 'pb-settings', code: PERMISSIONS.COMPANY_SETTINGS_EDIT },
];

describe('PermissionsService Access Constructor V1A', () => {
  it('calculates effective permissions by role, company type, wildcard, and additive grants', async () => {
    const { service } = makeService({
      blocks,
      companies: [
        { id: 'client-1', name: 'Client', type: CompanyType.CLIENT },
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
      ],
      users: [
        { id: 'client-admin', companyId: 'client-1', email: 'client@example.com', role: UserRole.ADMIN },
        { id: 'provider-admin', companyId: 'provider-1', email: 'provider@example.com', role: UserRole.ADMIN },
      ],
      rolePermissions: [
        { role: UserRole.ADMIN, companyType: CompanyType.CLIENT, code: PERMISSIONS.TICKETS_VIEW },
        { role: UserRole.ADMIN, companyType: CompanyType.CLIENT, code: PERMISSIONS.USERS_MANAGE },
        { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.TICKETS_VIEW },
        { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.TICKETS_ASSIGN },
        { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE },
        { role: UserRole.ADMIN, companyType: null, code: PERMISSIONS.ANALYTICS_VIEW },
      ],
      userPermissions: [{ userId: 'client-admin', code: PERMISSIONS.TICKETS_VIEW_ALL_COMPANY }],
    });

    const client = await service.getEffectivePermissions({
      actorId: 'client-admin',
      actorCompanyId: 'client-1',
      actorRole: UserRole.ADMIN,
      userId: 'client-admin',
    });
    const provider = await service.getEffectivePermissions({
      actorId: 'provider-admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'provider-admin',
    });

    expect(client.permissions.codes.effective).toEqual([
      PERMISSIONS.ANALYTICS_VIEW,
      PERMISSIONS.TICKETS_VIEW,
      PERMISSIONS.TICKETS_VIEW_ALL_COMPANY,
      PERMISSIONS.USERS_MANAGE,
    ]);
    expect(provider.permissions.codes.effective).toEqual([
      PERMISSIONS.ANALYTICS_VIEW,
      PERMISSIONS.TICKETS_ASSIGN,
      PERMISSIONS.TICKETS_VIEW,
      PERMISSIONS.USERS_MANAGE,
    ]);
  });

  it('blocks company ADMIN from granting permissions they do not effectively have', async () => {
    const { service, prisma } = makeService({
      blocks,
      companies: [{ id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER }],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
    });

    await expect(
      service.grantUserPermissions({
        actorId: 'admin',
        actorCompanyId: 'provider-1',
        actorRole: UserRole.ADMIN,
        userId: 'tech',
        codes: [PERMISSIONS.TICKETS_ASSIGN],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.userPermission.createMany).not.toHaveBeenCalled();
  });

  it('blocks company ADMIN from removing permissions they do not effectively have', async () => {
    const { service, prisma } = makeService({
      blocks,
      companies: [{ id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER }],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
      userPermissions: [{ userId: 'tech', code: PERMISSIONS.TICKETS_ASSIGN }],
    });

    await expect(
      service.removeUserPermissions({
        actorId: 'admin',
        actorCompanyId: 'provider-1',
        actorRole: UserRole.ADMIN,
        userId: 'tech',
        codes: [PERMISSIONS.TICKETS_ASSIGN],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.userPermission.deleteMany).not.toHaveBeenCalled();
  });

  it('blocks company ADMIN from modifying self', async () => {
    const { service } = makeService({
      blocks,
      companies: [{ id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER }],
      users: [{ id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN }],
      rolePermissions: [
        { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE },
        { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.TICKETS_VIEW },
      ],
    });

    await expect(
      service.grantUserPermissions({
        actorId: 'admin',
        actorCompanyId: 'provider-1',
        actorRole: UserRole.ADMIN,
        userId: 'admin',
        codes: [PERMISSIONS.TICKETS_VIEW],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks company ADMIN from modifying PLATFORM_ADMIN target', async () => {
    const { service } = makeService({
      blocks,
      companies: [{ id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER }],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'platform-admin', companyId: 'provider-1', email: 'platform@example.com', role: UserRole.PLATFORM_ADMIN },
      ],
      rolePermissions: [
        { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE },
        { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.TICKETS_VIEW },
      ],
    });

    await expect(
      service.grantUserPermissions({
        actorId: 'admin',
        actorCompanyId: 'provider-1',
        actorRole: UserRole.ADMIN,
        userId: 'platform-admin',
        codes: [PERMISSIONS.TICKETS_VIEW],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents company ADMIN from modifying another company user', async () => {
    const { service } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider 1', type: CompanyType.PROVIDER },
        { id: 'provider-2', name: 'Provider 2', type: CompanyType.PROVIDER },
      ],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'other-tech', companyId: 'provider-2', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [
        { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE },
        { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.TICKETS_VIEW },
      ],
    });

    await expect(
      service.grantUserPermissions({
        actorId: 'admin',
        actorCompanyId: 'provider-1',
        actorRole: UserRole.ADMIN,
        userId: 'other-tech',
        codes: [PERMISSIONS.TICKETS_VIEW],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows PLATFORM_ADMIN to grant additive permissions across companies', async () => {
    const { service, state } = makeService({
      blocks,
      companies: [
        { id: 'platform', name: 'Platform', type: CompanyType.PROVIDER },
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
      ],
      users: [
        { id: 'platform-admin', companyId: 'platform', email: 'platform@example.com', role: UserRole.PLATFORM_ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
    });

    const result = await service.grantUserPermissions({
      actorId: 'platform-admin',
      actorCompanyId: 'platform',
      actorRole: UserRole.PLATFORM_ADMIN,
      requestedCompanyId: 'provider-1',
      userId: 'tech',
      codes: [PERMISSIONS.TICKETS_VIEW_ALL_COMPANY],
    });

    expect(state.userPermissions).toContainEqual({ userId: 'tech', code: PERMISSIONS.TICKETS_VIEW_ALL_COMPANY });
    expect(result.permissions.codes.overrides).toEqual([PERMISSIONS.TICKETS_VIEW_ALL_COMPANY]);
  });

  it('blocks removing USERS_MANAGE from the last effective active company admin', async () => {
    const { service } = makeService({
      blocks,
      companies: [
        { id: 'platform', name: 'Platform', type: CompanyType.PROVIDER },
        { id: 'client-1', name: 'Client', type: CompanyType.CLIENT },
      ],
      users: [
        { id: 'platform-admin', companyId: 'platform', email: 'platform@example.com', role: UserRole.PLATFORM_ADMIN },
        { id: 'client-admin', companyId: 'client-1', email: 'admin@example.com', role: UserRole.ADMIN },
      ],
      userPermissions: [{ userId: 'client-admin', code: PERMISSIONS.USERS_MANAGE }],
    });

    await expect(
      service.removeUserPermissions({
        actorId: 'platform-admin',
        actorCompanyId: 'platform',
        actorRole: UserRole.PLATFORM_ADMIN,
        requestedCompanyId: 'client-1',
        userId: 'client-admin',
        codes: [PERMISSIONS.USERS_MANAGE],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects location bindings for foreign client locations', async () => {
    const { service } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
        { id: 'client-1', name: 'Client 1', type: CompanyType.CLIENT },
        { id: 'client-2', name: 'Client 2', type: CompanyType.CLIENT },
      ],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
      locations: [{ id: 'loc-foreign', clientCompanyId: 'client-2', name: 'Foreign location' }],
      linkedClients: [
        {
          linkedClientCompanyId: 'client-1',
          name: 'Client 1',
          serviceContractId: 'contract-1',
          role: ServiceContractRole.PRIMARY,
          status: 'ACTIVE',
        },
      ],
    });

    await expect(
      service.replaceLocationBindings({
        actorId: 'admin',
        actorCompanyId: 'provider-1',
        actorRole: UserRole.ADMIN,
        userId: 'tech',
        clientCompanyId: 'client-1',
        locationIds: ['loc-foreign'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects inactive or unrelated contract contours for location bindings', async () => {
    const { service } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
        { id: 'client-inactive', name: 'Inactive client', type: CompanyType.CLIENT },
      ],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
      locations: [{ id: 'loc-inactive', clientCompanyId: 'client-inactive', name: 'Inactive contract location' }],
      linkedClients: [],
    });

    await expect(
      service.replaceLocationBindings({
        actorId: 'admin',
        actorCompanyId: 'provider-1',
        actorRole: UserRole.ADMIN,
        userId: 'tech',
        clientCompanyId: 'client-inactive',
        locationIds: ['loc-inactive'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects empty selected-location replacement and requires explicit clear endpoint', async () => {
    const { service } = makeService({
      blocks,
      companies: [{ id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER }],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
    });

    await expect(
      service.replaceLocationBindings({
        actorId: 'admin',
        actorCompanyId: 'provider-1',
        actorRole: UserRole.ADMIN,
        userId: 'tech',
        clientCompanyId: 'client-1',
        locationIds: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('excludes stale location bindings from read and preview', async () => {
    const { service } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
        { id: 'client-active', name: 'Active client', type: CompanyType.CLIENT },
        { id: 'client-stale', name: 'Stale client', type: CompanyType.CLIENT },
      ],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
      locations: [{ id: 'loc-stale', clientCompanyId: 'client-stale', name: 'Stale location' }],
      bindings: [
        {
          id: 'binding-stale',
          userId: 'tech',
          companyId: 'provider-1',
          locationId: 'loc-stale',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      linkedClients: [
        {
          linkedClientCompanyId: 'client-active',
          name: 'Active client',
          serviceContractId: 'contract-active',
          role: ServiceContractRole.PRIMARY,
          status: 'ACTIVE',
        },
      ],
    });

    const bindings = await service.getLocationBindings({
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'tech',
    });
    const preview = await service.getAccessPreview({
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'tech',
    });

    expect(bindings.count).toBe(0);
    expect(bindings.staleCount).toBe(1);
    expect(preview.locationBindings.selectedCount).toBe(0);
    expect(preview.locationBindings.staleCount).toBe(1);
    expect(preview.estimates.accessibleLocationCount).toBe(0);
  });

  it('dedupes duplicate locationIds when replacing bindings', async () => {
    const { service, prisma, state } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
        { id: 'client-1', name: 'Client', type: CompanyType.CLIENT },
      ],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
      locations: [{ id: 'loc-1', clientCompanyId: 'client-1', name: 'Location 1' }],
      linkedClients: [
        {
          linkedClientCompanyId: 'client-1',
          name: 'Client',
          serviceContractId: 'contract-1',
          role: ServiceContractRole.PRIMARY,
          status: 'ACTIVE',
        },
      ],
    });

    await service.replaceLocationBindings({
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'tech',
      clientCompanyId: 'client-1',
      locationIds: ['loc-1', 'loc-1'],
    });

    expect(prisma.userLocationBinding.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'tech', companyId: 'provider-1', locationId: 'loc-1' }],
      skipDuplicates: true,
    });
    expect(state.bindings).toHaveLength(1);
  });

  it('migrates a selected legacy client-company binding into provider scope', async () => {
    const { service, state } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
        { id: 'client-1', name: 'Client', type: CompanyType.CLIENT },
      ],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
      locations: [{ id: 'loc-1', clientCompanyId: 'client-1', name: 'Location 1' }],
      bindings: [
        {
          id: 'legacy-binding',
          userId: 'tech',
          companyId: 'client-1',
          locationId: 'loc-1',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      linkedClients: [
        {
          linkedClientCompanyId: 'client-1',
          name: 'Client',
          serviceContractId: 'contract-1',
          role: ServiceContractRole.PRIMARY,
          status: 'ACTIVE',
        },
      ],
    });

    await service.replaceLocationBindings({
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'tech',
      clientCompanyId: 'client-1',
      locationIds: ['loc-1'],
    });

    expect(state.bindings).toEqual([
      expect.objectContaining({
        userId: 'tech',
        companyId: 'provider-1',
        locationId: 'loc-1',
      }),
    ]);
  });

  it('keeps legacy no-scope-row provider preview backward compatible without fail-closed reinterpretation', async () => {
    const { service } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
        { id: 'client-1', name: 'Client', type: CompanyType.CLIENT },
      ],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
      locations: [{ id: 'loc-1', clientCompanyId: 'client-1', name: 'Location 1' }],
      linkedClients: [
        {
          linkedClientCompanyId: 'client-1',
          name: 'Client',
          serviceContractId: 'contract-1',
          role: ServiceContractRole.SECONDARY,
          status: 'ACTIVE',
        },
      ],
    });

    const preview = await service.getAccessPreview({
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'tech',
    });

    expect(preview.locationBindings.mode).toBe('legacy_auto');
    expect(preview.locationBindings.locationMode).toBe('LEGACY_AUTO');
    expect(preview.locationBindings.selectedCount).toBe(0);
    expect(preview.estimates.accessibleCompanyCount).toBe(2);
    expect(preview.estimates.accessibleLocationCount).toBe(1);
    expect(preview.ticketVisibilityMode).toBe('assigned_and_available');
  });

  it('keeps explicit restricted-empty preview fail-closed with zero accessible locations', async () => {
    const { service } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
        { id: 'client-1', name: 'Client', type: CompanyType.CLIENT },
      ],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
      locations: [{ id: 'loc-1', clientCompanyId: 'client-1', name: 'Location 1' }],
      accessScopes: [
        { userId: 'tech', companyId: 'provider-1', locationMode: UserAccessLocationMode.RESTRICTED_EMPTY },
      ],
      linkedClients: [
        {
          linkedClientCompanyId: 'client-1',
          name: 'Client',
          serviceContractId: 'contract-1',
          role: ServiceContractRole.SECONDARY,
          status: 'ACTIVE',
        },
      ],
    });

    const preview = await service.getAccessPreview({
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'tech',
    });

    expect(preview.locationBindings.mode).toBe('restricted_empty');
    expect(preview.locationBindings.locationMode).toBe('RESTRICTED_EMPTY');
    expect(preview.locationBindings.selectedCount).toBe(0);
    expect(preview.estimates.accessibleCompanyCount).toBe(0);
    expect(preview.estimates.accessibleLocationCount).toBe(0);
    expect(preview.ticketVisibilityMode).toBe('restricted_empty_scope');
  });

  it('grants permissions idempotently', async () => {
    const { service, state, prisma } = makeService({
      blocks,
      companies: [{ id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER }],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [
        { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE },
        { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.TICKETS_VIEW },
      ],
      userPermissions: [{ userId: 'tech', code: PERMISSIONS.TICKETS_VIEW }],
    });

    await service.grantUserPermissions({
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'tech',
      codes: [PERMISSIONS.TICKETS_VIEW, PERMISSIONS.TICKETS_VIEW],
    });

    expect(prisma.userPermission.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'tech', permissionBlockId: 'pb-view' }],
      skipDuplicates: true,
    });
    expect(state.userPermissions.filter((grant) => grant.userId === 'tech' && grant.code === PERMISSIONS.TICKETS_VIEW)).toHaveLength(1);
  });

  it('removes permissions idempotently when the target override is already absent', async () => {
    const { service, state } = makeService({
      blocks,
      companies: [{ id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER }],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [
        { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE },
        { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.TICKETS_VIEW },
      ],
    });

    await expect(
      service.removeUserPermissions({
        actorId: 'admin',
        actorCompanyId: 'provider-1',
        actorRole: UserRole.ADMIN,
        userId: 'tech',
        codes: [PERMISSIONS.TICKETS_VIEW],
      }),
    ).resolves.toBeTruthy();
    expect(state.userPermissions).toEqual([]);
  });

  it('builds preview without writes or side effects', async () => {
    const { service, prisma } = makeService({
      blocks,
      companies: [{ id: 'client-1', name: 'Client', type: CompanyType.CLIENT }],
      users: [
        { id: 'admin', companyId: 'client-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'manager', companyId: 'client-1', email: 'manager@example.com', role: UserRole.TERRITORIAL_MANAGER },
      ],
      rolePermissions: [
        { role: UserRole.ADMIN, companyType: CompanyType.CLIENT, code: PERMISSIONS.USERS_MANAGE },
        { role: UserRole.TERRITORIAL_MANAGER, companyType: CompanyType.CLIENT, code: PERMISSIONS.TICKETS_VIEW },
      ],
      userPermissions: [{ userId: 'manager', code: PERMISSIONS.ANALYTICS_VIEW }],
      locations: [{ id: 'loc-1', clientCompanyId: 'client-1', name: 'Location 1' }],
      bindings: [
        {
          id: 'binding-1',
          userId: 'manager',
          companyId: 'client-1',
          locationId: 'loc-1',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const preview = await service.getAccessPreview({
      actorId: 'admin',
      actorCompanyId: 'client-1',
      actorRole: UserRole.ADMIN,
      userId: 'manager',
    });

    expect(preview.permissions.effectiveCodes).toEqual([PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.TICKETS_VIEW]);
    expect(preview.locationBindings.selectedCount).toBe(1);
    expect(preview.estimates.accessibleCompanyCount).toBe(1);
    expect(prisma.userPermission.createMany).not.toHaveBeenCalled();
    expect(prisma.userPermission.deleteMany).not.toHaveBeenCalled();
    expect(prisma.userLocationBinding.createMany).not.toHaveBeenCalled();
    expect(prisma.userLocationBinding.deleteMany).not.toHaveBeenCalled();
    expect(prisma.domainEvent.create).not.toHaveBeenCalled();
  });

  it('allows PLATFORM_ADMIN to preview a target user across company boundaries', async () => {
    const { service } = makeService({
      blocks,
      companies: [
        { id: 'platform', name: 'Platform', type: CompanyType.PROVIDER },
        { id: 'client-1', name: 'Client', type: CompanyType.CLIENT },
      ],
      users: [
        { id: 'platform-admin', companyId: 'platform', email: 'platform@example.com', role: UserRole.PLATFORM_ADMIN },
        { id: 'manager', companyId: 'client-1', email: 'manager@example.com', role: UserRole.TERRITORIAL_MANAGER },
      ],
      rolePermissions: [{ role: UserRole.TERRITORIAL_MANAGER, companyType: CompanyType.CLIENT, code: PERMISSIONS.TICKETS_VIEW }],
    });

    const preview = await service.getAccessPreview({
      actorId: 'platform-admin',
      actorCompanyId: 'platform',
      actorRole: UserRole.PLATFORM_ADMIN,
      requestedCompanyId: 'client-1',
      userId: 'manager',
    });

    expect(preview.company.id).toBe('client-1');
    expect(preview.user.id).toBe('manager');
    expect(preview.permissions.effectiveCodes).toEqual([PERMISSIONS.TICKETS_VIEW]);
  });

  it('builds bulk access summary with the same visibility semantics as persisted preview', async () => {
    const { service } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
        { id: 'client-1', name: 'Client', type: CompanyType.CLIENT },
      ],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [
        { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE },
        { role: UserRole.TECHNICIAN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.TICKETS_VIEW },
      ],
      locations: [{ id: 'loc-1', clientCompanyId: 'client-1', name: 'Location 1' }],
      bindings: [
        {
          id: 'binding-1',
          userId: 'tech',
          companyId: 'provider-1',
          locationId: 'loc-1',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      linkedClients: [
        {
          linkedClientCompanyId: 'client-1',
          name: 'Client',
          serviceContractId: 'contract-1',
          role: ServiceContractRole.PRIMARY,
          status: ServiceContractStatus.ACTIVE,
        },
      ],
    });

    const [summary, preview] = await Promise.all([
      service.getAccessSummary({
        actorId: 'admin',
        actorCompanyId: 'provider-1',
        actorRole: UserRole.ADMIN,
      }),
      service.getAccessPreview({
        actorId: 'admin',
        actorCompanyId: 'provider-1',
        actorRole: UserRole.ADMIN,
        userId: 'tech',
      }),
    ]);

    const techSummary = summary.users.find((item: any) => item.user.id === 'tech')!;
    expect(techSummary.accessibleLocationCount).toBe(preview.estimates.accessibleLocationCount);
    expect(techSummary.accessibleCompanyCount).toBe(preview.estimates.accessibleCompanyCount);
    expect(techSummary.ticketVisibilityMode).toBe(preview.ticketVisibilityMode);
    expect(techSummary.locationMode).toBe('SELECTED_LOCATIONS');
  });

  it('limits company ADMIN access summary to own company users', async () => {
    const { service } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider 1', type: CompanyType.PROVIDER },
        { id: 'provider-2', name: 'Provider 2', type: CompanyType.PROVIDER },
      ],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech-1', companyId: 'provider-1', email: 'tech1@example.com', role: UserRole.TECHNICIAN },
        { id: 'tech-2', companyId: 'provider-2', email: 'tech2@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
    });

    const summary = await service.getAccessSummary({
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
    });

    expect(summary.users.map((item: any) => item.user.id).sort()).toEqual(['admin', 'tech-1']);
  });

  it('requires and uses explicit company filter for PLATFORM_ADMIN access summary', async () => {
    const { service } = makeService({
      blocks,
      companies: [
        { id: 'platform', name: 'Platform', type: CompanyType.PROVIDER },
        { id: 'provider-1', name: 'Provider 1', type: CompanyType.PROVIDER },
      ],
      users: [
        { id: 'platform-admin', companyId: 'platform', email: 'platform@example.com', role: UserRole.PLATFORM_ADMIN },
        { id: 'tech-1', companyId: 'provider-1', email: 'tech1@example.com', role: UserRole.TECHNICIAN },
      ],
    });

    await expect(
      service.getAccessSummary({
        actorId: 'platform-admin',
        actorCompanyId: 'platform',
        actorRole: UserRole.PLATFORM_ADMIN,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const summary = await service.getAccessSummary({
      actorId: 'platform-admin',
      actorCompanyId: 'platform',
      actorRole: UserRole.PLATFORM_ADMIN,
      requestedCompanyId: 'provider-1',
    });
    expect(summary.company.id).toBe('provider-1');
    expect(summary.users.map((item: any) => item.user.id)).toEqual(['tech-1']);
  });

  it('builds draft preview without writes or side effects', async () => {
    const { service, prisma } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
        { id: 'client-1', name: 'Client', type: CompanyType.CLIENT },
      ],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [
        { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE },
        { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.TICKETS_VIEW },
      ],
      locations: [{ id: 'loc-1', clientCompanyId: 'client-1', name: 'Location 1' }],
      linkedClients: [
        {
          linkedClientCompanyId: 'client-1',
          name: 'Client',
          serviceContractId: 'contract-1',
          role: ServiceContractRole.PRIMARY,
          status: ServiceContractStatus.ACTIVE,
        },
      ],
    });

    const draft = await service.previewDraft({
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'tech',
      additivePermissionCodes: [PERMISSIONS.TICKETS_VIEW],
      locationIds: ['loc-1'],
      selectedClientContourIds: ['client-1'],
    });

    expect(draft.proposed.locationCount).toBe(1);
    expect(draft.addedCapabilities).toEqual([PERMISSIONS.TICKETS_VIEW]);
    expect(prisma.userPermission.createMany).not.toHaveBeenCalled();
    expect(prisma.userPermission.deleteMany).not.toHaveBeenCalled();
    expect(prisma.userLocationBinding.createMany).not.toHaveBeenCalled();
    expect(prisma.userLocationBinding.deleteMany).not.toHaveBeenCalled();
  });

  it('draft preview with empty locations is fail-closed and has no writes', async () => {
    const { service, prisma, state } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
        { id: 'client-1', name: 'Client', type: CompanyType.CLIENT },
      ],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
      locations: [{ id: 'loc-1', clientCompanyId: 'client-1', name: 'Location 1' }],
      bindings: [
        {
          id: 'binding-1',
          userId: 'tech',
          companyId: 'provider-1',
          locationId: 'loc-1',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      linkedClients: [
        {
          linkedClientCompanyId: 'client-1',
          name: 'Client',
          serviceContractId: 'contract-1',
          role: ServiceContractRole.PRIMARY,
          status: ServiceContractStatus.ACTIVE,
        },
      ],
    });

    const draft = await service.previewDraft({
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'tech',
      locationIds: [],
      selectedClientContourIds: ['client-1'],
    });

    expect(draft.preview.locationBindings.locationMode).toBe('RESTRICTED_EMPTY');
    expect(draft.proposed.locationCount).toBe(0);
    expect(draft.proposed.companyCount).toBe(0);
    expect(draft.proposed.ticketVisibilityMode).toBe('restricted_empty_scope');
    expect(state.accessScopes).toEqual([]);
    expect(prisma.userAccessScope.upsert).not.toHaveBeenCalled();
    expect(prisma.userLocationBinding.createMany).not.toHaveBeenCalled();
    expect(prisma.userLocationBinding.deleteMany).not.toHaveBeenCalled();
  });

  it('draft preview matches persisted preview after applying the same changes', async () => {
    const { service } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
        { id: 'client-1', name: 'Client', type: CompanyType.CLIENT },
      ],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [
        { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE },
        { role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.TICKETS_VIEW },
      ],
      locations: [{ id: 'loc-1', clientCompanyId: 'client-1', name: 'Location 1' }],
      linkedClients: [
        {
          linkedClientCompanyId: 'client-1',
          name: 'Client',
          serviceContractId: 'contract-1',
          role: ServiceContractRole.PRIMARY,
          status: ServiceContractStatus.ACTIVE,
        },
      ],
    });

    const draft = await service.previewDraft({
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'tech',
      additivePermissionCodes: [PERMISSIONS.TICKETS_VIEW],
      locationIds: ['loc-1'],
      selectedClientContourIds: ['client-1'],
    });
    await service.grantUserPermissions({
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'tech',
      codes: [PERMISSIONS.TICKETS_VIEW],
    });
    await service.replaceLocationBindings({
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'tech',
      clientCompanyId: 'client-1',
      locationIds: ['loc-1'],
    });
    const persisted = await service.getAccessPreview({
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'tech',
    });

    expect(draft.proposed.locationCount).toBe(persisted.estimates.accessibleLocationCount);
    expect(draft.preview.permissions.effectiveCodes).toEqual(persisted.permissions.effectiveCodes);
  });

  it('clear-to-restricted-empty endpoint persists explicit restricted-empty without widening access', async () => {
    const { service, prisma, state } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
        { id: 'client-1', name: 'Client', type: CompanyType.CLIENT },
      ],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
      locations: [{ id: 'loc-1', clientCompanyId: 'client-1', name: 'Location 1' }],
      bindings: [
        {
          id: 'binding-1',
          userId: 'tech',
          companyId: 'provider-1',
          locationId: 'loc-1',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      linkedClients: [
        {
          linkedClientCompanyId: 'client-1',
          name: 'Client',
          serviceContractId: 'contract-1',
          role: ServiceContractRole.PRIMARY,
          status: ServiceContractStatus.ACTIVE,
        },
      ],
    });

    const response = await service.replaceAllLocationBindings({
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'tech',
      groups: [{ mode: 'CLEAR_RESTRICTED_EMPTY', clientCompanyId: 'client-1' }],
    });

    expect(response.locationMode).toBe('RESTRICTED_EMPTY');
    expect(response.count).toBe(0);
    expect(state.bindings).toHaveLength(0);
    expect(state.accessScopes).toEqual([
      { userId: 'tech', companyId: 'provider-1', locationMode: UserAccessLocationMode.RESTRICTED_EMPTY },
    ]);
    expect(prisma.userLocationBinding.deleteMany).toHaveBeenCalled();
  });

  it('persists UserAccessScope with the resolved target user company only', async () => {
    const { service, prisma, state } = makeService({
      blocks,
      companies: [
        { id: 'platform', name: 'Platform', type: CompanyType.PROVIDER },
        { id: 'provider-1', name: 'Provider 1', type: CompanyType.PROVIDER },
        { id: 'provider-2', name: 'Provider 2', type: CompanyType.PROVIDER },
      ],
      users: [
        { id: 'platform-admin', companyId: 'platform', email: 'platform@example.com', role: UserRole.PLATFORM_ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
    });

    await service.replaceAllLocationBindings({
      actorId: 'platform-admin',
      actorCompanyId: 'platform',
      actorRole: UserRole.PLATFORM_ADMIN,
      requestedCompanyId: 'provider-1',
      userId: 'tech',
      groups: [{ mode: 'CLEAR_RESTRICTED_EMPTY' }],
    });

    expect(prisma.userAccessScope.upsert).toHaveBeenCalledWith({
      where: { userId_companyId: { userId: 'tech', companyId: 'provider-1' } },
      update: { locationMode: UserAccessLocationMode.RESTRICTED_EMPTY },
      create: {
        userId: 'tech',
        companyId: 'provider-1',
        locationMode: UserAccessLocationMode.RESTRICTED_EMPTY,
      },
    });
    expect(state.accessScopes).toEqual([
      { userId: 'tech', companyId: 'provider-1', locationMode: UserAccessLocationMode.RESTRICTED_EMPTY },
    ]);

    await expect(
      service.replaceAllLocationBindings({
        actorId: 'platform-admin',
        actorCompanyId: 'platform',
        actorRole: UserRole.PLATFORM_ADMIN,
        requestedCompanyId: 'provider-2',
        userId: 'tech',
        groups: [{ mode: 'CLEAR_RESTRICTED_EMPTY' }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.userAccessScope.upsert).toHaveBeenCalledTimes(1);
  });

  it('adding locations after restricted-empty switches mode to selected locations', async () => {
    const { service, state } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
        { id: 'client-1', name: 'Client', type: CompanyType.CLIENT },
      ],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
      locations: [{ id: 'loc-1', clientCompanyId: 'client-1', name: 'Location 1' }],
      accessScopes: [
        { userId: 'tech', companyId: 'provider-1', locationMode: UserAccessLocationMode.RESTRICTED_EMPTY },
      ],
      linkedClients: [
        {
          linkedClientCompanyId: 'client-1',
          name: 'Client',
          serviceContractId: 'contract-1',
          role: ServiceContractRole.PRIMARY,
          status: ServiceContractStatus.ACTIVE,
        },
      ],
    });

    const response = await service.replaceLocationBindings({
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'tech',
      clientCompanyId: 'client-1',
      locationIds: ['loc-1'],
    });

    expect(response.locationMode).toBe('SELECTED_LOCATIONS');
    expect(response.count).toBe(1);
    expect(state.accessScopes).toEqual([
      { userId: 'tech', companyId: 'provider-1', locationMode: UserAccessLocationMode.SELECTED_LOCATIONS },
    ]);
  });

  it('repeated clear and repeated selected replacement are idempotent', async () => {
    const { service, state } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
        { id: 'client-1', name: 'Client', type: CompanyType.CLIENT },
      ],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
      locations: [{ id: 'loc-1', clientCompanyId: 'client-1', name: 'Location 1' }],
      linkedClients: [
        {
          linkedClientCompanyId: 'client-1',
          name: 'Client',
          serviceContractId: 'contract-1',
          role: ServiceContractRole.PRIMARY,
          status: ServiceContractStatus.ACTIVE,
        },
      ],
    });

    const selected = {
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'tech',
      groups: [{ mode: 'REPLACE_SELECTED' as const, clientCompanyId: 'client-1', locationIds: ['loc-1', 'loc-1'] }],
    };
    await service.replaceAllLocationBindings(selected);
    await service.replaceAllLocationBindings(selected);

    expect(state.bindings).toHaveLength(1);
    expect(state.accessScopes).toEqual([
      { userId: 'tech', companyId: 'provider-1', locationMode: UserAccessLocationMode.SELECTED_LOCATIONS },
    ]);

    const clear = {
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'tech',
      groups: [{ mode: 'CLEAR_RESTRICTED_EMPTY' as const }],
    };
    await service.replaceAllLocationBindings(clear);
    await service.replaceAllLocationBindings(clear);

    expect(state.bindings).toHaveLength(0);
    expect(state.accessScopes).toEqual([
      { userId: 'tech', companyId: 'provider-1', locationMode: UserAccessLocationMode.RESTRICTED_EMPTY },
    ]);
  });

  it('replaceAll keeps unselected legacy bindings stale while migrating selected locations', async () => {
    const { service, state } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
        { id: 'client-1', name: 'Client', type: CompanyType.CLIENT },
      ],
      users: [
        { id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN },
        { id: 'tech', companyId: 'provider-1', email: 'tech@example.com', role: UserRole.TECHNICIAN },
      ],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
      locations: [
        { id: 'loc-selected', clientCompanyId: 'client-1', name: 'Selected' },
        { id: 'loc-stale', clientCompanyId: 'client-1', name: 'Stale' },
      ],
      bindings: [
        {
          id: 'legacy-selected',
          userId: 'tech',
          companyId: 'client-1',
          locationId: 'loc-selected',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'legacy-stale',
          userId: 'tech',
          companyId: 'client-1',
          locationId: 'loc-stale',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      linkedClients: [
        {
          linkedClientCompanyId: 'client-1',
          name: 'Client',
          serviceContractId: 'contract-1',
          role: ServiceContractRole.PRIMARY,
          status: ServiceContractStatus.ACTIVE,
        },
      ],
    });

    await service.replaceAllLocationBindings({
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      userId: 'tech',
      groups: [{ mode: 'REPLACE_SELECTED', clientCompanyId: 'client-1', locationIds: ['loc-selected'] }],
    });

    expect(state.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: 'tech', companyId: 'provider-1', locationId: 'loc-selected' }),
        expect.objectContaining({ userId: 'tech', companyId: 'client-1', locationId: 'loc-stale' }),
      ]),
    );
    expect(state.bindings).toHaveLength(2);
  });

  it('rejects foreign location options', async () => {
    const { service } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
        { id: 'client-1', name: 'Client 1', type: CompanyType.CLIENT },
        { id: 'client-2', name: 'Client 2', type: CompanyType.CLIENT },
      ],
      users: [{ id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN }],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
      linkedClients: [
        {
          linkedClientCompanyId: 'client-1',
          name: 'Client 1',
          serviceContractId: 'contract-1',
          role: ServiceContractRole.PRIMARY,
          status: ServiceContractStatus.ACTIVE,
        },
      ],
    });

    await expect(
      service.getLocationOptions({
        actorId: 'admin',
        actorCompanyId: 'provider-1',
        actorRole: UserRole.ADMIN,
        clientCompanyIds: 'client-2',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('excludes inactive contours from options', async () => {
    const { service } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
        { id: 'client-active', name: 'Active', type: CompanyType.CLIENT },
        { id: 'client-inactive', name: 'Inactive', type: CompanyType.CLIENT },
      ],
      users: [{ id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN }],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
      linkedClients: [
        {
          linkedClientCompanyId: 'client-active',
          name: 'Active',
          serviceContractId: 'contract-active',
          role: ServiceContractRole.PRIMARY,
          status: ServiceContractStatus.ACTIVE,
        },
        {
          linkedClientCompanyId: 'client-inactive',
          name: 'Inactive',
          serviceContractId: 'contract-inactive',
          role: ServiceContractRole.SECONDARY,
          status: ServiceContractStatus.INACTIVE,
        },
      ],
    });

    await expect(
      service.getLocationOptions({
        actorId: 'admin',
        actorCompanyId: 'provider-1',
        actorRole: UserRole.ADMIN,
        clientCompanyIds: 'client-inactive',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('groups location options by client and city', async () => {
    const { service } = makeService({
      blocks,
      companies: [
        { id: 'provider-1', name: 'Provider', type: CompanyType.PROVIDER },
        { id: 'client-1', name: 'Client 1', type: CompanyType.CLIENT },
      ],
      users: [{ id: 'admin', companyId: 'provider-1', email: 'admin@example.com', role: UserRole.ADMIN }],
      rolePermissions: [{ role: UserRole.ADMIN, companyType: CompanyType.PROVIDER, code: PERMISSIONS.USERS_MANAGE }],
      locations: [
        { id: 'loc-1', clientCompanyId: 'client-1', name: 'Store A', city: 'Moscow', address: 'A street' },
        { id: 'loc-2', clientCompanyId: 'client-1', name: 'Store B', city: 'Moscow', address: 'B street' },
      ],
      linkedClients: [
        {
          linkedClientCompanyId: 'client-1',
          name: 'Client 1',
          serviceContractId: 'contract-1',
          role: ServiceContractRole.PRIMARY,
          status: ServiceContractStatus.ACTIVE,
        },
      ],
    });

    const options = await service.getLocationOptions({
      actorId: 'admin',
      actorCompanyId: 'provider-1',
      actorRole: UserRole.ADMIN,
      clientCompanyIds: 'client-1',
    });

    expect(options.clients).toHaveLength(1);
    expect(options.clients[0].cities).toHaveLength(1);
    expect(options.clients[0].cities[0].city).toBe('Moscow');
    expect(options.clients[0].cities[0].locations.map((location: any) => location.displayName)).toEqual(['Store A', 'Store B']);
  });

  it('extends permission catalog with backward-compatible product metadata', () => {
    const { service } = makeService({
      blocks,
      companies: [],
      users: [],
    });

    const catalog = service.getCatalog();
    const usersManage = catalog.find((item) => item.code === PERMISSIONS.USERS_MANAGE)!;
    expect(usersManage.name).toBeTruthy();
    expect(usersManage.category).toBeTruthy();
    expect(usersManage.businessLabel).toBe('Управление сотрудниками');
    expect(usersManage.productDomain).toBe('Сотрудники');
    expect(usersManage.riskLevel).toBe('high');
    expect(usersManage.recommendedRoles).toContain('ADMIN');
  });
});
