import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TicketStatus, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const WATCHER_ROLES: UserRole[] = [
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
    ticketId: string;
    ticketNumber: number;
    summary: string;
    assignedTechnicianId: string | null;
  }) {
    void this.safeNotify('ticket.created+assign', () => this.emitTicketCreatedAndMaybeAssign(params));
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

  scheduleTicketAssignedToCreator(params: {
    assigneeUserId: string;
    ticketId: string;
    ticketCompanyId: string;
    ticketNumber: number;
    summary: string;
    actorUserId: string | null;
  }) {
    void this.safeNotify('ticket.assigned.creator', () => this.emitTicketAssignedToCreator(params));
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
    const message = clipMessage(`${techLabel} просит назначить его на заявку #${numLabel}`);
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
    ticketId: string;
    ticketNumber: number;
    summary: string;
    assignedTechnicianId: string | null;
  }) {
    const exclude = params.creatorUserId ? [params.creatorUserId] : [];
    const watcherCompanyId =
      params.actorCompanyId === params.targetCompanyId ? params.targetCompanyId : params.actorCompanyId;

    await this.notifyDispatchersNewTicket({
      watcherCompanyId,
      ticketCompanyId: params.targetCompanyId,
      ticketId: params.ticketId,
      ticketNumber: params.ticketNumber,
      summary: params.summary,
      excludeUserIds: exclude,
    });

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

  private async emitTicketAssignedToCreator(params: {
    assigneeUserId: string;
    ticketId: string;
    ticketCompanyId: string;
    ticketNumber: number;
    summary: string;
    actorUserId: string | null;
  }) {
    const createdEvent = await this.prisma.domainEvent.findFirst({
      where: {
        companyId: params.ticketCompanyId,
        entityType: 'Ticket',
        entityId: params.ticketId,
        type: 'ticket.created',
        actorUserId: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      select: { actorUserId: true },
    });
    const creatorUserId = (createdEvent?.actorUserId || '').trim();
    if (!creatorUserId) return;
    if (creatorUserId === params.assigneeUserId) return;
    if (params.actorUserId && params.actorUserId === creatorUserId) return;

    const creator = await this.prisma.user.findFirst({
      where: {
        id: creatorUserId,
        companyId: params.ticketCompanyId,
        isActive: true,
      },
      select: { id: true, companyId: true },
    });
    if (!creator) return;

    await this.prisma.notification.create({
      data: {
        companyId: creator.companyId,
        userId: creator.id,
        type: 'ticket.assigned',
        title: 'Assigned technician',
        message: clipMessage(`${ticketLabel(params.ticketNumber)} - assigned technician. ${params.summary}`),
        entityType: 'Ticket',
        entityId: params.ticketId,
        linkedClientCompanyId: null,
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

    const title = 'Изменён статус заявки';
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
