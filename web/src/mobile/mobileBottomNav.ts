import type { Role } from '../lib/api'
import { getMobileRouteRoot } from './mobileRoute'

/**
 * SMA-MOBILE-SERVICE-OS — ролевая нижняя навигация (5 слотов) + подсветка секции.
 * Маршруты существующие; второй Board/Ticket-движок не вводится. root ('/m'|'/max')
 * снимается, подсветка считается по суффиксу.
 */
export type MobileNavSectionId = 'home' | 'tickets' | 'create' | 'inspection' | 'more'

// Экраны кластера «Ещё» (и личные), подсвечивающие слот «Ещё».
const MORE_PREFIXES = [
  '/more',
  '/materials',
  '/equipment',
  '/shift',
  '/analytics',
  '/workforce',
  '/profile',
  '/settings',
  '/push-settings',
  '/offline-queue',
  '/notifications',
]

export function mobileNavSectionForPath(pathname?: string | null): MobileNavSectionId | null {
  const root = getMobileRouteRoot(pathname)
  const path = (pathname || '').split('?')[0].split('#')[0]
  if (path === root || path === `${root}/`) return 'home'
  const suffix = path.startsWith(root) ? path.slice(root.length) : path
  if (suffix.startsWith('/create')) return 'create'
  if (suffix.startsWith('/inspection')) return 'inspection'
  if (suffix.startsWith('/my') || suffix.startsWith('/tickets') || suffix.startsWith('/chats')) return 'tickets'
  if (MORE_PREFIXES.some((p) => suffix === p || suffix.startsWith(`${p}/`) || suffix.startsWith(p))) return 'more'
  return null
}

/** Второй слот: техник — «Мои задачи»; остальные роли — «Заявки». Обе ведут в /my. */
export function ticketsSlotLabel(role?: Role | null): 'Мои задачи' | 'Заявки' {
  return role === 'TECHNICIAN' ? 'Мои задачи' : 'Заявки'
}
