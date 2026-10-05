export type MobileRouteRoot = '/m' | '/max'

export function getMobileRouteRoot(pathname?: string | null): MobileRouteRoot {
  const path = (pathname || (typeof window !== 'undefined' ? window.location.pathname : '') || '/m').trim()
  return path.startsWith('/max') ? '/max' : '/m'
}

export function mobilePath(pathname: string | null | undefined, suffix: string): string {
  const root = getMobileRouteRoot(pathname)
  const next = suffix.startsWith('/') ? suffix : `/${suffix}`
  return `${root}${next}`
}

export function supportsPersonalNotificationPreferences(pathname?: string | null): boolean {
  return getMobileRouteRoot(pathname) === '/m'
}

/**
 * SMA-MOBILE-SERVICE-OS Phase 0+1: пункт «Обходы» для техника ведёт в рабочий
 * экран сегодняшних визитов, а не в исторический список прогонов. Остальные роли
 * пока сохраняют прежнюю посадку на общий список. Движок /inspection не меняется —
 * это только выбор посадочного суффикса в рамках canonical Rounds flow.
 */
export function inspectionNavSuffix(role?: string | null): string {
  return role === 'TECHNICIAN' ? '/inspection/today' : '/inspection'
}
