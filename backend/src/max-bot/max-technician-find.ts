import { renderInlineKeyboard } from './max-menu.builder';
import { paginationRows, technicianMenuRow } from './max-technician-menu';
import {
  TechnicianTicketListItem,
  TechnicianTicketListPage,
} from './max-technician-tickets';
import { MaxBotCommandResponse, MaxBotInlineKeyboardButton } from './max-bot.types';

export const FIND_PROMPT_TEXT = 'Напишите номер, описание, имя или адрес заявки';

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

function formatListCard(item: TechnicianTicketListItem) {
  return [`#${item.ticketNumber} · ${item.statusLabel} · ${item.urgencyLabel}`, item.locationName, item.problemText]
    .filter(Boolean)
    .join('\n');
}

function personName(user?: { firstName?: string | null; lastName?: string | null } | null) {
  return [user?.firstName, user?.lastName]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ')
    .trim();
}

export function parseFindTicketNumber(query: string): number | null {
  const match = query.trim().match(/^#?(\d+)$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function ticketMatchesFindQuery(ticket: Record<string, any>, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return false;
  const exact = parseFindTicketNumber(query);
  if (exact !== null && ticket.ticketNumber === exact) return true;
  const haystack = [
    ticket.problemText,
    ticket.requesterName,
    personName(ticket.createdByUser),
    ticket.location?.name,
    ticket.location?.address,
    ticket.location?.city,
  ]
    .filter((part) => typeof part === 'string' && part.trim())
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function renderFindPromptMessage(): MaxBotCommandResponse {
  return withKeyboard(FIND_PROMPT_TEXT, [[callbackButton('Отмена', 'menu')], ...technicianMenuRow()]);
}

export function renderFindEmptyMessage(): MaxBotCommandResponse {
  return withKeyboard(`Ничего не найдено.\n${FIND_PROMPT_TEXT}`, [
    [callbackButton('Отмена', 'menu')],
    ...technicianMenuRow(),
  ]);
}

export function renderFindResultsMessage(page: TechnicianTicketListPage): MaxBotCommandResponse {
  if (page.items.length === 0) return renderFindEmptyMessage();
  const text = ['Поиск заявки', '', page.items.map(formatListCard).join('\n\n')].join('\n');
  const opens = page.items.map((item) => callbackButton(`#${item.ticketNumber}`, `tk:${item.id}`));
  return withKeyboard(text, [
    ...chunk3(opens),
    ...paginationRows(
      page.prevOffset !== null ? `fn:${page.prevOffset}` : null,
      page.nextOffset !== null ? `fn:${page.nextOffset}` : null,
    ),
    ...technicianMenuRow(),
  ]);
}
