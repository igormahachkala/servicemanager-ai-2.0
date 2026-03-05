import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TicketStatus, TicketUrgency, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateChildTicketDto } from './dto/create-child-ticket.dto';

import { TicketsPolicy } from '../policy/tickets.policy';
import { assertAllowed } from '../policy/policy.utils';

import { decideTicketTransition } from '../workflow/ticket.workflow';
import { emitDomainEventTx } from '../events/events.bus';

import { AssignmentService } from '../assignment/assignment.service';
import { TicketsQueryService } from './tickets.query.service';

@Injectable()
export class TicketsAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignment: AssignmentService,
    private readonly query: TicketsQueryService,
  ) {}

  private readonly policy = new TicketsPolicy();

  private async getCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, autoAssignEnabled: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  private async getCategory(companyId: string, problemCategoryId: string) {
    const category = await this.prisma.problemCategory.findFirst({
      where: { id: problemCategoryId, companyId, isActive: true },
      include: {
        specializationLinks: { select: { specializationId: true } },
      },
    });
    if (!category) throw new NotFoundException('Problem category not found');
    return category;
  }

  private async findCandidateTechnicians(companyId: string, specializationIds: string[]) {
    if (specializationIds.length === 0) return [];

    const techs = await this.prisma.user.findMany({
      where: {
        companyId,
        role: UserRole.TECHNICIAN,
        technicianSpecializations: {
          some: { specializationId: { in: specializationIds } },
        },
      },
      select: {
        id: true,
        email: true,
        technicianSpecializations: {
          where: { specializationId: { in: specializationIds } },
          include: { specialization: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return techs.map((t) => ({
      id: t.id,
      email: t.email,
      matchedBy: t.technicianSpecializations.map((x) => x.specialization.name),
    }));
  }

  private async writeStatusHistoryTx(
    tx: Prisma.TransactionClient,
    params: {
      ticketId: string;
      fromStatus: TicketStatus | null;
      toStatus: TicketStatus;
      changedByUserId: string | null;
      comment?: string | null;
    },
  ) {
    const { ticketId, fromStatus, toStatus, changedByUserId, comment } = params;

    await tx.ticketStatusHistory.create({
      data: {
        ticketId,
        fromStatus,
        toStatus,
        comment: comment ?? null,
        changedByUserId: changedByUserId ?? null,
      },
    });
  }

  async create(companyId: string, creatorRole: UserRole, dto: CreateTicketDto) {
    const company = await this.getCompany(companyId);
    const category = await this.getCategory(companyId, dto.problemCategoryId);

    const specializationIds = category.specializationLinks.map((x) => x.specializationId);
    const candidates = await this.findCandidateTechnicians(companyId, specializationIds);

    const shouldAutoAssign = company.autoAssignEnabled && candidates.length > 0;

    const ticketId = randomUUID();

    const slaMinutes = dto.slaMinutes ?? null;
    const slaDueAt = slaMinutes ? new Date(Date.now() + slaMinutes * 60_000) : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const decision = shouldAutoAssign
        ? await this.assignment.decide(
            {
              companyId,
              ticketId,
              problemCategoryId: dto.problemCategoryId,
              specializationIds,
            },
            candidates.map((c) => ({ id: c.id, email: c.email })),
            tx,
          )
        : {
            assignedTechnicianId: null,
            strategy: 'first_candidate' as const,
            reason: 'auto_assign_disabled_or_no_candidates',
          };

      const assignedTechnicianId = decision.assignedTechnicianId;
      const status = assignedTechnicianId ? TicketStatus.ASSIGNED : TicketStatus.NEW;

      const ticket = await tx.ticket.create({
        data: {
          id: ticketId,
          companyId,
          parentId: dto.parentId ?? null,

          requesterName: dto.requesterName?.trim() || null,
          requesterPhone: dto.requesterPhone?.trim() || null,
          address: dto.address?.trim() || null,
          pointName: dto.pointName?.trim() || null,

          problemCategoryId: dto.problemCategoryId,
          problemText: dto.problemText?.trim(),

          urgency: dto.urgency ?? TicketUrgency.NOT_URGENT,
          slaMinutes,
          slaDueAt,

          status,
          assignedTechnicianId,
        },
      });

      await this.writeStatusHistoryTx(tx, {
        ticketId: ticket.id,
        fromStatus: null,
        toStatus: ticket.status,
        changedByUserId: null,
        comment: 'Ticket created',
      });

      await emitDomainEventTx(tx, {
        type: 'ticket.created',
        companyId,
        entityType: 'Ticket',
        entityId: ticket.id,
        actorUserId: null,
        payload: {
          parentId: ticket.parentId,
          status: ticket.status,
          urgency: ticket.urgency,
          autoAssigned: !!assignedTechnicianId,
        },
      });

      if (assignedTechnicianId) {
        await emitDomainEventTx(tx, {
          type: 'ticket.assigned',
          companyId,
          entityType: 'Ticket',
          entityId: ticket.id,
          actorUserId: null,
          payload: {
            assignedTechnicianId,
            mode: 'auto',
            strategy: decision.strategy,
            reason: decision.reason,
          },
        });
      }

      return { ticket, assignedTechnicianId };
    });

    return {
      ticket: created.ticket,
      instructions: category.instructions || null,
      candidates,
      autoAssigned: !!created.assignedTechnicianId,
    };
  }

  async createChild(companyId: string, creatorRole: UserRole, parentId: string, dto: CreateChildTicketDto) {
    const parent = await this.prisma.ticket.findFirst({
      where: { id: parentId, companyId },
    });
    if (!parent) throw new NotFoundException('Parent ticket not found');

    const company = await this.getCompany(companyId);
    const category = await this.getCategory(companyId, dto.problemCategoryId);

    const specializationIds = category.specializationLinks.map((x) => x.specializationId);
    const candidates = await this.findCandidateTechnicians(companyId, specializationIds);

    const shouldAutoAssign = company.autoAssignEnabled && candidates.length > 0;

    const ticketId = randomUUID();

    const slaMinutes = dto.slaMinutes ?? null;
    const slaDueAt = slaMinutes ? new Date(Date.now() + slaMinutes * 60_000) : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const decision = shouldAutoAssign
        ? await this.assignment.decide(
            {
              companyId,
              ticketId,
              problemCategoryId: dto.problemCategoryId,
              specializationIds,
            },
            candidates.map((c) => ({ id: c.id, email: c.email })),
            tx,
          )
        : {
            assignedTechnicianId: null,
            strategy: 'first_candidate' as const,
            reason: 'auto_assign_disabled_or_no_candidates',
          };

      const assignedTechnicianId = decision.assignedTechnicianId;
      const status = assignedTechnicianId ? TicketStatus.ASSIGNED : TicketStatus.NEW;

      const ticket = await tx.ticket.create({
        data: {
          id: ticketId,
          companyId,
          parentId: parent.id,

          requesterName: parent.requesterName,
          requesterPhone: parent.requesterPhone,
          address: parent.address,
          pointName: parent.pointName,

          problemCategoryId: dto.problemCategoryId,
          problemText: dto.problemText?.trim(),

          urgency: dto.urgency ?? TicketUrgency.NOT_URGENT,
          slaMinutes,
          slaDueAt,

          status,
          assignedTechnicianId,
        },
      });

      await this.writeStatusHistoryTx(tx, {
        ticketId: ticket.id,
        fromStatus: null,
        toStatus: ticket.status,
        changedByUserId: null,
        comment: 'Child ticket created',
      });

      await emitDomainEventTx(tx, {
        type: 'ticket.created',
        companyId,
        entityType: 'Ticket',
        entityId: ticket.id,
        actorUserId: null,
        payload: {
          parentId: parent.id,
          status: ticket.status,
          urgency: ticket.urgency,
          autoAssigned: !!assignedTechnicianId,
          isChild: true,
        },
      });

      if (assignedTechnicianId) {
        await emitDomainEventTx(tx, {
          type: 'ticket.assigned',
          companyId,
          entityType: 'Ticket',
          entityId: ticket.id,
          actorUserId: null,
          payload: {
            assignedTechnicianId,
            mode: 'auto',
            strategy: decision.strategy,
            reason: decision.reason,
          },
        });
      }

      return { ticket, assignedTechnicianId };
    });

    return {
      ticket: created.ticket,
      instructions: category.instructions || null,
      candidates,
      autoAssigned: !!created.assignedTechnicianId,
      parentId: parent.id,
    };
  }

  async assign(companyId: string, actor: any, ticketId: string, technicianId: string) {
    const decision = this.policy.canAssign({ id: actor?.id, role: actor?.role, companyId });
    assertAllowed(decision);

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({ where: { id: ticketId, companyId } });
      if (!ticket) throw new NotFoundException('Ticket not found');

      const tech = await tx.user.findFirst({
        where: { id: technicianId, companyId, role: UserRole.TECHNICIAN },
        select: { id: true },
      });
      if (!tech) throw new NotFoundException('Technician not found');

      const wf = decideTicketTransition(ticket.status, TicketStatus.ASSIGNED);
      if (!wf.allowed) throw new BadRequestException(wf.reason);

      const now = new Date();

      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: { assignedTechnicianId: technicianId, status: TicketStatus.ASSIGNED, statusUpdatedAt: now },
      });

      await this.writeStatusHistoryTx(tx, {
        ticketId,
        fromStatus: ticket.status,
        toStatus: TicketStatus.ASSIGNED,
        changedByUserId: actor?.id ?? null,
        comment: `Assigned to technician ${technicianId}`,
      });

      await emitDomainEventTx(tx, {
        type: 'ticket.assigned',
        companyId,
        entityType: 'Ticket',
        entityId: ticketId,
        actorUserId: actor?.id ?? null,
        payload: {
          fromStatus: ticket.status,
          toStatus: TicketStatus.ASSIGNED,
          assignedTechnicianId: technicianId,
          mode: 'manual',
        },
      });

      return updated;
    });
  }

  async availableForTechnician(companyId: string, technicianUserId: string) {
    const tech = await this.prisma.user.findFirst({
      where: { id: technicianUserId, companyId, role: UserRole.TECHNICIAN },
      select: { technicianSpecializations: { select: { specializationId: true } } },
    });
    if (!tech) throw new NotFoundException('Technician not found');

    const specializationIds = tech.technicianSpecializations.map((x) => x.specializationId);
    if (specializationIds.length === 0) return [];

    return this.prisma.ticket.findMany({
      where: {
        companyId,
        status: TicketStatus.NEW,
        assignedTechnicianId: null,
        problemCategory: {
          specializationLinks: {
            some: { specializationId: { in: specializationIds } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        problemCategory: { select: { id: true, name: true } },
      },
    });
  }

  async claim(companyId: string, technicianUserId: string, ticketId: string) {
    const tech = await this.prisma.user.findFirst({
      where: { id: technicianUserId, companyId, role: UserRole.TECHNICIAN },
      select: { technicianSpecializations: { select: { specializationId: true } } },
    });
    if (!tech) throw new BadRequestException('Only TECHNICIAN can claim tickets');

    const specializationIds = tech.technicianSpecializations.map((x) => x.specializationId);

    const decision = this.policy.claimWhere({
      user: { id: technicianUserId, role: UserRole.TECHNICIAN, companyId },
      ticketId,
      specializationIds,
    });
    assertAllowed(decision);

    const wf = decideTicketTransition(TicketStatus.NEW, TicketStatus.ASSIGNED);
    if (!wf.allowed) throw new BadRequestException(wf.reason);

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      const updated = await tx.ticket.updateMany({
        where: decision.where,
        data: {
          status: TicketStatus.ASSIGNED,
          statusUpdatedAt: now,
          assignedTechnicianId: technicianUserId,
        },
      });

      if (updated.count === 0) {
        throw new BadRequestException('Ticket is not available for claim or does not match technician specialization');
      }

      await this.writeStatusHistoryTx(tx, {
        ticketId,
        fromStatus: TicketStatus.NEW,
        toStatus: TicketStatus.ASSIGNED,
        changedByUserId: technicianUserId,
        comment: 'Claimed by technician',
      });

      await emitDomainEventTx(tx, {
        type: 'ticket.claimed',
        companyId,
        entityType: 'Ticket',
        entityId: ticketId,
        actorUserId: technicianUserId,
        payload: {
          fromStatus: TicketStatus.NEW,
          toStatus: TicketStatus.ASSIGNED,
          assignedTechnicianId: technicianUserId,
        },
      });
    });

    return this.query.getOne(companyId, technicianUserId, UserRole.TECHNICIAN, ticketId);
  }
}
