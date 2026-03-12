import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'

function fmtNumber(v?: number | null) {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—'
  return new Intl.NumberFormat('ru-RU').format(v)
}

function fmtMinutes(v?: number | null) {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—'
  return `${new Intl.NumberFormat('ru-RU').format(v)} мин`
}

function fmtPercent(v?: number | null) {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—'
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(v)}%`
}

export function AnalyticsPage() {
  const q = useQuery<api.AnalyticsOverviewResponse>({
    queryKey: ['analytics', 'overview'],
    queryFn: api.analyticsOverview,
  })

  const raw = q.data

  const data: api.AnalyticsOverviewResponse = {
    createdCount: raw?.createdCount ?? 0,
    openByStatus: {
      NEW: raw?.openByStatus?.NEW ?? 0,
      ASSIGNED: raw?.openByStatus?.ASSIGNED ?? 0,
      IN_PROGRESS: raw?.openByStatus?.IN_PROGRESS ?? 0,
    },
    sla: {
      breachedCount: raw?.sla?.breachedCount ?? 0,
      evaluatedCount: raw?.sla?.evaluatedCount ?? 0,
      okPercent: raw?.sla?.okPercent ?? 0,
      breachedPercent: raw?.sla?.breachedPercent ?? 0,
    },
    timing: {
      evaluatedTickets: raw?.timing?.evaluatedTickets ?? 0,
      meanTimeToAssignMinutes: raw?.timing?.meanTimeToAssignMinutes ?? 0,
      meanTimeToResolveMinutes: raw?.timing?.meanTimeToResolveMinutes ?? 0,
      note: raw?.timing?.note,
    },
    throughputByTechnician: raw?.throughputByTechnician ?? [],
    workloadByTechnician: raw?.workloadByTechnician ?? [],
    summary: {
      backlogOpenTotal:
        raw?.summary?.backlogOpenTotal ??
        ((raw?.openByStatus?.NEW ?? 0) + (raw?.openByStatus?.ASSIGNED ?? 0) + (raw?.openByStatus?.IN_PROGRESS ?? 0)),
      unassignedOpenTickets: raw?.summary?.unassignedOpenTickets ?? 0,
    },
    note: raw?.note,
    now: raw?.now ?? new Date().toISOString(),
  }

  const openTotal =
    (data.openByStatus.NEW || 0) +
    (data.openByStatus.ASSIGNED || 0) +
    (data.openByStatus.IN_PROGRESS || 0)

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Аналитика</h2>
          <div className="muted small">
            {q.isFetching ? 'Загрузка…' : raw ? `Обновлено: ${new Date(data.now).toLocaleString('ru-RU')}` : '—'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="ghost" onClick={() => q.refetch()} disabled={q.isFetching}>
            Обновить
          </button>
          <Link to="/board">
            <button className="ghost">← Назад к доске</button>
          </Link>
        </div>
      </div>

      {q.isError ? <div className="alert">{(q.error as any)?.message || String(q.error)}</div> : null}

      <div
        className="panel"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <div className="muted small">Всего заявок</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>
            {q.isFetching ? '—' : fmtNumber(data.createdCount)}
          </div>
        </div>

        <div>
          <div className="muted small">Backlog open</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>
            {q.isFetching ? '—' : fmtNumber(data.summary?.backlogOpenTotal)}
          </div>
        </div>

        <div>
          <div className="muted small">SLA нарушено</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>
            {q.isFetching ? '—' : fmtNumber(data.sla.breachedCount)}
          </div>
        </div>

        <div>
          <div className="muted small">Оценено тикетов</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>
            {q.isFetching ? '—' : fmtNumber(data.timing.evaluatedTickets)}
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Открытые по статусам</h3>

          <div className="kv">
            <div className="k">Новые</div>
            <div className="v">{q.isFetching ? '—' : fmtNumber(data.openByStatus.NEW)}</div>

            <div className="k">Назначенные</div>
            <div className="v">{q.isFetching ? '—' : fmtNumber(data.openByStatus.ASSIGNED)}</div>

            <div className="k">В работе</div>
            <div className="v">{q.isFetching ? '—' : fmtNumber(data.openByStatus.IN_PROGRESS)}</div>

            <div className="k">Всего открытых</div>
            <div className="v">{q.isFetching ? '—' : fmtNumber(openTotal)}</div>

            <div className="k">Без назначения</div>
            <div className="v">{q.isFetching ? '—' : fmtNumber(data.summary?.unassignedOpenTickets)}</div>
          </div>
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>SLA и средние времена</h3>

          <div className="kv">
            <div className="k">SLA evaluated</div>
            <div className="v">{q.isFetching ? '—' : fmtNumber(data.sla.evaluatedCount)}</div>

            <div className="k">SLA OK %</div>
            <div className="v">{q.isFetching ? '—' : fmtPercent(data.sla.okPercent)}</div>

            <div className="k">SLA breached %</div>
            <div className="v">{q.isFetching ? '—' : fmtPercent(data.sla.breachedPercent)}</div>

            <div className="k">До назначения</div>
            <div className="v">{q.isFetching ? '—' : fmtMinutes(data.timing.meanTimeToAssignMinutes)}</div>

            <div className="k">До завершения</div>
            <div className="v">{q.isFetching ? '—' : fmtMinutes(data.timing.meanTimeToResolveMinutes)}</div>
          </div>

          {data.timing.note ? (
            <div className="muted small" style={{ marginTop: 10 }}>
              {data.timing.note}
            </div>
          ) : null}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Загрузка техников</h3>

        {!q.isFetching && data.workloadByTechnician && data.workloadByTechnician.length === 0 ? (
          <div className="muted small">Пока нет данных по активной загрузке техников.</div>
        ) : null}

        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', fontSize: 12, color: '#6b7280', padding: '8px 6px' }}>
                  Техник
                </th>
                <th style={{ textAlign: 'left', fontSize: 12, color: '#6b7280', padding: '8px 6px' }}>
                  Assigned
                </th>
                <th style={{ textAlign: 'left', fontSize: 12, color: '#6b7280', padding: '8px 6px' }}>
                  In progress
                </th>
                <th style={{ textAlign: 'left', fontSize: 12, color: '#6b7280', padding: '8px 6px' }}>
                  Active total
                </th>
              </tr>
            </thead>
            <tbody>
              {(data.workloadByTechnician || []).map((row) => (
                <tr key={row.technicianId} style={{ borderTop: '1px solid #eef2f7' }}>
                  <td style={{ padding: '10px 6px', fontSize: 13 }}>
                    {row.technicianEmail || row.technicianId}
                  </td>
                  <td style={{ padding: '10px 6px', fontSize: 13 }}>{fmtNumber(row.assignedCount)}</td>
                  <td style={{ padding: '10px 6px', fontSize: 13 }}>{fmtNumber(row.inProgressCount)}</td>
                  <td style={{ padding: '10px 6px', fontSize: 13 }}>{fmtNumber(row.activeCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Топ техников по завершённым заявкам</h3>

        {!q.isFetching && data.throughputByTechnician.length === 0 ? (
          <div className="muted small">Пока нет данных по завершённым заявкам.</div>
        ) : null}

        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', fontSize: 12, color: '#6b7280', padding: '8px 6px' }}>
                  Техник
                </th>
                <th style={{ textAlign: 'left', fontSize: 12, color: '#6b7280', padding: '8px 6px' }}>
                  Завершено
                </th>
              </tr>
            </thead>
            <tbody>
              {(data.throughputByTechnician || []).map((row) => (
                <tr key={row.technicianId} style={{ borderTop: '1px solid #eef2f7' }}>
                  <td style={{ padding: '10px 6px', fontSize: 13 }}>
                    {row.technicianEmail || row.technicianId}
                  </td>
                  <td style={{ padding: '10px 6px', fontSize: 13 }}>{fmtNumber(row.doneCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.note ? (
          <div className="muted small" style={{ marginTop: 10 }}>
            {data.note}
          </div>
        ) : null}
      </div>
    </div>
  )
}
