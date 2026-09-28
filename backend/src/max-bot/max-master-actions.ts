import { isTicketId, type MasterTicketFilter } from './max-master-tickets';

const UUID =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

export type MasterBack = 'k' | 'u' | 's';

export type MasterCardBack =
  | { list: 'new' | 'work' | 'sla' | 'unassigned'; offset: number }
  | { list: 'tech'; userId: string; offset: number };

export type MasterAction =
  | { kind: 'filter'; filter: MasterTicketFilter }
  | { kind: 'list'; filter: MasterTicketFilter; offset: number }
  | { kind: 'unassigned'; offset: number }
  | { kind: 'card'; ticketId: string; back?: MasterCardBack }
  | { kind: 'candidates'; ticketId: string; offset: number; back: MasterBack }
  | { kind: 'assign'; ticketId: string; back: MasterBack }
  | { kind: 'assignYes'; ticketId: string; technicianId: string; back: MasterBack }
  | { kind: 'pick'; ticketId: string; technicianId: string; back: MasterBack }
  | { kind: 'comment'; ticketId: string; mention: boolean }
  | { kind: 'attachments'; ticketId: string }
  | { kind: 'history'; ticketId: string; offset: number }
  | { kind: 'techList'; offset: number }
  | { kind: 'techTickets'; userId: string; offset: number }
  | { kind: 'roundList'; offset: number }
  | { kind: 'roundProgress'; runId: string }
  | { kind: 'roundPending'; scheduleId: string }
  | { kind: 'roundReport'; runId: string; offset: number }
  | { kind: 'selectClient'; clientId: string }
  | { kind: 'changeClient' }
  | { kind: 'clientPage'; offset: number };

export function masterCardBackPayload(back: MasterCardBack): string {
  if (back.list === 'tech') return `mt:${back.userId}:${back.offset}`;
  if (back.list === 'unassigned') return back.offset > 0 ? `mu:${back.offset}` : 'unassigned';
  if (back.list === 'sla') return back.offset > 0 ? `ml:sla:${back.offset}` : 'sla';
  return `ml:${back.list}:${back.offset}`;
}

const FILTERS = new Set<MasterTicketFilter>(['new', 'work', 'sla']);
export function parseMasterAction(payload: string): MasterAction | null {
  if (payload === 'mcc') return { kind: 'changeClient' };
  const clientPage = payload.match(/^mcp:(\d+)$/);
  if (clientPage) return { kind: 'clientPage', offset: Number(clientPage[1]) };
  const selectClient = payload.match(/^mcl:([A-Za-z0-9_-]{8,64})$/);
  if (selectClient) return { kind: 'selectClient', clientId: selectClient[1] };
  const filter = payload.match(/^mf:(new|work|sla)$/);
  if (filter) return { kind: 'filter', filter: filter[1] as MasterTicketFilter };
  const list = payload.match(/^ml:(new|work|sla):(\d+)$/);
  if (list && FILTERS.has(list[1] as MasterTicketFilter)) {
    return { kind: 'list', filter: list[1] as MasterTicketFilter, offset: Number(list[2]) };
  }
  const unassigned = payload.match(/^mu:(\d+)$/);
  if (unassigned) return { kind: 'unassigned', offset: Number(unassigned[1]) };
  const cardTech = payload.match(new RegExp(`^mk:(${UUID}):t:(${UUID}):(\\d+)$`));
  if (cardTech && isTicketId(cardTech[1]) && isTicketId(cardTech[2])) {
    return {
      kind: 'card',
      ticketId: cardTech[1],
      back: { list: 'tech', userId: cardTech[2], offset: Number(cardTech[3]) },
    };
  }
  const cardList = payload.match(new RegExp(`^mk:(${UUID}):([nwsu]):(\\d+)$`));
  if (cardList && isTicketId(cardList[1])) {
    const code = cardList[2];
    const listKind =
      code === 'n' ? 'new' : code === 'w' ? 'work' : code === 's' ? 'sla' : 'unassigned';
    return {
      kind: 'card',
      ticketId: cardList[1],
      back: { list: listKind, offset: Number(cardList[3]) },
    };
  }
  const card = payload.match(new RegExp(`^mk:(${UUID})$`));
  if (card && isTicketId(card[1])) return { kind: 'card', ticketId: card[1] };
  const assign = payload.match(new RegExp(`^ma:(${UUID}):([kus])$`));
  if (assign) return { kind: 'assign', ticketId: assign[1], back: assign[2] as MasterBack };
  const candidates = payload.match(new RegExp(`^mc:(${UUID}):(\\d+):([kus])$`));
  if (candidates) {
    return {
      kind: 'candidates',
      ticketId: candidates[1],
      offset: Number(candidates[2]),
      back: candidates[3] as MasterBack,
    };
  }
  const pick = payload.match(new RegExp(`^mpk:(${UUID}):(${UUID}):([kus])$`));
  if (pick) {
    return { kind: 'pick', ticketId: pick[1], technicianId: pick[2], back: pick[3] as MasterBack };
  }
  const yes = payload.match(new RegExp(`^mx:(${UUID}):(${UUID}):([kus])$`));
  if (yes) {
    return { kind: 'assignYes', ticketId: yes[1], technicianId: yes[2], back: yes[3] as MasterBack };
  }
  const comment = payload.match(new RegExp(`^mm:(${UUID}):([cm])$`));
  if (comment) return { kind: 'comment', ticketId: comment[1], mention: comment[2] === 'm' };
  const attachments = payload.match(new RegExp(`^mw:(${UUID})$`));
  if (attachments) return { kind: 'attachments', ticketId: attachments[1] };
  const history = payload.match(new RegExp(`^mh:(${UUID}):(\\d+)$`));
  if (history) return { kind: 'history', ticketId: history[1], offset: Number(history[2]) };
  const techList = payload.match(/^ms:(\d+)$/);
  if (techList) return { kind: 'techList', offset: Number(techList[1]) };
  const techTickets = payload.match(new RegExp(`^mt:(${UUID}):(\\d+)$`));
  if (techTickets) return { kind: 'techTickets', userId: techTickets[1], offset: Number(techTickets[2]) };
  const roundList = payload.match(/^mr:(\d+)$/);
  if (roundList) return { kind: 'roundList', offset: Number(roundList[1]) };
  const progress = payload.match(new RegExp(`^mp:(${UUID})$`));
  if (progress) return { kind: 'roundProgress', runId: progress[1] };
  const pending = payload.match(new RegExp(`^mq:(${UUID})$`));
  if (pending) return { kind: 'roundPending', scheduleId: pending[1] };
  const report = payload.match(new RegExp(`^mz:(${UUID})(?::(\\d+))?$`));
  if (report) {
    return {
      kind: 'roundReport',
      runId: report[1],
      offset: report[2] ? Number(report[2]) : 0,
    };
  }
  return null;
}

export function keepsMasterWait(kind: string) {
  return kind === 'comment';
}
