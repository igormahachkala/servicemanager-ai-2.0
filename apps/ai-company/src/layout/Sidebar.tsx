import { NavLink } from 'react-router-dom'
import { Navigation } from './Navigation'
import { useI18n } from '../i18n'

type SidebarProps = {
  open: boolean
  onNavigate?: () => void
}

export function Sidebar({ open, onNavigate }: SidebarProps) {
  const { t } = useI18n()

  return (
    <aside className={open ? 'acSidebar acSidebarOpen' : 'acSidebar'} aria-label={t.aria.platformNav}>
      <div className="acSidebarBrand">
        <div className="acSidebarBrandMark" aria-hidden />
        <div>
          <div className="acSidebarBrandTitle">{t.brand.title}</div>
          <div className="acSidebarBrandSub">{t.shell.platformShell}</div>
        </div>
      </div>

      <Navigation onNavigate={onNavigate} />

      <div className="acSidebarFooter">
        <NavLink to="/" className="acNavLink" onClick={onNavigate}>
          <span className="acNavIcon" aria-hidden>
            ⎈
          </span>
          {t.sideNav.flowWorkspace}
        </NavLink>
      </div>
    </aside>
  )
}
