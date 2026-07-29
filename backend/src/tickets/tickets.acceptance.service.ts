import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, TicketAttachmentPurpose, TicketStatus } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { NotificationsService } from '../notifications/notifications.service'
import { resolveTicketAcceptanceAccess } from './ticket-acceptance-access'

import { AcceptanceDecision, TicketAcceptanceDto } from './dto/ticket-acceptance.dto'

type ActorCtx = {
  id: string
  role: any
  companyId: string
  accessFlags?: Record<string, any>
}

@Injectable()
export class TicketsAcceptanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timelineService: TimelineService,
    private readonly serviceContractsService: ServiceContractsService,
    private readonly notifications: NotificationsService,
  ) {}

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

    const access = await resolveTicketAcceptanceAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor,
      ticketId,
      linkedClientCompanyId,
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

      const acceptanceEventName =
        dto.decision === AcceptanceDecision.ACCEPT ? 'TICKET_ACCEPTED' : 'TICKET_REJECTED'

      const acceptanceEventRecord = await this.timelineService.recordTx(tx, {
        event: acceptanceEventName,
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

      return { updated, acceptanceEventId: acceptanceEventRecord.id }
    })

    if (dto.decision === AcceptanceDecision.ACCEPT) {
      this.notifications.onTicketAccepted({
        ticketCompanyId: result.updated.companyId,
        assignedTechnicianId: result.updated.assignedTechnicianId,
        actorUserId: actor.id,
        ticketId,
        ticketNumber: result.updated.ticketNumber,
        sourceEventId: result.acceptanceEventId,
      })
    } else {
      this.notifications.onTicketRejected({
        ticketCompanyId: result.updated.companyId,
        assignedTechnicianId: result.updated.assignedTechnicianId,
        actorUserId: actor.id,
        ticketId,
        ticketNumber: result.updated.ticketNumber,
        comment: comment || null,
        sourceEventId: result.acceptanceEventId,
      })
    }

    return result.updated
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
