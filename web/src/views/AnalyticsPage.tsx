import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
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
  if (role === 'PRIMARY') return 'Основной подрядчик'
  if (role === 'SECONDARY') return 'Дополнительный подрядчик'
  return ''
}

function isProviderAnalyticsRole(role?: api.Role) {
  return role === 'ADMIN' || role === 'MASTER' || role === 'DISPATCHER' || role === 'NETWORK_DIRECTOR'
}

function buildBoardLink(params: { observerCompanyId?: string | null; linkedClientCompanyId?: string | null }) {
  if (params.observerCompanyId) return `/board?companyId=${params.observerCompanyId}`
  if (params.linkedClientCompanyId) return `/board?linkedClientCompanyId=${params.linkedClientCompanyId}`
  return '/board'
}

function buildAnalyticsLink(linkedClientCompanyId?: string | null) {
  if (!linkedClientCompanyId) return '/analytics'
  return `/analytics?linkedClientCompanyId=${linkedClientCompanyId}`
}

function buildCompanyLink(params: { observerCompanyId?: string | null; linkedClientCompanyId?: string | null }) {
  if (params.observerCompanyId) return `/company?companyId=${params.observerCompanyId}`
  if (params.linkedClientCompanyId) return `/company?linkedClientCompanyId=${params.linkedClientCompanyId}`
  return '/company'
}

