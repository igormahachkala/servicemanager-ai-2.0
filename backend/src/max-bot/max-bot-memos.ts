import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { appendBoundServiceFooter } from './max-bot-report-footer';
import { renderInlineKeyboard } from './max-menu.builder';
import { MaxBotCommandResponse, MaxBotInlineKeyboardButton } from './max-bot.types';

export type MemoContour = 'technician' | 'master' | 'common';

export type MemoEntry = {
  id: string;
  file: string;
  title: string;
  contour: MemoContour;
};

export type MemoViewerRole = 'technician' | 'master';

export type MemosAction =
  | { kind: 'list'; page: number }
  | { kind: 'one'; id: string }
  | { kind: 'all'; scope: 'role' | 'master' | 'technician' };

export const MEMOS_MENU_LABEL = 'Памятки';
export const MEMOS_MENU_PAYLOAD = 'memos';
export const MEMOS_PAGE_SIZE = 6;
export const MEMOS_BATCH_SIZE = 8;
export const MEMOS_BATCH_DELAY_MS = 400;

const CONTOURS = new Set<MemoContour>(['technician', 'master', 'common']);

let cachedManifest: MemoEntry[] | null = null;
let cachedDir: string | null = null;

export function resolveMemosAssetsDir(cwd = process.cwd(), dirname = __dirname): string {
  const candidates = [
    join(cwd, 'assets', 'max-bot-memos'),
    join(dirname, '..', '..', 'assets', 'max-bot-memos'),
    join(dirname, '..', '..', '..', 'assets', 'max-bot-memos'),
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'memos.json'))) return candidate;
  }
  return candidates[0];
}

export function loadMemosManifest(dir = resolveMemosAssetsDir()): MemoEntry[] {
  if (cachedManifest && cachedDir === dir) return cachedManifest;
  const raw = JSON.parse(readFileSync(join(dir, 'memos.json'), 'utf8')) as {
    memos?: unknown;
  };
  if (!Array.isArray(raw.memos)) throw new Error('memos.json: expected memos array');
  const entries: MemoEntry[] = [];
  for (const item of raw.memos) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const file = typeof row.file === 'string' ? row.file.trim() : '';
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const contour = row.contour;
    if (!id || !file || !title || typeof contour !== 'string' || !CONTOURS.has(contour as MemoContour)) {
      throw new Error(`memos.json: invalid entry ${JSON.stringify(item)}`);
    }
    entries.push({ id, file, title, contour: contour as MemoContour });
  }
  cachedManifest = entries;
  cachedDir = dir;
  return entries;
}

/** Test helper: drop cached manifest between specs. */
export function resetMemosManifestCache(): void {
  cachedManifest = null;
  cachedDir = null;
}

export function memosVisibleForRole(role: MemoViewerRole, entries = loadMemosManifest()): MemoEntry[] {
  return entries.filter((entry) => entry.contour === 'common' || entry.contour === role);
}

export function memosByContour(contour: MemoContour, entries = loadMemosManifest()): MemoEntry[] {
  return entries.filter((entry) => entry.contour === contour);
}

export function findMemoById(id: string, entries = loadMemosManifest()): MemoEntry | null {
  return entries.find((entry) => entry.id === id) ?? null;
}

export function selectMemosForBatch(
  scope: 'role' | 'master' | 'technician',
  role: MemoViewerRole,
  entries = loadMemosManifest(),
): MemoEntry[] {
  if (scope === 'master') return memosByContour('master', entries);
  if (scope === 'technician') return memosByContour('technician', entries);
  return memosVisibleForRole(role, entries);
}

export function isMemosCallbackPayload(payload: string): boolean {
  return payload === MEMOS_MENU_PAYLOAD || payload.startsWith('memos:') || payload.startsWith('memo:');
}

export function parseMemosAction(payload: string): MemosAction | null {
  if (payload === MEMOS_MENU_PAYLOAD) return { kind: 'list', page: 0 };
  if (payload.startsWith('memos:p:')) {
    const page = Number(payload.slice('memos:p:'.length));
    if (!Number.isInteger(page) || page < 0) return null;
    return { kind: 'list', page };
  }
  if (payload === 'memos:all') return { kind: 'all', scope: 'role' };
  if (payload === 'memos:all:m') return { kind: 'all', scope: 'master' };
  if (payload === 'memos:all:t') return { kind: 'all', scope: 'technician' };
  if (payload.startsWith('memo:')) {
    const id = payload.slice('memo:'.length).trim();
    if (!id || id.includes(':')) return null;
    return { kind: 'one', id };
  }
  return null;
}

function callbackButton(text: string, payload: string): MaxBotInlineKeyboardButton {
  return { type: 'callback', text, payload };
}

function chunk2(buttons: MaxBotInlineKeyboardButton[]): MaxBotInlineKeyboardButton[][] {
  const rows: MaxBotInlineKeyboardButton[][] = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  return rows;
}

export function memosMenuButton(): MaxBotInlineKeyboardButton {
  return callbackButton(MEMOS_MENU_LABEL, MEMOS_MENU_PAYLOAD);
}

export function renderMemosListMessage(
  role: MemoViewerRole,
  page = 0,
  entries = loadMemosManifest(),
): MaxBotCommandResponse {
  const visible = memosVisibleForRole(role, entries);
  const safePage = Math.max(0, Math.min(page, Math.max(0, Math.ceil(visible.length / MEMOS_PAGE_SIZE) - 1)));
  const start = safePage * MEMOS_PAGE_SIZE;
  const slice = visible.slice(start, start + MEMOS_PAGE_SIZE);
  const memoButtons = slice.map((entry) => callbackButton(entry.title, `memo:${entry.id}`));
  const rows: MaxBotInlineKeyboardButton[][] = [
    ...chunk2(memoButtons),
    [callbackButton('Получить все памятки', 'memos:all')],
    [callbackButton('Получить все памятки мастера', 'memos:all:m')],
    [callbackButton('Получить все памятки техника', 'memos:all:t')],
  ];
  const prev = safePage > 0 ? `memos:p:${safePage - 1}` : null;
  const next = start + MEMOS_PAGE_SIZE < visible.length ? `memos:p:${safePage + 1}` : null;
  if (prev || next) {
    const pageRow: MaxBotInlineKeyboardButton[] = [];
    if (prev) pageRow.push(callbackButton('Предыдущие', prev));
    if (next) pageRow.push(callbackButton('Следующие', next));
    rows.push(pageRow);
  }
  const withFooter = appendBoundServiceFooter(rows);
  const keyboard = renderInlineKeyboard(withFooter);
  const pageLabel =
    visible.length > MEMOS_PAGE_SIZE
      ? `\nСтраница ${safePage + 1} из ${Math.ceil(visible.length / MEMOS_PAGE_SIZE)}.`
      : '';
  return {
    text: `Памятки\n\nВыберите экран или получите набор целиком.${pageLabel}`,
    kind: 'memos:list',
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}

export function renderMemosSentMessage(count: number): MaxBotCommandResponse {
  const rows = appendBoundServiceFooter([[callbackButton('Назад', MEMOS_MENU_PAYLOAD)]]);
  const keyboard = renderInlineKeyboard(rows);
  return {
    text: `Отправлено ${count} памяток`,
    kind: 'memos:sent',
    ...(keyboard ? { attachments: [keyboard] } : {}),
  };
}

export function memoFilePath(entry: MemoEntry, dir = resolveMemosAssetsDir()): string {
  return join(dir, entry.file);
}
