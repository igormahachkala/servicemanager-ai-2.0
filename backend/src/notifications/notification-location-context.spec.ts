import {
  formatNotificationLocationContext,
  withNotificationLocationContext,
} from './notification-location-context';

describe('formatNotificationLocationContext', () => {
  it('город и точка складываются в «<Город> · <Точка>»', () => {
    expect(formatNotificationLocationContext({ city: 'Уфа', name: 'Фудзияма, Проспект Октября' })).toBe(
      'Уфа · Фудзияма, Проспект Октября',
    );
  });

  it('город отсутствует — остаётся имя точки', () => {
    expect(formatNotificationLocationContext({ city: null, name: 'Фудзияма' })).toBe('Фудзияма');
    expect(formatNotificationLocationContext({ city: '   ', name: 'Фудзияма' })).toBe('Фудзияма');
  });

  it('точка отсутствует — остаётся город', () => {
    expect(formatNotificationLocationContext({ city: 'Уфа', name: null })).toBe('Уфа');
    expect(formatNotificationLocationContext({ city: 'Уфа', name: '  ' })).toBe('Уфа');
  });

  it('нет ни города, ни точки — контекста нет', () => {
    expect(formatNotificationLocationContext({ city: null, name: null })).toBeNull();
    expect(formatNotificationLocationContext(null)).toBeNull();
    expect(formatNotificationLocationContext(undefined)).toBeNull();
  });

  it('город не дублируется, когда имя точки буквально равно городу', () => {
    expect(formatNotificationLocationContext({ city: 'Уфа', name: 'уфа' })).toBe('уфа');
  });

  it('вхождение города в имя точки дублированием не считается', () => {
    expect(formatNotificationLocationContext({ city: 'Уфа', name: 'Уфа, Проспект Октября' })).toBe(
      'Уфа · Уфа, Проспект Октября',
    );
  });

  it('пробелы схлопываются', () => {
    expect(formatNotificationLocationContext({ city: '  Уфа ', name: 'Фудзияма\n Октября ' })).toBe(
      'Уфа · Фудзияма Октября',
    );
  });
});

describe('withNotificationLocationContext', () => {
  const context = 'Уфа · Фудзияма';

  it('контекст встаёт первой строкой', () => {
    expect(withNotificationLocationContext('Заявка #12 — течёт кран', context)).toBe(
      'Уфа · Фудзияма\nЗаявка #12 — течёт кран',
    );
  });

  it('без контекста текст не меняется', () => {
    expect(withNotificationLocationContext('Заявка #12', null)).toBe('Заявка #12');
    expect(withNotificationLocationContext('Заявка #12', '   ')).toBe('Заявка #12');
    expect(withNotificationLocationContext('Заявка #12', undefined)).toBe('Заявка #12');
  });

  it('повторное применение не дублирует контекст', () => {
    const once = withNotificationLocationContext('Заявка #12', context);
    expect(withNotificationLocationContext(once, context)).toBe(once);
  });

  it('пустой текст сводится к самому контексту', () => {
    expect(withNotificationLocationContext('', context)).toBe(context);
  });
});
