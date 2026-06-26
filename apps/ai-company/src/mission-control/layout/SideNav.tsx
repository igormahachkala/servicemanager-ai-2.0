import { NavLink } from 'react-router-dom'
import { useI18n } from '../../i18n'

const OPS = '/ops'

export function SideNav() {
  const { t } = useI18n()

  const nav = [
    { to: OPS, page: 'dashboard' as const, icon: '◫', end: true },
    { to: `${OPS}/canvas`, page: 'canvas' as const, icon: '◫', end: false },
    { to: `${OPS}/companies`, page: 'companies' as const, icon: '🏢', end: false },
    { to: `${OPS}/organization`, page: 'organization' as const, icon: '⬡', end: false },
    { to: `${OPS}/presence`, page: 'presence' as const, icon: '◉', end: false },
    { to: `${OPS}/workday`, page: 'workday' as const, icon: '🌅', end: false },
    { to: `${OPS}/projects`, page: 'projects' as const, icon: '◈', end: false },
    { to: `${OPS}/workspaces`, page: 'workspaces' as const, icon: '◧', end: false },
    { to: `${OPS}/knowledge`, page: 'knowledge' as const, icon: '📚', end: false },
    { to: `${OPS}/employees`, page: 'employees' as const, icon: '◎', end: false },
    { to: `${OPS}/tasks`, page: 'tasks' as const, icon: '▤', end: false },
    { to: `${OPS}/execution`, page: 'execution' as const, icon: '⚡', end: false },
    { to: `${OPS}/chats`, page: 'chats' as const, icon: '💬', end: false },
    { to: `${OPS}/sprint`, page: 'sprint' as const, icon: '🏃', end: false },
    { to: `${OPS}/collaboration`, page: 'collaboration' as const, icon: '🤝', end: false },
    { to: `${OPS}/timeline`, page: 'companyTimeline' as const, icon: '⏱', end: false },
    { to: `${OPS}/activity`, page: 'activity' as const, icon: '◉', end: false },
    { to: `${OPS}/feed`, page: 'missionFeed' as const, icon: '≡', end: false },
    { to: `${OPS}/notifications`, page: 'notifications' as const, icon: '🔔', end: false },
    { to: `${OPS}/approvals`, page: 'approvals' as const, icon: '✓', end: false },
    { to: `${OPS}/reports`, page: 'reports' as const, icon: '📋', end: false },
    { to: `${OPS}/runs`, page: 'runs' as const, icon: '▶', end: false },
    { to: `${OPS}/audit`, page: 'audit' as const, icon: '🔍', end: false },
    { to: `${OPS}/runtime`, page: 'runtimeSettings' as const, icon: '⎈', end: false },
    { to: `${OPS}/handoffs`, page: 'handoffs' as const, icon: '📦', end: false },
    { to: `${OPS}/tool-executions`, page: 'toolExecutions' as const, icon: '⇢', end: false },
    { to: `${OPS}/tools`, page: 'toolsRegistry' as const, icon: '⚙', end: false },
  ] as const

  return (
    <aside className="mcSidebar">
      <div className="mcBrand">
        <div className="mcBrandMark" aria-hidden />
        <div>
          <div className="mcBrandTitle">{t.sideNav.title}</div>
          <div className="mcBrandSub">{t.sideNav.subtitle}</div>
        </div>
      </div>

      <nav className="mcNav" aria-label={t.aria.missionControlNav}>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'mcNavLink mcNavLinkActive' : 'mcNavLink')}
          >
            <span className="mcNavIcon" aria-hidden>
              {item.icon}
            </span>
            {t.pages[item.page]}
          </NavLink>
        ))}
      </nav>

      <div className="mcSidebarFooter">
        <NavLink to="/" className="mcNavLink" style={{ marginBottom: 8 }}>
          <span className="mcNavIcon" aria-hidden>
            ⎈
          </span>
          {t.sideNav.flowWorkspace}
        </NavLink>
        <span className="mcEnvBadge">
          <span className="mcDot mcDotGreen" />
          {t.sideNav.env}
        </span>
      </div>
    </aside>
  )
}
