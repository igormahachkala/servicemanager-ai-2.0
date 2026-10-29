import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import * as api from '../../lib/api'
import type { ScopeParams } from '../../lib/equipmentCard'
import {
  getServiceHistory,
  SERVICE_HISTORY_LIMIT,
  serviceHistoryPath,
  serviceHistoryRows,
  type ServiceHistoryTarget,
} from '../../lib/serviceHistory'
import { ServiceHistoryLinks } from './ServiceHistoryLinks'

const REPORT_LABELS: Record<api.InspectionReportStatus, string> = {
  DRAFT: 'Черновик', SUBMITTED: 'На проверке', APPROVED: 'Утверждён', REJECTED: 'Возвращён',
}

function dateLabel(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString('ru-RU') : '—'
}

/** A bounded view of canonical records, not a second journal or lifecycle. */
export function ServiceHistorySection({ target, scope }: { target: ServiceHistoryTarget; scope: ScopeParams }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const q = useQuery({
    queryKey: ['service-history', target, scope],
    queryFn: () => getServiceHistory(target),
    retry: false,
  })
  if (q.isError && q.error instanceof api.ApiRequestError && [403, 404].includes(q.error.status)) return null
  const rows = serviceHistoryRows(q.data || [], target)

  return (
    <section className="panel" style={{ marginTop: 12 }} aria-label="История обходов">
      <h3 style={{ marginBottom: 6 }}>История обходов</h3>
      <p className="muted small">
        До {SERVICE_HISTORY_LIMIT} последних записей обходов {target.equipmentId ? 'этого оборудования' : 'этого объекта'}.
        {' '}Недоступные записи исключены; это ограниченная часть истории, не полный список.
        {' '}План → обход → результат → доступная заявка.
      </p>
      {q.isPending || q.isFetching ? <div className="muted small">Загружаем обходы…</div> : q.isError ? (
        <div className="muted small">
          Не удалось загрузить историю обходов. <button type="button" className="ghost" onClick={() => q.refetch()}>Повторить</button>
        </div>
      ) : rows.length === 0 ? <div className="muted small">В загруженной части нет доступных обходов.</div> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((row) => (
            <article className="panel" key={row.id} style={{ margin: 0 }}>
              <div style={{ fontWeight: 600 }}>{row.title}</div>
              <div className="muted small">
                {dateLabel(row.createdAt)} · {row.status === 'COMPLETED' ? 'Завершён' : 'В процессе'}
                {row.reportStatus ? ` · Акт: ${REPORT_LABELS[row.reportStatus]}` : ''}
              </div>
              {target.equipmentId ? <div className="muted small">Объект обхода: {row.location.name}</div> : null}
              <div className="muted small">
                Пунктов: {row.summary.totalItems} · Норма: {row.summary.okCount} · Проблемы: {row.summary.issueCount}
                {' · '}Критичные: {row.summary.criticalCount}
                {row.summary.pendingCount ? ` · Не заполнено: ${row.summary.pendingCount}` : ''}
                {row.summary.skippedCount ? ` · Пропущено: ${row.summary.skippedCount}` : ''}
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
                <Link to={serviceHistoryPath(`/inspection/runs/${encodeURIComponent(row.id)}`, scope)}>Обход</Link>
                <button type="button" className="ghost" aria-expanded={expandedId === row.id}
                  onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}>
                  {expandedId === row.id ? 'Скрыть связи' : 'План и заявки'}
                </button>
              </div>
              {expandedId === row.id ? <ServiceHistoryLinks key={row.id} row={row} target={target} scope={scope} /> : null}
            </article>
          ))}
        </div>
      )}
      <div className="muted small" style={{ marginTop: 8 }}>Счётчики относятся к пунктам обхода, а не к числу работ или заявок.</div>
    </section>
  )
}
