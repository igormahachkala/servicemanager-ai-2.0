/**
 * Мобильная аналитика (Analytics V2) — проверки исполнением.
 *
 * Даты строятся локальным конструктором, поэтому тесты верны в любом поясе.
 * Прогон под TZ=Europe/Moscow и TZ=America/New_York ловит возврат к датам UTC.
 */
import { describe, expect, it } from 'vitest'

import type { CityAnalyticsGroup, LocationAnalyticsItem, LocationAnalyticsResponse, SlaMetricsDto } from './api'
import { ALL_CITIES_KEY, NO_CITY_KEY } from './locationAnalyticsGrouping'
import {
  analyticsPeriodRange,
  buildStatusRows,
  canUseManagementAnalytics,
  citySlaRows,
  describePeriod,
  formatCount,
  localDateKey,
  parseLocalDateKey,
  poolSlaMetrics,
  selectScopeMetrics,
  toLocalIsoInstant,
} from './mobileAnalyticsMetrics'

function sla(over: Partial<SlaMetricsDto> = {}): SlaMetricsDto {
  return {
    avgResponseMinutes: null,
    avgResolutionMinutes: null,
    withinSlaRatio: null,
    withinSlaCount: 0,
    slaEvaluatedCount: 0,
    slaBreaches: 0,
    openCount: 0,
    openOverdueCount: 0,
    canceledCount: 0,
    respondedCount: 0,
    resolvedCount: 0,
    withoutSlaCount: 0,
    ...over,
  }
}

function loc(id: string, city: string | null, over: Partial<LocationAnalyticsItem> = {}): LocationAnalyticsItem {
  return {
    locationId: id,
    locationName: `Точка ${id}`,
    city,
    address: null,
    totalTickets: 0,
    newTickets: 0,
    inProgressTickets: 0,
    awaitingAcceptanceTickets: 0,
    doneTickets: 0,
    canceledTickets: 0,
    overdueTickets: 0,
    categories: [],
    sla: sla(),
    ...over,
  }
}

// ─── Период ─────────────────────────────────────────────────────────────────

describe('analyticsPeriodRange — локальные сутки', () => {
  it('7 дней = сегодня и шесть предыдущих календарных дней', () => {
    const now = new Date(2026, 9, 21, 14, 0)
    const range = analyticsPeriodRange('7d', '', '', now)
    expect(range.fromDay).toBe('2026-10-15')
    expect(range.toDay).toBe('2026-10-21')
  })

  it('30 и 90 дней считаются так же — включая сегодня', () => {
    const now = new Date(2026, 9, 21, 9, 0)
    expect(analyticsPeriodRange('30d', '', '', now).fromDay).toBe('2026-09-22')
    expect(analyticsPeriodRange('90d', '', '', now).fromDay).toBe('2026-07-24')
  })

  it('ночью дата берётся локальная, а не UTC (прежний toISOString сдвигал на день)', () => {
    const now = new Date(2026, 9, 21, 0, 30)
    const range = analyticsPeriodRange('7d', '', '', now)
    expect(range.toDay).toBe('2026-10-21')
    expect(range.toDay).toBe(localDateKey(now))
  })

  it('границы — начало первых и конец последних локальных суток', () => {
    const now = new Date(2026, 9, 21, 14, 0)
    const range = analyticsPeriodRange('7d', '', '', now)
    expect(new Date(range.from!).getTime()).toBe(new Date(2026, 9, 15, 0, 0, 0, 0).getTime())
    expect(new Date(range.to!).getTime()).toBe(new Date(2026, 9, 21, 23, 59, 59, 999).getTime())
  })

  it('граница уходит ISO-моментом со смещением, а не датой без времени', () => {
    const range = analyticsPeriodRange('30d', '', '', new Date(2026, 9, 21))
    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000[+-]\d{2}:\d{2}$/)
    expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}T23:59:59\.999[+-]\d{2}:\d{2}$/)
  })

  it('переход через границу месяца и года', () => {
    const range = analyticsPeriodRange('7d', '', '', new Date(2027, 0, 3, 12))
    expect(range.fromDay).toBe('2026-12-28')
    expect(range.toDay).toBe('2027-01-03')
  })

  it('произвольный период: локальные сутки, перепутанные даты меняются местами', () => {
    const range = analyticsPeriodRange('custom', '2026-10-10', '2026-10-01')
    expect(range.fromDay).toBe('2026-10-01')
    expect(range.toDay).toBe('2026-10-10')
    expect(new Date(range.from!).getTime()).toBe(new Date(2026, 9, 1).getTime())
    expect(new Date(range.to!).getTime()).toBe(new Date(2026, 9, 10, 23, 59, 59, 999).getTime())
  })

  it('произвольный период: пустая или битая граница не отправляется', () => {
    expect(analyticsPeriodRange('custom', '', '')).toEqual({ from: undefined, to: undefined, fromDay: undefined, toDay: undefined })
    const onlyFrom = analyticsPeriodRange('custom', '2026-10-01', '2026-02-30')
    expect(onlyFrom.fromDay).toBe('2026-10-01')
    expect(onlyFrom.to).toBeUndefined()
  })

  it('подпись называет даты периода', () => {
    const now = new Date(2026, 9, 21, 14)
    expect(describePeriod('7d', analyticsPeriodRange('7d', '', '', now))).toBe('За 7 дней · 15.10.2026 — 21.10.2026')
    expect(describePeriod('custom', analyticsPeriodRange('custom', '', ''))).toBe('За всё время')
    expect(describePeriod('custom', analyticsPeriodRange('custom', '2026-10-01', ''))).toBe('С 01.10.2026')
  })
})

