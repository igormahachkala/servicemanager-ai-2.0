import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import * as api from '../lib/api'
import { equipmentMobileNavLink } from './equipmentMobileNav'

/**
 * SMA-EQUIPMENT-REACHABILITY-088, E2.
 *
 * Проверяется достижимость и её границы: в /m переход появился, в /max его
 * быть не должно, нижняя панель не тронута.
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

describe('088/E2 переход к оборудованию в /m', () => {
  it('разрешённый актор получает ссылку на существующий маршрут', () => {
    const link = equipmentMobileNavLink({ role: 'ADMIN', pathname: '/m/settings' })

    expect(link).not.toBeNull()
    expect(link!.to).toBe('/m/equipment')
    expect(link!.id).toBe('equipment')
    expect(link!.label).toBe('Оборудование')
  })

  it('ссылка одна и та же на любом экране мобильного контура', () => {
    for (const pathname of ['/m', '/m/settings', '/m/tickets/abc', '/m/inspection']) {
      expect(equipmentMobileNavLink({ role: 'ADMIN', pathname })?.to, pathname).toBe('/m/equipment')
    }
  })

  it('круг ролей тот же, что у «Точек» на рабочем столе', () => {
    const visible = ALL_ROLES.filter(
      (role) => equipmentMobileNavLink({ role, pathname: '/m/settings' }) !== null,
    )
    const canonical = ALL_ROLES.filter((role) => api.isFullAdminDesktopNavRole(role))

    expect(visible).toEqual(canonical)
  })

  it('без роли ссылки нет', () => {
    expect(equipmentMobileNavLink({ role: null, pathname: '/m/settings' })).toBeNull()
    expect(equipmentMobileNavLink({ role: undefined, pathname: '/m/settings' })).toBeNull()
  })
})

describe('088/E2 в MAX перехода не появляется', () => {
  it.each(['/max', '/max/settings', '/max/tickets/abc'])('на %s ссылки нет даже у админа', (pathname) => {
    expect(equipmentMobileNavLink({ role: 'ADMIN', pathname })).toBeNull()
    expect(equipmentMobileNavLink({ role: 'PLATFORM_ADMIN', pathname })).toBeNull()
  })

  it('пункт не строится через mobilePath: иначе он утёк бы в /max сам собой', () => {
    /*
     * Соседние пункты экрана намеренно используют mobilePath() и появляются
     * в обоих контурах. Для оборудования это запрещено, и защищает от этого
     * не комментарий, а отсутствие вызова: проверяется по исходнику.
     */
    const source = readFileSync(new URL('./equipmentMobileNav.ts', import.meta.url), 'utf8')

    // Проверяется импорт, а не упоминание: вызвать неимпортированное нельзя,
    // а в пояснении сверху mobilePath назван по имени намеренно.
    const imports = source.slice(0, source.indexOf('/**'))
    expect(imports).not.toMatch(/\bmobilePath\b/)
    expect(imports).toMatch(/\bgetMobileRouteRoot\b/)
  })
})

describe('088/E2 границы изменения', () => {
  it('нижняя панель не тронута: оборудования в её наборе нет', () => {
    const shell = readFileSync(new URL('./MobileShell.tsx', import.meta.url), 'utf8')
    const navBlock = shell.slice(
      shell.indexOf('const mobileNavItems'),
      shell.indexOf('const mobileNavItems') + 900,
    )

    expect(navBlock).not.toContain('equipment')
  })

  it('маршруты /m/equipment и /m/equipment/:id уже существуют и не продублированы', () => {
    const router = readFileSync(new URL('../router.tsx', import.meta.url), 'utf8')

    const mobileRoutes = router.match(
      /path="equipment(?:\/:id)?"[^\n]*component=\{MobileEquipmentPage\}/g,
    )

    // Две в /m и две в /max — ровно то, что было до задачи.
    expect(mobileRoutes).toHaveLength(4)
  })

  it('экран настроек показывает пункт только по решению этой функции', () => {
    const page = readFileSync(new URL('./MobileSettingsPage.tsx', import.meta.url), 'utf8')

    expect(page).toContain('equipmentMobileNavLink')
    // Своего условия по ролям для оборудования на экране не заведено.
    expect(page).not.toMatch(/id: 'equipment'/)
  })
})
