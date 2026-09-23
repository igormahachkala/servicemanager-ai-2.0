import { TicketStatus, TicketUrgency } from '@prisma/client';

import { MaxBotCommandResponse } from './max-bot.types';
import {
  MASTER_ASSIGN_PAGE_SIZE,
  MASTER_HISTORY_PAGE_SIZE,
  MASTER_PAGE_SIZE,
  callbackButton,
  chunk3,
  masterPaginationRows,
  withKeyboard,
} from './max-master-menu';

export type MasterTicketFilter = 'new' | 'work' | 'sla';

export type MasterTicketListItem = {
  id: string;
  ticketNumber: number;
  locationName: string;
  problemText: string;
  urgencyLabel: string;
  statusLabel: string;
  assigneeName: string;
  categoryName: string;
  createdLabel: string;
  slaLabel: string | null;
};

export type MasterTicketListPage = {
  title: string;
  filter: MasterTicketFilter | 'unassigned' | 'tech';
  items: MasterTicketListItem[];
  prevOffset: number | null;
  nextOffset: number | null;
  extra?: string;
};

export type MasterTicketCardView = {
  id: string;
  ticketNumber: number;
  locationName: string;
  equipmentName: string;
  sourceLabel: string | null;
  sourceRunId: string | null;
  attachmentCount: number;
  historyPreview: string;
  canAssign: boolean;
  hasAssignee: boolean;
};

export type MasterHistoryPage = {
  ticketId: string;
  ticketNumber: number;
  items: string[];
  prevOffset: number | null;
  nextOffset: number | null;
};

export type MasterAttachmentList = {
  ticketId: string;
  ticketNumber: number;
  lines: string[];
};

const TICKET_ID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function renderMasterTicketFilterMessage(): MaxBotCommandResponse {
  return withKeyboard('Какие заявки показать', [
    [
      callbackButton('Новые', 'mf:new'),
      callbackButton('В работе', 'mf:work'),
      callbackButton('Просрочено', 'mf:sla'),
    ],
    [callbackButton('Отмена', 'menu')],
  ]);
}

export function renderMasterTicketListMessage(page: MasterTicketListPage): MaxBotCommandResponse {
  const empty =
    page.filter === 'unassigned'
      ? 'Нет заявок без исполнителя.'
      : page.filter === 'sla'
        ? 'Нет просроченных заявок.'
        : 'Нет заявок по фильтру.';
  const body =
    page.items.length === 0
      ? empty
      : page.items.map(formatListCard).join('\n\n');
  const opens = page.items.map((item) => callbackButton(`#${item.ticketNumber}`, `mk:${item.id}`));
  const assigns =
    page.filter === 'unassigned' || page.filter === 'sla'
      ? page.items.map((item) =>
          callbackButton(
            `Назначить #${item.ticketNumber}`,
            `ma:${item.id}:${page.filter === 'sla' ? 's' : 'u'}`,
          ),
        )
      : [];
  const pageKey =
    page.filter === 'unassigned' ? 'mu' : page.filter === 'tech' ? `mt:${page.extra || '0'}` : `ml:${page.filter}`;
  const prev =
    page.prevOffset !== null
      ? page.filter === 'tech'
        ? `mt:${page.extra}:${page.prevOffset}`
        : `${pageKey}:${page.prevOffset}`
      : null;
  const next =
    page.nextOffset !== null
      ? page.filter === 'tech'
        ? `mt:${page.extra}:${page.nextOffset}`
        : `${pageKey}:${page.nextOffset}`
      : null;
  return withKeyboard([page.title, '', body].join('\n'), [
    ...chunk3(opens),
    ...chunk3(assigns),
    ...masterPaginationRows(prev, next),
  ]);
}

