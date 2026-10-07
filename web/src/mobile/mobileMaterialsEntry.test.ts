import { describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Role } from '../lib/api'
import { canUseManagementMaterials, getMobileMaterialsEntry } from './mobileMaterialsEntry'

const here = dirname(fileURLToPath(import.meta.url))

function entry(role: Role, canAccessManagementSurface = false, pathname = '/m') {
  return getMobileMaterialsEntry({ role, canAccessManagementSurface }, pathname)
}

describe('mobile Materials home entry', () => {
  it('shows the daily entry for technicians', () => {
    expect(entry('TECHNICIAN')).toEqual({ href: '/m/materials', label: 'Мои материалы' })
  })

  it.each<Role>(['ADMIN', 'MASTER', 'DISPATCHER'])(
    'shows the management entry for admitted %s users',
    (role) => {
      expect(entry(role, true)).toEqual({ href: '/m/materials', label: 'Материалы' })
      expect(entry(role, false)).toBeNull()
    },
  )

  it('does not expose management Materials to CLIENT_ADMIN', () => {
    /*
     * Управленческие ручки материалов требуют LOCATIONS_VIEW/LOCATIONS_MANAGE,
     * которых у CLIENT_ADMIN нет: пункт вёл на страницу, где отказывает
     * каждый запрос. Меню «Ещё» это уже учитывало, главный экран — нет.
     */
    expect(entry('CLIENT_ADMIN', true)).toBeNull()
    expect(entry('CLIENT_ADMIN', false)).toBeNull()
    expect(canUseManagementMaterials({ role: 'CLIENT_ADMIN', canAccessManagementSurface: true })).toBe(false)
  })

  it.each<Role>(['PLATFORM_ADMIN', 'NETWORK_DIRECTOR', 'TERRITORIAL_MANAGER', 'CLIENT', 'STAFF'])(
    'does not expose Materials to denied %s users',
    (role) => {
      expect(entry(role, false)).toBeNull()
      // И с management-поверхностью тоже: набор ролей закрытый.
      expect(entry(role, true)).toBeNull()
    },
  )

  it('страница и вход используют ОДИН предикат', () => {
    const page = readFileSync(resolve(here, 'MobileMaterialsPage.tsx'), 'utf8')
    expect(page).toContain('canUseManagementMaterials(meQ.data)')
    // Прежней широкой проверки на странице не осталось.
    expect(page).not.toContain("canAccessManagementSurface === true && meQ.data.role !== 'PLATFORM_ADMIN'")
  })

  it('заголовок совпадает с подписью входа, возврат — в корень шелла', () => {
    const page = readFileSync(resolve(here, 'MobileMaterialsPage.tsx'), 'utf8')
    // Техник открывает «Мои материалы» и видит тот же заголовок.
    expect(page).toContain("getMobileMaterialsEntry(meQ.data, location.pathname)?.label ?? 'Материалы'")
    expect(page).toContain('<h1 className="mobileTitle">{pageTitle}</h1>')

    /*
     * Материалы открываются с главного экрана, из «Ещё» и из настроек —
     * жёсткий возврат в настройки был верен только для одного входа.
     * Возврат делегирован общему MobileSectionBackLink (корень шелла,
     * mobilePath(location.pathname, '')), не зашит на /settings.
     */
    expect(page).toContain('<MobileSectionBackLink')
    expect(page).not.toContain("mobilePath(location.pathname, '/settings')")
    const backLink = readFileSync(resolve(here, 'MobileSectionBackLink.tsx'), 'utf8')
    expect(backLink).toContain("mobilePath(location.pathname, '')")
    expect(backLink).not.toContain("mobilePath(location.pathname, '/settings')")
  })

  it('управленческие ручки материалов закрыты для CLIENT_ADMIN на бэкенде', () => {
    const controller = readFileSync(
      resolve(here, '../../../backend/src/materials/materials.controller.ts'),
      'utf8',
    )
    const block = controller.slice(
      controller.indexOf('const MANAGEMENT_ROLES'),
      controller.indexOf('] as const', controller.indexOf('const MANAGEMENT_ROLES')),
    )
    expect(block).toContain('UserRole.ADMIN')
    expect(block).toContain('UserRole.MASTER')
    expect(block).toContain('UserRole.DISPATCHER')
    // Скрытого пути не осталось: выдача LOCATIONS_VIEW не откроет управление.
    expect(block).not.toContain('UserRole.CLIENT_ADMIN')
  })

  it('never creates a MAX Materials entry', () => {
    expect(entry('TECHNICIAN', false, '/max')).toBeNull()
    expect(entry('ADMIN', true, '/max/settings')).toBeNull()
  })
})
