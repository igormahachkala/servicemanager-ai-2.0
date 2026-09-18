import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InspectionRunItemStatus, InspectionRunStatus, TicketUrgency, UserRole } from '@prisma/client';

import { InspectionScheduleService } from '../inspection/inspection-schedule.service';
import { InspectionService } from '../inspection/inspection.service';
import { InspectionRunItemStatusDto } from '../inspection/dto/update-run-item.dto';
import { ProblemCategoriesService } from '../problem-categories/problem-categories.service';
import { WorkforceService } from '../workforce/workforce.service';
import { MaxIdentity } from './max-identity.service';
import {
  TechnicianRoundAfterItem,
  TechnicianRoundItemView,
  TechnicianRoundListItem,
  TechnicianRoundListPage,
  TechnicianRoundReportView,
  TechnicianRoundTicketCreatedView,
  toTechnicianRoundListPage,
} from './max-technician-rounds';
import { WorkplaceOutcome } from './max-technician-workplace.service';

type ResolvedTechnician = Extract<MaxIdentity, { resolved: true }>;

type InspectionUser = { id: string; companyId: string; role: UserRole };

@Injectable()
export class MaxTechnicianRoundsService {
  private readonly logger = new Logger(MaxTechnicianRoundsService.name);

  constructor(
    private readonly inspection: InspectionService,
    private readonly schedules: InspectionScheduleService,
    private readonly workforce: WorkforceService,
    private readonly categories: ProblemCategoriesService,
  ) {}

  async list(identity: ResolvedTechnician, offset = 0): Promise<WorkplaceOutcome<TechnicianRoundListPage>> {
    return this.run(async () => toTechnicianRoundListPage(await this.assignedToday(identity), offset));
  }

  async start(identity: ResolvedTechnician, scheduleId: string): Promise<WorkplaceOutcome<TechnicianRoundAfterItem>> {
    return this.run(async () => {
      const user = ctx(identity);
      const schedule = await this.schedules.get(user, scheduleId);
      const existing = (await this.assignedToday(identity)).find((row) => row.scheduleId === schedule.id);
      if (existing?.runId) return this.currentScreen(user, existing.runId);
      const run = await this.inspection.startRun(user, {
        templateId: schedule.template.id,
        locationId: schedule.location.id,
        equipmentId: schedule.equipment?.id,
        title: schedule.name,
      });
      return this.currentScreen(user, run.id);
    });
  }

  async continueRun(identity: ResolvedTechnician, runId: string): Promise<WorkplaceOutcome<TechnicianRoundAfterItem>> {
    return this.run(async () => this.currentScreen(ctx(identity), runId));
  }

  async markOk(identity: ResolvedTechnician, runId: string): Promise<WorkplaceOutcome<TechnicianRoundAfterItem>> {
    return this.run(async () => {
      const user = ctx(identity);
      const pending = await this.requirePending(user, runId);
      await this.inspection.updateRunItem(user, runId, pending.id, { status: InspectionRunItemStatusDto.OK });
      return this.advance(user, runId);
    });
  }

  async attachPhoto(
    identity: ResolvedTechnician,
    runId: string,
    itemId: string,
    file: { buffer: Buffer; size: number; mimetype: string; originalname: string },
  ): Promise<WorkplaceOutcome<true>> {
    return this.run(async () => {
      await this.inspection.uploadRunItemAttachment(ctx(identity), runId, itemId, multerFile(file));
      return true as const;
    });
  }

  async saveIssue(
    identity: ResolvedTechnician,
    runId: string,
    itemId: string,
    status: 'ISSUE' | 'CRITICAL',
    comment: string,
  ): Promise<WorkplaceOutcome<TechnicianRoundAfterItem>> {
    return this.run(async () => {
      const user = ctx(identity);
      await this.inspection.updateRunItem(user, runId, itemId, {
        status: status === 'CRITICAL' ? InspectionRunItemStatusDto.CRITICAL : InspectionRunItemStatusDto.ISSUE,
        requiresRepair: true,
        comment: comment.slice(0, 1000),
      });
      return { kind: 'ticket-prompt' as const, runId, itemId };
    });
  }

