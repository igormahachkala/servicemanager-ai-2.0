import { InspectionFrequency } from '@prisma/client'

import { utcInstantForLocalParts, zonedParts } from '../common/zoned-time.utils'

/**
 * SMA-ROUND-SCHEDULE-ADVANCE-029.
 *
 * Единственная арифметика повторения обходов. Чистая функция: никакой базы,
 * никакого «сейчас» изнутри — всё приходит параметрами, поэтому поведение
 * воспроизводимо и проверяемо.
 *
 * Считается по календарю в поясе компании, а не прибавлением суток.
 * «Ежемесячно» — это следующее число того же дня месяца, а не +30 дней:
 * иначе визит, назначенный на первое число, через год уползёт на середину
 * месяца. По той же причине «ежеквартально» — +3 месяца, а не +90 дней.
 *
 * Местное время дня сохраняется. Визит в 09:00 остаётся визитом в 09:00 и
 * после перевода часов, хотя мгновение UTC при этом меняется — человеку
 * важно «в девять утра», а не «через ровно 24 часа».
 */

/** Сколько календарных месяцев добавляет частота. Дни считаются отдельно. */
const MONTHS_BY_FREQUENCY: Partial<Record<InspectionFrequency, number>> = {
  [InspectionFrequency.MONTHLY]: 1,
  [InspectionFrequency.QUARTERLY]: 3,
  [InspectionFrequency.SEMIANNUAL]: 6,
  [InspectionFrequency.ANNUAL]: 12,
}

/** Сколько календарных дней добавляет частота. */
const DAYS_BY_FREQUENCY: Partial<Record<InspectionFrequency, number>> = {
  [InspectionFrequency.DAILY]: 1,
  [InspectionFrequency.WEEKLY]: 7,
  [InspectionFrequency.BIWEEKLY]: 14,
}

/**
 * Предохранитель от бесконечного цикла догона. Ежедневный план, брошенный
 * на десять лет, укладывается с запасом; всё, что больше, — это уже не
 * пропущенный визит, а испорченные данные, и молча крутиться тут нельзя.
 */
const MAX_CATCH_UP_STEPS = 4000

export function isRecurring(frequency: InspectionFrequency): boolean {
  return frequency !== InspectionFrequency.ONCE
}

/** Длина шага в днях для частот, которые считаются днями. CUSTOM — из настройки. */
function stepDays(frequency: InspectionFrequency, intervalDays?: number | null): number | null {
  if (frequency === InspectionFrequency.CUSTOM) {
    const days = Number(intervalDays)
    if (!Number.isInteger(days) || days <= 0) return null
    return days
  }
  return DAYS_BY_FREQUENCY[frequency] ?? null
}

