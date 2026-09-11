import {
  CompanyType,
  NotificationChannel,
  NotificationContour,
  UserRole,
} from '@prisma/client';

import { ROLE_GRANTS } from '../common/permissions-matrix';
import { NotificationPreferencesService } from './notification-preferences.service';

type CompanyRow = { id: string; name: string; type: CompanyType };
type UserRow = {
  id: string;
  companyId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  isActive: boolean;
  deletedAt: Date | null;
};
type CompanyPreferenceRow = {
  companyId: string;
  contour: NotificationContour;
  role: UserRole;
  eventType: string;
  channel: NotificationChannel;
  enabled: boolean;
};
type UserPreferenceRow = {
  userId: string;
  companyId: string;
  contour: NotificationContour;
  eventType: string;
  channel: NotificationChannel;
  enabled: boolean;
};

const providerAdmin = {
  id: 'provider-admin',
  companyId: 'provider-1',
  role: UserRole.ADMIN,
};

const clientAdmin = {
  id: 'client-admin',
  companyId: 'client-1',
  role: UserRole.ADMIN,
};

function makePrisma(seed?: {
  companyPreferences?: CompanyPreferenceRow[];
  userPreferences?: UserPreferenceRow[];
}) {
  const companies: CompanyRow[] = [
    { id: 'provider-1', name: 'Подрядчик', type: CompanyType.PROVIDER },
    { id: 'provider-2', name: 'Другой подрядчик', type: CompanyType.PROVIDER },
    { id: 'client-1', name: 'Клиент', type: CompanyType.CLIENT },
  ];
  const users: UserRow[] = [
    {
      id: 'provider-admin',
      companyId: 'provider-1',
      email: 'admin@provider.test',
      firstName: 'Анна',
      lastName: 'Админ',
      role: UserRole.ADMIN,
      isActive: true,
      deletedAt: null,
    },
    {
      id: 'provider-master',
      companyId: 'provider-1',
      email: 'master@provider.test',
      firstName: 'Максим',
      lastName: 'Мастер',
      role: UserRole.MASTER,
      isActive: true,
      deletedAt: null,
    },
    {
      id: 'client-admin',
      companyId: 'client-1',
      email: 'admin@client.test',
      firstName: 'Кира',
      lastName: 'Клиент',
      role: UserRole.ADMIN,
      isActive: true,
      deletedAt: null,
    },
    {
      id: 'client-compat-admin',
      companyId: 'client-1',
      email: 'client-admin@client.test',
      firstName: 'Ольга',
      lastName: 'Совместимость',
      role: UserRole.CLIENT_ADMIN,
      isActive: true,
      deletedAt: null,
    },
  ];
  const companyPreferences = [...(seed?.companyPreferences ?? [])];
  const userPreferences = [...(seed?.userPreferences ?? [])];

  const findCompany = (id: string) =>
    companies.find((company) => company.id === id) ?? null;
  const matchesIn = <T>(actual: T, expected?: T | { in?: T[] }) => {
    if (!expected) return true;
    if (typeof expected === 'object' && 'in' in expected) {
      return !expected.in || expected.in.includes(actual);
    }
    return actual === expected;
  };

  const prisma = {
    company: {
      findUnique: jest.fn(({ where }: any) => findCompany(where.id)),
    },
    companyNotificationRolePreference: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(({ where }: any = {}) =>
        companyPreferences.filter(
          (pref) =>
            matchesIn(pref.companyId, where?.companyId) &&
            matchesIn(pref.contour, where?.contour) &&
            matchesIn(pref.role, where?.role) &&
            matchesIn(pref.eventType, where?.eventType) &&
            matchesIn(pref.channel, where?.channel),
        ),
      ),
      upsert: jest.fn(({ where, create, update }: any) => {
        const key = where.companyId_contour_role_eventType_channel;
        const existing = companyPreferences.find(
          (pref) =>
            pref.companyId === key.companyId &&
            pref.contour === key.contour &&
            pref.role === key.role &&
            pref.eventType === key.eventType &&
            pref.channel === key.channel,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        companyPreferences.push({
          companyId: create.companyId,
          contour: create.contour,
          role: create.role,
          eventType: create.eventType,
          channel: create.channel,
          enabled: create.enabled,
        });
        return create;
      }),
      deleteMany: jest.fn(({ where }: any) => {
        const before = companyPreferences.length;
        for (
          let index = companyPreferences.length - 1;
          index >= 0;
          index -= 1
        ) {
          const pref = companyPreferences[index];
          if (
            pref.companyId === where.companyId &&
            pref.contour === where.contour &&
            pref.role === where.role &&
            pref.eventType === where.eventType &&
            pref.channel === where.channel
          ) {
            companyPreferences.splice(index, 1);
          }
        }
        return { count: before - companyPreferences.length };
      }),
    },
    userNotificationPreference: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(({ where }: any = {}) =>
        userPreferences.filter(
          (pref) =>
            matchesIn(pref.userId, where?.userId) &&
            matchesIn(pref.companyId, where?.companyId) &&
            matchesIn(pref.contour, where?.contour) &&
            matchesIn(pref.eventType, where?.eventType) &&
            matchesIn(pref.channel, where?.channel),
        ),
      ),
      upsert: jest.fn(({ where, create, update }: any) => {
        const key = where.userId_contour_eventType_channel;
        const existing = userPreferences.find(
          (pref) =>
            pref.userId === key.userId &&
            pref.contour === key.contour &&
            pref.eventType === key.eventType &&
            pref.channel === key.channel,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        userPreferences.push({
          userId: create.userId,
          companyId: create.companyId,
          contour: create.contour,
          eventType: create.eventType,
          channel: create.channel,
          enabled: create.enabled,
        });
        return create;
      }),
      deleteMany: jest.fn(({ where }: any) => {
        const before = userPreferences.length;
        for (let index = userPreferences.length - 1; index >= 0; index -= 1) {
          const pref = userPreferences[index];
          if (
            pref.userId === where.userId &&
            pref.contour === where.contour &&
            pref.eventType === where.eventType &&
            pref.channel === where.channel
          ) {
            userPreferences.splice(index, 1);
          }
        }
        return { count: before - userPreferences.length };
      }),
    },
    user: {
      findUnique: jest.fn(({ where }: any) => {
        const user = users.find((candidate) => candidate.id === where.id);
        if (!user) return null;
        return {
          ...user,
          company: findCompany(user.companyId),
        };
      }),
      findMany: jest.fn(),
    },
    pushPreference: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    notification: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
  };

  return {
    companyPreferences,
    userPreferences,
    prisma,
    service: new NotificationPreferencesService(prisma as any),
  };
}

