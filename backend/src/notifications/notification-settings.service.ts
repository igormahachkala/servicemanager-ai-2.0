import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CompanyType,
  NotificationChannel,
  NotificationContour,
  ServiceContractRole,
  UserRole,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { activeServiceContractWhere } from '../service-contracts/service-contract-window';

import {
  SUPPORTED_NOTIFICATION_EVENTS,
  isSupportedNotificationEvent,
  type NotificationEventGroup,
  type NotificationEventKey,
} from './notification-event-catalog';
import { getPersonalInAppEventKeys } from './personal-notification-event-matrix';

export const PERSONAL_NOTIFICATION_CHANNEL = NotificationChannel.IN_APP;

const GROUP_TITLES_RU: Record<NotificationEventGroup, string> = {
  TICKET: 'Заявки',
  ASSIGNMENT: 'Назначение',
  CHAT: 'Обсуждение',
  STATUS: 'Статусы',
  SLA: 'Сроки и просрочка',
  ACCEPTANCE: 'Приёмка',
};

const GROUP_ORDER: NotificationEventGroup[] = [
  'TICKET',
  'ASSIGNMENT',
  'STATUS',
  'CHAT',
  'ACCEPTANCE',
  'SLA',
];

const CONTOUR_LABELS_RU: Record<NotificationContour, string> = {
  [NotificationContour.CLIENT]: 'Клиент',
  [NotificationContour.PRIMARY_PROVIDER]: 'Основной исполнитель',
  [NotificationContour.SECONDARY_PROVIDER]: 'Дополнительный исполнитель',
};

export type NotificationSettingsActor = {
  id: string;
  companyId: string;
  role: UserRole;
};

export type NotificationSettingsEvent = {
  eventType: string;
  labelRu: string;
  descriptionRu: string;
  channel: NotificationChannel;
  state: 'INHERITED' | 'OFF';
};

export type NotificationSettingsGroup = {
  key: NotificationEventGroup;
  titleRu: string;
  events: NotificationSettingsEvent[];
};

export type NotificationSettingsContour = {
  contour: NotificationContour;
  labelRu: string;
  groups: NotificationSettingsGroup[];
};

export type NotificationSettingsResponse = {
  role: UserRole;
  channel: NotificationChannel;
  contours: NotificationSettingsContour[];
};

