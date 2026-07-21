import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import {
  canAccessMobileApp,
  mobileAppNavItem,
  platformNavigation,
  tenantNavigation,
  type NavItem,
  type NavSection,
} from '../lib/navigation'
import { getRoleDisplayLabel } from '../lib/resolveAdminProfile'
import { SmaBrandLogo } from '../components/SmaBrandLogo'
import { canViewITCompany } from '../it-company'
import { useWsInvalidation } from './useWsInvalidation'
import { useRealtimeNotifications } from '../hooks/useRealtimeNotifications'

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
        style={{
          opacity: 0.72,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 700,
          padding: '0 4px',
        }}
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
  if (targetPath === '/tickets') return currentPath === '/tickets' || currentPath.startsWith('/tickets/')
  if (targetPath === '/tickets/new') return currentPath.startsWith('/tickets/new')
  if (targetPath === '/objects') return currentPath.startsWith('/objects') || currentPath.startsWith('/locations')
  if (targetPath === '/equipment') return currentPath.startsWith('/equipment')
  if (targetPath === '/users') return currentPath.startsWith('/users') || currentPath.startsWith('/employees')
  if (targetPath === '/contractors') {
    return currentPath.startsWith('/contractors') || currentPath.startsWith('/service-contracts')
  }
  if (targetPath === '/acts') return currentPath.startsWith('/acts')
  if (targetPath === '/permissions') {
    return currentPath.startsWith('/permissions') || currentPath.startsWith('/platform/permissions')
  }
  if (targetPath === '/access-constructor') {
    return currentPath.startsWith('/access-constructor') || currentPath.startsWith('/platform/access-constructor')
  }
  if (targetPath === '/assistant') return currentPath.startsWith('/assistant')
  if (targetPath === '/companies') return currentPath.startsWith('/companies')
  if (targetPath === '/service-contracts') return currentPath.startsWith('/service-contracts')
  if (targetPath === '/locations') return currentPath.startsWith('/locations')
  if (targetPath === '/employees') return currentPath.startsWith('/employees')
  if (targetPath === '/inspection/runs') return currentPath.startsWith('/inspection/runs')
  if (targetPath === '/inspection/templates') return currentPath.startsWith('/inspection/templates')
  if (targetPath === '/map') return currentPath.startsWith('/map')
  if (targetPath === '/specializations') return currentPath.startsWith('/specializations')
  if (targetPath === '/analytics') return currentPath.startsWith('/analytics')
  if (targetPath === '/settings') return currentPath.startsWith('/settings')
  if (targetPath === '/company') return currentPath.startsWith('/company')
  if (targetPath === '/problem-categories') return currentPath.startsWith('/problem-categories')
  if (targetPath === '/it') return currentPath === '/it' || currentPath.startsWith('/it/')
  return currentPath === targetPath
}

function isNavItemVisible(item: NavItem, role?: api.Role, canAccessEngineeringAgent?: boolean) {
  // Owner-only hidden module: gated purely by the server-computed flag,
  // independent of role (an owner email may have a non-platform role).
  if (item.to === '/agents/engineering') return !!canAccessEngineeringAgent

  // IT Company — доступ через it-company/access (строго PLATFORM_ADMIN). Проверяем
  // до общего short-circuit ниже, т.к. для прочих ролей ветка по умолчанию → true.
  if (item.to === '/it' || item.to.startsWith('/it/')) return canViewITCompany({ role })

  if (role === 'PLATFORM_ADMIN') return true
  if (!role) return false

  if (role === 'CLIENT') {
    return (
      item.to === '/board' ||
      item.to === '/archive' ||
      item.to === '/tickets' ||
      item.to === '/tickets/new' ||
      item.to === '/company' ||
      item.to === '/settings'
    )
  }

  const fullAdmin = api.isFullAdminDesktopNavRole(role)

  if (item.to === '/employees' || item.to === '/locations' || item.to === '/problem-categories' || item.to === '/specializations') {
    return fullAdmin
  }
  if (item.to === '/access-constructor') {
    return fullAdmin
  }

  if (item.to === '/inspection/templates') {
    return role === 'ADMIN' || role === 'DISPATCHER' || role === 'MASTER' || role === 'NETWORK_DIRECTOR'
  }
  if (item.to === '/inspection/runs') {
    return role !== 'STAFF'
  }
  if (item.to === '/analytics' || item.to === '/map') {
    return role !== 'STAFF'
  }
  if (item.to === '/company') {
    return role !== 'TECHNICIAN' && role !== 'STAFF'
  }
  if (item.to === '/tickets/new') {
    return role !== 'STAFF'
  }
  if (item.to === '/settings') {
    return role !== 'TECHNICIAN' && role !== 'STAFF'
  }
  return true
}

