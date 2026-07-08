import { useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  OWNER_NAV_PRIMARY_GROUPS,
  groupOwnerNavItems,
  type OwnerNavGroupId,
  type OwnerNavItemConfig,
} from '../navigation/ownerNavConfig'
import { ownerNavItemHint } from '../navigation/ownerNavPath'
import { useI18n } from '../i18n'

type Props = {
  onNavigate?: () => void
  className?: string
  linkClassName?: string
  activeLinkClassName?: string
}

function NavItemLink(props: {
  item: OwnerNavItemConfig
  onNavigate?: () => void
  linkClassName: string
  activeLinkClassName: string
}) {
  const { t } = useI18n()
  const copy = t.ownerNav.items[props.item.id]

  return (
    <NavLink
      to={props.item.to}
      end={props.item.end}
      title={ownerNavItemHint(props.item.id, t)}
      onClick={props.onNavigate}
      className={({ isActive }) =>
        isActive ? `${props.linkClassName} ${props.activeLinkClassName}` : props.linkClassName
      }
    >
      <span className="acNavIcon" aria-hidden>
        {props.item.icon}
      </span>
      <span className="acOwnerNavItemBody">
        <span className="acOwnerNavItemLabel">{copy.label}</span>
        <span className="acOwnerNavItemWhy">{copy.why}</span>
      </span>
    </NavLink>
  )
}

function NavGroupSection(props: {
  groupId: OwnerNavGroupId
  items: OwnerNavItemConfig[]
  onNavigate?: () => void
  linkClassName: string
  activeLinkClassName: string
}) {
  const { t } = useI18n()
  const group = t.ownerNav.groups[props.groupId]
  if (props.items.length === 0) return null

  return (
    <section className="acOwnerNavGroup" aria-label={group.title}>
      <header className="acOwnerNavGroupHeader">
        <div className="acOwnerNavGroupTitle">{group.title}</div>
        <div className="acOwnerNavGroupHint">{group.hint}</div>
      </header>
      <div className="acOwnerNavGroupItems">
        {props.items.map((item) => (
          <NavItemLink
            key={item.id}
            item={item}
            onNavigate={props.onNavigate}
            linkClassName={props.linkClassName}
            activeLinkClassName={props.activeLinkClassName}
          />
        ))}
      </div>
    </section>
  )
}

export function OwnerNavigation({
  onNavigate,
  className = 'acNav',
  linkClassName = 'acNavLink',
  activeLinkClassName = 'acNavLinkActive',
}: Props) {
  const { t } = useI18n()
  const location = useLocation()
  const grouped = useMemo(() => groupOwnerNavItems(), [])
  const technicalActive = resolveTechnicalActive(location.pathname, grouped.get('technical') ?? [])
  const [technicalOpen, setTechnicalOpen] = useState(technicalActive)

  return (
    <nav className={className} aria-label={t.ownerNav.ariaLabel}>
      {OWNER_NAV_PRIMARY_GROUPS.map((groupId) => (
        <NavGroupSection
          key={groupId}
          groupId={groupId}
          items={grouped.get(groupId) ?? []}
          onNavigate={onNavigate}
          linkClassName={linkClassName}
          activeLinkClassName={activeLinkClassName}
        />
      ))}

      <section className="acOwnerNavGroup acOwnerNavGroupTechnical" aria-label={t.ownerNav.groups.technical.title}>
        <button
          type="button"
          className="acOwnerNavTechnicalToggle"
          aria-expanded={technicalOpen}
          onClick={() => setTechnicalOpen((value) => !value)}
        >
          <span className="acOwnerNavGroupTitle">{t.ownerNav.groups.technical.title}</span>
          <span className="acOwnerNavTechnicalToggleHint">
            {technicalOpen ? t.ownerNav.toggleTechnicalHide : t.ownerNav.toggleTechnicalShow}
          </span>
        </button>
        {technicalOpen ? (
          <>
            <p className="acOwnerNavGroupHint">{t.ownerNav.groups.technical.hint}</p>
            <div className="acOwnerNavGroupItems">
              {(grouped.get('technical') ?? []).map((item) => (
                <NavItemLink
                  key={item.id}
                  item={item}
                  onNavigate={onNavigate}
                  linkClassName={linkClassName}
                  activeLinkClassName={activeLinkClassName}
                />
              ))}
            </div>
          </>
        ) : null}
      </section>
    </nav>
  )
}

function resolveTechnicalActive(pathname: string, items: OwnerNavItemConfig[]): boolean {
  const path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname
  return items.some(
    (item) => path === item.to || (path.startsWith(`${item.to}/`) && !item.end),
  )
}
