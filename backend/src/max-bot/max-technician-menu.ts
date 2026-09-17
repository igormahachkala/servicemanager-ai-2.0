import { renderInlineKeyboard } from './max-menu.builder';
import { MaxBotCommandResponse, MaxBotInlineKeyboardButton } from './max-bot.types';

export type TechnicianSectionPayload = 'today' | 'my' | 'avail' | 'rounds' | 'shift' | 'find';

export const TECHNICIAN_SECTIONS: readonly { payload: TechnicianSectionPayload; label: string }[] = [
  { payload: 'today', label: 'Сегодня' },
  { payload: 'my', label: 'Мои заявки' },
  { payload: 'avail', label: 'Доступные' },
  { payload: 'rounds', label: 'Обходы' },
  { payload: 'shift', label: 'Моя смена' },
  { payload: 'find', label: 'Поиск заявки' },
];

const LABEL_BY_PAYLOAD: Record<TechnicianSectionPayload, string> = Object.fromEntries(
  TECHNICIAN_SECTIONS.map((item) => [item.payload, item.label]),
) as Record<TechnicianSectionPayload, string>;

const PAYLOAD_BY_LABEL: Record<string, TechnicianSectionPayload> = Object.fromEntries(
  TECHNICIAN_SECTIONS.map((item) => [item.label, item.payload]),
) as Record<string, TechnicianSectionPayload>;

const PAYLOADS = new Set<string>(TECHNICIAN_SECTIONS.map((item) => item.payload));

export function isTechnicianSectionPayload(payload: string): payload is TechnicianSectionPayload {
  return PAYLOADS.has(payload);
}

export function technicianSectionLabel(payload: TechnicianSectionPayload): string {
  return LABEL_BY_PAYLOAD[payload];
}

export function matchTechnicianMenuLabel(text: string): TechnicianSectionPayload | null {
  return PAYLOAD_BY_LABEL[text.trim()] ?? null;
}

function technicianMenuRows(): MaxBotInlineKeyboardButton[][] {
  const buttons: MaxBotInlineKeyboardButton[] = TECHNICIAN_SECTIONS.map((item) => ({
    type: 'callback',
    text: item.label,
    payload: item.payload,
  }));
  return [buttons.slice(0, 3), buttons.slice(3, 6)];
}

function withTechnicianKeyboard(text: string): MaxBotCommandResponse {
  const keyboard = renderInlineKeyboard(technicianMenuRows());
  return {
    text,
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}

export function renderTechnicianMenuMessage(): MaxBotCommandResponse {
  return withTechnicianKeyboard('Сервис Менеджер\n\nВыберите действие.');
}

export function renderTechnicianSectionMessage(payload: TechnicianSectionPayload): MaxBotCommandResponse {
  return withTechnicianKeyboard(technicianSectionLabel(payload));
}
