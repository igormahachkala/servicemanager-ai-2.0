import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CompanyType,
  Prisma,
  ServiceContractRole,
  TicketStatus,
  UserRole,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { MaxBotService } from '../max-bot/max-bot.service';
import { PushService, type PushEventType } from '../push/push.service';
import {
  ContractContextService,
  type ContractContext,
} from '../service-contracts/contract-context.service';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';
import { activeServiceContractWhere } from '../service-contracts/service-contract-window';
import * as ticketAccess from '../tickets/ticket-access.utils';
import { matchCategorySpecializationLinks } from '../tickets/ticket-specialization-match.utils';
import {
  buildLegacyNotificationNavigationTarget,
  buildTicketNotificationNavigationTarget,
  ticketNotificationSectionForType,
  type NotificationNavigationTarget,
  type NotificationTicketSection,
} from './notification-navigation';

const WATCHER_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
  UserRole.NETWORK_DIRECTOR,
  UserRole.TERRITORIAL_MANAGER,
];

const CLIENT_CREATED_NOTIFY_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.NETWORK_DIRECTOR,
  UserRole.TERRITORIAL_MANAGER,
];

const PROVIDER_CREATED_NOTIFY_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DISPATCHER,
  UserRole.TECHNICIAN,
];

const CLIENT_CROSS_COMPANY_CREATED_NOTIFY_ROLES: UserRole[] = [
  ...CLIENT_CREATED_NOTIFY_ROLES,
  UserRole.CLIENT,
];

/** Клиентский тенант: кого уведомить, когда подрядчик назначил своего техника на заявку клиента. */
const CLIENT_COMPANY_ASSIGNEE_NOTIFY_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
  UserRole.NETWORK_DIRECTOR,
  UserRole.TERRITORIAL_MANAGER,
];

/** Получатели «запрос назначения» от техника (без NETWORK_DIRECTOR / TERRITORIAL_MANAGER по продуктовому ТЗ). */
const ASSIGNMENT_REQUEST_RECIPIENT_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MASTER,
  UserRole.DISPATCHER,
  UserRole.STAFF,
];

const ACCEPTANCE_NOTIFY_ROLES: UserRole[] = [
  UserRole.CLIENT,
  UserRole.ADMIN,
  UserRole.NETWORK_DIRECTOR,
  UserRole.TERRITORIAL_MANAGER,
];

const STATUS_RU: Record<TicketStatus, string> = {
  NEW: 'Новая',
  ASSIGNED: 'Назначена',
  IN_PROGRESS: 'В работе',
  AWAITING_ACCEPTANCE: 'На приёмке',
  DONE: 'Выполнена',
  CANCELED: 'Отменена',
};

const NOTIFICATION_ACCESS_CHECK_CONCURRENCY = 8;

type NotificationRecipientCandidate = {
  id: string;
  companyId: string;
  role: UserRole;
};

type AccessibleNotificationRecipient = NotificationRecipientCandidate & {
  linkedClientCompanyId: string | null;
};

type NotificationRequiredSpecialization = {
  id: string;
  name: string;
  isActive: boolean;
};

type NotificationTicketContext = {
  id: string;
  companyId: string;
  locationId: string | null;
  assignedTechnicianId: string | null;
  problemCategory?: {
    specializationLinks?: Array<{
      specializationId: string;
      specialization?: {
        id?: string | null;
        name: string | null;
        isActive?: boolean | null;
      } | null;
    }> | null;
  } | null;
};

function ticketLabel(ticketNumber: number) {
  return `Заявка #${ticketNumber}`;
}

