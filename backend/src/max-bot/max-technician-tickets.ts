import { TicketStatus } from '@prisma/client';

import { renderInlineKeyboard } from './max-menu.builder';
import { BOUND_ROLE_STUB_TEXT, technicianFooterRows } from './max-technician-menu';
import { MaxBotCommandResponse, MaxBotInlineKeyboardButton } from './max-bot.types';

export const MY_TICKET_PAGE_SIZE = 5;
export const HISTORY_PAGE_SIZE = 5;

const TICKET_STATUSES = new Set<string>(Object.values(TicketStatus));

const TICKET_ID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export type TechnicianTicketListItem = {
  id: string;
  ticketNumber: number;
  locationName: string;
  problemText: string;
  urgencyLabel: string;
  statusLabel: string;
};

export type TechnicianTicketListPage = {
  items: TechnicianTicketListItem[];
  nextOffset: number | null;
};

export type TechnicianTicketCardView = {
  id: string;
  ticketNumber: number;
  locationName: string;
  categoryName: string;
  problemText: string;
  urgencyLabel: string;
  statusLabel: string;
  assigneeName: string;
  equipmentName: string;
  canStart: boolean;
  canComplete: boolean;
  pickerTransitions: TicketStatus[];
};

export type TechnicianTicketHistoryItem = {
  atLabel: string;
  title: string;
  detail: string | null;
};

export type TechnicianTicketHistoryPage = {
  ticketId: string;
  ticketNumber: number;
  items: TechnicianTicketHistoryItem[];
  nextOffset: number | null;
};

export type TechnicianTicketAction =
  | { kind: 'list'; offset: number }
  | { kind: 'card'; ticketId: string }
  | { kind: 'start'; ticketId: string }
  | { kind: 'status'; ticketId: string }
  | { kind: 'apply'; ticketId: string; status: TicketStatus }
  | { kind: 'history'; ticketId: string; offset: number }
  | { kind: 'comment'; ticketId: string }
  | { kind: 'photo'; ticketId: string }
  | { kind: 'complete'; ticketId: string }
  | { kind: 'completePhoto'; ticketId: string }
  | { kind: 'completeAsk'; ticketId: string }
  | { kind: 'completeSkip'; ticketId: string };

export function parseTechnicianTicketAction(payload: string): TechnicianTicketAction | null {
  const page = payload.match(/^my:(\d+)$/);
  if (page) return { kind: 'list', offset: Number(page[1]) };
  const card = payload.match(/^tk:(.+)$/);
  if (card && TICKET_ID_RE.test(card[1])) return { kind: 'card', ticketId: card[1] };
  const start = payload.match(/^tks:(.+)$/);
  if (start && TICKET_ID_RE.test(start[1])) return { kind: 'start', ticketId: start[1] };
  const status = payload.match(/^tkm:(.+)$/);
  if (status && TICKET_ID_RE.test(status[1])) return { kind: 'status', ticketId: status[1] };
  const apply = payload.match(/^tkp:(.+):([A-Z_]+)$/);
  if (apply && TICKET_ID_RE.test(apply[1]) && TICKET_STATUSES.has(apply[2])) {
    return { kind: 'apply', ticketId: apply[1], status: apply[2] as TicketStatus };
  }
  const history = payload.match(/^tkh:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?::(\d+))?$/);
  if (history && TICKET_ID_RE.test(history[1])) {
    return { kind: 'history', ticketId: history[1], offset: history[2] ? Number(history[2]) : 0 };
  }
  const comment = payload.match(/^tkc:(.+)$/);
  if (comment && TICKET_ID_RE.test(comment[1])) return { kind: 'comment', ticketId: comment[1] };
  const photo = payload.match(/^tkf:(.+)$/);
  if (photo && TICKET_ID_RE.test(photo[1])) return { kind: 'photo', ticketId: photo[1] };
  const complete = payload.match(/^tku:(.+)$/);
  if (complete && TICKET_ID_RE.test(complete[1])) return { kind: 'complete', ticketId: complete[1] };
  const completePhoto = payload.match(/^tkq:(.+)$/);
  if (completePhoto && TICKET_ID_RE.test(completePhoto[1])) return { kind: 'completePhoto', ticketId: completePhoto[1] };
  const completeAsk = payload.match(/^tky:(.+)$/);
  if (completeAsk && TICKET_ID_RE.test(completeAsk[1])) return { kind: 'completeAsk', ticketId: completeAsk[1] };
  const completeSkip = payload.match(/^tkz:(.+)$/);
  if (completeSkip && TICKET_ID_RE.test(completeSkip[1])) return { kind: 'completeSkip', ticketId: completeSkip[1] };
  return null;
}

