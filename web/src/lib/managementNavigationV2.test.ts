import { describe, expect, it } from 'vitest'

import type { Role } from './api'
import {
  isManagementNavItemVisible,
  managementHomePath,
  managementRailSections,
  railSectionIdForPath,
  railSectionLeaves,
} from './navigation'
import { getHomeRoute } from './api'

/**
 * SMA-MANAGEMENT-NAVIGATION-V2 — Phase 1. Структура Rail, fail-closed видимость,
 * landing. Чистые функции — окружение тестов node.
 */

describe('Rail: утверждённая информационная архитектура', () => {
  it('разделы и порядок соответствуют утверждённому IA', () => {
    expect(managementRailSections.map((s) => [s.id, s.label])).toEqual([
      ['home', 'Главная'],
      ['tickets', 'Заявки'],
      ['objects', 'Объекты'],
      ['works', 'Работы'],
      ['analytics', 'Аналитика'],
      ['more', 'Ещё'],
      ['platform', 'Платформа'],
    ])
  })

  it('Главная — раздел-одностраничник на /dashboard', () => {
    const home = managementRailSections.find((s) => s.id === 'home')!
    expect(home.home).toEqual({ id: 'dashboard', label: 'Главная', to: '/dashboard' })
  })

  it('Заявки: «Новая заявка» — действие, страницы Доска/Реестр/Архив', () => {
    const tickets = managementRailSections.find((s) => s.id === 'tickets')!
    expect(tickets.action).toEqual({ id: 'ticketsNew', label: 'Новая заявка', to: '/tickets/new' })
    expect(tickets.items?.map((i) => i.to)).toEqual(['/board', '/tickets', '/archive'])
  })

  it('Объекты: Точки/Оборудование/Карта (Точки — canonical /locations)', () => {
    const objects = managementRailSections.find((s) => s.id === 'objects')!
    expect(objects.items?.map((i) => i.to)).toEqual(['/locations', '/equipment', '/map'])
  })

  it('Работы: План обходов/Обходы/Шаблоны/Смены', () => {
    const works = managementRailSections.find((s) => s.id === 'works')!
    expect(works.items?.map((i) => i.to)).toEqual([
      '/inspection/schedules',
      '/inspection/runs',
      '/inspection/templates',
      '/workforce',
    ])
  })

  it('Аналитика: Обзор/По объектам', () => {
    const a = managementRailSections.find((s) => s.id === 'analytics')!
    expect(a.items?.map((i) => [i.label, i.to])).toEqual([
      ['Обзор', '/analytics'],
      ['По объектам', '/analytics/locations'],
    ])
  })

  it('Ещё: подгруппы Управление/Справочники/Система; договоры НЕ добавлены', () => {
    const more = managementRailSections.find((s) => s.id === 'more')!
    expect(more.groups?.map((g) => g.id)).toEqual(['management', 'references', 'system'])
    const allTo = railSectionLeaves(more).map((l) => l.to)
    expect(allTo).not.toContain('/service-contracts')
    expect(allTo).toEqual(
      expect.arrayContaining(['/employees', '/company', '/access-constructor', '/problem-categories', '/specializations', '/materials', '/settings']),
    )
  })

  it('Платформа помечена platformOnly и несёт Компании/Роли/IT', () => {
    const p = managementRailSections.find((s) => s.id === 'platform')!
    expect(p.platformOnly).toBe(true)
    expect(p.items?.map((i) => i.to)).toEqual(
      expect.arrayContaining(['/companies', '/platform/permissions', '/it']),
    )
  })
})

