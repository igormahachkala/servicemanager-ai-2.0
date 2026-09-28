import { renderInlineKeyboard } from './max-menu.builder';
import { MaxBotCommandResponse, MaxBotInlineKeyboardButton } from './max-bot.types';
import { callbackButton, masterPaginationRows } from './max-master-menu';

/** Selected linked client company id by MAX user id. Process memory only. */
const selectedByMaxUserId = new Map<string, string>();

export const MASTER_CLIENT_PAGE_SIZE = 3;

export type MasterLinkedClient = {
  id: string;
  name: string;
  role: string;
};

export function getMasterLinkedClient(maxUserId: string): string | null {
  return selectedByMaxUserId.get(maxUserId) ?? null;
}

export function setMasterLinkedClient(maxUserId: string, linkedClientCompanyId: string): void {
  const id = linkedClientCompanyId.trim();
  if (!id) return;
  selectedByMaxUserId.set(maxUserId, id);
}

export function clearMasterLinkedClient(maxUserId: string): void {
  selectedByMaxUserId.delete(maxUserId);
}

/** Test helper. */
export function resetMasterLinkedClientsForTests(): void {
  selectedByMaxUserId.clear();
}

export type MasterClientPickerPage = {
  items: MasterLinkedClient[];
  currentName: string | null;
  prevOffset: number | null;
  nextOffset: number | null;
};

export function toMasterClientPickerPage(
  clients: MasterLinkedClient[],
  offset = 0,
  currentId: string | null = null,
): MasterClientPickerPage {
  const start = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  const size = MASTER_CLIENT_PAGE_SIZE;
  const current = currentId ? clients.find((item) => item.id === currentId) : null;
  return {
    items: clients.slice(start, start + size),
    currentName: current?.name ?? null,
    prevOffset: start > 0 ? Math.max(0, start - size) : null,
    nextOffset: start + size < clients.length ? start + size : null,
  };
}

export function renderMasterNoLinkedClientsMessage(): MaxBotCommandResponse {
  return {
    text: 'Сервис Менеджер\n\nСвязанных клиентов нет.\nОбратитесь к администратору подрядчика.',
  };
}

export function renderMasterClientPickerMessage(page: MasterClientPickerPage): MaxBotCommandResponse {
  const lines = [
    'Выберите клиента',
    page.currentName ? `Сейчас: ${page.currentName}` : null,
    '',
    'Нажмите кнопку с именем клиента.',
  ].filter(Boolean) as string[];
  const rows: MaxBotInlineKeyboardButton[][] = page.items.map((item) => [
    callbackButton(clipLabel(item.name), `mcl:${item.id}`),
  ]);
  const keyboard = renderInlineKeyboard([
    ...rows,
    ...masterPaginationRows(
      page.prevOffset !== null ? `mcp:${page.prevOffset}` : null,
      page.nextOffset !== null ? `mcp:${page.nextOffset}` : null,
    ),
  ]);
  return {
    text: lines.join('\n'),
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}

function clipLabel(name: string, max = 28) {
  const compact = name.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact || 'Клиент';
  return `${compact.slice(0, max - 1).trimEnd()}…`;
}
