import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PublicRequestType, TicketSource, TicketStatus, TicketUrgency, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateChildTicketDto } from './dto/create-child-ticket.dto';

import { TicketsPolicy } from '../policy/tickets.policy';
import { assertAllowed } from '../policy/policy.utils';

import { decideTicketTransition } from '../workflow/ticket.workflow';
import { TimelineService } from '../timeline/timeline.service';

import { AssignmentService } from '../assignment/assignment.service';
import { TicketsQueryService } from './tickets.query.service';
import { TicketAttachmentsService } from './ticket-attachments.service';
import { buildTicketDescription } from './ticket-description.builder';

@Injectable()
export class TicketsAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignment: AssignmentService,
    private readonly query: TicketsQueryService,
    private readonly timelineService: TimelineService,
    private readonly attachments: TicketAttachmentsService,
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

  private async getEquipment(companyId: string, locationId: string, equipmentId: string) {
    const equipment = await this.prisma.equipment.findFirst({
      where: {
        id: equipmentId,
        companyId,
        locationId,
      },
      select: {
        id: true,
        locationId: true,
        name: true,
        type: true,
        status: true,
      },
    });

    if (!equipment) {
      throw new NotFoundException('Equipment not found');
    }

    return equipment;
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

  private normalizeCreateInput(dto: CreateTicketDto) {
    const categoryId = (dto.categoryId ?? dto.problemCategoryId ?? '').trim();
    if (!categoryId) {
      throw new BadRequestException('categoryId is required');
    }

    return {
      parentId: dto.parentId ?? null,
      locationId: dto.locationId,
      equipmentId: dto.equipmentId ?? null,
      categoryId,
      title: dto.title?.trim() || null,
      description: dto.description?.trim() || dto.problemText?.trim() || null,
      attachmentIds: [...new Set((dto.attachmentIds ?? []).filter(Boolean))],
      requesterName: dto.requesterName?.trim() || null,
      requesterPhone: dto.requesterPhone?.trim() || null,
      address: dto.address?.trim() || null,
      pointName: dto.pointName?.trim() || null,
      urgency: dto.urgency,
      slaMinutes: dto.slaMinutes ?? null,
    };
  }
  async create(companyId: string, creatorRole: UserRole, dto: CreateTicketDto) {
    const input = this.normalizeCreateInput(dto);
    const company = await this.getCompany(companyId);
    const category = await this.getCategory(companyId, input.categoryId);
    const location = await this.getLocation(companyId, input.locationId);
    const equipment = input.equipmentId
      ? await this.getEquipment(companyId, location.id, input.equipmentId)
      : null;
    const generated = buildTicketDescription({
      category,
      location,
      title: input.title,
      description: input.description,
    });

    const specializationIds = category.specializationLinks.map((x) => x.specializationId);
    const candidates = await this.findCandidateTechnicians(companyId, specializationIds);

    const shouldAutoAssign = company.autoAssignEnabled && candidates.length > 0;

    const ticketId = randomUUID();

    const slaMinutes = input.slaMinutes;
    const slaDueAt = slaMinutes ? new Date(Date.now() + slaMinutes * 60_000) : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const decision = shouldAutoAssign
        ? await this.assignment.decide(
            {
              companyId,
              ticketId,
              problemCategoryId: input.categoryId,
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
          equipmentId: equipment?.id ?? null,
          parentId: input.parentId,

          requesterName: input.requesterName,
          requesterPhone: input.requesterPhone,
          address: location.address ?? input.address,
          pointName: location.name ?? input.pointName,

          problemCategoryId: input.categoryId,
          problemText: generated.description,

          urgency: input.urgency ?? TicketUrgency.NOT_URGENT,
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

      const boundAttachments = await this.attachments.bindAttachmentsToTicketTx(tx, {
        companyId,
        ticketId: ticket.id,
        attachmentIds: input.attachmentIds ?? [],
      });

      await this.timelineService.recordTx(tx, {
        event: 'TICKET_CREATED',
        companyId,
        ticketId: ticket.id,
        actorUserId: null,
        payload: {
          parentId: ticket.parentId,
          locationId: location.id,
          categoryId: input.categoryId,
          equipmentId: equipment?.id ?? null,
          title: generated.title,
          description: generated.description,
          status: TicketStatus.NEW,
          urgency: ticket.urgency,
          autoAssigned: !!assignedTechnicianId,
          attachmentCount: boundAttachments.length,
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

        await this.timelineService.recordTx(tx, {
          event: 'TICKET_ASSIGNED',
          companyId,
          ticketId: ticket.id,
          actorUserId: null,
          payload: {
            assignedTechnicianId,
            mode: 'auto',
            strategy: decision.strategy,
            reason: decision.reason,
          },
        });
      }

      return { ticket, assignedTechnicianId, generated };
    });

    return {
      ticket: { ...created.ticket, title: created.generated.title, description: created.generated.description },
      generated: created.generated,
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

      await this.timelineService.recordTx(tx, {
        event: 'TICKET_CREATED',
        companyId,
        ticketId: ticket.id,
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

        await this.timelineService.recordTx(tx, {
          event: 'TICKET_ASSIGNED',
          companyId,
          ticketId: ticket.id,
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

    const resolvedTicketId = await this.prisma.$transaction(async (tx) => {
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
        await this.timelineService.recordTx(tx, {
          event: 'TICKET_ASSIGNED',
          companyId,
          ticketId: ticket.id,
          actorUserId: actor?.id ?? null,
          payload: {
            previousAssignedTechnicianId: previousAssigneeId,
            assignedTechnicianId: technicianId,
            mode: 'reassign',
          },
        });
      } else if (isFirstAssign || ticket.status === TicketStatus.NEW) {
        await this.timelineService.recordTx(tx, {
          event: 'TICKET_ASSIGNED',
          companyId,
          ticketId: ticket.id,
          actorUserId: actor?.id ?? null,
          payload: {
            assignedTechnicianId: technicianId,
            mode: 'manual',
          },
        });
      }

      return ticket.id;
    });

    return this.query.getOne(companyId, actor?.id, actor?.role as UserRole, resolvedTicketId);
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

      await this.timelineService.recordLegacyTx(tx, {
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

      await this.timelineService.recordLegacyTx(tx, {
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

    const resolvedTicketId = await this.prisma.$transaction(async (tx) => {
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

      await this.timelineService.recordTx(tx, {
        event: 'TICKET_CLAIMED',
        companyId,
        ticketId: ticket.id,
        actorUserId: technicianUserId,
        payload: {
          assignedTechnicianId: technicianUserId,
          mode: 'claim',
        },
      });

      return ticket.id;
    });

    return this.query.getOne(companyId, technicianUserId, UserRole.TECHNICIAN, resolvedTicketId);
  }
  async createPublic(
    companyId: string,
    input: {
      locationId: string;
      equipmentId?: string | null;
      categoryId: string;
      publicRequestType: PublicRequestType;
      description: string;
      requesterName?: string | null;
      requesterPhone?: string | null;
      attachmentIds?: string[];
      urgency?: TicketUrgency;
      channel?: string | null;
      presetLocationId?: string | null;
      publicLinkVersion?: string | null;
      ipHash?: string | null;
      phoneNormalized?: string | null;
    },
  ) {
    const company = await this.getCompany(companyId);
    const category = await this.getCategory(companyId, input.categoryId);
    const location = await this.getLocation(companyId, input.locationId);
    const equipment = input.equipmentId
      ? await this.getEquipment(companyId, location.id, input.equipmentId)
      : null;

    const specializationIds = category.specializationLinks.map((x) => x.specializationId);
    const candidates = await this.findCandidateTechnicians(companyId, specializationIds);
    const shouldAutoAssign = company.autoAssignEnabled && candidates.length > 0;
    const ticketId = randomUUID();

    const created = await this.prisma.$transaction(async (tx) => {
      const decision = shouldAutoAssign
        ? await this.assignment.decide(
            {
              companyId,
              ticketId,
              problemCategoryId: input.categoryId,
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
          equipmentId: equipment?.id ?? null,
          requesterName: input.requesterName ?? null,
          requesterPhone: input.requesterPhone ?? null,
          address: location.address ?? null,
          pointName: location.name,
          problemCategoryId: input.categoryId,
          problemText: input.description.trim(),
          urgency: input.urgency ?? TicketUrgency.NOT_URGENT,
          status: TicketStatus.NEW,
          assignedTechnicianId: null,
          source: TicketSource.PUBLIC_QUICK_REQUEST,
          publicRequestType: input.publicRequestType,
        },
      });

      await this.writeStatusHistoryTx(tx, {
        ticketId: ticket.id,
        fromStatus: null,
        toStatus: TicketStatus.NEW,
        changedByUserId: null,
        comment: 'Public quick request created',
      });

      const boundAttachments = await this.attachments.bindAttachmentsToTicketTx(tx, {
        companyId,
        ticketId: ticket.id,
        attachmentIds: input.attachmentIds ?? [],
      });

      await this.timelineService.recordTx(tx, {
        event: 'TICKET_CREATED',
        companyId,
        ticketId: ticket.id,
        actorUserId: null,
        payload: {
          source: TicketSource.PUBLIC_QUICK_REQUEST,
          publicRequestType: input.publicRequestType,
          locationId: location.id,
          equipmentId: equipment?.id ?? null,
          requesterPhone: input.requesterPhone ?? null,
          requesterName: input.requesterName ?? null,
          phoneNormalized: input.phoneNormalized ?? null,
          status: TicketStatus.NEW,
          urgency: ticket.urgency,
          autoAssigned: !!assignedTechnicianId,
          attachmentCount: boundAttachments.length,
          intake: 'public_quick_request',
          channel: input.channel ?? 'direct_link',
          presetLocation: !!input.presetLocationId,
          publicLinkVersion: input.publicLinkVersion ?? 'v2',
          ipHash: input.ipHash ?? null,
        },
      });

      if (assignedTechnicianId) {
        const wf = decideTicketTransition(TicketStatus.NEW, TicketStatus.ASSIGNED);
        if (!wf.allowed) throw new BadRequestException(wf.reason);

        ticket = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            status: TicketStatus.ASSIGNED,
            statusUpdatedAt: new Date(),
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

        await this.timelineService.recordTx(tx, {
          event: 'TICKET_ASSIGNED',
          companyId,
          ticketId: ticket.id,
          actorUserId: null,
          payload: {
            assignedTechnicianId,
            mode: 'auto',
            strategy: decision.strategy,
            reason: decision.reason,
            source: TicketSource.PUBLIC_QUICK_REQUEST,
          },
        });
      }

      return { ticket, assignedTechnicianId };
    });

    return {
      ticket: created.ticket,
      autoAssigned: !!created.assignedTechnicianId,
    };
  }
}
