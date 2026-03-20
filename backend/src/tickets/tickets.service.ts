import { Injectable } from '@nestjs/common';
import { TicketStatus, UserRole } from '@prisma/client';

import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateChildTicketDto } from './dto/create-child-ticket.dto';

import { TicketsAssignmentService } from './tickets.assignment.service';
import { TicketsQueryService } from './tickets.query.service';
import { TicketsStatusService } from './tickets.status.service';
import { TicketAttachmentsService } from './ticket-attachments.service';

import { type BoardQueryInput } from '../policy/tickets.policy';

type AccessFlags = {
  canTechnicianViewAllCompanyTickets?: boolean;
};

@Injectable()
export class TicketsService {
  constructor(
    private readonly query: TicketsQueryService,
    private readonly assignment: TicketsAssignmentService,
    private readonly status: TicketsStatusService,
    private readonly attachments: TicketAttachmentsService,
  ) {}

  create(companyId: string, creatorRole: UserRole, dto: CreateTicketDto) {
    return this.assignment.create(companyId, creatorRole, dto);
  }

  createChild(companyId: string, creatorRole: UserRole, parentId: string, dto: CreateChildTicketDto) {
    return this.assignment.createChild(companyId, creatorRole, parentId, dto);
  }

  board(
    companyId: string,
    userId: string,
    role: UserRole,
    input: BoardQueryInput,
    accessFlags?: AccessFlags,
  ) {
    return this.query.board(companyId, userId, role, input, accessFlags);
  }

  list(
    companyId: string,
    userId: string,
    role: UserRole,
    status?: TicketStatus,
    accessFlags?: AccessFlags,
  ) {
    return this.query.list(companyId, userId, role, status, accessFlags);
  }

  getOne(
    companyId: string,
    userId: string,
    role: UserRole,
    ticketId: string,
    accessFlags?: AccessFlags,
  ) {
    return this.query.getOne(companyId, userId, role, ticketId, accessFlags);
  }

  listAttachments(
    companyId: string,
    userId: string,
    role: UserRole,
    ticketId: string,
    accessFlags?: AccessFlags,
  ) {
    return this.attachments.listForTicket({ id: userId, role, companyId, accessFlags }, ticketId);
  }

  uploadDraftAttachment(companyId: string, userId: string, file: any) {
    return this.attachments.uploadDraftAttachment(companyId, userId, file);
  }

  uploadTicketAttachment(
    companyId: string,
    userId: string,
    role: UserRole,
    ticketId: string,
    file: any,
    accessFlags?: AccessFlags,
  ) {
    return this.attachments.uploadToTicket({ id: userId, role, companyId, accessFlags }, ticketId, file);
  }

  deleteDraftAttachment(companyId: string, attachmentId: string) {
    return this.attachments.deleteDraftAttachment(companyId, attachmentId);
  }

  deleteTicketAttachment(
    companyId: string,
    userId: string,
    role: UserRole,
    ticketId: string,
    attachmentId: string,
    accessFlags?: AccessFlags,
  ) {
    return this.attachments.deleteFromTicket({ id: userId, role, companyId, accessFlags }, ticketId, attachmentId);
  }

  assign(companyId: string, actor: any, ticketId: string, technicianId: string) {
    return this.assignment.assign(companyId, actor, ticketId, technicianId);
  }

  claim(companyId: string, technicianUserId: string, ticketId: string) {
    return this.assignment.claim(companyId, technicianUserId, ticketId);
  }

  listAssignmentCandidates(companyId: string, actor: any, ticketId: string) {
    return this.assignment.listAssignmentCandidates(companyId, actor, ticketId);
  }

  updateStatus(
    companyId: string,
    user: { id?: string } | any,
    role: UserRole,
    ticketId: string,
    dto: { status: TicketStatus; comment?: string },
  ) {
    return this.status.updateStatus(companyId, user, role, ticketId, dto);
  }

  availableForTechnician(companyId: string, technicianUserId: string) {
    return this.assignment.availableForTechnician(companyId, technicianUserId);
  }
}
