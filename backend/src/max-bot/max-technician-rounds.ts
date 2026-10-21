import { renderInlineKeyboard } from './max-menu.builder';
import { paginationRows, technicianMenuRow } from './max-technician-menu';
import { MaxBotCommandResponse, MaxBotInlineKeyboardButton } from './max-bot.types';

const ID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const ROUND_PAGE_SIZE = 6;
export const ROUND_PROBLEM_PROMPT = 'Опишите проблему';
export const ROUND_PHOTO_PROMPT = 'Добавить фото?';
export const ROUND_TICKET_PROMPT = 'Создать заявку из этого пункта?';

export type TechnicianRoundListItem = {
  scheduleId: string;
  runId: string | null;
  timeLabel: string;
  locationName: string;
  name: string;
  itemCount: number;
};

export type TechnicianRoundListPage = {
  items: TechnicianRoundListItem[];
  prevOffset: number | null;
  nextOffset: number | null;
};

export type TechnicianRoundItemView = {
  runId: string;
  itemId: string;
  locationName: string;
  index: number;
  total: number;
  equipmentName: string;
  checkText: string;
  normText: string;
};

export type TechnicianRoundBriefView = {
  runId: string;
  okCount: number;
  issueCount: number;
  criticalCount: number;
  createdTicketsCount: number;
  durationLabel: string;
};

export type TechnicianRoundReportItem = {
  title: string;
  status: 'ok' | 'issue' | 'critical' | 'skipped';
  ticketId: string | null;
  ticketNumber: number | null;
};

export type TechnicianRoundReportView = {
  runId: string;
  items: TechnicianRoundReportItem[];
};

export type TechnicianRoundTicketCreatedView = {
  runId: string;
  ticketId: string;
  ticketNumber: number;
};

export type TechnicianRoundAfterItem =
  | { kind: 'item'; item: TechnicianRoundItemView }
  | { kind: 'ticket-prompt'; runId: string; itemId: string }
  | { kind: 'brief'; brief: TechnicianRoundBriefView };

export function renderRoundAfterItem(screen: TechnicianRoundAfterItem): MaxBotCommandResponse {
  if (screen.kind === 'item') return renderRoundItemMessage(screen.item);
  if (screen.kind === 'ticket-prompt') return renderRoundTicketPrompt(screen.runId);
  return renderRoundBriefMessage(screen.brief);
}

export type TechnicianRoundAction =
  | { kind: 'roundList'; offset: number }
  | { kind: 'roundStart'; scheduleId: string }
  | { kind: 'roundContinue'; runId: string }
  | { kind: 'roundOk'; runId: string }
  | { kind: 'roundProblem'; runId: string }
  | { kind: 'roundCritical'; runId: string }
  | { kind: 'roundItem'; runId: string }
  | { kind: 'roundSkipPhoto'; runId: string }
  | { kind: 'roundCreateTicket'; runId: string }
  | { kind: 'roundNext'; runId: string }
  | { kind: 'roundReport'; runId: string }
  | { kind: 'roundCancel' };

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

function uuidPayload(prefix: string, payload: string): string | null {
  if (!payload.startsWith(`${prefix}:`)) return null;
  const id = payload.slice(prefix.length + 1);
  return ID_RE.test(id) ? id : null;
}

export function parseTechnicianRoundAction(payload: string): TechnicianRoundAction | null {
  if (payload === 'rcx') return { kind: 'roundCancel' };
  const page = payload.match(/^rd:(\d+)$/);
  if (page) return { kind: 'roundList', offset: Number(page[1]) };
  const start = uuidPayload('rst', payload);
  if (start) return { kind: 'roundStart', scheduleId: start };
  const cont = uuidPayload('rco', payload);
  if (cont) return { kind: 'roundContinue', runId: cont };
  const ok = uuidPayload('rok', payload);
  if (ok) return { kind: 'roundOk', runId: ok };
  const problem = uuidPayload('rpr', payload);
  if (problem) return { kind: 'roundProblem', runId: problem };
  const critical = uuidPayload('rcr', payload);
  if (critical) return { kind: 'roundCritical', runId: critical };
  const item = uuidPayload('rit', payload);
  if (item) return { kind: 'roundItem', runId: item };
  const skip = uuidPayload('rsk', payload);
  if (skip) return { kind: 'roundSkipPhoto', runId: skip };
  const create = uuidPayload('rct', payload);
  if (create) return { kind: 'roundCreateTicket', runId: create };
  const next = uuidPayload('rgo', payload);
  if (next) return { kind: 'roundNext', runId: next };
  const report = uuidPayload('rrp', payload);
  if (report) return { kind: 'roundReport', runId: report };
  return null;
}