describe('Видимость: fail-closed', () => {
  it('неизвестный маршрут скрыт по умолчанию для любой роли', () => {
    const roles: Role[] = ['PLATFORM_ADMIN', 'ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR', 'CLIENT_ADMIN', 'TERRITORIAL_MANAGER', 'CLIENT', 'TECHNICIAN', 'STAFF']
    for (const role of roles) {
      expect(isManagementNavItemVisible('/totally-new-route', { role })).toBe(false)
    }
  })

  it('без роли всё скрыто', () => {
    expect(isManagementNavItemVisible('/board', { role: null })).toBe(false)
  })

  it('платформенные пункты видит только PLATFORM_ADMIN', () => {
    expect(isManagementNavItemVisible('/companies', { role: 'PLATFORM_ADMIN' })).toBe(true)
    expect(isManagementNavItemVisible('/platform/permissions', { role: 'PLATFORM_ADMIN' })).toBe(true)
    expect(isManagementNavItemVisible('/board', { role: 'PLATFORM_ADMIN' })).toBe(true)
    expect(isManagementNavItemVisible('/locations', { role: 'PLATFORM_ADMIN' })).toBe(true)
    for (const role of ['ADMIN', 'MASTER', 'CLIENT_ADMIN', 'NETWORK_DIRECTOR'] as Role[]) {
      expect(isManagementNavItemVisible('/companies', { role })).toBe(false)
      expect(isManagementNavItemVisible('/platform/permissions', { role })).toBe(false)
    }
  })

  it('CLIENT — узкий allow-list', () => {
    for (const to of ['/board', '/archive', '/tickets', '/tickets/new', '/company', '/settings']) {
      expect(isManagementNavItemVisible(to, { role: 'CLIENT' })).toBe(true)
    }
    for (const to of ['/locations', '/analytics', '/workforce', '/map', '/employees']) {
      expect(isManagementNavItemVisible(to, { role: 'CLIENT' })).toBe(false)
    }
  })

  it('полный админ видит справочники/управление; MASTER — нет', () => {
    for (const to of ['/employees', '/locations', '/materials', '/access-constructor', '/equipment']) {
      expect(isManagementNavItemVisible(to, { role: 'ADMIN' })).toBe(true)
      expect(isManagementNavItemVisible(to, { role: 'MASTER' })).toBe(false)
    }
  })

  it('аналитика и Главная — по ролям backend-аналитики', () => {
    for (const to of ['/dashboard', '/analytics', '/analytics/locations']) {
      expect(isManagementNavItemVisible(to, { role: 'ADMIN' })).toBe(true)
      expect(isManagementNavItemVisible(to, { role: 'MASTER' })).toBe(true)
      expect(isManagementNavItemVisible(to, { role: 'NETWORK_DIRECTOR' })).toBe(true)
      // не в наборе аналитики
      expect(isManagementNavItemVisible(to, { role: 'TERRITORIAL_MANAGER' })).toBe(false)
      expect(isManagementNavItemVisible(to, { role: 'CLIENT_ADMIN' })).toBe(false)
      expect(isManagementNavItemVisible(to, { role: 'TECHNICIAN' })).toBe(false)
    }
  })

  it('Workforce: прод-набор плюс CLIENT_ADMIN (read-only, решение владельца)', () => {
    for (const role of [
      'ADMIN',
      'MASTER',
      'DISPATCHER',
      'NETWORK_DIRECTOR',
      'TERRITORIAL_MANAGER',
      'CLIENT_ADMIN',
    ] as Role[]) {
      expect(isManagementNavItemVisible('/workforce', { role })).toBe(true)
    }

    /*
     * Пункт виден — права не выданы. Это affordance: доступ решает бэкенд
     * (WORKFORCE_VIEW в матрице + PermissionsGuard). Роли без гранта пункт
     * по-прежнему не видят.
     */
    for (const role of ['CLIENT', 'TECHNICIAN', 'STAFF'] as Role[]) {
      expect(isManagementNavItemVisible('/workforce', { role })).toBe(false)
    }
  })

  it('План обходов и Шаблоны — roundsManage', () => {
    for (const to of ['/inspection/schedules', '/inspection/templates']) {
      expect(isManagementNavItemVisible(to, { role: 'DISPATCHER' })).toBe(true)
      expect(isManagementNavItemVisible(to, { role: 'TERRITORIAL_MANAGER' })).toBe(false)
    }
  })

  it('Engineering Agent — строго по серверному флагу', () => {
    expect(isManagementNavItemVisible('/agents/engineering', { role: 'ADMIN', canAccessEngineeringAgent: true })).toBe(true)
    expect(isManagementNavItemVisible('/agents/engineering', { role: 'ADMIN', canAccessEngineeringAgent: false })).toBe(false)
    expect(isManagementNavItemVisible('/agents/engineering', { role: 'PLATFORM_ADMIN' })).toBe(false)
  })

  it('IT Company — строго PLATFORM_ADMIN', () => {
    expect(isManagementNavItemVisible('/it', { role: 'PLATFORM_ADMIN' })).toBe(true)
    expect(isManagementNavItemVisible('/it', { role: 'ADMIN' })).toBe(false)
  })
})

