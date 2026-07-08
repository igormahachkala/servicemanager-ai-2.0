import { NavLink, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { MOBILE_NAV_ITEMS, resolveMobileNavId, type MobileNavId } from './mobileNavigationConfig'

function NavIcon({ id }: { id: MobileNavId }) {
  switch (id) {
    case 'today':
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="acMobileNavIconSvg">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
          <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      )
    case 'employees':
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="acMobileNavIconSvg">
          <circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
          <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="17" cy="9" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
        </svg>
      )
    case 'tasks':
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="acMobileNavIconSvg">
          <rect x="4" y="5" width="16" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.75" />
          <path d="M8 10h8M8 14h5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      )
    case 'decisions':
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="acMobileNavIconSvg">
          <path d="M5 12l4 4 10-10" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'more':
      return (
        <svg viewBox="0 0 24 24" aria-hidden className="acMobileNavIconSvg">
          <circle cx="6" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="18" cy="12" r="1.5" fill="currentColor" />
        </svg>
      )
  }
}

export function MobileBottomNavigation() {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const activeId = resolveMobileNavId(pathname)

  return (
    <nav className="acMobileBottomNav" aria-label={t.mobile.nav.ariaLabel}>
      <ul className="acMobileBottomNavList">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = activeId === item.id
          const label = t.mobile.nav[item.labelKey]
          return (
            <li key={item.id} className="acMobileBottomNavItem">
              <NavLink
                to={item.to}
                className={active ? 'acMobileBottomNavLink acMobileBottomNavLinkActive' : 'acMobileBottomNavLink'}
                aria-current={active ? 'page' : undefined}
              >
                <span className="acMobileBottomNavIcon">
                  <NavIcon id={item.id} />
                </span>
                <span className="acMobileBottomNavLabel">{label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
