import { useEffect, useMemo } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import { platformNavigation, tenantNavigation, type NavItem, type NavSection } from '../lib/navigation'
import { useWsInvalidation } from './useWsInvalidation'

function NavItemButton(props: { to: string; label: string; active: boolean }) {
  return (
    <Link to={props.to} style={{ textDecoration: 'none' }}>
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
  return role
}

function isActivePath(currentPath: string, targetPath: string) {
  if (targetPath === '/board') return currentPath.startsWith('/board')
  if (targetPath === '/companies') return currentPath.startsWith('/companies')
  if (targetPath === '/service-contracts') return currentPath.startsWith('/service-contracts')
  if (targetPath === '/tickets/new') return currentPath.startsWith('/tickets/new')
  if (targetPath === '/locations') return currentPath.startsWith('/locations')
  if (targetPath === '/employees') return currentPath.startsWith('/employees')
  if (targetPath === '/inspection/runs') return currentPath.startsWith('/inspection/runs')
  if (targetPath === '/inspection/templates') return currentPath.startsWith('/inspection/templates')
  if (targetPath === '/specializations') return currentPath.startsWith('/specializations')
  if (targetPath === '/analytics') return currentPath.startsWith('/analytics')
  if (targetPath === '/settings') return currentPath.startsWith('/settings')
  if (targetPath === '/company') return currentPath.startsWith('/company')
  if (targetPath === '/problem-categories') return currentPath.startsWith('/problem-categories')
  return currentPath === targetPath
}

export function Shell() {
  const nav = useNavigate()
  const loc = useLocation()
  const queryClient = useQueryClient()

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
    if (!meQ.data) return
    api.setUserRole(meQ.data.role)
    api.setCompanyLabel(meQ.data.companyName || meQ.data.email)
  }, [meQ.data])

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
      navigation.sidebar.map((section: NavSection) => ({
        ...section,
        items: section.items.map((item: NavItem) => ({
          ...item,
          active: isActivePath(loc.pathname, item.to),
        })),
      })),
    [loc.pathname, navigation.sidebar],
  )

  const topbarLinks = useMemo(
    () =>
      navigation.topbar.map((item: NavItem) => ({
        ...item,
        active: isActivePath(loc.pathname, item.to),
      })),
    [loc.pathname, navigation.topbar],
  )

  return (
    <div className="appLayout">
      <aside className="sidebar">
        <div className="sidebarHeader">
          <div className="sidebarBrand">ServiceManager</div>
          <div className="sidebarSub">{api.getCompanyLabel(meQ.data)}</div>
        </div>

        <nav className="nav" style={{ display: 'grid', gap: 18 }}>
          {sidebarSections.map((section) => (
            <NavSectionBlock key={section.id} title={section.label}>
              {section.items.map((item) => (
                <NavItemButton key={item.id} to={item.to} label={item.label} active={item.active} />
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
          <div className="brand">
            <div className="logo">SMA</div>
            <div>
              <div className="title">ServiceManager.AI</div>
              <div className="muted small">{api.getBaseUrl()}</div>
            </div>
          </div>

          <div className="actions">
            {topbarLinks.map((item) => (
              <Link key={item.id} to={item.to}>
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
    </div>
  )
}
