import { Injectable, NotFoundException } from '@nestjs/common';
import { TicketStatus, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { TicketsPolicy, type BoardQueryInput } from '../policy/tickets.policy';
import { assertAllowed } from '../policy/policy.utils';

type AccessFlags = {
  canTechnicianViewAllCompanyTickets?: boolean;
};

type TimelineItem = {
  at: Date;
  source: 'status_history' | 'domain_event';
  type: string;
  title: string;
  actor: { id: string; email: string } | null;
  payload: any;
};

@Injectable()
export class TicketsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly policy = new TicketsPolicy();

  async board(companyId: string, userId: string, role: UserRole, input: BoardQueryInput, accessFlags?: AccessFlags) {
    const decision = this.policy.boardWhere({ id: userId, role, companyId, accessFlags }, input);
    assertAllowed(decision);

    const nowMs = Date.now();
    const atRiskThresholdMs = decision.where.meta.atRiskThresholdMinutes * 60_000;

    const tickets = await this.prisma.ticket.findMany({
      where: decision.where.where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        urgency: true,
        createdAt: true,
        slaDueAt: true,
        slaBreachedAt: true,
        problemText: true,
        pointName: true,
        location: {
          select: {
            id: true,
            name: true,
            platformCode: true,
            externalCode: true,
            city: true,
            address: true,
          },
        },
        problemCategory: { select: { id: true, name: true } },
        assignedTechnician: { select: { id: true, email: true } },
        parentId: true,
      },
      take: decision.where.take,
    });

    const allStatuses: TicketStatus[] = [
      TicketStatus.NEW,
      TicketStatus.ASSIGNED,
      TicketStatus.IN_PROGRESS,
      TicketStatus.DONE,
      TicketStatus.CANCELED,
    ];

    const columns = allStatuses.map((st) => {
      const byStatus = tickets.filter((t) => t.status === st);

      let breached = 0;
      let atRisk = 0;

      for (const t of byStatus) {
        const due = t.slaDueAt ? t.slaDueAt.getTime() : null;
        const isBreached = !!t.slaBreachedAt || (due !== null && nowMs > due);
        const isAtRisk = !isBreached && due !== null && nowMs > due - atRiskThresholdMs;

        if (isBreached) breached += 1;
        else if (isAtRisk) atRisk += 1;
      }

      const cards = byStatus.map((t) => ({
        id: t.id,
        title: `${t.problemCategory.name}: ${t.problemText}`,
        status: t.status,
        urgency: t.urgency,
        createdAt: t.createdAt,
        slaDueAt: t.slaDueAt,
        slaBreached: !!t.slaBreachedAt || (t.slaDueAt ? nowMs > t.slaDueAt.getTime() : false),
        isChild: !!t.parentId,
        pointName: t.pointName,
        location: t.location,
        category: t.problemCategory,
        assignedTechnician: t.assignedTechnician,
      }));

      return {
        status: st,
        total: byStatus.length,
        sla: { breached, atRisk },
        cards,
      };
    });

    return {
      columns,
      meta: {
        totalTickets: tickets.length,
        atRiskThresholdMinutes: decision.where.meta.atRiskThresholdMinutes,
        limitedToLast: decision.where.meta.limitedToLast,
      },
    };
  }

  async list(companyId: string, userId: string, role: UserRole, status?: TicketStatus, accessFlags?: AccessFlags) {
    const decision = this.policy.listWhere({ id: userId, role, companyId, accessFlags }, status);
    assertAllowed(decision);

    return this.prisma.ticket.findMany({
      where: decision.where,
      orderBy: { createdAt: 'desc' },
      include: {
        location: {
          select: {
            id: true,
            name: true,
            platformCode: true,
            externalCode: true,
            city: true,
            region: true,
            address: true,
          },
        },
        problemCategory: { select: { id: true, name: true } },
        assignedTechnician: { select: { id: true, email: true } },
      },
    });
  }

  async getOne(companyId: string, userId: string, role: UserRole, ticketId: string, accessFlags?: AccessFlags) {
    const decision = this.policy.getOneWhere({ id: userId, role, companyId, accessFlags }, ticketId);
    assertAllowed(decision);

    const ticket = await this.prisma.ticket.findFirst({
      where: decision.where,
      include: {
        location: {
          select: {
            id: true,
            name: true,
            platformCode: true,
            externalCode: true,
            city: true,
            region: true,
            address: true,
            latitude: true,
            longitude: true,
            isActive: true,
          },
        },
        problemCategory: { select: { id: true, name: true, instructions: true } },
        assignedTechnician: { select: { id: true, email: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        parent: {
          select: {
            id: true,
            problemText: true,
            status: true,
            createdAt: true,
            location: {
              select: {
                id: true,
                name: true,
                platformCode: true,
                city: true,
                address: true,
              },
            },
          },
        },
        children: {
          orderBy: { createdAt: 'asc' },
          include: {
            location: {
              select: {
                id: true,
                name: true,
                platformCode: true,
                city: true,
                address: true,
              },
            },
            problemCategory: { select: { id: true, name: true } },
            assignedTechnician: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async timeline(companyId: string, userId: string, role: UserRole, ticketId: string, accessFlags?: AccessFlags) {
    const decision = this.policy.getOneWhere({ id: userId, role, companyId, accessFlags }, ticketId);
    assertAllowed(decision);

    const statusHistory = await this.prisma.ticketStatusHistory.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        comment: true,
        changedByUserId: true,
        createdAt: true,
      },
    });

    const events = await this.prisma.domainEvent.findMany({
      where: { companyId, entityType: 'Ticket', entityId: ticketId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        type: true,
        actorUserId: true,
        payload: true,
        createdAt: true,
      },
    });

    const actorIds = new Set<string>();
    for (const s of statusHistory) if (s.changedByUserId) actorIds.add(s.changedByUserId);
    for (const e of events) if (e.actorUserId) actorIds.add(e.actorUserId);

    const actorsArr = actorIds.size
      ? await this.prisma.user.findMany({
          where: { id: { in: Array.from(actorIds) }, companyId },
          select: { id: true, email: true },
        })
      : [];

    const actorMap = new Map<string, { id: string; email: string }>(actorsArr.map((u) => [u.id, u]));

    const items: TimelineItem[] = [];

    for (const s of statusHistory) {
      const actor = s.changedByUserId ? actorMap.get(s.changedByUserId) ?? null : null;
      items.push({
        at: s.createdAt,
        source: 'status_history',
        type: `status.${s.toStatus}`,
        title: `Status changed: ${s.toStatus}`,
        actor,
        payload: {
          id: s.id,
          from: s.fromStatus,
          to: s.toStatus,
          comment: s.comment ?? null,
        },
      });
    }

    for (const e of events) {
      const actor = e.actorUserId ? actorMap.get(e.actorUserId) ?? null : null;
      items.push({
        at: e.createdAt,
        source: 'domain_event',
        type: e.type,
        title: this.eventTitle(e.type),
        actor,
        payload: e.payload ?? null,
      });
    }

    items.sort((a, b) => a.at.getTime() - b.at.getTime());

    return {
      ticketId,
      items,
      meta: {
        statusHistoryCount: statusHistory.length,
        domainEventCount: events.length,
      },
    };
  }

  private eventTitle(type: string) {
    if (type === 'ticket.created') return 'Заявка создана';
    if (type === 'ticket.assigned') return 'Заявка назначена';
    if (type === 'ticket.claimed') return 'Заявка взята техником';
    if (type === 'ticket.reassigned') return 'Заявка переназначена';
    if (type === 'ticket.category_changed') return 'Категория изменена';
    if (type === 'ticket.updated') return 'Заявка обновлена';
    if (type === 'ticket.status_changed') return 'Статус изменён';
    if (type === 'ticket.sla_warning') return 'SLA в зоне риска';
    if (type === 'ticket.sla_breached') return 'SLA нарушен';
    if (type === 'sla.breached') return 'SLA нарушен';

    return type;
  }
}
