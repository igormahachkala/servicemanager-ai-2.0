import { Injectable, Optional } from '@nestjs/common';

import { MaxIdentity } from './max-identity.service';
import { MaxBotCommandResponse, MaxBotUpdate } from './max-bot.types';
import { keepsMasterWait, parseMasterAction, type MasterAction } from './max-master-actions';
import {
  renderMasterAssignedMessage,
  renderMasterCandidatesMessage,
  renderMasterReassignConfirm,
} from './max-master-assign';
import { MaxMasterDialog } from './max-master-dialog';
import { isMasterSectionPayload, renderMasterMenuMessage, renderMasterUnavailableMessage, type MasterSectionPayload } from './max-master-menu';
import {
  renderMasterRoundListMessage,
  renderMasterRoundNotStartedMessage,
  renderMasterRoundProgressMessage,
  renderMasterRoundReportMessage,
} from './max-master-rounds';
import { renderMasterTechniciansMessage } from './max-master-technicians';
import {
  renderMasterAttachmentsMessage,
  renderMasterHistoryMessage,
  renderMasterTicketCardMessage,
  renderMasterTicketFilterMessage,
  renderMasterTicketListMessage,
} from './max-master-tickets';
import { renderMasterTodayMessage } from './max-master-today';
import { MaxMasterWorkplaceService } from './max-master-workplace.service';
import { renderPersistentMenuMessage } from './max-menu.builder';
import { WorkplaceOutcome } from './max-technician-workplace.service';

type ResolvedMaster = Extract<MaxIdentity, { resolved: true }>;

const FAILED = 'Не удалось выполнить действие.\nПопробуйте ещё раз через минуту.';

@Injectable()
export class MaxMasterCommandService {
  private readonly dialog: MaxMasterDialog;

  constructor(@Optional() private readonly workplace?: MaxMasterWorkplaceService) {
    this.dialog = new MaxMasterDialog(workplace);
  }

  clearDialog(update: MaxBotUpdate) {
    this.dialog.clear(update);
  }

  submitText(identity: ResolvedMaster, text: string) {
    return this.dialog.submitText(identity, text);
  }

  async handleCallback(
    identity: ResolvedMaster,
    update: MaxBotUpdate,
    payload: string,
  ): Promise<MaxBotCommandResponse> {
    const action = parseMasterAction(payload);
    if (!action || !keepsMasterWait(action.kind)) this.dialog.clear(update);
    if (isMasterSectionPayload(payload)) return this.section(identity, payload);
    if (action) return this.action(identity, action);
    return renderMasterMenuMessage();
  }

  async section(identity: ResolvedMaster, payload: MasterSectionPayload): Promise<MaxBotCommandResponse> {
    if (!this.workplace) return renderPersistentMenuMessage(FAILED);
    if (payload === 'today') return this.today(identity);
    if (payload === 'tickets') return renderMasterTicketFilterMessage();
    if (payload === 'unassigned') return this.reply(await this.workplace.unassigned(identity, 0), renderMasterTicketListMessage);
    if (payload === 'techs') return this.reply(await this.workplace.technicians(identity, 0), renderMasterTechniciansMessage);
    if (payload === 'rounds') return this.reply(await this.workplace.rounds(identity, 0), renderMasterRoundListMessage);
    return this.reply(await this.workplace.listTickets(identity, 'sla', 0), renderMasterTicketListMessage);
  }

