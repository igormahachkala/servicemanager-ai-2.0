import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CompanyType, ServiceContractRole, UserRole } from '@prisma/client';

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
type FakeLocation = { id: string; clientCompanyId: string; name: string; deletedAt?: Date | null };
type FakeBinding = { id: string; userId: string; companyId: string; locationId: string; createdAt: Date };

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
  linkedClients?: any[];
}) {
  const state = {
    ...seed,
    rolePermissions: seed.rolePermissions ?? [],
    userPermissions: seed.userPermissions ?? [],
    locations: seed.locations ?? [],
    bindings: seed.bindings ?? [],
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
        const clientCompanyId = args?.where?.clientCompanyId as string | undefined;
        return state.locations
          .filter((location) => (!ids ? true : ids.includes(location.id)))
          .filter((location) => (!clientCompanyId ? true : location.clientCompanyId === clientCompanyId))
          .filter((location) => (args?.where?.deletedAt === null ? !location.deletedAt : true))
          .map((location) => ({ ...location, platformCode: location.id, city: null, region: null, address: null, isActive: true, deletedAt: location.deletedAt ?? null }));
      }),
      count: jest.fn(async (args: any) => {
        const clientIds = args.where.clientCompanyId?.in as string[] | undefined;
        return state.locations.filter((location) => (!clientIds ? true : clientIds.includes(location.clientCompanyId))).length;
      }),
    },
    userLocationBinding: {
      findMany: jest.fn(async (args: any) => {
        const userId = args.where.userId;
        const companyId = args.where.companyId;
        const clientCompanyId = args.where.location?.clientCompanyId as string | undefined;
        return state.bindings
          .filter((binding) => binding.userId === userId)
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
              city: null,
              region: null,
              address: null,
              isActive: true,
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
  { id: 'pb-assign', code: PERMISSIONS.TICKETS_ASSIGN },
  { id: 'pb-users', code: PERMISSIONS.USERS_MANAGE },
  { id: 'pb-analytics', code: PERMISSIONS.ANALYTICS_VIEW },
  { id: 'pb-all-company', code: PERMISSIONS.TICKETS_VIEW_ALL_COMPANY },
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

  it('fails closed for empty location binding replacement in V1A', async () => {
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
    ).rejects.toBeInstanceOf(ConflictException);
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

  it('keeps provider preview fail-closed with no bindings and location count 0', async () => {
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

    expect(preview.locationBindings.mode).toBe('restricted_empty');
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
});
