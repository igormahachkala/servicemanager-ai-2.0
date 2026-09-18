import { technicianFooterRows } from './max-technician-menu';
import { renderInlineKeyboard } from './max-menu.builder';
import { MaxBotCommandResponse, MaxBotInlineKeyboardButton } from './max-bot.types';

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

export function renderPhotoPromptMessage(ticketId: string, ticketNumber: number, cancelPayload: string): MaxBotCommandResponse {
  return withKeyboard(
    `Отправьте фотографию для заявки #${ticketNumber}. Можно несколько — по одной в сообщении`,
    [[callbackButton('Отмена', cancelPayload)]],
  );
}

export function renderPhotoSavedMessage(ticketId: string, ticketNumber: number, count: number): MaxBotCommandResponse {
  return withKeyboard(`Фото добавлено к #${ticketNumber}\nВсего фото: ${count}`, [
    [callbackButton('К заявке', `tk:${ticketId}`)],
    ...technicianFooterRows(),
  ]);
}

export function renderAwaitingPhotoMessage(cancelPayload: string): MaxBotCommandResponse {
  return withKeyboard('ожидаю фото', [[callbackButton('Отмена', cancelPayload)]]);
}

export function renderCompleteReportPrompt(ticketId: string, ticketNumber: number): MaxBotCommandResponse {
  return withKeyboard('Опишите выполненные работы', [[callbackButton('Отмена', `tk:${ticketId}`)]]);
}

export function renderCompletePhotoAskMessage(ticketId: string, ticketNumber: number): MaxBotCommandResponse {
  return withKeyboard(`Добавить фото результата?\nЗаявка #${ticketNumber}`, [
    [
      callbackButton('Добавить фото', `tkq:${ticketId}`),
      callbackButton('Пропустить', `tkz:${ticketId}`),
      callbackButton('Отмена', `tk:${ticketId}`),
    ],
  ]);
}

export function renderCompleteDoneMessage(ticketId: string, ticketNumber: number, statusLabel: string): MaxBotCommandResponse {
  return withKeyboard(`Заявка #${ticketNumber}\nСтатус: ${statusLabel}`, [
    [callbackButton('К заявке', `tk:${ticketId}`), callbackButton('Мои заявки', 'my')],
    ...technicianFooterRows(),
  ]);
}
