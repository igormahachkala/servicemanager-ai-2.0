import { useMemo } from 'react'
import type { PermissionCatalogItem, PermissionMatrixEntry } from '../../lib/api'

type Props = {
  entry: PermissionMatrixEntry
  catalog: PermissionCatalogItem[]
}

/** Косметические RU-подписи. Данные (коды/категории) приходят из API;
 *  при отсутствии перевода — fallback на name/category из API. */
const CATEGORY_RU: Record<string, string> = {
  Tickets: 'Заявки',
  Locations: 'Объекты',
  Employees: 'Пользователи',
  Analytics: 'Аналитика',
  Management: 'Настройки',
}
const PERMISSION_RU: Record<string, string> = {
  TICKETS_VIEW: 'Просмотр',
  TICKETS_CREATE: 'Создание',
  TICKETS_EDIT: 'Редактирование',
  TICKETS_VIEW_AVAILABLE: 'Доступные для назначения',
  TICKETS_ASSIGN: 'Назначение исполнителей',
  TICKETS_CLAIM: 'Взять в работу',
  TICKETS_STATUS_CHANGE: 'Смена статуса',
  TICKETS_VIEW_ALL_COMPANY: 'Все заявки компании',
  LOCATIONS_VIEW: 'Просмотр',
  LOCATIONS_MANAGE: 'Управление',
  USERS_MANAGE: 'Управление',
  ANALYTICS_VIEW: 'Аналитика',
  COMPANY_SETTINGS_EDIT: 'Настройки компании',
}

const CATEGORY_ORDER = ['Tickets', 'Locations', 'Employees', 'Analytics', 'Management']

function companyTypeLabel(t: PermissionMatrixEntry['companyType']): string {
  if (t === null) return 'Любой тип'
  return t
}

export function PermissionRoleCard({ entry, catalog }: Props) {
  const granted = useMemo(() => new Set(entry.permissions), [entry.permissions])

  const groups = useMemo(() => {
    const byCat = new Map<string, PermissionCatalogItem[]>()
    for (const item of catalog) {
      if (!byCat.has(item.category)) byCat.set(item.category, [])
      byCat.get(item.category)!.push(item)
    }
    const cats = Array.from(byCat.keys()).sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a)
      const ib = CATEGORY_ORDER.indexOf(b)
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    })
    return cats.map((cat) => ({ cat, items: byCat.get(cat)! }))
  }, [catalog])

  return (
    <div className="panel uiCard" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{entry.role}</div>
        <span className="tag" style={{ marginTop: 4 }}>{companyTypeLabel(entry.companyType)}</span>
      </div>

      {groups.map(({ cat, items }) => (
        <div key={cat}>
          <div className="muted small" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 4 }}>
            {CATEGORY_RU[cat] || cat}
          </div>
          <div style={{ display: 'grid', gap: 2 }}>
            {items.map((item) => {
              const on = granted.has(item.code)
              return (
                <div key={item.code} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <span aria-hidden style={{ color: on ? '#16a34a' : '#cbd5e1', fontWeight: 800, width: 14, textAlign: 'center' }}>
                    {on ? '✓' : '✗'}
                  </span>
                  <span style={{ color: on ? '#111827' : '#9ca3af' }}>
                    {PERMISSION_RU[item.code] || item.name}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
