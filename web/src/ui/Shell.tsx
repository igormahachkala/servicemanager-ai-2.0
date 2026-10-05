import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import { offlineAwareLogout } from '../lib/offlineSessionLogout'
import {
  canAccessMobileApp,
  mobileAppNavItem,
  isManagementNavItemVisible,
  managementRailSections,
  railSectionIdForPath,
  railSectionLeaves,
  platformNavigation,
  tenantNavigation,
  type NavItem,
  type NavLeaf,
  type NavSection,
  type RailSection,
} from '../lib/navigation'
import { getRoleDisplayLabel } from '../lib/resolveAdminProfile'
import { useWsInvalidation } from './useWsInvalidation'
import { useRealtimeNotifications } from '../hooks/useRealtimeNotifications'
import { Breadcrumbs } from './Breadcrumbs'

const RAIL_COLLAPSED_STORAGE_KEY = 'sma.nav.railCollapsed.v1'
const LAST_PAGE_STORAGE_KEY = 'sma.nav.lastPageBySection.v1'

/**
 * SMA-NAVIGATION-V2-VISUAL — SVG line-icons (Tabler-style, stroke 1.75) из
 * утверждённого visual contract SMA_Navigation_V2(2). Ключ — id раздела rail.
 */
const RAIL_ICON_PATHS: Record<string, string> = {
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  tickets: '<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 3.5h6v3H9z"/><path d="M9 13.5l2 2 4-4"/>',
  objects: '<path d="M3.5 20h17"/><path d="M5.5 20V6.5L13 3.5V20"/><path d="M13 9h5.5v11"/><path d="M8.5 8.5h1.5M8.5 12h1.5M8.5 15.5h1.5"/>',
  works: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/><path d="M9 15l2 2 4-4"/>',
  analytics: '<path d="M4 20h16"/><path d="M7 16.5v-5M12 16.5V7M17 16.5v-8"/>',
  more: '<path d="M5.5 12h.01M12 12h.01M18.5 12h.01" stroke-width="3"/>',
  platform: '<path d="M12 3.5l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 16.5l8 4 8-4"/>',
}
const UTIL_ICON_PATHS: Record<string, string> = {
  collapse: '<path d="M11 7l-5 5 5 5M18 7l-5 5 5 5"/>',
  expand: '<path d="M6 7l5 5-5 5M13 7l5 5-5 5"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  pin: '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>',
}
function NavSvg({ paths, size = 20 }: { paths: string; size?: number }) {
  return (
    <svg
      className="railIcon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: paths }}
    />
  )
}

function NavItemButton(props: { to: string; label: string; active: boolean; onNavigate?: () => void }) {
  return (
    <Link to={props.to} style={{ textDecoration: 'none' }} onClick={props.onNavigate}>
      <button className={props.active ? 'navBtn navBtnActive' : 'navBtn'}>{props.label}</button>
    </Link>
  )
}

function NavSectionBlock(props: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div
        className="small"
        style={{ opacity: 0.72, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, padding: '0 4px' }}
      >
        {props.title}
      </div>
      <div style={{ display: 'grid', gap: 8 }}>{props.children}</div>
    </div>
  )
}

