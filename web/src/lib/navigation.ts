export type NavItem = {
  id: string
  label: string
  to: string
}

export type NavSection = {
  id: string
  label: string
  items: NavItem[]
}

export type ShellNavigationConfig = {
  sidebar: NavSection[]
  topbar: NavItem[]
}

/** Общий набор пунктов тенанта (без «Компании платформы»). */
const tenantDesktopNavItems: NavItem[] = [
  { id: 'board', label: 'Доска', to: '/board' },
  { id: 'archive', label: 'Архив', to: '/archive' },
  { id: 'tickets', label: 'Заявки', to: '/tickets' },
  { id: 'ticketsNew', label: 'Новая заявка', to: '/tickets/new' },
  { id: 'employees', label: 'Сотрудники', to: '/employees' },
  { id: 'specializations', label: 'Специализации', to: '/specializations' },
  { id: 'problemCategories', label: 'Категории проблем', to: '/problem-categories' },
  { id: 'locations', label: 'Точки', to: '/locations' },
  { id: 'analytics', label: 'Аналитика', to: '/analytics' },
  { id: 'map', label: 'Карта', to: '/map' },
  { id: 'inspectionTemplates', label: 'Шаблоны обходов', to: '/inspection/templates' },
  { id: 'inspectionRuns', label: 'Обходы', to: '/inspection/runs' },
  { id: 'company', label: 'Компания', to: '/company' },
  { id: 'settings', label: 'Настройки', to: '/settings' },
]

const tenantNavById = Object.fromEntries(tenantDesktopNavItems.map((item) => [item.id, item])) as Record<string, NavItem>

const tenantTopbarIds = ['board', 'archive', 'tickets', 'analytics', 'settings'] as const

export const platformNavigation: ShellNavigationConfig = {
  sidebar: [
    {
      id: 'main',
      label: 'Меню',
      items: [{ id: 'companies', label: 'Компании', to: '/companies' }, ...tenantDesktopNavItems],
    },
  ],
  topbar: [
    { id: 'companies', label: 'Компании', to: '/companies' },
    tenantNavById.board,
    tenantNavById.tickets,
    tenantNavById.analytics,
    tenantNavById.settings,
  ],
}

export const tenantNavigation: ShellNavigationConfig = {
  sidebar: [
    {
      id: 'main',
      label: 'Меню',
      items: tenantDesktopNavItems,
    },
  ],
  topbar: tenantTopbarIds.map((id) => tenantNavById[id]).filter(Boolean),
}

/** Ссылка на мобильный shell из управленческой части. */
export const mobileAppNavItem: NavItem = {
  id: 'mobileApp',
  label: 'Мобильная версия',
  to: '/m',
}

const MOBILE_APP_ROLES = new Set([
  'PLATFORM_ADMIN',
  'ADMIN',
  'MASTER',
  'DISPATCHER',
  'NETWORK_DIRECTOR',
  'TECHNICIAN',
  'CLIENT',
  'TERRITORIAL_MANAGER',
])

const MANAGEMENT_DESKTOP_ROLES = new Set([
  'PLATFORM_ADMIN',
  'ADMIN',
  'MASTER',
  'DISPATCHER',
  'NETWORK_DIRECTOR',
  'TECHNICIAN',
  'CLIENT',
  'TERRITORIAL_MANAGER',
])

export function canAccessMobileApp(role?: string | null): boolean {
  return !!role && MOBILE_APP_ROLES.has(role)
}

export function canAccessManagementDesktop(role?: string | null): boolean {
  return !!role && MANAGEMENT_DESKTOP_ROLES.has(role)
}
