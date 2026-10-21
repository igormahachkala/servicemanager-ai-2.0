/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyType,
  ServiceContractRole,
  ServiceContractStatus,
  UserAccessLocationMode,
  UserRole,
} from '@prisma/client';

import { TechniciansService } from './technicians.service';

type FakeCompany = { id: string; name: string; type: CompanyType };
type FakeUser = {
  id: string;
  companyId: string;
  role: UserRole;
  isActive?: boolean;
  deletedAt?: Date | null;
  isExecutor?: boolean;
};
type FakeLocation = {
  id: string;
  clientCompanyId: string;
  name: string;
  isActive?: boolean;
  deletedAt?: Date | null;
};
type FakeBinding = {
  id: string;
  userId: string;
  companyId: string;
  locationId: string;
  createdAt: Date;
};
type FakeAccessScope = {
  userId: string;
  companyId: string;
  locationMode: UserAccessLocationMode;
};
type FakeLinkedClient = {
  linkedClientCompanyId: string;
  role: ServiceContractRole;
  status: ServiceContractStatus;
};

function matchesCompanyIdFilter(filter: unknown, companyId: string) {
  if (!filter) return true;
  if (typeof filter === 'string') return filter === companyId;
  const values = (filter as { in?: string[] }).in;
  return Array.isArray(values) ? values.includes(companyId) : true;
}

