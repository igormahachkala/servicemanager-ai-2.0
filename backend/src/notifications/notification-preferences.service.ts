import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompanyType,
  NotificationChannel,
  NotificationContour,
  UserRole,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  getLegacyPushPreferenceKey,
  getNotificationContoursForCompanyType,
  isNotificationContourApplicableForCompanyType,
  getSystemNotificationDefault,
  NOTIFICATION_CHANNEL_DEFINITIONS,
  NOTIFICATION_CONTOUR_LABELS_RU,
  NOTIFICATION_EVENT_GROUP_LABELS_RU,
  NOTIFICATION_ROLE_LABELS_RU,
  NOTIFICATION_ROLES_BY_CONTOUR,
  isRoleRepresentableForNotificationContour,
  isSupportedNotificationChannel,
  isSupportedNotificationContour,
  isSupportedNotificationEvent,
  isUserConfigurableNotificationChannel,
  SUPPORTED_NOTIFICATION_EVENTS,
  USER_CONFIGURABLE_NOTIFICATION_CHANNELS,
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

export type NotificationPreferenceActor = {
  id: string;
  companyId: string;
  role: UserRole;
};

export type NotificationPreferenceOverrideValue = boolean | null;

export type UpdateCompanyNotificationRolePreferenceInput = {
  companyId?: string | null;
  contour: NotificationContour;
  role: UserRole;
  eventType: string;
  channel: NotificationChannel;
  enabled?: NotificationPreferenceOverrideValue;
};

export type UpdateUserNotificationPreferenceInput = {
  contour: NotificationContour;
  eventType: string;
  channel: NotificationChannel;
  enabled?: NotificationPreferenceOverrideValue;
};

export type NotificationPreferenceCell = {
  contour: NotificationContour;
  role: UserRole;
  eventType: string;
  channel: NotificationChannel;
  productDefaultEnabled: boolean;
  overrideEnabled: NotificationPreferenceOverrideValue;
  settingsEffectiveEnabled: boolean;
  deliveryEnabled: boolean;
  deliverySource: NotificationPreferenceSource;
};

export type UserNotificationPreferenceCell = Omit<
  NotificationPreferenceCell,
  'role'
