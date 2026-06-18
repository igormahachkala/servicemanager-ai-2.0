import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { CompanyType, Prisma, ServiceContractRole, TicketAttachmentPurpose, TicketStatus, UserRole } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { resolveReadableTicketAccess } from './ticket-access.utils'

import { AcceptanceDecision, TicketAcceptanceDto } from './dto/ticket-acceptance.dto'

type ActorCtx = {
  id: string
  role: any
  companyId: string
  accessFlags?: Record<string, any>
}

// SMA-ACCEPTANCE-ROLE-GAP-001: only client-company management roles may accept/reject.
// CLIENT (requester) and all provider-side roles are excluded; the actor must also
// belong to a CLIENT-type company (so a provider cannot accept its own work).
const ACCEPTANCE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.TERRITORIAL_MANAGER,
  UserRole.NETWORK_DIRECTOR,
]

@Injectable()
export class TicketsAcceptanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timelineService: TimelineService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  // SMA-ACCEPTANCE-ROLE-GAP-001: gate accept/reject to client-company management roles.
  private async assertClientAcceptanceActor(actor: ActorCtx) {
    if (!ACCEPTANCE_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Role cannot accept or reject work')
    }
    const company = await this.prisma.company.findUnique({
      where: { id: actor.companyId },
      select: { id: true, type: true },
    })
    if (!company) {
      throw new NotFoundException('Company not found')
    }
    if (company.type !== CompanyType.CLIENT) {
      throw new ForbiddenException('Only the client company can accept or reject work')
    }
  }

  async decide(
    actor: ActorCtx,
    ticketId: string,
    dto: TicketAcceptanceDto,
    linkedClientCompanyId?: string,
  ) {
    const comment = (dto.comment ?? '').trim()
    if (dto.decision === AcceptanceDecision.REJECT && !comment) {
      throw new BadRequestException('Comment is required when rejecting')
    }

    await this.assertClientAcceptanceActor(actor)

    const access = await resolveReadableTicketAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: {
        id: actor.id,
        role: actor.role,
        companyId: actor.companyId,
        accessFlags: actor.accessFlags,
      },
      ticketId,
      linkedClientCompanyId,
      allowedLinkedClientContractRoles: [ServiceContractRole.PRIMARY, ServiceContractRole.SECONDARY],
    })

    const result = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, companyId: access.ticket.companyId },
      })
      if (!ticket) throw new NotFoundException('Ticket not found')

      if (ticket.status !== TicketStatus.AWAITING_ACCEPTANCE) {
        throw new BadRequestException(
          `Ticket must be in AWAITING_ACCEPTANCE status, got: ${ticket.status}`,
        )
      }

      const toStatus =
        dto.decision === AcceptanceDecision.ACCEPT ? TicketStatus.DONE : TicketStatus.IN_PROGRESS

      const now = new Date()
      const shouldMarkBreached =
        ticket.slaDueAt && !ticket.slaBreachedAt && now > ticket.slaDueAt

      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: toStatus,
          statusUpdatedAt: now,
          slaBreachedAt: shouldMarkBreached ? now : ticket.slaBreachedAt,
          closedAt: toStatus === TicketStatus.DONE ? now : ticket.closedAt,
        },
      })

      if (dto.attachmentIds && dto.attachmentIds.length > 0) {
        const purpose =
          dto.decision === AcceptanceDecision.REJECT
            ? TicketAttachmentPurpose.DECLINE_REPORT
            : TicketAttachmentPurpose.WORK_REPORT

        await tx.ticketAttachment.updateMany({
          where: {
            id: { in: dto.attachmentIds },
            companyId: access.ticket.companyId,
          },
          data: {
            ticketId,
            purpose,
          },
        })
      }

      await this.writeStatusHistoryTx(tx, {
        ticketId,
        fromStatus: ticket.status,
        toStatus,
        changedByUserId: actor.id,
        comment: comment || null,
      })

      await this.timelineService.recordTx(tx, {
        event: 'STATUS_CHANGED',
        companyId: ticket.companyId,
        ticketId,
        actorUserId: actor.id,
        payload: { fromStatus: ticket.status, toStatus, comment: comment || null },
      })

      const acceptanceEvent =
        dto.decision === AcceptanceDecision.ACCEPT ? 'TICKET_ACCEPTED' : 'TICKET_REJECTED'

      await this.timelineService.recordTx(tx, {
        event: acceptanceEvent,
        companyId: ticket.companyId,
        ticketId,
        actorUserId: actor.id,
        payload: { comment: comment || null, decision: dto.decision },
      })

      if (comment) {
        await this.timelineService.recordTx(tx, {
          event: 'COMMENT_ADDED',
          companyId: ticket.companyId,
          ticketId,
          actorUserId: actor.id,
          payload: { comment, source: 'acceptance' },
        })
      }

      return updated
    })

    return result
  }

  private async writeStatusHistoryTx(
    tx: Prisma.TransactionClient,
    params: {
      ticketId: string
      fromStatus: TicketStatus
      toStatus: TicketStatus
      changedByUserId: string | null
      comment?: string | null
    },
  ) {
    await tx.ticketStatusHistory.create({
      data: {
        ticketId: params.ticketId,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        comment: params.comment ?? null,
        changedByUserId: params.changedByUserId ?? null,
      },
    })
  }
}
