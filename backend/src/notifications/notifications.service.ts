import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CompanyType, ServiceContractRole, ServiceContractStatus, TicketStatus, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

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

const STATUS_RU: Record<TicketStatus, string> = {
  NEW: 'Новая',
  ASSIGNED: 'Назначена',
  IN_PROGRESS: 'В работе',
  DONE: 'Выполнена',
  CANCELED: 'Отменена',
};

function ticketLabel(ticketNumber: number) {
  return `Заявка #${ticketNumber}`;
}

function clipMessage(text: string, max = 400) {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

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

  scheduleTicketCreated(params: {
    actorCompanyId: string;
    creatorUserId: string | null;
    targetCompanyId: string;
    locationId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    assignedTechnicianId: string | null;
  }) {
    void this.safeNotify('ticket.created+assign', () => this.emitTicketCreatedAndMaybeAssign(params));
  }

  onTicketCreated(params: {
    actorCompanyId: string;
    creatorUserId: string | null;
    targetCompanyId: string;
    locationId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    assignedTechnicianId: string | null;
  }) {
    this.scheduleTicketCreated(params);
  }

  scheduleTicketCreatedPublic(params: {
    ticketCompanyId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    assignedTechnicianId: string | null;
  }) {
    void this.safeNotify('ticket.created.public', () => this.emitTicketCreatedPublicInternal(params));
  }

  scheduleTicketCreatedChild(params: {
    companyId: string;
    creatorUserId: string | null;
    locationId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    assignedTechnicianId: string | null;
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
      }),
    );
  }

  scheduleTicketAssignedToTechnician(params: {
    assigneeUserId: string;
    ticketId: string;
    ticketCompanyId: string;
    ticketNumber: number;
    summary: string;
    actorUserId: string | null;
    mode: 'manual' | 'auto' | 'reassign' | 'claim';
  }) {
    void this.safeNotify('ticket.assigned', () => this.emitTicketAssignedToAssignee(params));
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
  }) {
    this.scheduleTicketAssignedClientCompany(params);
  }

  scheduleTicketClaimedDispatchers(params: {
    watcherCompanyId: string;
    ticketCompanyId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    excludeUserId: string;
    linkedHint?: string | null;
  }) {
    void this.safeNotify('ticket.claimed', () => this.emitTicketClaimedDispatchersInternal(params));
  }

  /**
   * Техник просит диспетчера назначить его (claim по специализации недоступен).
   * linkedClientCompanyId в строке уведомления = tenant заявки (companyId заявки).
   */
  async notifyTicketAssignmentRequested(params: {
    providerCompanyId: string;
    technicianUserId: string;
    ticketId: string;
    ticketNumber: number | null;
    ticketCompanyId: string;
  }) {
    const tech = await this.prisma.user.findFirst({
      where: { id: params.technicianUserId, companyId: params.providerCompanyId, isActive: true },
      select: { email: true, firstName: true, lastName: true },
    });
    const namePart = [tech?.firstName, tech?.lastName]
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean)
      .join(' ')
      .trim();
    const techLabel = namePart || (tech?.email || '').trim() || 'Техник';
    const numLabel =
      typeof params.ticketNumber === 'number' && !Number.isNaN(params.ticketNumber) && params.ticketNumber > 0
        ? String(params.ticketNumber)
        : params.ticketId.slice(0, 8).toUpperCase();

    const refSuffix = `|ref:${params.technicianUserId}`;
    const inner = `${techLabel} просит назначить его на заявку #${numLabel}`;
    const maxInner = Math.max(0, 400 - refSuffix.length);
    const innerClip = inner.length <= maxInner ? inner : `${inner.slice(0, Math.max(0, maxInner - 1))}…`;
    const messageWithRef = `${innerClip}${refSuffix}`;

    const dup = await this.prisma.notification.findFirst({
      where: {
        type: 'ticket.assignment_requested',
        entityId: params.ticketId,
        companyId: params.providerCompanyId,
        message: { endsWith: refSuffix },
      },
    });
    if (dup) {
      return { ok: true as const, notified: 0 };
    }

    const users = await this.prisma.user.findMany({
      where: {
        companyId: params.providerCompanyId,
        isActive: true,
        role: { in: ASSIGNMENT_REQUEST_RECIPIENT_ROLES },
      },
      select: { id: true, companyId: true },
    });
    if (!users.length) {
      return { ok: true as const, notified: 0 };
    }

    const title = 'Запрос назначения';
    const message = messageWithRef.length <= 400 ? messageWithRef : clipMessage(messageWithRef);
    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        companyId: u.companyId,
        userId: u.id,
        type: 'ticket.assignment_requested',
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: params.ticketCompanyId,
      })),
    });
    return { ok: true as const, notified: users.length };
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
  }) {
    void this.safeNotify('ticket.status_changed', () => this.emitTicketStatusChangedForAssignee(params));
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
  }) {
    this.scheduleTicketStatusForClientCompany({
      ...params,
      toStatus: TicketStatus.DONE,
    });
  }

  private async emitTicketCreatedPublicInternal(params: {
    ticketCompanyId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    assignedTechnicianId: string | null;
  }) {
    await this.notifyDispatchersNewTicket({
      watcherCompanyId: params.ticketCompanyId,
      ticketCompanyId: params.ticketCompanyId,
      ticketId: params.ticketId,
      ticketNumber: params.ticketNumber,
      summary: params.summary,
      excludeUserIds: [],
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
          role: { in: scope.roles },
          ...(creator?.companyId === scope.companyId ? { id: { not: creator.id } } : {}),
        },
        select: { id: true, companyId: true, role: true },
      });

      users = await this.filterTicketCreatedUsersByLocationScope({
        users,
        ticketCompanyId: params.targetCompanyId,
        locationId: params.locationId,
      });

      for (const user of users) {
        recipientMap.set(`${user.companyId}:${user.id}`, {
          companyId: user.companyId,
          userId: user.id,
          linkedClientCompanyId: scope.linkedClientCompanyId,
        });
      }
    }

    const recipients = Array.from(recipientMap.values());
    if (!recipients.length) return;

    const existing = await this.prisma.notification.findMany({
      where: {
        type: 'ticket.created',
        entityType: 'Ticket',
        entityId: params.ticketId,
        OR: recipients.map((recipient) => ({
          companyId: recipient.companyId,
          userId: recipient.userId,
        })),
      },
      select: { companyId: true, userId: true },
    });
    const existingKeys = new Set(existing.map((row) => `${row.companyId}:${row.userId}`));
    const freshRecipients = recipients.filter((recipient) => !existingKeys.has(`${recipient.companyId}:${recipient.userId}`));
    if (!freshRecipients.length) return;

    const title = 'Новая заявка';
    const message = clipMessage(`${ticketLabel(params.ticketNumber)} — ${params.summary}`);

    await this.prisma.notification.createMany({
      data: freshRecipients.map((recipient) => ({
        companyId: recipient.companyId,
        userId: recipient.userId,
        type: 'ticket.created',
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: recipient.linkedClientCompanyId,
      })),
    });
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
            status: ServiceContractStatus.ACTIVE,
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
            status: ServiceContractStatus.ACTIVE,
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

  private async filterTicketCreatedUsersByLocationScope(params: {
    users: { id: string; companyId: string; role: UserRole }[];
    ticketCompanyId: string;
    locationId: string;
  }) {
    const scopedUsers = params.users.filter(
      (user) =>
        user.role === UserRole.NETWORK_DIRECTOR ||
        user.role === UserRole.TERRITORIAL_MANAGER ||
        user.role === UserRole.CLIENT,
    );
    if (!scopedUsers.length) {
      return params.users;
    }

    const bindings = await this.prisma.userLocationBinding.findMany({
      where: {
        companyId: params.ticketCompanyId,
        userId: { in: scopedUsers.map((user) => user.id) },
        location: { clientCompanyId: params.ticketCompanyId },
      },
      select: { userId: true, locationId: true },
    });
    const locationIdsByUser = new Map<string, Set<string>>();
    for (const binding of bindings) {
      if (!locationIdsByUser.has(binding.userId)) {
        locationIdsByUser.set(binding.userId, new Set<string>());
      }
      locationIdsByUser.get(binding.userId)!.add(binding.locationId);
    }

    return params.users.filter((user) => {
      const boundLocationIds = locationIdsByUser.get(user.id);
      if (user.role === UserRole.CLIENT) {
        return !!boundLocationIds && boundLocationIds.has(params.locationId);
      }
      if (user.role !== UserRole.NETWORK_DIRECTOR && user.role !== UserRole.TERRITORIAL_MANAGER) {
        return true;
      }
      if (!boundLocationIds || boundLocationIds.size === 0) {
        return true;
      }
      return boundLocationIds.has(params.locationId);
    });
  }

  /** Подтверждение автору заявки (полезное уведомление о своём действии). companyId = tenant получателя уведомления. */
  private async emitTicketCreatedConfirmationForCreator(params: {
    actorCompanyId: string;
    creatorUserId: string | null;
    targetCompanyId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
  }) {
    if (!params.creatorUserId) return;

    const creator = await this.prisma.user.findFirst({
      where: { id: params.creatorUserId, isActive: true },
      select: { id: true, companyId: true },
    });
    if (!creator) return;

    const notifCompanyId =
      creator.companyId === params.targetCompanyId ? params.targetCompanyId : creator.companyId;
    const linked =
      notifCompanyId === params.targetCompanyId ? null : params.targetCompanyId;

    const title = 'Заявка создана';
    const message = clipMessage(
      `${ticketLabel(params.ticketNumber)} принята. Следите за статусом в разделе «Мои заявки» и в уведомлениях. ${params.summary}`,
    );

    await this.prisma.notification.create({
      data: {
        companyId: notifCompanyId,
        userId: creator.id,
        type: 'ticket.created',
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: linked,
      },
    });
  }

  private async notifyDispatchersNewTicket(params: {
    watcherCompanyId: string;
    ticketCompanyId: string;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    excludeUserIds: string[];
  }) {
    const linked =
      params.watcherCompanyId !== params.ticketCompanyId ? params.ticketCompanyId : null;
    const users = await this.prisma.user.findMany({
      where: {
        companyId: params.watcherCompanyId,
        isActive: true,
        role: { in: WATCHER_ROLES },
        ...(params.excludeUserIds.length
          ? { id: { notIn: params.excludeUserIds } }
          : {}),
      },
      select: { id: true, companyId: true },
    });
    if (!users.length) return;

    const title = 'Новая заявка';
    const message = clipMessage(`${ticketLabel(params.ticketNumber)} — ${params.summary}`);
    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        companyId: u.companyId,
        userId: u.id,
        type: 'ticket.created',
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: linked,
      })),
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
  }) {
    const excludeIds = [params.assigneeUserId, params.actorUserId].filter((x): x is string => !!x && x.length > 0)
    const users = await this.prisma.user.findMany({
      where: {
        companyId: params.ticketCompanyId,
        isActive: true,
        role: { in: CLIENT_COMPANY_ASSIGNEE_NOTIFY_ROLES },
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      select: { id: true, companyId: true },
    })
    if (!users.length) return

    const tech = (params.assigneeEmail || '').trim() || 'Исполнитель подрядчика'
    const title = 'Назначен исполнитель'
    const message = clipMessage(`${ticketLabel(params.ticketNumber)} — ${tech}. ${params.summary}`)

    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        companyId: u.companyId,
        userId: u.id,
        type: 'ticket.assigned',
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: null,
      })),
    })
  }

  private async emitTicketAssignedToAssignee(params: {
    assigneeUserId: string;
    ticketId: string;
    ticketCompanyId: string;
    ticketNumber: number;
    summary: string;
    actorUserId: string | null;
    mode: 'manual' | 'auto' | 'reassign' | 'claim';
  }) {
    if (params.actorUserId && params.actorUserId === params.assigneeUserId) {
      if (params.mode === 'manual' || params.mode === 'reassign') return;
    }
    const assignee = await this.prisma.user.findFirst({
      where: { id: params.assigneeUserId, isActive: true },
      select: { id: true, companyId: true },
    });
    if (!assignee) return;

    const linked =
      assignee.companyId !== params.ticketCompanyId ? params.ticketCompanyId : null;
    const title =
      params.mode === 'claim'
        ? 'Заявка закреплена за вами'
        : params.mode === 'reassign'
          ? 'Заявка переназначена'
          : 'Вам назначена заявка';
    const message = clipMessage(`${ticketLabel(params.ticketNumber)} — ${params.summary}`);

    await this.prisma.notification.create({
      data: {
        companyId: assignee.companyId,
        userId: assignee.id,
        type: 'ticket.assigned',
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: linked,
      },
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
  }) {
    const linkedResolved =
      params.linkedHint ??
      (params.watcherCompanyId !== params.ticketCompanyId ? params.ticketCompanyId : null);

    const users = await this.prisma.user.findMany({
      where: {
        companyId: params.watcherCompanyId,
        isActive: true,
        role: { in: WATCHER_ROLES },
        id: { not: params.excludeUserId },
      },
      select: { id: true, companyId: true },
    });
    if (!users.length) return;

    const title = 'Заявку забрал исполнитель';
    const message = clipMessage(`${ticketLabel(params.ticketNumber)} — ${params.summary}`);
    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        companyId: u.companyId,
        userId: u.id,
        type: 'ticket.claimed',
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: linkedResolved,
      })),
    });
  }

  private async emitTicketStatusForClientCompanyInternal(params: {
    ticketCompanyId: string;
    actorUserId: string | null;
    ticketId: string;
    ticketNumber: number;
    summary: string;
    fromStatus: TicketStatus;
    toStatus: TicketStatus;
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
        role: { in: CLIENT_COMPANY_ASSIGNEE_NOTIFY_ROLES },
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      select: { id: true, companyId: true },
    });
    if (!users.length) return;

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

    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        companyId: u.companyId,
        userId: u.id,
        type: notificationType,
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: null,
      })),
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
  }) {
    if (params.actorUserId && params.actorUserId === params.assigneeUserId) {
      return;
    }
    const assignee = await this.prisma.user.findFirst({
      where: { id: params.assigneeUserId, isActive: true },
      select: { id: true, companyId: true },
    });
    if (!assignee) return;

    const linked =
      params.linkedClientCompanyId ??
      (assignee.companyId !== params.ticketCompanyId ? params.ticketCompanyId : null);

    const title = 'Статус изменён';
    const message = clipMessage(
      `${ticketLabel(params.ticketNumber)} — ${STATUS_RU[params.fromStatus]} → ${STATUS_RU[params.toStatus]}. ${params.summary}`,
    );

    await this.prisma.notification.create({
      data: {
        companyId: assignee.companyId,
        userId: assignee.id,
        type: 'ticket.status_changed',
        title,
        message,
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: linked,
      },
    });
  }
}
