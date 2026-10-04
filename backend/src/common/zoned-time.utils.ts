/**
 * SMA-ROUND-SCHEDULE-ADVANCE-029.
 *
 * Работа с календарём в часовом поясе компании.
 *
 * Код перенесён из max-bot/max-master-time.ts без изменения поведения: он был
 * написан для MAX, но к MAX отношения не имеет, а нужен теперь и обходам.
 * Держать вторую копию нельзя — два разных представления о том, где кончается
 * день, разошлись бы в первом же переводе часов. max-master-time продолжает
 * экспортировать те же имена отсюда, поэтому вызывающий код MAX не менялся.
 *
 * Смещение пояса вычисляется в два прохода намеренно: у местного времени рядом
 * с переводом часов смещение зависит от самого мгновения, и одного прохода
 * не хватает.
 */

export function safeTimeZone(timezone?: string | null): string {
  const candidate = (timezone || '').trim() || 'UTC'
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: candidate })
    return candidate
  } catch {
    return 'UTC'
  }
}

export type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/** Разбор мгновения на местные части календаря. */
export function zonedParts(instant: Date, timezone?: string | null): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(formatter.formatToParts(instant).map((p) => [p.type, p.value]))
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant.getTime()
}

/** Мгновение UTC, которому в поясе соответствует названное местное время. */
export function utcInstantForLocalParts(
  parts: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  timezone?: string | null,
): Date {
  const timeZone = safeTimeZone(timezone)
  const naive = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
    0,
  )
  const first = naive - zoneOffsetMs(new Date(naive), timeZone)
  const second = naive - zoneOffsetMs(new Date(first), timeZone)
  return new Date(second)
}

/** Границы местных суток. Обе включающие. */
export function zonedDayRange(now: Date, timezone?: string | null): { from: Date; to: Date } {
  const timeZone = safeTimeZone(timezone)
  const today = zonedParts(now, timeZone)
  const from = utcInstantForLocalParts({ ...today, hour: 0, minute: 0, second: 0 }, timeZone)
  const to = utcInstantForLocalParts({ ...today, hour: 23, minute: 59, second: 59 }, timeZone)
  to.setMilliseconds(999)
  return { from, to }
}

/** Конец текущих местных суток — граница «сегодня» для планов обходов. */
export function endOfZonedDay(now: Date, timezone?: string | null): Date {
  return zonedDayRange(now, timezone).to
}

export function formatClock(value: Date | string, timezone?: string | null): string {
  const instant = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(instant.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: safeTimeZone(timezone),
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant)
}

export function inRange(value: Date | string | undefined, from: Date, to: Date): boolean {
  if (!value) return false
  const instant = value instanceof Date ? value : new Date(value)
  return instant >= from && instant <= to
}

export function createdAtTime(value?: Date | string): number {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}
