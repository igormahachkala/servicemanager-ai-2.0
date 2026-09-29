import { MaxBotCommandResponse } from './max-bot.types';
import {
  MASTER_ROUND_PAGE_SIZE,
  callbackButton,
  chunk2,
  masterPaginationRows,
  withKeyboard,
} from './max-master-menu';

export const MASTER_ROUND_REPORT_PAGE_SIZE = 6;

export type MasterRoundListItem = {
  runId: string | null;
  scheduleId: string;
  locationName: string;
  timeLabel: string;
  technicianName: string;
  statusLabel: string;
  progressLabel: string;
};

export type MasterRoundListPage = {
  items: MasterRoundListItem[];
  prevOffset: number | null;
  nextOffset: number | null;
};

export type MasterRoundProgress = {
  runId: string;
  closedCount: number;
  totalCount: number;
  currentTitle: string | null;
  technicianName: string;
  completed: boolean;
};

export type MasterRoundReportItem = {
  title: string;
  status: 'ok' | 'issue' | 'critical' | 'skipped';
  ticketId: string | null;
  ticketNumber: number | null;
};

export type MasterRoundReportView = {
  runId: string;
  items: MasterRoundReportItem[];
};

export function renderMasterRoundListMessage(page: MasterRoundListPage): MaxBotCommandResponse {
  if (page.items.length === 0) {
    return withKeyboard('На сегодня назначений нет.', []);
  }
  const body = page.items
    .map(
      (item) =>
        `${item.timeLabel} · ${item.locationName}\n${item.technicianName} · ${item.statusLabel} · ${item.progressLabel}`,
    )
    .join('\n\n');
  const opens = page.items.map((item) =>
    callbackButton(
      item.locationName.slice(0, 16),
      item.runId ? `mp:${item.runId}` : `mq:${item.scheduleId}`,
    ),
  );
  return withKeyboard(`Обходы сегодня\n\n${body}`, [
    ...opens.map((button) => [button]),
    ...masterPaginationRows(
      page.prevOffset !== null ? `mr:${page.prevOffset}` : null,
      page.nextOffset !== null ? `mr:${page.nextOffset}` : null,
    ),
  ]);
}

export function renderMasterRoundProgressMessage(view: MasterRoundProgress): MaxBotCommandResponse {
  const text = [
    'Обход',
    `${view.closedCount} из ${view.totalCount} пунктов закрыто`,
    view.currentTitle ? `Текущий: ${view.currentTitle}` : 'Текущего пункта нет',
    `Исполнитель: ${view.technicianName}`,
  ].join('\n');
  const actions = view.completed
    ? [[callbackButton('К итогам', `mz:${view.runId}`)]]
    : [];
  return withKeyboard(text, actions);
}

export function renderMasterRoundNotStartedMessage(locationName: string): MaxBotCommandResponse {
  return withKeyboard(`Обход на объекте ${locationName} ещё не начат.`, []);
}

export function renderMasterRoundReportMessage(
  report: MasterRoundReportView,
  offset = 0,
): MaxBotCommandResponse {
  const lines = report.items.map((item) => {
    if (item.status === 'ok') return `${item.title}: норма`;
    if (item.status === 'skipped') return `${item.title}: пропущен`;
    const severity = item.status === 'critical' ? 'критично' : 'проблема';
    const ticket = item.ticketNumber ? ` · заявка #${item.ticketNumber}` : '';
    return `${item.title}: ${severity}${ticket}`;
  });
  const ticketButtons = report.items
    .filter((item) => item.ticketId && item.ticketNumber)
    .map((item) => callbackButton(`Открыть #${item.ticketNumber}`, `mk:${item.ticketId}`));
  const start = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  const pageButtons = ticketButtons.slice(start, start + MASTER_ROUND_REPORT_PAGE_SIZE);
  const prevOffset = start > 0 ? Math.max(0, start - MASTER_ROUND_REPORT_PAGE_SIZE) : null;
  const nextOffset =
    start + MASTER_ROUND_REPORT_PAGE_SIZE < ticketButtons.length
      ? start + MASTER_ROUND_REPORT_PAGE_SIZE
      : null;
  return withKeyboard(['Итог обхода', '', ...lines].join('\n'), [
    ...chunk2(pageButtons),
    ...masterPaginationRows(
      prevOffset !== null ? `mz:${report.runId}:${prevOffset}` : null,
      nextOffset !== null ? `mz:${report.runId}:${nextOffset}` : null,
    ),
  ]);
}

export function toMasterRoundListPage(items: MasterRoundListItem[], offset = 0): MasterRoundListPage {
  const size = MASTER_ROUND_PAGE_SIZE;
  const start = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  return {
    items: items.slice(start, start + size),
    prevOffset: start > 0 ? Math.max(0, start - size) : null,
    nextOffset: start + size < items.length ? start + size : null,
  };
}
