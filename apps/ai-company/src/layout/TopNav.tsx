import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/', label: 'Flow', end: true },
  { to: '/ops', label: 'Mission Control', end: true },
  { to: '/ops/organization', label: 'Organization', end: false },
  { to: '/ops/employees', label: 'Employees', end: false },
  { to: '/ops/tasks', label: 'Tasks', end: false },
  { to: '/ops/feed', label: 'Feed', end: false },
  { to: '/ops/tools', label: 'Tools', end: false },
] as const

export function TopNav() {
  return (
    <header className="acTopNav" aria-label="AI Company">
      <div className="acBrand">
        <div className="acBrandMark" aria-hidden />
        <div>
          <div className="acBrandTitle">AI Company</div>
          <div className="acBrandSub">local V1</div>
        </div>
      </div>

      <nav style={{ display: 'flex', alignItems: 'center', gap: 2, overflowX: 'auto', minWidth: 0 }}>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'acNavLink acNavLinkActive' : 'acNavLink')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="acNavSpacer" />
      <span className="acEnvPill">mock · localhost</span>
    </header>
  )
}
