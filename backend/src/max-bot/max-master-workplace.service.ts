import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  InspectionRunItemStatus,
  InspectionRunStatus,
  TicketStatus,
  UserRole,
  WorkShiftStatus,
} from '@prisma/client';

import { PERMISSIONS } from '../common/permissions.constants';
import { InspectionScheduleService } from '../inspection/inspection-schedule.service';
import { InspectionService } from '../inspection/inspection.service';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { WorkforceService } from '../workforce/workforce.service';
import { MaxIdentity } from './max-identity.service';
import { MasterBack } from './max-master-actions';
import {
  MasterAssignedView,
  MasterCandidate,
  MasterCandidatePage,
  toMasterCandidatePage,
} from './max-master-assign';
import {
  formatHistoryLine,
  isOverdue,
  isUnassignedNew,
  personName,
  reportStatus,
  sortMaster,
  toListItem,
} from './max-master-map';
import {
  MasterRoundListItem,
  MasterRoundProgress,
  MasterRoundReportView,
  toMasterRoundListPage,
} from './max-master-rounds';
import { MasterTechnicianListItem, toMasterTechnicianPage } from './max-master-technicians';
import {
  MasterAttachmentList,
  MasterHistoryPage,
  MasterTicketCardView,
  MasterTicketFilter,
  MasterTicketListPage,
  toMasterHistoryPage,
  toMasterTicketListPage,
} from './max-master-tickets';
import { formatClock, inRange, zonedDayRange } from './max-master-time';
import { MasterTodaySummary } from './max-master-today';
import { WorkplaceOutcome } from './max-technician-workplace.service';

const ACTIVE = new Set<TicketStatus>([
  TicketStatus.NEW,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
  TicketStatus.AWAITING_ACCEPTANCE,
]);

type ResolvedMaster = Extract<MaxIdentity, { resolved: true }>;
type Actor = { id: string; companyId: string; role: UserRole; accessFlags: Record<string, boolean> };

type AssignmentContext = {
  ticketId: string;
  ticketNumber: number;
  back: MasterBack;
  hasAssignee: boolean;
  assigneeName: string;
  items: MasterCandidate[];
};

@Injectable()
export class MaxMasterWorkplaceService {
  private readonly logger = new Logger(MaxMasterWorkplaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workforce: WorkforceService,
    @Inject(forwardRef(() => TicketsService)) private readonly tickets: TicketsService,
    @Inject(forwardRef(() => InspectionService)) private readonly inspection: InspectionService,
    @Inject(forwardRef(() => InspectionScheduleService)) private readonly schedules: InspectionScheduleService,
  ) {}

