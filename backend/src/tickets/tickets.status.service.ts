import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TicketStatus, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { TicketsPolicy } from '../policy/tickets.policy';
import { assertAllowed } from '../policy/policy.utils';

import { decideTicketTransition } from '../workflow/ticket.workflow';
import { TimelineService } from '../timeline/timeline.service';

@Injectable()
export class TicketsStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timelineService: TimelineService,
  ) {}

  private readonly policy = new TicketsPolicy();

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

  async updateStatus(
    companyId: string,
    user: { id?: string } | any,
    role: UserRole,
    ticketId: string,
    dto: { status: TicketStatus; comment?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, companyId },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');

      const decision = this.policy.canChangeStatus({
        user: { id: user?.id, role, companyId },
        ticket: { companyId: ticket.companyId, assignedTechnicianId: ticket.assignedTechnicianId },
      });
      assertAllowed(decision);

      const toStatus = dto.status;
      const fromStatus = ticket.status;

      const wf = decideTicketTransition(fromStatus, toStatus);
      if (!wf.allowed) throw new BadRequestException(wf.reason);

      const now = new Date();
      const shouldMarkBreached = ticket.slaDueAt && !ticket.slaBreachedAt && now > ticket.slaDueAt;

      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: toStatus,
          statusUpdatedAt: now,
          slaBreachedAt: shouldMarkBreached ? now : ticket.slaBreachedAt,
          closedAt: toStatus === TicketStatus.DONE ? now : ticket.closedAt,
        },
      });

      await this.writeStatusHistoryTx(tx, {
        ticketId,
        fromStatus,
        toStatus,
        changedByUserId: user?.id ?? null,
        comment: dto.comment ?? null,
      });

      await this.timelineService.recordTx(tx, {
        event: 'STATUS_CHANGED',
        companyId,
        ticketId,
        actorUserId: user?.id ?? null,
        payload: {
          fromStatus,
          toStatus,
          comment: dto.comment ?? null,
          slaBreachedMarked: shouldMarkBreached,
        },
      });

      if (dto.comment?.trim()) {
        await this.timelineService.recordTx(tx, {
          event: 'COMMENT_ADDED',
          companyId,
          ticketId,
          actorUserId: user?.id ?? null,
          payload: {
            comment: dto.comment.trim(),
            fromStatus,
            toStatus,
            source: 'status_change',
          },
        });
      }

      return updated;
    });
  }
}
