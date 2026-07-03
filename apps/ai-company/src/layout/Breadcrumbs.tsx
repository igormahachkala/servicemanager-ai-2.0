import { Link, useLocation } from 'react-router-dom'
import { pageTitle, useI18n } from '../i18n'

function breadcrumbSegments(pathname: string, t: ReturnType<typeof useI18n>['t']) {
  if (pathname === '/ops') {
    return [{ label: t.platformNav.home, to: '/ops' }]
  }

  const parts = pathname.replace(/^\/ops\/?/, '').split('/').filter(Boolean)
  const crumbs: { label: string; to: string }[] = [{ label: t.platformNav.home, to: '/ops' }]

  let path = '/ops'
  for (let i = 0; i < parts.length; i += 1) {
    path += `/${parts[i]}`
    crumbs.push({
      label: pageTitle(path, t),
      to: path,
    })
  }

  return crumbs
}

export function Breadcrumbs() {
  const { pathname } = useLocation()
  const { t } = useI18n()
  const crumbs = breadcrumbSegments(pathname, t)

  return (
    <nav className="acBreadcrumbs" aria-label={t.shell.breadcrumbs}>
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1
        return (
          <span key={crumb.to} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {index > 0 ? <span className="acBreadcrumbSep">/</span> : null}
            {isLast ? (
              <span className="acBreadcrumbItem acBreadcrumbItemActive">{crumb.label}</span>
            ) : (
              <Link to={crumb.to} className="acBreadcrumbItem">
                {crumb.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
