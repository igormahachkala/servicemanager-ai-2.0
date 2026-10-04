import type { Role } from '../lib/api'
import { getMobileRouteRoot } from './mobileRoute'

const MATERIALS_MANAGEMENT_ROLES = new Set<Role>([
  'ADMIN',
  'CLIENT_ADMIN',
  'MASTER',
  'DISPATCHER',
])

export type MobileMaterialsEntry = {
  href: '/m/materials'
  kind: 'technician' | 'management'
  label: 'Мои материалы' | 'Материалы'
}

/** UX visibility only. Backend Materials guards remain the authorization boundary. */
export function getMobileMaterialsEntry(
  user: { role?: Role | null; canAccessManagementSurface?: boolean } | null | undefined,
  pathname?: string | null,
): MobileMaterialsEntry | null {
  if (getMobileRouteRoot(pathname) !== '/m' || !user?.role) return null

  if (user.role === 'TECHNICIAN') {
    return { href: '/m/materials', kind: 'technician', label: 'Мои материалы' }
  }

  if (
    user.canAccessManagementSurface === true
    && MATERIALS_MANAGEMENT_ROLES.has(user.role)
  ) {
    return { href: '/m/materials', kind: 'management', label: 'Материалы' }
  }

  return null
}
