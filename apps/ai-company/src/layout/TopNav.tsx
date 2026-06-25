import { NavLink } from 'react-router-dom'
import { WorkspaceSelector } from '../components/workspaces/WorkspaceSelector'
import { useI18n } from '../i18n'
import { LanguageToggle } from './LanguageToggle'

const NAV = [
  { to: '/', key: 'flow' as const, end: true },
  { to: '/ops', key: 'missionControl' as const, end: true },
  { to: '/ops/organization', key: 'organization' as const, end: false },
  { to: '/ops/workspaces', key: 'workspaces' as const, end: false },
  { to: '/ops/employees', key: 'employees' as const, end: false },
  { to: '/ops/tasks', key: 'tasks' as const, end: false },
  { to: '/ops/chats', key: 'chats' as const, end: false },
  { to: '/ops/feed', key: 'feed' as const, end: false },
  { to: '/ops/reports', key: 'reports' as const, end: false },
  { to: '/ops/audit', key: 'audit' as const, end: false },
  { to: '/ops/tools', key: 'tools' as const, end: false },
] as const

export function TopNav() {
  const { t } = useI18n()

  return (
    <header className="acTopNav" aria-label={t.aria.topNav}>
      <div className="acBrand">
        <div className="acBrandMark" aria-hidden />
        <div>
          <div className="acBrandTitle">{t.brand.title}</div>
          <div className="acBrandSub">{t.brand.subtitle}</div>
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
            {t.nav[item.key]}
          </NavLink>
        ))}
      </nav>

      <WorkspaceSelector />
      <div className="acNavSpacer" />
      <LanguageToggle />
      <span className="acEnvPill">{t.brand.env}</span>
    </header>
  )
}
