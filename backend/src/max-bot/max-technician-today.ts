import { renderInlineKeyboard } from './max-menu.builder';
import { technicianMenuRow } from './max-technician-menu';
import { MaxBotCommandResponse, MaxBotInlineKeyboardButton } from './max-bot.types';

export type TechnicianTodaySummary = {
  shiftOpen: boolean;
  shiftOpenedLabel: string | null;
  myActiveCount: number;
  overdueCount: number;
  roundsTodayCount: number;
};

function callbackButton(text: string, payload: string): MaxBotInlineKeyboardButton {
  return { type: 'callback', text, payload };
}

export function renderTechnicianTodayMessage(summary: TechnicianTodaySummary): MaxBotCommandResponse {
  const shiftLine = summary.shiftOpen
    ? `Смена: открыта${summary.shiftOpenedLabel ? ` с ${summary.shiftOpenedLabel}` : ''}`
    : 'Смена: не открыта';
  const text = [
    'Сегодня',
    '',
    shiftLine,
    `Заявки: ${summary.myActiveCount}, просрочено ${summary.overdueCount}`,
    `Обходы сегодня: ${summary.roundsTodayCount}`,
  ].join('\n');

  const keyboard = renderInlineKeyboard([
    [
      callbackButton('Мои заявки', 'my'),
      callbackButton('Обходы', 'rounds'),
      callbackButton('Моя смена', 'shift'),
    ],
    ...technicianMenuRow(),
  ]);

  return {
    text,
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}
