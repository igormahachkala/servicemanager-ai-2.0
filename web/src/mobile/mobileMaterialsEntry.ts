import type { Role } from '../lib/api'
import { getMobileRouteRoot } from './mobileRoute'

export type MobileMaterialsEntry = {
  href: '/m/materials'
  label: 'Мои материалы' | 'Материалы'
}

/** Navigation visibility only; Materials API guards remain authoritative. */
export function getMobileMaterialsEntry(
  user: { role?: Role | null; canAccessManagementSurface?: boolean } | null | undefined,
  pathname?: string | null,
): MobileMaterialsEntry | null {
  if (getMobileRouteRoot(pathname) !== '/m' || !user?.role) return null

  if (user.role === 'TECHNICIAN') {
    return { href: '/m/materials', label: 'Мои материалы' }
  }

  if (user.canAccessManagementSurface === true && user.role !== 'PLATFORM_ADMIN') {
    return { href: '/m/materials', label: 'Материалы' }
  }

  return null
}
