import { Injectable, Optional } from '@nestjs/common';

import { MaxIdentity } from './max-identity.service';
import { MaxBotCommandResponse, MaxBotUpdate } from './max-bot.types';
import { keepsMasterWait, parseMasterAction, type MasterAction } from './max-master-actions';
import {
  renderMasterAssignedMessage,
  renderMasterCandidatesMessage,
  renderMasterReassignConfirm,
} from './max-master-assign';
import {
  getMasterLinkedClient,
  renderMasterClientPickerMessage,
  renderMasterNoLinkedClientsMessage,
  setMasterLinkedClient,
  toMasterClientPickerPage,
  type MasterLinkedClient,
} from './max-master-client-scope';
import { MaxMasterDialog } from './max-master-dialog';
import {
  isMasterSectionPayload,
  renderMasterMenuMessage,
  renderMasterUnavailableMessage,
  type MasterSectionPayload,
} from './max-master-menu';
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

  async entryMenu(identity: ResolvedMaster): Promise<MaxBotCommandResponse> {
    if (!this.workplace) return renderPersistentMenuMessage(FAILED);
    const clients = await this.loadClients(identity);
    if (clients === null) return renderPersistentMenuMessage(FAILED);
    if (clients.length === 0) return renderMasterNoLinkedClientsMessage();
    if (clients.length === 1) {
      setMasterLinkedClient(identity.maxUserId, clients[0].id);
      return renderMasterMenuMessage({ showChangeClient: false });
    }
    const selected = getMasterLinkedClient(identity.maxUserId);
    if (selected && clients.some((item) => item.id === selected)) {
      return renderMasterMenuMessage({ showChangeClient: true });
    }
    return renderMasterClientPickerMessage(toMasterClientPickerPage(clients, 0, selected));
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
    return this.entryMenu(identity);
  }

  async section(identity: ResolvedMaster, payload: MasterSectionPayload): Promise<MaxBotCommandResponse> {
    if (!this.workplace) return renderPersistentMenuMessage(FAILED);
    if (payload === 'rounds') {
      return this.reply(await this.workplace.rounds(identity, 0), renderMasterRoundListMessage);
    }
    const linked = await this.requireClient(identity);
    if (typeof linked !== 'string') return linked;
    if (payload === 'today') return this.today(identity, linked);
    if (payload === 'tickets') return renderMasterTicketFilterMessage();
    if (payload === 'unassigned') {
      return this.reply(await this.workplace.unassigned(identity, 0, linked), renderMasterTicketListMessage);
    }
    if (payload === 'techs') {
      return this.reply(await this.workplace.technicians(identity, 0, linked), renderMasterTechniciansMessage);
    }
    return this.reply(await this.workplace.listTickets(identity, 'sla', 0, linked), renderMasterTicketListMessage);
  }

  private async action(identity: ResolvedMaster, action: MasterAction): Promise<MaxBotCommandResponse> {
    if (!this.workplace) return renderPersistentMenuMessage(FAILED);
    if (action.kind === 'selectClient') {
      const clients = await this.loadClients(identity);
      if (clients === null) return renderPersistentMenuMessage(FAILED);
      if (!clients.some((item) => item.id === action.clientId)) {
        return renderMasterClientPickerMessage(toMasterClientPickerPage(clients, 0, null));
      }
      setMasterLinkedClient(identity.maxUserId, action.clientId);
      return renderMasterMenuMessage({ showChangeClient: clients.length > 1 });
    }
    if (action.kind === 'changeClient' || action.kind === 'clientPage') {
      const clients = await this.loadClients(identity);
      if (clients === null) return renderPersistentMenuMessage(FAILED);
      if (clients.length === 0) return renderMasterNoLinkedClientsMessage();
      if (clients.length === 1) {
        setMasterLinkedClient(identity.maxUserId, clients[0].id);
        return renderMasterMenuMessage({ showChangeClient: false });
      }
      const offset = action.kind === 'clientPage' ? action.offset : 0;
      return renderMasterClientPickerMessage(
        toMasterClientPickerPage(clients, offset, getMasterLinkedClient(identity.maxUserId)),
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
    if (action.kind === 'roundReport') {
      const report = await this.workplace.roundReport(identity, action.runId);
      if (!report.ok) return fail(report.message);
      return renderMasterRoundReportMessage(report.value, action.offset);
    }

    const linked = await this.requireClient(identity);
    if (typeof linked !== 'string') return linked;

    if (action.kind === 'filter' || action.kind === 'list') {
      const filter = action.filter;
      const offset = action.kind === 'list' ? action.offset : 0;
      return this.reply(
        await this.workplace.listTickets(identity, filter, offset, linked),
        renderMasterTicketListMessage,
      );
    }
    if (action.kind === 'unassigned') {
      return this.reply(
        await this.workplace.unassigned(identity, action.offset, linked),
        renderMasterTicketListMessage,
      );
    }
    if (action.kind === 'card') return this.card(identity, action.ticketId, linked);
    if (action.kind === 'comment') {
      const card = await this.workplace.card(identity, action.ticketId, linked);
      if (!card.ok) return fail(card.message);
      return this.dialog.beginComment(identity, action.ticketId, card.value.ticketNumber, action.mention);
    }
    if (action.kind === 'attachments') {
      return this.reply(
        await this.workplace.attachments(identity, action.ticketId, linked),
        renderMasterAttachmentsMessage,
      );
    }
    if (action.kind === 'history') {
      return this.reply(
        await this.workplace.history(identity, action.ticketId, action.offset, linked),
        renderMasterHistoryMessage,
      );
    }
    if (action.kind === 'candidates' || action.kind === 'assign') {
      const offset = action.kind === 'candidates' ? action.offset : 0;
      return this.reply(
        await this.workplace.candidates(identity, action.ticketId, offset, action.back, linked),
        renderMasterCandidatesMessage,
      );
    }
    if (action.kind === 'pick') {
      const found = await this.workplace.findCandidate(
        identity,
        action.ticketId,
        action.technicianId,
        action.back,
        linked,
      );
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
      return this.assign(identity, action.ticketId, action.technicianId, linked);
    }
    if (action.kind === 'assignYes') {
      return this.assign(identity, action.ticketId, action.technicianId, linked);
    }
    if (action.kind === 'techList') {
      return this.reply(
        await this.workplace.technicians(identity, action.offset, linked),
        renderMasterTechniciansMessage,
      );
    }
    return this.reply(
      await this.workplace.technicianTickets(identity, action.userId, action.offset, linked),
      renderMasterTicketListMessage,
    );
  }

  private async today(identity: ResolvedMaster, linkedClientCompanyId: string) {
    if (!this.workplace) return renderPersistentMenuMessage(FAILED);
    const result = await this.workplace.today(identity, linkedClientCompanyId);
    if (!result.ok) return fail(result.message);
    return renderMasterTodayMessage(result.value);
  }

  private async card(identity: ResolvedMaster, ticketId: string, linkedClientCompanyId: string) {
    if (!this.workplace) return renderPersistentMenuMessage(FAILED);
    const result = await this.workplace.card(identity, ticketId, linkedClientCompanyId);
    if (!result.ok) return fail(result.message);
    return renderMasterTicketCardMessage(result.value);
  }

  private async assign(
    identity: ResolvedMaster,
    ticketId: string,
    technicianId: string,
    linkedClientCompanyId: string,
  ) {
    if (!this.workplace) return renderPersistentMenuMessage(FAILED);
    const result = await this.workplace.assign(identity, ticketId, technicianId, linkedClientCompanyId);
    if (!result.ok) return fail(result.message);
    return renderMasterAssignedMessage(result.value);
  }

  private async requireClient(identity: ResolvedMaster): Promise<string | MaxBotCommandResponse> {
    const clients = await this.loadClients(identity);
    if (clients === null) return renderPersistentMenuMessage(FAILED);
    if (clients.length === 0) return renderMasterNoLinkedClientsMessage();
    if (clients.length === 1) {
      setMasterLinkedClient(identity.maxUserId, clients[0].id);
      return clients[0].id;
    }
    const selected = getMasterLinkedClient(identity.maxUserId);
    if (selected && clients.some((item) => item.id === selected)) return selected;
    return renderMasterClientPickerMessage(toMasterClientPickerPage(clients, 0, selected));
  }

  private async loadClients(identity: ResolvedMaster): Promise<MasterLinkedClient[] | null> {
    if (!this.workplace) return null;
    const result = await this.workplace.listLinkedClients(identity);
    return result.ok ? result.value : null;
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
