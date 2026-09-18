import { renderInlineKeyboard } from './max-menu.builder';
import { paginationRows, technicianMenuRow } from './max-technician-menu';
import {
  MY_TICKET_PAGE_SIZE,
  TechnicianTicketCardView,
  TechnicianTicketListItem,
  toTechnicianTicketListItem,
} from './max-technician-tickets';
import { MaxBotCommandResponse, MaxBotInlineKeyboardButton } from './max-bot.types';

export type TechnicianAvailableItem = TechnicianTicketListItem & { canClaim: boolean };

export type TechnicianAvailablePage = {
  items: TechnicianAvailableItem[];
  prevOffset: number | null;
  nextOffset: number | null;
};

function callbackButton(text: string, payload: string): MaxBotInlineKeyboardButton {
  return { type: 'callback', text, payload };
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

export function toTechnicianAvailablePage(rows: Array<Record<string, any>>, offset = 0): TechnicianAvailablePage {
  const start = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  const slice = rows.slice(start, start + MY_TICKET_PAGE_SIZE);
  return {
    items: slice
      .map((ticket) => {
        const item = toTechnicianTicketListItem(ticket);
        if (!item) return null;
        return { ...item, canClaim: ticket.canClaim === true || ticket.canClaimByCurrentUser === true };
      })
      .filter((item): item is TechnicianAvailableItem => item !== null),
    nextOffset: start + MY_TICKET_PAGE_SIZE < rows.length ? start + MY_TICKET_PAGE_SIZE : null,
    prevOffset: start > 0 ? Math.max(0, start - MY_TICKET_PAGE_SIZE) : null,
  };
}

export function renderAvailableTicketsMessage(page: TechnicianAvailablePage): MaxBotCommandResponse {
  if (page.items.length === 0) {
    return withKeyboard('Доступные\n\nНет доступных заявок.', technicianMenuRow());
  }
  const text = ['Доступные', '', page.items.map(formatListCard).join('\n\n')].join('\n');
  const actionRows = page.items.map((item) => {
    const row: MaxBotInlineKeyboardButton[] = [];
    if (item.canClaim) row.push(callbackButton(`Взять #${item.ticketNumber}`, `avc:${item.id}`));
    row.push(callbackButton('Подробнее', `tk:${item.id}`));
    return row;
  });
  return withKeyboard(text, [
    ...actionRows,
    ...paginationRows(
      page.prevOffset !== null ? `av:${page.prevOffset}` : null,
      page.nextOffset !== null ? `av:${page.nextOffset}` : null,
    ),
    ...technicianMenuRow(),
  ]);
}

export function renderAvailableClaimedMessage(card: TechnicianTicketCardView, cardMessage: MaxBotCommandResponse): MaxBotCommandResponse {
  return {
    ...cardMessage,
    text: `Заявка #${card.ticketNumber} назначена вам.\n\n${cardMessage.text}`,
  };
}

export function renderAvailableTakenMessage(page: TechnicianAvailablePage): MaxBotCommandResponse {
  const list = renderAvailableTicketsMessage(page);
  return { ...list, text: `Заявку уже взяли.\n\n${list.text}` };
}
