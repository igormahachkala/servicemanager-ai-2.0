import { NavLink } from 'react-router-dom'
import { OwnerNavigation } from '../../layout/OwnerNavigation'
import { useI18n } from '../../i18n'

export function SideNav() {
  const { t } = useI18n()

  return (
    <aside className="mcSidebar">
      <div className="mcBrand">
        <div className="mcBrandMark" aria-hidden />
        <div>
          <div className="mcBrandTitle">{t.sideNav.title}</div>
          <div className="mcBrandSub">{t.ownerNav.brandSub}</div>
        </div>
      </div>

      <OwnerNavigation
        className="mcNav acOwnerNav"
        linkClassName="mcNavLink acOwnerNavLink"
        activeLinkClassName="mcNavLinkActive"
      />

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
