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
import { TicketStatus, UserRole } from '@prisma/client';

import { PERMISSIONS } from '../common/permissions.constants';
import { InspectionService } from '../inspection/inspection.service';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { latestCorrection, resolveEffectiveShiftTime } from '../workforce/workforce-effective-time';
import { WorkforceService } from '../workforce/workforce.service';
import { MaxIdentity } from './max-identity.service';
import { TechnicianShiftSummary } from './max-technician-shift';
import {
  MY_TICKET_PAGE_SIZE,
  TechnicianTicketCardView,
  TechnicianTicketHistoryPage,
  TechnicianTicketListPage,
  toTechnicianTicketCardView,
  toTechnicianTicketHistoryPage,
  toTechnicianTicketListItem,
} from './max-technician-tickets';
import { TechnicianTodaySummary } from './max-technician-today';

const ACTIVE_TICKET_STATUSES = new Set<TicketStatus>([
  TicketStatus.NEW,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
]);

type ResolvedTechnician = Extract<MaxIdentity, { resolved: true }>;

export type WorkplaceOutcome<T> = { ok: true; value: T } | { ok: false; message: string };

@Injectable()
export class MaxTechnicianWorkplaceService {
  private readonly logger = new Logger(MaxTechnicianWorkplaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workforce: WorkforceService,
    @Inject(forwardRef(() => TicketsService)) private readonly tickets: TicketsService,
    @Inject(forwardRef(() => InspectionService)) private readonly inspection: InspectionService,
  ) {}

  async today(identity: ResolvedTechnician): Promise<WorkplaceOutcome<TechnicianTodaySummary>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const state = await this.workforce.getMyState(actor);
      const timezone = state.company.timezone;
      const now = state.serverNow instanceof Date ? state.serverNow : new Date(state.serverNow);
      const { from, to } = zonedDayRange(now, timezone);
      const [tickets, rounds] = await Promise.all([
        this.tickets.list(identity.companyId, identity.userId, UserRole.TECHNICIAN, undefined, actor.accessFlags),
        this.inspection.listRuns({
          id: identity.userId,
          companyId: identity.companyId,
          role: UserRole.TECHNICIAN,
        }),
      ]);

      const mine = (Array.isArray(tickets) ? tickets : []).filter((ticket) => isMineActive(ticket, identity.userId));
      const overdueCount = mine.filter((ticket) => isOverdue(ticket, now)).length;
      const shift = shiftSummary(state, timezone);
      const roundsTodayCount = (Array.isArray(rounds) ? rounds : []).filter((run) =>
        inRange(run.createdAt, from, to),
      ).length;

