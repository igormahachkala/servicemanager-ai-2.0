import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../lib/api'
import { ProtectedUploadImg } from '../ui/ProtectedUploadMedia'
import { mobilePath } from './mobileRoute'

/**
 * SMA-EQUIPMENT-V2-110A.
 *
 * Оборудование на телефоне — только чтение. Техник в поле смотрит паспорт
 * единицы: что это, где стоит, серийный номер, гарантия. Правка и снимки
 * остаются в управленческой части: набирать паспорт с телефона стоя у котла —
 * не та задача, ради которой открывают приложение.
 */

/** Tabler arrow-left — inline SVG вместо глифа ←. */
function BackArrow() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function statusLabel(status?: string | null) {
  if (!status) return '—'
  return api.EQUIPMENT_STATUS_LABELS[status] || status
}

function fmtDate(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function locationLabel(item: api.EquipmentListItem) {
  if (!item.location) return '—'
  return [item.location.platformCode, item.location.name].filter(Boolean).join(' · ') || '—'
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value || value === '—') return null
  return (
    <div className="mobileRow">
      <span className="mobileMeta">{label}</span>
      <span>{value}</span>
    </div>
  )
}

/**
 * SMA-EQUIPMENT-HISTORY-PARTS-110B.
 * История и комплектующие на телефоне — только чтение. Технику в поле нужно
 * знать, что стоит и что меняли; заводить записи с телефона, стоя у котла, —
 * не та задача, ради которой открывают приложение.
 */
const TICKET_STATUS_LABELS: Record<string, string> = {
  NEW: 'Новая',
  ASSIGNED: 'Назначена',
  IN_PROGRESS: 'В работе',
  AWAITING_ACCEPTANCE: 'На приёмке',
  DONE: 'Выполнена',
  REJECTED: 'Отклонена',
  CANCELLED: 'Отменена',
}

function MobileEquipmentHistory({ equipmentId }: { equipmentId: string }) {
  // SMA-EQUIPMENT-PARTS-POLISH-110C: телефон тоже не тянет всю историю
  // разом — страницы догружаются кнопкой.
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [acc, setAcc] = useState<api.EquipmentHistoryEntry[]>([])
  const q = useQuery({
    queryKey: ['mobile-equipment-history', equipmentId, cursor || ''],
    queryFn: () => api.getEquipmentHistory(equipmentId, undefined, { limit: 20, cursor }),
  })
  useEffect(() => {
    if (!q.data) return
    setAcc((prev) => {
      const seen = new Set(prev.map((e) => e.ticketId))
      return [...prev, ...q.data!.tickets.filter((e) => !seen.has(e.ticketId))]
    })
  }, [q.data])
  if (q.isLoading && acc.length === 0) return <div className="mobileCard mobileMeta">Загружаем историю…</div>
  if (q.isError) return <div className="mobileNotice mobileNoticeError">{(q.error as any)?.message || String(q.error)}</div>
  const entries = acc
  if (entries.length === 0) {
    return (
      <div className="mobileCard mobileEmptyState" role="status">
        <div className="mobileEmptyStateTitle">Заявок по этой единице ещё не было</div>
      </div>
    )
  }
  return (
    <>
      {entries.map((e) => (
        <div key={e.ticketId} className="mobileCard" style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontWeight: 600 }}>{fmtDate(e.createdAt)} · №{e.ticketNumber}</div>
          <div className="mobileMeta">{[e.category, TICKET_STATUS_LABELS[e.status] || e.status].filter(Boolean).join(' · ')}</div>
          <div>{e.problem}</div>
          {e.performedBy ? <div className="mobileMeta">Исполнитель: {e.performedBy}</div> : null}
          {e.result ? <div className="mobileMeta">Результат: {e.result}</div> : null}
          {e.partsRemoved.length > 0 ? (
            <div className="mobileMeta">Снято: {e.partsRemoved.map((p) => p.name).join(', ')}</div>
          ) : null}
          {e.partsInstalled.length > 0 ? (
            <div className="mobileMeta">Установлено: {e.partsInstalled.map((p) => p.name).join(', ')}</div>
          ) : null}
          <Link to={`/m/tickets/${e.ticketId}`} className="mobileBtn mobileBtnGhost" style={{ textAlign: 'center', marginTop: 2 }}>
            Открыть заявку
          </Link>
        </div>
      ))}
      {q.data?.page?.nextCursor ? (
        <button
          type="button"
          className="mobileBtn mobileBtnGhost"
          onClick={() => setCursor(q.data!.page.nextCursor!)}
          disabled={q.isFetching}
        >
          {q.isFetching ? 'Загрузка…' : 'Показать ещё'}
        </button>
      ) : null}
    </>
  )
}

