import { Link } from 'react-router-dom'

import * as api from '../../lib/api'
import { locationCardPath } from '../../lib/equipmentCard'
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
  onDelete?: (location: api.LocationListItem) => void
  onRestore?: (location: api.LocationListItem) => void
  /**
   * SMA-LOCATION-CARD-L1-098: область списка переносится в ссылку на карточку.
   * У провайдера в linked-scope выбор клиента живёт в состоянии страницы, и без
   * него карточка запросила бы точку от имени своей компании и получила 404.
   */
  scopeCompanyId?: string
  /**
   * Провайдерский ли это контур.
   *
   * Решает, КАКИМ параметром уехать области. У провайдера scopeCompanyId —
   * это id связанного клиента, и отдавать его как «?companyId=…» нельзя:
   * Shell на каждом переходе сохраняет область, и linked-часть терялась бы
   * с первого же клика. Роль знает вызывающий, список её не выводит.
   */
  isProviderScope?: boolean
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
  onDelete,
  onRestore,
  scopeCompanyId,
  isProviderScope,
}: Props) {
  if (locations.length === 0) {
    return (
      <div className="muted">
        Локаций пока нет.
        <div className="emptyStateNote">Создайте точку слева — она станет доступна в заявках и привязках сотрудников.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {locations.map((location) => {
        const isEditing = editingLocationId === location.id
        const isDeleted = !!location.deletedAt
        /*
         * Путь строится общим билдером, и область уезжает тем параметром,
         * который контур действительно использует. Карточка точки принимает
         * оба и возвращает тот же — контур от перехода не меняется.
         */
        const cardTo = locationCardPath(
          location.id,
          isProviderScope
            ? { linkedClientCompanyId: scopeCompanyId }
            : { companyId: scopeCompanyId },
        )

        return (
          <div key={location.id} className="panel" style={{ marginBottom: 0, opacity: isDeleted ? 0.65 : 1 }}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>
                  <Link to={cardTo}>{location.name}</Link>{isDeleted ? ' · Удалена' : ''}
                </div>
                <div className="muted small" style={{ marginTop: 4 }}>
                  Номер точки: {location.platformCode || '—'}
                </div>
                <div className="muted small">Город: {location.city || '—'}</div>
                <div className="muted small">Адрес: {location.address || '—'}</div>
                <div className="muted small">Статус: {location.isActive === false ? 'Неактивна' : 'Активна'}</div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!isDeleted ? (
                  <>
                    <button className="ghost" onClick={() => onBeginEdit(location)} disabled={busy}>
                      Редактировать
                    </button>
                    {onDelete ? (
                      <button className="ghost" style={{ color: '#dc2626' }} onClick={() => onDelete(location)} disabled={busy}>
                        Удалить
                      </button>
                    ) : null}
                  </>
                ) : (
                  onRestore ? (
                    <button className="ghost" onClick={() => onRestore(location)} disabled={busy}>
                      Восстановить
                    </button>
                  ) : null
                )}
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
