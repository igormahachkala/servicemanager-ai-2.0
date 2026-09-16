import { HttpException, Inject, Injectable, Optional, forwardRef } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { InspectionScheduleService } from '../inspection/inspection-schedule.service';
import { TicketsService } from '../tickets/tickets.service';
import { WorkforceService } from '../workforce/workforce.service';
import { extractMaxUserId, MaxIdentity, MaxIdentityService } from './max-identity.service';
import { isChatCallbackPayload, menuMessage, nextPageRows, parseChatPage, sectionMessage } from './max-chat-keyboard';
import { formatRoundCard, formatTicketCard, formatTime, isActiveTicket, pageSlice, sortOldestFirst } from './max-chat-format';
import { buildUnboundMenuModel, normalizeMaxBotUsername, renderMenuMessage } from './max-menu.builder';
import { MaxBotCommandResponse, MaxBotUpdate } from './max-bot.types';

type BoundIdentity = Extract<MaxIdentity, { resolved: true }>;

const MENU_TEXT = `Сервис Менеджер

Выберите действие.`;

const LABEL_TO_PAYLOAD: Record<string, string> = {
  Сегодня: 'today',
  'Мои заявки': 'my',
  Доступные: 'avail',
  Обходы: 'rounds',
  'Моя смена': 'shift',
  'Поиск заявки': 'find',
};

@Injectable()
export class MaxChatService {
  private readonly botUsername = normalizeMaxBotUsername(process.env.MAX_BOT_USERNAME);

  constructor(
    private readonly identity?: MaxIdentityService,
    @Optional() @Inject(forwardRef(() => TicketsService)) private readonly tickets?: TicketsService,
    @Optional() private readonly workforce?: WorkforceService,
    @Optional()
    @Inject(forwardRef(() => InspectionScheduleService))
    private readonly inspection?: InspectionScheduleService,
  ) {}

  async handleMenu(update: MaxBotUpdate): Promise<MaxBotCommandResponse> {
    const identity = await this.resolve(update);
    if (!identity) {
      return renderMenuMessage(buildUnboundMenuModel(), this.botUsername);
    }
    return menuMessage(MENU_TEXT);
  }

  async handleCallback(update: MaxBotUpdate, payload: string): Promise<MaxBotCommandResponse | null> {
    if (!isChatCallbackPayload(payload) && payload !== 'menu') return null;
    if (payload === 'menu') return this.handleMenu(update);
    const identity = await this.resolve(update);
    if (!identity) {
      return renderMenuMessage(buildUnboundMenuModel(), this.botUsername);
    }
    return this.dispatch(identity, payload.trim());
  }

  /**
   * Подписи кнопок MAX type=message приходят текстом.
   * Совпадение с пунктом меню открывает тот же раздел, что и callback.
   */
  matchMenuLabel(text: string): string | null {
    const payload = LABEL_TO_PAYLOAD[text.trim()];
    return payload || null;
  }

  private async dispatch(identity: BoundIdentity, payload: string): Promise<MaxBotCommandResponse> {
    const prefix = payload.split(':')[0];
    if (prefix === 'today') return this.safe(() => this.today(identity));
    if (prefix === 'my') return this.safe(() => this.myTickets(identity, parseChatPage(payload, 'my')));
    if (prefix === 'avail') return this.safe(() => this.availableTickets(identity, parseChatPage(payload, 'avail')));
    if (prefix === 'rounds') return this.safe(() => this.rounds(identity, parseChatPage(payload, 'rounds')));
    if (prefix === 'shift') return this.safe(() => this.shift(identity));
    if (prefix === 'shift_open') return this.safe(() => this.openShift(identity));
    if (prefix === 'shift_close') return this.safe(() => this.closeShift(identity));
    return sectionMessage('Раздел ещё не подключен.');
  }

  private async today(identity: BoundIdentity): Promise<MaxBotCommandResponse> {
    const [shiftState, mine, available, rounds] = await Promise.all([
      this.loadShift(identity),
      this.loadMyTickets(identity),
      this.loadAvailable(identity),
      this.loadRounds(identity),
    ]);
    const shiftLine = shiftState?.shift
      ? `Смена: открыта с ${formatTime(shiftState.shift.openedAt, this.timeZone(shiftState))}`
      : 'Смена: не открыта';
    const text = [
      'Сегодня',
      '',
      shiftLine,
      `Мои заявки: ${mine.length}`,
      `Доступные: ${available.length}`,
      `Обходы: ${rounds.length}`,
    ].join('\n');
    return sectionMessage(text);
  }

  private async myTickets(identity: BoundIdentity, offset: number): Promise<MaxBotCommandResponse> {
    const mine = await this.loadMyTickets(identity);
    if (!mine.length) return sectionMessage('Назначенных заявок нет.');
    const page = pageSlice(mine, offset);
    const text = ['Мои заявки', '', page.slice.map(formatTicketCard).join('\n\n')].join('\n');
    const extra = page.nextOffset != null ? nextPageRows('my', page.nextOffset) : [];
    return sectionMessage(text, extra);
  }

