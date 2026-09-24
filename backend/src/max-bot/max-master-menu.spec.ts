import { UserRole } from '@prisma/client';

import {
  isMasterMenuRole,
  isMasterSectionPayload,
  matchMasterMenuLabel,
  matchMasterSlashCommand,
  renderMasterMenuMessage,
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

  it.each([UserRole.MASTER, UserRole.ADMIN, UserRole.DISPATCHER, UserRole.NETWORK_DIRECTOR])(
    '%s is a master-menu role',
    (role) => {
      expect(isMasterMenuRole(role)).toBe(true);
    },
  );

  it.each([UserRole.TECHNICIAN, UserRole.CLIENT])('%s is not a master-menu role', (role) => {
    expect(isMasterMenuRole(role)).toBe(false);
  });
});