> & {
  companyRoleOverrideEnabled: NotificationPreferenceOverrideValue;
  userOverrideEnabled: NotificationPreferenceOverrideValue;
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

type NotificationPreferenceCompany = {
  id: string;
  name: string;
  type: CompanyType;
};

type NotificationPreferenceUser = {
  id: string;
  companyId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  company: NotificationPreferenceCompany;
};

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  getPreferenceCatalog(actor?: Partial<NotificationPreferenceActor> | null) {
    return {
      events: SUPPORTED_NOTIFICATION_EVENTS.map((event) => ({
        key: event.key,
        labelRu: event.labelRu,
        descriptionRu: event.descriptionRu,
        group: event.group,
        groupLabelRu: NOTIFICATION_EVENT_GROUP_LABELS_RU[event.group],
        defaultSection: event.defaultSection,
      })),
      channels: NOTIFICATION_CHANNEL_DEFINITIONS.map((channel) => ({
        key: channel.key,
        labelRu: channel.labelRu,
        configurableByUser: channel.configurableByUser,
        deliveryKind: channel.deliveryKind,
        descriptionRu: channel.descriptionRu,
      })),
      contours: Object.values(NotificationContour).map((contour) => ({
        key: contour,
        labelRu: NOTIFICATION_CONTOUR_LABELS_RU[contour],
        roles: NOTIFICATION_ROLES_BY_CONTOUR[contour].map((role) => ({
          key: role,
          labelRu: this.roleLabel(role),
        })),
      })),
      canManageCompanyRoleMatrix: this.canManageCompanyPreferences(actor),
      defaultRollout: {
        strategy: 'EXPLICIT_CONFIGURATION_ONLY',
        existingCompanyDeliveryPreservedUntilOverride: true,
      },
    };
  }

  async getCompanyRoleMatrix(
    actor: NotificationPreferenceActor,
    companyId?: string | null,
  ) {
    const company = await this.assertCanManageCompanyPreferences(
      actor,
      companyId,
    );
    const contours = getNotificationContoursForCompanyType(company.type);
    const rows = (await this.prisma.companyNotificationRolePreference.findMany({
      where: {
        companyId: company.id,
        contour: { in: [...contours] },
        channel: { in: [...USER_CONFIGURABLE_NOTIFICATION_CHANNELS] },
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
    const overrideByKey = new Map(
      rows.map((row) => [this.companyRolePreferenceKey(row), row]),
    );

    return {
      company,
      canManage: true,
      contours: contours.map((contour) => ({
        key: contour,
        labelRu: NOTIFICATION_CONTOUR_LABELS_RU[contour],
        roles: NOTIFICATION_ROLES_BY_CONTOUR[contour].map((role) => ({
          key: role,
          labelRu: this.roleLabel(role),
          preferences: this.buildCompanyRoleCells({
            companyId: company.id,
            contour,
            role,
            overrides: overrideByKey,
          }),
        })),
      })),
      catalog: this.getPreferenceCatalog(actor),
    };
  }

  async updateCompanyRolePreference(
    actor: NotificationPreferenceActor,
    input: UpdateCompanyNotificationRolePreferenceInput,
  ) {
    const company = await this.assertCanManageCompanyPreferences(
      actor,
      input.companyId,
    );
    this.assertOverrideValueProvided(input);
    this.assertPreferenceTarget({
      companyType: company.type,
      contour: input.contour,
      role: input.role,
      eventType: input.eventType,
      channel: input.channel,
    });

    if (input.enabled === null) {
      await this.prisma.companyNotificationRolePreference.deleteMany({
        where: {
          companyId: company.id,
          contour: input.contour,
          role: input.role,
          eventType: input.eventType,
          channel: input.channel,
        },
      });
    } else {
      await this.prisma.companyNotificationRolePreference.upsert({
        where: {
          companyId_contour_role_eventType_channel: {
            companyId: company.id,
            contour: input.contour,
            role: input.role,
            eventType: input.eventType,
            channel: input.channel,
          },
        },
        create: {
          companyId: company.id,
          contour: input.contour,
          role: input.role,
          eventType: input.eventType,
          channel: input.channel,
          enabled: Boolean(input.enabled),
          createdByUserId: actor.id,
          updatedByUserId: actor.id,
        },
        update: {
          enabled: Boolean(input.enabled),
          updatedByUserId: actor.id,
        },
      });
    }

    return this.getCompanyRoleMatrix(actor, company.id);
  }

  async getMyPreferences(actor: NotificationPreferenceActor) {
    const user = await this.findPreferenceUser(actor.id);
    this.assertCanManageUserPreferences(actor, user);
    return this.buildUserPreferences(actor, user);
  }

  async updateMyPreference(
    actor: NotificationPreferenceActor,
    input: UpdateUserNotificationPreferenceInput,
  ) {
    return this.updateUserPreference(actor, actor.id, input);
  }

  async getUserPreferences(actor: NotificationPreferenceActor, userId: string) {
    const user = await this.findPreferenceUser(userId);
    this.assertCanManageUserPreferences(actor, user);
    return this.buildUserPreferences(actor, user);
  }

  async updateUserPreference(
    actor: NotificationPreferenceActor,
    userId: string,
    input: UpdateUserNotificationPreferenceInput,
  ) {
    const user = await this.findPreferenceUser(userId);
    this.assertCanManageUserPreferences(actor, user);
    this.assertOverrideValueProvided(input);
    this.assertPreferenceTarget({
      companyType: user.company.type,
      contour: input.contour,
      role: user.role,
      eventType: input.eventType,
      channel: input.channel,
    });

    if (input.enabled === null) {
      await this.prisma.userNotificationPreference.deleteMany({
        where: {
          userId: user.id,
          contour: input.contour,
          eventType: input.eventType,
          channel: input.channel,
        },
      });
    } else {
      await this.prisma.userNotificationPreference.upsert({
        where: {
          userId_contour_eventType_channel: {
            userId: user.id,
            contour: input.contour,
            eventType: input.eventType,
            channel: input.channel,
          },
        },
        create: {
          userId: user.id,
          companyId: user.companyId,
          contour: input.contour,
          eventType: input.eventType,
          channel: input.channel,
          enabled: Boolean(input.enabled),
          createdByUserId: actor.id,
          updatedByUserId: actor.id,
        },
        update: {
          enabled: Boolean(input.enabled),
          companyId: user.companyId,
          updatedByUserId: actor.id,
        },
      });
    }

    return this.buildUserPreferences(actor, user);
  }

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

  private buildCompanyRoleCells(params: {
    companyId: string;
    contour: NotificationContour;
    role: UserRole;
    overrides: Map<string, CompanyRolePreferenceRow>;
  }): NotificationPreferenceCell[] {
    const cells: NotificationPreferenceCell[] = [];
    for (const event of SUPPORTED_NOTIFICATION_EVENTS) {
      for (const channel of USER_CONFIGURABLE_NOTIFICATION_CHANNELS) {
        const key = this.companyRolePreferenceKey({
          companyId: params.companyId,
          contour: params.contour,
          role: params.role,
          eventType: event.key,
          channel,
        });
        const override = params.overrides.get(key);
        const productDefaultEnabled = getSystemNotificationDefault({
          contour: params.contour,
          role: params.role,
          eventType: event.key,
          channel,
        });
        cells.push({
          contour: params.contour,
          role: params.role,
          eventType: event.key,
          channel,
          productDefaultEnabled,
          overrideEnabled: override?.enabled ?? null,
          settingsEffectiveEnabled: override?.enabled ?? productDefaultEnabled,
          deliveryEnabled: override?.enabled ?? true,
          deliverySource: override
            ? 'COMPANY_ROLE_OVERRIDE'
            : 'CURRENT_DELIVERY_DEFAULT',
        });
      }
    }
    return cells;
  }

  private async buildUserPreferences(
    actor: NotificationPreferenceActor,
    user: NotificationPreferenceUser,
  ) {
    const contours = getNotificationContoursForCompanyType(
      user.company.type,
    ).filter((contour) =>
      isRoleRepresentableForNotificationContour({
        contour,
        role: user.role,
      }),
    );
    const companyRows =
      (await this.prisma.companyNotificationRolePreference.findMany({
        where: {
          companyId: user.companyId,
          contour: { in: [...contours] },
          role: user.role,
          channel: { in: [...USER_CONFIGURABLE_NOTIFICATION_CHANNELS] },
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
    const userRows = (await this.prisma.userNotificationPreference.findMany({
      where: {
        userId: user.id,
        contour: { in: [...contours] },
        channel: { in: [...USER_CONFIGURABLE_NOTIFICATION_CHANNELS] },
      },
      select: {
        userId: true,
        contour: true,
        eventType: true,
        channel: true,
        enabled: true,
      },
    })) as UserPreferenceRow[];

    const companyOverrideByKey = new Map(
      companyRows.map((row) => [this.companyRolePreferenceKey(row), row]),
    );
    const userOverrideByKey = new Map(
      userRows.map((row) => [this.userPreferenceKey(row), row]),
    );
    const cells = this.buildUserCells({
      companyId: user.companyId,
      role: user.role,
      userId: user.id,
      contours,
      companyOverrides: companyOverrideByKey,
      userOverrides: userOverrideByKey,
    });
    const deliveryDecisions = await this.resolveDeliveryPreferences(
      cells.map((cell) => ({
        companyId: user.companyId,
        contour: cell.contour,
        role: user.role,
        userId: user.id,
        eventType: cell.eventType,
        channel: cell.channel,
      })),
    );

    return {
      user: {
        id: user.id,
        companyId: user.companyId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        roleLabelRu: this.roleLabel(user.role),
      },
      company: user.company,
      canManage:
        user.id === actor.id || this.canManageCompanyPreferences(actor),
      contours: contours.map((contour) => ({
        key: contour,
        labelRu: NOTIFICATION_CONTOUR_LABELS_RU[contour],
        role: {
          key: user.role,
          labelRu: this.roleLabel(user.role),
        },
        preferences: cells
          .filter((cell) => cell.contour === contour)
          .map((cell) => {
            const decision = deliveryDecisions.shift() ?? {
              enabled: false,
              source: 'INVALID_INPUT' as const,
            };
            return {
              ...cell,
              deliveryEnabled: decision.enabled,
              deliverySource: decision.source,
            };
          }),
      })),
      catalog: this.getPreferenceCatalog(actor),
    };
  }

  private buildUserCells(params: {
    companyId: string;
    role: UserRole;
    userId: string;
    contours: readonly NotificationContour[];
    companyOverrides: Map<string, CompanyRolePreferenceRow>;
    userOverrides: Map<string, UserPreferenceRow>;
  }): UserNotificationPreferenceCell[] {
    const cells: UserNotificationPreferenceCell[] = [];
    for (const contour of params.contours) {
      for (const event of SUPPORTED_NOTIFICATION_EVENTS) {
        for (const channel of USER_CONFIGURABLE_NOTIFICATION_CHANNELS) {
          const companyOverride =
            params.companyOverrides.get(
              this.companyRolePreferenceKey({
                companyId: params.companyId,
                contour,
                role: params.role,
                eventType: event.key,
                channel,
              }),
            )?.enabled ?? null;
          const userOverride =
            params.userOverrides.get(
              this.userPreferenceKey({
                userId: params.userId,
                contour,
                eventType: event.key,
                channel,
              }),
            )?.enabled ?? null;
          const productDefaultEnabled = getSystemNotificationDefault({
            contour,
            role: params.role,
            eventType: event.key,
            channel,
          });
          cells.push({
            contour,
            eventType: event.key,
            channel,
            productDefaultEnabled,
            companyRoleOverrideEnabled: companyOverride,
            userOverrideEnabled: userOverride,
            overrideEnabled: userOverride,
            settingsEffectiveEnabled:
              userOverride ?? companyOverride ?? productDefaultEnabled,
            deliveryEnabled: true,
            deliverySource: 'CURRENT_DELIVERY_DEFAULT',
          });
        }
      }
    }
    return cells;
  }

  private async assertCanManageCompanyPreferences(
    actor: NotificationPreferenceActor,
    requestedCompanyId?: string | null,
  ): Promise<NotificationPreferenceCompany> {
    const actorCompanyId = this.normalizeId(actor.companyId);
    const actorId = this.normalizeId(actor.id);
    if (!actorCompanyId || !actorId) {
      throw new ForbiddenException(
        'Недостаточно прав для настройки уведомлений',
      );
    }
    if (!this.canManageCompanyPreferences(actor)) {
      throw new ForbiddenException(
        'Недостаточно прав для настройки уведомлений',
      );
    }

    const normalizedRequestedCompanyId = this.normalizeId(requestedCompanyId);
    if (
      actor.role !== UserRole.PLATFORM_ADMIN &&
      normalizedRequestedCompanyId &&
      normalizedRequestedCompanyId !== actorCompanyId
    ) {
      throw new ForbiddenException('Нельзя настраивать чужую компанию');
    }

    const companyId =
      actor.role === UserRole.PLATFORM_ADMIN
        ? (normalizedRequestedCompanyId ?? actorCompanyId)
        : actorCompanyId;
    const company = (await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, type: true },
    })) as NotificationPreferenceCompany | null;

    if (!company) {
      throw new NotFoundException('Компания не найдена');
    }

    return company;
  }

  private async findPreferenceUser(
    userId: string,
  ): Promise<NotificationPreferenceUser> {
    const normalizedUserId = this.normalizeId(userId);
    if (!normalizedUserId) {
      throw new BadRequestException('Некорректный пользователь');
    }

    const user = (await this.prisma.user.findUnique({
      where: { id: normalizedUserId },
      select: {
        id: true,
        companyId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        deletedAt: true,
        company: { select: { id: true, name: true, type: true } },
      },
    })) as
      | (NotificationPreferenceUser & {
          isActive: boolean;
          deletedAt: Date | null;
        })
      | null;

    if (!user || user.deletedAt) {
      throw new NotFoundException('Пользователь не найден');
    }

    return {
      id: user.id,
      companyId: user.companyId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      company: user.company,
    };
  }

  private assertCanManageUserPreferences(
    actor: NotificationPreferenceActor,
    user: NotificationPreferenceUser,
  ) {
    if (actor.id === user.id) return;
    if (actor.role === UserRole.PLATFORM_ADMIN) return;
    if (actor.role === UserRole.ADMIN && actor.companyId === user.companyId) {
      return;
    }
    throw new ForbiddenException('Недостаточно прав для настройки уведомлений');
  }

  private assertPreferenceTarget(params: {
    companyType: CompanyType;
    contour: NotificationContour;
    role: UserRole;
    eventType: string;
    channel: NotificationChannel;
  }) {
    if (!isSupportedNotificationContour(params.contour)) {
      throw new BadRequestException('Неизвестный контур уведомлений');
    }
    if (
      !isNotificationContourApplicableForCompanyType({
        contour: params.contour,
        companyType: params.companyType,
      })
    ) {
      throw new ForbiddenException('Контур недоступен для этой компании');
    }
    if (
      !isRoleRepresentableForNotificationContour({
        contour: params.contour,
        role: params.role,
      })
    ) {
      throw new BadRequestException('Роль недоступна для этого контура');
    }
    if (!isSupportedNotificationEvent(params.eventType)) {
      throw new BadRequestException('Неизвестное событие уведомления');
    }
    if (!isSupportedNotificationChannel(params.channel)) {
      throw new BadRequestException('Неизвестный канал уведомления');
    }
    if (!isUserConfigurableNotificationChannel(params.channel)) {
      throw new BadRequestException('Канал нельзя настраивать по пользователю');
    }
  }

  private assertOverrideValueProvided(input: { enabled?: boolean | null }) {
    if (
      input.enabled !== true &&
      input.enabled !== false &&
      input.enabled !== null
    ) {
      throw new BadRequestException('Передайте enabled: true, false или null');
    }
  }

  private canManageCompanyPreferences(
    actor?: Partial<NotificationPreferenceActor> | null,
  ) {
    return (
      actor?.role === UserRole.ADMIN || actor?.role === UserRole.PLATFORM_ADMIN
    );
  }

  private roleLabel(role: UserRole) {
    return NOTIFICATION_ROLE_LABELS_RU[role] ?? role;
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