      return {
        shiftOpen: shift.open,
        shiftOpenedLabel: shift.openedLabel,
        myActiveCount: mine.length,
        overdueCount,
        roundsTodayCount,
      };
    });
  }

  async shift(identity: ResolvedTechnician): Promise<WorkplaceOutcome<TechnicianShiftSummary>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const state = await this.workforce.getMyState(actor);
      return shiftSummary(state, state.company.timezone);
    });
  }

  async openShift(identity: ResolvedTechnician): Promise<WorkplaceOutcome<TechnicianShiftSummary>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const state = await this.workforce.openShift(actor);
      return shiftSummary(state, state.company.timezone);
    });
  }

  async closeShift(identity: ResolvedTechnician): Promise<WorkplaceOutcome<TechnicianShiftSummary>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const state = await this.workforce.closeShift(actor);
      return shiftSummary(state, state.company.timezone);
    });
  }

  async myTickets(
    identity: ResolvedTechnician,
    offset = 0,
  ): Promise<WorkplaceOutcome<TechnicianTicketListPage>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const tickets = await this.tickets.list(
        identity.companyId,
        identity.userId,
        UserRole.TECHNICIAN,
        undefined,
        actor.accessFlags,
      );
      const mine = sortOldestFirst(
        (Array.isArray(tickets) ? tickets : []).filter((ticket) => isMineActive(ticket, identity.userId)),
      );
      const start = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
      const slice = mine.slice(start, start + MY_TICKET_PAGE_SIZE);
      return {
        items: slice
          .map((ticket) => toTechnicianTicketListItem(ticket as Record<string, any>))
          .filter((item): item is NonNullable<typeof item> => item !== null),
        nextOffset: start + MY_TICKET_PAGE_SIZE < mine.length ? start + MY_TICKET_PAGE_SIZE : null,
      };
    });
  }

  async ticketCard(
    identity: ResolvedTechnician,
    ticketId: string,
  ): Promise<WorkplaceOutcome<TechnicianTicketCardView>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      return this.loadCard(identity, actor, ticketId);
    });
  }

  async startMyTicket(
    identity: ResolvedTechnician,
    ticketId: string,
  ): Promise<WorkplaceOutcome<TechnicianTicketCardView>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const before = await this.loadCard(identity, actor, ticketId);
      if (!before.canStart) return before;
      await this.tickets.updateStatus(identity.companyId, actor, UserRole.TECHNICIAN, ticketId, {
        status: TicketStatus.IN_PROGRESS,
      });
      try {
        await this.workforce.startTicketWork(actor, ticketId);
      } catch (err) {
        this.logger.warn({ err }, 'max_bot_work_log_start_failed');
        throw err;
      }
      return this.loadCard(identity, actor, ticketId);
    });
  }

  async changeMyTicketStatus(
    identity: ResolvedTechnician,
    ticketId: string,
    status: TicketStatus,
  ): Promise<WorkplaceOutcome<TechnicianTicketCardView>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const before = await this.loadCard(identity, actor, ticketId);
      if (!before.pickerTransitions.includes(status)) return before;
      try {
        await this.tickets.updateStatus(identity.companyId, actor, UserRole.TECHNICIAN, ticketId, { status });
      } catch (err) {
        if (err instanceof ForbiddenException) return this.loadCard(identity, actor, ticketId);
        throw err;
      }
      return this.loadCard(identity, actor, ticketId);
    });
  }

  async ticketHistory(
    identity: ResolvedTechnician,
    ticketId: string,
    offset = 0,
  ): Promise<WorkplaceOutcome<TechnicianTicketHistoryPage>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const [card, timeline] = await Promise.all([
        this.loadCard(identity, actor, ticketId),
        this.tickets.timeline(
          identity.companyId,
          identity.userId,
          UserRole.TECHNICIAN,
          ticketId,
          actor.accessFlags,
        ),
      ]);
      const entries = Array.isArray((timeline as { timeline?: unknown[] })?.timeline)
        ? ((timeline as { timeline: Record<string, any>[] }).timeline)
        : [];
      return toTechnicianTicketHistoryPage(ticketId, card.ticketNumber, entries, offset);
    });
  }

  async addMyTicketComment(
    identity: ResolvedTechnician,
    ticketId: string,
    comment: string,
  ): Promise<WorkplaceOutcome<{ ticketId: string; ticketNumber: number }>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const card = await this.loadCard(identity, actor, ticketId);
      try {
        await this.tickets.addComment(identity.companyId, actor, UserRole.TECHNICIAN, ticketId, {
          comment,
        });
      } catch (err) {
        if (err instanceof NotFoundException || err instanceof ForbiddenException) {
          throw new NotFoundException('Заявка недоступна');
        }
        throw err;
      }
      return { ticketId, ticketNumber: card.ticketNumber };
    });
  }

  async addMyTicketPhoto(
    identity: ResolvedTechnician,
    ticketId: string,
    file: { buffer: Buffer; size: number; mimetype: string; originalname: string },
  ): Promise<WorkplaceOutcome<{ ticketId: string; ticketNumber: number; count: number }>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const card = await this.loadCard(identity, actor, ticketId);
      try {
        await this.tickets.uploadTicketAttachment(
          identity.companyId,
          identity.userId,
          UserRole.TECHNICIAN,
          ticketId,
          file,
          actor.accessFlags,
        );
      } catch (err) {
        if (err instanceof NotFoundException || err instanceof ForbiddenException) {
          throw new NotFoundException('Заявка недоступна');
        }
        throw err;
      }
      return { ticketId, ticketNumber: card.ticketNumber, count: await this.photoCount(identity, actor, ticketId) };
    });
  }

  async completeMyTicket(
    identity: ResolvedTechnician,
    ticketId: string,
    report: string,
    file?: { buffer: Buffer; size: number; mimetype: string; originalname: string },
  ): Promise<WorkplaceOutcome<TechnicianTicketCardView>> {
    return this.run(async () => {
      const actor = await this.actor(identity);
      const before = await this.loadCard(identity, actor, ticketId);
      if (!before.canComplete) return before;
      if (file) {
        await this.tickets.uploadTicketAttachment(
          identity.companyId,
          identity.userId,
          UserRole.TECHNICIAN,
          ticketId,
          file,
          actor.accessFlags,
        );
      }
      try {
        await this.tickets.updateStatus(identity.companyId, actor, UserRole.TECHNICIAN, ticketId, {
          status: TicketStatus.DONE,
          comment: report,
        });
      } catch (err) {
        if (err instanceof NotFoundException || err instanceof ForbiddenException) {
          throw new NotFoundException('Заявка недоступна');
        }
        throw err;
      }
      try {
        await this.workforce.stopTicketWork(actor, ticketId);
      } catch (err) {
        this.logger.warn({ err }, 'max_bot_work_log_stop_failed');
      }
      return this.loadCard(identity, actor, ticketId);
    });
  }

  private async photoCount(
    identity: ResolvedTechnician,
    actor: { id: string; companyId: string; role: UserRole; accessFlags: Record<string, boolean> },
    ticketId: string,
  ) {
    const rows = await this.tickets.listAttachments(
      identity.companyId,
      identity.userId,
      UserRole.TECHNICIAN,
      ticketId,
      actor.accessFlags,
    );
    return (Array.isArray(rows) ? rows : []).filter((row) => {
      const mime = String((row as { mimeType?: string })?.mimeType || '');
      return mime.startsWith('image/') || mime.startsWith('video/');
    }).length;
  }

  private async loadCard(
    identity: ResolvedTechnician,
    actor: { id: string; companyId: string; role: UserRole; accessFlags: Record<string, boolean> },
    ticketId: string,
  ): Promise<TechnicianTicketCardView> {
    try {
      const ticket = await this.tickets.getOne(
        identity.companyId,
        identity.userId,
        UserRole.TECHNICIAN,
        ticketId,
        actor.accessFlags,
      );
      const card = toTechnicianTicketCardView(ticket as Record<string, any>);
      if (!card) throw new NotFoundException('Заявка недоступна');
      return card;
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof ForbiddenException) {
        throw new NotFoundException('Заявка недоступна');
      }
      throw err;
    }
  }

  private async actor(identity: ResolvedTechnician) {
    return {
      id: identity.userId,
      companyId: identity.companyId,
      role: UserRole.TECHNICIAN,
      accessFlags: await this.accessFlags(identity.userId),
    };
  }

  private async accessFlags(userId: string) {
    const hit = await this.prisma.userPermission.findFirst({
      where: { userId, permissionBlock: { code: PERMISSIONS.TICKETS_VIEW_ALL_COMPANY } },
      select: { permissionBlock: { select: { code: true } } },
    });
    return {
      canTechnicianViewAllCompanyTickets:
        hit?.permissionBlock?.code === PERMISSIONS.TICKETS_VIEW_ALL_COMPANY,
    };
  }

  private async run<T>(work: () => Promise<T>): Promise<WorkplaceOutcome<T>> {
    try {
      return { ok: true, value: await work() };
    } catch (err) {
      this.logger.warn({ err }, 'max_bot_workplace_failed');
      return { ok: false, message: workplaceErrorMessage(err) };
    }
  }
}