  async createTicket(
    identity: ResolvedTechnician,
    runId: string,
    itemId: string,
  ): Promise<WorkplaceOutcome<TechnicianRoundTicketCreatedView>> {
    return this.run(async () => {
      const user = ctx(identity);
      const run = await this.inspection.getRun(user, runId);
      const item = (run.items || []).find((row: { id: string }) => row.id === itemId);
      if (!item) throw new NotFoundException('Inspection run item not found');
      if (item.ticketId && item.ticket?.id) {
        return {
          kind: 'ticket-created' as const,
          runId,
          ticketId: item.ticket.id,
          ticketNumber: item.ticket.ticketNumber,
        };
      }
      const categoryId = await this.firstCategory(identity, run.location?.clientCompanyId);
      if (!categoryId) throw new BadRequestException('Нет категории для заявки');
      const created = await this.inspection.createTicketFromItem(user, runId, itemId, {
        categoryId,
        title: item.title,
        description: item.comment || item.description || item.title,
        urgency: item.status === InspectionRunItemStatus.CRITICAL ? TicketUrgency.URGENT : TicketUrgency.NOT_URGENT,
      });
      return {
        kind: 'ticket-created' as const,
        runId,
        ticketId: created.ticket.id,
        ticketNumber: created.ticket.ticketNumber,
      };
    });
  }

  async nextItem(identity: ResolvedTechnician, runId: string): Promise<WorkplaceOutcome<TechnicianRoundAfterItem>> {
    return this.run(async () => this.advance(ctx(identity), runId));
  }

  async report(
    identity: ResolvedTechnician,
    runId: string,
  ): Promise<WorkplaceOutcome<TechnicianRoundReportView>> {
    return this.run(async () => {
      const report = await this.inspection.getRunReport(ctx(identity), runId);
      return {
        runId,
        items: (report.items || []).map((item: any) => ({
          title: String(item.title || 'Пункт'),
          status: reportStatus(item.status),
          ticketId: item.ticket?.id || item.ticketId || null,
          ticketNumber: item.ticket?.ticketNumber ?? null,
        })),
      };
    });
  }

  async pendingItem(
    identity: ResolvedTechnician,
    runId: string,
  ): Promise<WorkplaceOutcome<TechnicianRoundItemView>> {
    return this.run(async () => {
      const pending = await this.requirePending(ctx(identity), runId);
      const run = await this.inspection.getRun(ctx(identity), runId);
      return toItemView(run, pending);
    });
  }

  private async assignedToday(identity: ResolvedTechnician): Promise<TechnicianRoundListItem[]> {
    const user = ctx(identity);
    const state = await this.workforce.getMyState({
      id: identity.userId,
      companyId: identity.companyId,
      role: UserRole.TECHNICIAN,
      accessFlags: {},
    });
    const timezone = state.company.timezone;
    const now = state.serverNow instanceof Date ? state.serverNow : new Date(state.serverNow);
    const { to } = zonedDayRange(now, timezone);
    const [schedules, runs, templates] = await Promise.all([
      this.schedules.list(user, { to: to.toISOString(), active: 'true' }),
      this.inspection.listRuns(user),
      this.inspection.listTemplates(user),
    ]);
    const itemCountByTemplate = new Map<string, number>(
      (Array.isArray(templates) ? templates : []).map((template: { id: string; items?: unknown[] }) => [
        template.id,
        Array.isArray(template.items) ? template.items.length : 0,
      ]),
    );
    const openRuns = (Array.isArray(runs) ? runs : []).filter(
      (run: { status?: string }) => run.status === InspectionRunStatus.IN_PROGRESS,
    );
    return (Array.isArray(schedules) ? schedules : []).map((schedule: any) => {
      const open = openRuns.find(
        (run: any) =>
          run.id === schedule.lastRunId ||
          (run.location?.id === schedule.location?.id && run.template?.id === schedule.template?.id),
      );
      return {
        scheduleId: schedule.id,
        runId: open?.id ?? null,
        timeLabel: formatClock(schedule.nextDueAt, timezone),
        locationName: String(schedule.location?.name || 'Объект'),
        name: String(schedule.name || schedule.template?.name || 'Обход'),
        itemCount: itemCountByTemplate.get(schedule.template?.id) ?? open?._count?.items ?? 0,
      };
    });
  }

  private async currentScreen(user: InspectionUser, runId: string): Promise<TechnicianRoundAfterItem> {
    const run = await this.inspection.getRun(user, runId);
    const pending = firstPending(run);
    if (!pending) return this.complete(user, runId);
    return { kind: 'item', item: toItemView(run, pending) };
  }

  private async advance(user: InspectionUser, runId: string): Promise<TechnicianRoundAfterItem> {
    return this.currentScreen(user, runId);
  }

  private async complete(user: InspectionUser, runId: string): Promise<TechnicianRoundAfterItem> {
    const run = await this.inspection.getRun(user, runId);
    const finished =
      run.status === InspectionRunStatus.COMPLETED
        ? { run, summary: summaryFromItems(run.items || []) }
        : await this.inspection.completeRun(user, runId);
    const startedAt = new Date(finished.run.createdAt);
    const completedAt = finished.run.completedAt ? new Date(finished.run.completedAt) : new Date();
    return {
      kind: 'brief',
      brief: {
        runId,
        okCount: finished.summary.okCount,
        issueCount: finished.summary.issueCount,
        criticalCount: finished.summary.criticalCount,
        createdTicketsCount: finished.summary.createdTicketsCount,
        durationLabel: formatDuration(startedAt, completedAt),
      },
    };
  }

