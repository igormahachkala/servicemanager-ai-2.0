import { Injectable } from '@nestjs/common';
import { TicketStatus, UserRole } from '@prisma/client';

import type { BoardQueryInput } from '../policy/tickets.policy';

import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateChildTicketDto } from './dto/create-child-ticket.dto';

import { TicketsQueryService } from './tickets.query.service';
import { TicketsAssignmentService } from './tickets.assignment.service';
import { TicketsStatusService } from './tickets.status.service';

type AccessFlags = {
  canTechnicianViewAllCompanyTickets?: boolean;
};

@Injectable()
export class TicketsService {
  constructor(
    private readonly query: TicketsQueryService,
    private readonly assignment: TicketsAssignmentService,
    private readonly status: TicketsStatusService,
  ) {}

  // ===== Queries =====

  board(companyId: string, userId: string, role: UserRole, input: BoardQueryInput, accessFlags?: AccessFlags) {
    return this.query.board(companyId, userId, role, input, accessFlags);
  }

  list(companyId: string, userId: string, role: UserRole, status?: TicketStatus, accessFlags?: AccessFlags) {
    return this.query.list(companyId, userId, role, status, accessFlags);
  }

  getOne(companyId: string, userId: string, role: UserRole, ticketId: string, accessFlags?: AccessFlags) {
    return this.query.getOne(companyId, userId, role, ticketId, accessFlags);
  }

  // ===== Assignment / Create / Claim =====

  create(companyId: string, creatorRole: UserRole, dto: CreateTicketDto) {
    return this.assignment.create(companyId, creatorRole, dto);
  }

  createChild(companyId: string, creatorRole: UserRole, parentId: string, dto: CreateChildTicketDto) {
    return this.assignment.createChild(companyId, creatorRole, parentId, dto);
  }

  assign(companyId: string, actor: any, ticketId: string, technicianId: string) {
    return this.assignment.assign(companyId, actor, ticketId, technicianId);
  }

  availableForTechnician(companyId: string, technicianUserId: string) {
    return this.assignment.availableForTechnician(companyId, technicianUserId);
  }

  claim(companyId: string, technicianUserId: string, ticketId: string) {
    return this.assignment.claim(companyId, technicianUserId, ticketId);
  }

  // ===== Status =====

  updateStatus(
    companyId: string,
    user: { id?: string } | any,
    role: UserRole,
    ticketId: string,
    dto: { status: TicketStatus; comment?: string },
  ) {
    return this.status.updateStatus(companyId, user, role, ticketId, dto);
  }
}
