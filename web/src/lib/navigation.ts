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

/* ─────────────────────────────────────────────────────────────────────────────
 * SMA-MANAGEMENT-NAVIGATION-V2 — утверждённая информационная архитектура.
 *
 * Rail (домены) → Flyout (страницы раздела) → Workspace (содержимое).
 * managementRailSections — единственный источник структуры V2. Плоские
 * tenantNavigation/platformNavigation ниже выводятся из него, чтобы текущий
 * Shell продолжал работать до перехода на трёхпанельную раскладку.
 *
 * Видимость решается отдельно (isManagementNavItemVisible) и fail-closed:
 * неизвестный маршрут скрыт по умолчанию. Навигация НЕ определяет доступ —
 * это отражение разрешённого контура, backend остаётся источником истины.
 * ───────────────────────────────────────────────────────────────────────────── */

/** Лист навигации — конкретная страница (пункт Flyout). */
export type NavLeaf = { id: string; label: string; to: string }

/** Подгруппа внутри раздела (например, «Ещё» → Управление/Справочники/Система). */
export type NavGroup = { id: string; label: string; items: NavLeaf[] }

export type RailSection = {
  id: string
  label: string
  /** Rail-клик ведёт прямо на эту страницу (раздел-одностраничник, напр. Главная). */
  home?: NavLeaf
  /** Выделенное действие раздела (Заявки → Новая заявка). */
  action?: NavLeaf
  /** Плоский список страниц раздела (Flyout). */
  items?: NavLeaf[]
  /** Вложенные подгруппы (Flyout с заголовками). */
  groups?: NavGroup[]
  /** Раздел виден только PLATFORM_ADMIN. */
  platformOnly?: boolean
}

const DASHBOARD: NavLeaf = { id: 'dashboard', label: 'Главная', to: '/dashboard' }
const TICKETS_NEW: NavLeaf = { id: 'ticketsNew', label: 'Новая заявка', to: '/tickets/new' }

export const managementRailSections: RailSection[] = [
  {
    id: 'home',
    label: 'Главная',
    home: DASHBOARD,
  },
  {
    id: 'tickets',
    label: 'Заявки',
    action: TICKETS_NEW,
    items: [
      { id: 'board', label: 'Доска', to: '/board' },
      { id: 'tickets', label: 'Реестр', to: '/tickets' },
      { id: 'archive', label: 'Архив', to: '/archive' },
    ],
  },
  {
    id: 'objects',
    label: 'Объекты',
    items: [
      { id: 'locations', label: 'Точки', to: '/locations' },
      { id: 'equipment', label: 'Оборудование', to: '/equipment' },
      { id: 'map', label: 'Карта', to: '/map' },
    ],
  },
  {
    id: 'works',
    label: 'Работы',
    items: [
      { id: 'inspectionSchedules', label: 'План обходов', to: '/inspection/schedules' },
      { id: 'inspectionRuns', label: 'Обходы', to: '/inspection/runs' },
      { id: 'inspectionTemplates', label: 'Шаблоны обходов', to: '/inspection/templates' },
      { id: 'workforce', label: 'Смены и трудозатраты', to: '/workforce' },
    ],
  },
  {
    id: 'analytics',
    label: 'Аналитика',
    items: [
      { id: 'analytics', label: 'Обзор', to: '/analytics' },
      { id: 'analyticsLocations', label: 'По объектам', to: '/analytics/locations' },
    ],
  },
  {
    id: 'more',
    label: 'Ещё',
    groups: [
      {
        id: 'management',
        label: 'Управление',
        // «Договоры и подрядчики» (/service-contracts) намеренно не добавлены:
        // решение владельца — страница остаётся PLATFORM_ADMIN-only до отдельной
        // задачи tenant contracts view.
        items: [
          { id: 'employees', label: 'Сотрудники', to: '/employees' },
          { id: 'company', label: 'Компания', to: '/company' },
          { id: 'accessConstructor', label: 'Конструктор доступа', to: '/access-constructor' },
        ],
      },
      {
        id: 'references',
        label: 'Справочники',
        items: [
          { id: 'problemCategories', label: 'Категории проблем', to: '/problem-categories' },
          { id: 'specializations', label: 'Специализации', to: '/specializations' },
          { id: 'materials', label: 'Материалы', to: '/materials' },
        ],
      },
      {
        id: 'system',
        label: 'Система',
        items: [{ id: 'settings', label: 'Настройки', to: '/settings' }],
      },
    ],
  },
  {
    id: 'platform',
    label: 'Платформа',
    platformOnly: true,
    items: [
      { id: 'companies', label: 'Компании', to: '/companies' },
      { id: 'permissions', label: 'Роли и права', to: '/platform/permissions' },
      { id: 'itCompany', label: 'IT Company', to: '/it' },
      // Скрытый owner-only модуль — показывается только при canAccessEngineeringAgent.
      { id: 'engineeringAgent', label: 'Engineering Agent', to: '/agents/engineering' },
    ],
  },
]

