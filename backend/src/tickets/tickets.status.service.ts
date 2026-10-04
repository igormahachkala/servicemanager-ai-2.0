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
import { ShiftPolicyService } from '../workforce/shift-policy.service';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { resolveTicketOperationAccess } from './ticket-access.utils';

function uniqueNonEmpty(values?: Array<string | null | undefined>) {
  return Array.from(
    new Set((values ?? []).map((value) => (value ?? '').trim()).filter((value) => value.length > 0)),
  )
}

@Injectable()
export class TicketsStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timelineService: TimelineService,
    private readonly serviceContractsService: ServiceContractsService,
    private readonly notifications: NotificationsService,
    private readonly shiftPolicyService?: ShiftPolicyService,
    /** 113B: optional so existing unit tests constructing this service directly keep working. */
    private readonly idempotency?: IdempotencyService,
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

    return tx.ticketStatusHistory.create({
      data: {
        ticketId,
        fromStatus,
        toStatus,
        comment: comment ?? null,
        changedByUserId: changedByUserId ?? null,
      },
    });
  }

  async submitAcceptance(
    companyId: string,
    user: { id?: string } | any,
    role: UserRole,
    ticketId: string,
    dto: { failureCauseId: string; comment?: string; attachmentIds?: string[] },
    linkedClientCompanyId?: string,
    idempotencyKey?: string | null,
  ) {
    await this.assertExecutorOperationsAllowed(companyId);
    const failureCauseId = (dto.failureCauseId ?? '').trim();
    if (!failureCauseId) {
      throw new BadRequestException('failureCauseId is required');
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

    const comment = (dto.comment ?? '').trim();
    const attachmentIds = uniqueNonEmpty(dto.attachmentIds);

    const key = IdempotencyService.normalizeKey(idempotencyKey);
    if (key && this.idempotency && user?.id) {
      const fingerprint = IdempotencyService.fingerprint({
        ticketId,
        failureCauseId,
        comment,
        attachmentIds,
      });
      const outcome = await this.idempotency.run<any>(
        { companyId, userId: user.id, operationType: 'ticket_submit_acceptance', key },
        fingerprint,
        {
          execute: async () => {
            const result = await this.submitAcceptanceInternal({
              companyId,
              user,
              role,
              ticketId,
              failureCauseId,
              comment,
              attachmentIds,
              linkedClientCompanyId,
              access,
            });
            return {
              result: result.updated,
              entityType: 'TicketStatusHistory',
              entityId: result.historyId,
            };
          },
          replay: async (historyId) => {
            const history = await this.prisma.ticketStatusHistory.findUnique({
              where: { id: historyId },
              select: { id: true, ticketId: true, toStatus: true },
            });
            if (!history || history.ticketId !== ticketId || history.toStatus !== TicketStatus.AWAITING_ACCEPTANCE) {
              return null;
            }
            return this.prisma.ticket.findFirst({
              where: { id: ticketId, companyId: access.ticket.companyId },
            });
          },
        },
      );
      return outcome.result;
    }

    const result = await this.submitAcceptanceInternal({
      companyId,
      user,
      role,
      ticketId,
      failureCauseId,
      comment,
      attachmentIds,
      linkedClientCompanyId,
      access,
    });
    return result.updated;
  }

  private async submitAcceptanceInternal(params: {
    companyId: string;
    user: { id?: string } | any;
    role: UserRole;
    ticketId: string;
    failureCauseId: string;
    comment: string;
    attachmentIds: string[];
    linkedClientCompanyId?: string;
    access: Awaited<ReturnType<typeof resolveTicketOperationAccess>>;
  }) {
    const { companyId, user, role, ticketId, failureCauseId, comment, attachmentIds, access } = params;

    // Atomicity boundary is the database transaction below. Access resolution
    // follows the existing ticket pattern before it; notifications are emitted
    // after commit and must not be treated as rollback-protected DB mutations.
    const statusResult = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, companyId: access.ticket.companyId },
      });
      if (!ticket) throw new NotFoundException('Ticket not found');

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
        event: 'executor_submit_acceptance_decision',
        actorUserId: user?.id,
        actorRole: role,
        actorIsExecutor,
        ticketId,
        allowed: decision.allowed,
        denialReason: decision.allowed ? undefined : (decision as { reason?: string }).reason,
      });
      assertAllowed(decision);

      await this.shiftPolicyService?.assertActiveShiftForOperationalWork({
        id: user?.id ?? '',
        role,
        companyId,
      });

      const fromStatus = ticket.status;
      const toStatus = TicketStatus.AWAITING_ACCEPTANCE;
      const wf = decideTicketTransition(fromStatus, toStatus);
      if (!wf.allowed) throw new BadRequestException(wf.reason);

      const failureCause = await tx.failureCause.findFirst({
        where: {
          id: failureCauseId,
          companyId: ticket.companyId,
          active: true,
        },
        select: { id: true, name: true },
      });
      if (!failureCause) {
        throw new BadRequestException('Failure cause is not available for this ticket');
      }

      if (attachmentIds.length > 0) {
        const allowedCompanyIds = Array.from(new Set([ticket.companyId, companyId].filter(Boolean)));
        const attachments = await tx.ticketAttachment.findMany({
          where: {
            id: { in: attachmentIds },
            companyId: { in: allowedCompanyIds },
          },
          select: {
            id: true,
            ticketId: true,
            companyId: true,
            uploadedByUserId: true,
          },
        });

        const safeAttachments = attachments.filter((attachment) => {
          if (attachment.companyId === ticket.companyId && attachment.ticketId === ticketId) return true;
          return (
            attachment.ticketId === null &&
            !!user?.id &&
            attachment.uploadedByUserId === user.id &&
            (attachment.companyId === ticket.companyId || attachment.companyId === companyId)
          );
        });

        if (safeAttachments.length !== attachmentIds.length) {
          throw new BadRequestException('Some attachmentIds are invalid');
        }

        await tx.ticketAttachment.updateMany({
          where: { id: { in: safeAttachments.map((attachment) => attachment.id) } },
          data: {
            ticketId,
            companyId: ticket.companyId,
            purpose: TicketAttachmentPurpose.WORK_REPORT,
          },
        });
      }

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

      if (!comment && commentEventCount === 0) {
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

      const now = new Date();
      const shouldMarkBreached = ticket.slaDueAt && !ticket.slaBreachedAt && now > ticket.slaDueAt;
      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: {
          status: toStatus,
          statusUpdatedAt: now,
          slaBreachedAt: shouldMarkBreached ? now : ticket.slaBreachedAt,
          closedAt: ticket.closedAt,
        },
      });

      const history = await this.writeStatusHistoryTx(tx, {
        ticketId,
        fromStatus,
        toStatus,
        changedByUserId: user?.id ?? null,
        comment: comment || null,
      });

      const assessment = await tx.ticketFailureCauseAssessment.create({
        data: {
          companyId: ticket.companyId,
          ticketId,
          ticketStatusHistoryId: history.id,
          failureCauseId: failureCause.id,
          failureCauseNameSnapshot: failureCause.name,
          actorUserId: user?.id ?? null,
        },
      });

      const statusEvent = await this.timelineService.recordTx(tx, {
        event: 'STATUS_CHANGED',
        companyId: ticket.companyId,
        ticketId,
        actorUserId: user?.id ?? null,
        payload: {
          fromStatus,
          toStatus,
          comment: comment || null,
          slaBreachedMarked: shouldMarkBreached,
          failureCauseId: failureCause.id,
          failureCauseNameSnapshot: failureCause.name,
          ticketStatusHistoryId: history.id,
          failureCauseAssessmentId: assessment.id,
        },
      });

      const commentEvent = comment
        ? await this.timelineService.recordTx(tx, {
          event: 'COMMENT_ADDED',
          companyId: ticket.companyId,
          ticketId,
          actorUserId: user?.id ?? null,
          payload: {
            comment,
            fromStatus,
            toStatus,
            source: 'submit_acceptance',
          },
        })
        : null;

      const readyEv = await this.timelineService.recordTx(tx, {
        event: 'TICKET_READY_FOR_ACCEPTANCE',
        companyId: ticket.companyId,
        ticketId,
        actorUserId: user?.id ?? null,
        payload: {
          fromStatus,
          toStatus,
          failureCauseId: failureCause.id,
          failureCauseNameSnapshot: failureCause.name,
          ticketStatusHistoryId: history.id,
          failureCauseAssessmentId: assessment.id,
        },
      });

      return {
        updated,
        fromStatus,
        toStatus,
        statusEventId: statusEvent.id,
        commentEventId: commentEvent?.id ?? null,
        readyForAcceptanceEventId: readyEv.id,
        historyId: history.id,
      };
    });

    const summaryParts = [comment, (statusResult.updated.problemText || '').trim()].filter(Boolean);
    const summaryClip = (summaryParts[0] || summaryParts[1] || '').slice(0, 200);
    const summaryLine = summaryClip || `Заявка #${statusResult.updated.ticketNumber}`;

    this.notifications.scheduleTicketStatusChanged({
      ticketCompanyId: statusResult.updated.companyId,
      locationId: statusResult.updated.locationId,
      ticketId,
      ticketNumber: statusResult.updated.ticketNumber,
      fromStatus: statusResult.fromStatus,
      toStatus: statusResult.toStatus,
      sourceEventId: statusResult.statusEventId,
    });

    if (
      statusResult.updated.assignedTechnicianId &&
      statusResult.updated.assignedTechnicianId !== user?.id
    ) {
      const linkedScope =
        params.linkedClientCompanyId ??
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

    this.notifications.onTicketAwaitingAcceptance({
      ticketCompanyId: statusResult.updated.companyId,
      actorUserId: user?.id ?? null,
      ticketId,
      ticketNumber: statusResult.updated.ticketNumber,
      sourceEventId: statusResult.readyForAcceptanceEventId,
    });

    if (statusResult.commentEventId && comment) {
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
        summary: comment,
        actorUserId: user?.id ?? null,
        assigneeUserId: statusResult.updated.assignedTechnicianId,
        assigneeCompanyId: assignee?.companyId ?? null,
        sourceEventId: statusResult.commentEventId,
      });
    }

    return statusResult;
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

      await this.shiftPolicyService?.assertActiveShiftForOperationalWork({
        id: user?.id ?? '',
        role,
        companyId,
      });

      const toStatus =
        dto.status === TicketStatus.DONE && ticket.status !== TicketStatus.AWAITING_ACCEPTANCE
          ? TicketStatus.AWAITING_ACCEPTANCE
          : dto.status;
      const fromStatus = ticket.status;

      if (toStatus === TicketStatus.AWAITING_ACCEPTANCE) {
        throw new BadRequestException('Failure cause is required; use submit-acceptance endpoint');
      }

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

      return { updated, fromStatus, toStatus, statusEventId: statusEvent.id, commentEventId: commentEvent?.id ?? null };
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
    dto: { comment: string; replyToId?: string },
    linkedClientCompanyId?: string,
    idempotencyKey?: string | null,
  ) {
    const comment = (dto.comment || '').trim();
    if (!comment) {
      throw new BadRequestException('comment is required');
    }
    const replyToId = (dto.replyToId || '').trim() || null;

    /**
     * SMA-OFFLINE-IDEMPOTENCY-113B — an offline queue may replay this after a lost response.
     *
     * Access resolution below still runs on every call, replay included: the key proves the
     * client asked before, not that it may still act. Without a key the endpoint behaves
     * exactly as it did, so online callers are unaffected.
     */
    const key = IdempotencyService.normalizeKey(idempotencyKey);
    if (key && this.idempotency && user?.id) {
      /**
       * 120K: replyToId входит в отпечаток. Иначе повтор того же ключа с другой
       * целью ответа вернул бы прежний комментарий как свой, и связь оказалась
       * бы не той, о которой просил клиент. Канонический механизм на такое
       * расхождение отвечает конфликтом — это и нужно.
       */
      const fingerprint = IdempotencyService.fingerprint({ ticketId, comment, replyToId });
      const outcome = await this.idempotency.run<{ ok: boolean }>(
        { companyId, userId: user.id, operationType: 'ticket_comment', key },
        fingerprint,
        {
          execute: async () => {
            const created = await this.addCommentInternal(
              companyId, user, role, ticketId, comment, linkedClientCompanyId, replyToId,
            );
            return { result: { ok: true }, entityType: 'DomainEvent', entityId: created.sourceEventId };
          },
          // The comment lives in the timeline; its event id proves the first call landed.
          replay: async (entityId) => {
            const event = await this.prisma.domainEvent.findUnique({ where: { id: entityId }, select: { id: true } });
            return event ? { ok: true } : null;
          },
        },
      );
      return outcome.result;
    }

    return this.addCommentInternal(
      companyId, user, role, ticketId, comment, linkedClientCompanyId, replyToId,
    ).then(() => ({ ok: true }));
  }

  private async addCommentInternal(
    companyId: string,
    user: { id?: string } | any,
    role: UserRole,
    ticketId: string,
    comment: string,
    linkedClientCompanyId?: string,
    replyToId?: string | null,
  ) {

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

      /**
       * SMA-TICKET-REPLY-V1-BACKEND-FOUNDATION-120H — цель ответа.
       *
       * Проверяется последней: доступ к заявке уже разрешён выше
       * (resolveTicketOperationAccess), право комментировать — строкой выше.
       * Порядок именно такой, потому что отказ доступа не должен ничего
       * сообщать о существовании сообщений: актор без доступа к заявке
       * и актор с подложным replyToId получают один и тот же ответ.
       *
       * Выборка сужена тремя условиями сразу, и ни одно из них не приходит
       * от клиента: ticketId — путь запроса, companyId — компания заявки,
       * разрешённая сервером. Ответ на сообщение другой заявки или другого
       * арендатора поэтому просто не находится.
       */
      let replyTo: { id: string } | null = null;
      if (replyToId) {
        replyTo = await tx.ticketComment.findFirst({
          where: { id: replyToId, ticketId, companyId: ticket.companyId },
          select: { id: true },
        });
        if (!replyTo) throw new NotFoundException('Reply target not found');
      }

      /**
       * Сам комментарий как предмет предметной области. DomainEvent ниже
       * остаётся журналом и пишется по-прежнему: ничего из прежнего чтения
       * ленты не сломано, историю не переносим.
       */
      const storedComment = await tx.ticketComment.create({
        data: {
          companyId: ticket.companyId,
          ticketId,
          authorUserId: user?.id ?? null,
          body: comment,
          replyToId: replyTo?.id ?? null,
        },
        select: { id: true },
      });

      /**
       * SMA-TICKET-REPLY-READ-PATH-120R — порядок здесь важен.
       *
       * Комментарий создаётся раньше события, чтобы событие несло его
       * идентификатор. Это единственная надёжная связка между журналом
       * и строкой комментария: внешнего ключа у DomainEvent нет вовсе,
       * а сопоставлять по времени, автору и тексту — угадывание, которое
       * ошибётся на двух одинаковых сообщениях в одну секунду.
       *
       * Старые события такого поля не имеют, и это ровно то, что нужно:
       * у исторического комментария идентификатора нет, ответить на него
       * нельзя, и переносить историю не приходится.
       */
      const commentEvent = await this.timelineService.recordTx(tx, {
        event: 'COMMENT_ADDED',
        companyId: ticket.companyId,
        ticketId,
        actorUserId: user?.id ?? null,
        payload: {
          comment,
          source: 'manual_comment',
          commentId: storedComment.id,
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
        commentId: storedComment.id,
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

    return { sourceEventId: result.sourceEventId, commentId: result.commentId };
  }
}
