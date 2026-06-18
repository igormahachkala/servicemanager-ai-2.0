import type { Role } from './api'
import { canViewITCompany } from '../it-company/access'

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
  { id: 'inspectionSchedules', label: 'Планировщик обходов', to: '/inspection/schedules' },
  { id: 'inspectionRuns', label: 'Обходы', to: '/inspection/runs' },
  { id: 'company', label: 'Компания', to: '/company' },
  { id: 'settings', label: 'Настройки', to: '/settings' },
  // Раздел IT Company — виден только PLATFORM_ADMIN (gating в isNavItemVisible).
  { id: 'itCompany', label: 'IT Company', to: '/it' },
  // Скрытый owner-only модуль — виден только при me.canAccessEngineeringAgent.
  { id: 'engineeringAgent', label: 'Engineering Agent', to: '/agents/engineering' },
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
    {
      id: 'platform',
      label: 'Платформа',
      items: [{ id: 'permissions', label: 'Роли и права', to: '/platform/permissions' }],
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

/** Стартовая страница управленческой части (десктоп) по роли. */
export function managementHomePath(role?: string | null): string {
  return role === 'PLATFORM_ADMIN' ? '/companies' : '/board'
}

export type WorkspaceId = 'management' | 'mobile' | 'it'

export type WorkspaceCard = {
  id: WorkspaceId
  /** Базовый путь контура (управленческая часть резолвится по роли в `to`). */
  to: string
  title: string
  description: string
}

/**
 * Контуры, доступные пользователю после логина (экран /workspaces).
 *
 * Видимость:
 * - Управленческая часть — любой аутентифицированный пользователь (это основное
 *   приложение, домашний маршрут по умолчанию для всех ролей). Намеренно НЕ
 *   используем `canAccessManagementDesktop` — тот набор заточен под кнопку
 *   «вернуться в десктоп» в мобильном профиле и не включает ADMIN_PROVIDER/STAFF.
 * - Мобильная версия — `canAccessMobileApp`
 * - IT Company — строго PLATFORM_ADMIN (`canViewITCompany`)
 */
export function getAvailableWorkspaces(user?: { role?: string | null } | null): WorkspaceCard[] {
  const role = user?.role
  const cards: WorkspaceCard[] = []

  if (role) {
    cards.push({
      id: 'management',
      to: managementHomePath(role),
      title: 'Управленческая часть',
      description: 'Доска, заявки, справочники и отчёты',
    })
  }

  if (canAccessMobileApp(role)) {
    cards.push({
      id: 'mobile',
      to: '/m',
      title: 'Мобильная версия',
      description: 'Быстрые действия, фото и уведомления',
    })
  }

  if (canViewITCompany({ role: (role ?? null) as Role | null })) {
    cards.push({
      id: 'it',
      to: '/it',
      title: 'IT Company',
      description: 'AI-сотрудники и разработка продуктов',
    })
  }

  return cards
}
