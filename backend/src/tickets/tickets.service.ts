import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import {
  TicketStatus,
  TicketUrgency,
  UserRole,
} from '@prisma/client';
import { CreateChildTicketDto } from './dto/create-child-ticket.dto';

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

  async create(companyId: string, creatorRole: UserRole, dto: CreateTicketDto) {
    if (creatorRole !== UserRole.ADMIN && creatorRole !== UserRole.DISPATCHER) {
      throw new BadRequestException('Only ADMIN or DISPATCHER can create tickets');
    }

    const company = await this.getCompany(companyId);
    const category = await this.getCategory(companyId, dto.problemCategoryId);

    const specializationIds = category.specializationLinks.map((x) => x.specializationId);
    const candidates = await this.findCandidateTechnicians(companyId, specializationIds);

    const shouldAutoAssign = company.autoAssignEnabled && candidates.length > 0;
    const assignedTechnicianId = shouldAutoAssign ? candidates[0].id : null;

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
        slaMinutes: dto.slaMinutes ?? null,

        status: assignedTechnicianId ? TicketStatus.ASSIGNED : TicketStatus.NEW,
        assignedTechnicianId,
      },
    });

    return {
      ticket,
      instructions: category.instructions || null,
      candidates,
      autoAssigned: !!assignedTechnicianId,
    };
  }

  async list(companyId: string, status?: TicketStatus) {
    return this.prisma.ticket.findMany({
      where: { companyId, status: status ?? undefined },
      orderBy: { createdAt: 'desc' },
      include: {
        problemCategory: { select: { id: true, name: true } },
        assignedTechnician: { select: { id: true, email: true } },
      },
    });
  }

  async assign(companyId: string, ticketId: string, technicianId: string) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, companyId } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const tech = await this.prisma.user.findFirst({
      where: { id: technicianId, companyId, role: UserRole.TECHNICIAN },
      select: { id: true },
    });
    if (!tech) throw new NotFoundException('Technician not found');

    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { assignedTechnicianId: technicianId, status: TicketStatus.ASSIGNED },
    });
  }

  async createChild(companyId: string, creatorRole: UserRole, parentId: string, dto: CreateChildTicketDto) {
    if (creatorRole !== UserRole.ADMIN && creatorRole !== UserRole.DISPATCHER) {
      throw new BadRequestException('Only ADMIN or DISPATCHER can create tickets');
    }

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
        slaMinutes: dto.slaMinutes ?? null,

        status: assignedTechnicianId ? TicketStatus.ASSIGNED : TicketStatus.NEW,
        assignedTechnicianId,
      },
    });

    return {
      ticket,
      instructions: category.instructions || null,
      candidates,
      autoAssigned: !!assignedTechnicianId,
      parentId: parent.id,
    };
  }
}
  async getOne(companyId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, companyId },
      include: {
        problemCategory: { select: { id: true, name: true, instructions: true } },
        assignedTechnician: { select: { id: true, email: true } },
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
async getById(id: string) {
  return this.prisma.ticket.findUnique({
    where: { id },
    include: {
      parent: true,
      children: true,
    },
  });
}
