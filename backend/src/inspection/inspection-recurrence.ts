import { InspectionFrequency } from '@prisma/client'

/**
 * SMA-ROUNDS-RECURRENCE-FIX — арифметика повторения плана обходов.
 *
 * До этой задачи nextDueAt засевался из startDate и больше не менялся: 098
 * сознательно оставил генерацию на потом, а завершение обхода расписание не
 * трогало. Периодический план после первого визита навсегда оставался со сроком
 * в прошлом — планировщик держал его просроченным, MAX-бот показывал «на сегодня»
 * каждый день, а следующий визит так и не появлялся.
 *
 * Здесь только чистые функции: расчёт ведётся без БД и без часов, чтобы каждую
 * периодичность можно было проверить исполнением, а не чтением исходника.
 */

const MS_DAY = 24 * 60 * 60 * 1000

type Step = { days: number } | { months: number }

const STEP_BY_FREQUENCY: Partial<Record<InspectionFrequency, Step>> = {
  [InspectionFrequency.DAILY]: { days: 1 },
  [InspectionFrequency.WEEKLY]: { days: 7 },
  [InspectionFrequency.BIWEEKLY]: { days: 14 },
  [InspectionFrequency.MONTHLY]: { months: 1 },
  [InspectionFrequency.QUARTERLY]: { months: 3 },
  [InspectionFrequency.SEMIANNUAL]: { months: 6 },
  [InspectionFrequency.ANNUAL]: { months: 12 },
}

export type RecurrenceInput = {
  frequency: InspectionFrequency
  intervalDays?: number | null
  startDate: Date
}

/** Шаг повторения. null — план не повторяется (ONCE) либо настроен неполно. */
export function recurrenceStep(input: Pick<RecurrenceInput, 'frequency' | 'intervalDays'>): Step | null {
  if (input.frequency === InspectionFrequency.CUSTOM) {
    return input.intervalDays && input.intervalDays > 0 ? { days: input.intervalDays } : null
  }
  return STEP_BY_FREQUENCY[input.frequency] ?? null
}

/**
 * Ближайший срок плана строго после `after`.
 *
 * Сроки — сетка от startDate: k-й визит равен startDate + k шагов, а не
 * предыдущий срок + шаг. Так месячный план от 31 января идёт 28 февраля,
 * 31 марта, 30 апреля — без сползания на 28-е после первого короткого месяца.
 *
 * Шаг прибавляется к местному времени компании, а не к UTC: визит в 09:00
 * по Москве остаётся в 09:00, а «первое число месяца» считается по местному
 * календарю, где у UTC ещё было бы 31-е.
 *
 * Возвращает null для ONCE: у однократного плана следующего визита нет.
 */
export function nextOccurrenceAfter(
  input: RecurrenceInput,
  after: Date,
  timeZone?: string | null,
): Date | null {
  const step = recurrenceStep(input)
  if (!step) return null

  const zone = safeTimeZone(timeZone)
  const anchor = zonedParts(input.startDate, zone)
  const occurrence = (k: number) => zonedInstant(shift(anchor, step, k), zone)

  const approxStepMs = 'days' in step ? step.days * MS_DAY : step.months * 28 * MS_DAY
  let k = Math.max(0, Math.floor((after.getTime() - input.startDate.getTime()) / approxStepMs) - 1)
  while (k > 0 && occurrence(k - 1).getTime() > after.getTime()) k -= 1
  while (occurrence(k).getTime() <= after.getTime()) k += 1
  return occurrence(k)
}

/**
 * Срок, с которого визит считается просроченным: плановый срок плюс льготные дни.
 * graceDays — длительность, а не календарь: 1 день льготы — это 24 часа.
 */
export function scheduleOverdueAt(dueAt: Date, graceDays?: number | null): Date {
  return new Date(dueAt.getTime() + Math.max(0, graceDays ?? 0) * MS_DAY)
}

/**
 * Просрочен ли текущий визит плана.
 *
 * Неактивный план не просрочен: ему не назначено ни одного визита. Активный
 * просрочен, когда льготный срок прошёл, а визит не закрыт — после завершения
 * обхода nextDueAt уходит вперёд, и закрытый визит этим сравнением не ловится.
 */
export function isScheduleOverdue(
  schedule: { isActive: boolean; nextDueAt: Date; graceDays?: number | null },
  now: Date,
): boolean {
  if (!schedule.isActive) return false
  return now.getTime() > scheduleOverdueAt(schedule.nextDueAt, schedule.graceDays).getTime()
}

// ── местное время без зависимостей ──────────────────────────────────────────

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number; ms: number }

function safeTimeZone(timeZone?: string | null): string {
  const candidate = (timeZone || '').trim() || 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate })
    return candidate
  } catch {
    return 'UTC'
  }
}

function zonedParts(instant: Date, timeZone: string): Parts {
  const values: Record<string, number> = {}
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  })
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value)
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
    ms: instant.getUTCMilliseconds(),
  }
}

function shift(anchor: Parts, step: Step, k: number): Parts {
  if ('days' in step) {
    const shifted = new Date(Date.UTC(anchor.year, anchor.month - 1, anchor.day + step.days * k))
    return { ...anchor, year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() }
  }
  const monthIndex = anchor.month - 1 + step.months * k
  const year = anchor.year + Math.floor(monthIndex / 12)
  const month = (((monthIndex % 12) + 12) % 12) + 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { ...anchor, year, month, day: Math.min(anchor.day, lastDay) }
}

/** Местное время зоны → момент UTC. Две итерации покрывают смену смещения. */
function zonedInstant(parts: Parts, timeZone: string): Date {
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.ms)
  let instant = wall - offsetMs(new Date(wall), timeZone)
  instant = wall - offsetMs(new Date(instant), timeZone)
  return new Date(instant)
}

function offsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, p.ms)
  return asUtc - instant.getTime()
}
