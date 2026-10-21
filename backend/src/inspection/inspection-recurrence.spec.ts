import { InspectionFrequency } from '@prisma/client';

import {
  isScheduleOverdue,
  nextOccurrenceAfter,
  recurrenceStep,
  scheduleOverdueAt,
} from './inspection-recurrence';

/**
 * SMA-ROUNDS-RECURRENCE-FIX — арифметика сроков исполнением, по периодичностям.
 */

const at = (iso: string) => new Date(iso);
const plan = (
  frequency: InspectionFrequency,
  startDate: string,
  intervalDays: number | null = null,
) => ({
  frequency,
  intervalDays,
  startDate: at(startDate),
});

/** Цепочка сроков: каждый следующий — после предыдущего, как при завершении визитов вовремя. */
function chain(
  input: ReturnType<typeof plan>,
  count: number,
  timeZone?: string,
) {
  const out: string[] = [];
  let cursor = input.startDate;
  for (let i = 0; i < count; i += 1) {
    const next = nextOccurrenceAfter(input, cursor, timeZone);
    if (!next) break;
    out.push(next.toISOString());
    cursor = next;
  }
  return out;
}

describe('nextOccurrenceAfter — периодичности', () => {
  it('DAILY: +1 сутки к тому же времени', () => {
    expect(
      chain(plan(InspectionFrequency.DAILY, '2026-10-01T09:00:00.000Z'), 3),
    ).toEqual([
      '2026-10-02T09:00:00.000Z',
      '2026-10-03T09:00:00.000Z',
      '2026-10-04T09:00:00.000Z',
    ]);
  });

  it('WEEKLY и BIWEEKLY: +7 и +14 суток', () => {
    expect(
      chain(plan(InspectionFrequency.WEEKLY, '2026-10-05T06:00:00.000Z'), 2),
    ).toEqual(['2026-10-12T06:00:00.000Z', '2026-10-19T06:00:00.000Z']);
    expect(
      chain(plan(InspectionFrequency.BIWEEKLY, '2026-10-05T06:00:00.000Z'), 2),
    ).toEqual(['2026-10-19T06:00:00.000Z', '2026-11-02T06:00:00.000Z']);
  });

  it('MONTHLY от 31-го: конец короткого месяца, затем снова 31-е — без сползания', () => {
    expect(
      chain(plan(InspectionFrequency.MONTHLY, '2027-01-31T09:00:00.000Z'), 4),
    ).toEqual([
      '2027-02-28T09:00:00.000Z',
      '2027-03-31T09:00:00.000Z',
      '2027-04-30T09:00:00.000Z',
      '2027-05-31T09:00:00.000Z',
    ]);
  });

  it('MONTHLY в високосный год даёт 29 февраля', () => {
    expect(
      chain(plan(InspectionFrequency.MONTHLY, '2028-01-30T09:00:00.000Z'), 1),
    ).toEqual(['2028-02-29T09:00:00.000Z']);
  });

  it('QUARTERLY, SEMIANNUAL, ANNUAL: +3, +6, +12 месяцев', () => {
    expect(
      chain(plan(InspectionFrequency.QUARTERLY, '2026-11-30T09:00:00.000Z'), 2),
    ).toEqual(['2027-02-28T09:00:00.000Z', '2027-05-30T09:00:00.000Z']);
    expect(
      chain(
        plan(InspectionFrequency.SEMIANNUAL, '2026-08-31T09:00:00.000Z'),
        2,
      ),
    ).toEqual(['2027-02-28T09:00:00.000Z', '2027-08-31T09:00:00.000Z']);
    expect(
      chain(plan(InspectionFrequency.ANNUAL, '2028-02-29T09:00:00.000Z'), 2),
    ).toEqual(['2029-02-28T09:00:00.000Z', '2030-02-28T09:00:00.000Z']);
  });

  it('CUSTOM: шаг intervalDays', () => {
    expect(
      chain(
        plan(InspectionFrequency.CUSTOM, '2026-10-01T09:00:00.000Z', 10),
        2,
      ),
    ).toEqual(['2026-10-11T09:00:00.000Z', '2026-10-21T09:00:00.000Z']);
  });

  it('ONCE и CUSTOM без интервала не повторяются', () => {
    expect(
      nextOccurrenceAfter(
        plan(InspectionFrequency.ONCE, '2026-10-01T09:00:00.000Z'),
        at('2026-10-01T09:00:00.000Z'),
      ),
    ).toBeNull();
    expect(
      recurrenceStep({
        frequency: InspectionFrequency.CUSTOM,
        intervalDays: null,
      }),
    ).toBeNull();
    expect(
      recurrenceStep({
        frequency: InspectionFrequency.CUSTOM,
        intervalDays: 0,
      }),
    ).toBeNull();
  });
});