  private async availableTickets(identity: BoundIdentity, offset: number): Promise<MaxBotCommandResponse> {
    const rows = await this.loadAvailable(identity);
    if (!rows.length) return sectionMessage('Доступных заявок нет.');
    const page = pageSlice(rows, offset);
    const text = ['Доступные', '', page.slice.map(formatTicketCard).join('\n\n')].join('\n');
    const extra = page.nextOffset != null ? nextPageRows('avail', page.nextOffset) : [];
    return sectionMessage(text, extra);
  }

  private async rounds(identity: BoundIdentity, offset: number): Promise<MaxBotCommandResponse> {
    const rows = await this.loadRounds(identity);
    if (!rows.length) return sectionMessage('Назначенных обходов нет.');
    const timeZone = this.timeZone(await this.loadShift(identity));
    const page = pageSlice(rows, offset);
    const text = ['Обходы', '', page.slice.map((row) => formatRoundCard(row, timeZone)).join('\n\n')].join('\n');
    const extra = page.nextOffset != null ? nextPageRows('rounds', page.nextOffset) : [];
    return sectionMessage(text, extra);
  }

  private async shift(identity: BoundIdentity): Promise<MaxBotCommandResponse> {
    return this.shiftMessage(await this.loadShift(identity));
  }

  private async openShift(identity: BoundIdentity): Promise<MaxBotCommandResponse> {
    if (!this.workforce) return sectionMessage('Раздел ещё не подключен.');
    return this.shiftMessage(await this.workforce.openShift(this.actor(identity)));
  }

  private async closeShift(identity: BoundIdentity): Promise<MaxBotCommandResponse> {
    if (!this.workforce) return sectionMessage('Раздел ещё не подключен.');
    return this.shiftMessage(await this.workforce.closeShift(this.actor(identity)));
  }

  private shiftMessage(state: ShiftState | null): MaxBotCommandResponse {
    if (!state) return sectionMessage('Не удалось получить смену.');
    const timeZone = this.timeZone(state);
    if (!state.shift) {
      return sectionMessage('Смена не открыта.', [[{ type: 'callback', text: 'Открыть', payload: 'shift_open' }]]);
    }
    const lines = [`Смена открыта с ${formatTime(state.shift.openedAt, timeZone)}`];
    const running = state.runningWorkLog;
    if (running?.ticket?.ticketNumber != null) {
      lines.push(`В работе: №${running.ticket.ticketNumber}`);
    }
    return sectionMessage(lines.join('\n'), [[{ type: 'callback', text: 'Закрыть', payload: 'shift_close' }]]);
  }

  private async loadMyTickets(identity: BoundIdentity): Promise<ChatTicketLike[]> {
    if (!this.tickets) return [];
    const rows = await this.tickets.list(identity.companyId, identity.userId, identity.role);
    return sortOldestFirst(rows.filter((row: ChatTicketLike) => isActiveTicket(row, identity.userId)));
  }

  private async loadAvailable(identity: BoundIdentity): Promise<ChatTicketLike[]> {
    if (!this.tickets) return [];
    try {
      return await this.tickets.availableForTechnician(identity.companyId, identity.userId);
    } catch (err) {
      if (err instanceof HttpException) return [];
      throw err;
    }
  }

  private async loadRounds(identity: BoundIdentity) {
    if (!this.inspection) return [];
    return this.inspection.list(this.actor(identity), { active: 'true' });
  }

  private async loadShift(identity: BoundIdentity): Promise<ShiftState | null> {
    if (!this.workforce) return null;
    return this.workforce.getMyState(this.actor(identity));
  }

  private timeZone(state: ShiftState | null) {
    return state?.company?.timezone || 'Europe/Moscow';
  }

  private actor(identity: BoundIdentity) {
    return { id: identity.userId, companyId: identity.companyId, role: identity.role };
  }

  private async safe(run: () => Promise<MaxBotCommandResponse>): Promise<MaxBotCommandResponse> {
    try {
      return await run();
    } catch (err) {
      return sectionMessage(this.errorText(err));
    }
  }

  private errorText(err: unknown) {
    if (err instanceof HttpException) {
      const response = err.getResponse();
      if (typeof response === 'string' && response.trim()) return response;
      if (response && typeof response === 'object' && 'message' in response) {
        const message = (response as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim()) return message;
        if (Array.isArray(message) && message.length) return message.map(String).join('\n');
      }
    }
    return 'Не удалось выполнить действие.\nПопробуйте ещё раз через минуту.';
  }

  private async resolve(update: MaxBotUpdate) {
    if (!this.identity) return null;
    const identity = await this.identity.resolve(update);
    if (!identity.resolved) return null;
    if (identity.role === UserRole.CLIENT) return null;
    if (!identity.maxUserId) {
      const extracted = extractMaxUserId(update);
      if (!extracted) return identity;
      return { ...identity, maxUserId: extracted };
    }
    return identity;
  }
}

type ChatTicketLike = {
  ticketNumber: number;
  status: string;
  assignedTechnicianId?: string | null;
  location?: { name?: string | null } | null;
  pointName?: string | null;
  problemText?: string | null;
  createdAt?: Date | string;
};

type ShiftState = {
  company?: { timezone?: string | null } | null;
  shift?: { openedAt: Date | string } | null;
  runningWorkLog?: { ticket?: { ticketNumber?: number | null } | null } | null;
};
