import { useEffect, useMemo } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'
import './mobile.css'

type MobileNavItem = {
  id: string
  label: string
  to: string
}

const mobileNavItems: MobileNavItem[] = [
  { id: 'home', label: 'Главная', to: '/m' },
  { id: 'create', label: 'Создать', to: '/m/create' },
  { id: 'my', label: 'Мои', to: '/m/my' },
  { id: 'profile', label: 'Профиль', to: '/m/profile' },
]

function isActivePath(pathname: string, target: string) {
  if (target === '/m') return pathname === '/m'
  return pathname.startsWith(target)
}

export function MobileShell() {
  const location = useLocation()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const scope = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const linked = (params.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
    const company = (params.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
    return {
      linkedClientCompanyId: linked || undefined,
      companyId: company || undefined,
    }
  }, [location.search, meQ.data])

  useEffect(() => {
    if (!meQ.data) return
    api.persistScopeFromSearchParams(new URLSearchParams(location.search), meQ.data)
  }, [location.search, meQ.data])

  return (
    <div className="mobileShell">
      <main className="mobilePage">
        <Outlet />
      </main>
      <nav className="mobileBottomNav" aria-label="Мобильная навигация">
        <div className="mobileBottomNavInner">
          {mobileNavItems.map((item) => {
            const active = isActivePath(location.pathname, item.to)
            return (
              <Link
                key={item.id}
                className="mobileNavItem"
                to={api.appendScopeToPath(item.to, scope, meQ.data)}
                aria-current={active ? 'page' : undefined}
              >
                <button type="button" className={active ? 'mobileNavButton mobileNavButtonActive' : 'mobileNavButton'}>
                  {item.label}
                </button>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