/** Все листовые пункты раздела (home + action + items + groups). */
export function railSectionLeaves(section: RailSection): NavLeaf[] {
  const leaves: NavLeaf[] = []
  if (section.home) leaves.push(section.home)
  if (section.action) leaves.push(section.action)
  if (section.items) leaves.push(...section.items)
  if (section.groups) for (const g of section.groups) leaves.push(...g.items)
  return leaves
}

/**
 * Активный раздел Rail по текущему пути. Единственный источник — сам Rail:
 * ищем лист с самым длинным совпадающим префиксом (`to` или `to/…`). Это
 * заодно делает маршрут готовым к canonical /equipment/:id: лист `/equipment`
 * накрывает и `/equipment/<id>` без правок навигации. Неизвестный путь → null.
 */
export function railSectionIdForPath(pathname?: string | null): string | null {
  const path = (pathname || '').split('?')[0].split('#')[0]
  if (!path) return null
  let bestLen = -1
  let bestSection: string | null = null
  for (const section of managementRailSections) {
    for (const leaf of railSectionLeaves(section)) {
      const to = leaf.to
      const match = path === to || path.startsWith(to + '/')
      if (match && to.length > bestLen) {
        bestLen = to.length
        bestSection = section.id
      }
    }
  }
  return bestSection
}

/* ─── Видимость (fail-closed) ─────────────────────────────────────────────────
 *
 * Явный allow-list по маршруту. Неизвестный маршрут → false. Навигация только
 * отражает разрешённый контур; backend PBAC остаётся источником истины.
 *
 * Множества ролей согласованы с фактическими backend @Roles в CURRENT prod
 * (см. аудит). ANALYTICS_VIEW у `me` не выдаётся, поэтому аналитика сведена к
 * ролям backend-контроллера. ADMIN_PROVIDER — фронтовый алиас (backend его не
 * возвращает), оставлен ради полноты и равенства с ADMIN.
 * ───────────────────────────────────────────────────────────────────────────── */

export type NavVisibilityContext = {
  role?: Role | null
  canAccessEngineeringAgent?: boolean
}

