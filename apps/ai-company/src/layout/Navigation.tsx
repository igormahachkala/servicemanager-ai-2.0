import { NavLink } from 'react-router-dom'
import { useI18n } from '../i18n'

const OPS = '/ops'

const NAV_ITEMS = [
  { to: OPS, key: 'home' as const, icon: '🏠', end: true },
  { to: `${OPS}/canvas`, key: 'canvas' as const, icon: '🗺', end: false },
  { to: `${OPS}/chats`, key: 'chats' as const, icon: '💬', end: false },
  { to: `${OPS}/employees`, key: 'employees' as const, icon: '👥', end: false },
  { to: `${OPS}/presence`, key: 'presence' as const, icon: '🟢', end: false },
  { to: `${OPS}/projects`, key: 'projects' as const, icon: '🚀', end: false },
  { to: `${OPS}/workspaces`, key: 'workspaces' as const, icon: '🏢', end: false },
  { to: `${OPS}/knowledge`, key: 'knowledge' as const, icon: '📚', end: false },
  { to: `${OPS}/tasks`, key: 'tasks' as const, icon: '📋', end: false },
  { to: `${OPS}/tools`, key: 'tools' as const, icon: '🛠', end: false },
  { to: `${OPS}/reports`, key: 'reports' as const, icon: '📊', end: false },
  { to: `${OPS}/timeline`, key: 'timeline' as const, icon: '🕒', end: false },
  { to: `${OPS}/approvals`, key: 'approvals' as const, icon: '✅', end: false },
  { to: `${OPS}/runtime`, key: 'settings' as const, icon: '⚙', end: false },
] as const

export function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n()

  return (
    <nav className="acNav" aria-label={t.aria.platformNav}>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) => (isActive ? 'acNavLink acNavLinkActive' : 'acNavLink')}
        >
          <span className="acNavIcon" aria-hidden>
            {item.icon}
          </span>
          {t.platformNav[item.key]}
        </NavLink>
      ))}
    </nav>
  )
}
