import {
  NotificationChannel,
  NotificationContour,
  UserRole,
} from '@prisma/client';

import { ROLE_GRANTS } from '../common/permissions-matrix';
import { NotificationPreferencesService } from './notification-preferences.service';

type PreferenceMockConfig = {
  companyOverride?: { enabled: boolean } | null;
  userOverride?: { enabled: boolean } | null;
  legacyPreference?: Record<string, boolean | null> | null;
  companyOverrides?: Array<{
    companyId?: string;
    contour?: NotificationContour;
    role?: UserRole;
    eventType?: string;
    channel?: NotificationChannel;
    enabled: boolean;
  }>;
  userOverrides?: Array<{
    userId?: string;
    contour?: NotificationContour;
    eventType?: string;
    channel?: NotificationChannel;
    enabled: boolean;
  }>;
  legacyPreferences?: Array<Record<string, boolean | string | null>>;
};

const baseInput = {
  companyId: 'company-1',
  contour: NotificationContour.CLIENT,
  role: UserRole.TERRITORIAL_MANAGER,
  userId: 'user-1',
  eventType: 'ticket.created',
  channel: NotificationChannel.IN_APP,
};

function makePrisma(config: PreferenceMockConfig = {}) {
  const companyOverrides = (config.companyOverrides ?? []).map((override) => ({
    companyId: override.companyId ?? baseInput.companyId,
    contour: override.contour ?? baseInput.contour,
    role: override.role ?? baseInput.role,
    eventType: override.eventType ?? baseInput.eventType,
    channel: override.channel ?? baseInput.channel,
    enabled: override.enabled,
  }));
  const userOverrides = (config.userOverrides ?? []).map((override) => ({
    userId: override.userId ?? baseInput.userId,
    contour: override.contour ?? baseInput.contour,
    eventType: override.eventType ?? baseInput.eventType,
    channel: override.channel ?? baseInput.channel,
    enabled: override.enabled,
  }));
  const legacyPreferences = config.legacyPreferences ?? [];

  return {
    companyNotificationRolePreference: {
      findUnique: jest.fn().mockResolvedValue(config.companyOverride ?? null),
      findMany: jest.fn().mockResolvedValue(companyOverrides),
    },
    userNotificationPreference: {
      findUnique: jest.fn().mockResolvedValue(config.userOverride ?? null),
      findMany: jest.fn().mockResolvedValue(userOverrides),
    },
    pushPreference: {
      findUnique: jest.fn().mockResolvedValue(config.legacyPreference ?? null),
      findMany: jest.fn().mockResolvedValue(legacyPreferences),
    },
    notification: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };
}

function makeService(config: PreferenceMockConfig = {}) {
  const prisma = makePrisma(config);
  return {
    prisma,
    service: new NotificationPreferencesService(prisma as any),
  };
}