function isActivePath(currentPath: string, targetPath: string) {
  if (targetPath === '/dashboard') return currentPath.startsWith('/dashboard')
  if (targetPath === '/board') return currentPath.startsWith('/board')
  if (targetPath === '/archive') return currentPath.startsWith('/archive')
  if (targetPath === '/tickets/new') return currentPath.startsWith('/tickets/new')
  if (targetPath === '/tickets') return currentPath === '/tickets' || currentPath.startsWith('/tickets/')
  if (targetPath === '/equipment') return currentPath.startsWith('/equipment')
  if (targetPath === '/companies') return currentPath.startsWith('/companies')
  if (targetPath === '/service-contracts') return currentPath.startsWith('/service-contracts')
  if (targetPath === '/locations') return currentPath.startsWith('/locations')
  if (targetPath === '/employees') return currentPath.startsWith('/employees')
  if (targetPath === '/workforce') return currentPath.startsWith('/workforce')
  if (targetPath === '/inspection/schedules') return currentPath.startsWith('/inspection/schedules')
  if (targetPath === '/inspection/runs') return currentPath.startsWith('/inspection/runs')
  if (targetPath === '/inspection/templates') return currentPath.startsWith('/inspection/templates')
  if (targetPath === '/map') return currentPath.startsWith('/map')
  if (targetPath === '/specializations') return currentPath.startsWith('/specializations')
  if (targetPath === '/materials') return currentPath.startsWith('/materials')
  if (targetPath === '/analytics/locations') return currentPath.startsWith('/analytics/locations')
  if (targetPath === '/analytics') return currentPath === '/analytics' || currentPath.startsWith('/analytics/')
  if (targetPath === '/settings') return currentPath.startsWith('/settings')
  if (targetPath === '/company') return currentPath.startsWith('/company')
  if (targetPath === '/problem-categories') return currentPath.startsWith('/problem-categories')
  if (targetPath === '/access-constructor') return currentPath.startsWith('/access-constructor') || currentPath.startsWith('/platform/access-constructor')
  if (targetPath === '/platform/permissions') return currentPath.startsWith('/permissions') || currentPath.startsWith('/platform/permissions')
  if (targetPath === '/it') return currentPath === '/it' || currentPath.startsWith('/it/')
  return currentPath === targetPath
}

