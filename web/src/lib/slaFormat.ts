/**
 * SMA-ANALYTICS-V2-PHASE2 (A3) — отображение показателей SLA.
 *
 * Чистый модуль: ни React, ни сети. Окружение тестов node, DOM нет, поэтому
 * решения о том, как показывать «нет данных», вынесены сюда и проверяются
 * исполнением.
 *
 * Главное правило: null — это «нечего считать», а не ноль. Ноль минут и
 * отсутствие данных на экране обязаны выглядеть по-разному, иначе точка без
 * заявок будет читаться как точка с мгновенной реакцией.
 */

export type SlaMetricsView = {
  avgResponseMinutes: number | null
  avgResolutionMinutes: number | null
  withinSlaRatio: number | null
  withinSlaCount: number
  slaEvaluatedCount: number
  slaBreaches: number
  respondedCount: number
  resolvedCount: number
  withoutSlaCount: number
}

/** Прочерк для отсутствующих данных. Один на весь модуль, чтобы не разъезжался. */
export const NO_DATA = '—'

/**
 * Длительность в человеческом виде.
 *
 * null → прочерк. Ноль → «0 мин», а не прочерк: ноль это измеренное значение.
 * Дальше минуты, часы, сутки — чтобы «2160 мин» не приходилось делить в голове.
 */
export function formatMinutes(value: number | null | undefined): string {
  if (value == null) return NO_DATA
  if (value < 1) return '0 мин'

  const totalMinutes = Math.round(value)
  if (totalMinutes < 60) return `${totalMinutes} мин`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours < 24) return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`

  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  return restHours > 0 ? `${days} д ${restHours} ч` : `${days} д`
}

/**
 * Доля в SLA в процентах.
 *
 * null → прочерк. Это важнее, чем кажется: показать «0%» там, где не было ни
 * одной заявки со сроком, значит обвинить исполнителей в том, чего не было.
 */
export function formatSlaRatio(value: number | null | undefined): string {
  if (value == null) return NO_DATA
  return `${Math.round(value * 100)}%`
}

/**
 * Пояснение к доле: из чего она посчитана.
 *
 * Отдельная подпись нужна, потому что знаменатель — не все заявки, а только
 * завершённые со заданным сроком. Завершённые без срока показываются отдельно
 * и в долю не входят: отсутствие данных не является соблюдением SLA.
 */
export function describeSlaBasis(metrics: SlaMetricsView): string {
  if (metrics.slaEvaluatedCount === 0) {
    return metrics.withoutSlaCount > 0
      ? `нет заявок с заданным сроком (${metrics.withoutSlaCount} завершено без срока)`
      : 'нет завершённых заявок со сроком'
  }
  const base = `${metrics.withinSlaCount} из ${metrics.slaEvaluatedCount} завершённых со сроком`
  return metrics.withoutSlaCount > 0
    ? `${base}; ещё ${metrics.withoutSlaCount} без срока`
    : base
}

/**
 * Какой SLA показывать для текущего выбора.
 *
 * Выбран город — его показатели, иначе показатели организации. Городские
 * считает бэкенд по заявкам города; усреднять средние по точкам на клиенте
 * нельзя, поэтому своего расчёта здесь нет вовсе.
 */
export function pickSlaForScope<T extends SlaMetricsView>(
  organizationSla: T | null | undefined,
  citySla: T | null | undefined,
  isCitySelected: boolean,
): T | null {
  if (isCitySelected) return citySla ?? null
  return organizationSla ?? null
}
