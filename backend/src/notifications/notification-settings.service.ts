import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CompanyType,
  NotificationChannel,
  NotificationContour,
  ServiceContractRole,
  UserRole,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import {
  SUPPORTED_NOTIFICATION_EVENTS,
  isRoleRepresentableForNotificationContour,
  isSupportedNotificationChannel,
  isSupportedNotificationEvent,
  SYSTEM_NOTIFICATION_DEFAULTS,
  type NotificationEventDefinition,
  type NotificationEventGroup,
} from './notification-event-catalog';
import { NotificationPreferencesService } from './notification-preferences.service';

/**
 * SMA-NOTIFICATION-PREFERENCES-UI-105C.
 *
 * Транспорт для личных настроек уведомлений. Модель, каталог и резолвер —
 * из 105A, они уже в Production; здесь только чтение эффективного состояния
 * и запись личного переопределения.
 *
 * Второй модели настроек не заводится: пишется та же UserNotificationPreference,
 * читается тот же NotificationPreferencesService.
 *
 * Настройка не выдаёт доступ. Эти ручки работают исключительно со своими
 * строками текущего пользователя и не влияют ни на состав получателей,
 * ни на видимость заявок — подавление применяется позже, в 105B,
 * уже после разрешения доступа.
 */

/**
 * Каналы, которые пользователь может настроить здесь.
 *
 * Только IN_APP. PUSH живёт на своём экране (`/push/preferences`,
 * PushPreference) — второй тумблер для того же канала развёл бы два источника
 * правды. MAX персональной доставки не имеет, поэтому тумблера для него
 * нет: показывать переключатель, который ничего не выключает, нельзя.
 */
export const SETTINGS_CHANNELS: NotificationChannel[] = [NotificationChannel.IN_APP];

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

export type NotificationSettingsActor = {
  id: string;
  companyId: string;
  role: UserRole;
};

export type NotificationSettingsChannelState = {
  channel: NotificationChannel;
  enabled: boolean;
  /** true — состояние задано самим пользователем, false — умолчание. */
  isOverride: boolean;
};

export type NotificationSettingsEvent = {
  key: string;
  labelRu: string;
  descriptionRu: string;
  channels: NotificationSettingsChannelState[];
};

export type NotificationSettingsGroup = {
  key: NotificationEventGroup;
  titleRu: string;
  events: NotificationSettingsEvent[];
};

export type NotificationSettingsResponse = {
  role: UserRole;
  contours: NotificationContour[];
  channels: NotificationChannel[];
  groups: NotificationSettingsGroup[];
};

