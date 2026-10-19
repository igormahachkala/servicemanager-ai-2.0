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
