import {
  isChatCallbackPayload,
  menuMessage,
  nextPageRows,
  parseChatPage,
  sectionMessage,
  technicianMenuRows,
} from './max-chat-keyboard';

describe('max-chat-keyboard', () => {
  it('accepts chat callback payloads and pages', () => {
    expect(isChatCallbackPayload('today')).toBe(true);
    expect(isChatCallbackPayload('my:5')).toBe(true);
    expect(isChatCallbackPayload('claim_ticket_123')).toBe(false);
    expect(parseChatPage('my', 'my')).toBe(0);
    expect(parseChatPage('my:10', 'my')).toBe(10);
  });

  it('lays out six technician actions in three rows of two', () => {
    const rows = technicianMenuRows();
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.length === 2)).toBe(true);
    expect(rows.flat().map((button) => button.text)).toEqual([
      'Сегодня',
      'Мои заявки',
      'Доступные',
      'Обходы',
      'Моя смена',
      'Поиск заявки',
    ]);
  });

  it('puts the footer under a section without repeating the full menu', () => {
    const menu = menuMessage('меню');
    const section = sectionMessage('сводка');
    expect(menu.attachments?.[0]?.payload.buttons.flat().map((b) => b.text)).toContain('Поиск заявки');
    expect(section.attachments?.[0]?.payload.buttons.flat().map((b) => b.text)).toEqual([
      'Сегодня',
      'Моя смена',
      'Мои заявки',
    ]);
  });

  it('adds Следующие as a single extra row', () => {
    expect(nextPageRows('my', 5)).toEqual([[{ type: 'callback', text: 'Следующие', payload: 'my:5' }]]);
  });
});