function isNavItemVisible(item: NavItem, role?: api.Role, canAccessEngineeringAgent?: boolean) {
  // SMA-MANAGEMENT-NAVIGATION-V2: единое fail-closed решение видимости живёт в
  // lib/navigation (чистая функция, покрыта тестами). Shell только применяет.
  return isManagementNavItemVisible(item.to, { role, canAccessEngineeringAgent })
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(RAIL_COLLAPSED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function readLastPages(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LAST_PAGE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

export function Shell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed)
  /** Раздел, чей Flyout открыт. Pinned: активный раздел; collapsed: временный overlay. */
  const [openSectionId, setOpenSectionId] = useState<string | null>(null)
  /** Last-page memory: последняя посещённая страница (canonical leaf.to) в каждом разделе. */
  const [lastPathBySection, setLastPathBySection] = useState<Record<string, string>>(readLastPages)
  const contentMainRef = useRef<HTMLElement | null>(null)
  const flyoutRef = useRef<HTMLDivElement | null>(null)
  const railRef = useRef<HTMLElement | null>(null)

  const nav = useNavigate()
  const loc = useLocation()
  const queryClient = useQueryClient()

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const tenantCompanyQ = useQuery({
    queryKey: ['company-own-context'],
    queryFn: () => api.company(),
    enabled: !!meQ.data && meQ.data.role !== 'PLATFORM_ADMIN',
  })

  const currentScope = useMemo(() => {
    const params = new URLSearchParams(loc.search)
    const linked = (params.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
    const company = (params.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
    return { linkedClientCompanyId: linked || undefined, companyId: company || undefined }
  }, [loc.search, meQ.data])

  const onNotification = useRealtimeNotifications('desktop')
  useWsInvalidation(currentScope, { onNotification })

  const impersonationMeta = useMemo(() => api.getImpersonationMeta(), [meQ.data?.id, loc.key])
  const isImpersonating = api.isImpersonating() && !!impersonationMeta

  useEffect(() => {
    if (meQ.isError) {
      void offlineAwareLogout('session_lost').finally(() => {
        api.clearToken()
        queryClient.clear()
        nav(api.loginPathWithReturnTo(`${loc.pathname}${loc.search}${loc.hash}`), { replace: true })
      })
    }
  }, [loc.hash, loc.pathname, loc.search, meQ.isError, nav, queryClient])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [loc.pathname])

  useEffect(() => {
    const container = contentMainRef.current
    if (!container) return
    container.scrollTo({ top: 0, left: 0 })
  }, [loc.pathname])

  useEffect(() => {
    if (!meQ.data) return
    api.setUserRole(meQ.data.role)
    api.setCompanyLabel(meQ.data.companyName || meQ.data.email)
    api.syncScopeOwnerProfile(meQ.data)
  }, [meQ.data])

  useEffect(() => {
    if (!meQ.data) return
    api.persistScopeFromSearchParams(new URLSearchParams(loc.search), meQ.data)
  }, [loc.search, meQ.data])

  // Persist состояния rail — в эффекте, не во время рендера (per-viewer, localStorage).
  useEffect(() => {
    try {
      localStorage.setItem(RAIL_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      /* localStorage недоступен — не критично для раскладки */
    }
  }, [collapsed])

  const role = meQ.data?.role
  const tenantCompanyType = tenantCompanyQ.data?.type
  const roleDisplayLabel = meQ.data ? getRoleDisplayLabel({ role: meQ.data.role, companyType: tenantCompanyType }) : '—'
  const canAccessEngineeringAgent = !!meQ.data?.canAccessEngineeringAgent
  const isPlatformAdmin = role === 'PLATFORM_ADMIN'

  const activeSectionId = useMemo(() => railSectionIdForPath(loc.pathname), [loc.pathname])

  /** Видимый лист раздела с учётом fail-closed видимости. */
  const leafVisible = useCallback(
    (leaf: NavLeaf) => isManagementNavItemVisible(leaf.to, { role, canAccessEngineeringAgent }),
    [role, canAccessEngineeringAgent],
  )

  /** Разделы Rail, у которых есть хотя бы один видимый пункт. */
  const visibleRailSections = useMemo(() => {
    return managementRailSections.filter((section) => {
      if (section.platformOnly && !isPlatformAdmin) return false
      return railSectionLeaves(section).some(leafVisible)
    })
  }, [isPlatformAdmin, leafVisible])

  /** Посадочные листы раздела (без «Новой заявки»-действия): home + items + группы. */
  const landingLeaves = useCallback(
    (section: RailSection): NavLeaf[] => railSectionLeaves(section).filter((l) => l !== section.action && leafVisible(l)),
    [leafVisible],
  )

  /**
   * Last-page memory → canonical safe landing. Сохранённый путь используется, только
   * если он всё ещё доступен (fail-closed); иначе — первый доступный лист раздела.
   * Доступа это не расширяет: кандидаты уже отфильтрованы leafVisible.
   */
  const sectionLanding = useCallback(
    (section: RailSection): string | null => {
      const leaves = landingLeaves(section)
      if (!leaves.length) return null
      const stored = lastPathBySection[section.id]
      if (stored && leaves.some((l) => l.to === stored)) return stored
      return leaves[0].to
    },
    [landingLeaves, lastPathBySection],
  )

  // Запоминаем последнюю страницу активного раздела (canonical leaf.to), если она видима.
  useEffect(() => {
    if (!activeSectionId) return
    const section = managementRailSections.find((s) => s.id === activeSectionId)
    if (!section) return
    const leaf = landingLeaves(section).find((l) => isActivePath(loc.pathname, l.to))
    if (!leaf) return
    setLastPathBySection((prev) => {
      if (prev[activeSectionId] === leaf.to) return prev
      const next = { ...prev, [activeSectionId]: leaf.to }
      try {
        localStorage.setItem(LAST_PAGE_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* localStorage недоступен — память на эту сессию */
      }
      return next
    })
  }, [activeSectionId, loc.pathname, landingLeaves])

  // Pinned: flyout следует за активным разделом. Collapsed: навигация закрывает overlay.
  useEffect(() => {
    setOpenSectionId(collapsed ? null : activeSectionId)
  }, [loc.pathname, collapsed, activeSectionId])

  // Esc закрывает временный flyout (collapsed) и возвращает фокус на пункт rail.
  useEffect(() => {
    if (!collapsed || !openSectionId) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      const sid = openSectionId
      setOpenSectionId(null)
      requestAnimationFrame(() => {
        const btn = railRef.current?.querySelector<HTMLButtonElement>(`[data-sec="${sid}"]`)
        btn?.focus()
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [collapsed, openSectionId])

  // Автофокус на overlay-flyout при открытии в collapsed — для клавиатуры.
  useEffect(() => {
    if (collapsed && openSectionId && flyoutRef.current) {
      flyoutRef.current.focus()
    }
  }, [collapsed, openSectionId])

  const resolvedFlyoutSectionId = openSectionId ?? (collapsed ? null : activeSectionId)
  const flyoutSection: RailSection | null = useMemo(
    () => visibleRailSections.find((s) => s.id === resolvedFlyoutSectionId) ?? null,
    [visibleRailSections, resolvedFlyoutSectionId],
  )
  // Pinned: flyout ВСЕГДА присутствует для активного раздела (в т.ч. одностраничного),
  // чтобы ширина Workspace не прыгала (stable layout). Collapsed: временный overlay.
  const showPersistentFlyout = !collapsed && !!flyoutSection
  const showOverlayFlyout = collapsed && !!flyoutSection

  function scoped(to: string) {
    return api.appendScopeToPath(to, currentScope, meQ.data)
  }

  function handleRailSectionClick(section: RailSection) {
    const leaves = landingLeaves(section)
    const singlePage = leaves.length === 1 && !section.action
    if (!collapsed) {
      // Pinned: клик по разделу открывает последнюю/первую страницу раздела.
      const to = sectionLanding(section)
      if (to) nav(scoped(to))
      return
    }
    // Collapsed: одностраничный раздел — переход сразу; иначе overlay.
    if (singlePage) {
      const to = sectionLanding(section)
      setOpenSectionId(null)
      if (to) nav(scoped(to))
      return
    }
    setOpenSectionId((prev) => (prev === section.id ? null : section.id))
  }

  function onFlyoutNavigate() {
    setMobileMenuOpen(false)
    if (collapsed) setOpenSectionId(null)
  }

  async function logout() {
    const cleanup = await offlineAwareLogout('user_initiated')
    if (!cleanup.proceed) return
    await api.logoutSmaSession()
    queryClient.clear()
    if (typeof window !== 'undefined') window.location.replace('/login')
    else nav('/login', { replace: true })
  }

  function exitImpersonation() {
    const restored = api.exitImpersonationSession()
    queryClient.clear()
    if (typeof window !== 'undefined') window.location.replace(restored ? '/companies' : '/login')
    else nav(restored ? '/companies' : '/login', { replace: true })
  }

  // ─── Мобильный drawer (hamburger) — прежний плоский список, без изменений поведения ───
  const navigation = isPlatformAdmin ? platformNavigation : tenantNavigation
  const mobileSidebarSections = useMemo(
    () =>
      navigation.sidebar
        .map((section: NavSection) => ({
          ...section,
          items: section.items
            .filter((item: NavItem) => isNavItemVisible(item, role, canAccessEngineeringAgent))
            .map((item: NavItem) => ({ ...item, active: isActivePath(loc.pathname, item.to) })),
        }))
        .filter((section) => section.items.length > 0),
    [loc.pathname, navigation.sidebar, role, canAccessEngineeringAgent],
  )

  const renderFlyoutItem = (leaf: NavLeaf) => (
    <Link key={leaf.id} to={scoped(leaf.to)} className="flyoutSub" aria-current={isActivePath(loc.pathname, leaf.to) ? 'page' : undefined} onClick={onFlyoutNavigate}>
      {leaf.label}
    </Link>
  )

  const renderFlyoutBody = (section: RailSection, overlay: boolean) => {
    const flatItems = section.items ?? (section.home ? [section.home] : [])
    return (
      <>
        <div className="flyoutHeader">
          <h2 className="flyoutTitle">{section.label}</h2>
          {overlay ? (
            <div className="flyoutTools">
              <button type="button" className="flyoutIconBtn" aria-label="Закрепить меню разделов" title="Закрепить" onClick={() => { setCollapsed(false) }}>
                <NavSvg paths={UTIL_ICON_PATHS.pin} size={17} />
              </button>
              <button type="button" className="flyoutIconBtn" aria-label="Закрыть меню раздела" title="Закрыть" onClick={() => setOpenSectionId(null)}>
                <NavSvg paths={UTIL_ICON_PATHS.close} size={17} />
              </button>
            </div>
          ) : null}
        </div>
        {section.action && leafVisible(section.action) ? (
          <Link to={scoped(section.action.to)} className="flyoutAction" onClick={onFlyoutNavigate}>
            <NavSvg paths={'<path d=\"M12 5v14M5 12h14\"/>'} size={15} /> {section.action.label}
          </Link>
        ) : null}
        {flatItems.length ? <div className="flyoutItems">{flatItems.filter(leafVisible).map(renderFlyoutItem)}</div> : null}
        {section.groups
          ? section.groups
              .map((group) => ({ ...group, items: group.items.filter(leafVisible) }))
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <div key={group.id} className="flyoutGroup">
                  <div className="flyoutGroupLabel">{group.label}</div>
                  <div className="flyoutItems">{group.items.map(renderFlyoutItem)}</div>
                </div>
              ))
          : null}
      </>
    )
  }

  return (
    <div className="appLayout" data-rail-collapsed={collapsed ? 'true' : 'false'} data-flyout={showPersistentFlyout ? 'true' : 'false'}>
      {/* ─── Desktop Rail (76px / collapsed 60px) — единственная тёмная поверхность ─── */}
      <nav className="railNav" aria-label="Основная навигация" ref={railRef}>
        <div className="railLogo" aria-label="ServiceManager.AI">SM</div>
        <div className="railSections">
          {visibleRailSections.map((section, idx) => {
            const active = section.id === activeSectionId
            const open = section.id === resolvedFlyoutSectionId && (showPersistentFlyout || showOverlayFlyout)
            const openNonActive = open && !active
            const multi = collapsed && !(landingLeaves(section).length === 1 && !section.action)
            const needsSep = section.platformOnly && idx > 0
            return (
              <div key={section.id} style={{ display: 'contents' }}>
                {needsSep ? <div className="railSep" role="separator" /> : null}
                <button
                  type="button"
                  data-sec={section.id}
                  data-tip={section.label}
                  // aria-label — доступное имя кнопки и в collapsed, где подпись скрыта,
                  // а иконка aria-hidden. Визуал не меняет.
                  aria-label={section.label}
                  className={`railBtn${active ? ' railBtnActive' : ''}${openNonActive ? ' railBtnOpen' : ''}`}
                  aria-current={active ? 'true' : undefined}
                  {...(multi ? { 'aria-expanded': open, 'aria-haspopup': 'true' as const } : {})}
                  aria-controls="nav-flyout"
                  onClick={() => handleRailSectionClick(section)}
                >
                  <NavSvg paths={RAIL_ICON_PATHS[section.id] ?? RAIL_ICON_PATHS.more} />
                  <span className="railBtnLabel">{section.label}</span>
                </button>
              </div>
            )
          })}
        </div>
        <div className="railFooter">
          <button
            type="button"
            data-tip={collapsed ? 'Показать меню разделов' : 'Свернуть навигацию'}
            className="railBtn railUtil"
            aria-pressed={collapsed}
            aria-label={collapsed ? 'Показать меню разделов' : 'Свернуть навигацию'}
            onClick={() => setCollapsed((v) => !v)}
          >
            <NavSvg paths={collapsed ? UTIL_ICON_PATHS.expand : UTIL_ICON_PATHS.collapse} size={18} />
          </button>
        </div>
      </nav>

      {/* ─── Desktop Flyout (270px, светлый panel) — persistent (pinned) / overlay (collapsed) ─── */}
      {showPersistentFlyout && flyoutSection ? (
        <aside className="flyout" id="nav-flyout" aria-label={flyoutSection.label}>
          {renderFlyoutBody(flyoutSection, false)}
        </aside>
      ) : null}
      {showOverlayFlyout && flyoutSection ? (
        <>
          <div className="flyoutBackdrop" onClick={() => setOpenSectionId(null)} />
          <aside className="flyout flyoutOverlay" id="nav-flyout" aria-label={flyoutSection.label} tabIndex={-1} ref={flyoutRef}>
            {renderFlyoutBody(flyoutSection, true)}
          </aside>
        </>
      ) : null}

      {/* ─── Mobile drawer (hamburger) — прежнее поведение, mobile IA не трогаем ─── */}
      <aside className={mobileMenuOpen ? 'sidebar sidebarMobileOpen' : 'sidebar'}>
        <div className="sidebarHeader">
          <div className="sidebarBrand">ServiceManager.AI</div>
          <div className="sidebarSub">{api.getCompanyLabel(meQ.data)}</div>
        </div>
        <nav className="nav" style={{ display: 'grid', gap: 18 }}>
          {mobileSidebarSections.map((section) => (
            <NavSectionBlock key={section.id} title={section.label}>
              {section.items.map((item) => (
                <NavItemButton
                  key={item.id}
                  to={scoped(item.to)}
                  label={item.label}
                  active={item.active}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              ))}
            </NavSectionBlock>
          ))}
        </nav>
        {canAccessMobileApp(role) ? (
          <div style={{ marginTop: 8 }}>
            <NavItemButton
              to={scoped(mobileAppNavItem.to)}
              label={mobileAppNavItem.label}
              active={loc.pathname.startsWith('/m') || loc.pathname.startsWith('/max')}
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </div>
        ) : null}
        <div className="sidebarFooter">
          <div className="small" style={{ opacity: 0.75 }}>
            {meQ.data ? `${meQ.data.email} (${roleDisplayLabel})` : '—'}
          </div>
          <button className="navBtn" onClick={() => { void logout() }} style={{ marginTop: 10 }}>
            Выйти
          </button>
        </div>
      </aside>

      <div className="contentArea">
        {/* SMA-NAVIGATION-V2-VISUAL — облегчённый header: крошки слева, глобальное справа.
            Крупный branding убран (логотип живёт в rail). */}
        <header className="topbar topbarSlim">
          <button className="navBtn mobileMenuBtn" type="button" onClick={() => setMobileMenuOpen((value) => !value)}>
            {mobileMenuOpen ? 'Закрыть меню' : 'Меню'}
          </button>
          <div className="topbarCrumbs">
            <Breadcrumbs />
          </div>
          <div className="actions">
            {canAccessMobileApp(role) ? (
              <Link to={scoped(mobileAppNavItem.to)}>
                <button className={loc.pathname.startsWith('/m') || loc.pathname.startsWith('/max') ? 'navBtn navBtnActive' : 'ghost'}>
                  {mobileAppNavItem.label}
                </button>
              </Link>
            ) : null}
            <span className="topbarUser small" style={{ opacity: 0.75 }}>
              {meQ.data ? `${meQ.data.email} (${roleDisplayLabel})` : '—'}
            </span>
            <button className="ghost topbarLogout" onClick={() => { void logout() }}>
              Выйти
            </button>
          </div>
        </header>

        {isImpersonating && impersonationMeta ? (
          <div className="panel" style={{ margin: '12px 24px 0', border: '1px solid #f59e0b', background: '#fff7ed', color: '#7c2d12' }}>
            <div className="row" style={{ alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Режим impersonation</div>
                <div className="small">Вы вошли как {roleDisplayLabel} компании {impersonationMeta.companyName}</div>
              </div>
              <button type="button" className="ghost" onClick={exitImpersonation}>Вернуться в PLATFORM_ADMIN</button>
            </div>
          </div>
        ) : null}

        <main className="contentMain" ref={contentMainRef}>
          <Outlet />
        </main>
      </div>

      {mobileMenuOpen ? <div className="mobileBackdrop" onClick={() => setMobileMenuOpen(false)} /> : null}
    </div>
  )
}
