import { describe, expect, it } from 'vitest'

import type { Role } from '../lib/api'
import { mobileNavSectionForPath, ticketsSlotLabel } from './mobileBottomNav'
import { getMobileMoreEntries } from './mobileMoreEntries'

/**
 * SMA-MOBILE-SERVICE-OS — ролевая нижняя навигация + «Ещё». Чистая логика (node).
 */

describe('Активная секция нижней навигации', () => {
  it('/m и /max корни → home', () => {
    expect(mobileNavSectionForPath('/m')).toBe('home')
    expect(mobileNavSectionForPath('/m/')).toBe('home')
    expect(mobileNavSectionForPath('/max')).toBe('home')
  })
  it('tickets-слот: /my, /tickets/:id, /chats', () => {
    expect(mobileNavSectionForPath('/m/my')).toBe('tickets')
    expect(mobileNavSectionForPath('/m/tickets/SMA-1542')).toBe('tickets')
    expect(mobileNavSectionForPath('/m/chats')).toBe('tickets')
    expect(mobileNavSectionForPath('/max/my')).toBe('tickets')
  })
  it('create / inspection', () => {
    expect(mobileNavSectionForPath('/m/create')).toBe('create')
    expect(mobileNavSectionForPath('/m/inspection')).toBe('inspection')
    expect(mobileNavSectionForPath('/m/inspection/today')).toBe('inspection')
    expect(mobileNavSectionForPath('/m/inspection/351')).toBe('inspection')
    expect(mobileNavSectionForPath('/max/inspection/today')).toBe('inspection')
  })
  it('more-кластер: more/materials/equipment/shift/analytics/profile/settings/workforce', () => {
    for (const suf of ['/more', '/materials', '/equipment', '/equipment/eq-1', '/shift', '/analytics', '/analytics/locations', '/profile', '/settings', '/workforce', '/push-settings', '/offline-queue', '/notifications']) {
      expect(mobileNavSectionForPath(`/m${suf}`)).toBe('more')
    }
    expect(mobileNavSectionForPath('/max/more')).toBe('more')
    expect(mobileNavSectionForPath('/max/analytics')).toBe('more')
  })
  it('неизвестный путь → null; query/hash не влияют', () => {
    expect(mobileNavSectionForPath('/m/unknown-xyz')).toBeNull()
    expect(mobileNavSectionForPath('/m/my?companyId=x#top')).toBe('tickets')
  })
})

describe('Ярлык второго слота', () => {
  it('техник — «Мои задачи», остальные — «Заявки»', () => {
    expect(ticketsSlotLabel('TECHNICIAN')).toBe('Мои задачи')
    for (const r of ['MASTER', 'DISPATCHER', 'ADMIN', 'CLIENT_ADMIN', 'CLIENT', 'NETWORK_DIRECTOR'] as Role[]) {
      expect(ticketsSlotLabel(r)).toBe('Заявки')
    }
    expect(ticketsSlotLabel(null)).toBe('Заявки')
  })
})

