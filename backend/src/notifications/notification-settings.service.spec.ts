import { BadRequestException } from '@nestjs/common';
import {
  CompanyType,
  NotificationChannel,
  NotificationContour,
  ServiceContractRole,
  ServiceContractStatus,
  UserRole,
} from '@prisma/client';

import { NotificationSettingsService } from './notification-settings.service';

const CLIENT = {
  id: 'client-user',
  companyId: 'client-company',
  role: UserRole.CLIENT_ADMIN,
};
const PROVIDER = {
  id: 'provider-user',
  companyId: 'provider-company',
  role: UserRole.DISPATCHER,
};

function makeService(
  options: {
    companyType?: CompanyType;
    contractRoles?: ServiceContractRole[];
    overrides?: Array<{ contour: NotificationContour; eventType: string }>;
  } = {},
) {
  const prisma: any = {
    company: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ type: options.companyType ?? CompanyType.CLIENT }),
    },
    serviceContract: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          (options.contractRoles ?? []).map((role) => ({ role })),
        ),
    },
    userNotificationPreference: {
      findMany: jest.fn().mockResolvedValue(options.overrides ?? []),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return { prisma, service: new NotificationSettingsService(prisma) };
}

function events(result: any, contour: NotificationContour) {
  return (
    result.contours
      .find((item: any) => item.contour === contour)
      ?.groups.flatMap((group: any) => group.events) ?? []
  );
}

describe('117O settings visibility', () => {
  it('CLIENT_ADMIN receives only factual SLA events and can use notification routes', async () => {
    const { service } = makeService();
    const result = await service.getSettings(CLIENT);
    expect(result.channel).toBe(NotificationChannel.IN_APP);
    expect(result.contours.map((item) => item.contour)).toEqual([
      NotificationContour.CLIENT,
    ]);
    expect(
      events(result, NotificationContour.CLIENT).map(
        (item: any) => item.eventType,
      ),
    ).toEqual(['ticket.sla_warning', 'ticket.sla_breached']);
  });

  it('keeps PRIMARY and SECONDARY as independent sections', async () => {
    const { service } = makeService({
      companyType: CompanyType.PROVIDER,
      contractRoles: [
        ServiceContractRole.PRIMARY,
        ServiceContractRole.SECONDARY,
      ],
      overrides: [
        {
          contour: NotificationContour.SECONDARY_PROVIDER,
          eventType: 'ticket.created',
        },
      ],
    });
    const result = await service.getSettings(PROVIDER);
    expect(result.contours.map((item) => item.contour)).toEqual([
      NotificationContour.PRIMARY_PROVIDER,
      NotificationContour.SECONDARY_PROVIDER,
    ]);
    expect(
      events(result, NotificationContour.PRIMARY_PROVIDER).find(
        (item: any) => item.eventType === 'ticket.created',
      ).state,
    ).toBe('INHERITED');
    expect(
      events(result, NotificationContour.SECONDARY_PROVIDER).find(
        (item: any) => item.eventType === 'ticket.created',
      ).state,
    ).toBe('OFF');
  });

  it('queries only currently effective provider contracts and has no fake PRIMARY fallback', async () => {
    const { prisma, service } = makeService({
      companyType: CompanyType.PROVIDER,
      contractRoles: [],
    });
    await expect(service.getSettings(PROVIDER)).resolves.toMatchObject({
      contours: [],
    });
    const where = prisma.serviceContract.findMany.mock.calls[0][0].where;
    expect(where.providerCompanyId).toBe(PROVIDER.companyId);
    expect(where.status).toBe(ServiceContractStatus.ACTIVE);
    expect(where.AND).toHaveLength(2);
  });
});

describe('117O exact-contour opt-out mutation', () => {
  it('writes exactly one false row for the requested contour', async () => {
    const { prisma, service } = makeService({
      companyType: CompanyType.PROVIDER,
      contractRoles: [
        ServiceContractRole.PRIMARY,
        ServiceContractRole.SECONDARY,
      ],
    });
    await service.disable(PROVIDER, {
      eventType: 'ticket.created',
      contour: NotificationContour.SECONDARY_PROVIDER,
      channel: NotificationChannel.IN_APP,
      enabled: false,
    });
    expect(prisma.userNotificationPreference.upsert).toHaveBeenCalledTimes(1);
    expect(
      prisma.userNotificationPreference.upsert.mock.calls[0][0].create,
    ).toMatchObject({
      userId: PROVIDER.id,
      companyId: PROVIDER.companyId,
      contour: NotificationContour.SECONDARY_PROVIDER,
      eventType: 'ticket.created',
      channel: NotificationChannel.IN_APP,
      enabled: false,
    });
  });

  it('turning delivery back on deletes the exact opt-out row', async () => {
    const { prisma, service } = makeService();
    await service.reset(CLIENT, {
      eventType: 'ticket.sla_warning',
      contour: NotificationContour.CLIENT,
      channel: NotificationChannel.IN_APP,
    });
    expect(prisma.userNotificationPreference.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: CLIENT.id,
        contour: NotificationContour.CLIENT,
        eventType: 'ticket.sla_warning',
        channel: NotificationChannel.IN_APP,
      },
    });
  });

  it.each([
    [
      'enabled=true',
      {
        eventType: 'ticket.sla_warning',
        contour: NotificationContour.CLIENT,
        channel: NotificationChannel.IN_APP,
        enabled: true,
      },
    ],
    [
      'PUSH',
      {
        eventType: 'ticket.sla_warning',
        contour: NotificationContour.CLIENT,
        channel: NotificationChannel.PUSH,
        enabled: false,
      },
    ],
    [
      'MAX',
      {
        eventType: 'ticket.sla_warning',
        contour: NotificationContour.CLIENT,
        channel: NotificationChannel.MAX,
        enabled: false,
      },
    ],
    [
      'wrong contour',
      {
        eventType: 'ticket.sla_warning',
        contour: NotificationContour.PRIMARY_PROVIDER,
        channel: NotificationChannel.IN_APP,
        enabled: false,
      },
    ],
    [
      'unsupported event',
      {
        eventType: 'ticket.created',
        contour: NotificationContour.CLIENT,
        channel: NotificationChannel.IN_APP,
        enabled: false,
      },
    ],
  ])('rejects %s', async (_name, input) => {
    const { service } = makeService();
    await expect(service.disable(CLIENT, input as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
