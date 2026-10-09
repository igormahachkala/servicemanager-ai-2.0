import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { TicketStatus, UserRole } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import { ServiceContractsService } from '../service-contracts/service-contracts.service'
import { TimelineService } from '../timeline/timeline.service'
import { resolveTicketOperationAccess } from './ticket-access.utils'

export const TICKET_NOT_A_CHILD_CODE = 'TICKET_NOT_A_CHILD'
export const TICKET_NOT_A_CHILD_MESSAGE = 'Ticket is not a child'

@Injectable()
export class TicketDetachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serviceContractsService: ServiceContractsService,
    private readonly timelineService: TimelineService,
  ) {}

  async detachFromParent(
    companyId: string,
    user: { id?: string; accessFlags?: Record<string, unknown> } | any,
    role: UserRole,
    ticketId: string,
    linkedClientCompanyId?: string,
  ) {
    if (role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only ADMIN can detach a child ticket')
    }

    const access = await resolveTicketOperationAccess({
      prisma: this.prisma,
      serviceContractsService: this.serviceContractsService,
      actor: {
        id: user?.id,
        role,
        companyId,
        accessFlags: user?.accessFlags,
      },
      ticketId,
      linkedClientCompanyId,
    })

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, companyId: access.ticket.companyId },
        include: {
          parent: {
            select: { id: true, ticketNumber: true },
          },
        },
      })
      if (!ticket) throw new NotFoundException('Ticket not found')
      if (ticket.parentId == null) {
        throw new BadRequestException({
          code: TICKET_NOT_A_CHILD_CODE,
          message: TICKET_NOT_A_CHILD_MESSAGE,
        })
      }

      const parentId = ticket.parentId
      const parentTicketNumber = ticket.parent?.ticketNumber ?? null
      const fromStatus = ticket.status
      const promoteFromFieldComplete = fromStatus === TicketStatus.FIELD_COMPLETE
      const toStatus = promoteFromFieldComplete
        ? TicketStatus.AWAITING_ACCEPTANCE
        : fromStatus

      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          parentId: null,
          ...(promoteFromFieldComplete
            ? {
                status: toStatus,
                statusUpdatedAt: new Date(),
              }
            : {}),
        },
      })

      await this.timelineService.recordTx(tx, {
        event: 'TICKET_DETACHED_FROM_PARENT',
        companyId: ticket.companyId,
        ticketId,
        actorUserId: user?.id ?? null,
        payload: {
          parentId,
          parentTicketNumber,
        },
      })

      if (promoteFromFieldComplete) {
        await tx.ticketStatusHistory.create({
          data: {
            ticketId,
            fromStatus,
            toStatus,
            comment: null,
            changedByUserId: user?.id ?? null,
          },
        })

        await this.timelineService.recordTx(tx, {
          event: 'STATUS_CHANGED',
          companyId: ticket.companyId,
          ticketId,
          actorUserId: user?.id ?? null,
          payload: {
            fromStatus,
            toStatus,
            comment: null,
          },
        })

        await this.timelineService.recordTx(tx, {
          event: 'TICKET_READY_FOR_ACCEPTANCE',
          companyId: ticket.companyId,
          ticketId,
          actorUserId: user?.id ?? null,
          payload: {
            fromStatus,
            toStatus,
          },
        })
      }

      return updated
    })
  }
}
