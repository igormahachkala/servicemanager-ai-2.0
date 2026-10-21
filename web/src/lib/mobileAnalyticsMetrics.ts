/**
 * Мобильная аналитика поверх Analytics V2 (Phase 2): период, показатели
 * выбранной области, распределение по статусам.
 *
 * Чистый модуль: ни React, ни сети. Окружение тестов node, поэтому все
 * решения о цифрах вынесены сюда и проверяются исполнением.
 *
 * Прав модуль не выдаёт и не отнимает. Он получает строки, которые бэкенд
 * УЖЕ сузил областью видимости (GET /analytics/locations), и только выбирает,
 * какой из канонических агрегатов показать. Своих формул по заявкам здесь
 * нет: итог организации — summary, итог города — cityGroups бэкенда.
 * Единственное, что складывается на клиенте, — счётчики выбранных точек:
 * заявка принадлежит ровно одной точке, поэтому сумма по точкам — разбиение.
 */
import type { CityAnalyticsGroup, LocationAnalyticsItem, LocationAnalyticsResponse, SlaMetricsDto } from './api'
import { ALL_CITIES_KEY, normalizeCityKey, selectVisibleLocations } from './locationAnalyticsGrouping'

// ─── Период ─────────────────────────────────────────────────────────────────

export type AnalyticsPeriod = '7d' | '30d' | '90d' | '365d' | 'custom'

export const PERIOD_DAYS: Record<Exclude<AnalyticsPeriod, 'custom'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365,
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Календарная дата в ЛОКАЛЬНОМ поясе, YYYY-MM-DD. toISOString дал бы дату UTC. */
export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** YYYY-MM-DD → локальная полночь. Некорректная строка → null. */
export function parseLocalDateKey(key: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((key ?? '').trim())
  if (!match) return null
  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) return null
  return date
}

/**
 * Момент ISO 8601 с локальным смещением: 2026-10-15T00:00:00.000+03:00.
 *
 * Смещение берётся для самого момента, а не для «сейчас»: на переходе
 * летнего времени начало и конец периода живут в разных смещениях.
 */
