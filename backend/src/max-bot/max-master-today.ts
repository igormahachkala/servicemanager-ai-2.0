import { callbackButton, masterFooterRows, withKeyboard } from './max-master-menu';
import { MaxBotCommandResponse } from './max-bot.types';

export type MasterTodaySummary = {
  newCount: number;
  unassignedCount: number;
  inProgressCount: number;
  overdueCount: number;
  onShiftCount: number;
  roundsTodayCount: number;
};

export function renderMasterTodayMessage(summary: MasterTodaySummary): MaxBotCommandResponse {
  const text = [
    'Сегодня',
    '',
    `Новых: ${summary.newCount}`,
    `Без исполнителя: ${summary.unassignedCount}`,
    `В работе: ${summary.inProgressCount}`,
    `Просрочено: ${summary.overdueCount}`,
    `На смене: ${summary.onShiftCount}`,
    `Обходы сегодня: ${summary.roundsTodayCount}`,
  ].join('\n');
  return withKeyboard(text, [
    [
      callbackButton('Без исполнителя', 'unassigned'),
      callbackButton('Техники', 'techs'),
      callbackButton('Обходы', 'rounds'),
    ],
    [callbackButton('Просрочено', 'sla')],
    ...masterFooterRows(),
  ]);
}
