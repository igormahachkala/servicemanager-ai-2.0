import { Injectable } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationContour,
  UserRole,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  getLegacyPushPreferenceKey,
  getSystemNotificationDefault,
  isRoleRepresentableForNotificationContour,
  isSupportedNotificationChannel,
  isSupportedNotificationContour,
  isSupportedNotificationEvent,
  type LegacyPushPreferenceKey,
} from './notification-event-catalog';

export type NotificationPreferenceSource =
  | 'SYSTEM_DEFAULT'
  | 'COMPANY_ROLE_OVERRIDE'
  | 'USER_OVERRIDE'
  | 'LEGACY_PUSH_PREFERENCE'
  | 'UNKNOWN_EVENT'
  | 'INVALID_INPUT';

export type NotificationPreferenceDecision = {
  enabled: boolean;
  source: NotificationPreferenceSource;
};

export type ResolveNotificationPreferenceInput = {
  companyId: string;
  contour: NotificationContour;
  role: UserRole;
  userId?: string | null;
  eventType: string;
  channel: NotificationChannel;
};

type LegacyPushPreferenceSnapshot = Partial<
  Record<LegacyPushPreferenceKey, boolean | null>
>;

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async isNotificationEnabled(
    input: ResolveNotificationPreferenceInput,
  ): Promise<boolean> {
    return (await this.resolvePreference(input)).enabled;
  }

  async resolvePreference(
    input: ResolveNotificationPreferenceInput,
  ): Promise<NotificationPreferenceDecision> {
    const normalizedCompanyId = this.normalizeId(input.companyId);
    const normalizedUserId = this.normalizeId(input.userId);
    const eventType = this.normalizeId(input.eventType);

    if (!normalizedCompanyId || !eventType) {
      return { enabled: false, source: 'INVALID_INPUT' };
    }
    if (!isSupportedNotificationContour(input.contour)) {
      return { enabled: false, source: 'INVALID_INPUT' };
    }
    if (!isSupportedNotificationChannel(input.channel)) {
      return { enabled: false, source: 'INVALID_INPUT' };
    }
    if (!isSupportedNotificationEvent(eventType)) {
      return { enabled: false, source: 'UNKNOWN_EVENT' };
    }
    if (
      !isRoleRepresentableForNotificationContour({
        contour: input.contour,
        role: input.role,
      })
    ) {
      return { enabled: false, source: 'INVALID_INPUT' };
    }

    let decision: NotificationPreferenceDecision = {
      enabled: getSystemNotificationDefault({
        contour: input.contour,
        role: input.role,
        eventType,
        channel: input.channel,
      }),
      source: 'SYSTEM_DEFAULT',
    };

    const companyOverride =
      await this.prisma.companyNotificationRolePreference.findUnique({
        where: {
          companyId_contour_role_eventType_channel: {
            companyId: normalizedCompanyId,
            contour: input.contour,
            role: input.role,
            eventType,
            channel: input.channel,
          },
        },
        select: { enabled: true },
      });
    if (companyOverride) {
      decision = {
        enabled: companyOverride.enabled,
        source: 'COMPANY_ROLE_OVERRIDE',
      };
    }

    if (!normalizedUserId) {
      return decision;
    }

    const userOverride =
      await this.prisma.userNotificationPreference.findUnique({
        where: {
          userId_contour_eventType_channel: {
            userId: normalizedUserId,
            contour: input.contour,
            eventType,
            channel: input.channel,
          },
        },
        select: { enabled: true },
      });
    if (userOverride) {
      return {
        enabled: userOverride.enabled,
        source: 'USER_OVERRIDE',
      };
    }

    const legacyDisabled = await this.resolveLegacyDisabledPushPreference({
      userId: normalizedUserId,
      eventType,
      channel: input.channel,
    });
    if (legacyDisabled !== null) {
      return legacyDisabled;
    }

    return decision;
  }

  private async resolveLegacyDisabledPushPreference(params: {
    userId: string;
    eventType: string;
    channel: NotificationChannel;
  }): Promise<NotificationPreferenceDecision | null> {
    if (params.channel !== NotificationChannel.PUSH) return null;

    const legacyKey = getLegacyPushPreferenceKey(params.eventType);
    if (!legacyKey) return null;

    const preference = (await this.prisma.pushPreference.findUnique({
      where: { userId: params.userId },
      select: {
        chat: true,
        ticketNew: true,
        assignment: true,
        statusChange: true,
        acceptance: true,
        acceptanceReject: true,
        sla: true,
      },
    })) as LegacyPushPreferenceSnapshot | null;

    if (preference?.[legacyKey] === false) {
      return { enabled: false, source: 'LEGACY_PUSH_PREFERENCE' };
    }

    return null;
  }

  private normalizeId(value?: string | null) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized.length > 0 ? normalized : null;
  }
}