export function toTechnicianRoundListPage(
  rows: TechnicianRoundListItem[],
  offset = 0,
): TechnicianRoundListPage {
  const start = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  return {
    items: rows.slice(start, start + ROUND_PAGE_SIZE),
    nextOffset: start + ROUND_PAGE_SIZE < rows.length ? start + ROUND_PAGE_SIZE : null,
    prevOffset: start > 0 ? Math.max(0, start - ROUND_PAGE_SIZE) : null,
  };
}

function formatListCard(item: TechnicianRoundListItem) {
  return [`${item.timeLabel} · ${item.locationName}`, `${item.name} · ${item.itemCount} пунктов`].join('\n');
}

export function renderRoundListMessage(page: TechnicianRoundListPage): MaxBotCommandResponse {
  if (page.items.length === 0) {
    return withKeyboard('Обходы\n\nНа сегодня назначений нет.', technicianMenuRow());
  }
  const actionRows = page.items.map((item) => {
    if (item.runId) return [callbackButton('Продолжить', `rco:${item.runId}`)];
    return [callbackButton('Начать', `rst:${item.scheduleId}`)];
  });
  return withKeyboard(['Обходы', '', page.items.map(formatListCard).join('\n\n')].join('\n'), [
    ...actionRows,
    ...paginationRows(
      page.prevOffset !== null ? `rd:${page.prevOffset}` : null,
      page.nextOffset !== null ? `rd:${page.nextOffset}` : null,
    ),
    ...technicianMenuRow(),
  ]);
}

export function renderRoundItemMessage(item: TechnicianRoundItemView): MaxBotCommandResponse {
  const text = [
    `Объект: ${item.locationName}`,
    `Пункт ${item.index} из ${item.total}`,
    `Оборудование: ${item.equipmentName}`,
    `Проверить: ${item.checkText}`,
    `Норма: ${item.normText}`,
  ].join('\n');
  return withKeyboard(text, [
    [
      callbackButton('Норма', `rok:${item.runId}`),
      callbackButton('Проблема', `rpr:${item.runId}`),
      callbackButton('Критично', `rcr:${item.runId}`),
    ],
    [callbackButton('Отмена', 'rcx')],
  ]);
}

export function renderRoundProblemPrompt(runId: string): MaxBotCommandResponse {
  return withKeyboard(ROUND_PROBLEM_PROMPT, [[callbackButton('Отмена', `rit:${runId}`)]]);
}

export function renderRoundPhotoPrompt(runId: string): MaxBotCommandResponse {
  return withKeyboard(ROUND_PHOTO_PROMPT, [
    [callbackButton('Без фото', `rsk:${runId}`), callbackButton('Отмена', `rit:${runId}`)],
  ]);
}

export function renderRoundTicketPrompt(runId: string): MaxBotCommandResponse {
  return withKeyboard(ROUND_TICKET_PROMPT, [
    [callbackButton('Создать заявку', `rct:${runId}`), callbackButton('Продолжить обход', `rgo:${runId}`)],
  ]);
}

export function renderRoundTicketCreatedMessage(
  created: TechnicianRoundTicketCreatedView,
): MaxBotCommandResponse {
  return withKeyboard(
    `Создана заявка #${created.ticketNumber}. Объект, оборудование, описание и фото перенесены`,
    [
      [
        callbackButton(`Открыть #${created.ticketNumber}`, `tk:${created.ticketId}`),
        callbackButton('Продолжить обход', `rgo:${created.runId}`),
      ],
    ],
  );
}

export function renderRoundBriefMessage(brief: TechnicianRoundBriefView): MaxBotCommandResponse {
  const text = [
    'Обход завершён',
    `Норма: ${brief.okCount}`,
    `Проблема: ${brief.issueCount}`,
    `Критично: ${brief.criticalCount}`,
    `Создано заявок: ${brief.createdTicketsCount}`,
    `Длительность: ${brief.durationLabel}`,
  ].join('\n');
  return withKeyboard(text, [
    [callbackButton('Посмотреть итог', `rrp:${brief.runId}`)],
    ...technicianMenuRow(),
  ]);
}

export function renderRoundReportMessage(report: TechnicianRoundReportView): MaxBotCommandResponse {
  const lines = report.items.map((item) => {
    if (item.status === 'ok') return `${item.title}: норма`;
    if (item.status === 'skipped') return `${item.title}: пропущен`;
    const severity = item.status === 'critical' ? 'критично' : 'проблема';
    const ticket = item.ticketNumber ? ` · заявка #${item.ticketNumber}` : '';
    return `${item.title}: ${severity}${ticket}`;
  });
  const ticketButtons = report.items
    .filter((item) => item.ticketId && item.ticketNumber)
    .map((item) => callbackButton(`Открыть #${item.ticketNumber}`, `tk:${item.ticketId}`));
  const rows: MaxBotInlineKeyboardButton[][] = [];
  for (let i = 0; i < ticketButtons.length; i += 3) rows.push(ticketButtons.slice(i, i + 3));
  return withKeyboard(['Итог обхода', '', ...lines].join('\n'), [...rows, ...technicianMenuRow()]);
}
