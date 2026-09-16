import {
  type MaxBotCommandResponse,
  type MaxBotInlineKeyboardAttachment,
  type MaxBotInlineKeyboardButton,
} from './max-bot.types';
import { renderInlineKeyboard } from './max-menu.builder';

export const CHAT_PAGE_SIZE = 5;

const CHAT_CALLBACK_RE =
  /^(today|my|avail|rounds|shift|shift_open|shift_close|find)(:[0-9]+)?$/;

export function isChatCallbackPayload(payload: string) {
  return CHAT_CALLBACK_RE.test(payload.trim());
}

export function parseChatPage(payload: string, prefix: string) {
  if (payload === prefix) return 0;
  const match = payload.match(new RegExp(`^${prefix}:(\\d+)$`));
  if (!match) return 0;
  return Number(match[1]);
}

function callback(text: string, payload: string): MaxBotInlineKeyboardButton {
  return { type: 'callback', text, payload };
}

/** Постоянное меню техника: шесть позиций, 2×3. */
export function technicianMenuRows(): MaxBotInlineKeyboardButton[][] {
  return [
    [callback('Сегодня', 'today'), callback('Мои заявки', 'my')],
    [callback('Доступные', 'avail'), callback('Обходы', 'rounds')],
    [callback('Моя смена', 'shift'), callback('Поиск заявки', 'find')],
  ];
}

/** Кнопки под активным сообщением раздела. Не больше трёх в строке. */
export function footerRows(): MaxBotInlineKeyboardButton[][] {
  return [[callback('Сегодня', 'today'), callback('Моя смена', 'shift'), callback('Мои заявки', 'my')]];
}

export function nextPageRows(prefix: string, nextOffset: number): MaxBotInlineKeyboardButton[][] {
  return [[callback('Следующие', `${prefix}:${nextOffset}`)]];
}

export function menuKeyboard(): MaxBotInlineKeyboardAttachment | null {
  return renderInlineKeyboard(technicianMenuRows());
}

export function sectionKeyboard(
  extra: MaxBotInlineKeyboardButton[][] = [],
): MaxBotInlineKeyboardAttachment | null {
  return renderInlineKeyboard([...extra, ...footerRows()]);
}

export function menuMessage(text: string): MaxBotCommandResponse {
  const keyboard = menuKeyboard();
  return { text, ...(keyboard ? { attachments: [keyboard] } : {}) };
}

export function sectionMessage(
  text: string,
  extra: MaxBotInlineKeyboardButton[][] = [],
): MaxBotCommandResponse {
  const keyboard = sectionKeyboard(extra);
  return { text, ...(keyboard ? { attachments: [keyboard] } : {}) };
}