describe('даты: вспомогательные функции', () => {
  it('toLocalIsoInstant даёт тот же момент', () => {
    const date = new Date(2026, 2, 29, 3, 15, 7, 42)
    expect(new Date(toLocalIsoInstant(date)).getTime()).toBe(date.getTime())
  })

  it('parseLocalDateKey отбрасывает несуществующие даты', () => {
    expect(parseLocalDateKey('2026-02-30')).toBeNull()
    expect(parseLocalDateKey('21.10.2026')).toBeNull()
    expect(parseLocalDateKey('2026-10-21')?.getDate()).toBe(21)
  })
})

// ─── Доступ ─────────────────────────────────────────────────────────────────

describe('canUseManagementAnalytics — роль И ManagementSurface', () => {
  it('ADMIN/MASTER/DISPATCHER с доступом к управленческой части — да', () => {
    for (const role of ['ADMIN', 'MASTER', 'DISPATCHER']) {
      expect(canUseManagementAnalytics({ role, canAccessManagementSurface: true })).toBe(true)
    }
  })

  it('роль подходит, но ManagementSurface закрыт (MASTER клиента, NETWORK_DIRECTOR) — нет', () => {
    expect(canUseManagementAnalytics({ role: 'MASTER', canAccessManagementSurface: false })).toBe(false)
    expect(canUseManagementAnalytics({ role: 'NETWORK_DIRECTOR', canAccessManagementSurface: false })).toBe(false)
    expect(canUseManagementAnalytics({ role: 'ADMIN' })).toBe(false)
  })

  it('роли вне @Roles контроллера — нет, даже с флагом', () => {
    for (const role of ['TECHNICIAN', 'CLIENT', 'CLIENT_ADMIN', 'ADMIN_PROVIDER', 'TERRITORIAL_MANAGER']) {
      expect(canUseManagementAnalytics({ role, canAccessManagementSurface: true })).toBe(false)
    }
  })

  it('PLATFORM_ADMIN проходит guard безусловно', () => {
    expect(canUseManagementAnalytics({ role: 'PLATFORM_ADMIN', canAccessManagementSurface: false })).toBe(true)
  })

  it('нет пользователя — нет', () => {
    expect(canUseManagementAnalytics(null)).toBe(false)
    expect(canUseManagementAnalytics(undefined)).toBe(false)
  })
})

// ─── Показатели области ─────────────────────────────────────────────────────

const moscowSla = sla({ withinSlaCount: 3, slaEvaluatedCount: 4, withinSlaRatio: 0.75, respondedCount: 4, avgResponseMinutes: 30, resolvedCount: 4, avgResolutionMinutes: 120, openCount: 2, openOverdueCount: 1, slaBreaches: 1 })
const kazanSla = sla({ withinSlaCount: 1, slaEvaluatedCount: 1, withinSlaRatio: 1, respondedCount: 1, avgResponseMinutes: 10, resolvedCount: 1, avgResolutionMinutes: 60 })

