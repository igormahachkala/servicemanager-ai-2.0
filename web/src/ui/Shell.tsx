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
import { SmaBrandLogo } from '../components/SmaBrandLogo'
import { useWsInvalidation } from './useWsInvalidation'
import { useRealtimeNotifications } from '../hooks/useRealtimeNotifications'
import { Breadcrumbs } from './Breadcrumbs'

const RAIL_COLLAPSED_STORAGE_KEY = 'sma.nav.railCollapsed.v1'

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

export function Shell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed)
  /** Раздел, чей Flyout открыт. Expanded: по умолчанию активный раздел; collapsed: временный. */
  const [openSectionId, setOpenSectionId] = useState<string | null>(null)
  const contentMainRef = useRef<HTMLElement | null>(null)
  const flyoutRef = useRef<HTMLDivElement | null>(null)

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

  try {
    localStorage.setItem(RAIL_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    /* localStorage недоступен — не критично для раскладки */
  }

  const role = meQ.data?.role
  const tenantCompanyType = tenantCompanyQ.data?.type
  const roleDisplayLabel = meQ.data ? getRoleDisplayLabel({ role: meQ.data.role, companyType: tenantCompanyType }) : '—'
  const canAccessEngineeringAgent = !!meQ.data?.canAccessEngineeringAgent
  const isPlatformAdmin = role === 'PLATFORM_ADMIN'

  const activeSectionId = useMemo(() => railSectionIdForPath(loc.pathname), [loc.pathname])

  // Navigation закрывает временный flyout; в expanded flyout следует за активным разделом.
  useEffect(() => {
    setOpenSectionId(collapsed ? null : activeSectionId)
  }, [loc.pathname, collapsed, activeSectionId])

  // Esc закрывает временный flyout (collapsed).
  useEffect(() => {
    if (!collapsed || !openSectionId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenSectionId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [collapsed, openSectionId])

  // Автофокус на flyout при открытии во временном (collapsed) режиме — для клавиатуры.
  useEffect(() => {
    if (collapsed && openSectionId && flyoutRef.current) {
      flyoutRef.current.focus()
    }
  }, [collapsed, openSectionId])

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

  const resolvedFlyoutSectionId = openSectionId ?? (collapsed ? null : activeSectionId)
  const flyoutSection: RailSection | null = useMemo(
    () => visibleRailSections.find((s) => s.id === resolvedFlyoutSectionId) ?? null,
    [visibleRailSections, resolvedFlyoutSectionId],
  )
  // Главная — раздел-одностраничник: отдельный Flyout не нужен.
  const flyoutHasPages = !!flyoutSection && railSectionLeaves(flyoutSection).some((l) => l.to !== flyoutSection.home?.to)
  const showPersistentFlyout = !collapsed && flyoutHasPages
  const showOverlayFlyout = collapsed && !!flyoutSection && flyoutHasPages

  function scoped(to: string) {
    return api.appendScopeToPath(to, currentScope, meQ.data)
  }

  function handleRailSectionClick(section: RailSection) {
    // Раздел-одностраничник (Главная) — навигируем сразу, без Flyout.
    if (section.home && !railSectionLeaves(section).some((l) => l.to !== section.home!.to)) {
      setOpenSectionId(null)
      nav(scoped(section.home.to))
      return
    }
    setOpenSectionId((prev) => (prev === section.id ? (collapsed ? null : prev) : section.id))
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

  const renderFlyoutBody = (section: RailSection) => (
    <>
      <div className="flyoutHeader">
        <span className="flyoutTitle">{section.label}</span>
        {collapsed ? (
          <button type="button" className="flyoutClose" aria-label="Закрыть меню раздела" onClick={() => setOpenSectionId(null)}>
            ✕
          </button>
        ) : null}
      </div>
      {section.action && leafVisible(section.action) ? (
        <Link to={scoped(section.action.to)} style={{ textDecoration: 'none' }} onClick={onFlyoutNavigate}>
          <button className="navBtn flyoutAction">+ {section.action.label}</button>
        </Link>
      ) : null}
      {section.items ? (
        <div className="flyoutItems">
          {section.items.filter(leafVisible).map((leaf) => (
            <NavItemButton
              key={leaf.id}
              to={scoped(leaf.to)}
              label={leaf.label}
              active={isActivePath(loc.pathname, leaf.to)}
              onNavigate={onFlyoutNavigate}
            />
          ))}
        </div>
      ) : null}
      {section.groups
        ? section.groups
            .map((group) => ({ ...group, items: group.items.filter(leafVisible) }))
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <NavSectionBlock key={group.id} title={group.label}>
                {group.items.map((leaf) => (
                  <NavItemButton
                    key={leaf.id}
                    to={scoped(leaf.to)}
                    label={leaf.label}
                    active={isActivePath(loc.pathname, leaf.to)}
                    onNavigate={onFlyoutNavigate}
                  />
                ))}
              </NavSectionBlock>
            ))
        : null}
    </>
  )

  return (
    <div className="appLayout" data-rail-collapsed={collapsed ? 'true' : 'false'} data-flyout={showPersistentFlyout ? 'true' : 'false'}>
      {/* ─── Desktop Rail (76px / collapsed 60px) ─── */}
      <nav className="railNav" aria-label="Разделы навигации">
        <div className="railLogo">
          <SmaBrandLogo variant="header" compact />
        </div>
        <div className="railSections">
          {visibleRailSections.map((section) => {
            const active = section.id === activeSectionId
            const open = section.id === resolvedFlyoutSectionId && (showPersistentFlyout || showOverlayFlyout)
            return (
              <button
                key={section.id}
                type="button"
                className={active ? 'railBtn railBtnActive' : 'railBtn'}
                aria-current={active ? 'page' : undefined}
                aria-expanded={open}
                aria-controls="nav-flyout"
                title={section.label}
                onClick={() => handleRailSectionClick(section)}
              >
                <span className="railBtnLabel">{section.label}</span>
              </button>
            )
          })}
        </div>
        <div className="railFooter">
          <button
            type="button"
            className="railBtn railCollapseToggle"
            aria-pressed={collapsed}
            aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>
      </nav>

      {/* ─── Desktop Flyout (270px persistent, or temporary overlay in collapsed) ─── */}
      {showPersistentFlyout && flyoutSection ? (
        <aside className="flyout" id="nav-flyout" aria-label={flyoutSection.label}>
          {renderFlyoutBody(flyoutSection)}
        </aside>
      ) : null}
      {showOverlayFlyout && flyoutSection ? (
        <>
          <div className="flyoutBackdrop" onClick={() => setOpenSectionId(null)} />
          <aside className="flyout flyoutOverlay" id="nav-flyout" aria-label={flyoutSection.label} tabIndex={-1} ref={flyoutRef}>
            {renderFlyoutBody(flyoutSection)}
          </aside>
        </>
      ) : null}

      {/* ─── Mobile drawer (hamburger) — прежнее поведение ─── */}
      <aside className={mobileMenuOpen ? 'sidebar sidebarMobileOpen' : 'sidebar'}>
        <div className="sidebarHeader">
          <SmaBrandLogo variant="sidebar" />
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
        <header className="topbar">
          <button className="navBtn mobileMenuBtn" type="button" onClick={() => setMobileMenuOpen((value) => !value)}>
            {mobileMenuOpen ? 'Закрыть меню' : 'Меню'}
          </button>
          <div className="brand">
            <SmaBrandLogo variant="header" compact />
            <div>
              <div className="title">Сервис Менеджер</div>
              <div className="muted small">Продукт компании СМА-Тех</div>
            </div>
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

        {/* 121A: одна цепочка на всю управленческую часть, через buildManagementBreadcrumbs. */}
        <Breadcrumbs />

        <main className="contentMain" ref={contentMainRef}>
          <Outlet />
        </main>
      </div>

      {mobileMenuOpen ? <div className="mobileBackdrop" onClick={() => setMobileMenuOpen(false)} /> : null}
    </div>
  )
}
