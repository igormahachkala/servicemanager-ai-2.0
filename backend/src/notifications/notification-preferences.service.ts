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
  | 'CURRENT_DELIVERY_DEFAULT'
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

type ValidDeliveryPreferenceInput = {
  index: number;
  companyId: string;
  contour: NotificationContour;
  role: UserRole;
  userId: string | null;
  eventType: string;
  channel: NotificationChannel;
};

type CompanyRolePreferenceRow = {
  companyId: string;
  contour: NotificationContour;
  role: UserRole;
  eventType: string;
  channel: NotificationChannel;
  enabled: boolean;
};

type UserPreferenceRow = {
  userId: string;
  contour: NotificationContour;
  eventType: string;
  channel: NotificationChannel;
  enabled: boolean;
};

type LegacyPushPreferenceRow = LegacyPushPreferenceSnapshot & {
  userId: string;
};

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

  async resolveDeliveryPreference(
    input: ResolveNotificationPreferenceInput,
  ): Promise<NotificationPreferenceDecision> {
    return (
      (await this.resolveDeliveryPreferences([input]))[0] ?? {
        enabled: false,
        source: 'INVALID_INPUT',
      }
    );
  }

  async resolveDeliveryPreferences(
    inputs: ResolveNotificationPreferenceInput[],
  ): Promise<NotificationPreferenceDecision[]> {
    if (!inputs.length) return [];

    const validInputs: ValidDeliveryPreferenceInput[] = [];
    const decisions: NotificationPreferenceDecision[] = inputs.map(
      (input, index) => {
        const normalizedCompanyId = this.normalizeId(input.companyId);
        const normalizedUserId = this.normalizeId(input.userId);
        const eventType = this.normalizeId(input.eventType);

        if (!normalizedCompanyId || !eventType) {
          return { enabled: false, source: 'INVALID_INPUT' as const };
        }
        if (!isSupportedNotificationContour(input.contour)) {
          return { enabled: false, source: 'INVALID_INPUT' as const };
        }
        if (!isSupportedNotificationChannel(input.channel)) {
          return { enabled: false, source: 'INVALID_INPUT' as const };
        }
        if (!isSupportedNotificationEvent(eventType)) {
          return { enabled: false, source: 'UNKNOWN_EVENT' as const };
        }
        if (
          !isRoleRepresentableForNotificationContour({
            contour: input.contour,
            role: input.role,
          })
        ) {
          return { enabled: false, source: 'INVALID_INPUT' as const };
        }

        validInputs.push({
          index,
          companyId: normalizedCompanyId,
          contour: input.contour,
          role: input.role,
          userId: normalizedUserId,
          eventType,
          channel: input.channel,
        });
        return {
          enabled: true,
          source: 'CURRENT_DELIVERY_DEFAULT' as const,
        };
      },
    );

    if (!validInputs.length) return decisions;

    const companyOverrides = await this.findCompanyRoleOverrides(validInputs);
    for (const input of validInputs) {
      const override = companyOverrides.get(
        this.companyRolePreferenceKey(input),
      );
      if (override) {
        decisions[input.index] = {
          enabled: override.enabled,
          source: 'COMPANY_ROLE_OVERRIDE',
        };
      }
    }

    const userOverrides = await this.findUserOverrides(validInputs);
    const inputsWithUserOverride = new Set<string>();
    for (const input of validInputs) {
      if (!input.userId) continue;
      const key = this.userPreferenceKey(input);
      const override = userOverrides.get(key);
      if (override) {
        inputsWithUserOverride.add(key);
        decisions[input.index] = {
          enabled: override.enabled,
          source: 'USER_OVERRIDE',
        };
      }
    }

    const legacyPushPreferences =
      await this.findLegacyPushPreferences(validInputs);
    for (const input of validInputs) {
      if (
        input.channel !== NotificationChannel.PUSH ||
        !input.userId ||
        !decisions[input.index]?.enabled ||
        inputsWithUserOverride.has(this.userPreferenceKey(input))
      ) {
        continue;
      }
      const legacyKey = getLegacyPushPreferenceKey(input.eventType);
      if (!legacyKey) continue;
      const legacyPreference = legacyPushPreferences.get(input.userId);
      if (legacyPreference?.[legacyKey] === false) {
        decisions[input.index] = {
          enabled: false,
          source: 'LEGACY_PUSH_PREFERENCE',
        };
      }
    }

    return decisions;
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

  private async findCompanyRoleOverrides(
    inputs: ValidDeliveryPreferenceInput[],
  ): Promise<Map<string, CompanyRolePreferenceRow>> {
    const companyIds = this.unique(inputs.map((input) => input.companyId));
    const contours = this.unique(inputs.map((input) => input.contour));
    const roles = this.unique(inputs.map((input) => input.role));
    const eventTypes = this.unique(inputs.map((input) => input.eventType));
    const channels = this.unique(inputs.map((input) => input.channel));
    if (
      !companyIds.length ||
      !contours.length ||
      !roles.length ||
      !eventTypes.length ||
      !channels.length
    ) {
      return new Map();
    }

    const rows = (await this.prisma.companyNotificationRolePreference.findMany({
      where: {
        companyId: { in: companyIds },
        contour: { in: contours },
        role: { in: roles },
        eventType: { in: eventTypes },
        channel: { in: channels },
      },
      select: {
        companyId: true,
        contour: true,
        role: true,
        eventType: true,
        channel: true,
        enabled: true,
      },
    })) as CompanyRolePreferenceRow[];

    return new Map(
      rows.map((row) => [this.companyRolePreferenceKey(row), row]),
    );
  }

  private async findUserOverrides(
    inputs: ValidDeliveryPreferenceInput[],
  ): Promise<Map<string, UserPreferenceRow>> {
    const withUsers = inputs.filter((input) => input.userId);
    const userIds = this.unique(
      withUsers.map((input) => input.userId).filter(Boolean) as string[],
    );
    if (!userIds.length) return new Map();

    const rows = (await this.prisma.userNotificationPreference.findMany({
      where: {
        userId: { in: userIds },
        contour: { in: this.unique(withUsers.map((input) => input.contour)) },
        eventType: {
          in: this.unique(withUsers.map((input) => input.eventType)),
        },
        channel: { in: this.unique(withUsers.map((input) => input.channel)) },
      },
      select: {
        userId: true,
        contour: true,
        eventType: true,
        channel: true,
        enabled: true,
      },
    })) as UserPreferenceRow[];

    return new Map(rows.map((row) => [this.userPreferenceKey(row), row]));
  }

  private async findLegacyPushPreferences(
    inputs: ValidDeliveryPreferenceInput[],
  ): Promise<Map<string, LegacyPushPreferenceRow>> {
    const userIds = this.unique(
      inputs
        .filter((input) => input.channel === NotificationChannel.PUSH)
        .map((input) => input.userId)
        .filter(Boolean) as string[],
    );
    if (!userIds.length) return new Map();

    const rows = (await this.prisma.pushPreference.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        chat: true,
        ticketNew: true,
        assignment: true,
        statusChange: true,
        acceptance: true,
        acceptanceReject: true,
        sla: true,
      },
    })) as LegacyPushPreferenceRow[];

    return new Map(rows.map((row) => [row.userId, row]));
  }

  private companyRolePreferenceKey(params: {
    companyId: string;
    contour: NotificationContour;
    role: UserRole;
    eventType: string;
    channel: NotificationChannel;
  }) {
    return [
      params.companyId,
      params.contour,
      params.role,
      params.eventType,
      params.channel,
    ].join('|');
  }

  private userPreferenceKey(params: {
    userId: string | null;
    contour: NotificationContour;
    eventType: string;
    channel: NotificationChannel;
  }) {
    return [
      params.userId ?? '',
      params.contour,
      params.eventType,
      params.channel,
    ].join('|');
  }

  private unique<T>(values: T[]): T[] {
    return Array.from(new Set(values));
  }

  private normalizeId(value?: string | null) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized.length > 0 ? normalized : null;
  }
}
