import { NavLink } from 'react-router-dom'

const OPS = '/ops'

const NAV = [
  { to: OPS, label: 'Dashboard', icon: '◫', end: true },
  { to: `${OPS}/organization`, label: 'Organization', icon: '⬡', end: false },
  { to: `${OPS}/employees`, label: 'Employees', icon: '◎', end: false },
  { to: `${OPS}/tasks`, label: 'Tasks', icon: '▤', end: false },
  { to: `${OPS}/feed`, label: 'Mission Feed', icon: '≡', end: false },
  { to: `${OPS}/tools`, label: 'AI Tools Registry', icon: '⚙', end: false },
] as const

export function SideNav() {
  return (
    <aside className="mcSidebar">
      <div className="mcBrand">
        <div className="mcBrandMark" aria-hidden />
        <div>
          <div className="mcBrandTitle">Mission Control</div>
          <div className="mcBrandSub">AI Company · NOC</div>
        </div>
      </div>

      <nav className="mcNav" aria-label="Mission Control">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'mcNavLink mcNavLinkActive' : 'mcNavLink')}
          >
            <span className="mcNavIcon" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mcSidebarFooter">
        <NavLink to="/" className="mcNavLink" style={{ marginBottom: 8 }}>
          <span className="mcNavIcon" aria-hidden>
            ⎈
          </span>
          Flow Workspace
        </NavLink>
        <span className="mcEnvBadge">
          <span className="mcDot mcDotGreen" />
          local / mock
        </span>
      </div>
    </aside>
  )
}

export const PAGE_TITLES: Record<string, string> = {
  [OPS]: 'Dashboard',
  [`${OPS}/organization`]: 'Organization',
  [`${OPS}/employees`]: 'Employees',
  [`${OPS}/tasks`]: 'Tasks',
  [`${OPS}/feed`]: 'Mission Feed',
  [`${OPS}/tools`]: 'AI Tools Registry',
}
