import {
  NotificationChannel,
  NotificationContour,
  ServiceContractRole,
  UserRole,
} from '@prisma/client';

import { NotificationPreferenceGate, shouldSuppress } from './notification-preference-gate';
import { NotificationPreferencesService } from './notification-preferences.service';

/**
 * SMA-NOTIFICATION-PREFERENCES-V2-105B.
 *
 * Ворота стоят после разрешения доступа и умеют только убирать получателя.
 * Тесты держат именно это свойство: настройка сужает, но никогда не расширяет.
 */

const TICKET_CLIENT_CO = 'client-co';
const PRIMARY_CO = 'primary-provider-co';
const SECONDARY_CO = 'secondary-provider-co';

function makeGate(options: {
  users?: Array<{ id: string; role: UserRole }>;
  userPreferences?: Array<Record<string, any>>;
  companyPreferences?: Array<Record<string, any>>;
  contractRole?: ServiceContractRole | null;
  pushPreference?: Record<string, boolean> | null;
} = {}) {
  const users = options.users ?? [];
  const userPreferences = options.userPreferences ?? [];
  const companyPreferences = options.companyPreferences ?? [];

  const prisma: any = {
    user: {
      findMany: jest.fn().mockResolvedValue(users),
    },
    userNotificationPreference: {
      count: jest.fn().mockResolvedValue(userPreferences.length),
      findUnique: jest.fn(async ({ where }: any) => {
        const key = where.userId_contour_eventType_channel;
        return (
          userPreferences.find(
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
      count: jest.fn().mockResolvedValue(companyPreferences.length),
      findUnique: jest.fn(async ({ where }: any) => {
        const key = where.companyId_contour_role_eventType_channel;
        return (
          companyPreferences.find(
            (row) =>
              row.companyId === key.companyId &&
              row.contour === key.contour &&
              row.role === key.role &&
              row.eventType === key.eventType &&
              row.channel === key.channel,
          ) ?? null
        );
      }),
    },
    pushPreference: {
      findUnique: jest.fn().mockResolvedValue(options.pushPreference ?? null),
    },
  };

  const serviceContracts: any = {
    getLinkedClientAccess: jest.fn(async () =>
      options.contractRole === null
        ? null
        : { role: options.contractRole ?? ServiceContractRole.PRIMARY },
    ),
  };

  const preferences = new NotificationPreferencesService(prisma);
  return {
    prisma,
    serviceContracts,
    gate: new NotificationPreferenceGate(prisma, preferences, serviceContracts),
  };
}

function row(overrides: Record<string, any> = {}) {
  return {
    userId: 'user-1',
    companyId: TICKET_CLIENT_CO,
    type: 'ticket.comment_added',
    linkedClientCompanyId: null,
    ...overrides,
  };
}

describe('105B ворота настроек: подавление', () => {
  it('выключенная пользователем настройка гасит валидное уведомление', async () => {
    const { gate } = makeGate({
      users: [{ id: 'user-1', role: UserRole.ADMIN }],
      userPreferences: [
        {
          userId: 'user-1',
          contour: NotificationContour.CLIENT,
          eventType: 'ticket.comment_added',
          channel: NotificationChannel.IN_APP,
          enabled: false,
        },
      ],
    });

    await expect(gate.filterRows([row()], NotificationChannel.IN_APP)).resolves.toEqual([]);
  });

  it('выключенная настройка роли компании гасит уведомление', async () => {
    const { gate } = makeGate({
      users: [{ id: 'user-1', role: UserRole.DISPATCHER }],
      companyPreferences: [
        {
          companyId: PRIMARY_CO,
          contour: NotificationContour.PRIMARY_PROVIDER,
          role: UserRole.DISPATCHER,
          eventType: 'ticket.created',
          channel: NotificationChannel.IN_APP,
          enabled: false,
        },
      ],
    });

    const candidate = row({
      companyId: PRIMARY_CO,
      type: 'ticket.created',
      linkedClientCompanyId: TICKET_CLIENT_CO,
    });

    await expect(gate.filterRows([candidate], NotificationChannel.IN_APP)).resolves.toEqual([]);
  });

  it('личная настройка перебивает настройку роли компании', async () => {
    const { gate } = makeGate({
      users: [{ id: 'user-1', role: UserRole.DISPATCHER }],
      companyPreferences: [
        {
          companyId: PRIMARY_CO,
          contour: NotificationContour.PRIMARY_PROVIDER,
          role: UserRole.DISPATCHER,
          eventType: 'ticket.created',
          channel: NotificationChannel.IN_APP,
          enabled: false,
        },
      ],
      userPreferences: [
        {
          userId: 'user-1',
          contour: NotificationContour.PRIMARY_PROVIDER,
          eventType: 'ticket.created',
          channel: NotificationChannel.IN_APP,
          enabled: true,
        },
      ],
    });

    const candidate = row({
      companyId: PRIMARY_CO,
      type: 'ticket.created',
      linkedClientCompanyId: TICKET_CLIENT_CO,
    });

    await expect(gate.filterRows([candidate], NotificationChannel.IN_APP)).resolves.toHaveLength(1);
  });
});

describe('105B ворота настроек: не расширяют видимость', () => {
  it('включённая настройка не создаёт получателя — на выходе подмножество входа', async () => {
    const { gate } = makeGate({
      users: [{ id: 'user-1', role: UserRole.ADMIN }],
      userPreferences: [
        {
          userId: 'user-2',
          contour: NotificationContour.CLIENT,
          eventType: 'ticket.created',
          channel: NotificationChannel.IN_APP,
          enabled: true,
        },
      ],
    });

    const input = [row()];
    const result = await gate.filterRows(input, NotificationChannel.IN_APP);

    expect(result.every((item) => input.includes(item))).toBe(true);
    expect(result.length).toBeLessThanOrEqual(input.length);
    // Получатель, у которого есть включённая настройка, но которого не пропустил
    // доступ, во вход не попал и появиться не может.
    expect(result.map((item) => item.userId)).not.toContain('user-2');
  });

  it('пустой вход остаётся пустым, сколько бы настроек ни было включено', async () => {
    const { gate } = makeGate({
      userPreferences: [
        {
          userId: 'user-9',
          contour: NotificationContour.CLIENT,
          eventType: 'ticket.created',
          channel: NotificationChannel.IN_APP,
          enabled: true,
        },
      ],
    });

    await expect(gate.filterRows([], NotificationChannel.IN_APP)).resolves.toEqual([]);
  });

  it('ADMIN не превращается в «получать всё»: его строки проходят тем же фильтром', async () => {
    const { gate } = makeGate({
      users: [{ id: 'admin-1', role: UserRole.ADMIN }],
      userPreferences: [
        {
          userId: 'admin-1',
          contour: NotificationContour.CLIENT,
          eventType: 'ticket.status_changed',
          channel: NotificationChannel.IN_APP,
          enabled: false,
        },
      ],
    });

    const candidate = row({ userId: 'admin-1', type: 'ticket.status_changed' });
    await expect(gate.filterRows([candidate], NotificationChannel.IN_APP)).resolves.toEqual([]);
  });
});

describe('105B контур получателя', () => {
  it('получатель в компании заявки идёт по контуру CLIENT', async () => {
    const { gate, serviceContracts } = makeGate({
      users: [{ id: 'user-1', role: UserRole.ADMIN }],
      userPreferences: [
        {
          userId: 'user-1',
          contour: NotificationContour.CLIENT,
          eventType: 'ticket.comment_added',
          channel: NotificationChannel.IN_APP,
          enabled: false,
        },
      ],
    });

    await expect(gate.filterRows([row()], NotificationChannel.IN_APP)).resolves.toEqual([]);
    expect(serviceContracts.getLinkedClientAccess).not.toHaveBeenCalled();
  });

  it('SECONDARY-провайдер не гасится настройкой PRIMARY-контура', async () => {
    const { gate } = makeGate({
      users: [{ id: 'user-1', role: UserRole.ADMIN }],
      contractRole: ServiceContractRole.SECONDARY,
      userPreferences: [
        {
          userId: 'user-1',
          // Настройка выставлена в PRIMARY-контуре — к SECONDARY она не относится.
          contour: NotificationContour.PRIMARY_PROVIDER,
          eventType: 'ticket.comment_added',
          channel: NotificationChannel.IN_APP,
          enabled: false,
        },
      ],
    });

    const candidate = row({ companyId: SECONDARY_CO, linkedClientCompanyId: TICKET_CLIENT_CO });
    await expect(gate.filterRows([candidate], NotificationChannel.IN_APP)).resolves.toHaveLength(1);
  });

  it('контур берётся из действующего контракта, а не угадывается', async () => {
    const { gate, serviceContracts } = makeGate({
      users: [{ id: 'user-1', role: UserRole.ADMIN }],
      contractRole: ServiceContractRole.SECONDARY,
      userPreferences: [
        {
          userId: 'user-1',
          contour: NotificationContour.SECONDARY_PROVIDER,
          eventType: 'ticket.comment_added',
          channel: NotificationChannel.IN_APP,
          enabled: false,
        },
      ],
    });

    const candidate = row({ companyId: SECONDARY_CO, linkedClientCompanyId: TICKET_CLIENT_CO });
    await expect(gate.filterRows([candidate], NotificationChannel.IN_APP)).resolves.toEqual([]);
    expect(serviceContracts.getLinkedClientAccess).toHaveBeenCalledWith(SECONDARY_CO, TICKET_CLIENT_CO);
  });

  it('контракта нет — настройку не применяем, доставку не рушим', async () => {
    const { gate } = makeGate({
      users: [{ id: 'user-1', role: UserRole.ADMIN }],
      contractRole: null,
      userPreferences: [
        {
          userId: 'user-1',
          contour: NotificationContour.PRIMARY_PROVIDER,
          eventType: 'ticket.comment_added',
          channel: NotificationChannel.IN_APP,
          enabled: false,
        },
      ],
    });

    const candidate = row({ companyId: PRIMARY_CO, linkedClientCompanyId: TICKET_CLIENT_CO });
    await expect(gate.filterRows([candidate], NotificationChannel.IN_APP)).resolves.toHaveLength(1);
  });
});

describe('105B безопасные отказы и обратная совместимость', () => {
  it('без единой настроенной строки фильтр не трогает доставку и не ходит в резолвер', async () => {
    const { gate, prisma } = makeGate({ users: [{ id: 'user-1', role: UserRole.ADMIN }] });

    const input = [row(), row({ userId: 'user-2' })];
    await expect(gate.filterRows(input, NotificationChannel.IN_APP)).resolves.toEqual(input);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.userNotificationPreference.findUnique).not.toHaveBeenCalled();
  });

  it('неизвестное событие доставляется: пробел в данных — не запрет', async () => {
    const { gate } = makeGate({
      users: [{ id: 'user-1', role: UserRole.ADMIN }],
      userPreferences: [
        {
          userId: 'user-1',
          contour: NotificationContour.CLIENT,
          eventType: 'ticket.created',
          channel: NotificationChannel.IN_APP,
          enabled: false,
        },
      ],
    });

    const candidate = row({ type: 'ticket.some_future_event' });
    await expect(gate.filterRows([candidate], NotificationChannel.IN_APP)).resolves.toHaveLength(1);
  });

  it('получателя не прочитали — доставка сохраняется', async () => {
    const { gate } = makeGate({
      users: [],
      userPreferences: [
        {
          userId: 'user-1',
          contour: NotificationContour.CLIENT,
          eventType: 'ticket.comment_added',
          channel: NotificationChannel.IN_APP,
          enabled: false,
        },
      ],
    });

    await expect(gate.filterRows([row()], NotificationChannel.IN_APP)).resolves.toHaveLength(1);
  });

  it('системная умолчательная настройка не гасит доставку', () => {
    expect(shouldSuppress({ enabled: false, source: 'SYSTEM_DEFAULT' })).toBe(false);
    expect(shouldSuppress({ enabled: false, source: 'UNKNOWN_EVENT' })).toBe(false);
    expect(shouldSuppress({ enabled: false, source: 'INVALID_INPUT' })).toBe(false);
  });

  it('legacy-тумблер push не гасит in-app', () => {
    expect(shouldSuppress({ enabled: false, source: 'LEGACY_PUSH_PREFERENCE' })).toBe(false);
  });

  it('гасят только явные настройки', () => {
    expect(shouldSuppress({ enabled: false, source: 'USER_OVERRIDE' })).toBe(true);
    expect(shouldSuppress({ enabled: false, source: 'COMPANY_ROLE_OVERRIDE' })).toBe(true);
    expect(shouldSuppress({ enabled: true, source: 'USER_OVERRIDE' })).toBe(false);
  });
});

describe('105B канал PUSH', () => {
  it('настройка канала PUSH не гасит in-app и наоборот', async () => {
    const { gate } = makeGate({
      users: [{ id: 'user-1', role: UserRole.ADMIN }],
      userPreferences: [
        {
          userId: 'user-1',
          contour: NotificationContour.CLIENT,
          eventType: 'ticket.comment_added',
          channel: NotificationChannel.PUSH,
          enabled: false,
        },
      ],
    });

    await expect(gate.allows(row(), NotificationChannel.PUSH)).resolves.toBe(false);
    await expect(gate.allows(row(), NotificationChannel.IN_APP)).resolves.toBe(true);
  });
});
