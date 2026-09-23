import { MaxBotCommandResponse } from './max-bot.types';
import {
  MASTER_ROUND_PAGE_SIZE,
  callbackButton,
  chunk3,
  masterPaginationRows,
  withKeyboard,
} from './max-master-menu';

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
    ...chunk3(opens),
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

export function renderMasterRoundReportMessage(report: MasterRoundReportView): MaxBotCommandResponse {
  const lines = report.items.map((item) => {
    if (item.status === 'ok') return `${item.title}: норма`;
    if (item.status === 'skipped') return `${item.title}: пропущен`;
    const severity = item.status === 'critical' ? 'критично' : 'проблема';
    const ticket = item.ticketNumber ? ` · заявка #${item.ticketNumber}` : '';
    return `${item.title}: ${severity}${ticket}`;
  });
  const ticketButtons = report.items
    .filter((item) => item.ticketId && item.ticketNumber)
    .slice(0, 3)
    .map((item) => callbackButton(`Открыть #${item.ticketNumber}`, `mk:${item.ticketId}`));
  return withKeyboard(['Итог обхода', '', ...lines].join('\n'), [...chunk3(ticketButtons)]);
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
