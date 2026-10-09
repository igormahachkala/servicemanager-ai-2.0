import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, TicketAttachmentPurpose, TicketStatus } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { NotificationsService } from '../notifications/notifications.service'
import { resolveTicketAcceptanceAccess } from './ticket-acceptance-access'
import { assertChildTicketCannotBeAccepted } from './ticket-is-child'
import {
  applyChildResolutionsInTx,
  prepareParentClose,
  stampFieldCompleteDescendantsDoneInTx,
  type CloseTreeTicketRow,
} from './ticket-close-tree'

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
      assertChildTicketCannotBeAccepted(ticket)

      if (ticket.status !== TicketStatus.AWAITING_ACCEPTANCE) {
        throw new BadRequestException(
          `Ticket must be in AWAITING_ACCEPTANCE status, got: ${ticket.status}`,
        )
      }

      /**
       * SMA-ACCEPTANCE-ATTACHMENT-OWNERSHIP-P0-077.
       *
       * Прежний отбор ограничивался компанией, а принадлежностью к заявке — нет:
       * id вложения соседней заявки той же компании переподчинял её файл текущей.
       * Компания у заявок общая, поэтому сама по себе она ничего не разделяет.
       *
       * Допустимы ровно два случая, теми же условиями, что и у канонического
       * связывания черновиков при создании заявки:
       *   — вложение уже принадлежит этой заявке: обычный путь, клиент грузит
       *     файл в заявку и следом выносит решение;
       *   — это ещё ничей черновик, загруженный самим актором (ticketId null).
       *
       * Любой другой id — отказ целиком, без частично применённого решения.
       * Проверка идёт до первой записи.
       */
      const attachmentIds = [...new Set((dto.attachmentIds || []).filter(Boolean))]
      if (attachmentIds.length > 0) {
        const ownedAttachments = await tx.ticketAttachment.findMany({
          where: {
            id: { in: attachmentIds },
            companyId: access.ticket.companyId,
            OR: [{ ticketId }, { ticketId: null, uploadedByUserId: actor.id }],
          },
          select: { id: true },
        })

        if (ownedAttachments.length !== attachmentIds.length) {
          throw new BadRequestException('Some attachmentIds are invalid')
        }
      }

      let closeTreeDescendants: CloseTreeTicketRow[] = []
      if (dto.decision === AcceptanceDecision.ACCEPT) {
        const closeTree = await prepareParentClose(tx, {
          rootTicketId: ticketId,
          companyId: ticket.companyId,
          childResolutions: dto.childResolutions,
        })
        closeTreeDescendants = closeTree.draft
          ? await applyChildResolutionsInTx(tx, {
              timeline: this.timelineService,
              parentCompanyId: ticket.companyId,
              actorUserId: actor.id,
              descendants: closeTree.descendants,
              draft: closeTree.draft,
            })
          : closeTree.descendants
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

      if (attachmentIds.length > 0) {
        const purpose =
          dto.decision === AcceptanceDecision.REJECT
            ? TicketAttachmentPurpose.DECLINE_REPORT
            : TicketAttachmentPurpose.WORK_REPORT

        await tx.ticketAttachment.updateMany({
          where: {
            id: { in: attachmentIds },
            companyId: access.ticket.companyId,
            // Условие владения повторяется и здесь: запись остаётся невозможной
            // для чужого файла даже если порядок шагов однажды поменяют.
            OR: [{ ticketId }, { ticketId: null, uploadedByUserId: actor.id }],
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

      if (dto.decision === AcceptanceDecision.ACCEPT) {
        await stampFieldCompleteDescendantsDoneInTx(tx, {
          timeline: this.timelineService,
          parentCompanyId: ticket.companyId,
          actorUserId: actor.id,
          descendants: closeTreeDescendants,
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
