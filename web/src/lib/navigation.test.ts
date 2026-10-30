import { describe, expect, it } from 'vitest'

import type { CompanyType, Role } from './api'
import { isManagementNavItemVisible } from './navigation'

const vis = (to: string, role: Role) =>
  isManagementNavItemVisible(to, { role, canAccessEngineeringAgent: false })

describe('Workforce CLIENT_ADMIN read-only nav visibility', () => {
  it('shows /workforce to CLIENT_ADMIN (read affordance for WORKFORCE_VIEW)', () => {
    expect(vis('/workforce', 'CLIENT_ADMIN')).toBe(true)
  })

  it('keeps /workforce for management roles', () => {
    for (const role of ['PLATFORM_ADMIN', 'ADMIN', 'ADMIN_PROVIDER', 'MASTER', 'DISPATCHER'] as Role[]) {
      expect(vis('/workforce', role)).toBe(true)
    }
  })

  it('hides /workforce from CLIENT / TECHNICIAN / STAFF', () => {
    for (const role of ['CLIENT', 'TECHNICIAN', 'STAFF'] as Role[]) {
      expect(vis('/workforce', role)).toBe(false)
    }
  })

  it('показывает /on-site мастеру, диспетчеру и админу провайдера', () => {
    for (const role of ['MASTER', 'DISPATCHER', 'ADMIN', 'ADMIN_PROVIDER'] as Role[]) {
      expect(isManagementNavItemVisible('/on-site', { role, companyType: 'PROVIDER' })).toBe(true)
      expect(isManagementNavItemVisible('/technician-map', { role, companyType: 'PROVIDER' })).toBe(true)
    }
  })

  it('прячет /on-site у техника, клиента, CLIENT_ADMIN, PLATFORM_ADMIN и админа клиентской компании', () => {
    for (const role of ['TECHNICIAN', 'CLIENT', 'CLIENT_ADMIN', 'PLATFORM_ADMIN', 'NETWORK_DIRECTOR', 'TERRITORIAL_MANAGER', 'STAFF'] as Role[]) {
      expect(isManagementNavItemVisible('/on-site', { role, companyType: 'PROVIDER' })).toBe(false)
      expect(isManagementNavItemVisible('/technician-map', { role, companyType: 'PROVIDER' })).toBe(false)
    }
    expect(isManagementNavItemVisible('/on-site', { role: 'ADMIN', companyType: 'CLIENT' })).toBe(false)
    expect(isManagementNavItemVisible('/technician-map', { role: 'ADMIN', companyType: 'CLIENT' })).toBe(false)
    for (const companyType of [undefined, null] as Array<CompanyType | null | undefined>) {
      expect(isManagementNavItemVisible('/on-site', { role: 'MASTER', companyType })).toBe(false)
      expect(isManagementNavItemVisible('/technician-map', { role: 'MASTER', companyType })).toBe(false)
      expect(isManagementNavItemVisible('/on-site', { role: 'ADMIN', companyType })).toBe(false)
      expect(isManagementNavItemVisible('/technician-map', { role: 'ADMIN', companyType })).toBe(false)
    }
  })

  it('does NOT grant CLIENT_ADMIN any write/management surface (visibility is affordance, not capability)', () => {
    // Negative control: эти пункты требуют fullAdmin — CLIENT_ADMIN их не видит.
    for (const to of ['/employees', '/locations', '/materials', '/access-constructor', '/equipment']) {
      expect(vis(to, 'CLIENT_ADMIN')).toBe(false)
    }
  })
})