@Injectable()
export class NotificationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly preferences: NotificationPreferencesService,
  ) {}

  async getSettings(actor: NotificationSettingsActor): Promise<NotificationSettingsResponse> {
    const contours = await this.resolveContours(actor);
    const events = this.visibleEvents(actor, contours);
    const overrides = await this.loadOverrides(actor, contours);

    const groups: NotificationSettingsGroup[] = [];
    for (const groupKey of GROUP_ORDER) {
      const groupEvents = events.filter((event) => event.group === groupKey);
      if (!groupEvents.length) continue;

      groups.push({
        key: groupKey,
        titleRu: GROUP_TITLES_RU[groupKey],
        events: await Promise.all(
          groupEvents.map(async (event) => ({
            key: event.key,
            labelRu: event.labelRu,
            descriptionRu: event.descriptionRu,
            channels: await Promise.all(
              SETTINGS_CHANNELS.map((channel) =>
                this.channelState(actor, contours, event.key, channel, overrides),
              ),
            ),
          })),
        ),
      });
    }

    return { role: actor.role, contours, channels: SETTINGS_CHANNELS, groups };
  }

  /**
   * Явное личное переопределение. Пишется во все контуры, в которых
   * пользователь участвует: иначе провайдер с двумя контрактами выключил бы
   * уведомление только для одной половины своей работы и не понял бы, почему
   * оно продолжает приходить.
   */
  async setOverride(
    actor: NotificationSettingsActor,
    input: { eventType: string; channel: NotificationChannel; enabled: boolean },
  ): Promise<NotificationSettingsResponse> {
    const { eventType, channel } = this.assertSupported(input.eventType, input.channel);
    const contours = await this.assertConfigurable(actor, eventType);

    for (const contour of contours) {
      await this.prisma.userNotificationPreference.upsert({
        where: {
          userId_contour_eventType_channel: {
            userId: actor.id,
            contour,
            eventType,
            channel,
          },
        },
        create: {
          userId: actor.id,
          companyId: actor.companyId,
          contour,
          eventType,
          channel,
          enabled: input.enabled,
          createdByUserId: actor.id,
          updatedByUserId: actor.id,
        },
        update: { enabled: input.enabled, updatedByUserId: actor.id },
      });
    }

    return this.getSettings(actor);
  }

  /** Снять личное переопределение и вернуться к умолчанию. */
  async clearOverride(
    actor: NotificationSettingsActor,
    input: { eventType: string; channel: NotificationChannel },
  ): Promise<NotificationSettingsResponse> {
    const { eventType, channel } = this.assertSupported(input.eventType, input.channel);
    const contours = await this.assertConfigurable(actor, eventType);

    await this.prisma.userNotificationPreference.deleteMany({
      where: { userId: actor.id, eventType, channel, contour: { in: contours } },
    });

    return this.getSettings(actor);
  }

  private assertSupported(eventType: string, channel: NotificationChannel) {
    const normalizedEvent = (eventType || '').trim();
    if (!isSupportedNotificationEvent(normalizedEvent)) {
      throw new BadRequestException('Unknown notification event');
    }
    if (!isSupportedNotificationChannel(channel) || !SETTINGS_CHANNELS.includes(channel)) {
      throw new BadRequestException('Unsupported notification channel');
    }
    return { eventType: normalizedEvent, channel };
  }

  /**
   * Настраивать можно только то, что показано. Иначе через API можно было бы
   * завести строку для события, которое роли не адресуется, — мусор, который
   * потом молча влиял бы на доставку.
   */
  private async assertConfigurable(actor: NotificationSettingsActor, eventType: string) {
    const contours = await this.resolveContours(actor);
    const visible = this.visibleEvents(actor, contours).some((event) => event.key === eventType);
    if (!visible) {
      throw new BadRequestException('Event is not configurable for this role');
    }
    return contours;
  }

  /**
   * Контуры, в которых пользователь реально участвует.
   * Компания-клиент — CLIENT. Провайдер — по ролям действующих контрактов;
   * без контрактов остаётся PRIMARY_PROVIDER, иначе настраивать было бы нечего.
   */
  private async resolveContours(
    actor: NotificationSettingsActor,
  ): Promise<NotificationContour[]> {
    const company = await this.prisma.company.findUnique({
      where: { id: actor.companyId },
      select: { type: true },
    });

    if (!company || company.type === CompanyType.CLIENT) {
      return [NotificationContour.CLIENT];
    }

    const contracts = await this.prisma.serviceContract.findMany({
      where: { providerCompanyId: actor.companyId },
      select: { role: true },
      distinct: ['role'],
    });

    const contours = new Set<NotificationContour>();
    for (const contract of contracts) {
      contours.add(
        contract.role === ServiceContractRole.SECONDARY
          ? NotificationContour.SECONDARY_PROVIDER
          : NotificationContour.PRIMARY_PROVIDER,
      );
    }
    if (!contours.size) contours.add(NotificationContour.PRIMARY_PROVIDER);

    return [...contours];
  }

  /**
   * Что показывать роли.
   *
   * Берём умолчания каталога для контуров пользователя — это и есть список
   * «что этой роли адресуется». Гигантской матрицы не строим: ADMIN не значит
   * «все уведомления», техник не видит диспетчерского шума. Дополнительно
   * показываем события, для которых у пользователя уже есть переопределение,
   * чтобы выставленную настройку всегда можно было снять.
   */
  private visibleEvents(
    actor: NotificationSettingsActor,
    contours: NotificationContour[],
  ): NotificationEventDefinition[] {
    const keys = new Set<string>();
    for (const contour of contours) {
      if (!isRoleRepresentableForNotificationContour({ contour, role: actor.role })) continue;
      for (const key of SYSTEM_NOTIFICATION_DEFAULTS[contour][actor.role] ?? []) {
        keys.add(key);
      }
    }
    return SUPPORTED_NOTIFICATION_EVENTS.filter((event) => keys.has(event.key));
  }

  private async loadOverrides(
    actor: NotificationSettingsActor,
    contours: NotificationContour[],
  ) {
    const rows = await this.prisma.userNotificationPreference.findMany({
      where: { userId: actor.id, contour: { in: contours } },
      select: { contour: true, eventType: true, channel: true, enabled: true },
    });
    return new Set(rows.map((row) => `${row.eventType}:${row.channel}`));
  }

  /**
   * Эффективное состояние считает резолвер 105A, а не этот сервис:
   * порядок SYSTEM_DEFAULT → COMPANY_ROLE_OVERRIDE → USER_OVERRIDE живёт
   * в одном месте. Здесь только выбирается контур для показа.
   */
  private async channelState(
    actor: NotificationSettingsActor,
    contours: NotificationContour[],
    eventType: string,
    channel: NotificationChannel,
    overrides: Set<string>,
  ): Promise<NotificationSettingsChannelState> {
    const decisions = await Promise.all(
      contours.map((contour) =>
        this.preferences.resolvePreference({
          companyId: actor.companyId,
          contour,
          role: actor.role,
          userId: actor.id,
          eventType,
          channel,
        }),
      ),
    );

    // Выключенным показываем только то, что выключено во всех контурах:
    // половинчатое состояние обмануло бы пользователя сильнее, чем «включено».
    const enabled = decisions.some((decision) => decision.enabled);

    return {
      channel,
      enabled,
      isOverride: overrides.has(`${eventType}:${channel}`),
    };
  }
}