export function Shell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const contentMainRef = useRef<HTMLElement | null>(null)

  const nav = useNavigate()
  const loc = useLocation()
  const queryClient = useQueryClient()

  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
  })

  const tenantCompanyQ = useQuery({
    queryKey: ['company-own-context'],
    queryFn: () => api.company(),
    enabled: !!meQ.data && meQ.data.role !== 'PLATFORM_ADMIN',
  })

  const currentScope = useMemo(() => {
    const params = new URLSearchParams(loc.search)
    const linked = (params.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
    const company = (params.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
    return {
      linkedClientCompanyId: linked || undefined,
      companyId: company || undefined,
    }
  }, [loc.search, meQ.data])

  const onNotification = useRealtimeNotifications('/tickets/')
  useWsInvalidation(currentScope, { onNotification })

  const impersonationMeta = useMemo(() => api.getImpersonationMeta(), [meQ.data?.id, loc.key])
  const isImpersonating = api.isImpersonating() && !!impersonationMeta

  useEffect(() => {
    if (meQ.isError) {
      api.clearToken()
      queryClient.clear()
      nav('/login', { replace: true })
    }
  }, [meQ.isError, nav, queryClient])

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

  function hardRedirect(path: string) {
    if (typeof window !== 'undefined') {
      window.location.replace(path)
      return
    }
    nav(path, { replace: true })
  }

  function logout() {
    api.clearToken()
    queryClient.clear()
    hardRedirect('/login')
  }

  function exitImpersonation() {
    const restored = api.exitImpersonationSession()
    queryClient.clear()
    hardRedirect(restored ? '/companies' : '/login')
  }

  const role = meQ.data?.role
  const tenantCompanyType = tenantCompanyQ.data?.type
  const roleDisplayLabel = meQ.data
    ? getRoleDisplayLabel({ role: meQ.data.role, companyType: tenantCompanyType })
    : '—'
  const canAccessEngineeringAgent = !!meQ.data?.canAccessEngineeringAgent
  const isPlatformAdmin = role === 'PLATFORM_ADMIN'
  const navigation = isPlatformAdmin ? platformNavigation : tenantNavigation

  const sidebarSections = useMemo(
    () =>
      navigation.sidebar
        .map((section: NavSection) => ({
          ...section,
          items: section.items
            .filter((item: NavItem) => isNavItemVisible(item, role, canAccessEngineeringAgent))
            .map((item: NavItem) => ({
              ...item,
              active: isActivePath(loc.pathname, item.to),
            })),
        }))
        .filter((section) => section.items.length > 0),
    [isPlatformAdmin, loc.pathname, navigation.sidebar, role, canAccessEngineeringAgent],
  )

  const topbarLinks = useMemo(
    () =>
      navigation.topbar
        .filter((item: NavItem) => isNavItemVisible(item, role, canAccessEngineeringAgent))
        .map((item: NavItem) => ({
          ...item,
          active: isActivePath(loc.pathname, item.to),
        })),
    [isPlatformAdmin, loc.pathname, navigation.topbar, role, canAccessEngineeringAgent],
  )

  return (
    <div className="appLayout">
      <aside className={mobileMenuOpen ? 'sidebar sidebarMobileOpen' : 'sidebar'}>
        <div className="sidebarHeader">
          <SmaBrandLogo variant="sidebar" />
          <div className="sidebarSub">{api.getCompanyLabel(meQ.data)}</div>
        </div>

        <nav className="nav" style={{ display: 'grid', gap: 18 }}>
          {sidebarSections.map((section) => (
            <NavSectionBlock key={section.id} title={section.label}>
              {section.items.map((item) => (
                <NavItemButton
                  key={item.id}
                  to={api.appendScopeToPath(item.to, currentScope, meQ.data)}
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
              to={api.appendScopeToPath(mobileAppNavItem.to, currentScope, meQ.data)}
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
          <button className="navBtn" onClick={logout} style={{ marginTop: 10 }}>
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
              <div className="title">ServiceManager.AI</div>
              <div className="muted small">Технологии для сервиса</div>
            </div>
          </div>

          <div className="actions">
            {topbarLinks.map((item) => (
              <Link key={item.id} to={api.appendScopeToPath(item.to, currentScope, meQ.data)}>
                <button className={item.active ? 'navBtn navBtnActive' : 'ghost'}>{item.label}</button>
              </Link>
            ))}
            {canAccessMobileApp(role) ? (
              <Link to={api.appendScopeToPath(mobileAppNavItem.to, currentScope, meQ.data)}>
                <button className={loc.pathname.startsWith('/m') || loc.pathname.startsWith('/max') ? 'navBtn navBtnActive' : 'ghost'}>
                  {mobileAppNavItem.label}
                </button>
              </Link>
            ) : null}
          </div>
        </header>

        {isImpersonating && impersonationMeta ? (
          <div
            className="panel"
            style={{
              margin: '12px 24px 0',
              border: '1px solid #f59e0b',
              background: '#fff7ed',
              color: '#7c2d12',
            }}
          >
            <div className="row" style={{ alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Режим impersonation</div>
                <div className="small">
                  Вы вошли как {roleDisplayLabel} компании {impersonationMeta.companyName}
                </div>
              </div>
              <button type="button" className="ghost" onClick={exitImpersonation}>
                Вернуться в PLATFORM_ADMIN
              </button>
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