function makeService(
  seed?: Partial<{
    accessScopes: FakeAccessScope[];
    bindings: FakeBinding[];
    linkedClients: FakeLinkedClient[];
    locations: FakeLocation[];
    users: FakeUser[];
  }>,
) {
  const state = {
    companies: [
      { id: 'provider-co', name: 'Provider', type: CompanyType.PROVIDER },
      { id: 'client-co', name: 'Client', type: CompanyType.CLIENT },
      { id: 'other-client-co', name: 'Other Client', type: CompanyType.CLIENT },
    ] satisfies FakeCompany[],
    users:
      seed?.users ??
      ([
        {
          id: 'tech-user',
          companyId: 'provider-co',
          role: UserRole.TECHNICIAN,
          isActive: true,
          deletedAt: null,
          isExecutor: true,
        },
      ] satisfies FakeUser[]),
    locations: seed?.locations ?? [
      { id: 'loc-a', clientCompanyId: 'client-co', name: 'Location A' },
      { id: 'loc-b', clientCompanyId: 'client-co', name: 'Location B' },
      {
        id: 'loc-foreign',
        clientCompanyId: 'other-client-co',
        name: 'Foreign Location',
      },
    ],
    bindings: seed?.bindings ?? [],
    accessScopes: seed?.accessScopes ?? [],
    linkedClients: seed?.linkedClients ?? [
      {
        linkedClientCompanyId: 'client-co',
        role: ServiceContractRole.PRIMARY,
        status: ServiceContractStatus.ACTIVE,
      },
    ],
  };

  const findLocation = (locationId: string) =>
    state.locations.find((location) => location.id === locationId);
  const matchesLocationFilter = (binding: FakeBinding, filter?: any) => {
    if (!filter) return true;
    const location = findLocation(binding.locationId);
    if (!location) return false;
    const clientCompanyId = filter.clientCompanyId;
    if (
      typeof clientCompanyId === 'string' &&
      location.clientCompanyId !== clientCompanyId
    )
      return false;
    if (
      Array.isArray(clientCompanyId?.in) &&
      !clientCompanyId.in.includes(location.clientCompanyId)
    )
      return false;
    if (filter.isActive === true && location.isActive === false) return false;
    if (filter.deletedAt === null && location.deletedAt) return false;
    return true;
  };

  const prisma: any = {
    user: {
      findFirst: jest.fn(async (args: any) => {
        const user = state.users.find((candidate) => {
          if (args.where.id && candidate.id !== args.where.id) return false;
          if (
            args.where.companyId &&
            candidate.companyId !== args.where.companyId
          )
            return false;
          if (args.where.isExecutor === true && candidate.isExecutor !== true)
            return false;
          if (args.where.isActive === true && candidate.isActive !== true)
            return false;
          if (args.where.deletedAt === null && candidate.deletedAt !== null)
            return false;
          if (
            Array.isArray(args.where.role?.in) &&
            !args.where.role.in.includes(candidate.role)
          )
            return false;
          if (
            typeof args.where.role === 'string' &&
            candidate.role !== args.where.role
          )
            return false;
          return true;
        });
        if (!user) return null;
        return {
          id: user.id,
          role: user.role,
          isExecutor: user.isExecutor ?? false,
          companyId: user.companyId,
        };
      }),
    },
    company: {
      findMany: jest.fn(async (args: any) => {
        const ids = args.where.id?.in as string[] | undefined;
        return state.companies.filter((company) => {
          if (ids && !ids.includes(company.id)) return false;
          if (args.where.type && company.type !== args.where.type) return false;
          return true;
        });
      }),
    },
    location: {
      findMany: jest.fn(async (args: any) => {
        const ids = args.where.id?.in as string[] | undefined;
        const clientCompanyId = args.where.clientCompanyId;
        return state.locations
          .filter((location) => (!ids ? true : ids.includes(location.id)))
          .filter((location) => {
            if (typeof clientCompanyId === 'string')
              return location.clientCompanyId === clientCompanyId;
            if (Array.isArray(clientCompanyId?.in))
              return clientCompanyId.in.includes(location.clientCompanyId);
            return true;
          })
          .filter((location) =>
            args.where.isActive === true ? location.isActive !== false : true,
          )
          .filter((location) =>
            args.where.deletedAt === null ? !location.deletedAt : true,
          )
          .map((location) => ({
            ...location,
            city: null,
            region: null,
            address: null,
            platformCode: location.id,
            externalCode: null,
            isActive: location.isActive ?? true,
            deletedAt: location.deletedAt ?? null,
          }));
      }),
    },
    problemCategory: {
      findMany: jest.fn(async () => []),
    },
    userLocationBinding: {
      findMany: jest.fn(async (args: any) => {
        const rows = state.bindings
          .filter((binding) =>
            !args.where.userId ? true : binding.userId === args.where.userId,
          )
          .filter((binding) =>
            matchesCompanyIdFilter(args.where.companyId, binding.companyId),
          )
          .filter((binding) =>
            matchesLocationFilter(binding, args.where.location),
          )
          .map((binding) => {
            const location = findLocation(binding.locationId)!;
            return {
              ...binding,
              location: {
                ...location,
                city: null,
                region: null,
                address: null,
                platformCode: location.id,
                externalCode: null,
                isActive: location.isActive ?? true,
                deletedAt: location.deletedAt ?? null,
              },
            };
          });
        return rows;
      }),
      deleteMany: jest.fn(async (args: any) => {
        const before = state.bindings.length;
        const locationIds = args.where.locationId?.in as string[] | undefined;
        state.bindings = state.bindings.filter((binding) => {
          if (args.where.userId && binding.userId !== args.where.userId)
            return true;
          if (
            args.where.companyId &&
            !matchesCompanyIdFilter(args.where.companyId, binding.companyId)
          )
            return true;
          if (locationIds && !locationIds.includes(binding.locationId))
            return true;
          if (
            args.where.location &&
            !matchesLocationFilter(binding, args.where.location)
          )
            return true;
          return false;
        });
        return { count: before - state.bindings.length };
      }),
      createMany: jest.fn(async (args: any) => {
        for (const item of args.data) {
          const exists = state.bindings.some(
            (binding) =>
              binding.userId === item.userId &&
              binding.locationId === item.locationId,
          );
          if (exists && args.skipDuplicates) continue;
          if (!exists) {
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
        const scope = state.accessScopes.find(
          (item) =>
            item.userId === key.userId && item.companyId === key.companyId,
        );
        return scope ? { locationMode: scope.locationMode } : null;
      }),
      upsert: jest.fn(async (args: any) => {
        const key = args.where.userId_companyId;
        const existing = state.accessScopes.find(
          (item) =>
            item.userId === key.userId && item.companyId === key.companyId,
        );
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
    $transaction: jest.fn(async (callback: any) => callback(prisma)),
  };

  const serviceContractsService: any = {
    getLinkedClientAccess: jest.fn(
      async (_providerCompanyId: string, clientCompanyId: string) =>
        state.linkedClients.find(
          (client) =>
            client.linkedClientCompanyId === clientCompanyId &&
            client.status === ServiceContractStatus.ACTIVE,
        ) ?? null,
    ),
    listPrimaryLinkedClientIds: jest.fn(async () =>
      state.linkedClients
        .filter(
          (client) =>
            client.status === ServiceContractStatus.ACTIVE &&
            client.role === ServiceContractRole.PRIMARY,
        )
        .map((client) => client.linkedClientCompanyId),
    ),
    assertPrimaryLinkedClientAccess: jest.fn(
      async (_providerCompanyId: string, clientCompanyId: string) => {
        const access = state.linkedClients.find(
          (client) =>
            client.linkedClientCompanyId === clientCompanyId &&
            client.status === ServiceContractStatus.ACTIVE &&
            client.role === ServiceContractRole.PRIMARY,
        );
        if (!access) throw new NotFoundException('Linked client not found');
        return access;
      },
    ),
  };

  return {
    service: new TechniciansService(prisma, serviceContractsService),
    prisma,
    state,
  };
}

describe('TechniciansService location bindings', () => {
  it('saves selected locations in provider scope and rereads the same active technician bindings', async () => {
    const { service, prisma, state } = makeService({
      bindings: [
        {
          id: 'legacy-binding',
          userId: 'tech-user',
          companyId: 'client-co',
          locationId: 'loc-b',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const response = await service.setLocationBindings(
      'provider-co',
      'tech-user',
      {
        companyId: 'client-co',
        locationIds: ['loc-a', 'loc-a'],
      },
    );

    expect(response.companyId).toBe('client-co');
    expect(response.locationIds).toEqual(['loc-a']);
    expect(response.locationScope).toBe('SELECTED_LOCATIONS');
    expect(response.locationScopeMode).toBe('SELECTED_LOCATIONS');
    expect(response.hasExplicitRestrictions).toBe(true);
    expect(state.bindings).toEqual([
      expect.objectContaining({
        userId: 'tech-user',
        companyId: 'provider-co',
        locationId: 'loc-a',
      }),
    ]);
    expect(state.accessScopes).toEqual([
      {
        userId: 'tech-user',
        companyId: 'provider-co',
        locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      },
    ]);
    expect(prisma.userLocationBinding.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'tech-user', locationId: 'loc-a', companyId: 'provider-co' },
      ],
      skipDuplicates: true,
    });
  });

  it('saves two selected locations and returns both from the read endpoint', async () => {
    const { service, state } = makeService();

    const response = await service.setLocationBindings(
      'provider-co',
      'tech-user',
      {
        companyId: 'client-co',
        locationIds: ['loc-a', 'loc-b'],
      },
    );

    expect(response).toMatchObject({
      companyId: 'client-co',
      locationIds: ['loc-a', 'loc-b'],
      locationScope: 'SELECTED_LOCATIONS',
      locationScopeMode: 'SELECTED_LOCATIONS',
      hasExplicitRestrictions: true,
    });
    expect(state.bindings).toEqual([
      expect.objectContaining({
        userId: 'tech-user',
        companyId: 'provider-co',
        locationId: 'loc-a',
      }),
      expect.objectContaining({
        userId: 'tech-user',
        companyId: 'provider-co',
        locationId: 'loc-b',
      }),
    ]);

    await expect(
      service.getLocationBindings('provider-co', 'tech-user', 'client-co'),
    ).resolves.toMatchObject({
      companyId: 'client-co',
      locationIds: ['loc-a', 'loc-b'],
      locationScopeMode: 'SELECTED_LOCATIONS',
    });
  });

  it('replaces a saved selected-location list without leaving stale or duplicate bindings', async () => {
    const { service, state } = makeService();

    await service.setLocationBindings('provider-co', 'tech-user', {
      companyId: 'client-co',
      locationIds: ['loc-a', 'loc-b'],
    });
    await service.setLocationBindings('provider-co', 'tech-user', {
      companyId: 'client-co',
      locationIds: ['loc-b', 'loc-b'],
    });

    expect(state.bindings).toEqual([
      expect.objectContaining({
        userId: 'tech-user',
        companyId: 'provider-co',
        locationId: 'loc-b',
      }),
    ]);
    await expect(
      service.getLocationBindings('provider-co', 'tech-user', 'client-co'),
    ).resolves.toMatchObject({
      companyId: 'client-co',
      locationIds: ['loc-b'],
      locationScope: 'SELECTED_LOCATIONS',
      locationScopeMode: 'SELECTED_LOCATIONS',
    });
  });

  it('keeps ALL company locations as the legacy read mode when no explicit scope or bindings exist', async () => {
    const { service } = makeService();

    await expect(
      service.getLocationBindings('provider-co', 'tech-user', 'client-co'),
    ).resolves.toMatchObject({
      companyId: 'client-co',
      locationIds: [],
      locationScope: 'ALL_COMPANY_LOCATIONS',
      locationScopeMode: 'LEGACY_AUTO',
      hasExplicitRestrictions: false,
    });
  });

  it('keeps legacy client-scope bindings readable only before an explicit access scope exists', async () => {
    const { service } = makeService({
      bindings: [
        {
          id: 'legacy-binding',
          userId: 'tech-user',
          companyId: 'client-co',
          locationId: 'loc-a',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    await expect(
      service.getLocationBindings('provider-co', 'tech-user', 'client-co'),
    ).resolves.toMatchObject({
      companyId: 'client-co',
      locationIds: ['loc-a'],
      locationScope: 'SELECTED_LOCATIONS',
      locationScopeMode: 'SELECTED_LOCATIONS',
      hasExplicitRestrictions: true,
    });
  });

  it('ignores legacy client-scope bindings after SELECTED_LOCATIONS is explicit', async () => {
    const { service } = makeService({
      accessScopes: [
        {
          userId: 'tech-user',
          companyId: 'provider-co',
          locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
        },
      ],
      bindings: [
        {
          id: 'legacy-binding',
          userId: 'tech-user',
          companyId: 'client-co',
          locationId: 'loc-a',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    await expect(
      service.getLocationBindings('provider-co', 'tech-user', 'client-co'),
    ).resolves.toMatchObject({
      companyId: 'client-co',
      locationIds: [],
      locationScope: 'SELECTED_LOCATIONS',
      locationScopeMode: 'SELECTED_LOCATIONS',
      hasExplicitRestrictions: true,
    });
  });

  it('keeps selected mode when clearing one client while another provider binding remains', async () => {
    const { service, state } = makeService({
      accessScopes: [
        {
          userId: 'tech-user',
          companyId: 'provider-co',
          locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
        },
      ],
      bindings: [
        {
          id: 'binding-other',
          userId: 'tech-user',
          companyId: 'provider-co',
          locationId: 'loc-foreign',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
      linkedClients: [
        {
          linkedClientCompanyId: 'client-co',
          role: ServiceContractRole.PRIMARY,
          status: ServiceContractStatus.ACTIVE,
        },
        {
          linkedClientCompanyId: 'other-client-co',
          role: ServiceContractRole.PRIMARY,
          status: ServiceContractStatus.ACTIVE,
        },
      ],
    });

    await expect(
      service.setLocationBindings('provider-co', 'tech-user', {
        companyId: 'client-co',
        locationIds: [],
      }),
    ).resolves.toMatchObject({
      companyId: 'client-co',
      locationIds: [],
      locationScope: 'SELECTED_LOCATIONS',
      locationScopeMode: 'SELECTED_LOCATIONS',
      hasExplicitRestrictions: true,
    });

    expect(state.bindings).toEqual([
      expect.objectContaining({
        userId: 'tech-user',
        companyId: 'provider-co',
        locationId: 'loc-foreign',
      }),
    ]);
    expect(state.accessScopes).toEqual([
      {
        userId: 'tech-user',
        companyId: 'provider-co',
        locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      },
    ]);
  });

  it('uses provider-scoped selected locations for mobile bound contexts', async () => {
    const { service } = makeService({
      accessScopes: [
        {
          userId: 'tech-user',
          companyId: 'provider-co',
          locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
        },
      ],
      bindings: [
        {
          id: 'binding-a',
          userId: 'tech-user',
          companyId: 'provider-co',
          locationId: 'loc-a',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    const contexts = await service.getBoundContexts('provider-co', 'tech-user');

    expect(contexts).toHaveLength(1);
    expect(contexts[0].locationScope).toBe('SELECTED_LOCATIONS');
    expect(contexts[0].locationScopeMode).toBe('SELECTED_LOCATIONS');
    expect(contexts[0].bindingCount).toBe(1);
    expect(
      contexts[0].locations.map((location: { id: string }) => location.id),
    ).toEqual(['loc-a']);
  });

  it('allows create scope for selected location and rejects another active contract location', async () => {
    const { service } = makeService({
      accessScopes: [
        {
          userId: 'tech-user',
          companyId: 'provider-co',
          locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
        },
      ],
      bindings: [
        {
          id: 'binding-a',
          userId: 'tech-user',
          companyId: 'provider-co',
          locationId: 'loc-a',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    await expect(
      service.resolveBoundCreateScope(
        'provider-co',
        'tech-user',
        'client-co',
        'loc-a',
      ),
    ).resolves.toEqual({
      companyId: 'client-co',
      locationScope: 'SELECTED_LOCATIONS',
      locationScopeMode: 'SELECTED_LOCATIONS',
    });
    await expect(
      service.resolveBoundCreateScope(
        'provider-co',
        'tech-user',
        'client-co',
        'loc-b',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects foreign selected locations without mutating bindings or access scope', async () => {
    const { service, state } = makeService();

    await expect(
      service.setLocationBindings('provider-co', 'tech-user', {
        companyId: 'client-co',
        locationIds: ['loc-foreign'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(state.bindings).toEqual([]);
    expect(state.accessScopes).toEqual([]);
  });

  it('saves empty selected list as RESTRICTED_EMPTY and disables legacy fallback', async () => {
    const { service, state } = makeService({
      bindings: [
        {
          id: 'legacy-binding',
          userId: 'tech-user',
          companyId: 'client-co',
          locationId: 'loc-a',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    await expect(
      service.setLocationBindings('provider-co', 'tech-user', {
        companyId: 'client-co',
        locationIds: [],
      }),
    ).resolves.toMatchObject({
      companyId: 'client-co',
      locationIds: [],
      locationScope: 'RESTRICTED_EMPTY',
      locationScopeMode: 'RESTRICTED_EMPTY',
      hasExplicitRestrictions: true,
    });

    expect(state.bindings).toEqual([]);
    expect(state.accessScopes).toEqual([
      {
        userId: 'tech-user',
        companyId: 'provider-co',
        locationMode: UserAccessLocationMode.RESTRICTED_EMPTY,
      },
    ]);

    await expect(
      service.getLocationBindings('provider-co', 'tech-user', 'client-co'),
    ).resolves.toMatchObject({
      locationIds: [],
      locationScope: 'RESTRICTED_EMPTY',
      locationScopeMode: 'RESTRICTED_EMPTY',
      hasExplicitRestrictions: true,
    });

    const contexts = await service.getBoundContexts(
      'provider-co',
      'tech-user',
      'client-co',
    );
    expect(contexts).toHaveLength(1);
    expect(contexts[0].locationScope).toBe('RESTRICTED_EMPTY');
    expect(contexts[0].locationScopeMode).toBe('RESTRICTED_EMPTY');
    expect(contexts[0].locations).toEqual([]);

    await expect(
      service.resolveBoundCreateScope(
        'provider-co',
        'tech-user',
        'client-co',
        'loc-a',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks inactive technicians from saving selected locations', async () => {
    const { service, state } = makeService({
      users: [
        {
          id: 'tech-user',
          companyId: 'provider-co',
          role: UserRole.TECHNICIAN,
          isActive: false,
          deletedAt: null,
          isExecutor: true,
        },
      ],
    });

    await expect(
      service.setLocationBindings('provider-co', 'tech-user', {
        companyId: 'client-co',
        locationIds: ['loc-a'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(state.bindings).toEqual([]);
    expect(state.accessScopes).toEqual([]);
  });

  it('blocks inactive technicians from saving empty restricted scope', async () => {
    const { service, state } = makeService({
      users: [
        {
          id: 'tech-user',
          companyId: 'provider-co',
          role: UserRole.TECHNICIAN,
          isActive: false,
          deletedAt: null,
          isExecutor: true,
        },
      ],
    });

    await expect(
      service.setLocationBindings('provider-co', 'tech-user', {
        companyId: 'client-co',
        locationIds: [],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(state.bindings).toEqual([]);
    expect(state.accessScopes).toEqual([]);
  });

  it('blocks inactive technicians from runtime contexts, create scope, and legacy fallback', async () => {
    const { service } = makeService({
      users: [
        {
          id: 'tech-user',
          companyId: 'provider-co',
          role: UserRole.TECHNICIAN,
          isActive: false,
          deletedAt: null,
          isExecutor: true,
        },
      ],
      bindings: [
        {
          id: 'legacy-binding',
          userId: 'tech-user',
          companyId: 'client-co',
          locationId: 'loc-a',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ],
    });

    await expect(
      service.getMe('provider-co', 'tech-user'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.getLocationBindings('provider-co', 'tech-user', 'client-co'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.getBoundContexts('provider-co', 'tech-user', 'client-co'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.resolveBoundCreateScope(
        'provider-co',
        'tech-user',
        'client-co',
        'loc-a',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks inactive target users for admin location-binding save', async () => {
    const { service } = makeService({
      users: [
        {
          id: 'master-user',
          companyId: 'provider-co',
          role: UserRole.MASTER,
          isActive: false,
          deletedAt: null,
          isExecutor: false,
        },
      ],
    });

    await expect(
      service.setLocationBindings('provider-co', 'master-user', {
        companyId: 'client-co',
        locationIds: ['loc-a'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks deleted technicians when deletedAt is set', async () => {
    const { service } = makeService({
      users: [
        {
          id: 'tech-user',
          companyId: 'provider-co',
          role: UserRole.TECHNICIAN,
          isActive: true,
          deletedAt: new Date('2026-01-02T00:00:00.000Z'),
          isExecutor: true,
        },
      ],
    });

    await expect(
      service.setLocationBindings('provider-co', 'tech-user', {
        companyId: 'client-co',
        locationIds: ['loc-a'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.getBoundContexts('provider-co', 'tech-user', 'client-co'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks inactive technicians from batch setBindings', async () => {
    const { service } = makeService({
      users: [
        {
          id: 'tech-user',
          companyId: 'provider-co',
          role: UserRole.TECHNICIAN,
          isActive: false,
          deletedAt: null,
          isExecutor: true,
        },
      ],
    });

    await expect(
      service.setBindings('provider-co', 'tech-user', [
        { clientCompanyId: 'client-co', locationIds: ['loc-a'] },
      ]),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows active SECONDARY linked-client contracts for direct saves and rereads selected bindings', async () => {
    const secondary = makeService({
      linkedClients: [
        {
          linkedClientCompanyId: 'client-co',
          role: ServiceContractRole.SECONDARY,
          status: ServiceContractStatus.ACTIVE,
        },
      ],
    });

    await expect(
      secondary.service.setLocationBindings('provider-co', 'tech-user', {
        companyId: 'client-co',
        locationIds: ['loc-a'],
      }),
    ).resolves.toMatchObject({
      companyId: 'client-co',
      locationIds: ['loc-a'],
      locationScope: 'SELECTED_LOCATIONS',
      locationScopeMode: 'SELECTED_LOCATIONS',
      hasExplicitRestrictions: true,
    });

    expect(secondary.state.bindings).toEqual([
      expect.objectContaining({
        userId: 'tech-user',
        companyId: 'provider-co',
        locationId: 'loc-a',
      }),
    ]);
    expect(secondary.state.accessScopes).toEqual([
      {
        userId: 'tech-user',
        companyId: 'provider-co',
        locationMode: UserAccessLocationMode.SELECTED_LOCATIONS,
      },
    ]);
    await expect(
      secondary.service.getLocationBindings(
        'provider-co',
        'tech-user',
        'client-co',
      ),
    ).resolves.toMatchObject({
      companyId: 'client-co',
      locationIds: ['loc-a'],
      locationScopeMode: 'SELECTED_LOCATIONS',
    });
  });

  it('rejects inactive linked-client contracts for direct saves', async () => {
    const inactive = makeService({
      linkedClients: [
        {
          linkedClientCompanyId: 'client-co',
          role: ServiceContractRole.PRIMARY,
          status: ServiceContractStatus.INACTIVE,
        },
      ],
    });

    await expect(
      inactive.service.setLocationBindings('provider-co', 'tech-user', {
        companyId: 'client-co',
        locationIds: ['loc-a'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects missing contracts and actors from another provider without mutating state', async () => {
    const missingContract = makeService({ linkedClients: [] });
    await expect(
      missingContract.service.setLocationBindings('provider-co', 'tech-user', {
        companyId: 'client-co',
        locationIds: ['loc-a'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(missingContract.state.bindings).toEqual([]);

    const foreignProvider = makeService();
    await expect(
      foreignProvider.service.setLocationBindings(
        'other-provider-co',
        'tech-user',
        {
          companyId: 'client-co',
          locationIds: ['loc-a'],
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(foreignProvider.state.bindings).toEqual([]);
  });

  it('rejects inactive and deleted selected locations', async () => {
    const { service, state } = makeService({
      locations: [
        {
          id: 'loc-inactive',
          clientCompanyId: 'client-co',
          name: 'Inactive Location',
          isActive: false,
          deletedAt: null,
        },
        {
          id: 'loc-deleted',
          clientCompanyId: 'client-co',
          name: 'Deleted Location',
          isActive: true,
          deletedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
    });

    await expect(
      service.setLocationBindings('provider-co', 'tech-user', {
        companyId: 'client-co',
        locationIds: ['loc-inactive'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.setLocationBindings('provider-co', 'tech-user', {
        companyId: 'client-co',
        locationIds: ['loc-deleted'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(state.bindings).toEqual([]);
    expect(state.accessScopes).toEqual([]);
  });
});
