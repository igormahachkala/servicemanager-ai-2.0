import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isManagementNavItemVisible } from './navigation'
import {
  clearLocationFilterPath,
  locationFilterChipLabel,
  locationSectionLinks,
  readLocationFilterFromSearch,
  readOutboundScopeFromSearch,
} from './locationCardSections'
import { locationCardPath } from './equipmentCard'
import { appendScopeToPath } from './api'
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

describe('LOCATION CARD V2 Phase 2: обратные переходы и видимый фильтр', () => {
  it('12. область исходящих ссылок = тот параметр, которым пришла', () => {
    expect(readOutboundScopeFromSearch(new URLSearchParams('linkedClientCompanyId=client-A'))).toEqual({
      linkedClientCompanyId: 'client-A',
    })
    expect(readOutboundScopeFromSearch(new URLSearchParams('companyId=observed-1'))).toEqual({
      companyId: 'observed-1',
    })
    // Пустая область — чистый объект, ничего не затирается.
    expect(readOutboundScopeFromSearch(new URLSearchParams(''))).toEqual({})
    expect(readOutboundScopeFromSearch(null)).toEqual({})
    expect(readOutboundScopeFromSearch(new URLSearchParams('companyId=   '))).toEqual({})
  })

  it('13. ИНВАРИАНТ Phase 2: provider contour не превращается в companyId', () => {
    const scope = readOutboundScopeFromSearch(new URLSearchParams('linkedClientCompanyId=client-A'))
    const href = locationCardPath('loc-1', scope)
    expect(href).toBe('/locations/loc-1?linkedClientCompanyId=client-A')
    expect(href).not.toContain('companyId=client-A')
  })

  it('14. Equipment → Location и разделы точки сохраняют область', () => {
    const card = codeOf(readSrc('views/EquipmentCardPage.tsx'))
    // Обратный переход в карточку точки уже был — проверяем, что он с областью.
    expect(card).toContain('locationCardPath(item.location.id, createScope)')
    // Разделы точки добавлены и тоже с областью.
    expect(card).toContain('locationSectionLinks({')
    expect(card).toContain('scope: createScope')
    expect(card).toContain('to={locationSections.rounds}')
    expect(card).toContain('to={locationSections.analytics}')
    // Аналитика — по каноническому гейту, не по своему условию.
    expect(card).toContain("isManagementNavItemVisible('/analytics/locations'")
  })

  it('15. подписи не обещают фильтра по оборудованию, которого нет в API', () => {
    /*
     * Ни InspectionScheduleFilters, ни analyticsLocations не принимают
     * equipmentId, поэтому разделы названы «точки», а сужение идёт по
     * locationId. Декоративных ссылок не добавляем.
     */
    const card = readSrc('views/EquipmentCardPage.tsx')
    expect(card).toContain('Обходы точки')
    expect(card).toContain('Аналитика точки')
    expect(card).not.toMatch(/Обходы оборудования|Аналитика оборудования/)

    const apiSrc = readSrc('lib/api.ts')
    const filters = apiSrc.slice(
      apiSrc.indexOf('export type InspectionScheduleFilters'),
      apiSrc.indexOf('}', apiSrc.indexOf('export type InspectionScheduleFilters')),
    )
    expect(filters).toContain('locationId')
    expect(filters).not.toContain('equipmentId')
  })

  it('16. Rounds → Location: строка обхода ведёт в карточку с областью', () => {
    const page = codeOf(readSrc('views/InspectionSchedulesPage.tsx'))
    expect(page).toContain('locationCardPath(s.location.id, outboundScope)')
    expect(page).toContain('readOutboundScopeFromSearch(searchParams)')
  })

  it('17. Analytics → Location: строка аналитики ведёт в карточку с областью', () => {
    const page = codeOf(readSrc('views/LocationAnalyticsPage.tsx'))
    expect(page).toContain('locationCardPath(loc.locationId, outboundScope)')
    expect(page).toContain('readOutboundScopeFromSearch(searchParams)')
  })

  it('18. видимый фильтр по точке: подпись без идентификатора', () => {
    expect(locationFilterChipLabel({ locationId: 'loc-1', locationName: 'Фудзияма' })).toBe('Точка: Фудзияма')
    // Названия нет — подпись общая, UUID не показывается.
    const noName = locationFilterChipLabel({ locationId: 'loc-1' })
    expect(noName).toBe('Фильтр по точке')
    expect(noName).not.toContain('loc-1')
    // Фильтра нет — чипа нет.
    expect(locationFilterChipLabel({ locationId: '', locationName: 'Фудзияма' })).toBeNull()
    expect(locationFilterChipLabel({ locationId: '  ' })).toBeNull()
  })

  it('19. очистка фильтра снимает только точку, контур остаётся', () => {
    const cleared = clearLocationFilterPath(
      '/inspection/schedules',
      new URLSearchParams('locationId=loc-1&linkedClientCompanyId=client-A&active=true'),
    )
    expect(cleared).not.toContain('locationId')
    expect(cleared).toContain('linkedClientCompanyId=client-A')
    expect(cleared).toContain('active=true')

    // Без прочих параметров — чистый путь.
    expect(clearLocationFilterPath('/inspection/schedules', new URLSearchParams('locationId=loc-1'))).toBe(
      '/inspection/schedules',
    )
  })

  it('20. Rounds показывает чип и действие очистки', () => {
    const page = codeOf(readSrc('views/InspectionSchedulesPage.tsx'))
    expect(page).toContain('locationFilterChipLabel({')
    expect(page).toContain('clearLocationFilterPath(')
    expect(page).toContain('{locationChip}')
    expect(page).toContain('Показать все обходы')
    // Чип не показывается без фильтра.
    expect(page).toContain('{locationChip ? (')
  })

  it('21. чип не расширяет доступ: сужение остаётся запросом к бэкенду', () => {
    const page = codeOf(readSrc('views/InspectionSchedulesPage.tsx'))
    // Фильтр уходит в API, а не фильтруется на клиенте поверх полного списка.
    expect(page).toContain('locationFilter ? { locationId: locationFilter } : undefined')
    expect(page).not.toMatch(/schedules\.filter\(/)
  })

  it('22. скрытая сущность не открывается навигацией', () => {
    /*
     * Ссылки ведут на существующие маршруты с существующими правами:
     * карточка точки отвечает 404 на недоступную точку (бэкенд), и
     * одинаково — на несуществующую. Навигация прав не выдаёт.
     */
    const sections = codeOf(readSrc('lib/locationCardSections.ts'))
    expect(sections).not.toMatch(/fetch\(|api\./)
    expect(sections).not.toMatch(/PERMISSION|ROLE|isAdmin/)
    // Аналитика скрывается гейтом, а не доверием к серверу.
    expect(locationSectionLinks({ locationId: 'loc-1', canViewAnalytics: false }).analytics).toBeNull()
  })
})

describe('MANAGEMENT UX Phase 3: переходы в Location Hub', () => {
  it('23. Tickets → Location: объект заявки ведёт в карточку с областью', () => {
    const page = codeOf(readSrc('views/TicketPage.tsx'))
    expect(page).toContain('locationCardPath(ticket.location.id, { companyId: observerCompanyId, linkedClientCompanyId: effectiveLinkedClientCompanyId })')
    // Отдельного запроса ради ссылки не появилось: данные уже в ответе заявки.
    expect(page).not.toMatch(/useQuery\([^)]*getLocation\(/)
  })

  it('24. Rounds run/result → Location: все три страницы с областью', () => {
    for (const file of ['views/InspectionRunPage.tsx', 'views/InspectionRunReportPage.tsx', 'views/InspectionRunsPage.tsx']) {
      const page = codeOf(readSrc(file))
      expect(page, file).toContain('readOutboundScopeFromSearch(searchParams)')
      expect(page, file).toMatch(/locationCardPath\([^)]*outboundScope\)/)
    }
  })

  it('25. Equipment list: сужение по точке видно и снимается', () => {
    const page = codeOf(readSrc('views/EquipmentPage.tsx'))
    expect(page).toContain('locationFilterChipLabel({')
    expect(page).toContain('{locationChip}')
    expect(page).toContain('Показать всё оборудование')
    expect(page).toContain('clearLocationFilterPath(')
    expect(page).toContain('locationCardPath(locationFilter, outboundScope)')
    // Чипа нет, когда фильтра нет.
    expect(page).toContain('{locationChip ? (')
    // Сужение остаётся запросом к бэкенду, не фильтром поверх полного списка.
    expect(page).toContain('locationId: locationFilter || undefined')
  })

  it('26. очистка фильтра сохраняет контур и прочие параметры', () => {
    const cleared = clearLocationFilterPath(
      '/equipment',
      new URLSearchParams('locationId=loc-1&linkedClientCompanyId=client-A&status=ACTIVE'),
    )
    expect(cleared).not.toContain('locationId')
    expect(cleared).toContain('linkedClientCompanyId=client-A')
    expect(cleared).toContain('status=ACTIVE')
  })

  it('27. ИНВАРИАНТ: provider linked-client контур не downgrade ни в одной новой ссылке', () => {
    const scope = readOutboundScopeFromSearch(new URLSearchParams('linkedClientCompanyId=client-A'))
    expect(scope).toEqual({ linkedClientCompanyId: 'client-A' })
    const href = locationCardPath('loc-1', scope)
    expect(href).toBe('/locations/loc-1?linkedClientCompanyId=client-A')
    expect(href).not.toContain('companyId=client-A')

    // Наблюдательский контур остаётся companyId.
    const observer = readOutboundScopeFromSearch(new URLSearchParams('companyId=observed-1'))
    expect(locationCardPath('loc-1', observer)).toBe('/locations/loc-1?companyId=observed-1')
  })

  it('28. UUID в подписях не показывается ни в одном чипе', () => {
    const noName = locationFilterChipLabel({ locationId: 'b3f1c2d4-aaaa-bbbb-cccc-ddddeeeeffff' })
    expect(noName).toBe('Фильтр по точке')
    expect(noName).not.toMatch(/[0-9a-f]{8}-/)
  })

  it('29. consistency: ссылки на точку собираются helper-ом, а не руками', () => {
    for (const file of [
      'views/TicketPage.tsx',
      'views/EquipmentPage.tsx',
      'views/InspectionRunPage.tsx',
      'views/InspectionRunReportPage.tsx',
      'views/InspectionRunsPage.tsx',
      'views/InspectionSchedulesPage.tsx',
      'views/LocationAnalyticsPage.tsx',
    ]) {
      const page = codeOf(readSrc(file))
      // Ручной сборки пути к карточке точки не осталось.
      expect(page, file).not.toMatch(/`\/locations\/\$\{/)
      expect(page, file).not.toMatch(/'\/locations\/'\s*\+/)
    }
  })

  it('30. подписи не обещают equipment-level фильтров', () => {
    /*
     * Бэкенд принимает только locationId; equipmentId ни в обходах, ни в
     * аналитике не поддержан, и обещать его нельзя.
     */
    for (const file of ['views/EquipmentCardPage.tsx', 'views/EquipmentPage.tsx']) {
      const page = readSrc(file)
      expect(page, file).not.toMatch(/Обходы оборудования|Аналитика оборудования/)
    }
  })

  it('31. навигация прав не выдаёт: роли и права не трогаются', () => {
    const sections = codeOf(readSrc('lib/locationCardSections.ts'))
    expect(sections).not.toMatch(/PERMISSION|UserRole|isAdmin|canManage/)
    // Аналитика по-прежнему скрывается гейтом.
    expect(locationSectionLinks({ locationId: 'loc-1', canViewAnalytics: false }).analytics).toBeNull()
  })
})

describe('NAV V2(5) P1: контур живёт по всей цепочке обходов', () => {
  /*
   * Цепочка выполняется ПО ШАГАМ: на каждом шаге из адреса предыдущего
   * шага читается область и собирается следующий путь. Так проверяется
   * именно сохранение, а не совпадение по тексту исходника.
   */
  function hop(href: string) {
    const query = href.includes('?') ? href.slice(href.indexOf('?') + 1) : ''
    return readOutboundScopeFromSearch(new URLSearchParams(query))
  }

  it('32. Runs → Run → Report → Location сохраняет linked-client контур B', () => {
    // Шаг 0: провайдер в контуре клиента B.
    const atList = hop('/inspection/runs?linkedClientCompanyId=client-B')
    expect(atList).toEqual({ linkedClientCompanyId: 'client-B' })

    // Шаг 1: «Открыть» → страница обхода.
    const toRun = appendScopeToPath('/inspection/runs/run-1', atList)
    expect(toRun).toBe('/inspection/runs/run-1?linkedClientCompanyId=client-B')
    const atRun = hop(toRun)
    expect(atRun).toEqual({ linkedClientCompanyId: 'client-B' })

    // Шаг 2: обход → отчёт.
    const toReport = appendScopeToPath('/inspection/runs/run-1/report', atRun)
    expect(toReport).toBe('/inspection/runs/run-1/report?linkedClientCompanyId=client-B')
    const atReport = hop(toReport)
    expect(atReport).toEqual({ linkedClientCompanyId: 'client-B' })

    // Шаг 3: отчёт → карточка точки. Контур дожил до конца цепочки.
    const toLocation = locationCardPath('loc-B', atReport)
    expect(toLocation).toBe('/locations/loc-B?linkedClientCompanyId=client-B')
    expect(toLocation).not.toContain('companyId=client-B')
  })

  it('33. тот же путь из обхода напрямую в точку сохраняет B', () => {
    const atRun = hop('/inspection/runs/run-1?linkedClientCompanyId=client-B')
    expect(locationCardPath('loc-B', atRun)).toBe('/locations/loc-B?linkedClientCompanyId=client-B')
  })

  it('34. возврат отчёт → обход → список тоже несёт контур', () => {
    const atReport = hop('/inspection/runs/run-1/report?linkedClientCompanyId=client-B')
    expect(appendScopeToPath('/inspection/runs/run-1', atReport)).toBe(
      '/inspection/runs/run-1?linkedClientCompanyId=client-B',
    )
    expect(appendScopeToPath('/inspection/runs', atReport)).toBe(
      '/inspection/runs?linkedClientCompanyId=client-B',
    )
  })

  it('35. наблюдательский контур companyId проходит цепочку как companyId', () => {
    const atList = hop('/inspection/runs?companyId=observed-1')
    const toRun = appendScopeToPath('/inspection/runs/run-1', atList)
    expect(toRun).toBe('/inspection/runs/run-1?companyId=observed-1')
    const atRun = hop(toRun)
    expect(locationCardPath('loc-1', atRun)).toBe('/locations/loc-1?companyId=observed-1')
    expect(toRun).not.toContain('linkedClientCompanyId')
  })

  it('36. без области в адресе цепочка остаётся чистой (fallback не ломается)', () => {
    const empty = hop('/inspection/runs')
    expect(empty).toEqual({})
    expect(appendScopeToPath('/inspection/runs/run-1', empty)).toBe('/inspection/runs/run-1')
    expect(locationCardPath('loc-1', empty)).toBe('/locations/loc-1')
  })

  it('37. промежуточные ссылки собираются helper-ом, а не вручную', () => {
    /*
     * Негативный контроль P1: если хотя бы один переход снова станет
     * сырым /inspection/runs/:id, эта проверка упадёт.
     */
    const runs = codeOf(readSrc('views/InspectionRunsPage.tsx'))
    expect(runs).toContain("api.appendScopeToPath('/inspection/runs/' + run.id, outboundScope)")
    expect(runs).toContain('api.appendScopeToPath(`/inspection/runs/${run.id}/report`, outboundScope)')
    expect(runs).not.toMatch(/to=\{'\/inspection\/runs\/' \+ run\.id\}/)
    expect(runs).not.toMatch(/to=\{`\/inspection\/runs\/\$\{run\.id\}\/report`\}/)

    const run = codeOf(readSrc('views/InspectionRunPage.tsx'))
    expect(run).toContain('api.appendScopeToPath(`/inspection/runs/${run.id}/report`, outboundScope)')
    expect(run).not.toMatch(/to=\{`\/inspection\/runs\/\$\{run\.id\}\/report`\}/)

    const report = codeOf(readSrc('views/InspectionRunReportPage.tsx'))
    expect(report).toContain('api.appendScopeToPath(`/inspection/runs/${id}`, outboundScope)')
    expect(report).toContain("api.appendScopeToPath('/inspection/runs', outboundScope)")
    expect(report).not.toMatch(/to="\/inspection\/runs"/)
  })

  it('37a. ВСЕ переходы цепочки обходов несут контур, включая возврат в историю', () => {
    /*
     * Регрессия, найденная аудитом навигации: близнец этой ссылки на
     * странице отчёта («История обходов») был исправлен, а «История» на
     * странице обхода осталась литералом to="/inspection/runs" — провайдер
     * из контура клиента попадал на неотфильтрованную историю, и список
     * откатывался на клиента из подсказки профиля.
     *
     * Проверяются ОБЕ страницы, чтобы асимметрия не вернулась.
     */
    const run = codeOf(readSrc('views/InspectionRunPage.tsx'))
    expect(run).toContain("api.appendScopeToPath('/inspection/runs', outboundScope)")
    expect(run).not.toMatch(/to="\/inspection\/runs"/)

    const report = codeOf(readSrc('views/InspectionRunReportPage.tsx'))
    expect(report).toContain("api.appendScopeToPath('/inspection/runs', outboundScope)")
    expect(report).not.toMatch(/to="\/inspection\/runs"/)

    // И сам возврат действительно сохраняет контур.
    const back = appendScopeToPath('/inspection/runs', { linkedClientCompanyId: 'client-B' })
    expect(back).toBe('/inspection/runs?linkedClientCompanyId=client-B')
    expect(back).not.toContain('companyId=client-B')
  })

  it('38. чужой контур в адресе доступа не даёт: решает бэкенд', () => {
    /*
     * Ссылка чужой идентификатор перенесёт — это просто строка адреса.
     * Доступ закрывает бэкенд: карточка точки отвечает одинаковым 404 и
     * на недоступную, и на несуществующую точку.
     */
    const foreign = hop('/inspection/runs?linkedClientCompanyId=client-FOREIGN')
    expect(locationCardPath('loc-1', foreign)).toBe('/locations/loc-1?linkedClientCompanyId=client-FOREIGN')

    const page = codeOf(readSrc('views/LocationPage.tsx'))
    // Страница не различает «нет доступа» и «не существует».
    expect(page).not.toMatch(/403|Нет доступа|Forbidden/)
  })
})

describe('SCOPE NAVIGATION COMPLETION: обходы не теряют контур нигде', () => {
  const PAGES = [
    'views/InspectionRunsPage.tsx',
    'views/InspectionRunPage.tsx',
    'views/InspectionQuickPage.tsx',
    'views/InspectionTemplatesPage.tsx',
    'views/InspectionRunReportPage.tsx',
    'views/InspectionSchedulesPage.tsx',
  ]

  it('39. ни одна страница обходов не содержит scope-losing литералов', () => {
    /*
     * Закрывается остаток, найденный аудитом навигации: межсекционные и
     * обратные переходы шли литералами и роняли контур — провайдер
     * попадал на список другого клиента через откат на подсказку профиля.
     */
    for (const file of PAGES) {
      const src = codeOf(readSrc(file))
      for (const literal of [
        'to="/inspection/runs"',
        'to="/inspection/schedules"',
        'to="/inspection/templates"',
      ]) {
        expect(src, `${file} :: ${literal}`).not.toContain(literal)
      }
      // Шаблонные литералы без области — тоже.
      expect(src, `${file} :: raw quick`).not.toMatch(/to=\{`\/inspection\/quick\/\$\{[^}]*\}`\}/)
      expect(src, `${file} :: raw run`).not.toMatch(/to=\{`\/inspection\/runs\/\$\{[^}]*\}`\}/)
    }
  })

  it('40. каждая страница обходов читает контур каноническим помощником', () => {
    for (const file of PAGES) {
      const src = codeOf(readSrc(file))
      expect(src, file).toContain('readOutboundScopeFromSearch(searchParams)')
      // Своего механизма области не заводится.
      expect(src, file).not.toMatch(/new URLSearchParams\([^)]*\)\.set\('linkedClientCompanyId'/)
    }
  })

  it('41. provider A/B: контур B доезжает до каждого межсекционного перехода', () => {
    const B = { linkedClientCompanyId: 'client-B' }
    for (const path of ['/inspection/runs', '/inspection/schedules', '/inspection/templates', '/inspection/quick/run-1']) {
      const href = appendScopeToPath(path, B)
      expect(href, path).toBe(`${path}?linkedClientCompanyId=client-B`)
      // Подмены на companyId нет — иначе откат на профиль клиента A.
      expect(href, path).not.toContain('companyId=client-B')
    }
  })

  it('42. observer companyId не превращается в linked-контур', () => {
    const obs = { companyId: 'observed-1' }
    for (const path of ['/inspection/runs', '/inspection/templates']) {
      const href = appendScopeToPath(path, obs)
      expect(href, path).toBe(`${path}?companyId=observed-1`)
      expect(href, path).not.toContain('linkedClientCompanyId')
    }
  })

  it('43. foreign tenant: контур переносится, доступ закрывает бэкенд', () => {
    const href = appendScopeToPath('/inspection/runs', { linkedClientCompanyId: 'client-FOREIGN' })
    expect(href).toBe('/inspection/runs?linkedClientCompanyId=client-FOREIGN')
    // Страницы не различают «нет доступа» и «не существует».
    for (const file of ['views/InspectionRunPage.tsx', 'views/InspectionRunsPage.tsx']) {
      expect(codeOf(readSrc(file)), file).not.toMatch(/403|Нет доступа|Forbidden/)
    }
  })

  it('44. обратная навигация сохраняет контур, без отката на профиль', () => {
    const B = { linkedClientCompanyId: 'client-B' }
    // Быстрый обход → обход → история: контур жив на каждом шаге.
    expect(appendScopeToPath('/inspection/runs/run-1', B)).toContain('linkedClientCompanyId=client-B')
    expect(appendScopeToPath('/inspection/runs', B)).toContain('linkedClientCompanyId=client-B')
    // Пустой контур даёт чистый путь — существующий fallback не ломается.
    expect(appendScopeToPath('/inspection/runs', {})).toBe('/inspection/runs')
  })
})
