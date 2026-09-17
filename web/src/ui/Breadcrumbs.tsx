import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { buildManagementBreadcrumbs, type BuildBreadcrumbsOptions } from '../lib/managementRouteMeta'

/**
 * SMA-MANAGEMENT-IA-BREADCRUMBS-121A.
 *
 * Одна цепочка на всю управленческую часть. Встраивается в общий Shell,
 * а не в каждую страницу: собранные по отдельности крошки разошлись бы
 * между разделами, и «где я» перестало бы быть одним ответом.
 *
 * Решения о видимости здесь нет. Компонент рисует то, что вернул чистый
 * построитель, а тот о ролях не знает вовсе.
 */
export function Breadcrumbs({ entityLabels }: { entityLabels?: BuildBreadcrumbsOptions['entityLabels'] }) {
  const location = useLocation()

  const crumbs = useMemo(
    () =>
      buildManagementBreadcrumbs(location.pathname, {
        entityLabels,
        search: location.search,
        hash: location.hash,
      }),
    [location.pathname, location.search, location.hash, entityLabels],
  )

  // Неописанный маршрут не рисует ничего — страница при этом работает.
  if (crumbs.length < 2) return null

  return (
    <nav className="breadcrumbs" aria-label="Путь по разделам">
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1
        return (
          <span key={`${crumb.label}-${index}`} className="breadcrumbsItem">
            {crumb.to ? (
              <Link to={crumb.to} className="breadcrumbsLink">
                {crumb.label}
              </Link>
            ) : (
              <span className={last ? 'breadcrumbsCurrent' : 'breadcrumbsSection'} aria-current={last ? 'page' : undefined}>
                {crumb.label}
              </span>
            )}
            {last ? null : (
              <span className="breadcrumbsSeparator" aria-hidden>
                /
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
