import { Injectable, Logger, Optional } from '@nestjs/common';
import { TicketStatus, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { MaxIdentity, MaxIdentityService } from './max-identity.service';
import { MaxMasterCommandService } from './max-master-command.service';
import {
  isMasterMenuRole,
  matchMasterMenuLabel,
  matchMasterSlashCommand,
  renderMasterMenuMessage,
} from './max-master-menu';
import {
  buildUnboundMenuModel,
  isSafeMaxCallbackPayload,
  normalizeMaxBotUsername,
  renderHelpMessage,
  renderLegacyNavigationMessage,
  renderMenuMessage,
  renderPersistentMenuMessage,
} from './max-menu.builder';
import {
  isTechnicianSectionPayload,
  isTechnicianShiftActionPayload,
  matchTechnicianMenuLabel,
  renderBoundRoleStubMessage,
  renderTechnicianMenuMessage,
  renderTechnicianSectionMessage,
  type TechnicianSectionPayload,
  type TechnicianShiftActionPayload,
} from './max-technician-menu';
import { renderCloseShiftConfirmMessage, renderTechnicianShiftMessage } from './max-technician-shift';
import {
  parseTechnicianTicketAction,
  renderTechnicianTicketCardMessage,
  renderTechnicianTicketsListMessage,
  renderTicketHistoryMessage,
  renderTicketStatusPickerMessage,
  renderTicketUnavailableMessage,
  type TechnicianTicketAction,
} from './max-technician-tickets';
import { extractMaxIncomingMedia, MaxFileClient } from './max-file.client';
import { MaxTechnicianDialog } from './max-technician-dialog';
import { renderTechnicianTodayMessage } from './max-technician-today';
import {
  renderAvailableClaimedMessage,
  renderAvailableTakenMessage,
  renderAvailableTicketsMessage,
} from './max-technician-available';
import {
  parseTechnicianRoundAction,
  renderRoundAfterItem,
  renderRoundListMessage,
  renderRoundReportMessage,
  type TechnicianRoundAction,
} from './max-technician-rounds';
import { MaxTechnicianRoundsService } from './max-technician-rounds.service';
import { MaxTechnicianWorkplaceService } from './max-technician-workplace.service';
import { MaxBotCommandResponse, MaxBotUpdate } from './max-bot.types';

const LEGACY_DATA_COMMANDS = new Set(['/tickets', '/ticket', '/open']);

const ACTION_FAILED_TEXT = 'Не удалось выполнить действие.\nПопробуйте ещё раз через минуту.';

type ResolvedTechnician = Extract<MaxIdentity, { resolved: true }>;

@Injectable()
export class MaxBotCommandService {
  private readonly logger = new Logger(MaxBotCommandService.name);
  private readonly botUsername: string;
  private readonly dialog: MaxTechnicianDialog;

  constructor(
    private readonly prisma?: PrismaService,
    private readonly identity?: MaxIdentityService,
    private readonly workplace?: MaxTechnicianWorkplaceService,
    files: MaxFileClient = new MaxFileClient(),
    @Optional() private readonly rounds?: MaxTechnicianRoundsService,
    @Optional() private readonly master?: MaxMasterCommandService,
  ) {
    this.botUsername = normalizeMaxBotUsername(process.env.MAX_BOT_USERNAME);
    this.dialog = new MaxTechnicianDialog(workplace, files, rounds);
  }

  async handleUpdate(update: MaxBotUpdate): Promise<MaxBotCommandResponse | null> {
    const callback = this.extractCallback(update);
    if (callback) {
      return this.handleCallback(update, callback.payload);
    }

    if (this.isBotStarted(update)) {
      this.dialog.clear(update);
      this.master?.clearDialog(update);
      this.logger.log(
        { update_type: this.safeString(update.update_type), source: 'update_type', command: '/start' },
        'max_bot_command_parsed',
      );
      return this.handleParsedCommand('/start', this.menuMessage(update));
    }

    const media = extractMaxIncomingMedia(update);
    const extracted = this.extractMessageText(update);
    if (!extracted && media.length === 0) {
      this.logger.log(
        { update_type: this.safeString(update.update_type), reason: 'missing_message_text' },
        'max_bot_command_ignored',
      );
      return null;
    }

    const trimmed = extracted?.text.trim() ?? '';
    const isCommand = trimmed.startsWith('/');
    const parts = trimmed.split(/\s+/);
    const cmd = isCommand ? parts[0].toLowerCase().split('@')[0] : '';

    this.logger.log(
      {
        update_type: this.safeString(update.update_type),
        source: extracted?.source ?? 'message.media',
        command: isCommand ? cmd : '(text)',
      },
      'max_bot_command_parsed',
    );

    try {
      if (cmd === '/test') {
        return this.handleParsedCommand(cmd, this.testMessage());
      }
      if (!isCommand) {
        const masterSection = matchMasterMenuLabel(trimmed);
        if (masterSection) {
          const master = await this.resolvedMaster(update);
          if (master && this.master) {
            this.dialog.clear(update);
            this.master.clearDialog(update);
            return this.handleParsedCommand(masterSection, this.master.section(master, masterSection));
          }
        }
        const section = matchTechnicianMenuLabel(trimmed);
        if (section) {
          this.dialog.clear(update);
          return this.handleParsedCommand(section, this.technicianSection(update, section));
        }
        const technician = await this.resolvedTechnician(update);
        if (technician && media.length > 0) {
          const mediaReply = await this.dialog.submitMedia(technician, media);
          if (mediaReply) return this.handleParsedCommand('photo', mediaReply);
        }
        const master = await this.resolvedMaster(update);
        if (master && this.master && (trimmed || media.length === 0)) {
          const masterReply = await this.master.submitText(master, trimmed);
          if (masterReply) return this.handleParsedCommand('dialog', masterReply);
        }
        if (technician && (trimmed || media.length === 0)) {
          const textReply = await this.dialog.submitText(technician, trimmed);
          if (textReply) return this.handleParsedCommand('dialog', textReply);
        }
      }
      if (cmd === '/start' || cmd === '/menu') {
        this.dialog.clear(update);
        this.master?.clearDialog(update);
        return this.handleParsedCommand(cmd, this.menuMessage(update));
      }
      if (cmd === '/help') {
        return this.handleParsedCommand(cmd, this.helpMessage());
      }
      if (cmd === '/status') {
        return this.handleParsedCommand(cmd, this.statusMessage());
      }
      const masterSlash = matchMasterSlashCommand(cmd);
      if (masterSlash) {
        const master = await this.resolvedMaster(update);
        if (master && this.master) {
          this.dialog.clear(update);
          this.master.clearDialog(update);
          return this.handleParsedCommand(cmd, this.master.section(master, masterSlash));
        }
      }
      if (LEGACY_DATA_COMMANDS.has(cmd)) {
        this.logger.log({ command: cmd }, 'max_bot_legacy_command_redirected');
        return this.handleParsedCommand(cmd, this.legacyRedirectMessage());
      }
    } catch (err) {
      this.logger.warn({ err, cmd }, 'max_bot_command_error');
      return renderPersistentMenuMessage(ACTION_FAILED_TEXT);
    }

    this.logger.log(
      {
        update_type: this.safeString(update.update_type),
        source: extracted?.source ?? 'message.media',
        reason: isCommand ? 'unknown_command' : 'free_text',
      },
      'max_bot_command_fallback',
    );
    return this.unknownInputMessage();
  }

  private async menuMessage(update: MaxBotUpdate): Promise<MaxBotCommandResponse> {
    if (!this.identity) return renderMenuMessage(buildUnboundMenuModel(), this.botUsername);
    const identity = await this.identity.resolve(update);
    if (!identity.resolved) {
      this.logger.log({ reason: identity.reason }, 'max_bot_identity_unresolved');
      return renderMenuMessage(buildUnboundMenuModel(), this.botUsername);
    }
    this.logger.log({ role: identity.role }, 'max_bot_identity_resolved');
    if (identity.role === UserRole.TECHNICIAN) return renderTechnicianMenuMessage();
    if (isMasterMenuRole(identity.role)) return renderMasterMenuMessage();
    return renderBoundRoleStubMessage();
  }

  private unknownInputMessage(): MaxBotCommandResponse {
    return renderPersistentMenuMessage('Не понял запрос.');
  }

  private helpMessage(): MaxBotCommandResponse {
    return renderHelpMessage(this.botUsername);
  }

  private legacyRedirectMessage(): MaxBotCommandResponse {
    return renderLegacyNavigationMessage(this.botUsername);
  }

  private statusText(): string {
    const now = new Date().toISOString();
    const env = process.env.NODE_ENV || 'production';
    const mode = process.env.MAX_BOT_WEBHOOK_ENABLED === 'true' ? 'webhook' : 'polling';
    return `Сервис Менеджер бот онлайн\nВремя: ${now}\nСреда: ${env}\nРежим: ${mode}`;
  }

  private statusMessage(): MaxBotCommandResponse {
    return renderPersistentMenuMessage(this.statusText());
  }

  private testMessage(): MaxBotCommandResponse {
    return renderPersistentMenuMessage(`Время сервера: ${new Date().toISOString()}`);
  }

  private async handleParsedCommand(
    cmd: string,
    response: MaxBotCommandResponse | Promise<MaxBotCommandResponse>,
  ) {
    this.logger.log({ command: cmd }, 'max_bot_command_handled');
    return response;
  }

  private async handleCallback(update: MaxBotUpdate, payload: string): Promise<MaxBotCommandResponse> {
    const master = await this.resolvedMaster(update);
    if (master && this.master) {
      this.dialog.clear(update);
      if (payload === 'help') return this.helpMessage();
      this.logger.log({ payload }, 'max_bot_callback_handled');
      return this.master.handleCallback(master, update, payload);
    }
    const ticketAction = parseTechnicianTicketAction(payload);
    const roundAction = parseTechnicianRoundAction(payload);
    if (
      (!ticketAction || !this.dialog.keepsWait(ticketAction.kind)) &&
      (!roundAction || !this.dialog.keepsWait(roundAction.kind))
    ) {
      this.dialog.clear(update);
    }
    if (isTechnicianSectionPayload(payload)) {
      return this.technicianSection(update, payload);
    }
    if (isTechnicianShiftActionPayload(payload)) {
      return this.technicianShiftAction(update, payload);
    }
    if (ticketAction) {
      return this.technicianTicketAction(update, ticketAction);
    }
    if (roundAction) {
      return this.technicianRoundAction(update, roundAction);
    }
    if (!isSafeMaxCallbackPayload(payload)) {
      this.logger.log({ payload }, 'max_bot_callback_fallback');
      return this.menuMessage(update);
    }
    this.logger.log({ payload }, 'max_bot_callback_handled');
    return payload === 'help' ? this.helpMessage() : this.menuMessage(update);
  }

  private async technicianSection(
    update: MaxBotUpdate,
    payload: TechnicianSectionPayload,
  ): Promise<MaxBotCommandResponse> {
    const technician = await this.resolvedTechnician(update);
    if (!technician) {
      this.logger.log({ payload }, 'max_bot_callback_fallback');
      return this.menuMessage(update);
    }
    this.logger.log({ payload }, 'max_bot_callback_handled');
    if (payload === 'today') return this.todayMessage(technician);
    if (payload === 'shift') return this.shiftMessage(technician);
    if (payload === 'my') return this.myTicketsMessage(technician, 0);
    if (payload === 'avail') return this.availableTicketsMessage(technician, 0);
    if (payload === 'find') return this.dialog.beginFind(technician);
    if (payload === 'rounds') return this.roundsListMessage(technician, 0);
    return renderTechnicianSectionMessage(payload);
  }

  private async technicianShiftAction(
    update: MaxBotUpdate,
    payload: TechnicianShiftActionPayload,
  ): Promise<MaxBotCommandResponse> {
    const technician = await this.resolvedTechnician(update);
    if (!technician) return this.menuMessage(update);
    this.logger.log({ payload }, 'max_bot_callback_handled');
    if (payload === 'shift_close') return renderCloseShiftConfirmMessage();
    if (payload === 'shift_no') return this.shiftMessage(technician);
    if (payload === 'shift_open') return this.mutateShift(technician, 'open');
    return this.mutateShift(technician, 'close');
  }

  private async technicianTicketAction(
    update: MaxBotUpdate,
    action: TechnicianTicketAction,
  ): Promise<MaxBotCommandResponse> {
    const technician = await this.resolvedTechnician(update);
    if (!technician) return this.menuMessage(update);
    this.logger.log({ payload: action.kind }, 'max_bot_callback_handled');
    if (action.kind === 'list') return this.myTicketsMessage(technician, action.offset);
    if (action.kind === 'availList') return this.availableTicketsMessage(technician, action.offset);
    if (action.kind === 'claim') return this.claimAvailableMessage(technician, action.ticketId);
    if (action.kind === 'findPage') return this.dialog.pageFind(technician, action.offset);
    if (action.kind === 'card') return this.ticketCardMessage(technician, action.ticketId);
    if (action.kind === 'start') return this.startTicketMessage(technician, action.ticketId);
    if (action.kind === 'status') return this.ticketStatusPickerMessage(technician, action.ticketId);
    if (action.kind === 'apply') return this.applyTicketStatusMessage(technician, action.ticketId, action.status);
    if (action.kind === 'history') return this.ticketHistoryMessage(technician, action.ticketId, action.offset);
    if (action.kind === 'comment') return this.dialog.beginComment(technician, action.ticketId);
    if (action.kind === 'photo') return this.dialog.beginPhoto(technician, action.ticketId);
    if (action.kind === 'complete') return this.dialog.beginComplete(technician, action.ticketId);
    if (action.kind === 'completePhoto') return this.dialog.requestCompletePhoto(technician, action.ticketId);
    if (action.kind === 'completeAsk') return this.dialog.backToCompleteAsk(technician, action.ticketId);
    return this.dialog.skipCompletePhoto(technician, action.ticketId);
  }

  private async technicianRoundAction(
    update: MaxBotUpdate,
    action: TechnicianRoundAction,
  ): Promise<MaxBotCommandResponse> {
    const technician = await this.resolvedTechnician(update);
    if (!technician) return this.menuMessage(update);
    this.logger.log({ payload: action.kind }, 'max_bot_callback_handled');
    if (action.kind === 'roundList' || action.kind === 'roundCancel') {
      return this.roundsListMessage(technician, action.kind === 'roundList' ? action.offset : 0);
    }
    if (action.kind === 'roundStart') return this.roundStartMessage(technician, action.scheduleId);
    if (action.kind === 'roundContinue' || action.kind === 'roundItem') {
      return this.roundContinueMessage(technician, action.runId);
    }
    if (action.kind === 'roundOk') return this.roundOkMessage(technician, action.runId);
    if (action.kind === 'roundProblem') return this.dialog.beginRoundIssue(technician, action.runId, 'ISSUE');
    if (action.kind === 'roundCritical') return this.dialog.beginRoundIssue(technician, action.runId, 'CRITICAL');
    if (action.kind === 'roundSkipPhoto') return this.dialog.skipRoundPhoto(technician, action.runId);
    if (action.kind === 'roundCreateTicket') return this.dialog.createRoundTicket(technician, action.runId);
    if (action.kind === 'roundNext') return this.roundNextMessage(technician, action.runId);
    return this.roundReportMessage(technician, action.runId);
  }

  private async roundsListMessage(
    technician: ResolvedTechnician,
    offset: number,
  ): Promise<MaxBotCommandResponse> {
    if (!this.rounds) return renderPersistentMenuMessage(ACTION_FAILED_TEXT);
    const result = await this.rounds.list(technician, offset);
    if (!result.ok) return renderPersistentMenuMessage(result.message);
    return renderRoundListMessage(result.value);
  }

  private async roundStartMessage(technician: ResolvedTechnician, scheduleId: string) {
    if (!this.rounds) return renderPersistentMenuMessage(ACTION_FAILED_TEXT);
    const result = await this.rounds.start(technician, scheduleId);
    if (!result.ok) return renderPersistentMenuMessage(result.message);
    return renderRoundAfterItem(result.value);
  }

  private async roundContinueMessage(technician: ResolvedTechnician, runId: string) {
    if (!this.rounds) return renderPersistentMenuMessage(ACTION_FAILED_TEXT);
    const result = await this.rounds.continueRun(technician, runId);
    if (!result.ok) return renderPersistentMenuMessage(result.message);
    return renderRoundAfterItem(result.value);
  }

  private roundOkMessage(technician: ResolvedTechnician, runId: string) {
    if (!this.rounds) return Promise.resolve(renderPersistentMenuMessage(ACTION_FAILED_TEXT));
    return this.rounds.markOk(technician, runId).then((result) =>
      result.ok ? renderRoundAfterItem(result.value) : renderPersistentMenuMessage(result.message),
    );
  }

  private roundNextMessage(technician: ResolvedTechnician, runId: string) {
    if (!this.rounds) return Promise.resolve(renderPersistentMenuMessage(ACTION_FAILED_TEXT));
    return this.rounds.nextItem(technician, runId).then((result) =>
      result.ok ? renderRoundAfterItem(result.value) : renderPersistentMenuMessage(result.message),
    );
  }

  private async roundReportMessage(technician: ResolvedTechnician, runId: string) {
    if (!this.rounds) return renderPersistentMenuMessage(ACTION_FAILED_TEXT);
    const result = await this.rounds.report(technician, runId);
    if (!result.ok) return renderPersistentMenuMessage(result.message);
    return renderRoundReportMessage(result.value);
  }

  private async myTicketsMessage(
    technician: ResolvedTechnician,
    offset: number,
  ): Promise<MaxBotCommandResponse> {
    if (!this.workplace) return renderPersistentMenuMessage(ACTION_FAILED_TEXT);
    const result = await this.workplace.myTickets(technician, offset);
    if (!result.ok) return renderPersistentMenuMessage(result.message);
    return renderTechnicianTicketsListMessage(result.value);
  }

  private async availableTicketsMessage(
    technician: ResolvedTechnician,
    offset: number,
  ): Promise<MaxBotCommandResponse> {
    if (!this.workplace) return renderPersistentMenuMessage(ACTION_FAILED_TEXT);
    const result = await this.workplace.availableTickets(technician, offset);
    if (!result.ok) return renderPersistentMenuMessage(result.message);
    return renderAvailableTicketsMessage(result.value);
  }

  private async claimAvailableMessage(
    technician: ResolvedTechnician,
    ticketId: string,
  ): Promise<MaxBotCommandResponse> {
    if (!this.workplace) return renderPersistentMenuMessage(ACTION_FAILED_TEXT);
    const result = await this.workplace.claimAvailableTicket(technician, ticketId);
    if (!result.ok) return renderPersistentMenuMessage(result.message);
    if (result.value.kind === 'taken') return renderAvailableTakenMessage(result.value.page);
    return renderAvailableClaimedMessage(result.value.card, renderTechnicianTicketCardMessage(result.value.card));
  }

  private async ticketCardMessage(
    technician: ResolvedTechnician,
    ticketId: string,
  ): Promise<MaxBotCommandResponse> {
    if (!this.workplace) return renderPersistentMenuMessage(ACTION_FAILED_TEXT);
    const result = await this.workplace.ticketCard(technician, ticketId);
    if (!result.ok) {
      return result.message === 'Заявка недоступна'
        ? renderTicketUnavailableMessage()
        : renderPersistentMenuMessage(result.message);
    }
    return renderTechnicianTicketCardMessage(result.value);
  }

  private async startTicketMessage(
    technician: ResolvedTechnician,
    ticketId: string,
  ): Promise<MaxBotCommandResponse> {
    if (!this.workplace) return renderPersistentMenuMessage(ACTION_FAILED_TEXT);
    const result = await this.workplace.startMyTicket(technician, ticketId);
    if (!result.ok) {
      return result.message === 'Заявка недоступна'
        ? renderTicketUnavailableMessage()
        : renderPersistentMenuMessage(result.message);
    }
    return renderTechnicianTicketCardMessage(result.value);
  }

  private async ticketStatusPickerMessage(
    technician: ResolvedTechnician,
    ticketId: string,
  ): Promise<MaxBotCommandResponse> {
    if (!this.workplace) return renderPersistentMenuMessage(ACTION_FAILED_TEXT);
    const result = await this.workplace.ticketCard(technician, ticketId);
    if (!result.ok) {
      return result.message === 'Заявка недоступна'
        ? renderTicketUnavailableMessage()
        : renderPersistentMenuMessage(result.message);
    }
    if (result.value.pickerTransitions.length === 0) {
      return renderTechnicianTicketCardMessage(result.value);
    }
    return renderTicketStatusPickerMessage(result.value);
  }

  private async applyTicketStatusMessage(
    technician: ResolvedTechnician,
    ticketId: string,
    status: TicketStatus,
  ): Promise<MaxBotCommandResponse> {
    if (!this.workplace) return renderPersistentMenuMessage(ACTION_FAILED_TEXT);
    const result = await this.workplace.changeMyTicketStatus(technician, ticketId, status);
    if (!result.ok) {
      return result.message === 'Заявка недоступна'
        ? renderTicketUnavailableMessage()
        : renderPersistentMenuMessage(result.message);
    }
    return renderTechnicianTicketCardMessage(result.value);
  }

  private async ticketHistoryMessage(
    technician: ResolvedTechnician,
    ticketId: string,
    offset: number,
  ): Promise<MaxBotCommandResponse> {
    if (!this.workplace) return renderPersistentMenuMessage(ACTION_FAILED_TEXT);
    const result = await this.workplace.ticketHistory(technician, ticketId, offset);
    if (!result.ok) {
      return result.message === 'Заявка недоступна'
        ? renderTicketUnavailableMessage()
        : renderPersistentMenuMessage(result.message);
    }
    return renderTicketHistoryMessage(result.value);
  }

  private async todayMessage(technician: ResolvedTechnician): Promise<MaxBotCommandResponse> {
    if (!this.workplace) return renderPersistentMenuMessage(ACTION_FAILED_TEXT);
    const result = await this.workplace.today(technician);
    if (!result.ok) return renderPersistentMenuMessage(result.message);
    return renderTechnicianTodayMessage(result.value);
  }

  private async shiftMessage(technician: ResolvedTechnician): Promise<MaxBotCommandResponse> {
    if (!this.workplace) return renderPersistentMenuMessage(ACTION_FAILED_TEXT);
    const result = await this.workplace.shift(technician);
    if (!result.ok) return renderPersistentMenuMessage(result.message);
    return renderTechnicianShiftMessage(result.value);
  }

  private async mutateShift(
    technician: ResolvedTechnician,
    action: 'open' | 'close',
  ): Promise<MaxBotCommandResponse> {
    if (!this.workplace) return renderPersistentMenuMessage(ACTION_FAILED_TEXT);
    const result =
      action === 'open' ? await this.workplace.openShift(technician) : await this.workplace.closeShift(technician);
    if (!result.ok) return renderPersistentMenuMessage(result.message);
    return renderTechnicianShiftMessage(result.value);
  }

  private async resolvedTechnician(update: MaxBotUpdate): Promise<ResolvedTechnician | null> {
    if (!this.identity) return null;
    const identity = await this.identity.resolve(update);
    return identity.resolved && identity.role === UserRole.TECHNICIAN ? identity : null;
  }

  private async resolvedMaster(update: MaxBotUpdate): Promise<ResolvedTechnician | null> {
    if (!this.identity) return null;
    const identity = await this.identity.resolve(update);
    return identity.resolved && isMasterMenuRole(identity.role) ? identity : null;
  }

  private safeString(value: unknown) {
    return typeof value === 'string' ? value : null;
  }

  private isBotStarted(update: MaxBotUpdate) {
    return update.update_type === 'bot_started';
  }

  private extractMessageText(update: MaxBotUpdate): { text: string; source: string } | null {
    const message = update.message;
    if (message && typeof message === 'object') {
      const msg = message as Record<string, unknown>;
      if (typeof msg.text === 'string') return { text: msg.text, source: 'message.text' };
      if (typeof msg.body === 'string') return { text: msg.body, source: 'message.body' };
      if (msg.body && typeof msg.body === 'object') {
        const bodyObj = msg.body as Record<string, unknown>;
        if (typeof bodyObj.text === 'string') return { text: bodyObj.text, source: 'message.body.text' };
      }
    }
    if (typeof update.text === 'string') return { text: update.text, source: 'update.text' };
    return null;
  }

  private extractCallback(update: MaxBotUpdate): { payload: string; source: string } | null {
    const callback = update.callback;
    if (!callback || typeof callback !== 'object') return null;
    const cb = callback as Record<string, unknown>;
    if (typeof cb.payload === 'string') {
      return { payload: cb.payload.trim(), source: 'callback.payload' };
    }
    return null;
  }
}
