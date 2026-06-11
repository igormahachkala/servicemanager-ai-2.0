import type { PermissionCatalogItem, PermissionMatrixEntry } from '../../lib/api'
import { entryKey, type DraftMap } from './permissionDraft'
import { PermissionRoleCard } from './PermissionRoleCard'

type Props = {
  entries: PermissionMatrixEntry[]
  catalog: PermissionCatalogItem[]
  editMode: boolean
  draft: DraftMap
  originalMap: DraftMap
  onToggle: (role: string, companyType: 'CLIENT' | 'PROVIDER' | null, code: string) => void
}

/** Адаптивная сетка карточек ролей. На узких экранах — одна колонка. */
export function PermissionMatrix({ entries, catalog, editMode, draft, originalMap, onToggle }: Props) {
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
      {entries.map((entry) => {
        const k = entryKey(entry.role, entry.companyType)
        const original = originalMap[k] || entry.permissions
        const current = editMode ? (draft[k] ?? original) : original
        return (
          <PermissionRoleCard
            key={k}
            entry={entry}
            catalog={catalog}
            editMode={editMode}
            currentCodes={current}
            originalCodes={original}
            onToggle={onToggle}
          />
        )
      })}
    </div>
  )
}
