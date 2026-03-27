import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
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

function providerScopeLabel(role?: api.ServiceContractRole) {
  if (role === 'PRIMARY') return 'PRIMARY provider'
  if (role === 'SECONDARY') return 'SECONDARY provider'
  return ''
}

export function AnalyticsPage() {
  const [linkedClientCompanyId, setLinkedClientCompanyId] = useState('')
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const linkedClientsQ = useQuery({
    queryKey: ['linked-clients'],
    queryFn: api.linkedClients,
    enabled: meQ.data?.role === 'ADMIN' || meQ.data?.role === 'MASTER' || meQ.data?.role === 'DISPATCHER' || meQ.data?.role === 'NETWORK_DIRECTOR',
  })

  useEffect(() => {
    if (!linkedClientCompanyId && linkedClientsQ.data?.length) {
      const primary = linkedClientsQ.data.find((item) => item.role === 'PRIMARY')
      if (primary) setLinkedClientCompanyId(primary.clientCompany.id)
    }
  }, [linkedClientsQ.data, linkedClientCompanyId])

  const selectedLinkedClient = useMemo(
    () => linkedClientsQ.data?.find((item) => item.clientCompany.id === linkedClientCompanyId) || null,
    [linkedClientsQ.data, linkedClientCompanyId],
  )

  const q = useQuery<api.AnalyticsOverviewResponse>({
    queryKey: ['analytics', 'overview', linkedClientCompanyId],
    queryFn: () => api.analyticsOverview(linkedClientCompanyId || undefined),
  })

  const raw = q.data

  const data: api.AnalyticsOverviewResponse = {
    createdCount: raw?.createdCount ?? 0,
    openByStatus: {
      NEW: raw?.openByStatus?.NEW ?? 0,
      ASSIGNED: raw?.openByStatus?.ASSIGNED ?? 0,
      IN_PROGRESS: raw?.openByStatus?.IN_PROGRESS ?? 0,
    },
    bySource: raw?.bySource ?? { INTERNAL: 0, PUBLIC_QUICK_REQUEST: 0 },
    publicIntake: raw?.publicIntake ?? {
      total: 0,
      resolved: 0,
      resolvedPercent: 0,
      byType: { REPAIR: 0, NOTE: 0 },
      byDay: [],
      byLocation: [],
      byEquipment: [],
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
    meta: raw?.meta,
  }

  const openTotal = (data.openByStatus.NEW || 0) + (data.openByStatus.ASSIGNED || 0) + (data.openByStatus.IN_PROGRESS || 0)

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Аналитика</h2>
          <div className="muted small">
            {q.isFetching ? 'Загрузка…' : raw ? `Обновлено: ${new Date(data.now).toLocaleString('ru-RU')}` : '—'}
          </div>
          {selectedLinkedClient ? (
            <div className="muted small" style={{ marginTop: 4 }}>
              Аналитика клиента: {selectedLinkedClient.clientCompany.name} · {providerScopeLabel(selectedLinkedClient.role)}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="ghost" onClick={() => q.refetch()} disabled={q.isFetching}>Обновить</button>
          <Link to="/board"><button className="ghost">← Назад к доске</button></Link>
        </div>
      </div>

      {linkedClientsQ.data && linkedClientsQ.data.length > 0 ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="row" style={{ marginBottom: 0 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Связанные клиенты провайдера</div>
              <div className="muted small">Общий analytics overview доступен только для PRIMARY contract.</div>
            </div>
            <select value={linkedClientCompanyId} onChange={(e) => setLinkedClientCompanyId(e.target.value)}>
              <option value="">Своя компания</option>
              {linkedClientsQ.data.filter((item) => item.role === 'PRIMARY').map((item) => (
                <option key={item.id} value={item.clientCompany.id}>{item.clientCompany.name}</option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {q.isError ? <div className="alert">{(q.error as any)?.message || String(q.error)}</div> : null}

      <div className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <div className="muted small">Всего заявок</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{q.isFetching ? '—' : fmtNumber(data.createdCount)}</div>
        </div>
        <div>
          <div className="muted small">Backlog open</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{q.isFetching ? '—' : fmtNumber(data.summary?.backlogOpenTotal)}</div>
        </div>
        <div>
          <div className="muted small">SLA нарушено</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{q.isFetching ? '—' : fmtNumber(data.sla.breachedCount)}</div>
        </div>
        <div>
          <div className="muted small">Public quick requests</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{q.isFetching ? '—' : fmtNumber(data.bySource?.PUBLIC_QUICK_REQUEST ?? 0)}</div>
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
          {data.timing.note ? <div className="muted small" style={{ marginTop: 10 }}>{data.timing.note}</div> : null}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Public intake по точкам</h3>
        {!q.isFetching && !(data.publicIntake?.byLocation?.length || 0) ? <div className="muted small">Пока нет публичных заявок по точкам.</div> : null}
        <div style={{ display: 'grid', gap: 8 }}>
          {(data.publicIntake?.byLocation || []).slice(0, 8).map((row) => (
            <div key={row.locationId} className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 600 }}>{row.locationName}</div>
              <div className="muted small">Всего: {fmtNumber(row.total)} · repair: {fmtNumber(row.repairCount)} · note: {fmtNumber(row.noteCount)} · resolved: {fmtNumber(row.resolvedCount)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
