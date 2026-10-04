import { InspectionFrequency } from '@prisma/client'

import { advanceSchedule, isRecurring, nextDueAfter } from './inspection-recurrence'
import { zonedParts } from '../common/zoned-time.utils'

/**
 * SMA-ROUND-SCHEDULE-ADVANCE-029.
 *
 * Арифметика повторения. Проверяется календарь, а не «плюс столько-то часов»:
 * именно на границах месяцев, високосном годе и переводе часов ломается
 * наивная реализация, и именно там живёт обещание, данное человеку в планировщике.
 */

const TZ = 'Europe/Moscow'

/** Местное «когда» в читаемом виде — проверяем то, что увидит человек. */
function local(instant: Date | null, timezone = TZ): string {
  if (!instant) return 'null'
  const p = zonedParts(instant, timezone)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`
}

function at(iso: string): Date {
  return new Date(iso)
}

function step(frequency: InspectionFrequency, from: string, intervalDays?: number, timezone = TZ) {
  return local(nextDueAfter({ frequency, intervalDays, from: at(from), timezone }), timezone)
}

describe('029 шаг повторения', () => {
  it('ONCE шага не имеет', () => {
    expect(nextDueAfter({ frequency: InspectionFrequency.ONCE, from: at('2026-03-10T06:00:00Z'), timezone: TZ })).toBeNull()
    expect(isRecurring(InspectionFrequency.ONCE)).toBe(false)
  })

  it('DAILY — следующие сутки, время дня сохраняется', () => {
    // 09:00 по Москве
    expect(step(InspectionFrequency.DAILY, '2026-03-10T06:00:00Z')).toBe('2026-03-11 09:00')
  })

  it('WEEKLY — ровно неделя', () => {
    expect(step(InspectionFrequency.WEEKLY, '2026-03-10T06:00:00Z')).toBe('2026-03-17 09:00')
  })

  it('BIWEEKLY — две недели', () => {
    expect(step(InspectionFrequency.BIWEEKLY, '2026-03-10T06:00:00Z')).toBe('2026-03-24 09:00')
  })

  it('MONTHLY — то же число следующего месяца, а не +30 суток', () => {
    expect(step(InspectionFrequency.MONTHLY, '2026-01-15T06:00:00Z')).toBe('2026-02-15 09:00')
  })

  it('MONTHLY — конец месяца прижимается, а не переползает', () => {
    // 31 января + месяц = 28 февраля 2026 (невисокосный), а не 3 марта.
    expect(step(InspectionFrequency.MONTHLY, '2026-01-31T06:00:00Z')).toBe('2026-02-28 09:00')
  })

  it('MONTHLY — 31 марта даёт 30 апреля', () => {
    expect(step(InspectionFrequency.MONTHLY, '2026-03-31T06:00:00Z')).toBe('2026-04-30 09:00')
  })

  it('QUARTERLY — +3 месяца по календарю, а не 90 суток', () => {
    expect(step(InspectionFrequency.QUARTERLY, '2026-01-31T06:00:00Z')).toBe('2026-04-30 09:00')
  })

  it('SEMIANNUAL — +6 месяцев с переходом через год', () => {
    expect(step(InspectionFrequency.SEMIANNUAL, '2026-10-15T06:00:00Z')).toBe('2027-04-15 09:00')
  })

  it('ANNUAL — то же число следующего года', () => {
    expect(step(InspectionFrequency.ANNUAL, '2026-05-20T06:00:00Z')).toBe('2027-05-20 09:00')
  })

  it('ANNUAL — 29 февраля високосного года становится 28-м', () => {
    // 2028 високосный, 2029 — нет.
    expect(step(InspectionFrequency.ANNUAL, '2028-02-29T06:00:00Z')).toBe('2029-02-28 09:00')
  })

  it('CUSTOM — произвольный интервал в сутках', () => {
    expect(step(InspectionFrequency.CUSTOM, '2026-03-10T06:00:00Z', 10)).toBe('2026-03-20 09:00')
  })

  it('CUSTOM без пригодного интервала шага не даёт', () => {
    for (const bad of [undefined, 0, -5, 1.5]) {
      expect(
        nextDueAfter({ frequency: InspectionFrequency.CUSTOM, intervalDays: bad as number, from: at('2026-03-10T06:00:00Z'), timezone: TZ }),
      ).toBeNull()
    }
  })
})

describe('029 часовой пояс', () => {
  it('время дня переживает перевод часов', () => {
    /*
     * В Берлине 29 марта 2026 переводят часы вперёд. Визит в 09:00 обязан
     * остаться визитом в 09:00, хотя между мгновениями пройдёт 23 часа,
     * а не 24. Наивное «+86400000 мс» дало бы 10:00.
     */
    const berlin = 'Europe/Berlin'
    const before = new Date('2026-03-28T08:00:00Z') // 09:00 CET
    const next = nextDueAfter({ frequency: InspectionFrequency.DAILY, from: before, timezone: berlin })
    expect(local(next, berlin)).toBe('2026-03-29 09:00')
    // Мгновение действительно сдвинулось не на сутки — это и есть перевод часов.
    expect(next!.getTime() - before.getTime()).toBe(23 * 60 * 60 * 1000)
  })

  it('один и тот же момент в разных поясах даёт разные местные даты', () => {
    const from = at('2026-03-10T21:30:00Z') // 00:30 по Москве 11-го, 21:30 в UTC 10-го
    expect(local(nextDueAfter({ frequency: InspectionFrequency.DAILY, from, timezone: TZ }), TZ)).toBe('2026-03-12 00:30')
    expect(local(nextDueAfter({ frequency: InspectionFrequency.DAILY, from, timezone: 'UTC' }), 'UTC')).toBe('2026-03-11 21:30')
  })
})

describe('029 сдвиг плана после выполнения', () => {
  const base = {
    frequency: InspectionFrequency.DAILY,
    intervalDays: null as number | null,
    timezone: TZ,
  }

  it('ONCE после выполнения повторения не имеет', () => {
    const out = advanceSchedule({
      ...base,
      frequency: InspectionFrequency.ONCE,
      currentDueAt: at('2026-03-10T06:00:00Z'),
      completedAt: at('2026-03-10T07:00:00Z'),
    })
    expect(out.nextDueAt).toBeNull()
  })

  it('обычный случай: один шаг вперёд', () => {
    const out = advanceSchedule({
      ...base,
      currentDueAt: at('2026-03-10T06:00:00Z'),
      completedAt: at('2026-03-10T07:00:00Z'),
    })
    expect(local(out.nextDueAt)).toBe('2026-03-11 09:00')
    expect(out.missedOccurrences).toBe(0)
  })

  it('догон пропущенных: дата уходит в будущее, а не остаётся в прошлом', () => {
    /*
     * План не выполняли неделю. Один шаг оставил бы дату позади, и завтра
     * визит снова выглядел бы просроченным — теперь уже без причины.
     */
    const out = advanceSchedule({
      ...base,
      currentDueAt: at('2026-03-01T06:00:00Z'),
      completedAt: at('2026-03-08T07:00:00Z'),
    })
    expect(local(out.nextDueAt)).toBe('2026-03-09 09:00')
    expect(out.nextDueAt!.getTime()).toBeGreaterThan(at('2026-03-08T07:00:00Z').getTime())
    expect(out.missedOccurrences).toBe(7)
  })

  it('догон не выдумывает обходов за пропущенные дни', () => {
    // Функция чистая: она возвращает только дату и счётчик, создавать нечего.
    const out = advanceSchedule({
      ...base,
      currentDueAt: at('2026-01-01T06:00:00Z'),
      completedAt: at('2026-03-01T07:00:00Z'),
    })
    expect(Object.keys(out).sort()).toEqual(['exhausted', 'missedOccurrences', 'nextDueAt'])
    expect(out.exhausted).toBe(false)
  })

  it('брошенный на годы план не крутится вечно, а сообщает об этом', () => {
    const out = advanceSchedule({
      ...base,
      currentDueAt: at('1990-01-01T06:00:00Z'),
      completedAt: at('2026-03-01T07:00:00Z'),
    })
    expect(out.exhausted).toBe(true)
  })

  it('CUSTOM без интервала план не двигает', () => {
    const out = advanceSchedule({
      frequency: InspectionFrequency.CUSTOM,
      intervalDays: null,
      currentDueAt: at('2026-03-10T06:00:00Z'),
      completedAt: at('2026-03-10T07:00:00Z'),
      timezone: TZ,
    })
    expect(out.nextDueAt).toBeNull()
  })

  it('месячный план догоняет по календарю, не по 30 суток', () => {
    const out = advanceSchedule({
      ...base,
      frequency: InspectionFrequency.MONTHLY,
      currentDueAt: at('2025-11-30T06:00:00Z'),
      completedAt: at('2026-02-10T07:00:00Z'),
    })
    // 30 ноя → 30 дек → 30 янв → 28 фев (прижатие) — первая дата после 10 февраля.
    expect(local(out.nextDueAt)).toBe('2026-02-28 09:00')
  })
})

/**
 * SMA-ROUND-RECURRENCE-HARDENING-038 — закрытые находки аудита 033.
 *
 * Два дефекта были не в арифметике одного шага, а в том, что получалось
 * из нескольких шагов подряд: число месяца необратимо сползало на конец
 * короткого февраля, а исчерпанный догон отдавал курсор из прошлого как
 * готовый результат.
 */
describe('038 якорь числа месяца', () => {
  const MSK = 'Europe/Moscow'

  function localDate(value: Date, timezone = MSK): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value)
  }

  function monthlyChain(startLocal: string, steps: number, anchorDay = 31, timezone = MSK): string[] {
    const out: string[] = []
    let cursor = new Date(`${startLocal}T09:00:00.000Z`)
    for (let i = 0; i < steps; i += 1) {
      const next = nextDueAfter({
        frequency: InspectionFrequency.MONTHLY,
        from: cursor,
        timezone,
        anchorDay,
      })
      if (!next) throw new Error('шаг обязан быть')
      out.push(localDate(next, timezone))
      cursor = next
    }
    return out
  }

  it('1. 31 января не превращает план в план 28-го числа навсегда', () => {
    // До 038: 28 фев → 28 мар → 28 апр. Число месяца сползало необратимо.
    expect(monthlyChain('2027-01-31', 4)).toEqual([
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
      '2027-05-31',
    ])
  })

  it('2. в високосном году февраль прижимается к 29-му, а не к 28-му', () => {
    expect(monthlyChain('2028-01-31', 2)).toEqual(['2028-02-29', '2028-03-31'])
  })

  it('3. якорь 30 не выдумывает 31-е число в коротком месяце', () => {
    expect(monthlyChain('2027-04-30', 3, 30)).toEqual(['2027-05-30', '2027-06-30', '2027-07-30'])
  })

  it('4. без якоря поведение прежнее: число берётся из самой даты', () => {
    const next = nextDueAfter({
      frequency: InspectionFrequency.MONTHLY,
      from: new Date('2027-02-28T09:00:00.000Z'),
      timezone: MSK,
    })!
    expect(localDate(next)).toBe('2027-03-28')
  })

  it('5. квартал и год тоже держат якорь', () => {
    const quarterly = nextDueAfter({
      frequency: InspectionFrequency.QUARTERLY,
      from: new Date('2027-02-28T09:00:00.000Z'),
      timezone: MSK,
      anchorDay: 31,
    })!
    expect(localDate(quarterly)).toBe('2027-05-31')

    const annual = nextDueAfter({
      frequency: InspectionFrequency.ANNUAL,
      from: new Date('2028-02-29T09:00:00.000Z'),
      timezone: MSK,
      anchorDay: 29,
    })!
    // В невисокосном году 29-го нет — прижимаем, но якорь не теряем.
    expect(localDate(annual)).toBe('2029-02-28')
  })

  it('6. догон по месяцам восстанавливает исходное число', () => {
    const outcome = advanceSchedule({
      frequency: InspectionFrequency.MONTHLY,
      currentDueAt: new Date('2027-01-31T09:00:00.000Z'),
      completedAt: new Date('2027-05-02T10:00:00.000Z'),
      timezone: MSK,
      anchorDate: new Date('2027-01-31T09:00:00.000Z'),
    })
    expect(outcome.exhausted).toBe(false)
    expect(localDate(outcome.nextDueAt!)).toBe('2027-05-31')
    expect(outcome.missedOccurrences).toBe(3)
  })
})

describe('038 исчерпанный догон', () => {
  it('7. курсор из прошлого наружу не отдаётся', () => {
    const outcome = advanceSchedule({
      frequency: InspectionFrequency.DAILY,
      currentDueAt: new Date('1990-01-01T09:00:00.000Z'),
      completedAt: new Date('2027-01-01T09:00:00.000Z'),
      timezone: 'Europe/Moscow',
    })
    expect(outcome.exhausted).toBe(true)
    // Главное: нет даты, выдающей незаконченный расчёт за результат.
    expect(outcome.nextDueAt).toBeNull()
    expect(outcome.missedOccurrences).toBeGreaterThan(0)
  })

  it('8. обычный догон предохранитель не задевает', () => {
    const outcome = advanceSchedule({
      frequency: InspectionFrequency.DAILY,
      currentDueAt: new Date('2027-01-01T09:00:00.000Z'),
      completedAt: new Date('2027-01-10T10:00:00.000Z'),
      timezone: 'Europe/Moscow',
    })
    expect(outcome.exhausted).toBe(false)
    expect(outcome.nextDueAt).not.toBeNull()
    expect(outcome.missedOccurrences).toBe(9)
  })

  it('9. отсутствие повторения и исчерпание различимы', () => {
    const once = advanceSchedule({
      frequency: InspectionFrequency.ONCE,
      currentDueAt: new Date('2027-01-01T09:00:00.000Z'),
      completedAt: new Date('2027-01-01T10:00:00.000Z'),
    })
    // Обе ветки дают nextDueAt: null, но означают разное.
    expect(once.nextDueAt).toBeNull()
    expect(once.exhausted).toBe(false)
  })
})
