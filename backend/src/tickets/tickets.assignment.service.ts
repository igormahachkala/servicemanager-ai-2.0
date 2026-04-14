import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PublicRequestType, TicketSource, TicketStatus, TicketUrgency, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateChildTicketDto } from './dto/create-child-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

import { TicketsPolicy } from '../policy/tickets.policy';
import { assertAllowed } from '../policy/policy.utils';

import { decideTicketTransition } from '../workflow/ticket.workflow';
import { TimelineService } from '../timeline/timeline.service';

import { AssignmentService } from '../assignment/assignment.service';
import { TicketsQueryService } from './tickets.query.service';
import { TicketAttachmentsService } from './ticket-attachments.service';
import { buildTicketDescription } from './ticket-description.builder';
import { resolveTechnicianOperationalScope, resolveTicketOperationAccess } from './ticket-access.utils';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';
import { TechniciansService } from '../technicians/technicians.service';

@Injectable()
export class TicketsAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assignment: AssignmentService,
    private readonly query: TicketsQueryService,
    private readonly timelineService: TimelineService,
    private readonly attachments: TicketAttachmentsService,
    private readonly serviceContractsService: ServiceContractsService,
    private readonly techniciansService: TechniciansService,
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

  private async assertExecutorOperationsAllowed(actorCompanyId: string) {
    const actorCompany = await this.prisma.company.findUnique({
      where: { id: actorCompanyId },
      select: { id: true, type: true },
    });
    if (!actorCompany) {
      throw new NotFoundException('Company not found');
    }
    if (actorCompany.type === 'CLIENT') {
      throw new ForbiddenException('Client company cannot perform executor operations');
    }
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
        companyId: companyId,
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
        companyId: companyId,
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
        matchReason: 'category_specialization' as const,
        matchedSpecializationsCount,
        assignedCount,
        inProgressCount,
        activeLoad: assignedCount + inProgressCount,
      };
    });
  }

  private async listAllTechnicians(
    companyId: string,
    specializationIds: string[],
    options?: { fallbackToAllWhenNoSpecializations?: boolean },
  ) {
    const fallbackToAllWhenNoSpecializations = !!options?.fallbackToAllWhenNoSpecializations && specializationIds.length === 0;

    const techs = await this.prisma.user.findMany({
      where: {
        companyId: companyId,
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
        matched: fallbackToAllWhenNoSpecializations || matchedSpecs.length > 0,
        matchedBy: matchedSpecs,
        matchReason: fallbackToAllWhenNoSpecializations
          ? ('fallback_no_category_specializations' as const)
          : matchedSpecs.length > 0
            ? ('category_specialization' as const)
            : ('no_match' as const),
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
      clientCompanyId: dto.clientCompanyId?.trim() || null,
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
  async create(actorCompanyId: string, creatorUserId: string, creatorRole: UserRole, dto: CreateTicketDto) {
    const input = this.normalizeCreateInput(dto);
    let targetCompanyId = actorCompanyId;
    if (input.clientCompanyId && input.clientCompanyId !== actorCompanyId) {
      if (creatorRole === UserRole.TECHNICIAN) {
        targetCompanyId = (
          await this.techniciansService.resolveBoundCreateScope(
            actorCompanyId,
            creatorUserId,
            input.clientCompanyId,
            input.locationId,
          )
        ).companyId;
      } else if (creatorRole === UserRole.ADMIN || creatorRole === UserRole.MASTER || creatorRole === UserRole.DISPATCHER) {
        await this.serviceContractsService.assertPrimaryLinkedClientAccess(actorCompanyId, input.clientCompanyId);
        targetCompanyId = input.clientCompanyId;
      } else {
        throw new ForbiddenException('Role cannot create ticket in linked-client scope');
      }
    }
    const assignmentCompanyId =
      creatorRole === UserRole.TECHNICIAN && targetCompanyId !== actorCompanyId ? actorCompanyId : targetCompanyId;
    const company = await this.getCompany(targetCompanyId);
    const category = await this.getCategory(targetCompanyId, input.categoryId);
    const location = await this.getLocation(targetCompanyId, input.locationId);
    const equipment = input.equipmentId
      ? await this.getEquipment(targetCompanyId, location.id, input.equipmentId)
      : null;
    const generated = buildTicketDescription({
      category,
      location,
      title: input.title,
      description: input.description,
    });

    const specializationIds = category.specializationLinks.map((x) => x.specializationId);
    const candidates = await this.findCandidateTechnicians(assignmentCompanyId, specializationIds);
    const shouldAutoAssign = company.autoAssignEnabled && candidates.length > 0;

    const ticketId = randomUUID();

    const slaMinutes = input.slaMinutes;
    const slaDueAt = slaMinutes ? new Date(Date.now() + slaMinutes * 60_000) : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const decision = shouldAutoAssign
        ? await this.assignment.decide(
            {
              companyId: assignmentCompanyId,
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
          companyId: targetCompanyId,
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
        companyId: targetCompanyId,
        ticketId: ticket.id,
        attachmentIds: input.attachmentIds ?? [],
      });

      await this.timelineService.recordTx(tx, {
        event: 'TICKET_CREATED',
        companyId: targetCompanyId,
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
          companyId: targetCompanyId,
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
              companyId: companyId,
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
          companyId: companyId,
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
        companyId: companyId,
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
          companyId: companyId,
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

  async listAssignmentCandidates(companyId: string, actor: any, ticketId: string, linkedClientCompanyId?: string) {
    await this.assertExecutorOperationsAllowed(companyId);
    const access = await resolveTicketOperationAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: {
        id: actor?.id,
        role: actor?.role,
        companyId: companyId,
        accessFlags: actor?.accessFlags,
      },
      ticketId
    });

    const decision = this.policy.canAssign({ id: actor?.id, role: actor?.role, companyId: access.operationCompanyId });
    assertAllowed(decision);

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, companyId: access.ticket.companyId },
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
    const fallbackMode = specializationIds.length === 0;
    const allTechnicians = await this.listAllTechnicians(access.operationCompanyId, specializationIds, {
      fallbackToAllWhenNoSpecializations: true,
    });

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
      meta: {
        matchingMode: fallbackMode ? 'fallback_no_category_specializations' : 'category_specializations',
        explanation: fallbackMode
          ? '? ????????? ??? ??????????? ?????????????. ??????? ???????? ??? ??????? ???????? ??? ?????????? fallback.'
          : matched.length > 0
            ? '??????? ???????? ???????, ??????? ???????? ?? ?????????????? ?????????. ???? ? ????????? ??????? ????????.'
            : '? ????????? ???? ?????????? ?? ??????????????, ?? ?????? ??? ?????????? ????????. ???? ???????? ????????? ??????? ????????.',
        scopeCompanyId: access.ticket.companyId,
        visibilityMode: access.visibilityMode,
        workforceCompanyId: access.operationCompanyId,
      },
    };
  }

  async assign(companyId: string, actor: any, ticketId: string, technicianId: string, linkedClientCompanyId?: string) {
    await this.assertExecutorOperationsAllowed(companyId);
    const access = await resolveTicketOperationAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: {
        id: actor?.id,
        role: actor?.role,
        companyId: companyId,
        accessFlags: actor?.accessFlags,
      },
      ticketId
    });

    const decision = this.policy.canAssign({ id: actor?.id, role: actor?.role, companyId: access.operationCompanyId });
    assertAllowed(decision);

    const resolvedTicketId = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, companyId: access.ticket.companyId },
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
          companyId: access.operationCompanyId,
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
          companyId: ticket.companyId,
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
          companyId: ticket.companyId,
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

    return this.query.getOne(
      companyId,
      actor?.id,
      actor?.role as UserRole,
      resolvedTicketId,
      actor?.accessFlags,
      undefined,
      linkedClientCompanyId,
    );
  }


  async update(companyId: string, actor: any, ticketId: string, dto: UpdateTicketDto, linkedClientCompanyId?: string) {
    const actorRole = actor?.role as UserRole;
    const isClientActor = actorRole === UserRole.CLIENT;
    const access = await resolveTicketOperationAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: {
        id: actor?.id,
        role: actor?.role,
        companyId: companyId,
        accessFlags: actor?.accessFlags,
      },
      ticketId,
      linkedClientCompanyId,
    });

    if (!isClientActor) {
      const decision = this.policy.canAssign({ id: actor?.id, role: actorRole, companyId: access.operationCompanyId });
      assertAllowed(decision);
    } else {
      if (linkedClientCompanyId) {
        throw new ForbiddenException('Client cannot edit ticket in linked-client scope');
      }
      if (access.ticket.companyId !== companyId) {
        throw new ForbiddenException('Client can edit only own company tickets');
      }
    }

    const normalizedCategoryId = dto.problemCategoryId?.trim();
    const normalizedLocationId = dto.locationId?.trim();
    const normalizedEquipmentId =
      dto.equipmentId === undefined
        ? undefined
        : dto.equipmentId === null
          ? null
          : dto.equipmentId.trim();
    const normalizedProblemText = typeof dto.problemText === 'string' ? dto.problemText.trim() : undefined;

    if (dto.problemText !== undefined && !normalizedProblemText) {
      throw new BadRequestException('problemText cannot be empty');
    }

    if (dto.problemCategoryId !== undefined && !normalizedCategoryId) {
      throw new BadRequestException('problemCategoryId cannot be empty');
    }

    if (dto.locationId !== undefined && !normalizedLocationId) {
      throw new BadRequestException('locationId cannot be empty');
    }
    if (dto.equipmentId !== undefined && normalizedEquipmentId === '') {
      throw new BadRequestException('equipmentId cannot be empty');
    }

    const updatedTicketId = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, companyId: access.ticket.companyId },
        select: {
          id: true,
          companyId: true,
          locationId: true,
          equipmentId: true,
          problemCategoryId: true,
          problemText: true,
          urgency: true,
          requesterName: true,
          requesterPhone: true,
          address: true,
          pointName: true,
          status: true,
        },
      });

      if (!ticket) {
        throw new NotFoundException('Ticket not found');
      }

      if (ticket.status === TicketStatus.DONE || ticket.status === TicketStatus.CANCELED) {
        throw new BadRequestException(`Ticket cannot be edited in status ${ticket.status}`);
      }

      if (isClientActor && ticket.status !== TicketStatus.NEW) {
        throw new ForbiddenException('Client can edit ticket fields only while ticket is NEW');
      }

      if (normalizedCategoryId) {
        const category = await tx.problemCategory.findFirst({
          where: {
            id: normalizedCategoryId,
            companyId: access.ticket.companyId,
            isActive: true,
          },
          select: { id: true },
        });

        if (!category) {
          throw new NotFoundException('Problem category not found');
        }
      }

      if (normalizedLocationId) {
        const location = await tx.location.findFirst({
          where: {
            id: normalizedLocationId,
            clientCompanyId: access.ticket.companyId,
            isActive: true,
          },
          select: { id: true },
        });

        if (!location) {
          throw new NotFoundException('Location not found');
        }
      }

      const effectiveLocationId = normalizedLocationId || ticket.locationId;
      if (normalizedEquipmentId && normalizedEquipmentId !== ticket.equipmentId) {
        const equipment = await tx.equipment.findFirst({
          where: {
            id: normalizedEquipmentId,
            companyId: access.ticket.companyId,
            locationId: effectiveLocationId,
          },
          select: { id: true },
        });
        if (!equipment) {
          throw new NotFoundException('Equipment not found');
        }
      }

      const data: Prisma.TicketUpdateInput = {};
      const changedFields: string[] = [];

      if (normalizedCategoryId && normalizedCategoryId !== ticket.problemCategoryId) {
        data.problemCategory = { connect: { id: normalizedCategoryId } };
        changedFields.push('problemCategoryId');
      }

      if (normalizedLocationId && normalizedLocationId !== ticket.locationId) {
        data.location = { connect: { id: normalizedLocationId } };
        changedFields.push('locationId');
      }
      if (normalizedEquipmentId === null && ticket.equipmentId !== null) {
        data.equipment = { disconnect: true };
        changedFields.push('equipmentId');
      } else if (normalizedEquipmentId && normalizedEquipmentId !== ticket.equipmentId) {
        data.equipment = { connect: { id: normalizedEquipmentId } };
        changedFields.push('equipmentId');
      }

      if (normalizedProblemText !== undefined && normalizedProblemText !== ticket.problemText) {
        data.problemText = normalizedProblemText;
        changedFields.push('problemText');
      }

      if (dto.urgency !== undefined && dto.urgency !== ticket.urgency) {
        data.urgency = dto.urgency;
        changedFields.push('urgency');
      }

      const normalizeNullable = (value?: string | null) => {
        if (value === undefined) return undefined;
        if (value === null) return null;
        return value.trim() || null;
      };

      const requesterName = normalizeNullable(dto.requesterName);
      if (requesterName !== undefined && requesterName !== ticket.requesterName) {
        data.requesterName = requesterName;
        changedFields.push('requesterName');
      }

      const requesterPhone = normalizeNullable(dto.requesterPhone);
      if (requesterPhone !== undefined && requesterPhone !== ticket.requesterPhone) {
        data.requesterPhone = requesterPhone;
        changedFields.push('requesterPhone');
      }

      const address = normalizeNullable(dto.address);
      if (address !== undefined && address !== ticket.address) {
        data.address = address;
        changedFields.push('address');
      }

      const pointName = normalizeNullable(dto.pointName);
      if (pointName !== undefined && pointName !== ticket.pointName) {
        data.pointName = pointName;
        changedFields.push('pointName');
      }

      if (changedFields.length === 0) {
        return ticket.id;
      }

      await tx.ticket.update({
        where: { id: ticket.id },
        data,
      });

      if (changedFields.includes('problemCategoryId')) {
        await this.timelineService.recordLegacyTx(tx, {
          type: 'ticket.category_changed',
          companyId: ticket.companyId,
          entityType: 'Ticket',
          entityId: ticket.id,
          actorUserId: actor?.id ?? null,
          payload: {
            previousProblemCategoryId: ticket.problemCategoryId,
            problemCategoryId: normalizedCategoryId,
          },
        });
      }

      await this.timelineService.recordLegacyTx(tx, {
        type: 'ticket.updated',
        companyId: ticket.companyId,
        entityType: 'Ticket',
        entityId: ticket.id,
        actorUserId: actor?.id ?? null,
        payload: {
          changedFields,
          operationCompanyId: access.operationCompanyId,
        },
      });

      return ticket.id;
    });

    return this.query.getOne(
      companyId,
      actor?.id,
      actor?.role as UserRole,
      updatedTicketId,
      actor?.accessFlags,
      undefined,
      linkedClientCompanyId,
    );
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
        companyId: companyId,
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
        companyId: companyId,
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
        companyId: companyId,
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
    const technicianScope = await resolveTechnicianOperationalScope({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: {
        id: technicianUserId,
        role: UserRole.TECHNICIAN,
        companyId: companyId,
      },
    })

    if (!technicianScope.allowTechnicianClaim) {
      return []
    }

    return this.prisma.ticket.findMany({
      where: {
        companyId:
          technicianScope.companyIds.length === 1
            ? technicianScope.companyIds[0]
            : { in: technicianScope.companyIds },
        status: TicketStatus.NEW,
        assignedTechnicianId: null,
        OR: [
          ...(technicianScope.specializationIds.length > 0
            ? [{
                problemCategory: {
                  specializationLinks: {
                    some: {
                      specializationId: { in: technicianScope.specializationIds },
                    },
                  },
                },
              }]
            : []),
          {
            problemCategory: {
              specializationLinks: {
                none: {},
              },
            },
          },
        ],
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
    })
  }

  async claim(companyId: string, technicianUserId: string, ticketId: string, linkedClientCompanyId?: string) {
    await this.assertExecutorOperationsAllowed(companyId);
    const technicianScope = await resolveTechnicianOperationalScope({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: {
        id: technicianUserId,
        role: UserRole.TECHNICIAN,
        companyId: companyId,
      },
      linkedClientCompanyId,
    })
    const decision = this.policy.claimWhere({
      user: {
        id: technicianUserId,
        role: UserRole.TECHNICIAN,
        companyId: companyId,
      },
      ticketId,
      specializationIds: technicianScope.specializationIds,
      allowTechnicianClaim: technicianScope.allowTechnicianClaim,
      companyIds: technicianScope.companyIds,
    })
    assertAllowed(decision)

    const resolvedTicketId = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: decision.where,
      })

      if (!ticket) {
        throw new NotFoundException('Ticket not found or not available for claim')
      }

      const wf = decideTicketTransition(TicketStatus.NEW, TicketStatus.ASSIGNED)
      if (!wf.allowed) throw new BadRequestException(wf.reason)

      const now = new Date()

      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          assignedTechnicianId: technicianUserId,
          status: TicketStatus.ASSIGNED,
          statusUpdatedAt: now,
        },
      })

      await this.writeStatusHistoryTx(tx, {
        ticketId: ticket.id,
        fromStatus: TicketStatus.NEW,
        toStatus: TicketStatus.ASSIGNED,
        changedByUserId: technicianUserId,
        comment: 'Claimed by technician',
      })

      await this.timelineService.recordTx(tx, {
        event: 'TICKET_CLAIMED',
        companyId: ticket.companyId,
        ticketId: ticket.id,
        actorUserId: technicianUserId,
        payload: {
          assignedTechnicianId: technicianUserId,
          mode: 'claim',
          operationCompanyId: companyId,
        },
      })

      return ticket.id
    })

    return this.query.getOne(companyId, technicianUserId, UserRole.TECHNICIAN, resolvedTicketId, undefined, undefined, linkedClientCompanyId)
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
              companyId: companyId,
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
          companyId: companyId,
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
        companyId: companyId,
        ticketId: ticket.id,
        attachmentIds: input.attachmentIds ?? [],
      });

      await this.timelineService.recordTx(tx, {
        event: 'TICKET_CREATED',
        companyId: companyId,
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
          companyId: companyId,
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