const R = {
  fullAdmin: new Set<Role>(['PLATFORM_ADMIN', 'ADMIN', 'ADMIN_PROVIDER']),
  // Роли, которым backend отдаёт аналитику (analytics.controller @Roles + ANALYTICS_VIEW).
  analytics: new Set<Role>(['PLATFORM_ADMIN', 'ADMIN', 'ADMIN_PROVIDER', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR']),
  // Планирование/шаблоны обходов (inspection.controller @Roles, десктоп-управление).
  roundsManage: new Set<Role>(['PLATFORM_ADMIN', 'ADMIN', 'ADMIN_PROVIDER', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR']),
  // Смены и трудозатраты (текущий прод-гейт /workforce). CLIENT_ADMIN НЕ входит:
  // у `me` нет подтверждения WORKFORCE_VIEW (решение владельца — без подтверждения не показывать).
  workforce: new Set<Role>(['PLATFORM_ADMIN', 'ADMIN', 'ADMIN_PROVIDER', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR', 'TERRITORIAL_MANAGER']),
}

/** Маршруты, видимые роли CLIENT (узкий allow-list, как в текущем проде). */
const CLIENT_ALLOWED = new Set<string>(['/board', '/archive', '/tickets', '/tickets/new', '/company', '/settings'])

function has(set: Set<Role>, role?: Role | null): boolean {
  return !!role && set.has(role)
}

/**
 * Единственная точка решения видимости пункта меню. Fail-closed.
 */
export function isManagementNavItemVisible(to: string, ctx: NavVisibilityContext): boolean {
  const role = ctx.role ?? null

  // Owner-only скрытый модуль — строго по серверному флагу, независимо от роли.
  if (to === '/agents/engineering') return !!ctx.canAccessEngineeringAgent

  // IT Company — строго PLATFORM_ADMIN через канонический резолвер.
  if (to === '/it' || to.startsWith('/it/')) return canViewITCompany({ role })

  if (!role) return false
  if (role === 'PLATFORM_ADMIN') {
    // Платформа и весь тенантный контур доступны платформенному админу.
    return true
  }

  // Платформенные пункты — только PLATFORM_ADMIN (выше). Для прочих — скрыты.
  if (to === '/companies' || to === '/platform/permissions') return false

  if (role === 'CLIENT') return CLIENT_ALLOWED.has(to)

  switch (to) {
    // Главная / аналитика — по ролям backend-аналитики.
    case '/dashboard':
    case '/analytics':
    case '/analytics/locations':
      return has(R.analytics, role)

    // Справочники и управление — полный админ.
    case '/employees':
    case '/locations':
    case '/problem-categories':
    case '/specializations':
    case '/materials':
    case '/access-constructor':
      return has(R.fullAdmin, role)

    case '/workforce':
      return has(R.workforce, role)

    case '/inspection/schedules':
    case '/inspection/templates':
      return has(R.roundsManage, role)

    case '/inspection/runs':
    case '/map':
      return role !== 'STAFF'

    case '/equipment':
      // Список оборудования — управленческий справочник объектов (как /locations).
      return has(R.fullAdmin, role)

    case '/board':
    case '/archive':
    case '/tickets':
      return role !== 'STAFF'

    case '/tickets/new':
      return role !== 'STAFF'

    case '/company':
    case '/settings':
      return role !== 'TECHNICIAN' && role !== 'STAFF'

    default:
      // Fail-closed: неизвестный/новый маршрут скрыт, пока явно не разрешён.
      return false
  }
}

/* ─── Плоские конфиги для текущего Shell (выводятся из Rail) ──────────────────── */

const tenantSidebarSections: NavSection[] = managementRailSections
  .filter((section) => !section.platformOnly)
  .map((section) => ({
    id: section.id,
    label: section.label,
    items: railSectionLeaves(section).map((leaf) => ({ id: leaf.id, label: leaf.label, to: leaf.to })),
  }))

const platformSidebarSection: NavSection = {
  id: 'platform',
  label: 'Платформа',
  items: (managementRailSections.find((s) => s.id === 'platform')?.items ?? []).map((leaf) => ({
    id: leaf.id,
    label: leaf.label,
    to: leaf.to,
  })),
}

const leafById = Object.fromEntries(
  managementRailSections.flatMap((s) => railSectionLeaves(s)).map((leaf) => [leaf.id, leaf]),
) as Record<string, NavLeaf>

const tenantTopbarIds = ['board', 'archive', 'tickets', 'analytics', 'settings'] as const

export const platformNavigation: ShellNavigationConfig = {
  sidebar: [...tenantSidebarSections, platformSidebarSection],
  topbar: [
    { id: 'companies', label: 'Компании', to: '/companies' },
    leafById.board,
    leafById.tickets,
    leafById.analytics,
    leafById.settings,
  ].filter(Boolean) as NavItem[],
}

export const tenantNavigation: ShellNavigationConfig = {
  sidebar: tenantSidebarSections,
  topbar: tenantTopbarIds.map((id) => leafById[id]).filter(Boolean) as NavItem[],
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
  'CLIENT_ADMIN',
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

export function canAccessManagementDesktop(user?: { canAccessManagementSurface?: boolean } | null): boolean {
  return user?.canAccessManagementSurface === true
}

/**
 * Стартовая страница управленческой части (десктоп) по роли.
 *
 * Решение владельца (Navigation V2):
 * - PLATFORM_ADMIN → /companies;
 * - роль с доступом к аналитике → /dashboard (Главная);
 * - остальные управленческие роли → /board.
 *
 * ANALYTICS_VIEW у `me` не приходит, поэтому «доступ к аналитике»
 * аппроксимируется ролями backend-аналитики (R.analytics).
 */
export function managementHomePath(role?: string | null): string {
  if (role === 'PLATFORM_ADMIN') return '/companies'
  if (role && R.analytics.has(role as Role)) return '/dashboard'
  return '/board'
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
 */
export function getAvailableWorkspaces(
  user?: { role?: string | null; canAccessManagementSurface?: boolean } | null,
): WorkspaceCard[] {
  const role = user?.role
  const cards: WorkspaceCard[] = []

  if (canAccessManagementDesktop(user)) {
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
