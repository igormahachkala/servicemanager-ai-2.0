import { describe, expect, it } from 'vitest'

import { MANAGEMENT_ROUTES } from './managementRouteMeta'
import { managementHomePath, platformNavigation, tenantNavigation } from './navigation'

const flattenIds = (sections: typeof tenantNavigation.sidebar) =>
  sections.flatMap((section) => section.items.map((item) => item.id))

describe('Management Navigation V2', () => {
  it('groups the existing tenant menu by management domain', () => {
    expect(tenantNavigation.sidebar.map((section) => [section.id, section.label])).toEqual([
      ['tickets', 'Заявки'],
      ['rounds', 'Обходы и планирование'],
      ['objects', 'Объекты и оборудование'],
      ['workforce', 'Сотрудники и работа'],
      ['analytics', 'Аналитика'],
      ['settings', 'Настройки'],
      ['platform', 'Платформа'],
    ])
  })

  it('does not add or remove tenant menu items', () => {
    const ids = flattenIds(tenantNavigation.sidebar)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual([
      'accessConstructor',
      'analytics',
      'archive',
      'board',
      'company',
      'employees',
      'engineeringAgent',
      'inspectionRuns',
      'inspectionTemplates',
      'itCompany',
      'locations',
      'map',
      'materials',
      'problemCategories',
      'settings',
      'specializations',
      'tickets',
      'ticketsNew',
      'workforce',
    ].sort())
  })

  it('keeps the top bar and management landing contract unchanged', () => {
    expect(tenantNavigation.topbar.map((item) => item.id)).toEqual([
      'board',
      'archive',
      'tickets',
      'analytics',
      'settings',
    ])
    expect(managementHomePath('PLATFORM_ADMIN')).toBe('/companies')
    expect(managementHomePath('ADMIN')).toBe('/board')
    expect(managementHomePath('CLIENT_ADMIN')).toBe('/board')
  })

  it('keeps platform-only entries separate without duplicating tenant items', () => {
    const ids = flattenIds(platformNavigation.sidebar)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('companies')
    expect(ids).toContain('permissions')
    expect(ids).toContain('locations')
    expect(ids).toContain('workforce')
  })

  it('uses the canonical location detail route in the shared management map', () => {
    const locationDetail = MANAGEMENT_ROUTES.find((route) => route.path === '/locations/:id')
    expect(locationDetail).toMatchObject({
      section: 'objects',
      parentPath: '/locations',
      primaryNav: false,
    })
    expect(MANAGEMENT_ROUTES.find((route) => route.path === '/objects')?.primaryNav).toBe(false)
  })
})
