import { renderInlineKeyboard } from './max-menu.builder';
import { technicianMenuRow } from './max-technician-menu';
import { MaxBotCommandResponse, MaxBotInlineKeyboardButton } from './max-bot.types';

export type TechnicianShiftSummary = {
  open: boolean;
  openedLabel: string | null;
  locationName: string | null;
};

function callbackButton(text: string, payload: string): MaxBotInlineKeyboardButton {
  return { type: 'callback', text, payload };
}

export function renderTechnicianShiftMessage(summary: TechnicianShiftSummary): MaxBotCommandResponse {
  const lines = ['Моя смена', ''];
  if (summary.open) {
    lines.push(`Открыта${summary.openedLabel ? ` с ${summary.openedLabel}` : ''}.`);
    if (summary.locationName) lines.push(`Объект: ${summary.locationName}`);
  } else {
    lines.push('Смена не открыта.');
  }

  const action = summary.open
    ? [callbackButton('Закрыть смену', 'shift_close')]
    : [callbackButton('Открыть смену', 'shift_open')];

  const keyboard = renderInlineKeyboard([
    action,
    [callbackButton('Сегодня', 'today'), callbackButton('Мои заявки', 'my')],
    ...technicianMenuRow(),
  ]);
  return {
    text: lines.join('\n'),
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}

export function renderCloseShiftConfirmMessage(): MaxBotCommandResponse {
  const keyboard = renderInlineKeyboard([
    [callbackButton('Да', 'shift_yes'), callbackButton('Отмена', 'shift_no')],
    ...technicianMenuRow(),
  ]);
  return {
    text: 'Закрыть смену?',
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}
