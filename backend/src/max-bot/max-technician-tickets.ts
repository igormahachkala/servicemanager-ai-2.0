import { TicketStatus } from '@prisma/client';

import { renderInlineKeyboard } from './max-menu.builder';
import { BOUND_ROLE_STUB_TEXT, technicianFooterRows } from './max-technician-menu';
import { MaxBotCommandResponse, MaxBotInlineKeyboardButton } from './max-bot.types';

export const MY_TICKET_PAGE_SIZE = 5;

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
  hasOtherStatusTransitions: boolean;
};

export type TechnicianTicketAction =
  | { kind: 'list'; offset: number }
  | { kind: 'card'; ticketId: string }
  | { kind: 'start'; ticketId: string }
  | { kind: 'stub'; ticketId: string };

export function parseTechnicianTicketAction(payload: string): TechnicianTicketAction | null {
  const page = payload.match(/^my:(\d+)$/);
  if (page) return { kind: 'list', offset: Number(page[1]) };
  const card = payload.match(/^tk:(.+)$/);
  if (card && TICKET_ID_RE.test(card[1])) return { kind: 'card', ticketId: card[1] };
  const start = payload.match(/^tks:(.+)$/);
  if (start && TICKET_ID_RE.test(start[1])) return { kind: 'start', ticketId: start[1] };
  const stub = payload.match(/^tku:(.+)$/);
  if (stub && TICKET_ID_RE.test(stub[1])) return { kind: 'stub', ticketId: stub[1] };
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
  const leftover = transitions.filter(
    (status) =>
      status !== TicketStatus.IN_PROGRESS &&
      status !== TicketStatus.DONE &&
      status !== TicketStatus.CANCELED,
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
    hasOtherStatusTransitions: leftover.length > 0,
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
  if (card.canComplete) actions.push(callbackButton('Завершить', `tku:${card.id}`));
  if (card.hasOtherStatusTransitions) actions.push(callbackButton('Изменить статус', `tku:${card.id}`));
  const rows = [...chunk3(actions.slice(0, 4)), ...technicianFooterRows()];
  return withKeyboard(text, rows);
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