export function renderMasterTicketCardMessage(card: MasterTicketCardView): MaxBotCommandResponse {
  const text = [
    `Заявка #${card.ticketNumber}`,
    '',
    `Объект: ${card.locationName}`,
    `Оборудование: ${card.equipmentName}`,
    card.sourceLabel ? `Источник: ${card.sourceLabel}` : null,
    `Вложений: ${card.attachmentCount}`,
    card.historyPreview ? `История: ${card.historyPreview}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  const actions: ReturnType<typeof callbackButton>[] = [];
  if (card.canAssign) {
    actions.push(callbackButton(card.hasAssignee ? 'Переназначить' : 'Назначить', `ma:${card.id}:k`));
  }
  actions.push(callbackButton('Комментарий', `mm:${card.id}:c`));
  actions.push(callbackButton('Упомянуть', `mm:${card.id}:m`));
  const second: ReturnType<typeof callbackButton>[] = [
    callbackButton('Вложения', `mw:${card.id}`),
    callbackButton('История', `mh:${card.id}:0`),
  ];
  if (card.sourceRunId) second.push(callbackButton('Обход', `mp:${card.sourceRunId}`));
  return withKeyboard(text, [
    chunk3(actions)[0] || [],
    chunk3(second)[0] || [],
    [callbackButton('Меню', 'menu')],
  ].filter((row) => row.length > 0));
}

export function renderMasterCommentPrompt(ticketId: string, ticketNumber: number, mention: boolean): MaxBotCommandResponse {
  const text = mention
    ? `Напишите, кого уведомить по заявке #${ticketNumber}`
    : `Введите комментарий к заявке #${ticketNumber}`;
  return withKeyboard(text, [[callbackButton('Отмена', `mk:${ticketId}`)]]);
}

export function renderMasterCommentSaved(ticketId: string, ticketNumber: number): MaxBotCommandResponse {
  return withKeyboard(`Комментарий добавлен к #${ticketNumber}`, [
    [callbackButton('К заявке', `mk:${ticketId}`)],
  ]);
}

export function renderMasterHistoryMessage(page: MasterHistoryPage): MaxBotCommandResponse {
  const body = page.items.length === 0 ? 'Событий пока нет.' : page.items.join('\n\n');
  return withKeyboard(`История #${page.ticketNumber}\n\n${body}`, [
    ...masterPaginationRows(
      page.prevOffset !== null ? `mh:${page.ticketId}:${page.prevOffset}` : null,
      page.nextOffset !== null ? `mh:${page.ticketId}:${page.nextOffset}` : null,
    ),
    [callbackButton('К заявке', `mk:${page.ticketId}`)],
  ]);
}

export function renderMasterAttachmentsMessage(list: MasterAttachmentList): MaxBotCommandResponse {
  const body =
    list.lines.length === 0
      ? 'Вложений нет.'
      : `${list.lines.join('\n')}\n\nСмотрите в Mini App.`;
  return withKeyboard(`Вложения #${list.ticketNumber}\n\n${body}`, [
    [callbackButton('К заявке', `mk:${list.ticketId}`)],
  ]);
}

export function toMasterTicketListPage(
  title: string,
  filter: MasterTicketListPage['filter'],
  items: MasterTicketListItem[],
  offset = 0,
  extra?: string,
): MasterTicketListPage {
  const size = filter === 'unassigned' || filter === 'sla' ? MASTER_ASSIGN_PAGE_SIZE : MASTER_PAGE_SIZE;
  const start = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  const slice = items.slice(start, start + size);
  return {
    title,
    filter,
    extra,
    items: slice,
    prevOffset: start > 0 ? Math.max(0, start - size) : null,
    nextOffset: start + size < items.length ? start + size : null,
  };
}

export function toMasterHistoryPage(
  ticketId: string,
  ticketNumber: number,
  entries: string[],
  offset = 0,
): MasterHistoryPage {
  const start = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  return {
    ticketId,
    ticketNumber,
    items: entries.slice(start, start + MASTER_HISTORY_PAGE_SIZE),
    prevOffset: start > 0 ? Math.max(0, start - MASTER_HISTORY_PAGE_SIZE) : null,
    nextOffset: start + MASTER_HISTORY_PAGE_SIZE < entries.length ? start + MASTER_HISTORY_PAGE_SIZE : null,
  };
}

export function ticketStatusLabel(status: string) {
  switch (status) {
    case TicketStatus.NEW:
      return 'Новая';
    case TicketStatus.ASSIGNED:
      return 'Назначена';
    case TicketStatus.IN_PROGRESS:
      return 'В работе';
    case TicketStatus.AWAITING_ACCEPTANCE:
      return 'Ожидает приёмки';
    case TicketStatus.DONE:
      return 'Завершена';
    case TicketStatus.CANCELED:
      return 'Отменена';
    default:
      return status;
  }
}

export function ticketUrgencyLabel(urgency: string) {
  return urgency === TicketUrgency.URGENT ? 'Срочно' : 'Не срочно';
}

export function urgencyRank(urgency: string) {
  return urgency === TicketUrgency.URGENT ? 0 : 1;
}

export function isTicketId(value: string) {
  return TICKET_ID_RE.test(value);
}

function formatListCard(item: MasterTicketListItem) {
  const sla = item.slaLabel ? ` · SLA ${item.slaLabel}` : '';
  return [
    `#${item.ticketNumber} · ${item.statusLabel} · ${item.urgencyLabel}${sla}`,
    item.locationName,
    item.categoryName,
    item.assigneeName,
    item.createdLabel,
    item.problemText,
  ]
    .filter(Boolean)
    .join('\n');
}