  private async requirePending(user: InspectionUser, runId: string) {
    const run = await this.inspection.getRun(user, runId);
    const pending = firstPending(run);
    if (!pending) throw new BadRequestException('Нет открытого пункта обхода');
    return pending;
  }

  private async firstCategory(identity: ResolvedTechnician, clientCompanyId?: string | null) {
    const rows = await this.categories.list(
      identity.companyId,
      UserRole.TECHNICIAN,
      identity.userId,
      clientCompanyId || undefined,
    );
    const active = (Array.isArray(rows) ? rows : []).filter((row: { isActive?: boolean }) => row.isActive !== false);
    return active[0]?.id as string | undefined;
  }

  private async run<T>(work: () => Promise<T>): Promise<WorkplaceOutcome<T>> {
    try {
      return { ok: true, value: await work() };
    } catch (err) {
      this.logger.warn({ err }, 'max_bot_rounds_failed');
      return { ok: false, message: roundErrorMessage(err) };
    }
  }
}

function ctx(identity: ResolvedTechnician): InspectionUser {
  return { id: identity.userId, companyId: identity.companyId, role: UserRole.TECHNICIAN };
}

function firstPending(run: { items?: Array<{ id: string; status?: string }> }) {
  return (run.items || []).find((item) => item.status === InspectionRunItemStatus.PENDING) ?? null;
}

function toItemView(run: any, item: any): TechnicianRoundItemView {
  const items = Array.isArray(run.items) ? run.items : [];
  const index = Math.max(1, items.findIndex((row: { id: string }) => row.id === item.id) + 1);
  return {
    runId: run.id,
    itemId: item.id,
    locationName: String(run.location?.name || 'Объект'),
    index,
    total: items.length,
    equipmentName: String(run.equipment?.name || item.zoneName || '—'),
    checkText: String(item.title || 'Проверка'),
    normText: String(item.description || '—'),
  };
}

function summaryFromItems(items: Array<{ status?: string; requiresRepair?: boolean; ticketId?: string | null }>) {
  return {
    okCount: items.filter((item) => item.status === InspectionRunItemStatus.OK).length,
    issueCount: items.filter((item) => item.status === InspectionRunItemStatus.ISSUE).length,
    criticalCount: items.filter((item) => item.status === InspectionRunItemStatus.CRITICAL).length,
    createdTicketsCount: items.filter((item) => !!item.ticketId).length,
  };
}

function reportStatus(status: string): TechnicianRoundReportView['items'][number]['status'] {
  if (status === InspectionRunItemStatus.CRITICAL) return 'critical';
  if (status === InspectionRunItemStatus.ISSUE) return 'issue';
  if (status === InspectionRunItemStatus.SKIPPED) return 'skipped';
  return 'ok';
}

function multerFile(file: { buffer: Buffer; size: number; mimetype: string; originalname: string }) {
  return {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    buffer: file.buffer,
  };
}

function roundErrorMessage(err: unknown) {
  if (err instanceof HttpException) {
    const response = err.getResponse();
    if (typeof response === 'string' && response.trim()) return response;
    if (response && typeof response === 'object' && 'message' in response) {
      const message = (response as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message;
      if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
    }
    if (err.message) return err.message;
  }
  return 'Не удалось выполнить действие.\nПопробуйте ещё раз через минуту.';
}

function formatClock(value: Date | string | undefined, timezone?: string | null) {
  if (!value) return '—';
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: safeTimeZone(timezone),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
}

function formatDuration(from: Date, to: Date) {
  const minutes = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

function safeTimeZone(timezone?: string | null) {
  const candidate = (timezone || '').trim() || 'UTC';
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: candidate });
    return candidate;
  } catch {
    return 'UTC';
  }
}

function zonedDayRange(now: Date, timezone?: string | null) {
  const timeZone = safeTimeZone(timezone);
  const dateKey = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const from = utcInstantForLocal(dateKey, 0, 0, timeZone);
  const to = utcInstantForLocal(dateKey, 23, 59, timeZone);
  to.setSeconds(59, 999);
  return { from, to };
}

function utcInstantForLocal(dateKey: string, hours: number, minutes: number, timeZone: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const naive = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  const first = naive - zoneOffsetMs(new Date(naive), timeZone);
  const second = naive - zoneOffsetMs(new Date(first), timeZone);
  return new Date(second);
}

function zoneOffsetMs(instant: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asIfUtc - instant.getTime();
}
