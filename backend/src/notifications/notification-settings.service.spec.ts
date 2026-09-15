import { BadRequestException } from '@nestjs/common';
import {
  CompanyType,
  NotificationChannel,
  NotificationContour,
  ServiceContractRole,
  UserRole,
} from '@prisma/client';

import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationSettingsService } from './notification-settings.service';

/**
 * SMA-NOTIFICATION-PREFERENCES-UI-105C.
 *
 * Настройки читают и пишут модель 105A и ничего не открывают: список событий
 * ограничен ролью и контуром, канал — только тем, что архитектура исполняет.
 */

const CLIENT_CO = 'client-co';
const PROVIDER_CO = 'provider-co';

function makeService(options: {
  companyType?: CompanyType;
  contractRoles?: ServiceContractRole[];
  overrides?: Array<Record<string, any>>;
} = {}) {
  const overrides = options.overrides ?? [];

  const prisma: any = {
    company: {
      findUnique: jest.fn().mockResolvedValue({ type: options.companyType ?? CompanyType.CLIENT }),
    },
    serviceContract: {
      findMany: jest.fn().mockResolvedValue((options.contractRoles ?? []).map((role) => ({ role }))),
    },
    userNotificationPreference: {
      findMany: jest.fn().mockResolvedValue(overrides),
      findUnique: jest.fn(async ({ where }: any) => {
        const key = where.userId_contour_eventType_channel;
        return (
          overrides.find(
            (row) =>
              row.userId === key.userId &&
              row.contour === key.contour &&
              row.eventType === key.eventType &&
              row.channel === key.channel,
          ) ?? null
        );
      }),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    companyNotificationRolePreference: { findUnique: jest.fn().mockResolvedValue(null) },
    pushPreference: { findUnique: jest.fn().mockResolvedValue(null) },
  };

  const preferences = new NotificationPreferencesService(prisma);
  return { prisma, service: new NotificationSettingsService(prisma, preferences) };
}

const CLIENT_ADMIN_ACTOR = { id: 'user-1', companyId: CLIENT_CO, role: UserRole.ADMIN };
const TECHNICIAN_ACTOR = { id: 'tech-1', companyId: PROVIDER_CO, role: UserRole.TECHNICIAN };
const DISPATCHER_ACTOR = { id: 'disp-1', companyId: PROVIDER_CO, role: UserRole.DISPATCHER };

function allEventKeys(response: any) {
  return response.groups.flatMap((group: any) => group.events.map((event: any) => event.key));
}

describe('105C загрузка эффективных настроек', () => {
  it('отдаёт роль, контур, каналы и сгруппированные события', async () => {
    const { service } = makeService();

    const result = await service.getSettings(CLIENT_ADMIN_ACTOR);

    expect(result.role).toBe(UserRole.ADMIN);
    expect(result.contours).toEqual([NotificationContour.CLIENT]);
    expect(result.channels).toEqual([NotificationChannel.IN_APP]);
    expect(result.groups.length).toBeGreaterThan(0);
    for (const group of result.groups) {
      expect(typeof group.titleRu).toBe('string');
      expect(group.titleRu).toMatch(/[А-Яа-я]/);
      for (const event of group.events) {
        expect(event.labelRu).toMatch(/[А-Яа-я]/);
        expect(event.channels).toHaveLength(1);
      }
    }
  });

  it('без переопределений всё показано как умолчание', async () => {
    const { service } = makeService();

    const result = await service.getSettings(CLIENT_ADMIN_ACTOR);
    const states = result.groups.flatMap((g) => g.events.flatMap((e) => e.channels));

    expect(states.length).toBeGreaterThan(0);
    expect(states.every((state) => state.isOverride === false)).toBe(true);
  });

  it('личное переопределение видно как явное и выключенное', async () => {
    const { service } = makeService({
      overrides: [
        {
          userId: 'user-1',
          contour: NotificationContour.CLIENT,
          eventType: 'ticket.created',
          channel: NotificationChannel.IN_APP,
          enabled: false,
        },
      ],
    });

    const result = await service.getSettings(CLIENT_ADMIN_ACTOR);
    const created = result.groups
      .flatMap((g) => g.events)
      .find((event) => event.key === 'ticket.created');

    expect(created?.channels[0]).toEqual({
      channel: NotificationChannel.IN_APP,
      enabled: false,
      isOverride: true,
    });
  });
});

describe('105C каталог зависит от роли', () => {
  it('техник не получает диспетчерский шум: новой заявки в его настройках нет', async () => {
    const { service } = makeService({
      companyType: CompanyType.PROVIDER,
      contractRoles: [ServiceContractRole.PRIMARY],
    });

    const keys = allEventKeys(await service.getSettings(TECHNICIAN_ACTOR));

    expect(keys).not.toContain('ticket.created');
    expect(keys.length).toBeGreaterThan(0);
  });

  it('ADMIN не означает «все уведомления»', async () => {
    const { service } = makeService();

    const keys = allEventKeys(await service.getSettings(CLIENT_ADMIN_ACTOR));

    // Каталог шире, чем набор роли: показываем адресованное, а не всё подряд.
    expect(keys.length).toBeLessThan(14);
  });

  it('роль без адресованных событий получает пустой список, а не матрицу', async () => {
    const { service } = makeService();

    const result = await service.getSettings({
      id: 'staff-1',
      companyId: CLIENT_CO,
      role: UserRole.STAFF,
    });

    expect(result.groups).toEqual([]);
  });

  it('провайдер с двумя ролями контрактов настраивает оба контура', async () => {
    const { service } = makeService({
      companyType: CompanyType.PROVIDER,
      contractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    });

    const result = await service.getSettings(DISPATCHER_ACTOR);

    expect(result.contours).toEqual(
      expect.arrayContaining([
        NotificationContour.PRIMARY_PROVIDER,
        NotificationContour.SECONDARY_PROVIDER,
      ]),
    );
  });
});

describe('105C каналы', () => {
  it('показан только канал, который архитектура исполняет', async () => {
    const { service } = makeService();
    const result = await service.getSettings(CLIENT_ADMIN_ACTOR);

    expect(result.channels).toEqual([NotificationChannel.IN_APP]);
    expect(result.channels).not.toContain(NotificationChannel.MAX);
    expect(result.channels).not.toContain(NotificationChannel.PUSH);
  });

  it('MAX нельзя выставить через API: персональной доставки нет', async () => {
    const { service } = makeService();

    await expect(
      service.setOverride(CLIENT_ADMIN_ACTOR, {
        eventType: 'ticket.created',
        channel: NotificationChannel.MAX,
        enabled: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PUSH сюда не пишется: у него свой экран и своя модель', async () => {
    const { service } = makeService();

    await expect(
      service.setOverride(CLIENT_ADMIN_ACTOR, {
        eventType: 'ticket.created',
        channel: NotificationChannel.PUSH,
        enabled: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('105C запись переопределения', () => {
  it('выключение пишет строку во все контуры пользователя', async () => {
    const { prisma, service } = makeService({
      companyType: CompanyType.PROVIDER,
      contractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    });

    await service.setOverride(DISPATCHER_ACTOR, {
      eventType: 'ticket.created',
      channel: NotificationChannel.IN_APP,
      enabled: false,
    });

    expect(prisma.userNotificationPreference.upsert).toHaveBeenCalledTimes(2);
    const contours = prisma.userNotificationPreference.upsert.mock.calls.map(
      (call: any[]) => call[0].create.contour,
    );
    expect(contours).toEqual(
      expect.arrayContaining([
        NotificationContour.PRIMARY_PROVIDER,
        NotificationContour.SECONDARY_PROVIDER,
      ]),
    );
  });

  it('включение обратно — та же ручка с enabled=true', async () => {
    const { prisma, service } = makeService();

    await service.setOverride(CLIENT_ADMIN_ACTOR, {
      eventType: 'ticket.created',
      channel: NotificationChannel.IN_APP,
      enabled: true,
    });

    expect(prisma.userNotificationPreference.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.userNotificationPreference.upsert.mock.calls[0][0].update.enabled).toBe(true);
  });

  it('возврат к умолчанию удаляет личные строки', async () => {
    const { prisma, service } = makeService();

    await service.clearOverride(CLIENT_ADMIN_ACTOR, {
      eventType: 'ticket.created',
      channel: NotificationChannel.IN_APP,
    });

    expect(prisma.userNotificationPreference.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        eventType: 'ticket.created',
        channel: NotificationChannel.IN_APP,
        contour: { in: [NotificationContour.CLIENT] },
      },
    });
  });

  it('запись всегда привязана к актору из токена', async () => {
    const { prisma, service } = makeService();

    await service.setOverride(CLIENT_ADMIN_ACTOR, {
      eventType: 'ticket.created',
      channel: NotificationChannel.IN_APP,
      enabled: false,
    });

    const create = prisma.userNotificationPreference.upsert.mock.calls[0][0].create;
    expect(create.userId).toBe('user-1');
    expect(create.companyId).toBe(CLIENT_CO);
  });
});

describe('105C безопасные отказы', () => {
  it('неизвестное событие отклоняется', async () => {
    const { service } = makeService();

    await expect(
      service.setOverride(CLIENT_ADMIN_ACTOR, {
        eventType: 'ticket.not_a_real_event',
        channel: NotificationChannel.IN_APP,
        enabled: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('событие, не адресованное роли, настроить нельзя', async () => {
    const { prisma, service } = makeService({
      companyType: CompanyType.PROVIDER,
      contractRoles: [ServiceContractRole.PRIMARY],
    });

    await expect(
      service.setOverride(TECHNICIAN_ACTOR, {
        eventType: 'ticket.created',
        channel: NotificationChannel.IN_APP,
        enabled: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.userNotificationPreference.upsert).not.toHaveBeenCalled();
  });

  it('настройка не открывает доступ: сервис не читает заявки и не считает получателей', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, 'notification-settings.service.ts'),
      'utf8',
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const forbidden of ['ticket.find', 'notification.create', 'user.findMany']) {
      expect(code).not.toContain(forbidden);
    }
  });
});
