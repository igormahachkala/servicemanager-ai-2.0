import { UserRole } from '@prisma/client';

import { renderInlineKeyboard, renderPersistentMenuMessage } from './max-menu.builder';
import { MaxBotCommandResponse, MaxBotInlineKeyboardButton } from './max-bot.types';

export type MasterSectionPayload = 'today' | 'tickets' | 'unassigned' | 'techs' | 'rounds' | 'sla';

export const MASTER_MENU_ROLES = new Set<UserRole>([
  UserRole.MASTER,
  UserRole.ADMIN,
  UserRole.DISPATCHER,
  UserRole.NETWORK_DIRECTOR,
]);

export const MASTER_SECTIONS: readonly { payload: MasterSectionPayload; label: string }[] = [
  { payload: 'today', label: 'Сегодня' },
  { payload: 'tickets', label: 'Заявки' },
  { payload: 'unassigned', label: 'Без исполнителя' },
  { payload: 'techs', label: 'Техники' },
  { payload: 'rounds', label: 'Обходы' },
  { payload: 'sla', label: 'Просрочено' },
];

export const MASTER_PAGE_SIZE = 3;
export const MASTER_ASSIGN_PAGE_SIZE = 1;
export const MASTER_CANDIDATE_PAGE_SIZE = 2;
export const MASTER_HISTORY_PAGE_SIZE = 3;
export const MASTER_TECH_PAGE_SIZE = 2;
export const MASTER_ROUND_PAGE_SIZE = 2;

const LABEL_BY_PAYLOAD: Record<MasterSectionPayload, string> = Object.fromEntries(
  MASTER_SECTIONS.map((item) => [item.payload, item.label]),
) as Record<MasterSectionPayload, string>;

const PAYLOAD_BY_LABEL: Record<string, MasterSectionPayload> = Object.fromEntries(
  MASTER_SECTIONS.map((item) => [item.label, item.payload]),
) as Record<string, MasterSectionPayload>;

const SECTION_PAYLOADS = new Set<string>(MASTER_SECTIONS.map((item) => item.payload));

const SLASH_BY_COMMAND: Record<string, MasterSectionPayload> = {
  '/today': 'today',
  '/tickets': 'tickets',
  '/unassigned': 'unassigned',
  '/techs': 'techs',
  '/rounds': 'rounds',
  '/sla': 'sla',
};

export function isMasterMenuRole(role: UserRole): boolean {
  return MASTER_MENU_ROLES.has(role);
}

export function isMasterSectionPayload(payload: string): payload is MasterSectionPayload {
  return SECTION_PAYLOADS.has(payload);
}

export function matchMasterMenuLabel(text: string): MasterSectionPayload | null {
  return PAYLOAD_BY_LABEL[text.trim()] ?? null;
}

export function matchMasterSlashCommand(cmd: string): MasterSectionPayload | null {
  return SLASH_BY_COMMAND[cmd] ?? null;
}

export function callbackButton(text: string, payload: string): MaxBotInlineKeyboardButton {
  return { type: 'callback', text, payload };
}

export function chunk3(buttons: MaxBotInlineKeyboardButton[]): MaxBotInlineKeyboardButton[][] {
  const rows: MaxBotInlineKeyboardButton[][] = [];
  for (let i = 0; i < buttons.length; i += 3) rows.push(buttons.slice(i, i + 3));
  return rows;
}

export function withKeyboard(text: string, rows: MaxBotInlineKeyboardButton[][]): MaxBotCommandResponse {
  const keyboard = renderInlineKeyboard(rows);
  return {
    text,
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}

export function masterFooterRows(): MaxBotInlineKeyboardButton[][] {
  return [
    [
      callbackButton('Сегодня', 'today'),
      callbackButton('Без исполнителя', 'unassigned'),
      callbackButton('Просрочено', 'sla'),
    ],
  ];
}

export function masterPaginationRows(prevPayload: string | null, nextPayload: string | null) {
  const row: MaxBotInlineKeyboardButton[] = [];
  if (prevPayload) row.push(callbackButton('Предыдущие', prevPayload));
  if (nextPayload) row.push(callbackButton('Следующие', nextPayload));
  return row.length ? [row] : [];
}

function technicianMenuRows(): MaxBotInlineKeyboardButton[][] {
  const buttons = MASTER_SECTIONS.map((item) => callbackButton(item.label, item.payload));
  return [buttons.slice(0, 3), buttons.slice(3, 6)].filter((row) => row.length > 0);
}

export function renderMasterMenuMessage(): MaxBotCommandResponse {
  const keyboard = renderInlineKeyboard(technicianMenuRows());
  return {
    text: 'Сервис Менеджер\n\nВыберите действие.',
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}

export function renderMasterUnavailableMessage(): MaxBotCommandResponse {
  return renderPersistentMenuMessage('Заявка недоступна');
}