function MobileEquipmentParts({ equipmentId }: { equipmentId: string }) {
  const q = useQuery({
    queryKey: ['mobile-equipment-parts', equipmentId],
    queryFn: () => api.getEquipmentParts(equipmentId),
  })
  if (q.isLoading) return <div className="mobileCard mobileMeta">Загружаем комплектующие…</div>
  if (q.isError) return <div className="mobileNotice mobileNoticeError">{(q.error as any)?.message || String(q.error)}</div>
  const installed = q.data?.installed || []
  const history = q.data?.history || []
  return (
    <>
      <h2 className="mobileSectionTitle">Установлено сейчас</h2>
      {installed.length === 0 ? (
        <div className="mobileCard mobileMeta">Комплектующие не заведены.</div>
      ) : (
        installed.map((p) => (
          <div key={p.id} className="mobileCard" style={{ display: 'grid', gap: 2 }}>
            <div style={{ fontWeight: 600 }}>{p.displayName}</div>
            <div className="mobileMeta">
              {[p.serialNumber ? `с/н ${p.serialNumber}` : null, `с ${fmtDate(p.installedAt)}`].filter(Boolean).join(' · ')}
            </div>
            {p.installedTicket ? <div className="mobileMeta">По заявке №{p.installedTicket.ticketNumber}</div> : null}
          </div>
        ))
      )}
      <h2 className="mobileSectionTitle">История замен</h2>
      {history.length === 0 ? (
        <div className="mobileCard mobileMeta">Замен пока не было.</div>
      ) : (
        history.map((p) => (
          <div key={p.id} className="mobileCard" style={{ display: 'grid', gap: 2, opacity: 0.85 }}>
            <div style={{ fontWeight: 600 }}>{p.displayName}</div>
            <div className="mobileMeta">{fmtDate(p.installedAt)} — {fmtDate(p.removedAt)}</div>
            {p.removedTicket ? <div className="mobileMeta">Снято по заявке №{p.removedTicket.ticketNumber}</div> : null}
          </div>
        ))
      )}
      <p className="mobileFieldHint">Комплектующие заводятся и заменяются в управленческой части.</p>
    </>
  )
}