function shiftSummary(state: Awaited<ReturnType<WorkforceService['getMyState']>>, timezone?: string | null): TechnicianShiftSummary {
  const shift = state.shift;
  if (!shift) {
    return { open: false, openedLabel: null, locationName: null };
  }
  const correction = latestCorrection(shift.corrections ?? []);
  const effective = resolveEffectiveShiftTime(shift, correction);
  const locationName = state.runningWorkLog?.ticket?.location?.name?.trim() || null;
  return {
    open: true,
    openedLabel: formatShiftInstant(effective.effectiveOpenedAt, timezone),
    locationName,
  };
}

function inRange(value: Date | string | undefined, from: Date, to: Date) {
  if (!value) return false;
  const instant = value instanceof Date ? value : new Date(value);
  return instant >= from && instant <= to;
}

function isMineActive(ticket: { assignedTechnicianId?: string | null; status: TicketStatus }, userId: string) {
  return ticket.assignedTechnicianId === userId && ACTIVE_TICKET_STATUSES.has(ticket.status);
}

function sortOldestFirst<T extends { createdAt?: Date | string }>(rows: T[]) {
  return [...rows].sort((a, b) => createdAtTime(a.createdAt) - createdAtTime(b.createdAt));
}

function createdAtTime(value?: Date | string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isOverdue(ticket: { slaBreachedAt?: Date | null; slaDueAt?: Date | null }, now: Date) {
  if (ticket.slaBreachedAt) return true;
  if (ticket.slaDueAt && new Date(ticket.slaDueAt).getTime() < now.getTime()) return true;
  return false;
}

function workplaceErrorMessage(err: unknown) {
  if (err instanceof BadRequestException) {
    const message = firstHttpMessage(err);
    if (message.includes('without at least 1 work report photo')) return 'Нужно хотя бы одно фото результата';
    if (message.includes('without at least 1 comment')) return 'Нужен хотя бы один комментарий';
    return message || 'Рабочая смена не открыта';
  }
  if (err instanceof HttpException) return firstHttpMessage(err) || 'Не удалось выполнить действие.\nПопробуйте ещё раз через минуту.';
  return 'Не удалось выполнить действие.\nПопробуйте ещё раз через минуту.';
}

function firstHttpMessage(err: HttpException) {
  const response = err.getResponse();
  if (typeof response === 'string') return response;
  if (response && typeof response === 'object' && 'message' in response) {
    const message = (response as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  }
  return err.message;
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

function formatShiftInstant(value: Date, timezone?: string | null) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: safeTimeZone(timezone),
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(value);
}
