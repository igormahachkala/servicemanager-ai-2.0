import type { Role } from '../lib/api'

/**
 * SMA-MATERIALS-V0: единый источник видимости входа «Материалы».
 *
 * Та же логика, что уже применяется в MobileSettingsPage: вход живёт только в
 * мобильном контуре `/m` (никогда в `/max`), TECHNICIAN видит всегда, остальным —
 * по backend-флагу `canAccessManagementSurface` и никогда PLATFORM_ADMIN.
 *
 * Контурные правила (ADMIN в management-контуре, CLIENT_ADMIN в CLIENT, MASTER и
 * DISPATCHER в PROVIDER → показываем; NETWORK_DIRECTOR / TERRITORIAL_MANAGER /
 * CLIENT / STAFF → нет) закодированы backend-флагом `canAccessManagementSurface`.
 * Фронт их не дублирует и не вводит собственный blocklist ролей.
 */
export function canSeeMobileMaterialsEntry(params: {
  role?: Role | null
  canAccessManagementSurface?: boolean | null
  routeRoot: string
}): boolean {
  if (params.routeRoot !== '/m') return false
  if (!params.role) return false
  if (params.role === 'TECHNICIAN') return true
  return params.canAccessManagementSurface === true && params.role !== 'PLATFORM_ADMIN'
}

/** Подпись входа: техник оперирует личным остатком, управленческие роли — складом. */
export function mobileMaterialsEntryLabel(role?: Role | null): string {
  return role === 'TECHNICIAN' ? 'Мои материалы' : 'Материалы'
}

/** Короткая подсказка под заголовком карточки/ссылки. */
export function mobileMaterialsEntryHint(role?: Role | null): string {
  return role === 'TECHNICIAN'
    ? 'Остатки, покупки и история движений'
    : 'Склад, техники и справочник'
}