export function toLocalIsoInstant(date: Date): string {
  const offsetMin = -date.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  return (
    `${localDateKey(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}.${ms}` +
    `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
  )
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

function endOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

export type AnalyticsDateRange = {
  /** Границы для запроса: ISO-моменты локальных суток. */
  from?: string
  to?: string
  /** Календарные дни для подписи, YYYY-MM-DD. */
  fromDay?: string
  toDay?: string
}

/**
 * Границы периода в локальных сутках пользователя.
 *
 * «7 дней» — это сегодня и шесть предыдущих календарных дней, всего семь.
 * Прежний расчёт отнимал семь суток от «сейчас» и брал дату UTC: выходило
 * восемь календарных дней, а ночью по Москве ещё и со сдвигом на день.
 *
 * Дни отнимаются через конструктор Date(y, m, d - n), а не вычитанием
 * миллисекунд: так переход на летнее время не сдвигает полночь.
 *
 * Произвольный период: перепутанные даты меняются местами, отсутствующая
 * граница не отправляется.
 */
export function analyticsPeriodRange(
  period: AnalyticsPeriod,
  customFrom: string,
  customTo: string,
  now: Date = new Date(),
): AnalyticsDateRange {
  if (period === 'custom') {
    let start = parseLocalDateKey(customFrom)
    let end = parseLocalDateKey(customTo)
    if (start && end && start.getTime() > end.getTime()) [start, end] = [end, start]
    return {
      from: start ? toLocalIsoInstant(startOfLocalDay(start)) : undefined,
      to: end ? toLocalIsoInstant(endOfLocalDay(end)) : undefined,
      fromDay: start ? localDateKey(start) : undefined,
      toDay: end ? localDateKey(end) : undefined,
    }
  }

  const days = PERIOD_DAYS[period]
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1))
  const end = endOfLocalDay(now)
  return {
    from: toLocalIsoInstant(start),
    to: toLocalIsoInstant(end),
    fromDay: localDateKey(start),
    toDay: localDateKey(end),
  }
}

function shortDay(key?: string): string {
  const date = parseLocalDateKey(key)
  return date ? `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}` : '…'
}

/** Подпись периода с датами: видно, какие именно сутки вошли. */
export function describePeriod(period: AnalyticsPeriod, range: AnalyticsDateRange): string {
  if (period !== 'custom') {
    return `За ${PERIOD_DAYS[period]} дней · ${shortDay(range.fromDay)} — ${shortDay(range.toDay)}`
  }
  if (!range.fromDay && !range.toDay) return 'За всё время'
  if (!range.fromDay) return `По ${shortDay(range.toDay)}`
  if (!range.toDay) return `С ${shortDay(range.fromDay)}`
  return `${shortDay(range.fromDay)} — ${shortDay(range.toDay)}`
}

// ─── Доступ ─────────────────────────────────────────────────────────────────

/** Роли backend analytics.controller (@Roles). */
const ANALYTICS_CONTROLLER_ROLES = new Set(['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR', 'PLATFORM_ADMIN'])

/**
 * Показывать ли управленческую аналитику (/analytics/*).
 *
 * Бэкенд пропускает только при ДВУХ условиях: роль из @Roles и
 * ManagementSurfaceGuard (тип компании × роль). Сервер отдаёт решение второго
 * готовым флагом canAccessManagementSurface. Проверка одной роли пропускала,
 * например, MASTER клиентской компании и NETWORK_DIRECTOR: экран строился как
 * управленческий и падал на 403. Таким пользователям остаётся контекст заявок.
 *
 * Это подсказка интерфейсу, а не граница доступа: граница — на бэкенде.
 */
export function canUseManagementAnalytics(
  me: { role?: string | null; canAccessManagementSurface?: boolean | null } | null | undefined,
): boolean {
  if (!me?.role || !ANALYTICS_CONTROLLER_ROLES.has(me.role)) return false
  if (me.role === 'PLATFORM_ADMIN') return true
  return me.canAccessManagementSurface === true
}

// ─── Показатели выбранной области ───────────────────────────────────────────

export type SlaView = SlaMetricsDto

export type ScopeMetrics = {
  /** Чей это итог: организация (summary), город (cityGroups) или выбранные точки. */
  scope: 'organization' | 'city' | 'locations'
  totalTickets: number
  /** Нарушения SLA за период — тот же признак slaBreachedAt, что и в summary.totalOverdue. */
  overdueTickets: number
  doneTickets: number
  /** Распределение по статусам. null — бэкенд это поле не отдал. */
  newTickets: number | null
  inProgressTickets: number | null
  awaitingAcceptanceTickets: number | null
  canceledTickets: number | null
  /** null — бэкенд SLA не отдал (контур старее Phase 2) или считать нечего. */
  sla: SlaView | null
  locationsCount: number
  /**
   * Заявки, которым не досталось строки точки. Только для организации:
   * у них нет города, поэтому в город и точки они не попадают.
   */
  ticketsOutsideRows: number
}

const sumOf = <T>(rows: readonly T[], pick: (row: T) => number) => rows.reduce((sum, row) => sum + pick(row), 0)

/** Сумма необязательного поля: если хоть у одной строки его нет — null, а не заниженный итог. */
function sumOptional<T>(rows: readonly T[], pick: (row: T) => number | undefined): number | null {
  let sum = 0
  for (const row of rows) {
    const value = pick(row)
    if (value == null) return null
    sum += value
  }
  return sum
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * SLA нескольких точек.
 *
 * Доля в SLA собирается из СЧЁТЧИКОВ (в срок / оценено), а не усреднением
 * долей: точка с одной заявкой не должна весить как точка с пятьюстами.
 * Средние времена взвешиваются числом заявок, по которым посчитаны.
 * Округление как на бэкенде (analytics-aggregates.computeSlaMetrics).
 *
 * Если хоть у одной точки SLA нет — null целиком: частичная сумма выглядела бы
 * как настоящий итог.
 */
export function poolSlaMetrics(list: ReadonlyArray<SlaView | null | undefined>): SlaView | null {
  if (list.length === 0) return null
  const metrics: SlaView[] = []
  for (const item of list) {
    if (!item) return null
    metrics.push(item)
  }

  const withinSlaCount = sumOf(metrics, (m) => m.withinSlaCount)
  const slaEvaluatedCount = sumOf(metrics, (m) => m.slaEvaluatedCount)
  const respondedCount = sumOf(metrics, (m) => m.respondedCount)
  const resolvedCount = sumOf(metrics, (m) => m.resolvedCount)

  const weighted = (pick: (m: SlaView) => number | null, weight: (m: SlaView) => number, total: number) => {
    if (total === 0) return null
    let acc = 0
    for (const m of metrics) {
      const value = pick(m)
      if (value != null) acc += value * weight(m)
    }
    return round1(acc / total)
  }

  return {
    avgResponseMinutes: weighted((m) => m.avgResponseMinutes, (m) => m.respondedCount, respondedCount),
    avgResolutionMinutes: weighted((m) => m.avgResolutionMinutes, (m) => m.resolvedCount, resolvedCount),
    withinSlaRatio: slaEvaluatedCount > 0 ? round1((withinSlaCount / slaEvaluatedCount) * 100) / 100 : null,
    withinSlaCount,
    slaEvaluatedCount,
    slaBreaches: sumOf(metrics, (m) => m.slaBreaches),
    openCount: sumOptional(metrics, (m) => m.openCount) ?? undefined,
    openOverdueCount: sumOptional(metrics, (m) => m.openOverdueCount) ?? undefined,
    canceledCount: sumOptional(metrics, (m) => m.canceledCount) ?? undefined,
    respondedCount,
    resolvedCount,
    withoutSlaCount: sumOf(metrics, (m) => m.withoutSlaCount),
  }
}

function fromRows(rows: readonly LocationAnalyticsItem[]) {
  return {
    totalTickets: sumOf(rows, (r) => r.totalTickets),
    overdueTickets: sumOf(rows, (r) => r.overdueTickets),
    doneTickets: sumOf(rows, (r) => r.doneTickets),
    newTickets: sumOf(rows, (r) => r.newTickets),
    inProgressTickets: sumOf(rows, (r) => r.inProgressTickets),
    awaitingAcceptanceTickets: sumOptional(rows, (r) => r.awaitingAcceptanceTickets),
    canceledTickets: sumOptional(rows, (r) => r.canceledTickets),
  }
}

/**
 * Показатели текущего выбора.
 *
 * - Ничего не выбрано — итог организации из summary. Именно его показывает
 *   десктоп; прежняя мобильная версия складывала строки и теряла заявки
 *   деактивированных точек (summary.ticketsOutsideRows), а SLA брала из
 *   overview — за всё время и по другой формуле.
 * - Выбран город — агрегат города, посчитанный бэкендом.
 * - Выбраны точки — сумма их строк, SLA — из счётчиков точек.
 *
 * Распределение по статусам у организации — по строкам точек: summary не
 * отдаёт «новые» отдельно. Расхождение с итогом равно ticketsOutsideRows и
 * показывается на экране, а не прячется.
 */
export function selectScopeMetrics(
  data: LocationAnalyticsResponse | null | undefined,
  cityKey: string,
  selectedLocationIds: readonly string[] = [],
): ScopeMetrics | null {
  if (!data) return null
  const items = data.items ?? []

  if (selectedLocationIds.length > 0) {
    const rows = selectVisibleLocations(items, cityKey, selectedLocationIds)
    if (rows.length > 0) {
      return {
        scope: 'locations',
        ...fromRows(rows),
        sla: poolSlaMetrics(rows.map((r) => r.sla)),
        locationsCount: rows.length,
        ticketsOutsideRows: 0,
      }
    }
  }

  if (cityKey !== ALL_CITIES_KEY) {
    const server = (data.cityGroups ?? []).find((group) => group.cityKey === cityKey)
    if (server) {
      return {
        scope: 'city',
        totalTickets: server.totalTickets,
        overdueTickets: server.overdueTickets,
        doneTickets: server.doneTickets,
        newTickets: server.newTickets,
        inProgressTickets: server.inProgressTickets,
        awaitingAcceptanceTickets: server.awaitingAcceptanceTickets,
        canceledTickets: server.canceledTickets,
        sla: server.sla ?? null,
        locationsCount: server.locationsCount,
        ticketsOutsideRows: 0,
      }
    }
    // Контур старее Phase 2: агрегатов города нет — сумма строк, SLA неизвестен.
    const rows = items.filter((item) => normalizeCityKey(item.city) === cityKey)
    return {
      scope: 'city',
      ...fromRows(rows),
      sla: null,
      locationsCount: rows.length,
      ticketsOutsideRows: 0,
    }
  }

  const summary = data.summary
  const rows = fromRows(items)
  return {
    scope: 'organization',
    totalTickets: summary.totalTickets,
    overdueTickets: summary.totalOverdue,
    doneTickets: summary.doneTotal,
    newTickets: rows.newTickets,
    inProgressTickets: summary.inProgressTotal,
    awaitingAcceptanceTickets: summary.awaitingAcceptanceTotal ?? rows.awaitingAcceptanceTickets,
    canceledTickets: summary.canceledTotal ?? rows.canceledTickets,
    sla: summary.sla ?? null,
    locationsCount: summary.totalLocations,
    ticketsOutsideRows: Math.max(0, summary.ticketsOutsideRows ?? summary.totalTickets - rows.totalTickets),
  }
}

// ─── Распределение по статусам ──────────────────────────────────────────────

export type StatusRowKey = 'new' | 'inprogress' | 'awaiting' | 'done' | 'canceled'

export type StatusRow = { key: StatusRowKey; label: string; value: number | null }

/** Какие статусы заявки входят в строку (для фильтра статусов). */
export const STATUS_ROW_CODES: Record<StatusRowKey, readonly string[]> = {
  new: ['NEW'],
  inprogress: ['ASSIGNED', 'IN_PROGRESS'],
  awaiting: ['AWAITING_ACCEPTANCE'],
  done: ['DONE'],
  canceled: ['CANCELED'],
}

/**
 * Строки распределения для выбранной области — все за один и тот же период.
 *
 * Прежде «Новые/Назначенные/В работе» шли из overview (текущее состояние,
 * без периода), а «Выполненные» — из locations за период: строки одного
 * графика описывали разные выборки.
 */
export function buildStatusRows(metrics: ScopeMetrics | null, selectedStatuses: ReadonlySet<string> = new Set()): StatusRow[] {
  const rows: StatusRow[] = [
    { key: 'new', label: 'Новые', value: metrics?.newTickets ?? null },
    { key: 'inprogress', label: 'В работе', value: metrics?.inProgressTickets ?? null },
    { key: 'awaiting', label: 'На приёмке', value: metrics?.awaitingAcceptanceTickets ?? null },
    { key: 'done', label: 'Выполненные', value: metrics?.doneTickets ?? null },
    { key: 'canceled', label: 'Отменённые', value: metrics?.canceledTickets ?? null },
  ]
  if (selectedStatuses.size === 0) return rows
  return rows.filter((row) => STATUS_ROW_CODES[row.key].some((code) => selectedStatuses.has(code)))
}

// ─── SLA по городам ─────────────────────────────────────────────────────────

/**
 * Города для блока «SLA по городам» — в порядке бэкенда (по убыванию заявок,
 * «Город не указан» последним). Города без заявок за период не показываются:
 * у них нечего оценивать, а строка из прочерков только занимает экран.
 */
export function citySlaRows(groups: readonly CityAnalyticsGroup[] | null | undefined): CityAnalyticsGroup[] {
  return (groups ?? []).filter((group) => group.totalTickets > 0)
}

// ─── Отображение ────────────────────────────────────────────────────────────

/** Число или прочерк. Ноль — измеренное значение и прочерком не становится. */
export function formatCount(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('ru-RU').format(value) : '—'
}