function response(): LocationAnalyticsResponse {
  const m1 = loc('m1', 'Москва', { totalTickets: 6, newTickets: 1, inProgressTickets: 1, doneTickets: 4, overdueTickets: 1, sla: sla({ withinSlaCount: 3, slaEvaluatedCount: 3, withinSlaRatio: 1, respondedCount: 3, avgResponseMinutes: 20, resolvedCount: 4, avgResolutionMinutes: 120, openCount: 2, openOverdueCount: 1, slaBreaches: 1 }) })
  const m2 = loc('m2', ' москва ', { totalTickets: 1, sla: sla({ slaEvaluatedCount: 1, respondedCount: 1, avgResponseMinutes: 60 }) })
  const k1 = loc('k1', 'Казань', { totalTickets: 1, doneTickets: 1, sla: kazanSla })
  const cityGroups: CityAnalyticsGroup[] = [
    { cityKey: 'москва', cityLabel: 'Москва', locationsCount: 2, totalTickets: 7, newTickets: 1, inProgressTickets: 1, awaitingAcceptanceTickets: 0, doneTickets: 4, canceledTickets: 0, overdueTickets: 1, sla: moscowSla },
    { cityKey: 'казань', cityLabel: 'Казань', locationsCount: 1, totalTickets: 1, newTickets: 0, inProgressTickets: 0, awaitingAcceptanceTickets: 0, doneTickets: 1, canceledTickets: 0, overdueTickets: 0, sla: kazanSla },
    { cityKey: NO_CITY_KEY, cityLabel: 'Город не указан', locationsCount: 1, totalTickets: 0, newTickets: 0, inProgressTickets: 0, awaitingAcceptanceTickets: 0, doneTickets: 0, canceledTickets: 0, overdueTickets: 0, sla: sla() },
  ]
  return {
    items: [m1, m2, k1, loc('x', null)],
    cityGroups,
    summary: {
      totalLocations: 4,
      // 3 заявки на деактивированной точке: в summary есть, в строках — нет.
      totalTickets: 11,
      totalOverdue: 2,
      inProgressTotal: 1,
      awaitingAcceptanceTotal: 0,
      doneTotal: 5,
      canceledTotal: 0,
      ticketsOutsideRows: 3,
      sla: sla({ withinSlaRatio: 0.8, withinSlaCount: 4, slaEvaluatedCount: 5 }),
    },
  }
}

describe('selectScopeMetrics — KPI совпадают с серверными агрегатами', () => {
  it('без выбора — ровно summary, а не сумма строк (заявки вне строк не теряются)', () => {
    const metrics = selectScopeMetrics(response(), ALL_CITIES_KEY)!
    expect(metrics.scope).toBe('organization')
    expect(metrics.totalTickets).toBe(11)
    expect(metrics.overdueTickets).toBe(2)
    expect(metrics.doneTickets).toBe(5)
    expect(metrics.sla?.withinSlaRatio).toBe(0.8)
    expect(metrics.ticketsOutsideRows).toBe(3)
  })

  it('город — агрегат бэкенда (cityGroups), включая его SLA', () => {
    const metrics = selectScopeMetrics(response(), 'москва')!
    expect(metrics.scope).toBe('city')
    expect(metrics.totalTickets).toBe(7)
    expect(metrics.sla).toBe(moscowSla)
    expect(metrics.ticketsOutsideRows).toBe(0)
  })

  it('выбранные точки — сумма их строк и SLA из счётчиков', () => {
    const metrics = selectScopeMetrics(response(), 'москва', ['m1', 'm2'])!
    expect(metrics.scope).toBe('locations')
    expect(metrics.totalTickets).toBe(7)
    expect(metrics.locationsCount).toBe(2)
    expect(metrics.sla?.withinSlaRatio).toBe(0.75)
    expect(metrics.sla?.slaEvaluatedCount).toBe(4)
  })

  it('точка чужого города в выборе ничего не добавляет', () => {
    const metrics = selectScopeMetrics(response(), 'москва', ['k1'])!
    expect(metrics.scope).toBe('city')
    expect(metrics.totalTickets).toBe(7)
  })

  it('старый контур без cityGroups: город — сумма строк, SLA неизвестен (null, не ноль)', () => {
    const data = response()
    delete data.cityGroups
    const metrics = selectScopeMetrics(data, 'москва')!
    expect(metrics.totalTickets).toBe(7)
    expect(metrics.sla).toBeNull()
  })

  it('старый контур без summary.sla — SLA null', () => {
    const data = response()
    delete data.summary.sla
    expect(selectScopeMetrics(data, ALL_CITIES_KEY)!.sla).toBeNull()
  })

  it('нет данных — null', () => {
    expect(selectScopeMetrics(undefined, ALL_CITIES_KEY)).toBeNull()
  })
})