export function AnalyticsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const requestedCompanyId = useMemo(() => searchParams.get('companyId')?.trim() || '', [searchParams])
  const requestedLinkedClientCompanyId = useMemo(() => searchParams.get('linkedClientCompanyId')?.trim() || '', [searchParams])

  const observerCompanyId = meQ.data?.role === 'PLATFORM_ADMIN' ? requestedCompanyId : ''
  const isObserverMode = !!observerCompanyId && observerCompanyId !== meQ.data?.companyId

  const observerCompanyQ = useQuery({
    queryKey: ['observer-company', observerCompanyId],
    queryFn: () => api.company(observerCompanyId),
    enabled: !!observerCompanyId && meQ.data?.role === 'PLATFORM_ADMIN',
  })

  const ownCompanyQ = useQuery({
    queryKey: ['analytics-company-context'],
    queryFn: () => api.company(),
    enabled: !observerCompanyId && !!meQ.data && meQ.data.role !== 'PLATFORM_ADMIN',
  })

  const isProviderCompany = !observerCompanyId && ownCompanyQ.data?.type === 'PROVIDER'
  const canShowLinkedClients = isProviderCompany && isProviderAnalyticsRole(meQ.data?.role)

  const linkedClientsQ = useQuery({
    queryKey: ['linked-clients'],
    queryFn: api.getLinkedClients,
    enabled: canShowLinkedClients,
  })

  const primaryLinkedClients = useMemo(
    () => (linkedClientsQ.data || []).filter((item) => item.role === 'PRIMARY'),
    [linkedClientsQ.data],
  )

  const selectedLinkedClient = useMemo(
    () => linkedClientsQ.data?.find((item) => item.clientCompany.id === requestedLinkedClientCompanyId) || null,
    [linkedClientsQ.data, requestedLinkedClientCompanyId],
  )

  const activeLinkedClientCompanyId = selectedLinkedClient?.role === 'PRIMARY' ? selectedLinkedClient.clientCompany.id : ''
  const providerNeedsClientSelection = canShowLinkedClients && !linkedClientsQ.isLoading && primaryLinkedClients.length > 0 && !activeLinkedClientCompanyId
  const providerHasNoLinkedClients = canShowLinkedClients && !linkedClientsQ.isLoading && (linkedClientsQ.data || []).length === 0
  const providerRestrictedSelection = canShowLinkedClients && !!selectedLinkedClient && selectedLinkedClient.role !== 'PRIMARY'

  useEffect(() => {
    if (!canShowLinkedClients) return
    if (requestedLinkedClientCompanyId) return
    if (!primaryLinkedClients.length) return
    navigate(buildAnalyticsLink(primaryLinkedClients[0].clientCompany.id), { replace: true })
  }, [canShowLinkedClients, requestedLinkedClientCompanyId, primaryLinkedClients, navigate])

  const analyticsEnabled = useMemo(() => {
    if (isObserverMode) return true
    if (!canShowLinkedClients) return true
    if (linkedClientsQ.isLoading) return false
    if (providerHasNoLinkedClients) return false
    return !!activeLinkedClientCompanyId
  }, [isObserverMode, canShowLinkedClients, linkedClientsQ.isLoading, providerHasNoLinkedClients, activeLinkedClientCompanyId])

  const q = useQuery<api.AnalyticsOverviewResponse>({
    queryKey: ['analytics', 'overview', activeLinkedClientCompanyId, observerCompanyId],
    queryFn: () =>
      api.analyticsOverview({
        linkedClientCompanyId: observerCompanyId ? undefined : activeLinkedClientCompanyId || undefined,
        companyId: observerCompanyId || undefined,
      }),
    enabled: analyticsEnabled,
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
  const observerLabel = observerCompanyQ.data?.name || observerCompanyId
  const boardLink = buildBoardLink({ observerCompanyId, linkedClientCompanyId: activeLinkedClientCompanyId })
  const companyLink = buildCompanyLink({ observerCompanyId, linkedClientCompanyId: activeLinkedClientCompanyId })

  function onSelectLinkedClient(nextLinkedClientCompanyId: string) {
    navigate(buildAnalyticsLink(nextLinkedClientCompanyId), { replace: false })
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Аналитика</h2>
          <div className="muted small">
            {analyticsEnabled
              ? q.isFetching
                ? 'Загрузка…'
                : raw
                  ? `Обновлено: ${new Date(data.now).toLocaleString('ru-RU')}`
                  : '—'
              : canShowLinkedClients
                ? 'Выберите клиента для просмотра аналитики'
                : '—'}
          </div>
          {selectedLinkedClient ? (
            <div className="muted small" style={{ marginTop: 4 }}>
              Режим подрядчика · Клиент: {selectedLinkedClient.clientCompany.name} · {providerScopeLabel(selectedLinkedClient.role)}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
          <button className="ghost" onClick={() => analyticsEnabled && q.refetch()} disabled={!analyticsEnabled || q.isFetching}>Обновить</button>
          <Link to={boardLink}><button className="ghost">К доске</button></Link>
          <Link to={companyLink}><button className="ghost">К компании</button></Link>
        </div>
      </div>

      {isObserverMode ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Режим просмотра компании: {observerLabel}</div>
          <div className="muted small">PLATFORM_ADMIN просматривает аналитику компании без tenant-имперсонации.</div>
        </div>
      ) : null}

      {canShowLinkedClients ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="row" style={{ marginBottom: 8, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Режим подрядчика</div>
              <div className="muted small">Аналитика открывается только для активного основного клиента и сохраняет тот же контекст, что и доска.</div>
            </div>
            <div style={{ width: '100%', maxWidth: 320, minWidth: 0 }}>
              <select
                value={requestedLinkedClientCompanyId}
                onChange={(e) => onSelectLinkedClient(e.target.value)}
                style={{ width: '100%' }}
                disabled={linkedClientsQ.isLoading || (linkedClientsQ.data || []).length === 0}
              >
                {!requestedLinkedClientCompanyId ? <option value="">Выберите клиента</option> : null}
                {(linkedClientsQ.data || []).map((item) => (
                  <option key={item.clientCompany.id} value={item.clientCompany.id}>
                    {item.clientCompany.name} · {item.role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {linkedClientsQ.isLoading ? <div className="muted small">Загружаем связанных клиентов…</div> : null}
          {providerHasNoLinkedClients ? <div className="muted small">У вашей provider company пока нет активных связанных клиентов.</div> : null}
          {providerNeedsClientSelection ? <div className="muted small">Выберите клиента, чтобы открыть analytics в его контексте.</div> : null}
          {providerRestrictedSelection && selectedLinkedClient ? (
            <div className="muted small">Для клиента {selectedLinkedClient.clientCompany.name} связь имеет роль SECONDARY, поэтому общий обзор аналитики пока недоступен.</div>
          ) : null}
          {selectedLinkedClient && !providerRestrictedSelection ? (
            <div className="card" style={{ padding: 12, marginTop: 8, borderRadius: 12, border: '1px solid #c7d2fe', background: '#eef2ff' }}>
              <div style={{ fontWeight: 700 }}>{selectedLinkedClient.clientCompany.name}</div>
              <div className="muted small" style={{ marginTop: 4 }}>
                {providerScopeLabel(selectedLinkedClient.role)} · открытых заявок: {selectedLinkedClient.summary.openTickets} · локаций: {selectedLinkedClient.summary.locations}
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>
                Публичные заявки: {selectedLinkedClient.summary.publicRequestEnabled ? 'включён' : 'выключен'}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {q.isError ? <div className="alert">{(q.error as any)?.message || String(q.error)}</div> : null}
      {observerCompanyQ.isError ? <div className="alert">{(observerCompanyQ.error as any)?.message || String(observerCompanyQ.error)}</div> : null}
      {ownCompanyQ.isError ? <div className="alert">{(ownCompanyQ.error as any)?.message || String(ownCompanyQ.error)}</div> : null}
      {linkedClientsQ.isError ? <div className="alert">{(linkedClientsQ.error as any)?.message || String(linkedClientsQ.error)}</div> : null}

      {providerHasNoLinkedClients ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 6 }}>Нет связанных клиентов</h3>
          <div className="muted small">Когда у provider company появится ACTIVE PRIMARY ServiceContract, здесь откроется аналитика клиента.</div>
        </div>
      ) : null}

      {providerRestrictedSelection && selectedLinkedClient ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 6 }}>Ограниченный доступ</h3>
          <div className="muted small">Дополнительный подрядчик не получает общий обзор аналитики клиента на этом этапе.</div>
        </div>
      ) : null}

      <div className="panel uiCard" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <div className="muted small">Всего заявок</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{analyticsEnabled && !q.isFetching ? fmtNumber(data.createdCount) : '—'}</div>
        </div>
        <div>
          <div className="muted small">Открытых в бэклоге</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{analyticsEnabled && !q.isFetching ? fmtNumber(data.summary?.backlogOpenTotal) : '—'}</div>
        </div>
        <div>
          <div className="muted small">SLA нарушено</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{analyticsEnabled && !q.isFetching ? fmtNumber(data.sla.breachedCount) : '—'}</div>
        </div>
        <div>
          <div className="muted small">Публичные заявки</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{analyticsEnabled && !q.isFetching ? fmtNumber(data.bySource?.PUBLIC_QUICK_REQUEST ?? 0) : '—'}</div>
        </div>
      </div>

      <div className="grid2">
        <div className="panel uiCard">
          <h3 style={{ marginBottom: 10 }}>Открытые по статусам</h3>
          <div className="kv uiKv">
            <div className="k">Новые</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtNumber(data.openByStatus.NEW) : '—'}</div>
            <div className="k">Назначенные</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtNumber(data.openByStatus.ASSIGNED) : '—'}</div>
            <div className="k">В работе</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtNumber(data.openByStatus.IN_PROGRESS) : '—'}</div>
            <div className="k">Всего открытых</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtNumber(openTotal) : '—'}</div>
            <div className="k">Без назначения</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtNumber(data.summary?.unassignedOpenTickets) : '—'}</div>
          </div>
        </div>

        <div className="panel uiCard">
          <h3 style={{ marginBottom: 10 }}>SLA и средние времена</h3>
          <div className="kv uiKv">
            <div className="k">Проверено по SLA</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtNumber(data.sla.evaluatedCount) : '—'}</div>
            <div className="k">SLA в норме %</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtPercent(data.sla.okPercent) : '—'}</div>
            <div className="k">SLA нарушено %</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtPercent(data.sla.breachedPercent) : '—'}</div>
            <div className="k">До назначения</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtMinutes(data.timing.meanTimeToAssignMinutes) : '—'}</div>
            <div className="k">До завершения</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtMinutes(data.timing.meanTimeToResolveMinutes) : '—'}</div>
          </div>
          {analyticsEnabled && data.timing.note ? <div className="muted small" style={{ marginTop: 10 }}>{data.timing.note}</div> : null}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Публичные заявки по точкам</h3>
        {analyticsEnabled && !q.isFetching && !(data.publicIntake?.byLocation?.length || 0) ? <div className="muted small">Пока нет публичных заявок по точкам.</div> : null}
        {!analyticsEnabled && canShowLinkedClients ? <div className="muted small">Выберите доступного клиента, чтобы увидеть разрез по точкам.</div> : null}
        <div style={{ display: 'grid', gap: 8 }}>
          {(data.publicIntake?.byLocation || []).slice(0, 8).map((row) => (
            <div key={row.locationId} className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 600 }}>{row.locationName}</div>
              <div className="muted small">Всего: {fmtNumber(row.total)} · ремонт: {fmtNumber(row.repairCount)} · заметка: {fmtNumber(row.noteCount)} · решено: {fmtNumber(row.resolvedCount)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
