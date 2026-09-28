import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import * as api from '../lib/api'
import { tenantNavigation } from '../lib/navigation'
import { isNavItemVisible } from './Shell'

/**
 * SMA-EQUIPMENT-REACHABILITY-088, E1.
 *
 * Модуль оборудования существовал полностью — маршрут, страница, хлебные
 * крошки, — и был недостижим: в меню его не было, попасть можно было только
 * набрав адрес руками.
 *
 * Пункт добавлен с тем же правилом видимости, что у «Точек». Правило именно
 * то же, а не похожее: оборудование принадлежит точке и правится тем же
 * кругом лиц. Поэтому главная проверка здесь — не список ролей, а равенство
 * двух видимостей на всех ролях сразу: разойтись они не смогут молча.
 */

const ALL_ROLES: api.Role[] = [
  'PLATFORM_ADMIN',
  'ADMIN',
  'CLIENT_ADMIN',
  'ADMIN_PROVIDER',
  'DISPATCHER',
  'MASTER',
  'TECHNICIAN',
  'CLIENT',
  'TERRITORIAL_MANAGER',
  'NETWORK_DIRECTOR',
  'STAFF',
]

const equipmentItem = { id: 'equipment', label: 'Оборудование', to: '/equipment' }
const locationsItem = { id: 'locations', label: 'Точки', to: '/locations' }

const seesEquipment = (role?: api.Role) => isNavItemVisible(equipmentItem, role)
const seesLocations = (role?: api.Role) => isNavItemVisible(locationsItem, role)

describe('088/E1 пункт «Оборудование» в меню рабочего стола', () => {
  it('пункт есть и стоит сразу после «Точек»', () => {
    const main = tenantNavigation.sidebar.find((section) => section.id === 'main')
    expect(main).toBeDefined()

    const paths = main!.items.map((item) => item.to)
    expect(paths).toContain('/equipment')
    expect(paths.indexOf('/equipment')).toBe(paths.indexOf('/locations') + 1)
  })

  it('пункт ведёт на существующий маршрут и второго не заводит', () => {
    const matches = tenantNavigation.sidebar
      .flatMap((section) => section.items)
      .filter((item) => item.to.startsWith('/equipment'))

    expect(matches).toHaveLength(1)
    expect(matches[0].to).toBe('/equipment')
  })
})

describe('088/E1 видимость совпадает с «Точками»', () => {
  it.each(ALL_ROLES)('роль %s видит оборудование ровно тогда же, когда точки', (role) => {
    expect(seesEquipment(role)).toBe(seesLocations(role))
  })

  it('без роли не видно ничего из двух', () => {
    expect(seesEquipment(undefined)).toBe(false)
    expect(seesLocations(undefined)).toBe(false)
  })

  it('разрешённый актор рабочего стола пункт видит', () => {
    expect(seesEquipment('PLATFORM_ADMIN')).toBe(true)
    expect(seesEquipment('ADMIN')).toBe(true)
    expect(seesEquipment('ADMIN_PROVIDER')).toBe(true)
  })

  it('актор без канонической видимости «Точек» пункт не видит', () => {
    /*
     * Перечислено явно, а не выведено из хелпера: если круг ролей однажды
     * расширят, тест обязан об этом сказать, а не согласиться молча.
     */
    const denied: api.Role[] = [
      'CLIENT',
      'CLIENT_ADMIN',
      'DISPATCHER',
      'MASTER',
      'TECHNICIAN',
      'TERRITORIAL_MANAGER',
      'NETWORK_DIRECTOR',
      'STAFF',
    ]

    for (const role of denied) {
      expect(seesEquipment(role), role).toBe(false)
    }
  })

  it('круг ролей не расширен: он равен каноническому полному админу', () => {
    const visible = ALL_ROLES.filter((role) => seesEquipment(role))
    const canonical = ALL_ROLES.filter((role) => api.isFullAdminDesktopNavRole(role))

    expect(visible).toEqual(canonical)
  })
})

describe('088/E1 меню ничего не разрешает', () => {
  /*
   * Граница ответственности: меню только показывает ссылку. Доступ к самому
   * адресу решают охранники маршрута и бэкенд. Проверяется структурно —
   * отрисовать Shell в node-окружении нечем.
   */

  it('пункт меню несёт только адрес и подпись, без признаков доступа', () => {
    const item = tenantNavigation.sidebar
      .flatMap((section) => section.items)
      .find((candidate) => candidate.to === '/equipment')

    expect(item).toBeDefined()
    expect(Object.keys(item!).sort()).toEqual(['id', 'label', 'to'])
  })

  it('маршрут рабочего стола один и стоит под теми же охранниками', () => {
    const router = readFileSync(new URL('../router.tsx', import.meta.url), 'utf8')

    /*
     * Маршрут опознаётся по компоненту, а не по положению в файле: мобильные
     * ветки объявляют тот же путь, но рисуют MobileEquipmentPage.
     */
    const desktopRoutes = router.match(/path="equipment"[^\n]*component=\{EquipmentPage\}/g)
    expect(desktopRoutes).toHaveLength(1)

    // Рабочий стол целиком закрыт этой парой охранников; оборудование внутри.
    expect(router).toMatch(/<RequireAuth>\s*<RequireManagementAccess>/)
  })

  it('видимость пункта не участвует в решении о доступе к маршруту', () => {
    const router = readFileSync(new URL('../router.tsx', import.meta.url), 'utf8')

    expect(router).not.toContain('isNavItemVisible')
    expect(router).not.toContain('tenantDesktopNavItems')
  })
})
