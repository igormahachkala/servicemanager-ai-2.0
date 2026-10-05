import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'
import { EquipmentHistoryTab } from '../components/equipment/EquipmentHistoryTab'
import { EquipmentPartsTab } from '../components/equipment/EquipmentPartsTab'
import { PublicQrModalLazy } from '../components/public/PublicQrLazy'
import {
  EQUIPMENT_PARTS_MANAGER_ROLES,
  canCreateTicketForEquipment,
  equipmentCreateTicketPath,
  equipmentPassportRows,
  equipmentPublicRequestLink,
  equipmentStatusLabel,
  equipmentTicketsLink,
  isEquipmentRetired,
  isWarrantyExpired,
  locationCardPath,
} from '../lib/equipmentCard'

/**
 * SMA-EQUIPMENT-V2-FOUNDATION — карточка оборудования.
 *
 * Отдельный маршрут /equipment/:id вместо выбора внутри списка: на карточку
 * нужно давать прямую ссылку — из заявки, из точки, из QR, из переписки, —
 * а выбор в локальном состоянии списка ссылкой не является.
 *
 * Своего доступа страница не вводит: читает теми же ручками, что и список
 * (LOCATIONS_VIEW на бэкенде), и ничего не решает сама. Отказ показывается
 * отказом — в частности 404 для недоступного объекта неотличим от
 * несуществующего, и это намеренно.
 */

