import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'
import { equipmentCardPath, equipmentStatusLabel, locationsListPath } from '../lib/equipmentCard'
import { appendBoardNavigationContextToPath } from '../lib/boardNavigationContext'
import { isManagementNavItemVisible } from '../lib/navigation'
import { locationSectionLinks } from '../lib/locationCardSections'
import {
  pluralizeRu,
  summarizeEquipment,
  summarizeSchedules,
  summarizeTickets,
} from './locationAggregates'

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

function fmtDateTime(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return value
  }
}

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
  /*
   * Область принимается любым из двух параметров.
   *
   * Значение здесь и так контур-независимо: ниже оно уходит в
   * analyticsLocations и как companyId, и как linkedClientCompanyId, а
   * getLocation документирует, что у провайдера это id клиента. Читать при
   * этом только companyId значило заставлять ссылки присылать именно его —
   * а Shell на каждом переходе перезаписывает сохранённую пару целиком, и
   * «?companyId=…» затирал провайдеру linkedClientCompanyId: следующее
   * создание заявки упиралось в скрытую форму.
   */
  const scopeFromCompanyId = (searchParams.get('companyId') || '').trim()
  const scopeFromLinkedClient = (searchParams.get('linkedClientCompanyId') || '').trim()
  const companyId = scopeFromCompanyId || scopeFromLinkedClient

  /*
   * Исходящие ссылки возвращают область ТЕМ ЖЕ параметром, которым она
   * пришла.
   *
   * Инвариант простой: переход не меняет контур. Своей области страница не
   * выводит, поэтому «угадывать» параметр не нужно и нельзя: Shell на
   * каждом переходе перезаписывает сохранённую пару целиком, и отдать
   * провайдеру «?companyId=…» значило затереть ему linkedClientCompanyId —
   * контур сменился бы от одного клика по ссылке.
   */
  const outboundScope = scopeFromCompanyId
    ? { companyId: scopeFromCompanyId }
    : { linkedClientCompanyId: scopeFromLinkedClient }

  /* Роль нужна только для видимости раздела аналитики — тем же гейтом, что меню. */
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const locationQ = useQuery({
    queryKey: ['location', locationId, companyId],
    queryFn: () => api.getLocation(locationId, companyId || undefined),
    enabled: !!locationId,
  })

  /**
   * Сводки. Каждая — отдельный существующий авторизованный endpoint, и каждая
   * обязательно с locationId: запрос без него вернул бы весь тенант, а это ровно
   * та выборка, которой на карточке объекта быть не должно.
   *
   * Отказ любой сводки гасит только её блок. Права на разделы разные:
   * аналитика требует ANALYTICS_VIEW, планы обходов недоступны ролям CLIENT
   * и TERRITORIAL_MANAGER. Показывать на это ошибку значило бы сообщать,
   * чего у смотрящего нет; карточка просто не рисует блок.
   */
  const scope = companyId || undefined

  const equipmentQ = useQuery({
    queryKey: ['location-card-equipment', locationId, companyId],
    queryFn: () => api.listEquipment({ locationId, companyId: scope }),
    enabled: !!locationId,
    retry: false,
  })

  const ticketsQ = useQuery({
    queryKey: ['location-card-tickets', locationId, companyId],
    queryFn: () => api.analyticsLocations({
      locationId,
      companyId: scope,
      linkedClientCompanyId: scope,
    }),
    enabled: !!locationId,
    retry: false,
  })

  const schedulesQ = useQuery({
    queryKey: ['location-card-schedules', locationId],
    queryFn: () => api.getInspectionSchedules({ locationId, active: true }),
    enabled: !!locationId,
    retry: false,
  })

  const equipment = summarizeEquipment(equipmentQ.data)
  const tickets = summarizeTickets(ticketsQ.data)
  const schedules = summarizeSchedules(schedulesQ.data)

  /* Оборудование объекта: существующая ручка, область та же. */
  const locationEquipmentQ = useQuery({
    queryKey: ['location-equipment', locationId, companyId],
    queryFn: () => api.equipmentByLocation(locationId, companyId || undefined),
    enabled: !!locationId,
    retry: false,
  })

  const backTo = locationsListPath(outboundScope)
  /* Ссылка на заявки объекта строится существующим контрактом доски (boardLocationId). */
  const ticketsTo = appendBoardNavigationContextToPath('/tickets', { selectedLocationId: locationId })

  /*
   * SMA-LOCATION-CARD-V2 Phase 1: карточка точки как узел.
   *
   * Разделы связываются существующими маршрутами: оборудование, заявки,
   * обходы и аналитика уже есть, второй подсистемы не заводится. Переходы
   * несут и саму точку, и область — иначе провайдер в контуре клиента
   * терял бы контур на первом же переходе (дефект Equipment V2, который
   * повторять нельзя).
   *
   * Аналитика показывается по тому же гейту, что и пункт меню
   * (Navigation V2, isManagementNavItemVisible): видимость прав не выдаёт,
   * доступ решает бэкенд (ANALYTICS_VIEW + analytics.controller @Roles).
   */
  const sections = locationSectionLinks({
    locationId,
    scope: outboundScope,
    canViewAnalytics: isManagementNavItemVisible('/analytics/locations', { role: meQ.data?.role }),
  })

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

      {equipmentQ.isError ? null : (
        <div className="panel" style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Оборудование</h3>
          {equipmentQ.isLoading ? (
            <div className="muted small">Загружаем…</div>
          ) : equipment.total === 0 ? (
            <div className="muted small">Нет оборудования</div>
          ) : (
            <>
              <div className="muted small">
                {equipment.total} {pluralizeRu(equipment.total, 'единица', 'единицы', 'единиц')}
              </div>
              <div className="muted small">В работе: {equipment.active}</div>
              <div style={{ marginTop: 10 }}>
                <Link to={sections.equipment}>
                  <button className="ghost">Открыть оборудование</button>
                </Link>
              </div>
            </>
          )}
        </div>
      )}

      {ticketsQ.isError ? null : (
        <div className="panel" style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Заявки</h3>
          {ticketsQ.isLoading ? (
            <div className="muted small">Загружаем…</div>
          ) : tickets.inProgress === 0 && tickets.awaitingAcceptance === 0 ? (
            <div className="muted small">Нет открытых заявок</div>
          ) : (
            <>
              <div className="muted small">В работе: {tickets.inProgress}</div>
              <div className="muted small">На приёмке: {tickets.awaitingAcceptance}</div>
              <div style={{ marginTop: 10 }}>
                <Link to={ticketsTo}>
                  <button className="ghost">Открыть заявки объекта</button>
                </Link>
              </div>
            </>
          )}
        </div>
      )}

      {schedulesQ.isError ? null : (
        <div className="panel" style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Обходы</h3>
          {schedulesQ.isLoading ? (
            <div className="muted small">Загружаем…</div>
          ) : schedules.activeCount === 0 ? (
            <div className="muted small">Нет запланированных обходов</div>
          ) : (
            <>
              <div className="muted small">
                Следующий: {schedules.next ? fmtDateTime(schedules.next.nextDueAt) : '—'}
              </div>
              <div className="muted small">
                {schedules.activeCount}{' '}
                {pluralizeRu(schedules.activeCount, 'активный план', 'активных плана', 'активных планов')}
              </div>
              <div style={{ marginTop: 10 }}>
                {/* Маршрут планов фильтра по объекту не принимает: ссылка ведёт в раздел. */}
                <Link to={sections.rounds}>
                  <button className="ghost">Открыть планы</button>
                </Link>
              </div>
            </>
          )}
        </div>
      )}

      {/*
        SMA-EQUIPMENT-V2-FOUNDATION: оборудование объекта.
        Читается существующей ручкой equipmentByLocation в области актора;
        своего доступа блок не вводит и при отказе не выдаёт пустой список
        за успешный ответ.
      */}
      {/*
        Отказ гасит раздел целиком, как и у остальных сводок: даже пустой
        заголовок не раскрывает недоступный раздел.
      */}
      {locationEquipmentQ.isError ? null : (
        <div className="panel" style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Оборудование</h3>
          {locationEquipmentQ.isLoading ? (
            <div className="muted small">Загружаем оборудование…</div>
          ) : !locationEquipmentQ.data || locationEquipmentQ.data.length === 0 ? (
            <div className="muted small">Нет оборудования</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {locationEquipmentQ.data.map((unit) => (
                <div key={unit.id}>
                  <Link to={equipmentCardPath(unit.id, outboundScope)}>{unit.name}</Link>
                  <span className="muted small"> · {equipmentStatusLabel(unit.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/*
        Аналитика точки — существующий раздел «По объектам» с сужением до
        этой точки. Раздел показывается тем же гейтом, что пункт меню; прав
        это не выдаёт, доступ решает бэкенд.
      */}
      {sections.analytics ? (
        <div className="panel" style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Аналитика</h3>
          <div className="muted small">Распределение заявок и просрочек по этой точке.</div>
          <div style={{ marginTop: 10 }}>
            <Link to={sections.analytics}>
              <button className="ghost">Открыть аналитику точки</button>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