describe('poolSlaMetrics', () => {
  it('доля — из счётчиков, а не среднее долей', () => {
    const pooled = poolSlaMetrics([
      sla({ withinSlaCount: 1, slaEvaluatedCount: 1, withinSlaRatio: 1 }),
      sla({ withinSlaCount: 0, slaEvaluatedCount: 3, withinSlaRatio: 0 }),
    ])!
    expect(pooled.withinSlaRatio).toBe(0.25)
  })

  it('средние взвешены числом заявок', () => {
    const pooled = poolSlaMetrics([
      sla({ respondedCount: 1, avgResponseMinutes: 100 }),
      sla({ respondedCount: 3, avgResponseMinutes: 20 }),
    ])!
    expect(pooled.avgResponseMinutes).toBe(40)
  })

  it('нечего оценивать — null, а не 0%', () => {
    const pooled = poolSlaMetrics([sla(), sla()])!
    expect(pooled.withinSlaRatio).toBeNull()
    expect(pooled.avgResponseMinutes).toBeNull()
  })

  it('у одной из точек нет SLA — итог неизвестен целиком', () => {
    expect(poolSlaMetrics([sla(), undefined])).toBeNull()
    expect(poolSlaMetrics([])).toBeNull()
  })

  it('необязательные поля старого контура не превращаются в ноль', () => {
    const pooled = poolSlaMetrics([sla({ openCount: undefined, openOverdueCount: undefined }), sla()])!
    expect(pooled.openCount).toBeUndefined()
    expect(pooled.openOverdueCount).toBeUndefined()
  })
})

describe('buildStatusRows', () => {
  it('все строки — из одной выборки за период', () => {
    const rows = buildStatusRows(selectScopeMetrics(response(), 'москва'))
    expect(rows.map((r) => [r.key, r.value])).toEqual([
      ['new', 1],
      ['inprogress', 1],
      ['awaiting', 0],
      ['done', 4],
      ['canceled', 0],
    ])
  })

  it('фильтр статусов: ASSIGNED и IN_PROGRESS оба дают строку «В работе»', () => {
    const metrics = selectScopeMetrics(response(), ALL_CITIES_KEY)
    expect(buildStatusRows(metrics, new Set(['ASSIGNED'])).map((r) => r.key)).toEqual(['inprogress'])
    expect(buildStatusRows(metrics, new Set(['IN_PROGRESS', 'DONE'])).map((r) => r.key)).toEqual(['inprogress', 'done'])
  })

  it('нет данных — значения null, а не 0', () => {
    expect(buildStatusRows(null).every((r) => r.value === null)).toBe(true)
  })

  it('поле не пришло со старого контура — null', () => {
    const data = response()
    data.items = data.items.map((i) => ({ ...i, awaitingAcceptanceTickets: undefined }))
    delete data.cityGroups
    const rows = buildStatusRows(selectScopeMetrics(data, 'москва'))
    expect(rows.find((r) => r.key === 'awaiting')?.value).toBeNull()
  })
})

describe('citySlaRows', () => {
  it('порядок бэкенда, города без заявок за период скрыты', () => {
    expect(citySlaRows(response().cityGroups).map((c) => c.cityKey)).toEqual(['москва', 'казань'])
  })

  it('нет агрегатов — пустой список', () => {
    expect(citySlaRows(undefined)).toEqual([])
  })
})

describe('formatCount', () => {
  it('ноль — значение, отсутствие — прочерк', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(null)).toBe('—')
    expect(formatCount(undefined)).toBe('—')
    expect(formatCount(Number.NaN)).toBe('—')
  })
})
