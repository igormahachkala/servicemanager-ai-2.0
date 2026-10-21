/**
 * Границы периода для GET /analytics/locations.
 *
 * Чистый модуль: ни Prisma, ни Nest. Проверяется исполнением.
 *
 * Принимаются два вида значений:
 *
 * 1. Дата без времени (YYYY-MM-DD) — прежний контракт десктопа. from — начало
 *    суток, to — конец суток. Поведение не меняется: старые клиенты получают
 *    ровно то, что получали.
 * 2. Момент ISO 8601 со смещением (2026-10-15T00:00:00.000+03:00 или ...Z).
 *    Берётся как есть, без подгонки к суткам сервера. Так клиент передаёт
 *    границы СВОИХ локальных суток: календарный день пользователя в Москве
 *    и день сервера в UTC не совпадают, и дата без времени теряла бы
 *    до трёх часов с каждого края.
 *
 * Прочие строки игнорируются, как и раньше: фильтр по этой границе не ставится.
 * Границы только сужают выборку и на область видимости не влияют.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/

export type AnalyticsDateFilter = { gte?: Date; lte?: Date }

function parseBound(raw: string | undefined, edge: 'from' | 'to'): Date | undefined {
  const value = (raw ?? '').trim()
  if (!value) return undefined

  if (ISO_INSTANT.test(value)) {
    const instant = new Date(value)
    return Number.isNaN(instant.getTime()) ? undefined : instant
  }

  if (DATE_ONLY.test(value)) {
    const day = new Date(value)
    if (Number.isNaN(day.getTime())) return undefined
    if (edge === 'to') day.setHours(23, 59, 59, 999)
    return day
  }

  /*
   * Прежний разбор принимал всё, что понимает new Date. Сохраняем это для
   * совместимости, но конец периода для такой строки не подгоняется.
   */
  const fallback = new Date(value)
  if (Number.isNaN(fallback.getTime())) return undefined
  if (edge === 'to') fallback.setHours(23, 59, 59, 999)
  return fallback
}

export function parseAnalyticsDateRange(from?: string, to?: string): AnalyticsDateFilter {
  const filter: AnalyticsDateFilter = {}
  const gte = parseBound(from, 'from')
  const lte = parseBound(to, 'to')
  if (gte) filter.gte = gte
  if (lte) filter.lte = lte
  return filter
}