@Injectable()
export class NotificationSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(
    actor: NotificationSettingsActor,
  ): Promise<NotificationSettingsResponse> {
    const contours = await this.resolveContours(actor);
    const overrides = await this.loadOverrides(actor, contours);

    return {
      role: actor.role,
      channel: PERSONAL_NOTIFICATION_CHANNEL,
      contours: contours.map((contour) => ({
        contour,
        labelRu: CONTOUR_LABELS_RU[contour],
        groups: this.buildGroups(actor.role, contour, overrides),
      })),
    };
  }

  async disable(
    actor: NotificationSettingsActor,
    input: {
      eventType: string;
      contour: NotificationContour;
      channel: NotificationChannel;
      enabled: boolean;
    },
  ): Promise<NotificationSettingsResponse> {
    if (input.enabled !== false) {
      throw new BadRequestException(
        'Only disabling a personal notification is supported',
      );
    }
    const eventType = await this.assertConfigurable(actor, input);

    await this.prisma.userNotificationPreference.upsert({
      where: {
        userId_contour_eventType_channel: {
          userId: actor.id,
          contour: input.contour,
          eventType,
          channel: PERSONAL_NOTIFICATION_CHANNEL,
        },
      },
      create: {
        userId: actor.id,
        companyId: actor.companyId,
        contour: input.contour,
        eventType,
        channel: PERSONAL_NOTIFICATION_CHANNEL,
        enabled: false,
        createdByUserId: actor.id,
        updatedByUserId: actor.id,
      },
      update: { enabled: false, updatedByUserId: actor.id },
    });

    return this.getSettings(actor);
  }

  async reset(
    actor: NotificationSettingsActor,
    input: {
      eventType: string;
      contour: NotificationContour;
      channel: NotificationChannel;
    },
  ): Promise<NotificationSettingsResponse> {
    const eventType = await this.assertConfigurable(actor, input);

    await this.prisma.userNotificationPreference.deleteMany({
      where: {
        userId: actor.id,
        contour: input.contour,
        eventType,
        channel: PERSONAL_NOTIFICATION_CHANNEL,
      },
    });

    return this.getSettings(actor);
  }

  private async assertConfigurable(
    actor: NotificationSettingsActor,
    input: {
      eventType: string;
      contour: NotificationContour;
      channel: NotificationChannel;
    },
  ): Promise<string> {
    const eventType = (input.eventType || '').trim();
    if (!isSupportedNotificationEvent(eventType)) {
      throw new BadRequestException('Unknown notification event');
    }
    if (input.channel !== PERSONAL_NOTIFICATION_CHANNEL) {
      throw new BadRequestException(
        'Only in-app notifications are configurable here',
      );
    }

    const contours = await this.resolveContours(actor);
    if (!contours.includes(input.contour)) {
      throw new BadRequestException(
        'Notification contour is not active for this user',
      );
    }
    if (
      !getPersonalInAppEventKeys({
        contour: input.contour,
        role: actor.role,
      }).includes(eventType as NotificationEventKey)
    ) {
      throw new BadRequestException(
        'Event is not configurable for this role and contour',
      );
    }
    return eventType;
  }

  private async resolveContours(
    actor: NotificationSettingsActor,
  ): Promise<NotificationContour[]> {
    const company = await this.prisma.company.findUnique({
      where: { id: actor.companyId },
      select: { type: true },
    });

    if (!company) return [];
    if (company.type === CompanyType.CLIENT) {
      return getPersonalInAppEventKeys({
        contour: NotificationContour.CLIENT,
        role: actor.role,
      }).length
        ? [NotificationContour.CLIENT]
        : [];
    }
    if (company.type !== CompanyType.PROVIDER) return [];

    const contracts = await this.prisma.serviceContract.findMany({
      where: {
        providerCompanyId: actor.companyId,
        ...activeServiceContractWhere(),
      },
      select: { role: true },
      distinct: ['role'],
    });

    const roles = new Set(contracts.map((contract) => contract.role));
    const contours: NotificationContour[] = [];
    if (roles.has(ServiceContractRole.PRIMARY))
      contours.push(NotificationContour.PRIMARY_PROVIDER);
    if (roles.has(ServiceContractRole.SECONDARY))
      contours.push(NotificationContour.SECONDARY_PROVIDER);
    return contours.filter(
      (contour) =>
        getPersonalInAppEventKeys({ contour, role: actor.role }).length > 0,
    );
  }

  private async loadOverrides(
    actor: NotificationSettingsActor,
    contours: NotificationContour[],
  ) {
    if (!contours.length) return new Set<string>();
    const rows = await this.prisma.userNotificationPreference.findMany({
      where: {
        userId: actor.id,
        contour: { in: contours },
        channel: PERSONAL_NOTIFICATION_CHANNEL,
        enabled: false,
      },
      select: { contour: true, eventType: true },
    });
    return new Set(rows.map((row) => `${row.contour}:${row.eventType}`));
  }

  private buildGroups(
    role: UserRole,
    contour: NotificationContour,
    overrides: Set<string>,
  ): NotificationSettingsGroup[] {
    const keys = new Set(getPersonalInAppEventKeys({ contour, role }));

    return GROUP_ORDER.map((groupKey) => ({
      key: groupKey,
      titleRu: GROUP_TITLES_RU[groupKey],
      events: SUPPORTED_NOTIFICATION_EVENTS.filter(
        (event) => event.group === groupKey && keys.has(event.key),
      ).map((event) => ({
        eventType: event.key,
        labelRu: event.labelRu,
        descriptionRu: event.descriptionRu,
        channel: PERSONAL_NOTIFICATION_CHANNEL,
        state: overrides.has(`${contour}:${event.key}`)
          ? ('OFF' as const)
          : ('INHERITED' as const),
      })),
    })).filter((group) => group.events.length > 0);
  }
}
