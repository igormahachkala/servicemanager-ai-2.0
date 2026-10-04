import { describe, expect, it } from 'vitest'

import type { Role } from '../lib/api'
import { getMobileMaterialsEntry } from './mobileMaterialsEntry'

function entry(role: Role, canAccessManagementSurface = false, pathname = '/m') {
  return getMobileMaterialsEntry({ role, canAccessManagementSurface }, pathname)
}

describe('mobile Materials entry visibility', () => {
  it('shows the technician daily entry independently of Management access', () => {
    expect(entry('TECHNICIAN')).toEqual({
      href: '/m/materials',
      kind: 'technician',
      label: 'Мои материалы',
    })
  })

  it.each<Role>(['ADMIN', 'CLIENT_ADMIN', 'MASTER', 'DISPATCHER'])(
    'shows the management entry for an admitted %s contour',
    (role) => {
      expect(entry(role, true)).toEqual({
        href: '/m/materials',
        kind: 'management',
        label: 'Материалы',
      })
      expect(entry(role, false)).toBeNull()
    },
  )

  it.each<Role>(['PLATFORM_ADMIN', 'NETWORK_DIRECTOR', 'TERRITORIAL_MANAGER', 'CLIENT', 'STAFF'])(
    'does not expose Materials to %s',
    (role) => {
      expect(entry(role, true)).toBeNull()
    },
  )

  it('does not create a MAX Materials entry', () => {
    expect(entry('TECHNICIAN', false, '/max')).toBeNull()
    expect(entry('ADMIN', true, '/max/settings')).toBeNull()
  })
})