describe('Landing (решение владельца)', () => {
  it('managementHomePath по роли', () => {
    expect(managementHomePath('PLATFORM_ADMIN')).toBe('/companies')
    expect(managementHomePath('ADMIN')).toBe('/dashboard')
    expect(managementHomePath('NETWORK_DIRECTOR')).toBe('/dashboard')
    expect(managementHomePath('CLIENT_ADMIN')).toBe('/board')
    expect(managementHomePath('TERRITORIAL_MANAGER')).toBe('/board')
    expect(managementHomePath('CLIENT')).toBe('/board')
  })

  it('getHomeRoute: platform→companies, analytics-роль→dashboard, техник→/m, иначе /board', () => {
    expect(getHomeRoute('PLATFORM_ADMIN')).toBe('/companies')
    expect(getHomeRoute('ADMIN')).toBe('/dashboard')
    expect(getHomeRoute('DISPATCHER')).toBe('/dashboard')
    expect(getHomeRoute('TECHNICIAN')).toBe('/m')
    expect(getHomeRoute('CLIENT_ADMIN')).toBe('/board')
    expect(getHomeRoute('CLIENT')).toBe('/board')
  })
})


describe('Активный раздел Rail по пути (railSectionIdForPath)', () => {
  it('точные страницы разделов', () => {
    expect(railSectionIdForPath('/dashboard')).toBe('home')
    expect(railSectionIdForPath('/board')).toBe('tickets')
    expect(railSectionIdForPath('/tickets')).toBe('tickets')
    expect(railSectionIdForPath('/tickets/new')).toBe('tickets')
    expect(railSectionIdForPath('/locations')).toBe('objects')
    expect(railSectionIdForPath('/equipment')).toBe('objects')
    expect(railSectionIdForPath('/map')).toBe('objects')
    expect(railSectionIdForPath('/inspection/schedules')).toBe('works')
    expect(railSectionIdForPath('/inspection/runs')).toBe('works')
    expect(railSectionIdForPath('/workforce')).toBe('works')
    expect(railSectionIdForPath('/analytics')).toBe('analytics')
    expect(railSectionIdForPath('/analytics/locations')).toBe('analytics')
    expect(railSectionIdForPath('/employees')).toBe('more')
    expect(railSectionIdForPath('/materials')).toBe('more')
    expect(railSectionIdForPath('/settings')).toBe('more')
    expect(railSectionIdForPath('/companies')).toBe('platform')
    expect(railSectionIdForPath('/platform/permissions')).toBe('platform')
  })

  it('record-маршруты активируют раздел родителя (длиннейший префикс)', () => {
    expect(railSectionIdForPath('/locations/loc-123')).toBe('objects')
    expect(railSectionIdForPath('/tickets/SMA-1542')).toBe('tickets')
    expect(railSectionIdForPath('/inspection/runs/351')).toBe('works')
    // готовность к canonical /equipment/:id без правок навигации
    expect(railSectionIdForPath('/equipment/eq-17')).toBe('objects')
  })

  it('query/hash не влияют', () => {
    expect(railSectionIdForPath('/analytics/locations?companyId=x#top')).toBe('analytics')
  })

  it('неизвестный путь → null (fail-closed для подсветки)', () => {
    expect(railSectionIdForPath('/totally-unknown')).toBeNull()
    expect(railSectionIdForPath('')).toBeNull()
    expect(railSectionIdForPath(null)).toBeNull()
  })
})