  private async action(identity: ResolvedMaster, action: MasterAction): Promise<MaxBotCommandResponse> {
    if (!this.workplace) return renderPersistentMenuMessage(FAILED);
    if (action.kind === 'filter' || action.kind === 'list') {
      const filter = action.filter;
      const offset = action.kind === 'list' ? action.offset : 0;
      return this.reply(await this.workplace.listTickets(identity, filter, offset), renderMasterTicketListMessage);
    }
    if (action.kind === 'unassigned') {
      return this.reply(await this.workplace.unassigned(identity, action.offset), renderMasterTicketListMessage);
    }
    if (action.kind === 'card') return this.card(identity, action.ticketId);
    if (action.kind === 'comment') {
      const card = await this.workplace.card(identity, action.ticketId);
      if (!card.ok) return fail(card.message);
      return this.dialog.beginComment(identity, action.ticketId, card.value.ticketNumber, action.mention);
    }
    if (action.kind === 'attachments') {
      return this.reply(await this.workplace.attachments(identity, action.ticketId), renderMasterAttachmentsMessage);
    }
    if (action.kind === 'history') {
      return this.reply(await this.workplace.history(identity, action.ticketId, action.offset), renderMasterHistoryMessage);
    }
    if (action.kind === 'candidates' || action.kind === 'assign') {
      const offset = action.kind === 'candidates' ? action.offset : 0;
      return this.reply(
        await this.workplace.candidates(identity, action.ticketId, offset, action.back),
        renderMasterCandidatesMessage,
      );
    }
    if (action.kind === 'pick') {
      const found = await this.workplace.findCandidate(identity, action.ticketId, action.technicianId, action.back);
      if (!found.ok) return fail(found.message);
      if (found.value.hasAssignee) {
        return renderMasterReassignConfirm(
          action.ticketId,
          found.value.ticketNumber,
          found.value.assigneeName || 'текущего',
          action.technicianId,
          found.value.chosen.name,
          action.back,
        );
      }
      return this.assign(identity, action.ticketId, action.technicianId);
    }
    if (action.kind === 'assignYes') return this.assign(identity, action.ticketId, action.technicianId);
    if (action.kind === 'techList') {
      return this.reply(await this.workplace.technicians(identity, action.offset), renderMasterTechniciansMessage);
    }
    if (action.kind === 'techTickets') {
      return this.reply(
        await this.workplace.technicianTickets(identity, action.userId, action.offset),
        renderMasterTicketListMessage,
      );
    }
    if (action.kind === 'roundList') {
      return this.reply(await this.workplace.rounds(identity, action.offset), renderMasterRoundListMessage);
    }
    if (action.kind === 'roundPending') {
      const result = await this.workplace.roundPending(identity, action.scheduleId);
      if (!result.ok) return fail(result.message);
      return renderMasterRoundNotStartedMessage(result.value.locationName);
    }
    if (action.kind === 'roundProgress') {
      const result = await this.workplace.roundProgress(identity, action.runId);
      if (!result.ok) return fail(result.message);
      return renderMasterRoundProgressMessage(result.value);
    }
    const report = await this.workplace.roundReport(identity, action.runId);
    if (!report.ok) return fail(report.message);
    return renderMasterRoundReportMessage(report.value);
  }

  private async today(identity: ResolvedMaster) {
    if (!this.workplace) return renderPersistentMenuMessage(FAILED);
    const result = await this.workplace.today(identity);
    if (!result.ok) return fail(result.message);
    return renderMasterTodayMessage(result.value);
  }

  private async card(identity: ResolvedMaster, ticketId: string) {
    if (!this.workplace) return renderPersistentMenuMessage(FAILED);
    const result = await this.workplace.card(identity, ticketId);
    if (!result.ok) return fail(result.message);
    return renderMasterTicketCardMessage(result.value);
  }

  private async assign(identity: ResolvedMaster, ticketId: string, technicianId: string) {
    if (!this.workplace) return renderPersistentMenuMessage(FAILED);
    const result = await this.workplace.assign(identity, ticketId, technicianId);
    if (!result.ok) return fail(result.message);
    return renderMasterAssignedMessage(result.value);
  }

  private reply<T>(result: WorkplaceOutcome<T>, render: (value: T) => MaxBotCommandResponse): MaxBotCommandResponse {
    return result.ok ? render(result.value) : fail(result.message);
  }
}

function fail(message: string) {
  return message === 'Заявка недоступна'
    ? renderMasterUnavailableMessage()
    : renderPersistentMenuMessage(message || FAILED);
}
