import {
  NotificationChannel,
  NotificationContour,
  ServiceContractRole,
  UserRole,
} from '@prisma/client';

import { NOTIFICATION_EVENT_KEYS } from './notification-event-catalog';
import {
  NotificationPreferenceGate,
  shouldSuppress,
} from './notification-preference-gate';
import { NotificationPreferencesService } from './notification-preferences.service';

function makeGate(
  options: {
    users?: Array<{ id: string; role: UserRole }>;
    preferences?: Array<Record<string, any>>;
    contractRole?: ServiceContractRole | null;
  } = {},
) {
  const preferences = options.preferences ?? [];
  const prisma: any = {
    user: { findMany: jest.fn().mockResolvedValue(options.users ?? []) },
    userNotificationPreference: {
      count: jest
        .fn()
        .mockResolvedValue(
          preferences.filter((row) => row.enabled === false).length,
        ),
      findUnique: jest.fn(async ({ where }: any) => {
        const key = where.userId_contour_eventType_channel;
        return (
          preferences.find(
            (row) =>
              row.userId === key.userId &&
              row.contour === key.contour &&
              row.eventType === key.eventType &&
              row.channel === key.channel,
          ) ?? null
        );
      }),
    },
    companyNotificationRolePreference: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    pushPreference: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const serviceContracts: any = {
    getLinkedClientAccess: jest
      .fn()
      .mockResolvedValue(
        options.contractRole === null
          ? null
          : { role: options.contractRole ?? ServiceContractRole.PRIMARY },
      ),
  };
  return {
    prisma,
    serviceContracts,
    gate: new NotificationPreferenceGate(
      prisma,
      new NotificationPreferencesService(prisma),
      serviceContracts,
    ),
  };
}

function row(overrides: Record<string, any> = {}) {
  return {
    userId: 'user-1',
    companyId: 'client-company',
    type: 'ticket.comment_added',
    linkedClientCompanyId: null,
    ...overrides,
  };
}

describe('117O personal IN_APP preference gate', () => {
  it.each(NOTIFICATION_EVENT_KEYS)(
    '%s keeps exact current delivery when preferences are empty',
    async (eventType) => {
      const { gate, prisma } = makeGate({
        users: [{ id: 'user-1', role: UserRole.ADMIN }],
      });
      const input = [row({ type: eventType })];
      await expect(
        gate.filterRows(input, NotificationChannel.IN_APP),
      ).resolves.toEqual(input);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(
        prisma.userNotificationPreference.findUnique,
      ).not.toHaveBeenCalled();
    },
  );

  it('suppresses only an explicit user OFF row', async () => {
    const preference = {
      userId: 'user-1',
      contour: NotificationContour.CLIENT,
      eventType: 'ticket.comment_added',
      channel: NotificationChannel.IN_APP,
      enabled: false,
    };
    const { gate } = makeGate({
      users: [{ id: 'user-1', role: UserRole.ADMIN }],
      preferences: [preference],
    });
    await expect(
      gate.filterRows([row()], NotificationChannel.IN_APP),
    ).resolves.toEqual([]);
  });

  it('uses the canonical active contract contour for provider recipients', async () => {
    const preference = {
      userId: 'user-1',
      contour: NotificationContour.SECONDARY_PROVIDER,
      eventType: 'ticket.comment_added',
      channel: NotificationChannel.IN_APP,
      enabled: false,
    };
    const { gate, serviceContracts } = makeGate({
      users: [{ id: 'user-1', role: UserRole.DISPATCHER }],
      preferences: [preference],
      contractRole: ServiceContractRole.SECONDARY,
    });
    const input = row({
      companyId: 'provider',
      linkedClientCompanyId: 'client-company',
    });
    await expect(
      gate.filterRows([input], NotificationChannel.IN_APP),
    ).resolves.toEqual([]);
    expect(serviceContracts.getLinkedClientAccess).toHaveBeenCalledWith(
      'provider',
      'client-company',
    );
  });

  it('fails open for missing role, missing contract, and unknown event', async () => {
    const preference = {
      userId: 'user-1',
      contour: NotificationContour.PRIMARY_PROVIDER,
      eventType: 'ticket.created',
      channel: NotificationChannel.IN_APP,
      enabled: false,
    };
    const missingRole = makeGate({ preferences: [preference] });
    await expect(
      missingRole.gate.filterRows([row()], NotificationChannel.IN_APP),
    ).resolves.toHaveLength(1);

    const missingContract = makeGate({
      users: [{ id: 'user-1', role: UserRole.ADMIN }],
      preferences: [preference],
      contractRole: null,
    });
    await expect(
      missingContract.gate.filterRows(
        [
          row({
            companyId: 'provider',
            linkedClientCompanyId: 'client-company',
            type: 'ticket.created',
          }),
        ],
        NotificationChannel.IN_APP,
      ),
    ).resolves.toHaveLength(1);

    const unknown = makeGate({
      users: [{ id: 'user-1', role: UserRole.ADMIN }],
      preferences: [preference],
    });
    await expect(
      unknown.gate.filterRows(
        [row({ type: 'ticket.future' })],
        NotificationChannel.IN_APP,
      ),
    ).resolves.toHaveLength(1);
  });

  it('does not participate in PUSH or MAX delivery', async () => {
    const { gate, prisma } = makeGate({
      preferences: [{ enabled: false }],
      users: [{ id: 'user-1', role: UserRole.ADMIN }],
    });
    const input = [row()];
    await expect(
      gate.filterRows(input, NotificationChannel.PUSH),
    ).resolves.toEqual(input);
    await expect(
      gate.filterRows(input, NotificationChannel.MAX),
    ).resolves.toEqual(input);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('never adds a recipient', async () => {
    const { gate } = makeGate();
    await expect(
      gate.filterRows([], NotificationChannel.IN_APP),
    ).resolves.toEqual([]);
  });
});

describe('117O suppression source', () => {
  it('only USER_OVERRIDE=false suppresses', () => {
    expect(shouldSuppress({ enabled: false, source: 'USER_OVERRIDE' })).toBe(
      true,
    );
    expect(
      shouldSuppress({ enabled: false, source: 'COMPANY_ROLE_OVERRIDE' }),
    ).toBe(false);
    expect(shouldSuppress({ enabled: false, source: 'SYSTEM_DEFAULT' })).toBe(
      false,
    );
    expect(
      shouldSuppress({ enabled: false, source: 'LEGACY_PUSH_PREFERENCE' }),
    ).toBe(false);
    expect(shouldSuppress({ enabled: true, source: 'USER_OVERRIDE' })).toBe(
      false,
    );
  });
});