describe('nextOccurrenceAfter — момент закрытия визита', () => {
  const daily = plan(InspectionFrequency.DAILY, '2026-10-01T09:00:00.000Z');

  it('ранее завершение: следующий срок — следующий по сетке, а не тот же', () => {
    expect(
      nextOccurrenceAfter(daily, at('2026-10-03T09:00:00.000Z'))?.toISOString(),
    ).toBe('2026-10-04T09:00:00.000Z');
  });

  it('позднее завершение покрывает пропущенные сроки, хвоста просрочки нет', () => {
    // Визит 1 октября закрыт 5-го в полдень: 2–5 октября уже в прошлом.
    expect(
      nextOccurrenceAfter(daily, at('2026-10-05T12:00:00.000Z'))?.toISOString(),
    ).toBe('2026-10-06T09:00:00.000Z');
  });

  it('сетка от startDate: срок вне сетки не сдвигает ряд', () => {
    // Закрытие в 08:59 — следующий срок в 09:00 того же дня, сетка не сползла на 08:59.
    expect(
      nextOccurrenceAfter(daily, at('2026-10-07T08:59:00.000Z'))?.toISOString(),
    ).toBe('2026-10-07T09:00:00.000Z');
  });

  it('startDate в будущем — ближайший срок он сам', () => {
    expect(
      nextOccurrenceAfter(daily, at('2026-09-20T00:00:00.000Z'))?.toISOString(),
    ).toBe('2026-10-01T09:00:00.000Z');
  });

  it('старый план с тысячами шагов считается без перебора с нуля', () => {
    const old = plan(InspectionFrequency.DAILY, '2020-01-01T09:00:00.000Z');
    expect(
      nextOccurrenceAfter(old, at('2026-10-21T10:00:00.000Z'))?.toISOString(),
    ).toBe('2026-10-22T09:00:00.000Z');
  });
});

describe('nextOccurrenceAfter — местное время компании', () => {
  it('месяц считается по местному календарю, а не по UTC', () => {
    // 30 ноября 01:00 по Москве — это 29 ноября 22:00 UTC.
    const moscow = plan(
      InspectionFrequency.MONTHLY,
      '2026-11-29T22:00:00.000Z',
    );
    const after = at('2027-02-01T00:00:00.000Z');
    // По Москве: 28 февраля 01:00 МСК — последний день короткого месяца.
    expect(
      nextOccurrenceAfter(moscow, after, 'Europe/Moscow')?.toISOString(),
    ).toBe('2027-02-27T22:00:00.000Z');
    // В UTC тот же план живёт по 29-м: срок попал бы на 1 марта по Москве.
    expect(nextOccurrenceAfter(moscow, after, 'UTC')?.toISOString()).toBe(
      '2027-02-28T22:00:00.000Z',
    );
    // И возвращается на 30-е после короткого месяца.
    expect(
      nextOccurrenceAfter(
        moscow,
        at('2027-02-28T00:00:00.000Z'),
        'Europe/Moscow',
      )?.toISOString(),
    ).toBe('2027-03-29T22:00:00.000Z');
  });

  it('смена летнего времени не сдвигает местный час визита', () => {
    // Берлин: 25 октября 2026 переход CEST→CET. 09:00 местного остаётся 09:00.
    const berlin = plan(InspectionFrequency.DAILY, '2026-10-24T07:00:00.000Z');
    expect(chain(berlin, 2, 'Europe/Berlin')).toEqual([
      '2026-10-25T08:00:00.000Z',
      '2026-10-26T08:00:00.000Z',
    ]);
  });

  it('неизвестная зона — UTC, а не исключение', () => {
    const daily = plan(InspectionFrequency.DAILY, '2026-10-01T09:00:00.000Z');
    expect(
      nextOccurrenceAfter(
        daily,
        at('2026-10-01T09:00:00.000Z'),
        'Mars/Olympus',
      )?.toISOString(),
    ).toBe('2026-10-02T09:00:00.000Z');
  });
});

describe('просрочка плана', () => {
  const due = at('2026-10-10T09:00:00.000Z');

  it('overdueAt = срок + льготные дни', () => {
    expect(scheduleOverdueAt(due, 0).toISOString()).toBe(
      '2026-10-10T09:00:00.000Z',
    );
    expect(scheduleOverdueAt(due, 2).toISOString()).toBe(
      '2026-10-12T09:00:00.000Z',
    );
    expect(scheduleOverdueAt(due, null).toISOString()).toBe(
      '2026-10-10T09:00:00.000Z',
    );
    expect(scheduleOverdueAt(due, -3).toISOString()).toBe(
      '2026-10-10T09:00:00.000Z',
    );
  });

  it('внутри льготы не просрочен, после — просрочен; граница ещё не просрочка', () => {
    const schedule = { isActive: true, nextDueAt: due, graceDays: 2 };
    expect(isScheduleOverdue(schedule, at('2026-10-11T09:00:00.000Z'))).toBe(
      false,
    );
    expect(isScheduleOverdue(schedule, at('2026-10-12T09:00:00.000Z'))).toBe(
      false,
    );
    expect(isScheduleOverdue(schedule, at('2026-10-12T09:00:00.001Z'))).toBe(
      true,
    );
  });

  it('выключенный план не просрочен', () => {
    expect(
      isScheduleOverdue(
        { isActive: false, nextDueAt: due, graceDays: 0 },
        at('2027-01-01T00:00:00.000Z'),
      ),
    ).toBe(false);
  });
});
