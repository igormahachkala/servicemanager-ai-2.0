import * as api from '../../lib/api'
import { LocationForm, type LocationFormValue } from './LocationForm'

type Props = {
  locations: api.LocationListItem[]
  editingLocationId: string | null
  editingValue: LocationFormValue
  busy?: boolean
  onBeginEdit: (location: api.LocationListItem) => void
  onCancelEdit: () => void
  onEditChange: (patch: Partial<LocationFormValue>) => void
  onSubmitEdit: (event: React.FormEvent) => void
}

export function LocationList({
  locations,
  editingLocationId,
  editingValue,
  busy,
  onBeginEdit,
  onCancelEdit,
  onEditChange,
  onSubmitEdit,
}: Props) {
  if (locations.length === 0) {
    return <div className="muted">Локаций пока нет.</div>
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {locations.map((location) => {
        const isEditing = editingLocationId === location.id

        return (
          <div key={location.id} className="panel" style={{ marginBottom: 0 }}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{location.name}</div>
                <div className="muted small" style={{ marginTop: 4 }}>
                  Номер точки: {location.platformCode || '—'}
                </div>
                <div className="muted small">Город: {location.city || '—'}</div>
                <div className="muted small">Адрес: {location.address || '—'}</div>
                <div className="muted small">Статус: {location.isActive === false ? 'Неактивна' : 'Активна'}</div>
              </div>

              <div>
                <button className="ghost" onClick={() => onBeginEdit(location)} disabled={busy}>
                  Редактировать
                </button>
              </div>
            </div>

            {isEditing ? (
              <div style={{ marginTop: 14 }}>
                <LocationForm
                  title={`Редактировать: ${location.name}`}
                  submitLabel="Сохранить"
                  value={editingValue}
                  submitting={busy}
                  onChange={onEditChange}
                  onSubmit={onSubmitEdit}
                  onCancel={onCancelEdit}
                />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
