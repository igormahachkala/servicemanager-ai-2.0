import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'

/**
 * SMA-LOCATION-CARD-L1-098. Карточка объекта, оболочка V1.
 *
 * Показывает ровно то, что уже отдаёт GET /locations/:id: имя, статус,
 * коды, адрес и координаты. Контактов, заметок, вложений, истории и любых
 * счётчиков здесь нет — не потому, что «пока не сделали», а потому, что
 * этот endpoint их не возвращает, и выдумывать их карточке нечем.
 *
 * Прав карточка не добавляет: доступ решает LOCATIONS_VIEW на маршруте
 * бэкенда. Страница только рисует ответ.
 */

/** Решение показать координаты. Обе величины или ничего: одна координата места не задаёт. */
export function shouldShowCoordinates(location: {
  latitude?: number | null
  longitude?: number | null
}): boolean {
  return typeof location.latitude === 'number' && typeof location.longitude === 'number'
}

export type LocationCardFailure = 'not-found' | 'error'

/**
 * Разбор отказа загрузки.
 *
 * Бэкенд отвечает одинаковым 404 «Location not found» и на несуществующий
 * объект, и на объект вне области видимости актора (locations.service.ts:
 * проверка области и проверка наличия строки бросают одно и то же
 * исключение). Различать их на клиенте нельзя и не нужно: именно это
 * равенство и скрывает существование чужих объектов. Поэтому оба случая
 * дают здесь одно состояние.
 */
export function resolveLocationCardFailure(error: unknown): LocationCardFailure {
  if (error instanceof api.ApiRequestError && error.status === 404) return 'not-found'
  return 'error'
}

export function LocationPage() {
  const params = useParams<{ id: string }>()
  const locationId = params.id || ''

  /*
   * Область берётся из адреса, а не из состояния списка: список держит выбор
   * клиента в памяти компонента, и при переходе по ссылке он бы потерялся —
   * провайдер в linked-scope получил бы 404 на собственную же точку.
   */
  const [searchParams] = useSearchParams()
  const companyId = searchParams.get('companyId') || ''

  const locationQ = useQuery({
    queryKey: ['location', locationId, companyId],
    queryFn: () => api.getLocation(locationId, companyId || undefined),
    enabled: !!locationId,
  })

  const backTo = companyId ? `/locations?companyId=${encodeURIComponent(companyId)}` : '/locations'

  if (locationQ.isLoading) {
    return (
      <div className="panel">
        <div className="muted">Загружаем объект…</div>
      </div>
    )
  }

  if (locationQ.isError) {
    const failure = resolveLocationCardFailure(locationQ.error)

    if (failure === 'not-found') {
      return (
        <div className="panel">
          <div className="muted">Объект не найден</div>
          <div style={{ marginTop: 10 }}>
            <Link to={backTo}>
              <button className="ghost">К списку точек</button>
            </Link>
          </div>
        </div>
      )
    }

    return (
      <div className="panel">
        <div className="alert">
          {(locationQ.error as any)?.message || 'Не удалось загрузить объект'}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => locationQ.refetch()}>
            Повторить
          </button>
          <Link to={backTo}>
            <button className="ghost">К списку точек</button>
          </Link>
        </div>
      </div>
    )
  }

  const location = locationQ.data

  // Пустой ответ без ошибки трактуется так же, как 404: существование не раскрывается.
  if (!location) {
    return (
      <div className="panel">
        <div className="muted">Объект не найден</div>
        <div style={{ marginTop: 10 }}>
          <Link to={backTo}>
            <button className="ghost">К списку точек</button>
          </Link>
        </div>
      </div>
    )
  }

  const isDeleted = !!location.deletedAt
  const statusLabel = isDeleted ? 'Удалена' : location.isActive === false ? 'Неактивна' : 'Активна'
  const showCoordinates = shouldShowCoordinates(location)

  return (
    <div className="managementPage">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>{location.name}</h2>
          <div className="muted small">
            Статус: {statusLabel}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to={backTo}>
            <button className="ghost">К списку точек</button>
          </Link>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Идентификация</h3>
        <div className="muted small">Номер точки: {location.platformCode || '—'}</div>
        <div className="muted small">Внешний код: {location.externalCode || '—'}</div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Адрес</h3>
        <div className="muted small">Город: {location.city || '—'}</div>
        <div className="muted small">Регион: {location.region || '—'}</div>
        <div className="muted small">Адрес: {location.address || '—'}</div>
      </div>

      {showCoordinates ? (
        <div className="panel" style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Координаты</h3>
          <div className="muted small">
            {location.latitude}, {location.longitude}
          </div>
          <div style={{ marginTop: 10 }}>
            <Link to="/map">
              <button className="ghost">Открыть карту</button>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
