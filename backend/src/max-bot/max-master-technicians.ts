import { MaxBotCommandResponse } from './max-bot.types';
import {
  MASTER_TECH_PAGE_SIZE,
  callbackButton,
  masterFooterRows,
  masterPaginationRows,
  withKeyboard,
} from './max-master-menu';

export type MasterTechnicianListItem = {
  userId: string;
  name: string;
  openedLabel: string;
  inProgressCount: number;
  doneTodayCount: number;
};

export type MasterTechnicianListPage = {
  items: MasterTechnicianListItem[];
  prevOffset: number | null;
  nextOffset: number | null;
};

export function renderMasterTechniciansMessage(page: MasterTechnicianListPage): MaxBotCommandResponse {
  if (page.items.length === 0) {
    return withKeyboard('На смене никого нет.', masterFooterRows());
  }
  const body = page.items
    .map(
      (item) =>
        `${item.name}: с ${item.openedLabel}, в работе ${item.inProgressCount}, завершено сегодня ${item.doneTodayCount}`,
    )
    .join('\n');
  const buttons = page.items.map((item) => callbackButton(`Заявки ${shortName(item.name)}`, `mt:${item.userId}:0`));
  return withKeyboard(`Техники на смене\n\n${body}`, [
    ...buttons.map((button) => [button]),
    ...masterPaginationRows(
      page.prevOffset !== null ? `ms:${page.prevOffset}` : null,
      page.nextOffset !== null ? `ms:${page.nextOffset}` : null,
    ),
    ...masterFooterRows(),
  ]);
}

export function toMasterTechnicianPage(items: MasterTechnicianListItem[], offset = 0): MasterTechnicianListPage {
  const size = MASTER_TECH_PAGE_SIZE;
  const start = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  return {
    items: items.slice(start, start + size),
    prevOffset: start > 0 ? Math.max(0, start - size) : null,
    nextOffset: start + size < items.length ? start + size : null,
  };
}

function shortName(name: string) {
  const part = name.trim().split(/\s+/)[0] || name;
  return part.length > 12 ? `${part.slice(0, 11)}…` : part;
}
