import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isManagementNavItemVisible } from './navigation'
import { locationSectionLinks, readLocationFilterFromSearch } from './locationCardSections'
import type { Role } from './api'

const here = dirname(fileURLToPath(import.meta.url))
const readSrc = (relative: string) => readFileSync(resolve(here, '..', relative), 'utf8')
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

const PROVIDER_SCOPE = { linkedClientCompanyId: 'client-A' }
const OBSERVER_SCOPE = { companyId: 'observed-1' }

describe('LOCATION CARD V2 Phase 1: переходы узла', () => {
  it('1. переходы несут и точку, и область', () => {
    const links = locationSectionLinks({
      locationId: 'loc-1',
      scope: PROVIDER_SCOPE,
      canViewAnalytics: true,
    })

    expect(links.equipment).toBe('/equipment?linkedClientCompanyId=client-A&locationId=loc-1')
    expect(links.rounds).toBe('/inspection/schedules?linkedClientCompanyId=client-A&locationId=loc-1')
    expect(links.analytics).toBe('/analytics/locations?linkedClientCompanyId=client-A&locationId=loc-1')
  })

  it('2. ИНВАРИАНТ: область уезжает тем параметром, которым пришла', () => {
    /*
     * Shell перезаписывает сохранённую пару областей на каждом переходе,
     * поэтому отдать провайдеру «?companyId=» значило затереть ему
     * linkedClientCompanyId — дефект Equipment V2, повторять нельзя.
     */
    const provider = locationSectionLinks({ locationId: 'loc-1', scope: PROVIDER_SCOPE, canViewAnalytics: true })
    for (const href of [provider.equipment, provider.rounds, provider.analytics!]) {
      expect(href).toContain('linkedClientCompanyId=client-A')
      expect(href).not.toContain('companyId=client-A')
    }

    const observer = locationSectionLinks({ locationId: 'loc-1', scope: OBSERVER_SCOPE, canViewAnalytics: true })
    for (const href of [observer.equipment, observer.rounds, observer.analytics!]) {
      expect(href).toContain('companyId=observed-1')
      expect(href).not.toContain('linkedClientCompanyId')
    }
  })

  it('3. без области — чистые пути, без пустых параметров', () => {
    const links = locationSectionLinks({ locationId: 'loc-1', scope: null, canViewAnalytics: true })
    expect(links.equipment).toBe('/equipment?locationId=loc-1')
    expect(links.rounds).toBe('/inspection/schedules?locationId=loc-1')
    expect(links.analytics).toBe('/analytics/locations?locationId=loc-1')

    const blank = locationSectionLinks({
      locationId: 'loc-1',
      scope: { companyId: '  ', linkedClientCompanyId: '' },
      canViewAnalytics: false,
    })
    expect(blank.equipment).toBe('/equipment?locationId=loc-1')
  })

  it('4. аналитика скрыта, когда роли её не показывают', () => {
    const hidden = locationSectionLinks({ locationId: 'loc-1', scope: PROVIDER_SCOPE, canViewAnalytics: false })
    expect(hidden.analytics).toBeNull()
    // Остальные разделы от этого не меняются.
    expect(hidden.equipment).toContain('locationId=loc-1')
  })

  it('5. видимость аналитики берётся из канонического гейта Navigation V2', () => {
    /*
     * Второго гейта не заводится: тот же предикат, что у пункта меню,
     * и он повторяет роли бэкенда (analytics.controller @Roles +
     * ANALYTICS_VIEW).
     */
    for (const role of ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR', 'PLATFORM_ADMIN'] as Role[]) {
      expect(isManagementNavItemVisible('/analytics/locations', { role }), role).toBe(true)
    }
    for (const role of ['CLIENT_ADMIN', 'CLIENT', 'TECHNICIAN', 'TERRITORIAL_MANAGER', 'STAFF'] as Role[]) {
      expect(isManagementNavItemVisible('/analytics/locations', { role }), role).toBe(false)
    }
  })

  it('6. пустая точка не создаёт параметра', () => {
    const links = locationSectionLinks({ locationId: '  ', scope: PROVIDER_SCOPE, canViewAnalytics: true })
    expect(links.equipment).toBe('/equipment?linkedClientCompanyId=client-A')
    expect(links.equipment).not.toContain('locationId')
  })

  it('7. чтение точки из адреса нормализуется', () => {
    expect(readLocationFilterFromSearch(new URLSearchParams('locationId=loc-1'))).toBe('loc-1')
    expect(readLocationFilterFromSearch(new URLSearchParams('locationId=  '))).toBe('')
    expect(readLocationFilterFromSearch(new URLSearchParams(''))).toBe('')
    expect(readLocationFilterFromSearch(null)).toBe('')
  })

  it('8. карточка точки использует эти решения и канонический гейт', () => {
    const page = codeOf(readSrc('views/LocationPage.tsx'))
    expect(page).toContain('locationSectionLinks({')
    expect(page).toContain("isManagementNavItemVisible('/analytics/locations'")
    expect(page).toContain('<Link to={sections.equipment}>')
    expect(page).toContain('<Link to={sections.rounds}>')
    expect(page).toContain('<Link to={sections.analytics}>')

    // Прежних ссылок без контекста точки не осталось.
    expect(page).not.toContain('<Link to="/equipment">')
    expect(page).not.toContain('<Link to="/inspection/schedules">')

    // Заявки остаются на каноническом контракте доски, второго механизма нет.
    expect(page).toContain("appendBoardNavigationContextToPath('/tickets'")
  })

  it('9. принимающие страницы ДЕЙСТВИТЕЛЬНО сужают по точке', () => {
    /*
     * Иначе переход был бы украшением: раньше фильтр жил только в
     * состоянии, и ссылка открывала полный список.
     */
    const equipment = codeOf(readSrc('views/EquipmentPage.tsx'))
    expect(equipment).toContain('readLocationFilterFromSearch(')
    expect(equipment).toContain('locationId: locationFilter || undefined')

    const rounds = codeOf(readSrc('views/InspectionSchedulesPage.tsx'))
    expect(rounds).toContain('readLocationFilterFromSearch(searchParams)')
    expect(rounds).toContain('locationFilter ? { locationId: locationFilter } : undefined')

    const analytics = codeOf(readSrc('views/LocationAnalyticsPage.tsx'))
    expect(analytics).toContain('readLocationFilterFromSearch(searchParams)')
    expect(analytics).toContain('locationId: locationId || undefined')
  })

  it('10. второго маршрута карточки точки не заводится', () => {
    const router = codeOf(readSrc('router.tsx'))
    // Канонический маршрут один и уже существовал.
    expect(router.match(/path="locations\/:id"/g)?.length).toBe(1)
    expect(router).not.toMatch(/locations\/:id\/(equipment|tickets|rounds|analytics)/)

    // Маршрут зарегистрирован в существующей карте Navigation V2.
    const meta = codeOf(readSrc('lib/managementRouteMeta.ts'))
    expect(meta).toContain("path: '/locations/:id'")
    expect(meta).toContain("parentPath: '/locations'")
  })

  it('11. фронтенд не расширяет доступ: новых прав и сущностей нет', () => {
    const sections = codeOf(readSrc('lib/locationCardSections.ts'))
    // Модуль решает только маршрутизацию: ни запросов, ни прав.
    expect(sections).not.toMatch(/fetch\(|api\./)
    expect(sections).not.toMatch(/PERMISSION|ANALYTICS_VIEW|LOCATIONS_MANAGE/)
  })
})
