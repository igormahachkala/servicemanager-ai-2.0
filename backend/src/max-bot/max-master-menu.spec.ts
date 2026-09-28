import { UserRole } from '@prisma/client';

import {
  callbackButton,
  isMasterMenuRole,
  isMasterSectionPayload,
  matchMasterMenuLabel,
  matchMasterSlashCommand,
  renderMasterMenuMessage,
  withKeyboard,
} from './max-master-menu';

function labelsOf(response: ReturnType<typeof renderMasterMenuMessage>) {
  return response.attachments?.[0]?.payload.buttons.flat().map((button) => button.text) || [];
}

describe('max-master-menu', () => {
  it('renders the six coordinator callbacks in three rows of two', () => {
    const res = renderMasterMenuMessage();
    expect(res.text).toContain('Выберите действие');
    const rows = res.attachments?.[0]?.payload.buttons || [];
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.length === 2)).toBe(true);
    expect(labelsOf(res)).toEqual([
      'Сегодня',
      'Просрочено',
      'Заявки',
      'Без исполнителя',
      'Техники',
      'Обходы',
    ]);
    expect(labelsOf(res)).not.toContain('Меню');
    expect(labelsOf(res)).not.toContain('Сменить клиента');
  });

  it('adds Сменить клиента on its own fourth row when asked', () => {
    const res = renderMasterMenuMessage({ showChangeClient: true });
    const rows = res.attachments?.[0]?.payload.buttons || [];
    expect(rows).toHaveLength(4);
    expect(rows[3]).toEqual([{ type: 'callback', text: 'Сменить клиента', payload: 'mcc' }]);
  });

  it('puts Меню last on its own row and does not duplicate it', () => {
    const added = withKeyboard('экран', [[callbackButton('Сегодня', 'today')]]);
    const rows = added.attachments?.[0]?.payload.buttons || [];
    expect(rows.at(-1)).toEqual([{ type: 'callback', text: 'Меню', payload: 'menu' }]);

    const kept = withKeyboard('карточка', [[callbackButton('Меню', 'menu')]]);
    expect(kept.attachments?.[0]?.payload.buttons).toEqual([[{ type: 'callback', text: 'Меню', payload: 'menu' }]]);

    const withCancel = withKeyboard('список', [
      [callbackButton('Меню', 'menu'), callbackButton('Отмена', 'tickets')],
    ]);
    expect(withCancel.attachments?.[0]?.payload.buttons).toEqual([
      [
        { type: 'callback', text: 'Меню', payload: 'menu' },
        { type: 'callback', text: 'Отмена', payload: 'tickets' },
      ],
    ]);
  });

  it('matches labels and slash commands', () => {
    expect(matchMasterMenuLabel('Заявки')).toBe('tickets');
    expect(matchMasterMenuLabel('  Без исполнителя  ')).toBe('unassigned');
    expect(matchMasterMenuLabel('Мои заявки')).toBeNull();
    expect(matchMasterSlashCommand('/tickets')).toBe('tickets');
    expect(matchMasterSlashCommand('/sla')).toBe('sla');
    expect(isMasterSectionPayload('unassigned')).toBe(true);
    expect(isMasterSectionPayload('my')).toBe(false);
  });

  it.each([UserRole.MASTER, UserRole.ADMIN, UserRole.DISPATCHER])('%s is a master-menu role', (role) => {
    expect(isMasterMenuRole(role)).toBe(true);
  });

  it.each([UserRole.TECHNICIAN, UserRole.CLIENT, UserRole.NETWORK_DIRECTOR, UserRole.TERRITORIAL_MANAGER])(
    '%s is not a master-menu role',
    (role) => {
      expect(isMasterMenuRole(role)).toBe(false);
    },
  );
});
