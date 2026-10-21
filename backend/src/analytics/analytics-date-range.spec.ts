/**
 * Границы периода /analytics/locations — проверки исполнением.
 *
 * Дата без времени обязана вести себя как раньше (десктоп), ISO-момент —
 * браться как есть (локальные сутки мобильного клиента).
 */
import { parseAnalyticsDateRange } from './analytics-date-range'

describe('parseAnalyticsDateRange', () => {
  it('пустые значения не ставят фильтр', () => {
    expect(parseAnalyticsDateRange()).toEqual({})
    expect(parseAnalyticsDateRange('', '  ')).toEqual({})
  })

  it('дата без времени: прежний контракт — from как new Date, to до конца суток', () => {
    const expectedFrom = new Date('2026-10-01')
    const expectedTo = new Date('2026-10-07')
    expectedTo.setHours(23, 59, 59, 999)

    const range = parseAnalyticsDateRange('2026-10-01', '2026-10-07')
    expect(range.gte?.getTime()).toBe(expectedFrom.getTime())
    expect(range.lte?.getTime()).toBe(expectedTo.getTime())
  })

  it('ISO-момент со смещением берётся как есть, без подгонки к суткам сервера', () => {
    const range = parseAnalyticsDateRange(
      '2026-10-15T00:00:00.000+03:00',
      '2026-10-21T23:59:59.999+03:00',
    )
    expect(range.gte?.toISOString()).toBe('2026-10-14T21:00:00.000Z')
    expect(range.lte?.toISOString()).toBe('2026-10-21T20:59:59.999Z')
  })

  it('ISO-момент в UTC (Z) тоже берётся как есть', () => {
    const range = parseAnalyticsDateRange('2026-10-15T00:00:00Z', '2026-10-15T12:30Z')
    expect(range.gte?.toISOString()).toBe('2026-10-15T00:00:00.000Z')
    expect(range.lte?.toISOString()).toBe('2026-10-15T12:30:00.000Z')
  })

  it('мусор игнорируется — фильтр по этой границе не ставится', () => {
    expect(parseAnalyticsDateRange('not-a-date', 'xx')).toEqual({})
    expect(parseAnalyticsDateRange('2026-13-45', undefined)).toEqual({})
  })

  it('одна граница не требует другой', () => {
    expect(Object.keys(parseAnalyticsDateRange('2026-10-01'))).toEqual(['gte'])
    expect(Object.keys(parseAnalyticsDateRange(undefined, '2026-10-01'))).toEqual(['lte'])
  })
})
