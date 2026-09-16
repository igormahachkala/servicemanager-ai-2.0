import { TicketStatus } from '@prisma/client';

import { CHAT_PAGE_SIZE } from './max-chat-keyboard';

export const ACTIVE_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.NEW,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
  TicketStatus.AWAITING_ACCEPTANCE,
];

export type ChatTicketCard = {
  ticketNumber: number;
  status: string;
  assignedTechnicianId?: string | null;
  location?: { name?: string | null } | null;
  pointName?: string | null;
  problemText?: string | null;
  createdAt?: Date | string;
};

export type ChatRoundCard = {
  name?: string | null;
  location?: { name?: string | null } | null;
  nextDueAt?: Date | string | null;
};

export function statusLabel(status: string) {
  if (status === TicketStatus.NEW) return 'Новая';
  if (status === TicketStatus.ASSIGNED) return 'Назначена';
  if (status === TicketStatus.IN_PROGRESS) return 'В работе';
  if (status === TicketStatus.AWAITING_ACCEPTANCE) return 'Ожидает приёмки';
  if (status === TicketStatus.DONE) return 'Завершена';
  if (status === TicketStatus.CANCELED) return 'Отменена';
  return status;
}

export function clip(text: string, max = 80) {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1).trimEnd()}…`;
}

export function formatTicketCard(ticket: ChatTicketCard) {
  const place = ticket.location?.name || ticket.pointName || 'Без точки';
  const problem = clip(ticket.problemText || '');
  return [`№${ticket.ticketNumber} · ${statusLabel(ticket.status)}`, place, problem]
    .filter(Boolean)
    .join('\n');
}

export function formatRoundCard(round: ChatRoundCard, timeZone: string) {
  const place = round.location?.name || 'Без точки';
  const due = round.nextDueAt ? formatDate(round.nextDueAt, timeZone) : 'без срока';
  return [`${round.name || 'Обход'} · ${place}`, `срок ${due}`].join('\n');
}

export function formatTime(value: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDate(value: Date | string, timeZone: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

export function pageSlice<T>(rows: T[], offset: number, size = CHAT_PAGE_SIZE) {
  const safeOffset = Number.isFinite(offset) && offset > 0 ? offset : 0;
  const slice = rows.slice(safeOffset, safeOffset + size);
  const nextOffset = safeOffset + size < rows.length ? safeOffset + size : null;
  return { slice, nextOffset, total: rows.length, from: safeOffset + 1, to: safeOffset + slice.length };
}

export function isActiveTicket(ticket: { status: string; assignedTechnicianId?: string | null }, userId: string) {
  return ticket.assignedTechnicianId === userId && ACTIVE_TICKET_STATUSES.includes(ticket.status as TicketStatus);
}

export function sortOldestFirst<T extends { createdAt?: Date | string }>(rows: T[]) {
  return [...rows].sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt));
}

function toTime(value?: Date | string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}
