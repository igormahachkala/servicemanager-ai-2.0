import { useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'
import { useWsInvalidation } from './useWsInvalidation'

function NavItem(props: { to: string; label: string; active: boolean }) {
  return (
    <Link to={props.to} style={{ textDecoration: 'none' }}>
      <button className={props.active ? 'navBtn navBtnActive' : 'navBtn'}>{props.label}</button>
    </Link>
  )
}

function roleLabel(role?: string) {
  if (!role) return '—'
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

export function Shell() {
  const nav = useNavigate()
  const loc = useLocation()

  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
  })

  useWsInvalidation()

  useEffect(() => {
    if (meQ.isError) {
      api.clearToken()
      nav('/login')
    }
  }, [meQ.isError, nav])

  function logout() {
    api.clearToken()
    nav('/login')
  }

  const path = loc.pathname
  const isBoard = path.startsWith('/board')
  const isCreate = path.startsWith('/tickets/new')
  const isEmployees = path.startsWith('/employees')
  const isSpecializations = path.startsWith('/specializations')
  const isAnalytics = path.startsWith('/analytics')
  const isSettings = path.startsWith('/settings')
  const isCompany = path.startsWith('/company')
  const isTechnician = path.startsWith('/technician')
  const isProblemCategories = path.startsWith('/problem-categories')

  return (
    <div className="appLayout">
      <aside className="sidebar">
        <div className="sidebarHeader">
          <div className="sidebarBrand">ServiceManager</div>
          <div className="sidebarSub">{api.getCompanyLabel()}</div>
        </div>

        <nav className="nav">
          <NavItem to="/board" label="Доска" active={isBoard} />
          <NavItem to="/technician" label="Кабинет техника" active={isTechnician} />
          <NavItem to="/tickets/new" label="Создать заявку" active={isCreate} />
          <NavItem to="/employees" label="Сотрудники" active={isEmployees} />
          <NavItem to="/specializations" label="Специализации" active={isSpecializations} />
          <NavItem to="/problem-categories" label="Категории" active={isProblemCategories} />
          <NavItem to="/analytics" label="Аналитика" active={isAnalytics} />
          <NavItem to="/settings" label="Настройки" active={isSettings} />
          <NavItem to="/company" label="Компания" active={isCompany} />
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
            <Link to="/board">
              <button className="ghost">Доска</button>
            </Link>
            <Link to="/technician">
              <button className="ghost">Техник</button>
            </Link>
            <Link to="/tickets/new">
              <button className="ghost">Создать</button>
            </Link>
            <Link to="/employees">
              <button className="ghost">Сотрудники</button>
            </Link>
            <Link to="/specializations">
              <button className="ghost">Специализации</button>
            </Link>
            <Link to="/problem-categories">
              <button className="ghost">Категории</button>
            </Link>
            <Link to="/analytics">
              <button className="ghost">Аналитика</button>
            </Link>
            <Link to="/settings">
              <button className="ghost">Настройки</button>
            </Link>
            <Link to="/company">
              <button className="ghost">Компания</button>
            </Link>
          </div>
        </header>

        <main className="contentMain">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