/** 038: пригодное число месяца, иначе null — якоря нет. */
function normalizeAnchorDay(value?: number | null): number | null {
  if (!Number.isInteger(value as number)) return null
  const day = Number(value)
  return day >= 1 && day <= 31 ? day : null
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Один шаг повторения от указанного мгновения.
 *
 * Возвращает null для ONCE и для CUSTOM без пригодного интервала: шага нет,
 * и придумывать его нельзя.
 */
export function nextDueAfter(params: {
  frequency: InspectionFrequency
  intervalDays?: number | null
  from: Date
  timezone?: string | null
  /**
   * SMA-ROUND-RECURRENCE-HARDENING-038.
   *
   * Исходное число месяца, от которого построен план. Нужно только месячным
   * частотам и только затем, чтобы прижатие к концу месяца не стало
   * необратимым.
   *
   * Без якоря шаг считался от предыдущего результата, и план «31-го числа»
   * после первого февраля навсегда становился планом «28-го»:
   * 31 янв → 28 фев → 28 мар → 28 апр. Якорь возвращает исходное число,
   * как только в месяце оно снова есть: 31 янв → 28 фев → 31 мар → 30 апр
   * → 31 мая.
   *
   * Не передан — берётся число самой даты `from`, то есть прежнее поведение.
   * Дневные частоты якорь не используют: у них шаг в сутках, а не в числе.
   */
  anchorDay?: number | null
}): Date | null {
  const { frequency, intervalDays, from, timezone, anchorDay } = params
  if (frequency === InspectionFrequency.ONCE) return null
  if (!Number.isFinite(from.getTime())) return null

  const local = zonedParts(from, timezone)

  const months = MONTHS_BY_FREQUENCY[frequency]
  if (months) {
    const zeroBased = local.month - 1 + months
    const year = local.year + Math.floor(zeroBased / 12)
    const month = (zeroBased % 12) + 1
    /**
     * Конец месяца прижимается. 31 января плюс месяц — это 28 или 29 февраля,
     * а не 3 марта: иначе план «последнего числа» каждый раз переползал бы
     * в следующий месяц и за полгода сдвинулся бы на неделю.
     *
     * По той же причине 29 февраля раз в год превращается в 28-е: другого
     * 29-го в невисокосном году нет.
     */
    /**
     * 038: прижатие считается от исходного числа, а не от предыдущего шага.
     * В месяце, где такого числа нет, берётся последний день месяца — но
     * только на этот месяц; следующий шаг снова отсчитывается от якоря.
     */
    const anchor = normalizeAnchorDay(anchorDay) ?? local.day
    const day = Math.min(anchor, daysInMonth(year, month))
    return utcInstantForLocalParts(
      { year, month, day, hour: local.hour, minute: local.minute, second: local.second },
      timezone,
    )
  }

  const days = stepDays(frequency, intervalDays)
  if (!days) return null

  /**
   * Сутки добавляются к местной дате, а не 24 часа к мгновению. В ночь
   * перевода часов сутки длятся 23 или 25 часов, и визит обязан остаться
   * в своё время дня.
   */
  const shifted = new Date(Date.UTC(local.year, local.month - 1, local.day + days))
  return utcInstantForLocalParts(
    {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: local.hour,
      minute: local.minute,
      second: local.second,
    },
    timezone,
  )
}

export type AdvanceOutcome = {
  /**
   * Новая дата ближайшего визита.
   *
   * null означает «двигать нечем» и имеет две причины, которые различает
   * поле `exhausted`: повторения нет вовсе (ONCE, CUSTOM без интервала) —
   * план закрывается; либо догон не уложился в предохранитель — план
   * не трогают вовсе.
   */
  nextDueAt: Date | null
  /**
   * Сколько визитов пропущено сверх одного: план не выполнялся какое-то
   * время. 038: значение уходит в предупреждение журнала на той же ветке
   * кода — отдельной аналитики ради него не заводится.
   */
  missedOccurrences: number
  /**
   * Догон прерван предохранителем.
   *
   * 038: вместе с exhausted всегда отдаётся nextDueAt: null. Раньше здесь
   * возвращался курсор, который всё ещё лежал в прошлом, и вызывающий код
   * записывал его как «ближайший визит» — дата выглядела рассчитанной,
   * хотя будущего визита так и не нашли. Молчаливой неправды в плане быть
   * не должно: план остаётся как есть, просроченным и видимым.
   */
  exhausted: boolean
}

/**
 * Куда сдвинуть план после выполненного визита.
 *
 * Догон пропущенных: если план не выполняли месяц, один шаг оставил бы дату
 * в прошлом, и назавтра он снова выглядел бы просроченным. Поэтому шаги
 * повторяются, пока дата не окажется строго позже точки отсчёта.
 *
 * Фантомные обходы за пропущенные дни при этом не создаются: работа, которой
 * не было, в истории не появляется. Пропуск виден числом missedOccurrences.
 */
export function advanceSchedule(params: {
  frequency: InspectionFrequency
  intervalDays?: number | null
  currentDueAt: Date
  completedAt: Date
  timezone?: string | null
  /**
   * 038: исходная дата плана. Из неё берётся число месяца-якорь, поэтому
   * догон по месяцам не сползает на конец короткого февраля навсегда.
   */
  anchorDate?: Date | null
}): AdvanceOutcome {
  const { frequency, intervalDays, currentDueAt, completedAt, timezone, anchorDate } = params

  if (!isRecurring(frequency)) {
    return { nextDueAt: null, missedOccurrences: 0, exhausted: false }
  }

  const anchorDay =
    anchorDate && Number.isFinite(anchorDate.getTime())
      ? zonedParts(anchorDate, timezone).day
      : zonedParts(currentDueAt, timezone).day

  let cursor = currentDueAt
  let steps = 0

  for (;;) {
    const next = nextDueAfter({ frequency, intervalDays, from: cursor, timezone, anchorDay })
    // Шага нет — считаем план неповторяемым, а не зацикливаемся.
    if (!next || next.getTime() <= cursor.getTime()) {
      return { nextDueAt: null, missedOccurrences: 0, exhausted: false }
    }

    cursor = next
    steps += 1

    if (cursor.getTime() > completedAt.getTime()) {
      return { nextDueAt: cursor, missedOccurrences: steps - 1, exhausted: false }
    }

    if (steps >= MAX_CATCH_UP_STEPS) {
      /**
       * 038: будущего визита не нашли. Курсор наружу не отдаём — он всё ещё
       * в прошлом, и записать его значило бы выдать незаконченный расчёт
       * за результат. Вызывающий код оставит план нетронутым.
       */
      return { nextDueAt: null, missedOccurrences: steps, exhausted: true }
    }
  }
}
