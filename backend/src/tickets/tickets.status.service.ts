import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, TicketAttachmentPurpose, TicketStatus, UserRole } from '@prisma/client';
import { isExecutorCapableRole } from '../common/executor.utils';

import { PrismaService } from '../prisma/prisma.service';

import { TicketsPolicy } from '../policy/tickets.policy';
import { assertAllowed } from '../policy/policy.utils';

import { decideTicketTransition } from '../workflow/ticket.workflow';
import { TimelineService } from '../timeline/timeline.service';
import { ServiceContractsService } from '../service-contracts/service-contracts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { resolveTicketOperationAccess } from './ticket-access.utils';

@Injectable()
export class TicketsStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timelineService: TimelineService,
    private readonly serviceContractsService: ServiceContractsService,
    private readonly notifications: NotificationsService,
  ) {}

  private readonly policy = new TicketsPolicy();
  private readonly logger = new Logger(TicketsStatusService.name);

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

    const statusResult = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, companyId: access.ticket.companyId },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');

      if (ticket.status === TicketStatus.AWAITING_ACCEPTANCE && dto.status === TicketStatus.DONE) {
        throw new ForbiddenException('Only client acceptance can move awaiting work to DONE');
      }

      const actorIsExecutor = isExecutorCapableRole(role)
        ? (await this.prisma.user.findFirst({ where: { id: user?.id }, select: { isExecutor: true } }))?.isExecutor ?? false
        : false;
      const decision = this.policy.canChangeStatus({
        user: { id: user?.id, role, isExecutor: actorIsExecutor, companyId: access.operationCompanyId },
        ticket: {
          companyId: access.operationCompanyId,
          assignedTechnicianId: ticket.assignedTechnicianId,
        },
      });
      this.logger.log({
        event: 'executor_status_change_decision',
        actorUserId: user?.id,
        actorRole: role,
        actorIsExecutor,
        ticketId,
        allowed: decision.allowed,
        denialReason: decision.allowed ? undefined : (decision as { reason?: string }).reason,
      });
      assertAllowed(decision);

      const toStatus =
        dto.status === TicketStatus.DONE && ticket.status !== TicketStatus.AWAITING_ACCEPTANCE
          ? TicketStatus.AWAITING_ACCEPTANCE
          : dto.status;
      const fromStatus = ticket.status;

      const wf = decideTicketTransition(fromStatus, toStatus);
      if (!wf.allowed) throw new BadRequestException(wf.reason);

      if (toStatus === TicketStatus.AWAITING_ACCEPTANCE) {
        const [workReportMediaCount, commentEventCount] = await Promise.all([
          tx.ticketAttachment.count({
            where: {
              ticketId,
              purpose: TicketAttachmentPurpose.WORK_REPORT,
              OR: [
                { mimeType: { startsWith: 'image/' } },
                { mimeType: { startsWith: 'video/' } },
              ],
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

        if (workReportMediaCount === 0) {
          throw new BadRequestException('Cannot complete ticket without at least 1 work report photo or video');
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

      const statusEvent = await this.timelineService.recordTx(tx, {
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

      const commentEvent = dto.comment?.trim()
        ? await this.timelineService.recordTx(tx, {
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
        })
        : null;

      let readyForAcceptanceEventId: string | null = null;
      if (toStatus === TicketStatus.AWAITING_ACCEPTANCE) {
        const readyEv = await this.timelineService.recordTx(tx, {
          event: 'TICKET_READY_FOR_ACCEPTANCE',
          companyId: ticket.companyId,
          ticketId,
          actorUserId: user?.id ?? null,
          payload: { fromStatus, toStatus },
        });
        readyForAcceptanceEventId = readyEv.id;
      }

      return { updated, fromStatus, toStatus, statusEventId: statusEvent.id, commentEventId: commentEvent?.id ?? null, readyForAcceptanceEventId };
    });

    const summaryParts = [(dto.comment || '').trim(), (statusResult.updated.problemText || '').trim()].filter(Boolean);
    const summaryClip = (summaryParts[0] || summaryParts[1] || '').slice(0, 200);
    const summaryLine = summaryClip || `Заявка #${statusResult.updated.ticketNumber}`;

    if (statusResult.fromStatus !== statusResult.toStatus) {
      this.notifications.scheduleTicketStatusChanged({
        ticketCompanyId: statusResult.updated.companyId,
        locationId: statusResult.updated.locationId,
        ticketId,
        ticketNumber: statusResult.updated.ticketNumber,
        fromStatus: statusResult.fromStatus,
        toStatus: statusResult.toStatus,
        sourceEventId: statusResult.statusEventId,
      });
    }

    if (
      statusResult.fromStatus !== statusResult.toStatus &&
      statusResult.updated.assignedTechnicianId &&
      statusResult.updated.assignedTechnicianId !== user?.id
    ) {
      const linkedScope =
        linkedClientCompanyId ??
        (access.operationCompanyId !== access.ticket.companyId ? access.ticket.companyId : null);

      this.notifications.scheduleTicketStatusAssignee({
        assigneeUserId: statusResult.updated.assignedTechnicianId,
        actorUserId: user?.id ?? null,
        ticketId,
        ticketCompanyId: statusResult.updated.companyId,
        ticketNumber: statusResult.updated.ticketNumber,
        summary: summaryLine,
        fromStatus: statusResult.fromStatus,
        toStatus: statusResult.toStatus,
        linkedClientCompanyId: linkedScope,
        sourceEventId: statusResult.statusEventId,
      });
    }

    if (statusResult.toStatus === TicketStatus.AWAITING_ACCEPTANCE) {
      this.notifications.onTicketAwaitingAcceptance({
        ticketCompanyId: statusResult.updated.companyId,
        actorUserId: user?.id ?? null,
        ticketId,
        ticketNumber: statusResult.updated.ticketNumber,
        sourceEventId: statusResult.readyForAcceptanceEventId,
      });
    }

    if (statusResult.fromStatus !== statusResult.toStatus) {
      if (statusResult.toStatus === TicketStatus.IN_PROGRESS) {
        this.notifications.onTicketInProgress({
          ticketCompanyId: statusResult.updated.companyId,
          actorUserId: user?.id ?? null,
          ticketId,
          ticketNumber: statusResult.updated.ticketNumber,
          summary: summaryLine,
          fromStatus: statusResult.fromStatus,
          sourceEventId: statusResult.statusEventId,
        });
      } else if (statusResult.toStatus === TicketStatus.DONE) {
        this.notifications.onTicketDone({
          ticketCompanyId: statusResult.updated.companyId,
          actorUserId: user?.id ?? null,
          ticketId,
          ticketNumber: statusResult.updated.ticketNumber,
          summary: summaryLine,
          fromStatus: statusResult.fromStatus,
          sourceEventId: statusResult.statusEventId,
        });
      }
    }

    if (statusResult.commentEventId && dto.comment?.trim()) {
      const assignee = statusResult.updated.assignedTechnicianId
        ? await this.prisma.user.findUnique({
            where: { id: statusResult.updated.assignedTechnicianId },
            select: { companyId: true },
          })
        : null;
      this.notifications.scheduleTicketCommentAdded({
        ticketCompanyId: statusResult.updated.companyId,
        ticketId,
        ticketNumber: statusResult.updated.ticketNumber,
        summary: dto.comment.trim(),
        actorUserId: user?.id ?? null,
        assigneeUserId: statusResult.updated.assignedTechnicianId,
        assigneeCompanyId: assignee?.companyId ?? null,
        sourceEventId: statusResult.commentEventId,
      });
    }

    return statusResult.updated;
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

    const result = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, companyId: access.ticket.companyId },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');

      const actorIsExecutor2 = isExecutorCapableRole(role)
        ? (await this.prisma.user.findFirst({ where: { id: user?.id }, select: { isExecutor: true } }))?.isExecutor ?? false
        : false;
      const decision = this.policy.canAddComment({
        user: { id: user?.id, role, isExecutor: actorIsExecutor2, companyId: access.operationCompanyId },
        ticket: { companyId: access.operationCompanyId },
      });
      this.logger.log({
        event: 'comment_add_decision',
        actorUserId: user?.id,
        actorRole: role,
        actorIsExecutor: actorIsExecutor2,
        ticketId,
        allowed: decision.allowed,
        denialReason: decision.allowed ? undefined : (decision as { reason?: string }).reason,
      });
      assertAllowed(decision);

      const commentEvent = await this.timelineService.recordTx(tx, {
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

      return {
        ok: true,
        ticketCompanyId: ticket.companyId,
        ticketNumber: ticket.ticketNumber,
        assignedTechnicianId: ticket.assignedTechnicianId,
        sourceEventId: commentEvent.id,
      };
    });

    const assignee = result.assignedTechnicianId
      ? await this.prisma.user.findUnique({
          where: { id: result.assignedTechnicianId },
          select: { companyId: true },
        })
      : null;
    this.notifications.scheduleTicketCommentAdded({
      ticketCompanyId: result.ticketCompanyId,
      ticketId,
      ticketNumber: result.ticketNumber,
      summary: comment,
      actorUserId: user?.id ?? null,
      assigneeUserId: result.assignedTechnicianId,
      assigneeCompanyId: assignee?.companyId ?? null,
      sourceEventId: result.sourceEventId,
    });

    return { ok: true };
  }
}
