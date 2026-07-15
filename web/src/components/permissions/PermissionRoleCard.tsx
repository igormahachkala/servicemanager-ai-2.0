import { useMemo } from 'react'
import type { PermissionCatalogItem, PermissionMatrixEntry } from '../../lib/api'

type Props = {
  entry: PermissionMatrixEntry
  catalog: PermissionCatalogItem[]
  editMode: boolean
  currentCodes: string[]
  originalCodes: string[]
  onToggle: (role: string, companyType: 'CLIENT' | 'PROVIDER' | null, code: string) => void
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

function permLabel(code: string, fallback: string): string {
  return PERMISSION_RU[code] || fallback
}

export function PermissionRoleCard({ entry, catalog, editMode, currentCodes, originalCodes, onToggle }: Props) {
  const current = useMemo(() => new Set(currentCodes), [currentCodes])
  const original = useMemo(() => new Set(originalCodes), [originalCodes])

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

  const nameByCode = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of catalog) m[c.code] = c.name
    return m
  }, [catalog])

  const added = useMemo(() => [...current].filter((c) => !original.has(c)).sort(), [current, original])
  const removed = useMemo(() => [...original].filter((c) => !current.has(c)).sort(), [current, original])
  const changed = added.length > 0 || removed.length > 0

  return (
    <div className="panel uiCard" style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, borderColor: changed ? '#fcd34d' : undefined }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{entry.role}</div>
        <span className="tag" style={{ marginTop: 4 }}>{companyTypeLabel(entry.companyType)}</span>
      </div>

      {editMode && changed ? (
        <div className="small" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '6px 8px' }}>
          {added.map((c) => (
            <div key={`a-${c}`} style={{ color: '#15803d' }}>+ {permLabel(c, nameByCode[c] || c)}</div>
          ))}
          {removed.map((c) => (
            <div key={`r-${c}`} style={{ color: '#b91c1c' }}>− {permLabel(c, nameByCode[c] || c)}</div>
          ))}
        </div>
      ) : null}

      {groups.map(({ cat, items }) => (
        <div key={cat}>
          <div className="muted small" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: 4 }}>
            {CATEGORY_RU[cat] || cat}
          </div>
          <div style={{ display: 'grid', gap: editMode ? 4 : 2 }}>
            {items.map((item) => {
              const on = current.has(item.code)
              const label = permLabel(item.code, item.name)
              if (!editMode) {
                return (
                  <div key={item.code} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                    <span aria-hidden style={{ color: on ? '#16a34a' : '#cbd5e1', fontWeight: 800, width: 14, textAlign: 'center' }}>
                      {on ? '✓' : '✗'}
                    </span>
                    <span style={{ color: on ? '#111827' : '#9ca3af' }}>{label}</span>
                  </div>
                )
              }
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => onToggle(entry.role, entry.companyType, item.code)}
                  aria-pressed={on}
                  title={item.code}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    textAlign: 'left',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '6px 8px',
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      color: on ? '#15803d' : '#6b7280',
                      background: on ? '#dcfce7' : '#f1f5f9',
                      border: `1px solid ${on ? '#86efac' : '#e5e7eb'}`,
                      borderRadius: 999,
                      padding: '2px 8px',
                      minWidth: 38,
                      textAlign: 'center',
                    }}
                  >
                    {on ? 'ON' : 'OFF'}
                  </span>
                  <span style={{ color: '#111827' }}>{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
