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
  it('renders the six coordinator callbacks in two rows of three', () => {
    const res = renderMasterMenuMessage();
    expect(res.text).toContain('Выберите действие');
    const rows = res.attachments?.[0]?.payload.buttons || [];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(3);
    expect(labelsOf(res)).toEqual([
      'Сегодня',
      'Заявки',
      'Без исполнителя',
      'Техники',
      'Обходы',
      'Просрочено',
    ]);
    expect(labelsOf(res)).not.toContain('Меню');
  });

  it('puts Меню last on its own row and does not duplicate it', () => {
    const added = withKeyboard('экран', [[callbackButton('Сегодня', 'today')]]);
    const rows = added.attachments?.[0]?.payload.buttons || [];
    expect(rows.at(-1)).toEqual([{ type: 'callback', text: 'Меню', payload: 'menu' }]);

    const kept = withKeyboard('карточка', [[callbackButton('Меню', 'menu')]]);
    expect(kept.attachments?.[0]?.payload.buttons).toEqual([[{ type: 'callback', text: 'Меню', payload: 'menu' }]]);
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
