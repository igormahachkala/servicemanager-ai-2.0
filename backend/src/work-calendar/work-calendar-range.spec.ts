import { BadRequestException } from '@nestjs/common';

import {
  isValidTimeZone,
  localDateOf,
  parseRangeBound,
  resolveCalendarRange,
  resolveCalendarTimeZone,
} from './work-calendar-range';

const HOUR = 60 * 60 * 1000;

describe('SMA-WORK-CALENDAR-V1 часовой пояс', () => {
  it('принимает имена IANA и UTC, отклоняет сокращения и смещения', () => {
    expect(isValidTimeZone('Europe/Moscow')).toBe(true);
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('+03:00')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });

  it('явный неизвестный пояс — ошибка запроса, а не тихий UTC', () => {
    expect(() =>
      resolveCalendarTimeZone('Mars/Olympus', 'Europe/Moscow'),
    ).toThrow(BadRequestException);
  });

  it('без пояса — пояс компании, без него или при битом значении — UTC', () => {
    expect(resolveCalendarTimeZone(undefined, 'Europe/Moscow')).toBe(
      'Europe/Moscow',
    );
    expect(resolveCalendarTimeZone('  ', 'Asia/Yekaterinburg')).toBe(
      'Asia/Yekaterinburg',
    );
    expect(resolveCalendarTimeZone(undefined, null)).toBe('UTC');
    expect(resolveCalendarTimeZone(undefined, 'broken')).toBe('UTC');
  });
});

describe('SMA-WORK-CALENDAR-V1 границы диапазона', () => {
  it('дата — полночь этих суток в поясе календаря', () => {
    expect(
      parseRangeBound('2026-10-26', 'Europe/Moscow', 'from').toISOString(),
    ).toBe('2026-10-25T21:00:00.000Z');
    expect(parseRangeBound('2026-10-26', 'UTC', 'from').toISOString()).toBe(
      '2026-10-26T00:00:00.000Z',
    );
  });

  it('момент со смещением берётся как есть', () => {
    expect(
      parseRangeBound(
        '2026-10-26T09:00:00+03:00',
        'America/New_York',
        'from',
      ).toISOString(),
    ).toBe('2026-10-26T06:00:00.000Z');
    expect(
      parseRangeBound('2026-10-26T06:00:00.000Z', 'UTC', 'to').toISOString(),
    ).toBe('2026-10-26T06:00:00.000Z');
  });

  it('момент без смещения, несуществующая дата и пустое значение отклоняются', () => {
    expect(() => parseRangeBound('2026-10-26T00:00:00', 'UTC', 'from')).toThrow(
      BadRequestException,
    );
    expect(() => parseRangeBound('2026-02-30', 'UTC', 'from')).toThrow(
      BadRequestException,
    );
    expect(() => parseRangeBound('', 'UTC', 'from')).toThrow(
      'from is required',
    );
    expect(() => parseRangeBound('завтра', 'UTC', 'to')).toThrow(
      BadRequestException,
    );
  });

  it('to должен быть позже from, длина не больше 62 суток', () => {
    expect(() =>
      resolveCalendarRange({
        from: '2026-10-26',
        to: '2026-10-26',
        timeZone: 'UTC',
      }),
    ).toThrow('to must be after from');
    expect(() =>
      resolveCalendarRange({
        from: '2026-11-02',
        to: '2026-10-26',
        timeZone: 'UTC',
      }),
    ).toThrow('to must be after from');
    expect(() =>
      resolveCalendarRange({
        from: '2026-10-01',
        to: '2026-12-03',
        timeZone: 'UTC',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      resolveCalendarRange({
        from: '2026-10-01',
        to: '2026-12-02',
        timeZone: 'UTC',
      }),
    ).not.toThrow();
  });
});

describe('SMA-WORK-CALENDAR-V1 переход на зимнее и летнее время', () => {
  it('сутки перевода часов назад в Нью-Йорке длятся 25 часов', () => {
    const range = resolveCalendarRange({
      from: '2026-11-01',
      to: '2026-11-02',
      timeZone: 'America/New_York',
    });
    expect(range.from.toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-11-02T05:00:00.000Z');
    expect(range.to.getTime() - range.from.getTime()).toBe(25 * HOUR);
  });

  it('сутки перевода часов вперёд в Берлине длятся 23 часа', () => {
    const range = resolveCalendarRange({
      from: '2026-03-29',
      to: '2026-03-30',
      timeZone: 'Europe/Berlin',
    });
    expect(range.from.toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-03-29T22:00:00.000Z');
    expect(range.to.getTime() - range.from.getTime()).toBe(23 * HOUR);
  });

  it('местные сутки события считаются по смещению на момент события', () => {
    // 23:30 по Нью-Йорку 1 ноября — уже EST, в UTC это 2 ноября.
    expect(
      localDateOf(new Date('2026-11-02T04:30:00.000Z'), 'America/New_York'),
    ).toBe('2026-11-01');
    // 00:30 по Берлину 30 марта — уже CEST, в UTC ещё 29 марта.
    expect(
      localDateOf(new Date('2026-03-29T22:30:00.000Z'), 'Europe/Berlin'),
    ).toBe('2026-03-30');
    expect(
      localDateOf(new Date('2026-10-25T21:00:00.000Z'), 'Europe/Moscow'),
    ).toBe('2026-10-26');
    expect(
      localDateOf(new Date('2026-10-25T20:59:59.999Z'), 'Europe/Moscow'),
    ).toBe('2026-10-25');
  });

  it('неделя через перевод часов покрывает ровно семь местных суток', () => {
    const range = resolveCalendarRange({
      from: '2026-10-26',
      to: '2026-11-02',
      timeZone: 'America/New_York',
    });
    expect(range.to.getTime() - range.from.getTime()).toBe((7 * 24 + 1) * HOUR);
    expect(localDateOf(range.from, 'America/New_York')).toBe('2026-10-26');
    expect(
      localDateOf(new Date(range.to.getTime() - 1), 'America/New_York'),
    ).toBe('2026-11-01');
  });
});