function clipMessage(text: string, max = 400) {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildTicketPushRoute(params: {
  ticketId: string;
  chat?: boolean;
  section?: NotificationTicketSection;
  linkedClientCompanyId?: string | null;
  companyId?: string | null;
}) {
  const query = new URLSearchParams();
  const section = params.section ?? (params.chat ? 'comments' : 'overview');
  if (section && section !== 'overview') query.set('section', section);
  if (section === 'comments') query.set('tab', 'chat');
  if (params.linkedClientCompanyId) query.set('linkedClientCompanyId', params.linkedClientCompanyId);
  if (params.companyId) query.set('companyId', params.companyId);
  const qs = query.toString();
  return `/m/tickets/${encodeURIComponent(params.ticketId)}${qs ? `?${qs}` : ''}`;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly maxBot: MaxBotService,
    private readonly push: PushService,
    private readonly serviceContractsService: ServiceContractsService,
    private readonly contractContextService: ContractContextService,
  ) {}

  /**
   * Web Push получателю доменного события. Вызывается рядом с созданием in-app
   * Notification — переиспользует уже вычисленных получателей (инициатор в них уже
   * исключён). PushService сам уважает тумблер PushPreference[type]. Ошибка push
   * не должна ронять доменную операцию — только лог.
   * navigate: чат-события ведут в тред (?tab=chat), остальные — в карточку заявки.
   */
  private async pushTicketEvent(params: {
    userId: string;
    type: PushEventType;
    ticketId: string;
    title: string;
    body: string;
    chat?: boolean;
    notificationType?: string;
    linkedClientCompanyId?: string | null;
    companyId?: string | null;
  }) {
    try {
      const notificationType = params.notificationType ?? params.type;
      const section = ticketNotificationSectionForType(notificationType);
      const navigationTarget = buildTicketNotificationNavigationTarget({
        ticketId: params.ticketId,
        type: notificationType,
        section,
        linkedClientCompanyId: params.linkedClientCompanyId,
      });
      const navigate = buildTicketPushRoute({
        ticketId: params.ticketId,
        chat: params.chat,
        section,
        linkedClientCompanyId: params.linkedClientCompanyId,
        companyId: params.companyId,
      });
      const tag = `${params.ticketId}:${params.chat ? 'chat' : params.type}`;
      await this.push.sendToUser(
        params.userId,
        {
          title: params.title,
          body: clipMessage(params.body, 300),
          tag,
          url: navigate,
          targetRoute: navigate,
          ticketId: params.ticketId,
          notificationType,
          linkedClientCompanyId: params.linkedClientCompanyId ?? undefined,
          companyId: params.companyId ?? undefined,
          navigationTarget,
          navigate,
        },
        params.type,
        params.ticketId,
      );
    } catch (err) {
      this.logger.warn({ err, type: params.type }, 'push_emit_failed');
    }
  }

  private async pushTicketEventToMany(params: {
    userIds: string[];
    type: PushEventType;
    ticketId: string;
    title: string;
    body: string;
    chat?: boolean;
    notificationType?: string;
    linkedClientCompanyId?: string | null;
    companyId?: string | null;
  }) {
    const unique = Array.from(new Set(params.userIds.filter(Boolean)));
    await Promise.all(
      unique.map((userId) =>
        this.pushTicketEvent({
          userId,
          type: params.type,
          ticketId: params.ticketId,
          title: params.title,
          body: params.body,
          chat: params.chat,
          notificationType: params.notificationType,
          linkedClientCompanyId: params.linkedClientCompanyId,
          companyId: params.companyId,
        }),
      ),
    );
  }

  /**
   * Список уведомлений только для пары (JWT companyId, JWT userId) — без кросс-тенанта и чужих userId.
   * unreadCount считает readAt === null в том же скоупе.
   */
  async listForUser(companyId: string, userId: string) {
    const where = { companyId, userId };
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.notification.count({
        where: { ...where, readAt: null },
      }),
    ]);
    return { items, unreadCount };
  }

  async markOneRead(companyId: string, userId: string, id: string) {
    const row = await this.prisma.notification.findFirst({
      where: { id, companyId, userId },
    });
    if (!row) {
      throw new NotFoundException('Notification not found');
    }
    if (row.readAt) {
      return { ok: true as const, notification: row };
    }
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return { ok: true as const, notification: updated };
  }

  async markAllRead(companyId: string, userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { companyId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true as const, updated: res.count };
  }

  private async safeNotify(label: string, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (err) {
      this.logger.warn({ err, label }, 'notification_emit_failed');
    }
  }

  private notificationDedupeKey(kind: string, ...parts: Array<string | number | null | undefined>) {
    return [kind, ...parts.map((part) => {
      if (part === null || part === undefined) return '-';
      const text = String(part).trim();
      return text.length > 0 ? text : '-';
    })].join('|');
  }

  private isUniqueViolation(err: unknown) {
    return (
      !!err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    );
  }

  private async createNotification(data: Prisma.NotificationUncheckedCreateInput & { dedupeKey: string }) {
    try {
      return await this.prisma.notification.create({ data: this.withNavigationTarget(data) });
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        return null;
      }
      throw err;
    }
  }

  private async createNotifications(
    data: Array<Prisma.NotificationCreateManyInput & { dedupeKey: string }>,
  ) {
    if (!data.length) return { count: 0 };
    return this.prisma.notification.createMany({
      data: data.map((item) => this.withNavigationTarget(item)),
      skipDuplicates: true,
    });
  }

  private withNavigationTarget<T>(data: T): T {
    const item = data as {
      type?: string | null;
      entityType?: string | null;
      entityId?: string | null;
      linkedClientCompanyId?: string | null;
      navigationTarget?: unknown;
    };
    if (item.navigationTarget !== undefined) return data;
    const navigationTarget = buildLegacyNotificationNavigationTarget({
      entityType: item.entityType,
      entityId: item.entityId,
      type: item.type,
      linkedClientCompanyId: item.linkedClientCompanyId,
    }) as NotificationNavigationTarget | null;
    if (!navigationTarget) return data;
    return { ...(data as Record<string, unknown>), navigationTarget } as T;
  }

  private linkedClientForRecipientCompany(recipientCompanyId: string, ticketCompanyId: string) {
    return recipientCompanyId !== ticketCompanyId ? ticketCompanyId : null;
  }

  private ticketRequiredSpecializations(
    ticket: NotificationTicketContext,
  ): NotificationRequiredSpecialization[] {
    return (ticket.problemCategory?.specializationLinks ?? []).map((link) => ({
      id: link.specialization?.id ?? link.specializationId,
      name: link.specialization?.name ?? '',
      isActive: link.specialization?.isActive ?? true,
    }));
  }

  private contractContextAllowsLocation(
    context: ContractContext,
    locationId: string | null | undefined,
  ) {
    if (context.contractLocationScope.mode === 'tenant_wide') return true;
    if (context.contractLocationScope.mode === 'restricted_empty') return false;
    return !!locationId && context.contractLocationScope.locationIds.includes(locationId);
  }

  private contractContextAllowsSpecializations(
    context: ContractContext,
    requiredSpecializations: NotificationRequiredSpecialization[],
  ) {
    if (requiredSpecializations.length === 0) return true;
    if (context.contractSpecializationScope.mode === 'UNCONFIGURED') return false;

    const matched = matchCategorySpecializationLinks({
      categoryLinks: requiredSpecializations.map((specialization) => ({
        specializationId: specialization.id,
        specialization: { name: specialization.name },
      })),
      technicianSpecializationIds: context.contractSpecializationScope.specializationIds,
      technicianSpecializationNames: context.contractSpecializationScope.specializationNames,
    });

    return matched.length > 0;
  }

  private contractContextAllowsTicket(
    context: ContractContext,
    ticket: NotificationTicketContext,
  ) {
    return (
      this.contractContextAllowsLocation(context, ticket.locationId) &&
      this.contractContextAllowsSpecializations(
        context,
        this.ticketRequiredSpecializations(ticket),
      )
    );
  }

  private async resolveNotificationTicketContext(params: {
    ticketId: string;
    ticketCompanyId: string;
  }): Promise<NotificationTicketContext | null> {
    return this.prisma.ticket.findFirst({
      where: {
        id: params.ticketId,
        companyId: params.ticketCompanyId,
      },
      select: {
        id: true,
        companyId: true,
        locationId: true,
        assignedTechnicianId: true,
        problemCategory: {
          select: {
            specializationLinks: {
              select: {
                specializationId: true,
                specialization: {
                  select: {
                    id: true,
                    name: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    mapper: (item: T) => Promise<R>,
  ): Promise<R[]> {
    if (!items.length) return [];
    const safeLimit = Math.max(1, Math.min(limit, items.length));
    const results = new Array<R>(items.length);
    let nextIndex = 0;

    const workers = Array.from({ length: safeLimit }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index]);
      }
    });

    await Promise.all(workers);
    return results;
  }

  private async canReadTicketForNotification(params: {
    recipient: NotificationRecipientCandidate;
    ticket: NotificationTicketContext;
  }) {
    const linkedClientCompanyId = this.linkedClientForRecipientCompany(
      params.recipient.companyId,
      params.ticket.companyId,
    );
    let allowedLinkedClientContractRoles: ServiceContractRole[] | undefined;

    if (linkedClientCompanyId) {
      const contractContext = await this.contractContextService.getContractContext({
        providerCompanyId: params.recipient.companyId,
        clientCompanyId: params.ticket.companyId,
        ticketId: params.ticket.id,
      });

      if (
        !contractContext ||
        ![ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY].includes(
          contractContext.roleInContract,
        ) ||
        !this.contractContextAllowsTicket(contractContext, params.ticket)
      ) {
        return false;
      }

      allowedLinkedClientContractRoles = [contractContext.roleInContract];
    }

    try {
      await ticketAccess.resolveReadableTicketAccess({
        prisma: this.prisma,
        serviceContractsService: this.serviceContractsService,
        actor: {
          id: params.recipient.id,
          role: params.recipient.role,
          companyId: params.recipient.companyId,
        },
        ticketId: params.ticket.id,
        linkedClientCompanyId: linkedClientCompanyId ?? undefined,
        allowedLinkedClientContractRoles,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async filterRecipientsByTicketAccess(params: {
    users: NotificationRecipientCandidate[];
    ticketId: string;
    ticketCompanyId: string;
  }): Promise<AccessibleNotificationRecipient[]> {
    const ticket = await this.resolveNotificationTicketContext({
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
    });
    if (!ticket) return [];

    const seen = new Set<string>();
    const unique = params.users.filter((user) => {
      const key = `${user.companyId}:${user.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const checked = await this.mapWithConcurrency(
      unique,
      NOTIFICATION_ACCESS_CHECK_CONCURRENCY,
      async (user) => ({
        user,
        allowed: await this.canReadTicketForNotification({
          recipient: user,
          ticket,
        }),
      }),
    );
    return checked
      .filter((item) => item.allowed)
      .map((item) => ({
        ...item.user,
        linkedClientCompanyId: this.linkedClientForRecipientCompany(
          item.user.companyId,
          ticket.companyId,
        ),
      }));
  }

  private async resolveAccessibleTicketUsers(params: {
    ticketId: string;
    ticketCompanyId: string;
    includeCompanyIds?: Array<string | null | undefined>;
    includeUserIds?: Array<string | null | undefined>;
    excludeUserIds?: Array<string | null | undefined>;
  }) {
    const providerContracts = await this.prisma.serviceContract.findMany({
      where: {
        clientCompanyId: params.ticketCompanyId,
        ...activeServiceContractWhere(),
      },
      select: { providerCompanyId: true },
    });
    const companyIds = Array.from(
      new Set(
        [
          params.ticketCompanyId,
          ...providerContracts.map((contract) => contract.providerCompanyId),
          ...(params.includeCompanyIds ?? []),
        ]
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter((value) => value.length > 0),
      ),
    );
    const includeUserIds = Array.from(
      new Set(
        (params.includeUserIds ?? [])
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter((value) => value.length > 0),
      ),
    );
    const excludeUserIds = Array.from(
      new Set(
        (params.excludeUserIds ?? [])
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter((value) => value.length > 0),
      ),
    );
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          ...(companyIds.length ? [{ companyId: { in: companyIds } }] : []),
          ...(includeUserIds.length ? [{ id: { in: includeUserIds } }] : []),
        ],
        ...(excludeUserIds.length ? { id: { notIn: excludeUserIds } } : {}),
      },
      select: { id: true, companyId: true, role: true },
    });
    return this.filterRecipientsByTicketAccess({
      users,
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
    });
  }

  async unreadCountForUser(companyId: string, userId: string) {
    return this.prisma.notification.count({
      where: { companyId, userId, readAt: null },
    });
  }

  private formatUserLabel(user?: { email?: string | null; firstName?: string | null; lastName?: string | null } | null) {
    if (!user) return 'Исполнитель';
    const namePart = [user.firstName, user.lastName]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean)
      .join(' ')
      .trim();
    return namePart || (user.email || '').trim() || 'Исполнитель';
  }

  private async resolveUserLabel(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { email: true, firstName: true, lastName: true },
    });
    return this.formatUserLabel(user);
  }

  private async resolveCompanyPhone(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId },
      select: { phone: true },
    });
    return company?.phone?.trim() || null;
  }

  private async sendMaxTicketCreated(params: {
    companyId: string;
    locationId: string;
    ticketId: string;
    ticketNumber: number;
    targetCompanyId: string;
    creatorUserId: string | null;
    requesterName?: string | null;
    requesterPhone?: string | null;
    description?: string | null;
    pointName?: string | null;
    address?: string | null;
    categoryName?: string | null;
    urgency?: string | null;
  }) {
    const [requesterLabel, fallbackPhone] = await Promise.all([
      params.requesterName?.trim()
        ? Promise.resolve(params.requesterName.trim())
        : params.creatorUserId
          ? this.resolveUserLabel(params.creatorUserId)
          : Promise.resolve('Не указан'),
      this.resolveCompanyPhone(params.targetCompanyId),
    ]);

    await this.maxBot.sendTicketCreatedMessage({
      companyId: params.targetCompanyId,
      locationId: params.locationId,
      locationName: params.pointName,
      ticketId: params.ticketId,
      ticketNumber: params.ticketNumber,
      requesterLabel,
      requesterPhone: params.requesterPhone?.trim() || fallbackPhone || null,
      description: params.description,
      pointName: params.pointName,
      address: params.address,
      categoryName: params.categoryName,
      urgency: params.urgency,
    });
  }

  private async sendMaxTicketAssigned(params: {
    companyId: string;
    locationId: string | null;
    locationName?: string | null;
    ticketId: string;
    ticketNumber: number;
    technicianUserId: string;
  }) {
    const technicianLabel = await this.resolveUserLabel(params.technicianUserId);
    await this.maxBot.sendTicketAssignedMessage({
      companyId: params.companyId,
      locationId: params.locationId,
      locationName: params.locationName,
      ticketId: params.ticketId,
      ticketNumber: params.ticketNumber,
      technicianLabel,
    });
  }

  private async sendMaxTicketClaimed(params: {
    companyId: string;
    locationId: string | null;
    locationName?: string | null;
    ticketId: string;
    ticketNumber: number;
    technicianUserId: string;
  }) {
    const technicianLabel = await this.resolveUserLabel(params.technicianUserId);
    await this.maxBot.sendTicketClaimedMessage({
      companyId: params.companyId,
      locationId: params.locationId,
      locationName: params.locationName,
      ticketId: params.ticketId,
      ticketNumber: params.ticketNumber,
      technicianLabel,
    });
  }

  private async sendMaxTicketStatusChanged(params: {
    companyId: string;
    locationId: string | null;
    locationName?: string | null;
    ticketId: string;
    ticketNumber: number;
    fromStatus: TicketStatus;
    toStatus: TicketStatus;
  }) {
    await this.maxBot.sendTicketStatusChangedMessage({
      companyId: params.companyId,
      locationId: params.locationId,
      locationName: params.locationName,
      ticketId: params.ticketId,
      ticketNumber: params.ticketNumber,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
    });
  }

  scheduleTicketCreated(params: {
    actorCompanyId: string;
    creatorUserId: string | null;
    targetCompanyId: string;
    locationId: string;
    locationName?: string | null;
    locationAddress?: string | null;
    categoryName?: string | null;
    urgency?: string | null;
    requesterName?: string | null;
    requesterPhone?: string | null;
    description?: string | null;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    assignedTechnicianId: string | null;
    sourceEventId?: string | null;
  }) {
    void this.safeNotify('ticket.created+assign', () => this.emitTicketCreatedAndMaybeAssign(params));
    void this.safeNotify('max.ticket.created', () =>
      this.sendMaxTicketCreated({
        companyId: params.targetCompanyId,
        locationId: params.locationId,
        ticketId: params.ticketId,
        ticketNumber: params.ticketNumber,
        targetCompanyId: params.targetCompanyId,
        creatorUserId: params.creatorUserId,
        requesterName: params.requesterName,
        requesterPhone: params.requesterPhone,
        description: params.description,
        pointName: params.locationName,
        address: params.locationAddress,
        categoryName: params.categoryName,
        urgency: params.urgency,
      }),
    );
  }

  onTicketCreated(params: {
    actorCompanyId: string;
    creatorUserId: string | null;
    targetCompanyId: string;
    locationId: string;
    locationName?: string | null;
    locationAddress?: string | null;
    categoryName?: string | null;
    urgency?: string | null;
    requesterName?: string | null;
    requesterPhone?: string | null;
    description?: string | null;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    assignedTechnicianId: string | null;
    sourceEventId?: string | null;
  }) {
    this.scheduleTicketCreated(params);
  }

  scheduleTicketCreatedPublic(params: {
    ticketCompanyId: string;
    locationId: string;
    locationName?: string | null;
    locationAddress?: string | null;
    categoryName?: string | null;
    urgency?: string | null;
    requesterName?: string | null;
    requesterPhone?: string | null;
    description?: string | null;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    assignedTechnicianId: string | null;
    sourceEventId?: string | null;
  }) {
    void this.safeNotify('ticket.created.public', () => this.emitTicketCreatedPublicInternal(params));
    void this.safeNotify('max.ticket.created.public', () =>
      this.sendMaxTicketCreated({
        companyId: params.ticketCompanyId,
        locationId: params.locationId,
        ticketId: params.ticketId,
        ticketNumber: params.ticketNumber,
        targetCompanyId: params.ticketCompanyId,
        creatorUserId: null,
        requesterName: params.requesterName,
        requesterPhone: params.requesterPhone,
        description: params.description,
        pointName: params.locationName,
        address: params.locationAddress,
        categoryName: params.categoryName,
        urgency: params.urgency,
      }),
    );
  }

  scheduleTicketCreatedChild(params: {
    companyId: string;
    creatorUserId: string | null;
    locationId: string;
    locationName?: string | null;
    locationAddress?: string | null;
    categoryName?: string | null;
    urgency?: string | null;
    requesterName?: string | null;
    requesterPhone?: string | null;
    description?: string | null;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    assignedTechnicianId: string | null;
    sourceEventId?: string | null;
  }) {
    void this.safeNotify('ticket.created.child', () =>
      this.emitTicketCreatedAndMaybeAssign({
        actorCompanyId: params.companyId,
        creatorUserId: params.creatorUserId,
        targetCompanyId: params.companyId,
        locationId: params.locationId,
        ticketId: params.ticketId,
        ticketNumber: params.ticketNumber,
        summary: params.summary,
        assignedTechnicianId: params.assignedTechnicianId,
        sourceEventId: params.sourceEventId,
      }),
    );
    void this.safeNotify('max.ticket.created.child', () =>
      this.sendMaxTicketCreated({
        companyId: params.companyId,
        locationId: params.locationId,
        ticketId: params.ticketId,
        ticketNumber: params.ticketNumber,
        targetCompanyId: params.companyId,
        creatorUserId: params.creatorUserId,
        requesterName: params.requesterName,
        requesterPhone: params.requesterPhone,
        description: params.description,
        pointName: params.locationName,
        address: params.locationAddress,
        categoryName: params.categoryName,
        urgency: params.urgency,
      }),
    );
  }

  scheduleTicketAssignedToTechnician(params: {
    assigneeUserId: string;
    ticketId: string;
    ticketCompanyId: string;
    locationId?: string | null;
    locationName?: string | null;
    ticketNumber: number;
    summary: string;
    actorUserId: string | null;
    mode: 'manual' | 'auto' | 'reassign' | 'claim';
    sourceEventId?: string | null;
  }) {
    void this.safeNotify('ticket.assigned', () => this.emitTicketAssignedToAssignee(params));
    void this.safeNotify('max.ticket.assigned', () =>
      this.sendMaxTicketAssigned({
        companyId: params.ticketCompanyId,
        locationId: params.locationId ?? null,
        locationName: params.locationName,
        ticketId: params.ticketId,
        ticketNumber: params.ticketNumber,
        technicianUserId: params.assigneeUserId,
      }),
    );
  }

  /**
   * Клиентская компания заявки: уведомить операционных ролей о назначении техника подрядчика.
   * companyId уведомлений = ticketCompanyId (тенант клиента). Без кросс-тенанта.
   */
  scheduleTicketAssignedClientCompany(params: {
    ticketCompanyId: string;
    assigneeUserId: string;
    assigneeEmail: string;
    actorUserId: string | null;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    sourceEventId?: string | null;
  }) {
    void this.safeNotify('ticket.assigned_client', () => this.emitTicketAssignedClientCompanyInternal(params));
  }

  onTicketAssigned(params: {
    ticketCompanyId: string;
    assigneeUserId: string;
    assigneeEmail: string;
    actorUserId: string | null;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    sourceEventId?: string | null;
  }) {
    this.scheduleTicketAssignedClientCompany(params);
  }

  scheduleTicketClaimedDispatchers(params: {
    watcherCompanyId: string;
    ticketCompanyId: string;
    locationId?: string | null;
    locationName?: string | null;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    excludeUserId: string;
    linkedHint?: string | null;
    sourceEventId?: string | null;
  }) {
    void this.safeNotify('ticket.claimed', () => this.emitTicketClaimedDispatchersInternal(params));
    void this.safeNotify('max.ticket.claimed', () =>
      this.sendMaxTicketClaimed({
        companyId: params.ticketCompanyId,
        locationId: params.locationId ?? null,
        locationName: params.locationName,
        ticketId: params.ticketId,
        ticketNumber: params.ticketNumber,
        technicianUserId: params.excludeUserId,
      }),
    );
  }

  /**
   * Техник просит диспетчера назначить его (claim по специализации недоступен).
   * linkedClientCompanyId в строке уведомления = tenant заявки (companyId заявки).
   */
  async notifyTicketAssignmentRequested(params: {
    providerCompanyId: string;
    requesterUserId?: string | null;
    technicianUserId: string;
    ticketId: string;
    ticketNumber: number | null;
    ticketCompanyId: string;
    sourceEventId?: string | null;
  }) {
    const identityUsers = await this.prisma.user.findMany({
      where: {
        id: { in: Array.from(new Set([params.technicianUserId, params.requesterUserId].filter(Boolean) as string[])) },
        companyId: params.providerCompanyId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    const usersById = new Map(identityUsers.map((user) => [user.id, user]));
    const tech = usersById.get(params.technicianUserId) ?? null;
    const requester = params.requesterUserId && params.requesterUserId !== params.technicianUserId
      ? usersById.get(params.requesterUserId) ?? null
      : null;
    const namePart = [tech?.firstName, tech?.lastName]
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean)
      .join(' ')
      .trim();
    const techLabel = namePart || (tech?.email || '').trim() || 'Техник';
    const requesterNamePart = [requester?.firstName, requester?.lastName]
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean)
      .join(' ')
      .trim();
    const requesterLabel = requesterNamePart || (requester?.email || '').trim() || null;
    const numLabel =
      typeof params.ticketNumber === 'number' && !Number.isNaN(params.ticketNumber) && params.ticketNumber > 0
        ? String(params.ticketNumber)
        : params.ticketId.slice(0, 8).toUpperCase();

    const refSuffix = `|ref:${params.technicianUserId}`;
    const inner = requesterLabel
      ? `${requesterLabel} просит назначить ${techLabel} на заявку #${numLabel}`
      : `${techLabel} просит назначить его на заявку #${numLabel}`;
    const maxInner = Math.max(0, 400 - refSuffix.length);
    const innerClip = inner.length <= maxInner ? inner : `${inner.slice(0, Math.max(0, maxInner - 1))}…`;
    const messageWithRef = `${innerClip}${refSuffix}`;

    const users = await this.prisma.user.findMany({
      where: {
        companyId: params.providerCompanyId,
        isActive: true,
        deletedAt: null,
        role: { in: ASSIGNMENT_REQUEST_RECIPIENT_ROLES },
      },
      select: { id: true, companyId: true, role: true },
    });
    const recipients = await this.filterRecipientsByTicketAccess({
      users,
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
    });
    if (!recipients.length) {
      return { ok: true as const, notified: 0 };
    }

    const title = 'Запрос назначения';
    const message = messageWithRef.length <= 400 ? messageWithRef : clipMessage(messageWithRef);
    const created = await this.createNotifications(
      recipients.map((u) => ({
        companyId: u.companyId,
        userId: u.id,
        type: 'ticket.assignment_requested',
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: u.linkedClientCompanyId,
        dedupeKey: this.notificationDedupeKey(
          'ticket.assignment_requested',
          params.sourceEventId || params.ticketId,
          u.companyId,
          u.id,
        ),
      })),
    );

    // Запрос назначения от техника → диспетчерам (техник не входит в роли-получатели).
    await Promise.all(
      recipients.map((recipient) =>
        this.pushTicketEvent({
          userId: recipient.id,
          type: 'assignment',
          ticketId: params.ticketId,
          title,
          body: message,
          notificationType: 'ticket.assignment_requested',
          linkedClientCompanyId: recipient.linkedClientCompanyId,
        }),
      ),
    );
    return { ok: true as const, notified: created.count };
  }

  scheduleTicketStatusAssignee(params: {
    assigneeUserId: string;
    actorUserId: string | null;
    ticketId: string;
    ticketCompanyId: string;
    ticketNumber: number;
    summary: string;
    fromStatus: TicketStatus;
    toStatus: TicketStatus;
    linkedClientCompanyId: string | null;
    sourceEventId?: string | null;
  }) {
    void this.safeNotify('ticket.status_changed', () => this.emitTicketStatusChangedForAssignee(params));
  }

  scheduleTicketStatusChanged(params: {
    ticketCompanyId: string;
    locationId: string | null;
    locationName?: string | null;
    ticketId: string;
    ticketNumber: number;
    fromStatus: TicketStatus;
    toStatus: TicketStatus;
    sourceEventId?: string | null;
  }) {
    void this.safeNotify('max.ticket.status_changed', () =>
      this.sendMaxTicketStatusChanged({
        companyId: params.ticketCompanyId,
        locationId: params.locationId,
        locationName: params.locationName,
        ticketId: params.ticketId,
        ticketNumber: params.ticketNumber,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
      }),
    );
  }

  /** Уведомления операторам клиентского tenant о смене статуса (работы начаты / завершены). */
  scheduleTicketStatusForClientCompany(params: {
    ticketCompanyId: string;
    actorUserId: string | null;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    fromStatus: TicketStatus;
    toStatus: TicketStatus;
    sourceEventId?: string | null;
  }) {
    void this.safeNotify('ticket.status_client', () => this.emitTicketStatusForClientCompanyInternal(params));
  }

  onTicketInProgress(params: {
    ticketCompanyId: string;
    actorUserId: string | null;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    fromStatus: TicketStatus;
    sourceEventId?: string | null;
  }) {
    this.scheduleTicketStatusForClientCompany({
      ...params,
      toStatus: TicketStatus.IN_PROGRESS,
    });
  }

  onTicketDone(params: {
    ticketCompanyId: string;
    actorUserId: string | null;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    fromStatus: TicketStatus;
    sourceEventId?: string | null;
  }) {
    this.scheduleTicketStatusForClientCompany({
      ...params,
      toStatus: TicketStatus.DONE,
    });
  }

  onTicketAwaitingAcceptance(params: {
    ticketCompanyId: string;
    actorUserId: string | null;
    ticketId: string;
    ticketNumber: number;
    sourceEventId?: string | null;
  }) {
    void this.safeNotify('ticket.awaiting_acceptance', () => this.emitTicketAwaitingAcceptanceInternal(params));
  }

  onTicketAccepted(params: {
    ticketCompanyId: string;
    assignedTechnicianId: string | null;
    actorUserId: string | null;
    ticketId: string;
    ticketNumber: number;
    sourceEventId?: string | null;
  }) {
    this.scheduleTicketStatusChanged({
      ticketCompanyId: params.ticketCompanyId,
      locationId: null,
      ticketId: params.ticketId,
      ticketNumber: params.ticketNumber,
      fromStatus: TicketStatus.AWAITING_ACCEPTANCE,
      toStatus: TicketStatus.DONE,
      sourceEventId: params.sourceEventId,
    });
    if (!params.assignedTechnicianId) return;
    void this.safeNotify('ticket.accepted', () =>
      this.emitTicketAcceptedInternal({ ...params, assignedTechnicianId: params.assignedTechnicianId! }),
    );
  }

  onTicketRejected(params: {
    ticketCompanyId: string;
    assignedTechnicianId: string | null;
    actorUserId: string | null;
    ticketId: string;
    ticketNumber: number;
    comment: string | null;
    sourceEventId?: string | null;
  }) {
    this.scheduleTicketStatusChanged({
      ticketCompanyId: params.ticketCompanyId,
      locationId: null,
      ticketId: params.ticketId,
      ticketNumber: params.ticketNumber,
      fromStatus: TicketStatus.AWAITING_ACCEPTANCE,
      toStatus: TicketStatus.IN_PROGRESS,
      sourceEventId: params.sourceEventId,
    });
    if (!params.assignedTechnicianId) return;
    void this.safeNotify('ticket.rejected', () =>
      this.emitTicketRejectedInternal({ ...params, assignedTechnicianId: params.assignedTechnicianId! }),
    );
  }

  scheduleTicketCommentAdded(params: {
    ticketCompanyId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    actorUserId: string | null;
    assigneeUserId: string | null;
    assigneeCompanyId: string | null;
    sourceEventId?: string | null;
  }) {
    void this.safeNotify('ticket.comment_added', () => this.emitTicketCommentAddedInternal(params));
  }

  scheduleTicketAttachmentUploaded(params: {
    ticketCompanyId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    actorUserId: string | null;
    assigneeUserId: string | null;
    assigneeCompanyId: string | null;
    sourceEventId?: string | null;
  }) {
    void this.safeNotify('ticket.attachment_uploaded', () => this.emitTicketAttachmentUploadedInternal(params));
  }

  scheduleTicketSlaWarning(params: {
    ticketCompanyId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    slaDueAt: Date | null;
    sourceEventId?: string | null;
  }) {
    void this.safeNotify('ticket.sla_warning', () =>
      this.emitTicketSlaInternal({
        ...params,
        notificationType: 'ticket.sla_warning',
        title: 'Заявка близка к сроку',
        body: params.slaDueAt
          ? `${ticketLabel(params.ticketNumber)} — срок ${params.slaDueAt.toLocaleString('ru-RU')}. ${params.summary}`
          : `${ticketLabel(params.ticketNumber)} — срок скоро истекает. ${params.summary}`,
        dedupeKind: 'ticket.sla_warning',
      }),
    );
  }

  scheduleTicketSlaBreached(params: {
    ticketCompanyId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    slaDueAt: Date | null;
    sourceEventId?: string | null;
  }) {
    void this.safeNotify('ticket.sla_breached', () =>
      this.emitTicketSlaInternal({
        ...params,
        notificationType: 'ticket.sla_breached',
        title: 'Срок заявки нарушен',
        body: params.slaDueAt
          ? `${ticketLabel(params.ticketNumber)} — срок был ${params.slaDueAt.toLocaleString('ru-RU')}. ${params.summary}`
          : `${ticketLabel(params.ticketNumber)} — срок нарушен. ${params.summary}`,
        dedupeKind: 'ticket.sla_breached',
      }),
    );
  }

  private async emitTicketSlaInternal(params: {
    ticketCompanyId: string;
    ticketId: string;
    ticketNumber: number;
    notificationType: 'ticket.sla_warning' | 'ticket.sla_breached';
    title: string;
    body: string;
    dedupeKind: string;
    sourceEventId?: string | null;
  }) {
    const recipients = await this.resolveAccessibleTicketUsers({
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
    });
    if (!recipients.length) return;

    const message = clipMessage(params.body);
    await this.createNotifications(
      recipients.map((recipient) => ({
        companyId: recipient.companyId,
        userId: recipient.id,
        type: params.notificationType,
        title: params.title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: recipient.linkedClientCompanyId,
        dedupeKey: this.notificationDedupeKey(
          params.dedupeKind,
          params.sourceEventId || params.ticketId,
          recipient.companyId,
          recipient.id,
        ),
      })),
    );

    await Promise.all(
      recipients.map((recipient) =>
        this.pushTicketEvent({
          userId: recipient.id,
          type: 'sla',
          ticketId: params.ticketId,
          title: params.title,
          body: message,
          notificationType: params.notificationType,
          linkedClientCompanyId: recipient.linkedClientCompanyId,
        }),
      ),
    );
  }

  private async emitTicketCommentAddedInternal(params: {
    ticketCompanyId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    actorUserId: string | null;
    assigneeUserId: string | null;
    assigneeCompanyId: string | null;
    sourceEventId?: string | null;
  }) {
    const excludeIds = [params.actorUserId, params.assigneeUserId]
      .filter((value): value is string => !!value && value.length > 0)
      .filter((value, index, arr) => arr.indexOf(value) === index);

    const users = await this.prisma.user.findMany({
      where: {
        companyId: params.ticketCompanyId,
        isActive: true,
        deletedAt: null,
        role: { in: WATCHER_ROLES },
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      select: { id: true, companyId: true, role: true },
    });
    const recipients = await this.filterRecipientsByTicketAccess({
      users,
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
    });

    const title = 'Комментарий к заявке';
    const message = clipMessage(`${ticketLabel(params.ticketNumber)} — ${params.summary}`);

    await this.createNotifications(
      recipients.map((u) => ({
        companyId: u.companyId,
        userId: u.id,
        type: 'ticket.comment_added',
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: u.linkedClientCompanyId,
        dedupeKey: this.notificationDedupeKey(
          'ticket.comment_added.watchers',
          params.sourceEventId || params.ticketId,
          u.companyId,
          u.id,
        ),
      })),
    );

    // Push: комментарий = чат-событие (тред заявки). Получатели уже без инициатора.
    await Promise.all(
      recipients.map((recipient) =>
        this.pushTicketEvent({
          userId: recipient.id,
          type: 'chat',
          ticketId: params.ticketId,
          title,
          body: message,
          chat: true,
          notificationType: 'ticket.comment_added',
          linkedClientCompanyId: recipient.linkedClientCompanyId,
        }),
      ),
    );

    if (!params.assigneeUserId || !params.assigneeCompanyId) return;

    const assignee = await this.prisma.user.findFirst({
      where: {
        id: params.assigneeUserId,
        companyId: params.assigneeCompanyId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, companyId: true, role: true },
    });
    if (!assignee) return;
    const [assigneeRecipient] = await this.filterRecipientsByTicketAccess({
      users: [assignee],
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
    });
    if (!assigneeRecipient) return;

    await this.createNotification({
      companyId: assigneeRecipient.companyId,
      userId: assigneeRecipient.id,
      type: 'ticket.comment_added',
      title,
      message,
      entityType: 'Ticket',
      entityId: params.ticketId,
      linkedClientCompanyId: assigneeRecipient.linkedClientCompanyId,
      dedupeKey: this.notificationDedupeKey(
        'ticket.comment_added.assignee',
        params.sourceEventId || params.ticketId,
        assigneeRecipient.companyId,
        assigneeRecipient.id,
      ),
    });

    // Исполнителю — только если он не автор комментария (не пушим инициатору его действия).
    if (assigneeRecipient.id !== params.actorUserId) {
      await this.pushTicketEvent({
        userId: assigneeRecipient.id,
        type: 'chat',
        ticketId: params.ticketId,
        title,
        body: message,
        chat: true,
        notificationType: 'ticket.comment_added',
        linkedClientCompanyId: assigneeRecipient.linkedClientCompanyId,
      });
    }
  }

  private async emitTicketAttachmentUploadedInternal(params: {
    ticketCompanyId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    actorUserId: string | null;
    assigneeUserId: string | null;
    assigneeCompanyId: string | null;
    sourceEventId?: string | null;
  }) {
    const excludeIds = [params.actorUserId, params.assigneeUserId]
      .filter((value): value is string => !!value && value.length > 0)
      .filter((value, index, arr) => arr.indexOf(value) === index);

    const users = await this.prisma.user.findMany({
      where: {
        companyId: params.ticketCompanyId,
        isActive: true,
        deletedAt: null,
        role: { in: WATCHER_ROLES },
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      select: { id: true, companyId: true, role: true },
    });
    const recipients = await this.filterRecipientsByTicketAccess({
      users,
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
    });

    const title = 'Фото добавлено';
    const message = clipMessage(`${ticketLabel(params.ticketNumber)} — ${params.summary}`);

    await this.createNotifications(
      recipients.map((u) => ({
        companyId: u.companyId,
        userId: u.id,
        type: 'ticket.attachment_uploaded',
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: u.linkedClientCompanyId,
        dedupeKey: this.notificationDedupeKey(
          'ticket.attachment_uploaded.watchers',
          params.sourceEventId || params.ticketId,
          u.companyId,
          u.id,
        ),
      })),
    );

    // Push: добавленное фото = чат-событие (вкладка Чат/Фото). Инициатор уже исключён.
    await Promise.all(
      recipients.map((recipient) =>
        this.pushTicketEvent({
          userId: recipient.id,
          type: 'chat',
          ticketId: params.ticketId,
          title,
          body: message,
          chat: true,
          notificationType: 'ticket.attachment_uploaded',
          linkedClientCompanyId: recipient.linkedClientCompanyId,
        }),
      ),
    );

    if (!params.assigneeUserId || !params.assigneeCompanyId) return;

    const assignee = await this.prisma.user.findFirst({
      where: {
        id: params.assigneeUserId,
        companyId: params.assigneeCompanyId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, companyId: true, role: true },
    });
    if (!assignee) return;
    const [assigneeRecipient] = await this.filterRecipientsByTicketAccess({
      users: [assignee],
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
    });
    if (!assigneeRecipient) return;

    await this.createNotification({
      companyId: assigneeRecipient.companyId,
      userId: assigneeRecipient.id,
      type: 'ticket.attachment_uploaded',
      title,
      message,
      entityType: 'Ticket',
      entityId: params.ticketId,
      linkedClientCompanyId: assigneeRecipient.linkedClientCompanyId,
      dedupeKey: this.notificationDedupeKey(
        'ticket.attachment_uploaded.assignee',
        params.sourceEventId || params.ticketId,
        assigneeRecipient.companyId,
        assigneeRecipient.id,
      ),
    });

    if (assigneeRecipient.id !== params.actorUserId) {
      await this.pushTicketEvent({
        userId: assigneeRecipient.id,
        type: 'chat',
        ticketId: params.ticketId,
        title,
        body: message,
        chat: true,
        notificationType: 'ticket.attachment_uploaded',
        linkedClientCompanyId: assigneeRecipient.linkedClientCompanyId,
      });
    }
  }

  private async emitTicketCreatedPublicInternal(params: {
    ticketCompanyId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    assignedTechnicianId: string | null;
    sourceEventId?: string | null;
  }) {
    await this.notifyDispatchersNewTicket({
      watcherCompanyId: params.ticketCompanyId,
      ticketCompanyId: params.ticketCompanyId,
      ticketId: params.ticketId,
      ticketNumber: params.ticketNumber,
      summary: params.summary,
      excludeUserIds: [],
      sourceEventId: params.sourceEventId,
    });
    if (params.assignedTechnicianId) {
      await this.emitTicketAssignedToAssignee({
        assigneeUserId: params.assignedTechnicianId,
        ticketId: params.ticketId,
        ticketCompanyId: params.ticketCompanyId,
        ticketNumber: params.ticketNumber,
        summary: params.summary,
        actorUserId: null,
        mode: 'auto',
        sourceEventId: params.sourceEventId,
      });
    }
  }

  private async emitTicketCreatedAndMaybeAssign(params: {
    actorCompanyId: string;
    creatorUserId: string | null;
    targetCompanyId: string;
    locationId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    assignedTechnicianId: string | null;
    sourceEventId?: string | null;
  }) {
    await this.emitTicketCreatedWatchers(params);

    await this.emitTicketCreatedConfirmationForCreator(params);

    if (params.assignedTechnicianId) {
      await this.emitTicketAssignedToAssignee({
        assigneeUserId: params.assignedTechnicianId,
        ticketId: params.ticketId,
        ticketCompanyId: params.targetCompanyId,
        ticketNumber: params.ticketNumber,
        summary: params.summary,
        actorUserId: null,
        mode: 'auto',
        sourceEventId: params.sourceEventId,
      });
    }
  }

  private async emitTicketCreatedWatchers(params: {
    actorCompanyId: string;
    creatorUserId: string | null;
    targetCompanyId: string;
    locationId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    sourceEventId?: string | null;
  }) {
    const scopes = await this.resolveTicketCreatedNotificationScopes({
      actorCompanyId: params.actorCompanyId,
      targetCompanyId: params.targetCompanyId,
    });
    if (!scopes.length) return;

    const creator = params.creatorUserId
      ? await this.prisma.user.findFirst({
          where: { id: params.creatorUserId, isActive: true },
          select: { id: true, companyId: true },
        })
      : null;

    const recipientMap = new Map<
      string,
      {
        companyId: string;
        userId: string;
        linkedClientCompanyId: string | null;
      }
    >();

    for (const scope of scopes) {
      let users = await this.prisma.user.findMany({
        where: {
          companyId: scope.companyId,
          isActive: true,
          deletedAt: null,
          role: { in: scope.roles },
          ...(creator?.companyId === scope.companyId ? { id: { not: creator.id } } : {}),
        },
        select: { id: true, companyId: true, role: true },
      });

      const accessibleUsers = await this.filterRecipientsByTicketAccess({
        users,
        ticketCompanyId: params.targetCompanyId,
        ticketId: params.ticketId,
      });

      for (const user of accessibleUsers) {
        recipientMap.set(`${user.companyId}:${user.id}`, {
          companyId: user.companyId,
          userId: user.id,
          linkedClientCompanyId: user.linkedClientCompanyId,
        });
      }
    }

    const recipients = Array.from(recipientMap.values());
    if (!recipients.length) return;

    const title = 'Новая заявка';
    const message = clipMessage(`${ticketLabel(params.ticketNumber)} — ${params.summary}`);

    await this.createNotifications(
      recipients.map((recipient) => ({
        companyId: recipient.companyId,
        userId: recipient.userId,
        type: 'ticket.created',
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: recipient.linkedClientCompanyId,
        dedupeKey: this.notificationDedupeKey(
          'ticket.created.watchers',
          params.sourceEventId || params.ticketId,
          recipient.companyId,
          recipient.userId,
        ),
      })),
    );

    // Push «новая заявка» наблюдателям (создатель уже исключён из recipients).
    await Promise.all(
      recipients.map((recipient) =>
        this.pushTicketEvent({
          userId: recipient.userId,
          type: 'ticketNew',
          ticketId: params.ticketId,
          title,
          body: message,
          notificationType: 'ticket.created',
          linkedClientCompanyId: recipient.linkedClientCompanyId,
        }),
      ),
    );
  }

  private async resolveTicketCreatedNotificationScopes(params: {
    actorCompanyId: string;
    targetCompanyId: string;
  }) {
    const companies = await this.prisma.company.findMany({
      where: { id: { in: Array.from(new Set([params.actorCompanyId, params.targetCompanyId])) } },
      select: { id: true, type: true },
    });
    const companyTypeById = new Map(companies.map((company) => [company.id, company.type]));
    const targetType = companyTypeById.get(params.targetCompanyId);
    if (!targetType) return [];

    const scopes = new Map<
      string,
      {
        companyId: string;
        roles: UserRole[];
        linkedClientCompanyId: string | null;
      }
    >();
    const addScope = (companyId: string, roles: UserRole[], linkedClientCompanyId: string | null) => {
      scopes.set(companyId, { companyId, roles, linkedClientCompanyId });
    };

    if (targetType === CompanyType.CLIENT) {
      addScope(
        params.targetCompanyId,
        params.actorCompanyId !== params.targetCompanyId
          ? CLIENT_CROSS_COMPANY_CREATED_NOTIFY_ROLES
          : CLIENT_CREATED_NOTIFY_ROLES,
        null,
      );

      if (params.actorCompanyId !== params.targetCompanyId) {
        const contract = await this.prisma.serviceContract.findFirst({
          where: {
            clientCompanyId: params.targetCompanyId,
            providerCompanyId: params.actorCompanyId,
            ...activeServiceContractWhere(),
            role: ServiceContractRole.PRIMARY,
          },
          select: { providerCompanyId: true },
        });
        if (contract) {
          addScope(contract.providerCompanyId, PROVIDER_CREATED_NOTIFY_ROLES, params.targetCompanyId);
        }
      } else {
        const providerContracts = await this.prisma.serviceContract.findMany({
          where: {
            clientCompanyId: params.targetCompanyId,
            ...activeServiceContractWhere(),
            role: ServiceContractRole.PRIMARY,
          },
          select: { providerCompanyId: true },
        });
        for (const contract of providerContracts) {
          addScope(contract.providerCompanyId, PROVIDER_CREATED_NOTIFY_ROLES, params.targetCompanyId);
        }
      }
    } else {
      addScope(params.targetCompanyId, PROVIDER_CREATED_NOTIFY_ROLES, null);
    }

    return Array.from(scopes.values());
  }

  /** Подтверждение автору заявки (полезное уведомление о своём действии). companyId = tenant получателя уведомления. */
  private async emitTicketCreatedConfirmationForCreator(params: {
    actorCompanyId: string;
    creatorUserId: string | null;
    targetCompanyId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    sourceEventId?: string | null;
  }) {
    if (!params.creatorUserId) return;

    const creator = await this.prisma.user.findFirst({
      where: { id: params.creatorUserId, isActive: true, deletedAt: null },
      select: { id: true, companyId: true, role: true },
    });
    if (!creator) return;

    const [recipient] = await this.filterRecipientsByTicketAccess({
      users: [creator],
      ticketId: params.ticketId,
      ticketCompanyId: params.targetCompanyId,
    });
    if (!recipient) return;

    const notifCompanyId =
      recipient.companyId === params.targetCompanyId ? params.targetCompanyId : recipient.companyId;

    const title = 'Заявка создана';
    const message = clipMessage(
      `${ticketLabel(params.ticketNumber)} принята. Следите за статусом в разделе «Мои заявки» и в уведомлениях. ${params.summary}`,
    );

    await this.createNotification({
      companyId: notifCompanyId,
      userId: creator.id,
      type: 'ticket.created',
      title,
      message,
      entityType: 'Ticket',
      entityId: params.ticketId,
      linkedClientCompanyId: recipient.linkedClientCompanyId,
      dedupeKey: this.notificationDedupeKey(
        'ticket.created.creator',
        params.sourceEventId || params.ticketId,
        notifCompanyId,
        creator.id,
      ),
    });
  }

  private async notifyDispatchersNewTicket(params: {
    watcherCompanyId: string;
    ticketCompanyId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    excludeUserIds: string[];
    sourceEventId?: string | null;
  }) {
    const users = await this.prisma.user.findMany({
      where: {
        companyId: params.watcherCompanyId,
        isActive: true,
        deletedAt: null,
        role: { in: WATCHER_ROLES },
        ...(params.excludeUserIds.length
          ? { id: { notIn: params.excludeUserIds } }
          : {}),
      },
      select: { id: true, companyId: true, role: true },
    });
    const recipients = await this.filterRecipientsByTicketAccess({
      users,
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
    });
    if (!recipients.length) return;

    const title = 'Новая заявка';
    const message = clipMessage(`${ticketLabel(params.ticketNumber)} — ${params.summary}`);
    await this.createNotifications(
      recipients.map((u) => ({
        companyId: u.companyId,
        userId: u.id,
        type: 'ticket.created',
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: u.linkedClientCompanyId,
        dedupeKey: this.notificationDedupeKey(
          'ticket.created.public',
          params.sourceEventId || params.ticketId,
          u.companyId,
          u.id,
        ),
      })),
    );

    await this.pushTicketEventToMany({
      userIds: recipients.map((u) => u.id),
      type: 'ticketNew',
      ticketId: params.ticketId,
      title,
      body: message,
      notificationType: 'ticket.created',
    });
  }

  private async emitTicketAssignedClientCompanyInternal(params: {
    ticketCompanyId: string
    assigneeUserId: string
    assigneeEmail: string
    actorUserId: string | null
    ticketId: string
    ticketNumber: number
    summary: string
    sourceEventId?: string | null
  }) {
    const excludeIds = [params.assigneeUserId, params.actorUserId].filter((x): x is string => !!x && x.length > 0)
    const users = await this.prisma.user.findMany({
      where: {
        companyId: params.ticketCompanyId,
        isActive: true,
        deletedAt: null,
        role: { in: CLIENT_COMPANY_ASSIGNEE_NOTIFY_ROLES },
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      select: { id: true, companyId: true, role: true },
    })
    const recipients = await this.filterRecipientsByTicketAccess({
      users,
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
    })
    if (!recipients.length) return

    const tech = (params.assigneeEmail || '').trim() || 'Исполнитель подрядчика'
    const title = 'Назначен исполнитель'
    const message = clipMessage(`${ticketLabel(params.ticketNumber)} — ${tech}. ${params.summary}`)

    await this.createNotifications(
      recipients.map((u) => ({
        companyId: u.companyId,
        userId: u.id,
        type: 'ticket.assigned',
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: u.linkedClientCompanyId,
        dedupeKey: this.notificationDedupeKey(
          'ticket.assigned.client',
          params.sourceEventId || params.ticketId,
          u.companyId,
          u.id,
        ),
      })),
    )

    await this.pushTicketEventToMany({
      userIds: recipients.map((u) => u.id),
      type: 'assignment',
      ticketId: params.ticketId,
      title,
      body: message,
      notificationType: 'ticket.assigned',
    })
  }

  /**
   * Провайдер-сайд АДМИНЫ заявки для этапов assigned/awaiting_acceptance/accepted:
   *  - админы ГЕНПОДРЯДЧИКА = ACTIVE PRIMARY-провайдер компании-заявки (клиента);
   *  - админы компании НАЗНАЧЕНЦА, если она ≠ компании-заявки (СУБПОДРЯДЧИК).
   * Компания-заявка (клиент) сюда НЕ входит — её получатели считаются отдельными
   * ветками (не дублируем). Дедуп по userId, исключение actor/переданных id.
   */
  private async resolveProviderSideAdmins(params: {
    ticketId: string;
    ticketCompanyId: string;
    excludeUserIds: string[];
  }): Promise<NotificationRecipientCandidate[]> {
    const companyIds = new Set<string>();

    const primaries = await this.prisma.serviceContract.findMany({
      where: {
        clientCompanyId: params.ticketCompanyId,
        ...activeServiceContractWhere(),
        role: ServiceContractRole.PRIMARY,
      },
      select: { providerCompanyId: true },
    });
    for (const c of primaries) companyIds.add(c.providerCompanyId);

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: params.ticketId },
      select: { assignedTechnicianId: true },
    });
    if (ticket?.assignedTechnicianId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: ticket.assignedTechnicianId, isActive: true },
        select: { companyId: true },
      });
      if (assignee && assignee.companyId !== params.ticketCompanyId) {
        companyIds.add(assignee.companyId);
      }
    }

    // компанию-заявку (клиента) исключаем — её получателей считают другие ветки
    companyIds.delete(params.ticketCompanyId);
    if (!companyIds.size) return [];

    const exclude = params.excludeUserIds.filter(Boolean);
    return this.prisma.user.findMany({
      where: {
        companyId: { in: Array.from(companyIds) },
        isActive: true,
        deletedAt: null,
        role: UserRole.ADMIN,
        ...(exclude.length ? { id: { notIn: exclude } } : {}),
      },
      select: { id: true, companyId: true, role: true },
    });
  }

  /** In-app + push провайдер-сайд админам (генподрядчик + субподрядчик). Не дублирует клиента/назначенца. */
  private async notifyProviderSideAdmins(params: {
    ticketId: string;
    ticketCompanyId: string;
    actorUserId: string | null;
    assigneeUserId?: string | null;
    type: PushEventType;
    notificationType: string;
    title: string;
    message: string;
    dedupeKind: string;
    sourceEventId?: string | null;
  }) {
    const recipients = await this.resolveProviderSideAdmins({
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
      excludeUserIds: [params.actorUserId, params.assigneeUserId].filter(
        (x): x is string => !!x && x.length > 0,
      ),
    });
    const accessibleRecipients = await this.filterRecipientsByTicketAccess({
      users: recipients,
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
    });
    if (!accessibleRecipients.length) return;

    await this.createNotifications(
      accessibleRecipients.map((r) => ({
        companyId: r.companyId,
        userId: r.id,
        type: params.notificationType,
        title: params.title,
        message: params.message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: r.linkedClientCompanyId,
        dedupeKey: this.notificationDedupeKey(
          params.dedupeKind,
          params.sourceEventId || params.ticketId,
          r.companyId,
          r.id,
        ),
      })),
    );

    await Promise.all(
      accessibleRecipients.map((recipient) =>
        this.pushTicketEvent({
          userId: recipient.id,
          type: params.type,
          ticketId: params.ticketId,
          title: params.title,
          body: params.message,
          notificationType: params.notificationType,
          linkedClientCompanyId: recipient.linkedClientCompanyId,
        }),
      ),
    );
  }

  private async emitTicketAssignedToAssignee(params: {
    assigneeUserId: string;
    ticketId: string;
    ticketCompanyId: string;
    ticketNumber: number;
    summary: string;
    actorUserId: string | null;
    mode: 'manual' | 'auto' | 'reassign' | 'claim';
    sourceEventId?: string | null;
  }) {
    if (params.actorUserId && params.actorUserId === params.assigneeUserId) {
      if (params.mode === 'manual' || params.mode === 'reassign') return;
    }
    const assignee = await this.prisma.user.findFirst({
      where: { id: params.assigneeUserId, isActive: true, deletedAt: null },
      select: { id: true, companyId: true, role: true },
    });
    if (!assignee) return;
    const [recipient] = await this.filterRecipientsByTicketAccess({
      users: [assignee],
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
    });

    const title =
      params.mode === 'claim'
        ? 'Заявка закреплена за вами'
        : params.mode === 'reassign'
          ? 'Заявка переназначена'
          : 'Вам назначена заявка';
    const message = clipMessage(`${ticketLabel(params.ticketNumber)} — ${params.summary}`);

    if (recipient) {
      await this.createNotification({
        companyId: recipient.companyId,
        userId: recipient.id,
        type: 'ticket.assigned',
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: recipient.linkedClientCompanyId,
        dedupeKey: this.notificationDedupeKey(
          'ticket.assigned.assignee',
          params.sourceEventId || params.ticketId,
          recipient.companyId,
          recipient.id,
          params.mode,
        ),
      });
    }

    // Push исполнителю — но не когда он сам себя назначил/забрал (claim/self-assign).
    if (recipient && params.actorUserId !== recipient.id) {
      await this.pushTicketEvent({
        userId: recipient.id,
        type: 'assignment',
        ticketId: params.ticketId,
        title,
        body: message,
        notificationType: 'ticket.assigned',
        linkedClientCompanyId: recipient.linkedClientCompanyId,
      });
    }

    // Провайдер-сайд админы: генподрядчик (PRIMARY) + субподрядчик (компания назначенца,
    // если ≠ компании-заявки). Исключаем инициатора и самого назначенца.
    await this.notifyProviderSideAdmins({
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
      actorUserId: params.actorUserId,
      assigneeUserId: assignee.id,
      type: 'assignment',
      notificationType: 'ticket.assigned',
      title: 'Назначен исполнитель',
      message,
      dedupeKind: 'ticket.assigned.provider_admin',
      sourceEventId: params.sourceEventId,
    });
  }

  private async emitTicketClaimedDispatchersInternal(params: {
    watcherCompanyId: string;
    ticketCompanyId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    excludeUserId: string;
    linkedHint?: string | null;
    sourceEventId?: string | null;
  }) {
    const users = await this.prisma.user.findMany({
      where: {
        companyId: params.watcherCompanyId,
        isActive: true,
        deletedAt: null,
        role: { in: WATCHER_ROLES },
        id: { not: params.excludeUserId },
      },
      select: { id: true, companyId: true, role: true },
    });
    const recipients = await this.filterRecipientsByTicketAccess({
      users,
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
    });
    if (!recipients.length) return;

    const title = 'Заявку забрал исполнитель';
    const message = clipMessage(`${ticketLabel(params.ticketNumber)} — ${params.summary}`);
    await this.createNotifications(
      recipients.map((u) => ({
        companyId: u.companyId,
        userId: u.id,
        type: 'ticket.claimed',
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: u.linkedClientCompanyId,
        dedupeKey: this.notificationDedupeKey(
          'ticket.claimed',
          params.sourceEventId || params.ticketId,
          u.companyId,
          u.id,
        ),
      })),
    );

    // Взятие заявки исполнителем = событие назначения для диспетчеров (забравший исключён).
    await Promise.all(
      recipients.map((recipient) =>
        this.pushTicketEvent({
          userId: recipient.id,
          type: 'assignment',
          ticketId: params.ticketId,
          title,
          body: message,
          notificationType: 'ticket.claimed',
          linkedClientCompanyId: recipient.linkedClientCompanyId,
        }),
      ),
    );
  }

  private async emitTicketStatusForClientCompanyInternal(params: {
    ticketCompanyId: string;
    actorUserId: string | null;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    fromStatus: TicketStatus;
    toStatus: TicketStatus;
    sourceEventId?: string | null;
  }) {
    if (params.fromStatus === params.toStatus) return;
    if (params.toStatus !== TicketStatus.IN_PROGRESS && params.toStatus !== TicketStatus.DONE) return;

    const company = await this.prisma.company.findUnique({
      where: { id: params.ticketCompanyId },
      select: { type: true },
    });
    if (company?.type !== CompanyType.CLIENT) return;

    const excludeIds: string[] = [];
    if (params.actorUserId) {
      const actor = await this.prisma.user.findFirst({
        where: { id: params.actorUserId },
        select: { companyId: true },
      });
      if (actor?.companyId === params.ticketCompanyId) {
        excludeIds.push(params.actorUserId);
      }
    }

    const users = await this.prisma.user.findMany({
      where: {
        companyId: params.ticketCompanyId,
        isActive: true,
        deletedAt: null,
        role: { in: CLIENT_COMPANY_ASSIGNEE_NOTIFY_ROLES },
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      select: { id: true, companyId: true, role: true },
    });
    const recipients = await this.filterRecipientsByTicketAccess({
      users,
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
    });
    if (!recipients.length) return;

    const title = 'Статус изменён';
    let notificationType: 'ticket.in_progress' | 'ticket.done' = 'ticket.in_progress';
    let body = '';
    if (params.toStatus === TicketStatus.IN_PROGRESS) {
      body = `${ticketLabel(params.ticketNumber)} — техник приступил к работам.`;
      notificationType = 'ticket.in_progress';
    } else if (params.toStatus === TicketStatus.DONE) {
      body = `${ticketLabel(params.ticketNumber)} — работы завершены. Проверьте результат и отчёт в карточке заявки.`;
      notificationType = 'ticket.done';
    }
    const message = clipMessage(`${body} ${params.summary}`.trim());

    await this.createNotifications(
      recipients.map((u) => ({
        companyId: u.companyId,
        userId: u.id,
        type: notificationType,
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: u.linkedClientCompanyId,
        dedupeKey: this.notificationDedupeKey(
          notificationType,
          params.sourceEventId || params.ticketId,
          u.companyId,
          u.id,
        ),
      })),
    );

    await this.pushTicketEventToMany({
      userIds: recipients.map((u) => u.id),
      type: 'statusChange',
      ticketId: params.ticketId,
      title,
      body: message,
      notificationType,
    });
  }

  private async emitTicketStatusChangedForAssignee(params: {
    assigneeUserId: string;
    actorUserId: string | null;
    ticketId: string;
    ticketCompanyId: string;
    ticketNumber: number;
    summary: string;
    fromStatus: TicketStatus;
    toStatus: TicketStatus;
    linkedClientCompanyId: string | null;
    sourceEventId?: string | null;
  }) {
    if (params.actorUserId && params.actorUserId === params.assigneeUserId) {
      return;
    }
    const assignee = await this.prisma.user.findFirst({
      where: { id: params.assigneeUserId, isActive: true, deletedAt: null },
      select: { id: true, companyId: true, role: true },
    });
    if (!assignee) return;

    const [recipient] = await this.filterRecipientsByTicketAccess({
      users: [assignee],
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
    });
    if (!recipient) return;

    const title = 'Статус изменён';
    const message = clipMessage(
      `${ticketLabel(params.ticketNumber)} — ${STATUS_RU[params.fromStatus]} → ${STATUS_RU[params.toStatus]}. ${params.summary}`,
    );

    await this.createNotification({
      companyId: recipient.companyId,
      userId: recipient.id,
      type: 'ticket.status_changed',
      title,
      message,
      entityType: 'Ticket',
      entityId: params.ticketId,
      linkedClientCompanyId: recipient.linkedClientCompanyId,
      dedupeKey: this.notificationDedupeKey(
        'ticket.status_changed.assignee',
        params.sourceEventId || params.ticketId,
        recipient.companyId,
        recipient.id,
        params.fromStatus,
        params.toStatus,
      ),
    });

    // actor===assignee уже отсечён early-return выше.
    await this.pushTicketEvent({
      userId: recipient.id,
      type: 'statusChange',
      ticketId: params.ticketId,
      title,
      body: message,
      notificationType: 'ticket.status_changed',
      linkedClientCompanyId: recipient.linkedClientCompanyId,
    });
  }

  private async emitTicketAwaitingAcceptanceInternal(params: {
    ticketCompanyId: string;
    actorUserId: string | null;
    ticketId: string;
    ticketNumber: number;
    sourceEventId?: string | null;
  }) {
    const excludeIds = params.actorUserId ? [params.actorUserId] : [];
    const users = await this.prisma.user.findMany({
      where: {
        companyId: params.ticketCompanyId,
        isActive: true,
        deletedAt: null,
        role: { in: ACCEPTANCE_NOTIFY_ROLES },
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      select: { id: true, companyId: true, role: true },
    });
    const recipients = await this.filterRecipientsByTicketAccess({
      users,
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
    });
    if (!recipients.length) return;

    const title = 'Работа выполнена, ожидает приёмки';
    const message = clipMessage(`${ticketLabel(params.ticketNumber)} — проверьте и подтвердите выполненную работу.`);

    await this.createNotifications(
      recipients.map((u) => ({
        companyId: u.companyId,
        userId: u.id,
        type: 'ticket.awaiting_acceptance',
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: u.linkedClientCompanyId,
        dedupeKey: this.notificationDedupeKey(
          'ticket.awaiting_acceptance',
          params.sourceEventId || params.ticketId,
          u.companyId,
          u.id,
        ),
      })),
    );

    await this.pushTicketEventToMany({
      userIds: recipients.map((u) => u.id),
      type: 'acceptance',
      ticketId: params.ticketId,
      title,
      body: message,
      notificationType: 'ticket.awaiting_acceptance',
    });

    // Провайдер-сайд админы (генподрядчик + субподрядчик) — «на приёмке» (дыра a/b).
    await this.notifyProviderSideAdmins({
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
      actorUserId: params.actorUserId,
      type: 'acceptance',
      notificationType: 'ticket.awaiting_acceptance',
      title,
      message,
      dedupeKind: 'ticket.awaiting_acceptance.provider_admin',
      sourceEventId: params.sourceEventId,
    });
  }

  private async emitTicketAcceptedInternal(params: {
    ticketCompanyId: string;
    assignedTechnicianId: string;
    actorUserId: string | null;
    ticketId: string;
    ticketNumber: number;
    sourceEventId?: string | null;
  }) {
    if (params.actorUserId === params.assignedTechnicianId) return;

    const assignee = await this.prisma.user.findFirst({
      where: { id: params.assignedTechnicianId, isActive: true, deletedAt: null },
      select: { id: true, companyId: true, role: true },
    });
    if (!assignee) return;

    const [recipient] = await this.filterRecipientsByTicketAccess({
      users: [assignee],
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
    });
    if (recipient) {
      await this.createNotification({
        companyId: recipient.companyId,
        userId: recipient.id,
        type: 'ticket.accepted',
        title: 'Работа принята',
        message: clipMessage(`${ticketLabel(params.ticketNumber)} — клиент подтвердил выполнение.`),
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: recipient.linkedClientCompanyId,
        dedupeKey: this.notificationDedupeKey(
          'ticket.accepted',
          params.sourceEventId || params.ticketId,
          recipient.companyId,
          recipient.id,
        ),
      });

      // actor===assignee уже отсечён early-return выше.
      await this.pushTicketEvent({
        userId: recipient.id,
        type: 'acceptance',
        ticketId: params.ticketId,
        title: 'Работа принята',
        body: `${ticketLabel(params.ticketNumber)} — клиент подтвердил выполнение.`,
        notificationType: 'ticket.accepted',
        linkedClientCompanyId: recipient.linkedClientCompanyId,
      });
    }

    // Провайдер-сайд админы (генподрядчик + субподрядчик) — «принято». Исключаем инициатора и техника.
    await this.notifyProviderSideAdmins({
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
      actorUserId: params.actorUserId,
      assigneeUserId: assignee.id,
      type: 'acceptance',
      notificationType: 'ticket.accepted',
      title: 'Работа принята',
      message: clipMessage(`${ticketLabel(params.ticketNumber)} — клиент подтвердил выполнение.`),
      dedupeKind: 'ticket.accepted.provider_admin',
      sourceEventId: params.sourceEventId,
    });
  }

  private async emitTicketRejectedInternal(params: {
    ticketCompanyId: string;
    assignedTechnicianId: string;
    actorUserId: string | null;
    ticketId: string;
    ticketNumber: number;
    comment: string | null;
    sourceEventId?: string | null;
  }) {
    if (params.actorUserId === params.assignedTechnicianId) return;

    const assignee = await this.prisma.user.findFirst({
      where: { id: params.assignedTechnicianId, isActive: true, deletedAt: null },
      select: { id: true, companyId: true, role: true },
    });
    if (!assignee) return;

    const [recipient] = await this.filterRecipientsByTicketAccess({
      users: [assignee],
      ticketId: params.ticketId,
      ticketCompanyId: params.ticketCompanyId,
    });
    if (!recipient) return;
    const body = params.comment
      ? `${ticketLabel(params.ticketNumber)} — ${params.comment}`
      : `${ticketLabel(params.ticketNumber)} — работа не принята, проверьте комментарий.`;

    await this.createNotification({
      companyId: recipient.companyId,
      userId: recipient.id,
      type: 'ticket.rejected',
      title: 'Работа не принята',
      message: clipMessage(body),
      entityType: 'Ticket',
      entityId: params.ticketId,
      linkedClientCompanyId: recipient.linkedClientCompanyId,
      dedupeKey: this.notificationDedupeKey(
        'ticket.rejected',
        params.sourceEventId || params.ticketId,
        recipient.companyId,
        recipient.id,
      ),
    });

    // Отклонение приёмки → доработка. actor===assignee уже отсечён early-return выше.
    await this.pushTicketEvent({
      userId: recipient.id,
      type: 'acceptanceReject',
      ticketId: params.ticketId,
      title: 'Работа не принята',
      body,
      notificationType: 'ticket.rejected',
      linkedClientCompanyId: recipient.linkedClientCompanyId,
    });
  }
}