export function EquipmentCardPage() {
  const params = useParams<{ id: string }>()
  const equipmentId = params.id || ''

  /* Область берётся из адреса — тем же параметром, что и в остальных чтениях. */
  const [searchParams] = useSearchParams()
  /*
   * Область: из адреса, а при его отсутствии — наблюдаемая компания, как это
   * делают доска и карточка заявки. Без запасного варианта провайдер,
   * пришедший по ссылке без параметра, получал бы «не найдено» на то
   * оборудование, которое только что видел.
   */
  /*
   * Контур провайдера приходит в linkedClientCompanyId, контур наблюдателя —
   * в companyId. Карточка принимает любой: для чтения оборудования бэкенд
   * ждёт companyId и сам разрешает провайдеру связанного клиента
   * (equipment.service: getLinkedClientAccess).
   */
  const linkedClientCompanyId = (searchParams.get('linkedClientCompanyId') || '').trim()
  const companyId = (
    searchParams.get('companyId') ||
    linkedClientCompanyId ||
    api.getObserverCompanyId()
  ).trim()

  const [qrOpen, setQrOpen] = useState(false)

  const equipmentQ = useQuery({
    queryKey: ['equipment-card', equipmentId, companyId],
    queryFn: () => api.getEquipment(equipmentId, companyId || undefined),
    enabled: !!equipmentId,
    retry: false,
  })

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const item = equipmentQ.data
  const locationId = item?.location?.id || item?.locationId || ''

  /*
   * Токен публичных заявок нужен только для QR и только тому, кто видит
   * настройки компании. Нет токена — кнопки QR нет: выдумывать ссылку,
   * которая никуда не ведёт, нельзя.
   */
  const companyQ = useQuery({
    queryKey: ['company-public-token', companyId],
    queryFn: () => api.company(),
    enabled: !!item && !companyId,
  })

  const qrUrl = useMemo(
    () =>
      equipmentPublicRequestLink({
        buildLink: api.buildPublicRequestLink,
        token: companyQ.data?.publicRequestToken,
        locationId,
        equipmentId,
      }),
    [companyQ.data?.publicRequestToken, locationId, equipmentId],
  )

  const passport = useMemo(() => (item ? equipmentPassportRows(item) : []), [item])
  const warrantyExpired = isWarrantyExpired(item?.warrantyUntil)
  const retired = isEquipmentRetired(item?.status)
  const backTo = companyId ? `/equipment?companyId=${encodeURIComponent(companyId)}` : '/equipment'

  /*
   * Доска учитывает companyId только у PLATFORM_ADMIN, а контур провайдера
   * задаётся linkedClientCompanyId. Поэтому область уезжает тем параметром,
   * который для этой роли действительно работает: иначе доска открывалась
   * в другом контуре и попутно перезаписывала сохранённую область.
   */
  const boardScope =
    meQ.data?.role === 'PLATFORM_ADMIN'
      ? { companyId }
      : { linkedClientCompanyId: companyId }

  /*
   * Ссылки карточки несут ту же область тем же параметром. Иначе переход
   * «Создать заявку» у провайдера упирался в скрытую форму, а ссылка на
   * точку — в 404.
   */
  const cardScope = boardScope

  if (equipmentQ.isLoading) {
    return (
      <div className="panel">
        <div className="muted">Загружаем оборудование…</div>
      </div>
    )
  }

  /*
   * Недоступное и несуществующее оборудование выглядят одинаково: бэкенд
   * отвечает одним и тем же отказом, и различать их на клиенте значило бы
   * дать способ проверить существование чужой позиции.
   */
  if (equipmentQ.isError || !item) {
    return (
      <div className="panel">
        <div className="muted">Оборудование не найдено</div>
        <div style={{ marginTop: 10 }}>
          <Link to={backTo}>
            <button className="ghost">К списку оборудования</button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="managementPage">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ marginBottom: 4, opacity: retired ? 0.7 : 1 }}>{item.name}</h2>
          <div className="muted small">Состояние: {equipmentStatusLabel(item.status)}</div>
          {item.location ? (
            <div className="muted small">
              Объект:{' '}
              {/* Область обязательна: LocationPage читает её только из адреса. */}
              <Link to={locationCardPath(item.location.id, cardScope)}>
                {item.location.name || 'Без названия'}
              </Link>
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canCreateTicketForEquipment(item) ? (
            <Link to={equipmentCreateTicketPath({ id: item.id, locationId }, cardScope)}>
              <button>Создать заявку</button>
            </Link>
          ) : null}
          <Link {...equipmentTicketsLink({ id: item.id }, boardScope)}>
            <button className="ghost">Заявки оборудования</button>
          </Link>
          {qrUrl ? (
            <button className="ghost" onClick={() => setQrOpen(true)}>
              QR
            </button>
          ) : null}
          <Link to={backTo}>
            <button className="ghost">К списку</button>
          </Link>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Паспорт</h3>
        {passport.length === 0 ? (
          <div className="muted small">Паспортные данные не заполнены</div>
        ) : (
          passport.map((row) => (
            <div className="muted small" key={row.label}>
              {row.label}: {row.value}
            </div>
          ))
        )}
        {warrantyExpired === true ? (
          <div className="muted small" style={{ marginTop: 6 }}>
            Гарантия истекла
          </div>
        ) : null}
      </div>

      {item.mainPhoto?.url ? (
        <div className="panel" style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Фото</h3>
          <img
            src={item.mainPhoto.url}
            alt={item.name}
            style={{ maxWidth: '100%', borderRadius: 8 }}
          />
        </div>
      ) : null}

      {/*
        История обслуживания и установленные детали переиспользуют
        существующие вкладки: второго представления этих данных не заводится.
      */}
      <div className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 10 }}>История обслуживания</h3>
        <EquipmentHistoryTab equipmentId={item.id} scopeCompanyId={companyId || undefined} />
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Установленные детали</h3>
        <EquipmentPartsTab
          equipmentId={item.id}
          scopeCompanyId={companyId || undefined}
          /*
           * Тот же круг лиц, что в списке оборудования: ADMIN, MASTER,
           * DISPATCHER. isFullAdminDesktopNavRole — предикат видимости меню,
           * и капабилити из него делать нельзя: MASTER и DISPATCHER потеряли
           * бы управление деталями, а PLATFORM_ADMIN получил бы кнопки,
           * которые бэкенд всё равно отклонит.
           */
          canManage={EQUIPMENT_PARTS_MANAGER_ROLES.includes(String(meQ.data?.role || ''))}
        />
      </div>

      <PublicQrModalLazy
        open={qrOpen}
        url={qrUrl}
        title={item.name}
        subtitle={item.location?.name || undefined}
        fileName={`equipment-qr-${item.id}.png`}
        onClose={() => setQrOpen(false)}
      />
    </div>
  )
}