describe('«Ещё» — видимость по ролям (negative controls)', () => {
  const ids = (user: { role?: Role | null; canAccessManagementSurface?: boolean } | null, path = '/m') =>
    getMobileMoreEntries(user, path).map((e) => e.id)

  it('без роли → пусто', () => {
    expect(ids(null)).toEqual([])
    expect(ids({ role: null })).toEqual([])
  })

  it('TECHNICIAN: материалы(Мои) + смена + профиль + настройки; без оборудования/аналитики', () => {
    const list = ids({ role: 'TECHNICIAN', canAccessManagementSurface: false })
    expect(list).toEqual(['materials', 'shift', 'profile', 'settings'])
    expect(getMobileMoreEntries({ role: 'TECHNICIAN' }, '/m')[0].label).toBe('Мои материалы')
  })

  it('MASTER (mgmt): материалы + оборудование + смена + аналитика + профиль + настройки', () => {
    expect(ids({ role: 'MASTER', canAccessManagementSurface: true })).toEqual(['materials', 'equipment', 'shift', 'analytics', 'profile', 'settings'])
  })

  it('DISPATCHER (mgmt): без смены (не субъект смены), с аналитикой', () => {
    const list = ids({ role: 'DISPATCHER', canAccessManagementSurface: true })
    expect(list).toEqual(['materials', 'equipment', 'analytics', 'profile', 'settings'])
    expect(list).not.toContain('shift')
  })

  it('ADMIN (mgmt): оборудование + аналитика, без смены', () => {
    expect(ids({ role: 'ADMIN', canAccessManagementSurface: true })).toEqual(['materials', 'equipment', 'analytics', 'profile', 'settings'])
  })

  it('CLIENT_ADMIN без mgmt surface: только профиль + настройки', () => {
    expect(ids({ role: 'CLIENT_ADMIN', canAccessManagementSurface: false })).toEqual(['profile', 'settings'])
  })

  it('P1: CLIENT_ADMIN ДАЖЕ с canAccessManagementSurface не получает Оборудование/Материалы (нет реального backend-доступа)', () => {
    const list = ids({ role: 'CLIENT_ADMIN', canAccessManagementSurface: true })
    expect(list).toEqual(['profile', 'settings'])
    expect(list).not.toContain('equipment')
    expect(list).not.toContain('materials')
    expect(list).not.toContain('analytics')
  })

  it('P1: CLIENT с canAccessManagementSurface тоже не получает Оборудование/Материалы', () => {
    const list = ids({ role: 'CLIENT', canAccessManagementSurface: true })
    expect(list).not.toContain('equipment')
    expect(list).not.toContain('materials')
  })

  it('CLIENT без mgmt: только профиль + настройки; без аналитики/оборудования/материалов/смены', () => {
    expect(ids({ role: 'CLIENT', canAccessManagementSurface: false })).toEqual(['profile', 'settings'])
  })

  it('P1: Оборудование — только провайдерский management-набор (ADMIN/ADMIN_PROVIDER/MASTER/DISPATCHER)', () => {
    for (const r of ['ADMIN', 'ADMIN_PROVIDER', 'MASTER', 'DISPATCHER'] as Role[]) {
      expect(ids({ role: r, canAccessManagementSurface: true })).toContain('equipment')
    }
    for (const r of ['CLIENT_ADMIN', 'CLIENT', 'TECHNICIAN', 'NETWORK_DIRECTOR', 'TERRITORIAL_MANAGER', 'STAFF', 'PLATFORM_ADMIN'] as Role[]) {
      expect(ids({ role: r, canAccessManagementSurface: true })).not.toContain('equipment')
    }
  })

  it('TECHNICIAN сохраняет «Мои материалы»; провайдер-роли — управленческие «Материалы»', () => {
    expect(ids({ role: 'TECHNICIAN', canAccessManagementSurface: false })).toContain('materials')
    for (const r of ['ADMIN', 'MASTER', 'DISPATCHER'] as Role[]) {
      expect(ids({ role: r, canAccessManagementSurface: true })).toContain('materials')
    }
    expect(ids({ role: 'CLIENT_ADMIN', canAccessManagementSurface: true })).not.toContain('materials')
  })

  it('аналитика — только роли с реальным доступом', () => {
    for (const r of ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR', 'PLATFORM_ADMIN'] as Role[]) {
      expect(ids({ role: r, canAccessManagementSurface: true })).toContain('analytics')
    }
    for (const r of ['TECHNICIAN', 'CLIENT', 'CLIENT_ADMIN', 'TERRITORIAL_MANAGER', 'STAFF'] as Role[]) {
      expect(ids({ role: r, canAccessManagementSurface: true })).not.toContain('analytics')
    }
  })

  it('/max: материалы отсутствуют (вход /m-only), прочие по роли', () => {
    const list = getMobileMoreEntries({ role: 'MASTER', canAccessManagementSurface: true }, '/max').map((e) => e.id)
    expect(list).not.toContain('materials')
    expect(list).toContain('equipment')
    expect(list).toContain('analytics')
    expect(getMobileMoreEntries({ role: 'MASTER', canAccessManagementSurface: true }, '/max').find((e) => e.id === 'equipment')?.to).toBe('/max/equipment')
  })
})