export function ticketStatusLabel(status: string) {
  if (status === TicketStatus.NEW) return 'Новая';
  if (status === TicketStatus.ASSIGNED) return 'Назначена';
  if (status === TicketStatus.IN_PROGRESS) return 'В работе';
  if (status === TicketStatus.AWAITING_ACCEPTANCE) return 'Ожидает приёмки';
  if (status === TicketStatus.DONE) return 'Завершена';
  if (status === TicketStatus.CANCELED) return 'Отменена';
  return status;
}

export function ticketUrgencyLabel(urgency?: string | null) {
  return urgency === 'URGENT' ? 'Срочно' : 'Не срочно';
}

export function toTechnicianTicketListItem(ticket: Record<string, any>): TechnicianTicketListItem | null {
  if (typeof ticket?.id !== 'string' || typeof ticket.ticketNumber !== 'number') return null;
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    locationName: textOrFallback(ticket.location?.name, 'Без объекта'),
    problemText: clip(textOrFallback(ticket.problemText, '')),
    urgencyLabel: ticketUrgencyLabel(ticket.urgency),
    statusLabel: ticketStatusLabel(String(ticket.status || '')),
  };
}

export function toTechnicianTicketCardView(ticket: Record<string, any>): TechnicianTicketCardView | null {
  if (typeof ticket?.id !== 'string' || typeof ticket.ticketNumber !== 'number') return null;
  const actions = ticket.meta?.availableActions || {};
  const transitions: string[] = Array.isArray(ticket.meta?.availableStatusTransitions)
    ? ticket.meta.availableStatusTransitions
    : [];
  const canStart = actions.canStart === true;
  const canComplete = actions.canComplete === true;
  const pickerTransitions = (transitions as TicketStatus[]).filter(
    (status) =>
      TICKET_STATUSES.has(status) &&
      status !== TicketStatus.DONE &&
      status !== TicketStatus.AWAITING_ACCEPTANCE &&
      status !== TicketStatus.CANCELED &&
      !(canStart && status === TicketStatus.IN_PROGRESS),
  );
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    locationName: textOrFallback(ticket.location?.name, 'Без объекта'),
    categoryName: textOrFallback(ticket.problemCategory?.name, 'Без категории'),
    problemText: textOrFallback(ticket.problemText, ''),
    urgencyLabel: ticketUrgencyLabel(ticket.urgency),
    statusLabel: ticketStatusLabel(String(ticket.status || '')),
    assigneeName: personName(ticket.assignedTechnician),
    equipmentName: textOrFallback(ticket.equipment?.name, 'Нет'),
    canStart,
    canComplete,
    pickerTransitions,
  };
}

export function renderTechnicianTicketsListMessage(page: TechnicianTicketListPage): MaxBotCommandResponse {
  if (page.items.length === 0) {
    return withKeyboard('Мои заявки\n\nНет назначенных заявок.', technicianFooterRows());
  }

  const text = ['Мои заявки', '', page.items.map(formatListCard).join('\n\n')].join('\n');
  const opens = page.items.map((item) =>
    callbackButton(`Открыть #${item.ticketNumber}`, `tk:${item.id}`),
  );
  const extras = page.nextOffset !== null ? [callbackButton('Следующие', `my:${page.nextOffset}`)] : [];
  const actions = [...opens, ...extras];
  const footer = technicianFooterRows();
  const rows =
    actions.length + 3 <= 7
      ? [...chunk3(actions), ...footer]
      : [...chunk3(actions), [callbackButton('Меню', 'menu')]];
  return withKeyboard(text, rows);
}

