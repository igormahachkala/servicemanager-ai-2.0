import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import * as api from '../../lib/api'
import { ProtectedUploadThumbLink } from '../../ui/ProtectedUploadMedia'

/**
 * SMA-EQUIPMENT-HISTORY-PARTS-110B.
 *
 * Вкладка «История» карточки оборудования. Данные канонические: заявки,
 * их история статусов и вложения отчёта о работах. Своей копии жизненного
 * цикла модуль не ведёт.
 *
 * Состав работ по деталям показывается только тогда, когда он занесён
 * в комплектующие. Догадываться о заменах по тексту заявки нельзя: там
 * свободный текст, и правдоподобная выдумка хуже честного пробела.
 */

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Новая',
  ASSIGNED: 'Назначена',
  IN_PROGRESS: 'В работе',
  AWAITING_ACCEPTANCE: 'На приёмке',
  DONE: 'Выполнена',
  REJECTED: 'Отклонена',
  CANCELLED: 'Отменена',
}

function fmtDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function EquipmentHistoryTab({
  equipmentId,
  scopeCompanyId,
}: {
  equipmentId: string
  scopeCompanyId?: string
}) {
  const q = useQuery({
    queryKey: ['equipment-history', equipmentId, scopeCompanyId || ''],
    queryFn: () => api.getEquipmentHistory(equipmentId, scopeCompanyId || undefined),
  })

  if (q.isLoading) return <div className="muted small">Загрузка истории…</div>
  if (q.isError) return <div className="alert">{(q.error as any)?.message || String(q.error)}</div>

  const entries = q.data?.tickets || []
  if (entries.length === 0) {
    return (
      <div className="muted small">
        По этой единице заявок пока не было. История собирается из заявок — как только
        появится первая, она окажется здесь.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {q.data?.truncated ? (
        <div className="muted small">Показаны последние 200 заявок.</div>
      ) : null}

      {entries.map((entry) => (
        <div key={entry.ticketId} className="panel" style={{ margin: 0 }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 600 }}>
                {fmtDate(entry.createdAt)} · Заявка №{entry.ticketNumber}
              </div>
              <div className="muted small">
                {[entry.category, STATUS_LABELS[entry.status] || entry.status]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            <Link to={`/tickets/${entry.ticketId}`}>
              <button className="ghost">Открыть заявку</button>
            </Link>
          </div>

          <div style={{ marginTop: 6 }}>{entry.problem}</div>

          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px', margin: '8px 0 0' }}>
            <dt className="muted small">Исполнитель</dt>
            <dd style={{ margin: 0 }}>
              {[entry.performedBy, entry.performedByCompany].filter(Boolean).join(' · ') || '—'}
            </dd>
            <dt className="muted small">Результат</dt>
            <dd style={{ margin: 0 }}>
              {entry.result || <span className="muted">комментарий приёмки не заполнен</span>}
            </dd>
          </dl>

          {entry.partsInstalled.length > 0 || entry.partsRemoved.length > 0 ? (
            <div className="muted small" style={{ marginTop: 8 }}>
              {entry.partsRemoved.length > 0 ? (
                <div>
                  Снято: {entry.partsRemoved.map((p) => `${p.name}${p.serialNumber ? ` (${p.serialNumber})` : ''}`).join(', ')}
                </div>
              ) : null}
              {entry.partsInstalled.length > 0 ? (
                <div>
                  Установлено: {entry.partsInstalled.map((p) => `${p.name}${p.serialNumber ? ` (${p.serialNumber})` : ''}`).join(', ')}
                </div>
              ) : null}
            </div>
          ) : null}

          {entry.workReports.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {entry.workReports.map((file) =>
                file.mimeType?.startsWith('image/') ? (
                  <ProtectedUploadThumbLink
                    key={file.id}
                    url={file.url}
                    alt={file.originalName}
                    imgStyle={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }}
                  />
                ) : (
                  <span key={file.id} className="muted small">{file.originalName}</span>
                ),
              )}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