describe('NotificationPreferencesService', () => {
  it('resolves system defaults when no override exists', async () => {
    const { service } = makeService();

    await expect(service.resolvePreference(baseInput)).resolves.toEqual({
      enabled: true,
      source: 'SYSTEM_DEFAULT',
    });
  });

  it('applies a company role override over the system default', async () => {
    const { prisma, service } = makeService({
      companyOverride: { enabled: true },
    });

    await expect(
      service.resolvePreference({
        ...baseInput,
        userId: null,
        contour: NotificationContour.PRIMARY_PROVIDER,
        role: UserRole.ADMIN,
        eventType: 'ticket.comment_added',
      }),
    ).resolves.toEqual({
      enabled: true,
      source: 'COMPANY_ROLE_OVERRIDE',
    });

    expect(prisma.userNotificationPreference.findUnique).not.toHaveBeenCalled();
  });

  it('applies a user override over a company role override', async () => {
    const { service } = makeService({
      companyOverride: { enabled: false },
      userOverride: { enabled: true },
    });

    await expect(service.resolvePreference(baseInput)).resolves.toEqual({
      enabled: true,
      source: 'USER_OVERRIDE',
    });
  });

  it('keeps inherited disabled system defaults when overrides are absent', async () => {
    const { service } = makeService();

    await expect(
      service.resolvePreference({
        ...baseInput,
        role: UserRole.ADMIN,
        userId: null,
        eventType: 'ticket.comment_added',
      }),
    ).resolves.toEqual({
      enabled: false,
      source: 'SYSTEM_DEFAULT',
    });
  });

  it.each([
    [
      NotificationContour.CLIENT,
      UserRole.TERRITORIAL_MANAGER,
      'ticket.created',
    ],
    [
      NotificationContour.PRIMARY_PROVIDER,
      UserRole.DISPATCHER,
      'ticket.sla_warning',
    ],
    [
      NotificationContour.SECONDARY_PROVIDER,
      UserRole.MASTER,
      'ticket.assigned',
    ],
  ])('supports %s contour resolution', async (contour, role, eventType) => {
    const { service } = makeService();

    await expect(
      service.resolvePreference({
        ...baseInput,
        userId: null,
        contour,
        role,
        eventType,
      }),
    ).resolves.toEqual({
      enabled: true,
      source: 'SYSTEM_DEFAULT',
    });
  });

  it.each([
    NotificationChannel.IN_APP,
    NotificationChannel.PUSH,
    NotificationChannel.MAX,
  ])('supports %s channel resolution', async (channel) => {
    const { service } = makeService();

    await expect(
      service.resolvePreference({
        ...baseInput,
        userId: null,
        contour: NotificationContour.PRIMARY_PROVIDER,
        role: UserRole.DISPATCHER,
        eventType: 'ticket.assigned',
        channel,
      }),
    ).resolves.toEqual({
      enabled: true,
      source: 'SYSTEM_DEFAULT',
    });
  });

  it('honors disabled user overrides', async () => {
    const { service } = makeService({
      companyOverride: { enabled: true },
      userOverride: { enabled: false },
    });

    await expect(service.resolvePreference(baseInput)).resolves.toEqual({
      enabled: false,
      source: 'USER_OVERRIDE',
    });
  });

  it('does not create recipients or notification records', async () => {
    const { prisma, service } = makeService({
      companyOverride: { enabled: true },
    });

    await expect(service.isNotificationEnabled(baseInput)).resolves.toBe(true);

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('fails closed for unknown notification events without database reads', async () => {
    const { prisma, service } = makeService();

    await expect(
      service.resolvePreference({
        ...baseInput,
        eventType: 'ticket.mentioned',
      }),
    ).resolves.toEqual({
      enabled: false,
      source: 'UNKNOWN_EVENT',
    });

    expect(
      prisma.companyNotificationRolePreference.findUnique,
    ).not.toHaveBeenCalled();
    expect(prisma.userNotificationPreference.findUnique).not.toHaveBeenCalled();
    expect(prisma.pushPreference.findUnique).not.toHaveBeenCalled();
  });

  it('represents CLIENT_ADMIN preferences without changing role grants', async () => {
    const { service } = makeService({
      companyOverride: { enabled: true },
    });

    expect(
      ROLE_GRANTS.some((grant) => grant.role === UserRole.CLIENT_ADMIN),
    ).toBe(false);
    await expect(
      service.resolvePreference({
        ...baseInput,
        role: UserRole.CLIENT_ADMIN,
        eventType: 'ticket.created',
      }),
    ).resolves.toEqual({
      enabled: true,
      source: 'COMPANY_ROLE_OVERRIDE',
    });
  });

  it('preserves legacy disabled push preferences as a push-only user fallback', async () => {
    const { service } = makeService({
      legacyPreference: { ticketNew: false },
    });

    await expect(
      service.resolvePreference({
        ...baseInput,
        channel: NotificationChannel.PUSH,
      }),
    ).resolves.toEqual({
      enabled: false,
      source: 'LEGACY_PUSH_PREFERENCE',
    });
  });

  it('does not apply legacy push preferences to in-app notifications', async () => {
    const { prisma, service } = makeService({
      legacyPreference: { ticketNew: false },
    });

    await expect(service.resolvePreference(baseInput)).resolves.toEqual({
      enabled: true,
      source: 'SYSTEM_DEFAULT',
    });
    expect(prisma.pushPreference.findUnique).not.toHaveBeenCalled();
  });

  it('does not let legacy enabled push defaults override explicit V2 disables', async () => {
    const { service } = makeService({
      companyOverride: { enabled: false },
      legacyPreference: { ticketNew: true },
    });

    await expect(
      service.resolvePreference({
        ...baseInput,
        channel: NotificationChannel.PUSH,
      }),
    ).resolves.toEqual({
      enabled: false,
      source: 'COMPANY_ROLE_OVERRIDE',
    });
  });

  it('delivery resolution preserves current behavior when no override rows exist', async () => {
    const { service } = makeService();

    await expect(
      service.resolveDeliveryPreference({
        ...baseInput,
        role: UserRole.ADMIN,
        eventType: 'ticket.comment_added',
      }),
    ).resolves.toEqual({
      enabled: true,
      source: 'CURRENT_DELIVERY_DEFAULT',
    });
  });

  it('delivery resolution applies a company-role override', async () => {
    const { service } = makeService({
      companyOverrides: [{ enabled: false }],
    });

    await expect(service.resolveDeliveryPreference(baseInput)).resolves.toEqual(
      {
        enabled: false,
        source: 'COMPANY_ROLE_OVERRIDE',
      },
    );
  });

  it('delivery resolution lets user override beat company-role override', async () => {
    const { service } = makeService({
      companyOverrides: [{ enabled: false }],
      userOverrides: [{ enabled: true }],
    });

    await expect(service.resolveDeliveryPreference(baseInput)).resolves.toEqual(
      {
        enabled: true,
        source: 'USER_OVERRIDE',
      },
    );
  });

  it('delivery resolution preserves migrated legacy PUSH=false compatibility', async () => {
    const { service } = makeService({
      legacyPreferences: [{ userId: baseInput.userId, ticketNew: false }],
    });

    await expect(
      service.resolveDeliveryPreference({
        ...baseInput,
        channel: NotificationChannel.PUSH,
      }),
    ).resolves.toEqual({
      enabled: false,
      source: 'LEGACY_PUSH_PREFERENCE',
    });
  });

  it('delivery resolution batches override lookups for recipient fan-out', async () => {
    const { prisma, service } = makeService({
      companyOverrides: [
        {
          companyId: 'company-2',
          contour: NotificationContour.PRIMARY_PROVIDER,
          role: UserRole.DISPATCHER,
          eventType: 'ticket.assigned',
          channel: NotificationChannel.PUSH,
          enabled: false,
        },
      ],
      userOverrides: [
        {
          userId: 'user-3',
          contour: NotificationContour.SECONDARY_PROVIDER,
          eventType: 'ticket.sla_warning',
          channel: NotificationChannel.IN_APP,
          enabled: false,
        },
      ],
    });

    const decisions = await service.resolveDeliveryPreferences([
      baseInput,
      {
        companyId: 'company-2',
        contour: NotificationContour.PRIMARY_PROVIDER,
        role: UserRole.DISPATCHER,
        userId: 'user-2',
        eventType: 'ticket.assigned',
        channel: NotificationChannel.PUSH,
      },
      {
        companyId: 'company-3',
        contour: NotificationContour.SECONDARY_PROVIDER,
        role: UserRole.MASTER,
        userId: 'user-3',
        eventType: 'ticket.sla_warning',
        channel: NotificationChannel.IN_APP,
      },
    ]);

    expect(decisions).toEqual([
      { enabled: true, source: 'CURRENT_DELIVERY_DEFAULT' },
      { enabled: false, source: 'COMPANY_ROLE_OVERRIDE' },
      { enabled: false, source: 'USER_OVERRIDE' },
    ]);
    expect(
      prisma.companyNotificationRolePreference.findMany,
    ).toHaveBeenCalledTimes(1);
    expect(prisma.userNotificationPreference.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.pushPreference.findMany).toHaveBeenCalledTimes(1);
  });

  it('delivery resolution fails closed for unknown events without database reads', async () => {
    const { prisma, service } = makeService();

    await expect(
      service.resolveDeliveryPreference({
        ...baseInput,
        eventType: 'ticket.mentioned',
      }),
    ).resolves.toEqual({
      enabled: false,
      source: 'UNKNOWN_EVENT',
    });

    expect(
      prisma.companyNotificationRolePreference.findMany,
    ).not.toHaveBeenCalled();
    expect(prisma.userNotificationPreference.findMany).not.toHaveBeenCalled();
    expect(prisma.pushPreference.findMany).not.toHaveBeenCalled();
  });
});
