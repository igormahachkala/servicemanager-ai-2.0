import type { PermissionCatalogItem, PermissionMatrixEntry } from '../../lib/api'
import { PermissionRoleCard } from './PermissionRoleCard'

type Props = {
  entries: PermissionMatrixEntry[]
  catalog: PermissionCatalogItem[]
}

/** Адаптивная сетка карточек ролей (read-only). На узких экранах — одна колонка. */
export function PermissionMatrix({ entries, catalog }: Props) {
  if (entries.length === 0) {
    return <div className="panel"><div className="muted small">Нет ролей по выбранным фильтрам.</div></div>
  }
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 12,
        alignItems: 'start',
      }}
    >
      {entries.map((entry) => (
        <PermissionRoleCard key={`${entry.role}:${entry.companyType ?? 'ANY'}`} entry={entry} catalog={catalog} />
      ))}
    </div>
  )
}
