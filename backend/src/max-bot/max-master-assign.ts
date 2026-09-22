import { MaxBotCommandResponse } from './max-bot.types';
import {
  MASTER_CANDIDATE_PAGE_SIZE,
  callbackButton,
  masterFooterRows,
  masterPaginationRows,
  withKeyboard,
} from './max-master-menu';

export type MasterCandidate = {
  id: string;
  name: string;
  onShift: boolean;
  activeCount: number;
  specialization: string;
};

export type MasterCandidatePage = {
  ticketId: string;
  ticketNumber: number;
  back: 'k' | 'u' | 's';
  hasAssignee: boolean;
  assigneeName: string | null;
  items: MasterCandidate[];
  prevOffset: number | null;
  nextOffset: number | null;
};

export type MasterAssignedView = {
  ticketId: string;
  ticketNumber: number;
  technicianName: string;
};

export function renderMasterCandidatesMessage(page: MasterCandidatePage): MaxBotCommandResponse {
  const lines = page.items.map((item) => {
    const shift = item.onShift ? 'на смене' : 'не на смене';
    return `${item.name}: ${shift}, в работе ${item.activeCount}, ${item.specialization}`;
  });
  const body = page.items.length === 0 ? 'Нет кандидатов.' : lines.join('\n');
  const buttons = page.items.map((item) =>
    callbackButton(`Назначить ${shortName(item.name)}`, `mpk:${page.ticketId}:${item.id}:${page.back}`),
  );
  const cancel = page.back === 'k' ? `mk:${page.ticketId}` : page.back === 's' ? 'sla' : 'unassigned';
  return withKeyboard(`Кого назначить?\nЗаявка #${page.ticketNumber}\n\n${body}`, [
    ...buttons.map((button) => [button]),
    ...masterPaginationRows(
      page.prevOffset !== null ? `mc:${page.ticketId}:${page.prevOffset}:${page.back}` : null,
      page.nextOffset !== null ? `mc:${page.ticketId}:${page.nextOffset}:${page.back}` : null,
    ),
    [callbackButton('Отмена', cancel)],
  ]);
}

export function renderMasterReassignConfirm(
  ticketId: string,
  ticketNumber: number,
  fromName: string,
  toId: string,
  toName: string,
  back: 'k' | 'u' | 's',
): MaxBotCommandResponse {
  return withKeyboard(`Переназначить #${ticketNumber} с ${fromName} на ${toName}?`, [
    [
      callbackButton('Переназначить', `mx:${ticketId}:${toId}:${back}`),
      callbackButton('Отмена', `mc:${ticketId}:0:${back}`),
    ],
  ]);
}

export function renderMasterAssignedMessage(view: MasterAssignedView): MaxBotCommandResponse {
  return withKeyboard(`Заявка #${view.ticketNumber} назначена ${view.technicianName}.`, [
    [callbackButton(`Открыть #${view.ticketNumber}`, `mk:${view.ticketId}`), callbackButton('Без исполнителя', 'unassigned')],
    ...masterFooterRows(),
  ]);
}

export function toMasterCandidatePage(
  ticketId: string,
  ticketNumber: number,
  back: 'k' | 'u' | 's',
  hasAssignee: boolean,
  assigneeName: string | null,
  items: MasterCandidate[],
  offset = 0,
): MasterCandidatePage {
  const start = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  return {
    ticketId,
    ticketNumber,
    back,
    hasAssignee,
    assigneeName,
    items: items.slice(start, start + MASTER_CANDIDATE_PAGE_SIZE),
    prevOffset: start > 0 ? Math.max(0, start - MASTER_CANDIDATE_PAGE_SIZE) : null,
    nextOffset: start + MASTER_CANDIDATE_PAGE_SIZE < items.length ? start + MASTER_CANDIDATE_PAGE_SIZE : null,
  };
}

function shortName(name: string) {
  const part = name.trim().split(/\s+/)[0] || name;
  return part.length > 16 ? `${part.slice(0, 15)}…` : part;
}