  async today(identity: ResolvedMaster): Promise<WorkplaceOutcome<MasterTodaySummary>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const { now, from, to } = await this.dayWindow(actor);
      const [rows, workforce, runs] = await Promise.all([
        this.loadTickets(identity, actor),
        this.workforce.listWorkforce({ actor, from: from.toISOString(), to: to.toISOString() }),
        this.inspection.listRuns(ctx(identity), { from: from.toISOString(), to: to.toISOString() }),
      ]);
      const onShift = (workforce.shifts || []).filter((shift: { status?: string }) => shift.status === WorkShiftStatus.OPEN);
      return {
        newCount: rows.filter((ticket) => ticket.status === TicketStatus.NEW).length,
        unassignedCount: rows.filter(isUnassignedNew).length,
        inProgressCount: rows.filter((ticket) => ticket.status === TicketStatus.IN_PROGRESS).length,
        overdueCount: rows.filter((ticket) => ACTIVE.has(ticket.status) && isOverdue(ticket, now)).length,
        onShiftCount: onShift.length,
        roundsTodayCount: Array.isArray(runs) ? runs.length : 0,
      };
    });
  }

  async listTickets(
    identity: ResolvedMaster,
    filter: MasterTicketFilter,
    offset: number,
  ): Promise<WorkplaceOutcome<MasterTicketListPage>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const { now, timezone } = await this.dayWindow(actor);
      const rows = sortMaster(await this.loadTickets(identity, actor), now).filter((ticket) => {
        if (filter === 'new') return ticket.status === TicketStatus.NEW;
        if (filter === 'work') return ticket.status === TicketStatus.IN_PROGRESS;
        return ACTIVE.has(ticket.status) && isOverdue(ticket, now);
      });
      const title = filter === 'new' ? 'Новые' : filter === 'work' ? 'В работе' : 'Просрочено';
      return toMasterTicketListPage(title, filter, rows.map((ticket) => toListItem(ticket, timezone)), offset);
    });
  }

  async unassigned(identity: ResolvedMaster, offset: number): Promise<WorkplaceOutcome<MasterTicketListPage>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const { now, timezone } = await this.dayWindow(actor);
      const rows = sortMaster(await this.loadTickets(identity, actor), now).filter(isUnassignedNew);
      return toMasterTicketListPage(
        'Без исполнителя',
        'unassigned',
        rows.map((ticket) => toListItem(ticket, timezone)),
        offset,
      );
    });
  }

  async technicianTickets(
    identity: ResolvedMaster,
    userId: string,
    offset: number,
  ): Promise<WorkplaceOutcome<MasterTicketListPage>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const { now, timezone } = await this.dayWindow(actor);
      const rows = sortMaster(await this.loadTickets(identity, actor), now).filter(
        (ticket) => ticket.assignedTechnicianId === userId && ACTIVE.has(ticket.status),
      );
      return toMasterTicketListPage(
        'Заявки техника',
        'tech',
        rows.map((ticket) => toListItem(ticket, timezone)),
        offset,
        userId,
      );
    });
  }

  async card(identity: ResolvedMaster, ticketId: string): Promise<WorkplaceOutcome<MasterTicketCardView>> {
    return this.run(async () => this.loadCard(identity, await this.actor(identity), ticketId));
  }

  async history(identity: ResolvedMaster, ticketId: string, offset: number): Promise<WorkplaceOutcome<MasterHistoryPage>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const ticket = await this.tickets.getOne(
        identity.companyId,
        identity.userId,
        identity.role,
        ticketId,
        actor.accessFlags,
      );
      const entries = await this.tickets.timeline(
        identity.companyId,
        identity.userId,
        identity.role,
        ticketId,
        actor.accessFlags,
      );
      const lines = (Array.isArray(entries) ? entries : []).map(formatHistoryLine).filter(Boolean) as string[];
      return toMasterHistoryPage(ticketId, ticket.ticketNumber, lines, offset);
    });
  }

  async attachments(identity: ResolvedMaster, ticketId: string): Promise<WorkplaceOutcome<MasterAttachmentList>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const ticket = await this.tickets.getOne(
        identity.companyId,
        identity.userId,
        identity.role,
        ticketId,
        actor.accessFlags,
      );
      const rows = await this.tickets.listAttachments(
        identity.companyId,
        identity.userId,
        identity.role,
        ticketId,
        actor.accessFlags,
      );
      const lines = (Array.isArray(rows) ? rows : []).map((row: { originalName?: string; mimeType?: string }) => {
        const name = String(row.originalName || 'файл');
        const mime = String(row.mimeType || '');
        return mime ? `${name} (${mime})` : name;
      });
      return { ticketId, ticketNumber: ticket.ticketNumber, lines };
    });
  }

  async comment(
    identity: ResolvedMaster,
    ticketId: string,
    text: string,
  ): Promise<WorkplaceOutcome<{ ticketNumber: number }>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const ticket = await this.tickets.getOne(
        identity.companyId,
        identity.userId,
        identity.role,
        ticketId,
        actor.accessFlags,
      );
      await this.tickets.addComment(identity.companyId, actor, identity.role, ticketId, { comment: text });
      return { ticketNumber: ticket.ticketNumber };
    });
  }

  async candidates(
    identity: ResolvedMaster,
    ticketId: string,
    offset: number,
    back: MasterBack,
  ): Promise<WorkplaceOutcome<MasterCandidatePage>> {
    return this.run(async () => {
      const loaded = await this.loadAssignment(identity, ticketId, back);
      return toMasterCandidatePage(
        loaded.ticketId,
        loaded.ticketNumber,
        loaded.back,
        loaded.hasAssignee,
        loaded.assigneeName,
        loaded.items,
        offset,
      );
    });
  }

  async findCandidate(
    identity: ResolvedMaster,
    ticketId: string,
    technicianId: string,
    back: MasterBack,
  ): Promise<WorkplaceOutcome<AssignmentContext & { chosen: MasterCandidate }>> {
    return this.run(async () => {
      const loaded = await this.loadAssignment(identity, ticketId, back);
      const chosen = loaded.items.find((item) => item.id === technicianId);
      if (!chosen) throw new BadRequestException('Кандидат недоступен');
      return { ...loaded, chosen };
    });
  }

  async assign(
    identity: ResolvedMaster,
    ticketId: string,
    technicianId: string,
  ): Promise<WorkplaceOutcome<MasterAssignedView>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      await this.tickets.assign(identity.companyId, actor, ticketId, technicianId);
      const ticket = await this.tickets.getOne(
        identity.companyId,
        identity.userId,
        identity.role,
        ticketId,
        actor.accessFlags,
      );
      return {
        ticketId,
        ticketNumber: ticket.ticketNumber,
        technicianName: personName(ticket.assignedTechnician),
      };
    });
  }

  async technicians(identity: ResolvedMaster, offset: number) {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const { from, to, timezone } = await this.dayWindow(actor);
      const [workforce, rows] = await Promise.all([
        this.workforce.listWorkforce({ actor, from: from.toISOString(), to: to.toISOString() }),
        this.loadTickets(identity, actor),
      ]);
      const open = (workforce.shifts || []).filter((shift: any) => shift.status === WorkShiftStatus.OPEN);
      const items: MasterTechnicianListItem[] = open.map((shift: any) => {
        const userId = String(shift.userId);
        return {
          userId,
          name: personName(shift.user),
          openedLabel: formatClock(shift.effective?.effectiveOpenedAt || shift.openedAt, timezone),
          inProgressCount: rows.filter(
            (ticket) => ticket.assignedTechnicianId === userId && ticket.status === TicketStatus.IN_PROGRESS,
          ).length,
          doneTodayCount: rows.filter(
            (ticket) =>
              ticket.assignedTechnicianId === userId &&
              ticket.status === TicketStatus.DONE &&
              inRange(ticket.updatedAt || ticket.createdAt, from, to),
          ).length,
        };
      });
      return toMasterTechnicianPage(items, offset);
    });
  }

  async rounds(identity: ResolvedMaster, offset: number) {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const { from, to, timezone } = await this.dayWindow(actor);
      const user = ctx(identity);
      const [schedules, runs, templates] = await Promise.all([
        this.schedules.list(user, { to: to.toISOString(), active: 'true' }),
        this.inspection.listRuns(user, { from: from.toISOString(), to: to.toISOString(), limit: 200 }),
        this.inspection.listTemplates(user),
      ]);
      const itemCount = new Map<string, number>(
        (Array.isArray(templates) ? templates : []).map((template: { id: string; items?: unknown[] }) => [
          template.id,
          Array.isArray(template.items) ? template.items.length : 0,
        ]),
      );
      const runRows = Array.isArray(runs) ? runs : [];
      const items: MasterRoundListItem[] = (Array.isArray(schedules) ? schedules : []).map((schedule: any) => {
        const run = runRows.find(
          (row: any) =>
            row.id === schedule.lastRunId ||
            (row.location?.id === schedule.location?.id && row.template?.id === schedule.template?.id),
        );
        const total = itemCount.get(schedule.template?.id) ?? run?.summary?.totalItems ?? run?._count?.items ?? 0;
        const closed = run
          ? Number(run.summary?.okCount || 0) +
            Number(run.summary?.issueCount || 0) +
            Number(run.summary?.criticalCount || 0) +
            Number(run.summary?.skippedCount || 0)
          : 0;
        return {
          scheduleId: String(schedule.id),
          runId: run?.id ?? null,
          locationName: String(schedule.location?.name || 'Объект'),
          timeLabel: formatClock(schedule.nextDueAt, timezone),
          technicianName: personName(schedule.assignedTo || run?.performedBy),
          statusLabel: !run ? 'не начат' : run.status === InspectionRunStatus.COMPLETED ? 'завершён' : 'идёт',
          progressLabel: `${closed}/${total}`,
        };
      });
      return toMasterRoundListPage(items, offset);
    });
  }

  async roundProgress(identity: ResolvedMaster, runId: string): Promise<WorkplaceOutcome<MasterRoundProgress>> {
    return this.run(async () => {
      const run = await this.inspection.getRun(ctx(identity), runId);
      const items = Array.isArray(run.items) ? run.items : [];
      const pending = items.find((item: { status?: string }) => item.status === InspectionRunItemStatus.PENDING);
      const closed = items.filter((item: { status?: string }) => item.status !== InspectionRunItemStatus.PENDING).length;
      return {
        runId,
        closedCount: closed,
        totalCount: items.length,
        currentTitle: pending?.title ? String(pending.title) : null,
        technicianName: personName(run.performedBy),
        completed: run.status === InspectionRunStatus.COMPLETED,
      };
    });
  }

  async roundPending(identity: ResolvedMaster, scheduleId: string): Promise<WorkplaceOutcome<{ locationName: string }>> {
    return this.run(async () => {
      const schedule = await this.schedules.get(ctx(identity), scheduleId);
      return { locationName: String(schedule.location?.name || 'Объект') };
    });
  }

  async roundReport(identity: ResolvedMaster, runId: string): Promise<WorkplaceOutcome<MasterRoundReportView>> {
    return this.run(async () => {
      const report = await this.inspection.getRunReport(ctx(identity), runId);
      const items = Array.isArray(report.items) ? report.items : [];
      return {
        runId,
        items: items.map((item: any) => ({
          title: String(item.title || item.templateItem?.title || 'Пункт'),
          status: reportStatus(item.status),
          ticketId: item.ticket?.id ?? item.ticketId ?? null,
          ticketNumber: item.ticket?.ticketNumber ?? null,
        })),
      };
    });
  }

  private async loadAssignment(identity: ResolvedMaster, ticketId: string, back: MasterBack): Promise<AssignmentContext> {
    const actor = await this.actor(identity);
    const { from, to } = await this.dayWindow(actor);
    const [ticket, result, workforce] = await Promise.all([
      this.tickets.getOne(identity.companyId, identity.userId, identity.role, ticketId, actor.accessFlags),
      this.tickets.listAssignmentCandidates(identity.companyId, actor, ticketId),
      this.workforce.listWorkforce({ actor, from: from.toISOString(), to: to.toISOString() }),
    ]);
    const onShift = new Set(
      (workforce.shifts || [])
        .filter((shift: { status?: string; userId?: string }) => shift.status === WorkShiftStatus.OPEN)
        .map((shift: { userId: string }) => shift.userId),
    );
    const matched = Array.isArray(result?.matched) ? result.matched : [];
    const items: MasterCandidate[] = matched.map((row: any) => ({
      id: String(row.id),
      name: personName(row),
      onShift: onShift.has(row.id),
      activeCount: Number(row.activeLoad ?? (row.assignedCount || 0) + (row.inProgressCount || 0)),
      specialization:
        Array.isArray(row.specializations) && row.specializations[0]?.name
          ? String(row.specializations[0].name)
          : 'без специализации',
    }));
    return {
      ticketId,
      ticketNumber: ticket.ticketNumber,
      back,
      hasAssignee: Boolean(ticket.assignedTechnicianId),
      assigneeName: personName(ticket.assignedTechnician),
      items,
    };
  }

  private async loadCard(identity: ResolvedMaster, actor: Actor, ticketId: string): Promise<MasterTicketCardView> {
    const ticket = await this.tickets.getOne(
      identity.companyId,
      identity.userId,
      identity.role,
      ticketId,
      actor.accessFlags,
    );
    const [attachments, source, timeline] = await Promise.all([
      this.tickets.listAttachments(identity.companyId, identity.userId, identity.role, ticketId, actor.accessFlags),
      this.prisma.inspectionRunItem.findFirst({
        where: { ticketId },
        select: { runId: true, title: true, run: { select: { title: true } } },
      }),
      this.tickets.timeline(identity.companyId, identity.userId, identity.role, ticketId, actor.accessFlags),
    ]);
    const terminal = ticket.status === TicketStatus.DONE || ticket.status === TicketStatus.CANCELED;
    const preview = (Array.isArray(timeline) ? timeline : [])
      .map(formatHistoryLine)
      .filter(Boolean)
      .slice(0, 2)
      .join('; ');
    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      locationName: String(ticket.location?.name || 'Без объекта'),
      equipmentName: String(ticket.equipment?.name || 'Нет'),
      sourceLabel: source ? `обход ${source.run?.title || source.title || ''}`.trim() : null,
      sourceRunId: source?.runId ?? null,
      attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
      historyPreview: preview || '',
      canAssign: !terminal,
      hasAssignee: Boolean(ticket.assignedTechnicianId),
    };
  }

  private async loadTickets(identity: ResolvedMaster, actor: Actor) {
    const rows = await this.tickets.list(
      identity.companyId,
      identity.userId,
      identity.role,
      undefined,
      actor.accessFlags,
    );
    return Array.isArray(rows) ? rows : [];
  }

  private async dayWindow(actor: Actor) {
    const state = await this.workforce.getMyState(actor);
    const timezone = state.company.timezone;
    const now = state.serverNow instanceof Date ? state.serverNow : new Date(state.serverNow);
    const { from, to } = zonedDayRange(now, timezone);
    return { now, from, to, timezone };
  }

  private async actor(identity: ResolvedMaster): Promise<Actor> {
    return {
      id: identity.userId,
      companyId: identity.companyId,
      role: identity.role,
      accessFlags: await this.accessFlags(identity.userId),
    };
  }

  private async accessFlags(userId: string) {
    const hit = await this.prisma.userPermission.findFirst({
      where: { userId, permissionBlock: { code: PERMISSIONS.TICKETS_VIEW_ALL_COMPANY } },
      select: { permissionBlock: { select: { code: true } } },
    });
    return {
      canTechnicianViewAllCompanyTickets: hit?.permissionBlock?.code === PERMISSIONS.TICKETS_VIEW_ALL_COMPANY,
    };
  }

  private async run<T>(work: () => Promise<T>): Promise<WorkplaceOutcome<T>> {
    try {
      return { ok: true, value: await work() };
    } catch (err) {
      this.logger.warn({ err }, 'max_bot_master_failed');
      return { ok: false, message: workplaceErrorMessage(err) };
    }
  }
}

function ctx(identity: ResolvedMaster) {
  return { id: identity.userId, companyId: identity.companyId, role: identity.role };
}

function workplaceErrorMessage(err: unknown) {
  if (err instanceof NotFoundException) return 'Заявка недоступна';
  if (err instanceof ForbiddenException || err instanceof BadRequestException || err instanceof HttpException) {
    const response = err.getResponse?.();
    if (typeof response === 'string') return response;
    if (response && typeof response === 'object') {
      const message = (response as { message?: unknown }).message;
      if (typeof message === 'string') return message;
      if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
    }
  }
  return err instanceof Error ? err.message : 'Не удалось выполнить действие.\nПопробуйте ещё раз через минуту.';
}
