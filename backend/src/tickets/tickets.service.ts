import { Injectable } from '@nestjs/common'
import { PublicRequestType, TicketStatus, TicketUrgency, UserRole } from '@prisma/client'

import { CreateTicketDto } from './dto/create-ticket.dto'
import { CreateChildTicketDto } from './dto/create-child-ticket.dto'
import { UpdateTicketDto } from './dto/update-ticket.dto'

import { TicketsAssignmentService } from './tickets.assignment.service'
import { TicketsQueryService } from './tickets.query.service'
import { TicketsStatusService } from './tickets.status.service'
import { TicketAttachmentsService } from './ticket-attachments.service'

import { type BoardQueryInput } from '../policy/tickets.policy'

type AccessFlags = {
  canTechnicianViewAllCompanyTickets?: boolean
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly query: TicketsQueryService,
    private readonly assignment: TicketsAssignmentService,
    private readonly status: TicketsStatusService,
    private readonly attachments: TicketAttachmentsService,
  ) {}

  create(companyId: string, actor: { id: string; role: UserRole }, dto: CreateTicketDto) {
    return this.assignment.create(companyId, actor.id, actor.role, dto)
  }

  createPublic(
    companyId: string,
    input: {
      locationId: string
      equipmentId?: string | null
      categoryId: string
      requestType: 'repair' | 'note'
      description: string
      requesterName?: string | null
      requesterPhone?: string | null
      attachmentIds?: string[]
      urgency?: TicketUrgency
      channel?: string | null
      presetLocationId?: string | null
      publicLinkVersion?: string | null
      ipHash?: string | null
      phoneNormalized?: string | null
    },
  ) {
    return this.assignment.createPublic(companyId, {
      ...input,
      publicRequestType:
        input.requestType === 'note' ? PublicRequestType.NOTE : PublicRequestType.REPAIR,
    })
  }

  createChild(companyId: string, creatorRole: UserRole, parentId: string, dto: CreateChildTicketDto) {
    return this.assignment.createChild(companyId, creatorRole, parentId, dto)
  }

  board(
    companyId: string,
    userId: string,
    role: UserRole,
    input: BoardQueryInput,
    accessFlags?: AccessFlags,
    linkedClientCompanyId?: string,
    observerCompanyId?: string,
  ) {
    return this.query.board(companyId, userId, role, input, accessFlags, linkedClientCompanyId, observerCompanyId)
  }

  contextAnalytics(
    companyId: string,
    userId: string,
    role: UserRole,
    accessFlags?: AccessFlags,
    linkedClientCompanyId?: string,
    observerCompanyId?: string,
    locationId?: string,
    equipmentId?: string,
  ) {
    return this.query.contextAnalytics(
      companyId,
      userId,
      role,
      accessFlags,
      linkedClientCompanyId,
      observerCompanyId,
      locationId,
      equipmentId,
    )
  }

  list(
    companyId: string,
    userId: string,
    role: UserRole,
    status?: TicketStatus,
    accessFlags?: AccessFlags,
    linkedClientCompanyId?: string,
    observerCompanyId?: string,
  ) {
    return this.query.list(companyId, userId, role, status, accessFlags, linkedClientCompanyId, observerCompanyId)
  }

  getOne(
    companyId: string,
    userId: string,
    role: UserRole,
    ticketId: string,
    accessFlags?: AccessFlags,
    observerCompanyId?: string,
    linkedClientCompanyId?: string,
  ) {
    return this.query.getOne(companyId, userId, role, ticketId, accessFlags, observerCompanyId, linkedClientCompanyId)
  }

  listAttachments(
    companyId: string,
    userId: string,
    role: UserRole,
    ticketId: string,
    accessFlags?: AccessFlags,
    linkedClientCompanyId?: string,
    observerCompanyId?: string,
  ) {
    return this.attachments.listForTicket(
      { id: userId, role, companyId, accessFlags },
      ticketId,
      linkedClientCompanyId,
      observerCompanyId,
    )
  }

  uploadDraftAttachment(companyId: string, userId: string, file: any) {
    return this.attachments.uploadDraftAttachment(companyId, userId, file)
  }

  uploadTicketAttachment(
    companyId: string,
    userId: string,
    role: UserRole,
    ticketId: string,
    file: any,
    accessFlags?: AccessFlags,
    linkedClientCompanyId?: string,
  ) {
    return this.attachments.uploadToTicket(
      { id: userId, role, companyId, accessFlags },
      ticketId,
      file,
      linkedClientCompanyId,
    )
  }

  deleteDraftAttachment(companyId: string, attachmentId: string) {
    return this.attachments.deleteDraftAttachment(companyId, attachmentId)
  }

  deleteTicketAttachment(
    companyId: string,
    userId: string,
    role: UserRole,
    ticketId: string,
    attachmentId: string,
    accessFlags?: AccessFlags,
    linkedClientCompanyId?: string,
  ) {
    return this.attachments.deleteFromTicket(
      { id: userId, role, companyId, accessFlags },
      ticketId,
      attachmentId,
      linkedClientCompanyId,
    )
  }

  update(
    companyId: string,
    actor: any,
    ticketId: string,
    dto: UpdateTicketDto,
    linkedClientCompanyId?: string,
  ) {
    return this.assignment.update(companyId, actor, ticketId, dto, linkedClientCompanyId)
  }

  assign(companyId: string, actor: any, ticketId: string, technicianId: string, linkedClientCompanyId?: string) {
    return this.assignment.assign(companyId, actor, ticketId, technicianId, linkedClientCompanyId)
  }

  claim(companyId: string, technicianUserId: string, ticketId: string, linkedClientCompanyId?: string) {
    return this.assignment.claim(companyId, technicianUserId, ticketId, linkedClientCompanyId)
  }

  listAssignmentCandidates(companyId: string, actor: any, ticketId: string, linkedClientCompanyId?: string) {
    return this.assignment.listAssignmentCandidates(companyId, actor, ticketId, linkedClientCompanyId)
  }

  updateStatus(
    companyId: string,
    user: { id?: string } | any,
    role: UserRole,
    ticketId: string,
    dto: { status: TicketStatus; comment?: string },
    linkedClientCompanyId?: string,
  ) {
    return this.status.updateStatus(companyId, user, role, ticketId, dto, linkedClientCompanyId)
  }

  addComment(
    companyId: string,
    user: { id?: string } | any,
    role: UserRole,
    ticketId: string,
    dto: { comment: string },
    linkedClientCompanyId?: string,
  ) {
    return this.status.addComment(companyId, user, role, ticketId, dto, linkedClientCompanyId)
  }

  availableForTechnician(companyId: string, technicianUserId: string) {
    return this.assignment.availableForTechnician(companyId, technicianUserId)
  }
}