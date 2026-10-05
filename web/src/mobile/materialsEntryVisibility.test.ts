import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { Role } from '../lib/api'
import {
  canSeeMobileMaterialsEntry,
  mobileMaterialsEntryLabel,
} from './materialsEntryVisibility'

/**
 * SMA-MATERIALS-V0-MOBILE-HOME-ENTRY. Видимость входа «Материалы» на Главной и
 * его отсутствие в /max. Чистые функции + source-contract (окружение node).
 */

const onM = (role: Role, canAccessManagementSurface = false) =>
  canSeeMobileMaterialsEntry({ role, canAccessManagementSurface, routeRoot: '/m' })

describe('Видимость входа «Материалы» на мобильной Главной', () => {
  it('TECHNICIAN видит «Мои материалы» (независимо от management-флага)', () => {
    expect(onM('TECHNICIAN', false)).toBe(true)
    expect(onM('TECHNICIAN', true)).toBe(true)
    expect(mobileMaterialsEntryLabel('TECHNICIAN')).toBe('Мои материалы')
  })

  it('ADMIN разрешённого контура (canAccessManagementSurface) видит «Материалы»', () => {
    expect(onM('ADMIN', true)).toBe(true)
    expect(mobileMaterialsEntryLabel('ADMIN')).toBe('Материалы')
  })

  it('CLIENT_ADMIN разрешённого CLIENT-контура видит', () => {
    expect(onM('CLIENT_ADMIN', true)).toBe(true)
  })

  it('MASTER и DISPATCHER разрешённого PROVIDER-контура видят', () => {
    expect(onM('MASTER', true)).toBe(true)
    expect(onM('DISPATCHER', true)).toBe(true)
  })

  it('NETWORK_DIRECTOR не видит', () => {
    expect(onM('NETWORK_DIRECTOR', false)).toBe(false)
  })

  it('TERRITORIAL_MANAGER не видит', () => {
    expect(onM('TERRITORIAL_MANAGER', false)).toBe(false)
  })

  it('CLIENT не видит', () => {
    expect(onM('CLIENT', false)).toBe(false)
  })

  it('STAFF не видит', () => {
    expect(onM('STAFF', false)).toBe(false)
  })

  it('PLATFORM_ADMIN не видит даже с management-доступом', () => {
    expect(onM('PLATFORM_ADMIN', true)).toBe(false)
  })

  it('без роли — скрыто (fail-closed)', () => {
    expect(canSeeMobileMaterialsEntry({ role: null, canAccessManagementSurface: true, routeRoot: '/m' })).toBe(false)
  })
})

describe('/max не получает вход «Материалы»', () => {
  it('helper выключен для контура /max при любой роли', () => {
    for (const role of ['TECHNICIAN', 'ADMIN', 'MASTER', 'DISPATCHER', 'CLIENT_ADMIN'] as Role[]) {
      expect(canSeeMobileMaterialsEntry({ role, canAccessManagementSurface: true, routeRoot: '/max' })).toBe(false)
    }
  })

  it('MAX-приложение не объявляет маршрут materials', () => {
    const maxApp = readFileSync(join(__dirname, '../max/MaxApp.tsx'), 'utf8')
    expect(maxApp).not.toContain('materials')
  })
})

describe('Source-contract входа', () => {
  const home = readFileSync(join(__dirname, 'home/MobileHome.tsx'), 'utf8')
  const settings = readFileSync(join(__dirname, 'MobileSettingsPage.tsx'), 'utf8')

  it('Главная рендерит карточку входа через общий helper видимости', () => {
    expect(home).toContain('HomeMaterialsCard')
    expect(home).toContain('canSeeMobileMaterialsEntry')
    expect(home).toContain("mobilePath(location.pathname, '/materials')")
  })

  it('карточка переиспользует стиль быстрых карт, а не новый паттерн', () => {
    const card = readFileSync(join(__dirname, 'home/HomeMaterialsCard.tsx'), 'utf8')
    expect(card).toContain('mobileHomeQuickCard')
  })

  it('Настройки сохраняют вторичный вход и ту же логику видимости', () => {
    expect(settings).toContain('canSeeMobileMaterialsEntry')
    expect(settings).toContain("to: scoped('/m/materials')")
  })
})
