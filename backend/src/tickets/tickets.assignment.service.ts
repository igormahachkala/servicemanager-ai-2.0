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
      select: {
        id: true,
        autoAssignEnabled: true,
        allowTechnicianClaim: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  private async getCategory(companyId: string, problemCategoryId: string) {
    const category = await this.prisma.problemCategory.findFirst({
      where: { id: problemCategoryId, companyId, isActive: true },
      include: {
        specializationLinks: {
          select: {
            specializationId: true,
            specialization: true,
          },
        },
      },
    });
    if (!category) throw new NotFoundException('Problem category not found');
    return category;
  }

  private async getLocation(companyId: string, locationId: string) {
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        clientCompanyId: companyId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        region: true,
        platformCode: true,
        externalCode: true,
      },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location;
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
        assignedTickets: {
          where: {
            status: {
              in: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
            },
          },
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return techs.map((t) => {
      const assignedCount = t.assignedTickets.filter((x) => x.status === TicketStatus.ASSIGNED).length;
      const inProgressCount = t.assignedTickets.filter((x) => x.status === TicketStatus.IN_PROGRESS).length;
      const matchedSpecializationsCount = t.technicianSpecializations.length;

      return {
        id: t.id,
        email: t.email,
        matchedBy: t.technicianSpecializations.map((x) => x.specialization.name),
        matchedSpecializationsCount,
        assignedCount,
        inProgressCount,
        activeLoad: assignedCount + inProgressCount,
      };
    });
  }

  private async listAllTechnicians(companyId: string, specializationIds: string[]) {
    const techs = await this.prisma.user.findMany({
      where: {
        companyId,
        role: UserRole.TECHNICIAN,
      },
      select: {
        id: true,
        email: true,
        technicianSpecializations: {
          include: { specialization: true },
        },
        assignedTickets: {
          where: {
            status: {
              in: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS],
            },
          },
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return techs.map((t) => {
      const matchedSpecs = t.technicianSpecializations
        .filter((x) => specializationIds.includes(x.specializationId))
        .map((x) => x.specialization.name);

      const assignedCount = t.assignedTickets.filter((x) => x.status === TicketStatus.ASSIGNED).length;
      const inProgressCount = t.assignedTickets.filter((x) => x.status === TicketStatus.IN_PROGRESS).length;

      return {
        id: t.id,
        email: t.email,
        matched: matchedSpecs.length > 0,
        matchedBy: matchedSpecs,
        assignedCount,
        inProgressCount,
        activeLoad: assignedCount + inProgressCount,
        specializations: t.technicianSpecializations.map((x) => ({
          id: x.specialization.id,
          name: x.specialization.name,
          isActive: x.specialization.isActive,
        })),
      };
    });
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
    const location = await this.getLocation(companyId, dto.locationId);

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
            candidates.map((c) => ({
              id: c.id,
              email: c.email,
              matchedSpecializationsCount: c.matchedSpecializationsCount,
              assignedCount: c.assignedCount,
              inProgressCount: c.inProgressCount,
              activeLoad: c.activeLoad,
            })),
            tx,
          )
        : {
            assignedTechnicianId: null,
            strategy: 'first_candidate' as const,
            reason: 'auto_assign_disabled_or_no_candidates',
          };

      const assignedTechnicianId = decision.assignedTechnicianId;

      let ticket = await tx.ticket.create({
        data: {
          id: ticketId,
          companyId,
          locationId: location.id,
          parentId: dto.parentId ?? null,

          requesterName: dto.requesterName?.trim() || null,
          requesterPhone: dto.requesterPhone?.trim() || null,
          address: location.address ?? (dto.address?.trim() || null),
          pointName: location.name ?? (dto.pointName?.trim() || null),

          problemCategoryId: dto.problemCategoryId,
          problemText: dto.problemText?.trim(),

          urgency: dto.urgency ?? TicketUrgency.NOT_URGENT,
          slaMinutes,
          slaDueAt,

          status: TicketStatus.NEW,
          assignedTechnicianId: null,
        },
      });

      await this.writeStatusHistoryTx(tx, {
        ticketId: ticket.id,
        fromStatus: null,
        toStatus: TicketStatus.NEW,
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
          locationId: location.id,
          status: TicketStatus.NEW,
          urgency: ticket.urgency,
          autoAssigned: !!assignedTechnicianId,
        },
      });

      if (assignedTechnicianId) {
        const wf = decideTicketTransition(TicketStatus.NEW, TicketStatus.ASSIGNED);
        if (!wf.allowed) throw new BadRequestException(wf.reason);

        const now = new Date();

        ticket = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: TicketStatus.ASSIGNED,
            statusUpdatedAt: now,
            assignedTechnicianId,
          },
        });

        await this.writeStatusHistoryTx(tx, {
          ticketId: ticket.id,
          fromStatus: TicketStatus.NEW,
          toStatus: TicketStatus.ASSIGNED,
          changedByUserId: null,
          comment: 'Auto assigned',
        });

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
      select: {
        id: true,
        locationId: true,
        requesterName: true,
        requesterPhone: true,
        address: true,
        pointName: true,
      },
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
            candidates.map((c) => ({
              id: c.id,
              email: c.email,
              matchedSpecializationsCount: c.matchedSpecializationsCount,
              assignedCount: c.assignedCount,
              inProgressCount: c.inProgressCount,
              activeLoad: c.activeLoad,
            })),
            tx,
          )
        : {
            assignedTechnicianId: null,
            strategy: 'first_candidate' as const,
            reason: 'auto_assign_disabled_or_no_candidates',
          };

      const assignedTechnicianId = decision.assignedTechnicianId;

      let ticket = await tx.ticket.create({
        data: {
          id: ticketId,
          companyId,
          locationId: parent.locationId,
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

          status: TicketStatus.NEW,
          assignedTechnicianId: null,
        },
      });

      await this.writeStatusHistoryTx(tx, {
        ticketId: ticket.id,
        fromStatus: null,
        toStatus: TicketStatus.NEW,
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
          locationId: parent.locationId,
          status: TicketStatus.NEW,
          urgency: ticket.urgency,
          autoAssigned: !!assignedTechnicianId,
          isChild: true,
        },
      });

      if (assignedTechnicianId) {
        const wf = decideTicketTransition(TicketStatus.NEW, TicketStatus.ASSIGNED);
        if (!wf.allowed) throw new BadRequestException(wf.reason);

        const now = new Date();

        ticket = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: TicketStatus.ASSIGNED,
            statusUpdatedAt: now,
            assignedTechnicianId,
          },
        });

        await this.writeStatusHistoryTx(tx, {
          ticketId: ticket.id,
          fromStatus: TicketStatus.NEW,
          toStatus: TicketStatus.ASSIGNED,
          changedByUserId: null,
          comment: 'Auto assigned',
        });

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

  async listAssignmentCandidates(companyId: string, actor: any, ticketId: string) {
    const decision = this.policy.canAssign({ id: actor?.id, role: actor?.role, companyId });
    assertAllowed(decision);

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, companyId },
      include: {
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
        problemCategory: {
          include: {
            specializationLinks: {
              include: {
                specialization: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const requiredSpecializations = ticket.problemCategory.specializationLinks.map((x) => ({
      id: x.specialization.id,
      name: x.specialization.name,
      isActive: x.specialization.isActive,
    }));

    const specializationIds = requiredSpecializations.map((x) => x.id);
    const allTechnicians = await this.listAllTechnicians(companyId, specializationIds);

    const matched = allTechnicians.filter((t) => t.matched);
    const others = allTechnicians.filter((t) => !t.matched);

    return {
      ticketId: ticket.id,
      category: {
        id: ticket.problemCategory.id,
        name: ticket.problemCategory.name,
      },
      location: ticket.location,
      currentAssigneeId: ticket.assignedTechnicianId,
      requiredSpecializations,
      matched,
      others,
    };
  }

  async assign(companyId: string, actor: any, ticketId: string, technicianId: string) {
    const decision = this.policy.canAssign({ id: actor?.id, role: actor?.role, companyId });
    assertAllowed(decision);

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, companyId },
        include: {
          problemCategory: {
            include: {
              specializationLinks: {
                select: { specializationId: true },
              },
            },
          },
        },
      });

      if (!ticket) throw new NotFoundException('Ticket not found');

      if (ticket.status === TicketStatus.DONE || ticket.status === TicketStatus.CANCELED) {
        throw new BadRequestException(`Ticket cannot be assigned in status ${ticket.status}`);
      }

      const tech = await tx.user.findFirst({
        where: {
          id: technicianId,
          companyId,
          role: UserRole.TECHNICIAN,
        },
        include: {
          technicianSpecializations: {
            include: { specialization: true },
          },
        },
      });

      if (!tech) {
        throw new NotFoundException('Technician not found');
      }

      const previousAssigneeId = ticket.assignedTechnicianId;
      const isReassign = !!previousAssigneeId && previousAssigneeId !== technicianId;
      const isFirstAssign = !previousAssigneeId;
      const now = new Date();

      if (ticket.status === TicketStatus.NEW) {
        const wf = decideTicketTransition(TicketStatus.NEW, TicketStatus.ASSIGNED);
        if (!wf.allowed) throw new BadRequestException(wf.reason);

        await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            assignedTechnicianId: technicianId,
            status: TicketStatus.ASSIGNED,
            statusUpdatedAt: now,
          },
        });

        await this.writeStatusHistoryTx(tx, {
          ticketId: ticket.id,
          fromStatus: TicketStatus.NEW,
          toStatus: TicketStatus.ASSIGNED,
          changedByUserId: actor?.id ?? null,
          comment: 'Manual assigned',
        });
      } else {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            assignedTechnicianId: technicianId,
          },
        });
      }

      if (isReassign) {
        await emitDomainEventTx(tx, {
          type: 'ticket.reassigned',
          companyId,
          entityType: 'Ticket',
          entityId: ticket.id,
          actorUserId: actor?.id ?? null,
          payload: {
            previousAssignedTechnicianId: previousAssigneeId,
            assignedTechnicianId: technicianId,
          },
        });
      } else if (isFirstAssign || ticket.status === TicketStatus.NEW) {
        await emitDomainEventTx(tx, {
          type: 'ticket.assigned',
          companyId,
          entityType: 'Ticket',
          entityId: ticket.id,
          actorUserId: actor?.id ?? null,
          payload: {
            assignedTechnicianId: technicianId,
            mode: 'manual',
          },
        });
      }

      return this.query.getOne(companyId, actor?.id, actor?.role as UserRole, ticket.id);
    });
  }

  async updateCategory(companyId: string, actor: any, ticketId: string, problemCategoryId: string) {
    const decision = this.policy.canAssign({ id: actor?.id, role: actor?.role, companyId });
    assertAllowed(decision);

    const normalizedCategoryId = (problemCategoryId ?? '').trim();
    if (!normalizedCategoryId) {
      throw new BadRequestException('problemCategoryId cannot be empty');
    }

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, companyId },
      select: {
        id: true,
        status: true,
        problemCategoryId: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.status === TicketStatus.DONE || ticket.status === TicketStatus.CANCELED) {
      throw new BadRequestException(`Ticket cannot be edited in status ${ticket.status}`);
    }

    const category = await this.prisma.problemCategory.findFirst({
      where: {
        id: normalizedCategoryId,
        companyId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Problem category not found');
    }

    if (ticket.problemCategoryId === normalizedCategoryId) {
      return this.query.getOne(companyId, actor?.id, actor?.role as UserRole, ticket.id);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          problemCategoryId: normalizedCategoryId,
        },
      });

      await emitDomainEventTx(tx, {
        type: 'ticket.category_changed',
        companyId,
        entityType: 'Ticket',
        entityId: ticket.id,
        actorUserId: actor?.id ?? null,
        payload: {
          previousProblemCategoryId: ticket.problemCategoryId,
          problemCategoryId: normalizedCategoryId,
        },
      });

      await emitDomainEventTx(tx, {
        type: 'ticket.updated',
        companyId,
        entityType: 'Ticket',
        entityId: ticket.id,
        actorUserId: actor?.id ?? null,
        payload: {
          changedFields: ['problemCategoryId'],
        },
      });
    });

    return this.query.getOne(companyId, actor?.id, actor?.role as UserRole, ticket.id);
  }

  async availableForTechnician(companyId: string, technicianUserId: string) {
    const company = await this.getCompany(companyId);

    if (!company.allowTechnicianClaim) {
      return [];
    }

    const tech = await this.prisma.user.findFirst({
      where: {
        id: technicianUserId,
        companyId,
        role: UserRole.TECHNICIAN,
      },
      select: {
        id: true,
        technicianSpecializations: {
          select: { specializationId: true },
        },
      },
    });

    if (!tech) {
      throw new NotFoundException('Technician not found');
    }

    const specializationIds = tech.technicianSpecializations.map((x) => x.specializationId);
    if (specializationIds.length === 0) {
      return [];
    }

    return this.prisma.ticket.findMany({
      where: {
        companyId,
        status: TicketStatus.NEW,
        assignedTechnicianId: null,
        problemCategory: {
          specializationLinks: {
            some: {
              specializationId: { in: specializationIds },
            },
          },
        },
      },
      include: {
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
        problemCategory: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async claim(companyId: string, technicianUserId: string, ticketId: string) {
    const company = await this.getCompany(companyId);

    const tech = await this.prisma.user.findFirst({
      where: {
        id: technicianUserId,
        companyId,
        role: UserRole.TECHNICIAN,
      },
      select: {
        id: true,
        role: true,
        companyId: true,
        technicianSpecializations: {
          select: { specializationId: true },
        },
      },
    });

    if (!tech) {
      throw new NotFoundException('Technician not found');
    }

    const specializationIds = tech.technicianSpecializations.map((x) => x.specializationId);

    const decision = this.policy.claimWhere({
      user: {
        id: tech.id,
        role: tech.role,
        companyId: tech.companyId,
      },
      ticketId,
      specializationIds,
      allowTechnicianClaim: company.allowTechnicianClaim,
    });
    assertAllowed(decision);

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: {
          id: ticketId,
          companyId,
          status: TicketStatus.NEW,
          assignedTechnicianId: null,
          problemCategory: {
            specializationLinks: {
              some: { specializationId: { in: specializationIds } },
            },
          },
        },
      });

      if (!ticket) {
        throw new NotFoundException('Ticket not found or not available for claim');
      }

      const wf = decideTicketTransition(TicketStatus.NEW, TicketStatus.ASSIGNED);
      if (!wf.allowed) throw new BadRequestException(wf.reason);

      const now = new Date();

      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          assignedTechnicianId: technicianUserId,
          status: TicketStatus.ASSIGNED,
          statusUpdatedAt: now,
        },
      });

      await this.writeStatusHistoryTx(tx, {
        ticketId: ticket.id,
        fromStatus: TicketStatus.NEW,
        toStatus: TicketStatus.ASSIGNED,
        changedByUserId: technicianUserId,
        comment: 'Claimed by technician',
      });

      await emitDomainEventTx(tx, {
        type: 'ticket.assigned',
        companyId,
        entityType: 'Ticket',
        entityId: ticket.id,
        actorUserId: technicianUserId,
        payload: {
          assignedTechnicianId: technicianUserId,
          mode: 'claim',
        },
      });

      return this.query.getOne(companyId, technicianUserId, UserRole.TECHNICIAN, ticket.id);
    });
  }
}
