import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ApiRequestError } from '../../lib/api'
import type { ScopeParams } from '../../lib/equipmentCard'
import {
  getServiceHistoryLinks,
  SERVICE_HISTORY_TICKET_LIMIT,
  type ServiceHistoryRun,
  type ServiceHistoryTarget,
} from '../../lib/serviceHistory'
import { statusLabel } from '../../lib/workCalendar'

export function ServiceHistoryLinks({ row, target, scope }: {
  row: ServiceHistoryRun
  target: ServiceHistoryTarget
  scope: ScopeParams
}) {
  const q = useQuery({
    queryKey: ['service-history-links', row.id, row.updatedAt, target, scope],
    queryFn: ({ signal }) => getServiceHistoryLinks(row, target, scope, signal),
    retry: false,
    // A denial/refetch failure must not keep previously authorized data visible.
    gcTime: 0,
  })

  if (q.isPending || q.isFetching) return <div className="muted small">Проверяем доступ к источникам…</div>
  if (q.isError && q.error instanceof ApiRequestError && [403, 404].includes(q.error.status)) {
    return <div className="muted small">Связи обхода недоступны.</div>
  }
  if (q.isError) return (
    <div className="muted small">
      Не удалось загрузить связи обхода. <button type="button" className="ghost" onClick={() => q.refetch()}>Повторить</button>
    </div>
  )
  const links = q.data
  return (
    <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
      {links.plan ? (
        <div className="small">План: {links.plan.name} · <Link to={links.plan.path}>Планы объекта</Link></div>
      ) : <div className="muted small">Нет доступной ссылки на план.</div>}
      {links.tickets.length ? (
        <div>
          <div className="muted small">Заявки по пунктам обхода · текущий статус</div>
          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
            {links.tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link to={ticket.path}>{ticket.number == null ? 'Открыть заявку' : `Заявка №${ticket.number}`}</Link>
                {' · '}{statusLabel(ticket.status)}
              </li>
            ))}
          </ul>
        </div>
      ) : <div className="muted small">Нет доступных ссылок на заявки.</div>}
      {links.incomplete ? (
        <div className="muted small">
          Часть источников не удалось проверить. <button type="button" className="ghost" onClick={() => q.refetch()}>Повторить</button>
        </div>
      ) : null}
      <div className="muted small">
        Проверяется не более {SERVICE_HISTORY_TICKET_LIMIT} связей с заявками. Полный результат — в исходном обходе и доступных заявках.
      </div>
    </div>
  )
}
