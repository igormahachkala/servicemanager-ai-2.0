import { Link } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'

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
 *
 * SMA-EQUIPMENT-PARTS-POLISH-110C: выдача постраничная. 110B показывал
 * последние 200 и молчал об остальном — по такой карточке нельзя было
 * отличить «заявок 200» от «их 900, и семисот вы не видите». Страницы
 * догружаются по курсору, вся история в память браузера не поднимается.
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
  const q = useInfiniteQuery({
    queryKey: ['equipment-history', equipmentId, scopeCompanyId || ''],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getEquipmentHistory(equipmentId, scopeCompanyId || undefined, { cursor: pageParam }),
    getNextPageParam: (last) => last.page.nextCursor ?? undefined,
  })

  if (q.isLoading) return <div className="muted small">Загрузка истории…</div>
  if (q.isError) return <div className="alert">{(q.error as any)?.message || String(q.error)}</div>

  const entries = (q.data?.pages || []).flatMap((page) => page.tickets)
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

      {q.hasNextPage ? (
        <button className="ghost" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
          {q.isFetchingNextPage ? 'Загрузка…' : 'Показать ещё'}
        </button>
      ) : (
        <div className="muted small">Показана вся история: {entries.length} заявок.</div>
      )}
    </div>
  )
}
