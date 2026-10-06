import type { Role } from '../lib/api'
import { mobilePath } from './mobileRoute'
import { getMobileMaterialsEntry } from './mobileMaterialsEntry'
import { isShiftGateSubjectRole } from './mobileShiftGate'

/**
 * SMA-MOBILE-SERVICE-OS — входы экрана «Ещё». Показываются только те функции,
 * что реально доступны роли по СУЩЕСТВУЮЩИМ сигналам (role, canAccessManagementSurface,
 * существующие helpers). Нового access resolver не вводится; backend/PBAC не меняются;
 * навигация ≠ безопасность (API-гейты остаются источником истины).
 */

// Зеркало ANALYTICS_ADMIN_ROLES из MobileAnalytics.tsx. Не импортируем оттуда,
// чтобы не затягивать тяжёлый lazy-экран аналитики в shell-бандл. Покрыто тестом.
const ANALYTICS_ROLES: ReadonlySet<string> = new Set<string>([
  'ADMIN',
  'MASTER',
  'DISPATCHER',
  'NETWORK_DIRECTOR',
  'PLATFORM_ADMIN',
])

// P1-fix: Оборудование и управленческие Материалы — провайдерские management-поверхности.
// canAccessManagementSurface оказался слишком широким: у CLIENT_ADMIN он true, но реальных
// backend-прав нет (equipment.controller @Roles = ADMIN/MASTER/DISPATCHER — CLIENT_ADMIN
// отсутствует; materials management = @Roles(...MANAGEMENT_ROLES) + @RequirePermission
// LOCATIONS_VIEW/MANAGE, которых у CLIENT_ADMIN нет → 403). Зеркалим провайдерский
// management-набор (как ANALYTICS_ROLES/бэкендовый MANAGEMENT_ROLES). ADMIN_PROVIDER —
// фронтовый алиас ADMIN. Новый access resolver не вводится; PBAC не меняется.
const PROVIDER_MANAGEMENT_ROLES: ReadonlySet<string> = new Set<string>([
  'ADMIN',
  'ADMIN_PROVIDER',
  'MASTER',
  'DISPATCHER',
])

export type MobileMoreEntry = { id: string; label: string; hint: string; to: string }

export function getMobileMoreEntries(
  user: { role?: Role | null; canAccessManagementSurface?: boolean } | null | undefined,
  pathname?: string | null,
): MobileMoreEntry[] {
  const role = user?.role
  if (!role) return []
  const p = (suffix: string) => mobilePath(pathname, suffix)
  const out: MobileMoreEntry[] = []

  // Материалы — техник всегда «Мои материалы»; управленческие «Материалы» только
  // провайдерским management-ролям (CLIENT_ADMIN исключён: нет реального backend-доступа).
  const materials = getMobileMaterialsEntry(user, pathname)
  const materialsAllowed = role === 'TECHNICIAN' || PROVIDER_MANAGEMENT_ROLES.has(role)
  if (materials && materialsAllowed) {
    out.push({
      id: 'materials',
      label: materials.label,
      hint: role === 'TECHNICIAN' ? 'Остатки, покупки и история движений' : 'Склад, техники и справочник',
      to: materials.href,
    })
  }

  // Оборудование — провайдерский management-набор (equipment.controller @Roles =
  // ADMIN/MASTER/DISPATCHER). CLIENT_ADMIN/CLIENT/TECHNICIAN реального доступа не имеют.
  if (PROVIDER_MANAGEMENT_ROLES.has(role)) {
    out.push({ id: 'equipment', label: 'Оборудование', hint: 'Паспорта, история и установленные детали', to: p('/equipment') })
  }

  // Смена — субъекты смены (TECHNICIAN/MASTER, существующий canonical-хелпер).
  if (isShiftGateSubjectRole(role)) {
    out.push({ id: 'shift', label: 'Смена', hint: 'Открыть или закрыть рабочую смену', to: p('/shift') })
  }

  // Аналитика — перенесена из прайм-слота; только роли с реальным доступом.
  if (ANALYTICS_ROLES.has(role)) {
    out.push({ id: 'analytics', label: 'Аналитика', hint: 'Показатели сервиса и качество исполнения', to: p('/analytics') })
  }

  // Профиль и Настройки — доступны любому аутентифицированному пользователю.
  out.push({ id: 'profile', label: 'Профиль', hint: 'Аккаунт, смена, уведомления', to: p('/profile') })
  out.push({ id: 'settings', label: 'Настройки', hint: 'Системные и управленческие разделы', to: p('/settings') })

  return out
}