export function MobileEquipmentPage() {
  const location = useLocation()
  const params = useParams<{ id?: string }>()
  const equipmentId = (params.id || '').trim()

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'overview' | 'history' | 'parts'>('overview')

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const listQ = useQuery({
    queryKey: ['mobile-equipment', search],
    queryFn: () => api.listEquipment({ search: search || undefined }),
    enabled: !equipmentId,
  })

  const cardQ = useQuery({
    queryKey: ['mobile-equipment-card', equipmentId],
    queryFn: () => api.getEquipment(equipmentId),
    enabled: !!equipmentId,
  })

  if (equipmentId) {
    const item = cardQ.data
    return (
      <div className="mobileSection">
        <div className="mobileTicketDetailsToolbar">
          <Link to={mobilePath(location.pathname, '/equipment')} className="mobileDetailsBackLink">
            <BackArrow />
            Оборудование
          </Link>
        </div>

        {cardQ.isLoading ? (
          <div className="mobileCard mobileMeta">Загружаем карточку…</div>
        ) : cardQ.isError ? (
          <div className="mobileNotice mobileNoticeError">
            {(cardQ.error as any)?.message || String(cardQ.error)}
          </div>
        ) : !item ? (
          <div className="mobileCard mobileEmptyState" role="status">
            <div className="mobileEmptyStateTitle">Единица не найдена</div>
          </div>
        ) : (
          <>
            <div>
              <h1 className="mobileTitle">{item.name}</h1>
              <div className="mobileSubtitle">
                {[item.type, statusLabel(item.status)].filter(Boolean).join(' · ')}
              </div>
            </div>

            {item.mainPhoto?.url ? (
              <ProtectedUploadImg
                url={item.mainPhoto.url}
                alt={item.name}
                style={{ width: '100%', borderRadius: 16, objectFit: 'cover', maxHeight: 240 }}
              />
            ) : null}

            <div style={{ display: 'flex', gap: 6 }}>
              {([['overview', 'Обзор'], ['history', 'История'], ['parts', 'Компоненты']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className="mobileBtn mobileBtnGhost"
                  onClick={() => setTab(key)}
                  style={{ flex: 1, fontWeight: tab === key ? 700 : 400 }}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'history' ? <MobileEquipmentHistory equipmentId={item.id} /> : null}
            {tab === 'parts' ? <MobileEquipmentParts equipmentId={item.id} /> : null}

            {tab === 'overview' ? (
            <div className="mobileCard" style={{ display: 'grid', gap: 6 }}>
              <Row label="Объект" value={locationLabel(item)} />
              <Row label="Производитель" value={item.manufacturer || '—'} />
              <Row label="Модель" value={item.model || '—'} />
              <Row label="Серийный номер" value={item.serialNumber || '—'} />
              <Row label="Инвентарный номер" value={item.inventoryNumber || '—'} />
              <Row label="Ввод в эксплуатацию" value={fmtDate(item.commissionedAt)} />
              <Row label="Гарантия до" value={fmtDate(item.warrantyUntil)} />
            </div>
            ) : null}

            {tab === 'overview' && item.description ? (
              <div className="mobileCard" style={{ whiteSpace: 'pre-wrap' }}>{item.description}</div>
            ) : null}

            {tab === 'overview' ? (
              <p className="mobileFieldHint">
                Паспорт заполняется в управленческой части — здесь он доступен только для просмотра.
              </p>
            ) : null}
          </>
        )}
      </div>
    )
  }

  const rows = listQ.data || []

  return (
    <div className="mobileSection">
      <div>
        <h1 className="mobileTitle">Оборудование</h1>
        <div className="mobileSubtitle">
          {listQ.isFetching ? 'Загрузка…' : `Единиц: ${rows.length}`}
        </div>
      </div>

      <label className="mobileHomeSearchWrap" style={{ margin: 0 }}>
        <span className="mobileVisuallyHidden">Поиск оборудования</span>
        <input
          className="mobileHomeSearchInput"
          type="search"
          enterKeyHint="search"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Название, модель, серийный номер"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value.slice(0, 240))}
        />
      </label>

      {listQ.isLoading ? (
        <div className="mobileCard mobileMeta">Загружаем оборудование…</div>
      ) : listQ.isError ? (
        <div className="mobileNotice mobileNoticeError">
          {(listQ.error as any)?.message || String(listQ.error)}
        </div>
      ) : rows.length === 0 ? (
        <div className="mobileCard mobileEmptyState" role="status">
          <div className="mobileEmptyStateTitle">
            {search ? 'Ничего не найдено' : 'Оборудование пока не заведено'}
          </div>
          <p className="mobileEmptyStateHint">
            {search
              ? 'Проверьте написание или попробуйте искать по серийному номеру.'
              : 'Карточки создаются в управленческой части.'}
          </p>
        </div>
      ) : (
        rows.map((item) => (
          <Link
            key={item.id}
            to={mobilePath(location.pathname, `/equipment/${item.id}`)}
            className="mobileCard"
            style={{ display: 'flex', gap: 10, alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
          >
            {item.mainPhoto?.url ? (
              <ProtectedUploadImg
                url={item.mainPhoto.url}
                alt={item.name}
                style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
              />
            ) : null}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600 }}>{item.name}</span>
              <span className="mobileMeta" style={{ display: 'block' }}>
                {[locationLabel(item), item.serialNumber || null].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="mobileMeta">{statusLabel(item.status)}</span>
          </Link>
        ))
      )}
    </div>
  )
}
