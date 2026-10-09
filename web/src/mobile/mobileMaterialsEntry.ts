import type { Role } from '../lib/api'
import { getMobileRouteRoot } from './mobileRoute'

/**
 * Роли, которым показывается управленческий вход.
 *
 * Тот же набор, которым уже пользуется меню «Ещё»
 * (mobileMoreEntries: PROVIDER_MANAGEMENT_ROLES).
 */
const MANAGEMENT_ENTRY_ROLES: ReadonlySet<string> = new Set<string>([
  'ADMIN',
  'ADMIN_PROVIDER',
  'MASTER',
  'DISPATCHER',
])

/**
 * Доступны ли управленческие разделы материалов.
 *
 * Один предикат на вход и на саму страницу: раньше страница проверяла
 * «любая management-поверхность кроме PLATFORM_ADMIN» и показывала
 * CLIENT_ADMIN разделы, на которых отказывает каждый запрос.
 *
 * Это подсказка интерфейса, не право: доступ решает бэкенд.
 */
export function canUseManagementMaterials(
  user: { role?: Role | null; canAccessManagementSurface?: boolean } | null | undefined,
): boolean {
  if (!user?.role) return false
  return user.canAccessManagementSurface === true && MANAGEMENT_ENTRY_ROLES.has(user.role)
}

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

  /*
   * Управленческие «Материалы» — только провайдерским management-ролям.
   *
   * CLIENT_ADMIN исключён: управленческие ручки материалов требуют
   * LOCATIONS_VIEW/LOCATIONS_MANAGE, которых у роли нет, поэтому пункт вёл
   * на страницу, где отказывает каждый запрос. Меню «Ещё» это уже
   * учитывало своей проверкой, а главный экран — нет, и два входа
   * расходились. Решение одно и живёт здесь.
   *
   * Доступ при этом решает бэкенд: видимость пункта прав не выдаёт.
   */
  if (canUseManagementMaterials(user)) {
    return { href: '/m/materials', label: 'Материалы' }
  }

  return null
}
