import {
  MaxBotScreenJournal,
  screenEntryFromResponse,
  shouldSkipScreenJournal,
  truncateScreenText,
} from './max-bot-screen-journal';
import type { MaxBotCommandResponse } from './max-bot.types';

function entry(kind: string, text: string) {
  return {
    at: new Date().toISOString(),
    kind,
    text,
    buttons: [] as string[][],
  };
}

describe('MaxBotScreenJournal', () => {
  it('trims the ring to the last 10 screens', () => {
    const journal = new MaxBotScreenJournal();
    for (let i = 1; i <= 12; i += 1) {
      journal.push('user-1', entry('menu', `screen-${i}`));
    }

    const snap = journal.snapshot('user-1');
    expect(snap).toHaveLength(10);
    expect(snap[0].text).toBe('screen-3');
    expect(snap[9].text).toBe('screen-12');
  });

  it('snapshot is independent of later pushes', () => {
    const journal = new MaxBotScreenJournal();
    journal.push('user-1', entry('menu', 'first'));
    journal.push('user-1', entry('today', 'second'));

    const snap = journal.snapshot('user-1');
    expect(snap).toHaveLength(2);

    journal.push('user-1', entry('dialog', 'third'));
    snap[0].text = 'mutated';
    snap[0].buttons.push(['x']);

    const later = journal.snapshot('user-1');
    expect(later).toHaveLength(3);
    expect(later[0].text).toBe('first');
    expect(later[0].buttons).toEqual([]);
    expect(later[2].text).toBe('third');
  });

  it('clear removes the ring for a user', () => {
    const journal = new MaxBotScreenJournal();
    journal.push('user-1', entry('menu', 'one'));
    journal.clear('user-1');
    expect(journal.snapshot('user-1')).toEqual([]);
  });

  it('truncates long text and skips report dialog screens', () => {
    expect(truncateScreenText('a'.repeat(520)).length).toBe(500);

    const report: MaxBotCommandResponse = {
      text: 'Опишите ошибку',
      kind: 'report:prompt',
    };
    expect(shouldSkipScreenJournal(report)).toBe(true);
    expect(shouldSkipScreenJournal({ text: 'ok', skipJournal: true })).toBe(true);
    expect(shouldSkipScreenJournal({ text: 'ok', kind: 'menu' })).toBe(false);

    const fromResponse = screenEntryFromResponse({
      text: 'Карточка',
      kind: 'ticket-card',
      attachments: [
        {
          type: 'inline_keyboard',
          payload: {
            buttons: [
              [
                { type: 'callback', text: 'Статус', payload: 'st' },
                { type: 'callback', text: 'Меню', payload: 'menu' },
              ],
            ],
          },
        },
      ],
    });
    expect(fromResponse.kind).toBe('ticket-card');
    expect(fromResponse.buttons).toEqual([['Статус', 'Меню']]);
  });
});
