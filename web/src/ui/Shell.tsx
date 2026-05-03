import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import { platformNavigation, tenantNavigation, type NavItem, type NavSection } from '../lib/navigation'
import { useWsInvalidation } from './useWsInvalidation'

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

function roleLabel(role?: string) {
  if (!role) return '—'
  if (role === 'PLATFORM_ADMIN') return 'Администратор платформы'
  if (role === 'ADMIN') return 'Администратор'
  if (role === 'DISPATCHER') return 'Диспетчер'
  if (role === 'MASTER') return 'Мастер'
  if (role === 'TECHNICIAN') return 'Техник'
  if (role === 'CLIENT') return 'Клиент'
  if (role === 'TERRITORIAL_MANAGER') return 'Территориальный менеджер'
  if (role === 'NETWORK_DIRECTOR') return 'Сетевой директор'
  if (role === 'STAFF') return 'Сотрудник'
  if (role === 'ADMIN_PROVIDER') return 'Администратор (провайдер)'
  return role
}

function isActivePath(currentPath: string, targetPath: string) {
  if (targetPath === '/board') return currentPath.startsWith('/board')
  if (targetPath === '/tickets') return currentPath === '/tickets'
  if (targetPath === '/tickets/new') return currentPath.startsWith('/tickets/new')
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
  return currentPath === targetPath
}

function isNavItemVisible(item: NavItem, role?: api.Role) {
  if (role === 'PLATFORM_ADMIN') return true
  if (!role) return false

  if (role === 'CLIENT') {
    return (
      item.to === '/board' ||
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

  const nav = useNavigate()
  const loc = useLocation()
  const queryClient = useQueryClient()
  const currentScope = useMemo(
    () => ({
      linkedClientCompanyId: new URLSearchParams(loc.search).get('linkedClientCompanyId') || undefined,
      companyId: new URLSearchParams(loc.search).get('companyId') || undefined,
    }),
    [loc.search],
  )

  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
  })

  useWsInvalidation()

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
  const isPlatformAdmin = role === 'PLATFORM_ADMIN'
  const navigation = isPlatformAdmin ? platformNavigation : tenantNavigation

  const sidebarSections = useMemo(
    () =>
      navigation.sidebar
        .map((section: NavSection) => ({
          ...section,
          items: section.items
            .filter((item: NavItem) => isNavItemVisible(item, role))
            .map((item: NavItem) => ({
              ...item,
              active: isActivePath(loc.pathname, item.to),
            })),
        }))
        .filter((section) => section.items.length > 0),
    [isPlatformAdmin, loc.pathname, navigation.sidebar, role],
  )

  const topbarLinks = useMemo(
    () =>
      navigation.topbar
        .filter((item: NavItem) => isNavItemVisible(item, role))
        .map((item: NavItem) => ({
          ...item,
          active: isActivePath(loc.pathname, item.to),
        })),
    [isPlatformAdmin, loc.pathname, navigation.topbar, role],
  )

  return (
    <div className="appLayout">
      <aside className={mobileMenuOpen ? 'sidebar sidebarMobileOpen' : 'sidebar'}>
        <div className="sidebarHeader">
          <div className="sidebarBrand">ServiceManager</div>
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

        <div className="sidebarFooter">
          <div className="small" style={{ opacity: 0.75 }}>
            {meQ.data ? `${meQ.data.email} (${roleLabel(meQ.data.role)})` : '—'}
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
            <div className="logo">SMA</div>
            <div>
              <div className="title">ServiceManager.AI</div>
              <div className="muted small">{api.getBaseUrl()}</div>
            </div>
          </div>

          <div className="actions">
            {topbarLinks.map((item) => (
              <Link key={item.id} to={api.appendScopeToPath(item.to, currentScope, meQ.data)}>
                <button className={item.active ? 'navBtn navBtnActive' : 'ghost'}>{item.label}</button>
              </Link>
            ))}
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
                <div className="small">Вы вошли как ADMIN компании {impersonationMeta.companyName}</div>
              </div>
              <button type="button" className="ghost" onClick={exitImpersonation}>
                Вернуться в PLATFORM_ADMIN
              </button>
            </div>
          </div>
        ) : null}

        <main className="contentMain">
          <Outlet />
        </main>
      </div>
      {mobileMenuOpen ? <div className="mobileBackdrop" onClick={() => setMobileMenuOpen(false)} /> : null}
    </div>
  )
}