function findCompanyCell(
  matrix: Awaited<
    ReturnType<NotificationPreferencesService['getCompanyRoleMatrix']>
  >,
  params: {
    contour: NotificationContour;
    role: UserRole;
    eventType: string;
    channel: NotificationChannel;
  },
) {
  return matrix.contours
    .find((contour) => contour.key === params.contour)
    ?.roles.find((role) => role.key === params.role)
    ?.preferences.find(
      (cell) =>
        cell.eventType === params.eventType && cell.channel === params.channel,
    );
}

function findUserCell(
  matrix: Awaited<
    ReturnType<NotificationPreferencesService['getMyPreferences']>
  >,
  params: {
    contour: NotificationContour;
    eventType: string;
    channel: NotificationChannel;
  },
) {
  return matrix.contours
    .find((contour) => contour.key === params.contour)
    ?.preferences.find(
      (cell) =>
        cell.eventType === params.eventType && cell.channel === params.channel,
    );
}

describe('NotificationPreferencesService settings API support', () => {
  it('exposes only user-addressable channels as configurable and classifies MAX as a shared broadcast', () => {
    const { service } = makePrisma();
    const catalog = service.getPreferenceCatalog(providerAdmin);

    expect(catalog.channels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: NotificationChannel.IN_APP,
          labelRu: 'В сервисе',
          configurableByUser: true,
          deliveryKind: 'USER_ADDRESSABLE',
        }),
        expect.objectContaining({
          key: NotificationChannel.PUSH,
          labelRu: 'Push',
          configurableByUser: true,
          deliveryKind: 'USER_ADDRESSABLE',
        }),
        expect.objectContaining({
          key: NotificationChannel.MAX,
          labelRu: 'MAX',
          configurableByUser: false,
          deliveryKind: 'SHARED_OPERATIONAL_BROADCAST',
        }),
      ]),
    );
  });

  it('returns the CLIENT matrix with CLIENT_ADMIN representable but without role grants', async () => {
    const { service } = makePrisma();

    const matrix = await service.getCompanyRoleMatrix(clientAdmin);

    expect(matrix.contours.map((contour) => contour.key)).toEqual([
      NotificationContour.CLIENT,
    ]);
    expect(
      matrix.contours[0].roles.map((role) => [role.key, role.labelRu]),
    ).toEqual(
      expect.arrayContaining([
        [UserRole.ADMIN, 'Администратор'],
        [UserRole.CLIENT_ADMIN, 'Администратор клиента'],
        [UserRole.NETWORK_DIRECTOR, 'Сетевой директор'],
        [UserRole.TERRITORIAL_MANAGER, 'Территориальный менеджер'],
        [UserRole.CLIENT, 'Клиент'],
        [UserRole.STAFF, 'Сотрудник'],
      ]),
    );
    expect(
      ROLE_GRANTS.some((grant) => grant.role === UserRole.CLIENT_ADMIN),
    ).toBe(false);
  });

  it('returns PRIMARY and SECONDARY provider matrices without exposing the CLIENT contour', async () => {
    const { service } = makePrisma();

    const matrix = await service.getCompanyRoleMatrix(providerAdmin);

    expect(matrix.contours.map((contour) => contour.key)).toEqual([
      NotificationContour.PRIMARY_PROVIDER,
      NotificationContour.SECONDARY_PROVIDER,
    ]);
    expect(
      matrix.contours.flatMap((contour) =>
        contour.roles.map((role) => [contour.key, role.key]),
      ),
    ).toEqual(
      expect.arrayContaining([
        [NotificationContour.PRIMARY_PROVIDER, UserRole.ADMIN],
        [NotificationContour.PRIMARY_PROVIDER, UserRole.DISPATCHER],
        [NotificationContour.PRIMARY_PROVIDER, UserRole.MASTER],
        [NotificationContour.PRIMARY_PROVIDER, UserRole.TECHNICIAN],
        [NotificationContour.SECONDARY_PROVIDER, UserRole.ADMIN],
        [NotificationContour.SECONDARY_PROVIDER, UserRole.TECHNICIAN],
      ]),
    );
  });

  it('blocks non-admin company-role management and cross-tenant management', async () => {
    const { service } = makePrisma();

    await expect(
      service.getCompanyRoleMatrix({
        id: 'provider-master',
        companyId: 'provider-1',
        role: UserRole.MASTER,
      }),
    ).rejects.toThrow('Недостаточно прав');

    await expect(
      service.getCompanyRoleMatrix(providerAdmin, 'client-1'),
    ).rejects.toThrow('Нельзя настраивать чужую компанию');
  });

  it('updates company-role overrides and can return them to inherited state', async () => {
    const { companyPreferences, service } = makePrisma();

    const updated = await service.updateCompanyRolePreference(providerAdmin, {
      contour: NotificationContour.PRIMARY_PROVIDER,
      role: UserRole.ADMIN,
      eventType: 'ticket.comment_added',
      channel: NotificationChannel.IN_APP,
      enabled: false,
    });
    const disabledCell = findCompanyCell(updated, {
      contour: NotificationContour.PRIMARY_PROVIDER,
      role: UserRole.ADMIN,
      eventType: 'ticket.comment_added',
      channel: NotificationChannel.IN_APP,
    });

    expect(companyPreferences).toHaveLength(1);
    expect(disabledCell).toMatchObject({
      productDefaultEnabled: false,
      overrideEnabled: false,
      settingsEffectiveEnabled: false,
      deliveryEnabled: false,
      deliverySource: 'COMPANY_ROLE_OVERRIDE',
    });

    const inherited = await service.updateCompanyRolePreference(providerAdmin, {
      contour: NotificationContour.PRIMARY_PROVIDER,
      role: UserRole.ADMIN,
      eventType: 'ticket.comment_added',
      channel: NotificationChannel.IN_APP,
      enabled: null,
    });
    const inheritedCell = findCompanyCell(inherited, {
      contour: NotificationContour.PRIMARY_PROVIDER,
      role: UserRole.ADMIN,
      eventType: 'ticket.comment_added',
      channel: NotificationChannel.IN_APP,
    });

    expect(companyPreferences).toHaveLength(0);
    expect(inheritedCell).toMatchObject({
      productDefaultEnabled: false,
      overrideEnabled: null,
      settingsEffectiveEnabled: false,
      deliveryEnabled: true,
      deliverySource: 'CURRENT_DELIVERY_DEFAULT',
    });
  });

  it('lets a user override beat company-role preference without adding recipients', async () => {
    const { prisma, service, userPreferences } = makePrisma({
      companyPreferences: [
        {
          companyId: 'provider-1',
          contour: NotificationContour.PRIMARY_PROVIDER,
          role: UserRole.MASTER,
          eventType: 'ticket.assigned',
          channel: NotificationChannel.PUSH,
          enabled: false,
        },
      ],
    });

    const result = await service.updateMyPreference(
      {
        id: 'provider-master',
        companyId: 'provider-1',
        role: UserRole.MASTER,
      },
      {
        contour: NotificationContour.PRIMARY_PROVIDER,
        eventType: 'ticket.assigned',
        channel: NotificationChannel.PUSH,
        enabled: true,
      },
    );
    const cell = findUserCell(result, {
      contour: NotificationContour.PRIMARY_PROVIDER,
      eventType: 'ticket.assigned',
      channel: NotificationChannel.PUSH,
    });

    expect(userPreferences).toHaveLength(1);
    expect(cell).toMatchObject({
      productDefaultEnabled: true,
      companyRoleOverrideEnabled: false,
      userOverrideEnabled: true,
      settingsEffectiveEnabled: true,
      deliveryEnabled: true,
      deliverySource: 'USER_OVERRIDE',
    });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('preserves current delivery for unconfigured companies while exposing product defaults', async () => {
    const { service } = makePrisma();

    const matrix = await service.getCompanyRoleMatrix(providerAdmin);
    const cell = findCompanyCell(matrix, {
      contour: NotificationContour.PRIMARY_PROVIDER,
      role: UserRole.ADMIN,
      eventType: 'ticket.comment_added',
      channel: NotificationChannel.IN_APP,
    });

    expect(cell).toMatchObject({
      productDefaultEnabled: false,
      overrideEnabled: null,
      settingsEffectiveEnabled: false,
      deliveryEnabled: true,
      deliverySource: 'CURRENT_DELIVERY_DEFAULT',
    });
  });

  it('rejects unsupported MAX user-level updates', async () => {
    const { prisma, service } = makePrisma();

    await expect(
      service.updateMyPreference(providerAdmin, {
        contour: NotificationContour.PRIMARY_PROVIDER,
        eventType: 'ticket.created',
        channel: NotificationChannel.MAX,
        enabled: false,
      }),
    ).rejects.toThrow('Канал нельзя настраивать');

    expect(prisma.userNotificationPreference.upsert).not.toHaveBeenCalled();
  });

  it('rejects unknown events fail-closed before storing overrides', async () => {
    const { prisma, service } = makePrisma();

    await expect(
      service.updateCompanyRolePreference(providerAdmin, {
        contour: NotificationContour.PRIMARY_PROVIDER,
        role: UserRole.ADMIN,
        eventType: 'ticket.mentioned',
        channel: NotificationChannel.IN_APP,
        enabled: true,
      }),
    ).rejects.toThrow('Неизвестное событие');

    expect(
      prisma.companyNotificationRolePreference.upsert,
    ).not.toHaveBeenCalled();
  });

  it('represents CLIENT_ADMIN personal settings without adding unrelated grants', async () => {
    const { service } = makePrisma();

    const result = await service.getMyPreferences({
      id: 'client-compat-admin',
      companyId: 'client-1',
      role: UserRole.CLIENT_ADMIN,
    });

    expect(result.contours.map((contour) => contour.key)).toEqual([
      NotificationContour.CLIENT,
    ]);
    expect(result.user.roleLabelRu).toBe('Администратор клиента');
    expect(
      ROLE_GRANTS.some((grant) => grant.role === UserRole.CLIENT_ADMIN),
    ).toBe(false);
  });
});
