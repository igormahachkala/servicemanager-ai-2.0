/**
 * SMA-ANALYTICS-V2-PHASE2 (A2) — проверки строки запроса исполнением.
 *
 * Проверяется поведение функции, а не присутствие строки в исходнике: флаг
 * обязан попадать в запрос только когда включён, а область — не теряться.
 */
import { describe, expect, it } from 'vitest'

import { buildAnalyticsLocationsQuery } from './api'

describe('buildAnalyticsLocationsQuery — A2: точки без заявок', () => {
  it('включённый флаг уходит в запрос', () => {
    const query = buildAnalyticsLocationsQuery({ includeEmptyLocations: true })
    expect(query).toBe('?includeEmptyLocations=true')
  })

  it('выключенный флаг не отправляется вовсе — поведение по умолчанию прежнее', () => {
    expect(buildAnalyticsLocationsQuery({ includeEmptyLocations: false })).toBe('')
    expect(buildAnalyticsLocationsQuery({})).toBe('')
    expect(buildAnalyticsLocationsQuery()).toBe('')
  })

  it('флаг не подменяет minTickets: уходят оба', () => {
    const query = buildAnalyticsLocationsQuery({ includeEmptyLocations: true, minTickets: 5 })
    expect(query).toContain('minTickets=5')
    expect(query).toContain('includeEmptyLocations=true')
  })

  it('minTickets=0 отправляется, а не теряется как пустое значение', () => {
    expect(buildAnalyticsLocationsQuery({ minTickets: 0 })).toBe('?minTickets=0')
  })
})

describe('buildAnalyticsLocationsQuery — область не теряется', () => {
  it('linkedClientCompanyId уходит в запрос', () => {
    expect(buildAnalyticsLocationsQuery({ linkedClientCompanyId: 'client-1' })).toContain(
      'linkedClientCompanyId=client-1',
    )
  })

  it('companyId наблюдателя уходит в запрос', () => {
    expect(buildAnalyticsLocationsQuery({ companyId: 'client-1' })).toContain('companyId=client-1')
  })

  it('флаг не вытесняет область', () => {
    const query = buildAnalyticsLocationsQuery({
      linkedClientCompanyId: 'client-1',
      includeEmptyLocations: true,
    })
    expect(query).toContain('linkedClientCompanyId=client-1')
    expect(query).toContain('includeEmptyLocations=true')
  })

  it('остальные фильтры сохраняются', () => {
    const query = buildAnalyticsLocationsQuery({
      locationId: 'loc-1',
      categoryId: 'cat-1',
      from: '2026-10-01',
      to: '2026-10-31',
    })
    expect(query).toContain('locationId=loc-1')
    expect(query).toContain('categoryId=cat-1')
    expect(query).toContain('from=2026-10-01')
    expect(query).toContain('to=2026-10-31')
  })
})

describe('buildAnalyticsLocationsQuery — границы периода ISO-моментом', () => {
  it('плюс в смещении кодируется, а не превращается в пробел на сервере', () => {
    const query = buildAnalyticsLocationsQuery({
      from: '2026-10-15T00:00:00.000+03:00',
      to: '2026-10-21T23:59:59.999+03:00',
    })
    expect(query).toContain('from=2026-10-15T00%3A00%3A00.000%2B03%3A00')
    const parsed = new URLSearchParams(query.slice(1))
    expect(parsed.get('from')).toBe('2026-10-15T00:00:00.000+03:00')
    expect(parsed.get('to')).toBe('2026-10-21T23:59:59.999+03:00')
  })
})