export function renderTechnicianTicketCardMessage(card: TechnicianTicketCardView): MaxBotCommandResponse {
  const text = [
    `Заявка #${card.ticketNumber}`,
    '',
    `Объект: ${card.locationName}`,
    `Категория: ${card.categoryName}`,
    `Проблема: ${card.problemText || '—'}`,
    `Срочность: ${card.urgencyLabel}`,
    `Статус: ${card.statusLabel}`,
    `Исполнитель: ${card.assigneeName}`,
    `Оборудование: ${card.equipmentName}`,
  ].join('\n');

  const actions: MaxBotInlineKeyboardButton[] = [];
  if (card.canStart) actions.push(callbackButton('Начать работу', `tks:${card.id}`));
  actions.push(callbackButton('Комментарий', `tkc:${card.id}`));
  actions.push(callbackButton('Фото', `tkf:${card.id}`));
  if (card.pickerTransitions.length > 0) {
    actions.push(callbackButton('Изменить статус', `tkm:${card.id}`));
  }
  if (card.canComplete) actions.push(callbackButton('Завершить', `tku:${card.id}`));
  actions.push(callbackButton('История', `tkh:${card.id}`));
  const footer = technicianFooterRows();
  const rows =
    actions.length + 3 <= 7
      ? [...chunk3(actions), ...footer]
      : [...chunk3(actions.slice(0, 6)), [callbackButton('Меню', 'menu')]];
  return withKeyboard(text, rows);
}

export function renderCommentPromptMessage(ticketId: string, ticketNumber: number): MaxBotCommandResponse {
  return withKeyboard(`Введите комментарий к заявке #${ticketNumber}`, [
    [callbackButton('Отмена', `tk:${ticketId}`)],
  ]);
}

export function renderCommentSavedMessage(ticketId: string, ticketNumber: number): MaxBotCommandResponse {
  return withKeyboard(`Комментарий добавлен к #${ticketNumber}`, [
    [callbackButton('К заявке', `tk:${ticketId}`)],
    ...technicianFooterRows(),
  ]);
}

export function renderTicketStatusPickerMessage(card: TechnicianTicketCardView): MaxBotCommandResponse {
  const choices = card.pickerTransitions.map((status) =>
    callbackButton(ticketStatusLabel(status), `tkp:${card.id}:${status}`),
  );
  const cancel = callbackButton('Отмена', `tk:${card.id}`);
  const actions = [...choices, cancel];
  const rows =
    actions.length + 3 <= 7
      ? [...chunk3(actions), ...technicianFooterRows()]
      : chunk3(actions);
  return withKeyboard(`Выберите действие.\nЗаявка #${card.ticketNumber}`, rows);
}

export function renderTicketHistoryMessage(page: TechnicianTicketHistoryPage): MaxBotCommandResponse {
  const body =
    page.items.length === 0
      ? 'Событий пока нет.'
      : page.items.map((item) => [item.atLabel, item.title, item.detail].filter(Boolean).join('\n')).join('\n\n');
  const extras: MaxBotInlineKeyboardButton[] = [];
  if (page.nextOffset !== null) extras.push(callbackButton('Следующие', `tkh:${page.ticketId}:${page.nextOffset}`));
  extras.push(callbackButton('К заявке', `tk:${page.ticketId}`));
  const rows =
    extras.length + 3 <= 7
      ? [...chunk3(extras), ...technicianFooterRows()]
      : chunk3(extras);
  return withKeyboard(`История #${page.ticketNumber}\n\n${body}`, rows);
}

