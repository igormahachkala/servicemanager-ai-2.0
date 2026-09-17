import { renderInlineKeyboard, renderPersistentMenuMessage } from './max-menu.builder';
import { MaxBotCommandResponse, MaxBotInlineKeyboardButton } from './max-bot.types';

export type TechnicianSectionPayload = 'today' | 'my' | 'avail' | 'rounds' | 'shift' | 'find';

export type TechnicianShiftActionPayload = 'shift_open' | 'shift_close' | 'shift_yes' | 'shift_no';

export const TECHNICIAN_SECTIONS: readonly { payload: TechnicianSectionPayload; label: string }[] = [
  { payload: 'today', label: 'Сегодня' },
  { payload: 'my', label: 'Мои заявки' },
  { payload: 'avail', label: 'Доступные' },
  { payload: 'rounds', label: 'Обходы' },
  { payload: 'shift', label: 'Моя смена' },
  { payload: 'find', label: 'Поиск заявки' },
];

export const BOUND_ROLE_STUB_TEXT = 'Этот функционал в разработке';

const LABEL_BY_PAYLOAD: Record<TechnicianSectionPayload, string> = Object.fromEntries(
  TECHNICIAN_SECTIONS.map((item) => [item.payload, item.label]),
) as Record<TechnicianSectionPayload, string>;

const PAYLOAD_BY_LABEL: Record<string, TechnicianSectionPayload> = Object.fromEntries(
  TECHNICIAN_SECTIONS.map((item) => [item.label, item.payload]),
) as Record<string, TechnicianSectionPayload>;

const SECTION_PAYLOADS = new Set<string>(TECHNICIAN_SECTIONS.map((item) => item.payload));

const SHIFT_ACTION_PAYLOADS = new Set<string>(['shift_open', 'shift_close', 'shift_yes', 'shift_no']);

export function isTechnicianSectionPayload(payload: string): payload is TechnicianSectionPayload {
  return SECTION_PAYLOADS.has(payload);
}

export function isTechnicianShiftActionPayload(
  payload: string,
): payload is TechnicianShiftActionPayload {
  return SHIFT_ACTION_PAYLOADS.has(payload);
}

export function technicianSectionLabel(payload: TechnicianSectionPayload): string {
  return LABEL_BY_PAYLOAD[payload];
}

export function matchTechnicianMenuLabel(text: string): TechnicianSectionPayload | null {
  return PAYLOAD_BY_LABEL[text.trim()] ?? null;
}

function callbackButton(text: string, payload: string): MaxBotInlineKeyboardButton {
  return { type: 'callback', text, payload };
}

function technicianMenuRows(): MaxBotInlineKeyboardButton[][] {
  const buttons: MaxBotInlineKeyboardButton[] = TECHNICIAN_SECTIONS.map((item) =>
    callbackButton(item.label, item.payload),
  );
  return [buttons.slice(0, 3), buttons.slice(3, 6)];
}

/** Футер экранов техника: Сегодня / Моя смена / Мои заявки. */
export function technicianFooterRows(): MaxBotInlineKeyboardButton[][] {
  return [[
    callbackButton('Сегодня', 'today'),
    callbackButton('Моя смена', 'shift'),
    callbackButton('Мои заявки', 'my'),
  ]];
}

export function renderTechnicianMenuMessage(): MaxBotCommandResponse {
  const keyboard = renderInlineKeyboard(technicianMenuRows());
  return {
    text: 'Сервис Менеджер\n\nВыберите действие.',
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}

export function renderTechnicianFooterMessage(text: string): MaxBotCommandResponse {
  const keyboard = renderInlineKeyboard(technicianFooterRows());
  return {
    text,
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}

/** Ещё не сделанные разделы: имя пункта и футер, без чужих заявок. */
export function renderTechnicianSectionMessage(payload: TechnicianSectionPayload): MaxBotCommandResponse {
  return renderTechnicianFooterMessage(technicianSectionLabel(payload));
}

export function renderBoundRoleStubMessage(): MaxBotCommandResponse {
  return renderPersistentMenuMessage(BOUND_ROLE_STUB_TEXT);
}
