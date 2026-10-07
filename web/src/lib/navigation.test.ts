import { describe, expect, it } from 'vitest'

import type { Role } from './api'
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

  it('does NOT grant CLIENT_ADMIN any write/management surface (visibility is affordance, not capability)', () => {
    // Negative control: эти пункты требуют fullAdmin — CLIENT_ADMIN их не видит.
    for (const to of ['/employees', '/locations', '/materials', '/access-constructor', '/equipment']) {
      expect(vis(to, 'CLIENT_ADMIN')).toBe(false)
    }
  })
})
