import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateChildTicketDto } from './dto/create-child-ticket.dto';
import { TicketStatus, TicketUrgency, UserRole } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

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

  /**
   * Набор допустимых переходов статусов.
   * Под твой enum: NEW / ASSIGNED / IN_PROGRESS / DONE / CANCELED.
   */
  private canTransition(from: TicketStatus, to: TicketStatus): boolean {
    if (from === to) return false;

    const allowed: Partial<Record<TicketStatus, TicketStatus[]>> = {
      NEW: ['ASSIGNED', 'IN_PROGRESS', 'CANCELED'] as TicketStatus[],
      ASSIGNED: ['IN_PROGRESS', 'DONE', 'CANCELED'] as TicketStatus[],
      IN_PROGRESS: ['DONE', 'CANCELED'] as TicketStatus[],
      DONE: [] as TicketStatus[],
      CANCELED: [] as TicketStatus[],
    };

    const next = allowed[from] ?? [];
    return next.includes(to);
  }

  private async writeStatusHistory(params: {
    ticketId: string;
    fromStatus: TicketStatus | null;
    toStatus: TicketStatus;
    changedByUserId: string | null;
    comment?: string | null;
  }) {
    const { ticketId, fromStatus, toStatus, changedByUserId, comment } = params;

    await this.prisma.ticketStatusHistory.create({
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
    const assignedTechnicianId = shouldAutoAssign ? candidates[0].id : null;

    const status = assignedTechnicianId ? TicketStatus.ASSIGNED : TicketStatus.NEW;

    const slaMinutes = dto.slaMinutes ?? null;
    const slaDueAt = slaMinutes ? new Date(Date.now() + slaMinutes * 60_000) : null;

    const ticket = await this.prisma.ticket.create({
      data: {
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

    await this.writeStatusHistory({
      ticketId: ticket.id,
      fromStatus: null,
      toStatus: ticket.status,
      changedByUserId: null,
      comment: 'Ticket created',
    });

    return {
      ticket,
      instructions: category.instructions || null,
      candidates,
      autoAssigned: !!assignedTechnicianId,
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
    const assignedTechnicianId = shouldAutoAssign ? candidates[0].id : null;

    const status = assignedTechnicianId ? TicketStatus.ASSIGNED : TicketStatus.NEW;

    const slaMinutes = dto.slaMinutes ?? null;
    const slaDueAt = slaMinutes ? new Date(Date.now() + slaMinutes * 60_000) : null;

    const ticket = await this.prisma.ticket.create({
      data: {
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

    await this.writeStatusHistory({
      ticketId: ticket.id,
      fromStatus: null,
      toStatus: ticket.status,
      changedByUserId: null,
      comment: 'Child ticket created',
    });

    return {
      ticket,
      instructions: category.instructions || null,
      candidates,
      autoAssigned: !!assignedTechnicianId,
      parentId: parent.id,
    };
  }

  async list(companyId: string, userId: string, role: UserRole, status?: TicketStatus) {
    /**
     * Официальное решение:
     * TECHNICIAN может читать любые тикеты внутри company.
     * Поэтому scope для чтения здесь одинаковый для разрешённых ролей — по companyId.
     */
    return this.prisma.ticket.findMany({
      where: { companyId, status: status ?? undefined },
      orderBy: { createdAt: 'desc' },
      include: {
        problemCategory: { select: { id: true, name: true } },
        assignedTechnician: { select: { id: true, email: true } },
      },
    });
  }

  async getOne(companyId: string, userId: string, role: UserRole, ticketId: string) {
    /**
     * Официальное решение:
     * TECHNICIAN может читать “чужие” заявки внутри company.
     * Поэтому getOne — просто companyId + id (доступ по ролям обеспечивает controller guards).
     */
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, companyId },
      include: {
        problemCategory: { select: { id: true, name: true, instructions: true } },
        assignedTechnician: { select: { id: true, email: true } },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
        parent: {
          select: {
            id: true,
            problemText: true,
            status: true,
            createdAt: true,
          },
        },
        children: {
          orderBy: { createdAt: 'asc' },
          include: {
            problemCategory: { select: { id: true, name: true } },
            assignedTechnician: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async assign(companyId: string, actor: any, ticketId: string, technicianId: string) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, companyId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const tech = await this.prisma.user.findFirst({
      where: { id: technicianId, companyId, role: UserRole.TECHNICIAN },
      select: { id: true },
    });
    if (!tech) throw new NotFoundException('Technician not found');

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { assignedTechnicianId: technicianId, status: TicketStatus.ASSIGNED },
    });

    await this.writeStatusHistory({
      ticketId,
      fromStatus: ticket.status,
      toStatus: TicketStatus.ASSIGNED,
      changedByUserId: actor?.id ?? null,
      comment: `Assigned to technician ${technicianId}`,
    });

    return updated;
  }

  async updateStatus(
    companyId: string,
    user: { id?: string } | any,
    role: UserRole,
    ticketId: string,
    dto: { status: TicketStatus; comment?: string },
  ) {
    if (
      role !== UserRole.ADMIN &&
      role !== UserRole.MASTER &&
      role !== UserRole.DISPATCHER &&
      role !== UserRole.TECHNICIAN &&
      role !== UserRole.NETWORK_DIRECTOR
    ) {
      throw new BadRequestException('Role cannot change ticket status');
    }

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, companyId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Write-scope: TECHNICIAN может менять статус только своих заявок (assigned to self)
    if (role === UserRole.TECHNICIAN && ticket.assignedTechnicianId !== user?.id) {
      throw new BadRequestException('Technician can change status only for own tickets');
    }

    const toStatus = dto.status;
    const fromStatus = ticket.status;

    if (!this.canTransition(fromStatus, toStatus)) {
      throw new BadRequestException(`Invalid status transition: ${fromStatus} -> ${toStatus}`);
    }

    const now = new Date();
    const shouldMarkBreached =
      ticket.slaDueAt && !ticket.slaBreachedAt && now > ticket.slaDueAt;

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: toStatus,
        slaBreachedAt: shouldMarkBreached ? now : ticket.slaBreachedAt,
        closedAt: toStatus === TicketStatus.DONE ? now : ticket.closedAt,
      },
    });

    await this.writeStatusHistory({
      ticketId,
      fromStatus,
      toStatus,
      changedByUserId: user?.id ?? null,
      comment: dto.comment ?? null,
    });

    return updated;
  }

  async availableForTechnician(companyId: string, technicianUserId: string) {
    // MVP: available NEW tickets by specialization (no points/zones yet)
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
    if (specializationIds.length === 0) {
      throw new BadRequestException('Technician has no specializations');
    }

    // Atomic claim with specialization enforcement:
    // only NEW + not assigned + matches technician specialization (via problemCategory.specializationLinks)
    const updated = await this.prisma.ticket.updateMany({
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
      data: {
        status: TicketStatus.ASSIGNED,
        statusUpdatedAt: new Date(),
        assignedTechnicianId: technicianUserId,
      },
    });

    if (updated.count === 0) {
      throw new BadRequestException('Ticket is not available for claim or does not match technician specialization');
    }

    await this.writeStatusHistory({
      ticketId,
      fromStatus: TicketStatus.NEW,
      toStatus: TicketStatus.ASSIGNED,
      changedByUserId: technicianUserId,
      comment: 'Claimed by technician',
    });

    return this.getOne(companyId, technicianUserId, UserRole.TECHNICIAN, ticketId);
  }
}