export function toTechnicianTicketHistoryPage(
  ticketId: string,
  ticketNumber: number,
  entries: Array<Record<string, any>>,
  offset = 0,
): TechnicianTicketHistoryPage {
  const newestFirst = [...entries].sort((a, b) => toTime(b?.at) - toTime(a?.at));
  const start = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  const slice = newestFirst.slice(start, start + HISTORY_PAGE_SIZE);
  return {
    ticketId,
    ticketNumber,
    items: slice.map(formatHistoryItem).filter((item): item is TechnicianTicketHistoryItem => item !== null),
    nextOffset: start + HISTORY_PAGE_SIZE < newestFirst.length ? start + HISTORY_PAGE_SIZE : null,
  };
}

export function renderTicketActionStubMessage(ticketId: string): MaxBotCommandResponse {
  const keyboard = renderInlineKeyboard([
    [callbackButton('К заявке', `tk:${ticketId}`)],
    ...technicianFooterRows(),
  ]);
  return {
    text: BOUND_ROLE_STUB_TEXT,
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}

export function renderTicketUnavailableMessage(): MaxBotCommandResponse {
  return withKeyboard('Заявка недоступна', technicianFooterRows());
}

function formatListCard(item: TechnicianTicketListItem) {
  return [`#${item.ticketNumber} · ${item.statusLabel} · ${item.urgencyLabel}`, item.locationName, item.problemText]
    .filter(Boolean)
    .join('\n');
}

function callbackButton(text: string, payload: string): MaxBotInlineKeyboardButton {
  return { type: 'callback', text, payload };
}

function chunk3(buttons: MaxBotInlineKeyboardButton[]) {
  const rows: MaxBotInlineKeyboardButton[][] = [];
  for (let i = 0; i < buttons.length; i += 3) rows.push(buttons.slice(i, i + 3));
  return rows;
}

function withKeyboard(text: string, rows: MaxBotInlineKeyboardButton[][]): MaxBotCommandResponse {
  const keyboard = renderInlineKeyboard(rows);
  return {
    text,
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}

function clip(text: string, max = 80) {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).trimEnd()}…`;
}

function textOrFallback(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function personName(user?: { firstName?: string | null; lastName?: string | null } | null) {
  const name = [user?.firstName, user?.lastName].filter((part) => typeof part === 'string' && part.trim()).join(' ').trim();
  return name || 'Не назначен';
}

function formatHistoryItem(entry: Record<string, any>): TechnicianTicketHistoryItem | null {
  const title = historyTitle(entry);
  if (!title) return null;
  const comment = typeof entry.payload?.comment === 'string' ? clip(entry.payload.comment) : '';
  return {
    atLabel: formatHistoryInstant(entry.at),
    title,
    detail: comment || null,
  };
}

function historyTitle(entry: Record<string, any>) {
  const event = String(entry.timelineEvent || '');
  if (event === 'STATUS_CHANGED') {
    const from = ticketStatusLabel(String(entry.payload?.fromStatus || ''));
    const to = ticketStatusLabel(String(entry.payload?.toStatus || ''));
    return `Статус: ${from} → ${to}`;
  }
  if (event === 'COMMENT_ADDED') return 'Комментарий';
  if (event === 'TICKET_CREATED') return 'Создана';
  if (event === 'TICKET_ASSIGNED') return 'Назначена';
  if (event === 'TICKET_CLAIMED') return 'Взята';
  if (event === 'TICKET_ATTACHMENT_UPLOADED') return 'Вложение';
  if (event === 'TICKET_READY_FOR_ACCEPTANCE') return 'Передана на приёмку';
  if (event === 'SLA_WARNING') return 'SLA: предупреждение';
  if (event === 'SLA_BREACH') return 'SLA: просрочка';
  return typeof entry.title === 'string' && entry.title.trim() ? clip(entry.title) : null;
}

function formatHistoryInstant(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

function toTime(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ''));
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}
