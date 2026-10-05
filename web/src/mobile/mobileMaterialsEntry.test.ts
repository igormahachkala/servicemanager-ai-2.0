import { describe, expect, it } from 'vitest'

import type { Role } from '../lib/api'
import { getMobileMaterialsEntry } from './mobileMaterialsEntry'

function entry(role: Role, canAccessManagementSurface = false, pathname = '/m') {
  return getMobileMaterialsEntry({ role, canAccessManagementSurface }, pathname)
}

describe('mobile Materials home entry', () => {
  it('shows the daily entry for technicians', () => {
    expect(entry('TECHNICIAN')).toEqual({ href: '/m/materials', label: 'Мои материалы' })
  })

  it.each<Role>(['ADMIN', 'CLIENT_ADMIN', 'MASTER', 'DISPATCHER'])(
    'shows the management entry for admitted %s users',
    (role) => {
      expect(entry(role, true)).toEqual({ href: '/m/materials', label: 'Материалы' })
      expect(entry(role, false)).toBeNull()
    },
  )

  it.each<Role>(['PLATFORM_ADMIN', 'NETWORK_DIRECTOR', 'TERRITORIAL_MANAGER', 'CLIENT', 'STAFF'])(
    'does not expose Materials to denied %s users',
    (role) => {
      expect(entry(role, false)).toBeNull()
    },
  )

  it('never creates a MAX Materials entry', () => {
    expect(entry('TECHNICIAN', false, '/max')).toBeNull()
    expect(entry('ADMIN', true, '/max/settings')).toBeNull()
  })
})
