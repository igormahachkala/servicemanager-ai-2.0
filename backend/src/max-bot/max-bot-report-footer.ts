import { MaxBotInlineKeyboardButton } from './max-bot.types';

/** Shared bound-user footer: error report + back to menu (≤2 buttons per row). */
export const REPORT_ERROR_LABEL = 'Сообщить об ошибке';
export const REPORT_ERROR_PAYLOAD = 'report:error';

export function reportErrorButton(): MaxBotInlineKeyboardButton {
  return { type: 'callback', text: REPORT_ERROR_LABEL, payload: REPORT_ERROR_PAYLOAD };
}

export function menuButton(): MaxBotInlineKeyboardButton {
  return { type: 'callback', text: 'Меню', payload: 'menu' };
}

/** Last row for technician/master screens that already show «Меню». */
export function boundServiceFooterRow(): MaxBotInlineKeyboardButton[][] {
  return [[reportErrorButton(), menuButton()]];
}

/** Main role menus have no «Меню»; only the report entry. */
export function reportErrorMenuRow(): MaxBotInlineKeyboardButton[][] {
  return [[reportErrorButton()]];
}

export function rowHasMenuButton(row: MaxBotInlineKeyboardButton[] | undefined): boolean {
  return (
    !!row &&
    row.some(
      (button) =>
        button.type === 'callback' && button.text === 'Меню' && button.payload === 'menu',
    )
  );
}

function rowHasReportButton(row: MaxBotInlineKeyboardButton[] | undefined): boolean {
  return (
    !!row &&
    row.some(
      (button) => button.type === 'callback' && button.payload === REPORT_ERROR_PAYLOAD,
    )
  );
}

function keyboardHasReport(rows: MaxBotInlineKeyboardButton[][]): boolean {
  return rows.some((row) => rowHasReportButton(row));
}

/**
 * Ensures bound screens get «Сообщить об ошибке» + «Меню».
 * - no Menu → append report|Menu
 * - lone Menu row → replace with report|Menu
 * - Menu shares a full row → insert report row above it
 * - report already present → leave as-is
 */
export function appendBoundServiceFooter(
  rows: MaxBotInlineKeyboardButton[][],
): MaxBotInlineKeyboardButton[][] {
  if (keyboardHasReport(rows)) return rows;
  const last = rows[rows.length - 1];
  if (!rowHasMenuButton(last)) {
    return [...rows, ...boundServiceFooterRow()];
  }
  if (last.length === 1) {
    return [...rows.slice(0, -1), ...boundServiceFooterRow()];
  }
  if (last.length < 2) {
    return [...rows.slice(0, -1), [reportErrorButton(), ...last]];
  }
  return [...rows.slice(0, -1), [reportErrorButton()], last];
}
