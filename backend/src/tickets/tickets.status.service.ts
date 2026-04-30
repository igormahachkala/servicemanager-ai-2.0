import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TicketAttachmentPurpose, TicketStatus, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { TicketsPolicy } from '../policy/tickets.policy';
import { assertAllowed } from '../policy/policy.utils';

import { decideTicketTransition } from '../workflow/ticket.workflow';
import { TimelineService } from '../timeline/timeline.service';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';
import { resolveTicketOperationAccess } from './ticket-access.utils';

@Injectable()
export class TicketsStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timelineService: TimelineService,
    private readonly serviceContractsService: ServiceContractsService,
  ) {}

  private readonly policy = new TicketsPolicy();

  private async assertExecutorOperationsAllowed(actorCompanyId: string) {
    const actorCompany = await this.prisma.company.findUnique({
      where: { id: actorCompanyId },
      select: { id: true, type: true },
    });
    if (!actorCompany) {
      throw new NotFoundException('Company not found');
    }
    if (actorCompany.type === 'CLIENT') {
      throw new ForbiddenException('Client company cannot perform executor operations');
    }
  }

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
    linkedClientCompanyId?: string,
  ) {
    await this.assertExecutorOperationsAllowed(companyId);
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
    });

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, companyId: access.ticket.companyId },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');

      const decision = this.policy.canChangeStatus({
        user: { id: user?.id, role, companyId: access.operationCompanyId },
        ticket: {
          companyId: access.operationCompanyId,
          assignedTechnicianId: ticket.assignedTechnicianId,
        },
      });
      assertAllowed(decision);

      const toStatus = dto.status;
      const fromStatus = ticket.status;

      const wf = decideTicketTransition(fromStatus, toStatus);
      if (!wf.allowed) throw new BadRequestException(wf.reason);

      if (toStatus === TicketStatus.DONE) {
        const [workReportPhotoCount, commentEventCount] = await Promise.all([
          tx.ticketAttachment.count({
            where: {
              ticketId,
              purpose: TicketAttachmentPurpose.WORK_REPORT,
              mimeType: { startsWith: 'image/' },
            },
          }),
          tx.domainEvent.count({
            where: {
              companyId: ticket.companyId,
              entityType: 'Ticket',
              entityId: ticketId,
              type: 'ticket.comment_added',
            },
          }),
        ]);

        if (workReportPhotoCount === 0) {
          throw new BadRequestException('Cannot complete ticket without at least 1 work report photo');
        }

        if (commentEventCount === 0) {
          const legacyCommentCount = await tx.ticketStatusHistory.count({
            where: {
              ticketId,
              NOT: [
                { comment: null },
                { comment: '' },
                { comment: 'Ticket created' },
              ],
            },
          });

          if (legacyCommentCount === 0) {
            throw new BadRequestException('Cannot complete ticket without at least 1 comment');
          }
        }
      }

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
        companyId: ticket.companyId,
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
          companyId: ticket.companyId,
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

  async addComment(
    companyId: string,
    user: { id?: string } | any,
    role: UserRole,
    ticketId: string,
    dto: { comment: string },
    linkedClientCompanyId?: string,
  ) {
    const comment = (dto.comment || '').trim();
    if (!comment) {
      throw new BadRequestException('comment is required');
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
    });

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, companyId: access.ticket.companyId },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');

      const decision = this.policy.canChangeStatus({
        user: { id: user?.id, role, companyId: access.operationCompanyId },
        ticket: {
          companyId: access.operationCompanyId,
          assignedTechnicianId: ticket.assignedTechnicianId,
        },
      });
      assertAllowed(decision);

      await this.timelineService.recordTx(tx, {
        event: 'COMMENT_ADDED',
        companyId: ticket.companyId,
        ticketId,
        actorUserId: user?.id ?? null,
        payload: {
          comment,
          source: 'manual_comment',
        },
      });

      await this.writeStatusHistoryTx(tx, {
        ticketId,
        fromStatus: ticket.status,
        toStatus: ticket.status,
        changedByUserId: user?.id ?? null,
        comment,
      });

      return { ok: true };
    });
  }
}
