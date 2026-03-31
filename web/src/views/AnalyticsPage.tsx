import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'

function fmtNumber(v?: number | null) {
  if (typeof v !== 'number' || Number.isNaN(v)) return 'вЂ”'
  return new Intl.NumberFormat('ru-RU').format(v)
}

function fmtMinutes(v?: number | null) {
  if (typeof v !== 'number' || Number.isNaN(v)) return 'вЂ”'
  return `${new Intl.NumberFormat('ru-RU').format(v)} РјРёРЅ`
}

function fmtPercent(v?: number | null) {
  if (typeof v !== 'number' || Number.isNaN(v)) return 'вЂ”'
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(v)}%`
}

function providerScopeLabel(role?: api.ServiceContractRole) {
  if (role === 'PRIMARY') return 'PRIMARY provider'
  if (role === 'SECONDARY') return 'SECONDARY provider'
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
          <h2 style={{ marginBottom: 4 }}>РђРЅР°Р»РёС‚РёРєР°</h2>
          <div className="muted small">
            {analyticsEnabled
              ? q.isFetching
                ? 'Р—Р°РіСЂСѓР·РєР°вЂ¦'
                : raw
                  ? `РћР±РЅРѕРІР»РµРЅРѕ: ${new Date(data.now).toLocaleString('ru-RU')}`
                  : 'вЂ”'
              : canShowLinkedClients
                ? 'Р’С‹Р±РµСЂРёС‚Рµ РєР»РёРµРЅС‚Р° РґР»СЏ РїСЂРѕСЃРјРѕС‚СЂР° Р°РЅР°Р»РёС‚РёРєРё'
                : 'вЂ”'}
          </div>
          {selectedLinkedClient ? (
            <div className="muted small" style={{ marginTop: 4 }}>
              Provider mode В· РљР»РёРµРЅС‚: {selectedLinkedClient.clientCompany.name} В· {providerScopeLabel(selectedLinkedClient.role)}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="ghost" onClick={() => analyticsEnabled && q.refetch()} disabled={!analyticsEnabled || q.isFetching}>РћР±РЅРѕРІРёС‚СЊ</button>
          <Link to={boardLink}><button className="ghost">Рљ РґРѕСЃРєРµ</button></Link>
          <Link to={companyLink}><button className="ghost">Рљ РєРѕРјРїР°РЅРёРё</button></Link>
        </div>
      </div>

      {isObserverMode ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>Р РµР¶РёРј РїСЂРѕСЃРјРѕС‚СЂР° РєРѕРјРїР°РЅРёРё: {observerLabel}</div>
          <div className="muted small">PLATFORM_ADMIN РїСЂРѕСЃРјР°С‚СЂРёРІР°РµС‚ Р°РЅР°Р»РёС‚РёРєСѓ РєРѕРјРїР°РЅРёРё Р±РµР· tenant-РёРјРїРµСЂСЃРѕРЅР°С†РёРё.</div>
        </div>
      ) : null}

      {canShowLinkedClients ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="row" style={{ marginBottom: 8, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Provider mode</div>
              <div className="muted small">Analytics РѕС‚РєСЂС‹РІР°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ РґР»СЏ ACTIVE PRIMARY linked client Рё СЃРѕС…СЂР°РЅСЏРµС‚ С‚РѕС‚ Р¶Рµ scoped context, С‡С‚Рѕ Рё board.</div>
            </div>
            <div style={{ minWidth: 260 }}>
              <select
                value={requestedLinkedClientCompanyId}
                onChange={(e) => onSelectLinkedClient(e.target.value)}
                style={{ width: '100%' }}
                disabled={linkedClientsQ.isLoading || (linkedClientsQ.data || []).length === 0}
              >
                {!requestedLinkedClientCompanyId ? <option value="">Р’С‹Р±РµСЂРёС‚Рµ РєР»РёРµРЅС‚Р°</option> : null}
                {(linkedClientsQ.data || []).map((item) => (
                  <option key={item.clientCompany.id} value={item.clientCompany.id}>
                    {item.clientCompany.name} В· {item.role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {linkedClientsQ.isLoading ? <div className="muted small">Р—Р°РіСЂСѓР¶Р°РµРј СЃРІСЏР·Р°РЅРЅС‹С… РєР»РёРµРЅС‚РѕРІвЂ¦</div> : null}
          {providerHasNoLinkedClients ? <div className="muted small">РЈ РІР°С€РµР№ provider company РїРѕРєР° РЅРµС‚ Р°РєС‚РёРІРЅС‹С… СЃРІСЏР·Р°РЅРЅС‹С… РєР»РёРµРЅС‚РѕРІ.</div> : null}
          {providerNeedsClientSelection ? <div className="muted small">Р’С‹Р±РµСЂРёС‚Рµ РєР»РёРµРЅС‚Р°, С‡С‚РѕР±С‹ РѕС‚РєСЂС‹С‚СЊ analytics РІ РµРіРѕ РєРѕРЅС‚РµРєСЃС‚Рµ.</div> : null}
          {providerRestrictedSelection && selectedLinkedClient ? (
            <div className="muted small">Р”Р»СЏ РєР»РёРµРЅС‚Р° {selectedLinkedClient.clientCompany.name} СЃРІСЏР·СЊ РёРјРµРµС‚ СЂРѕР»СЊ SECONDARY, РїРѕСЌС‚РѕРјСѓ РѕР±С‰РёР№ analytics overview РїРѕРєР° РЅРµРґРѕСЃС‚СѓРїРµРЅ.</div>
          ) : null}
          {selectedLinkedClient && !providerRestrictedSelection ? (
            <div className="card" style={{ padding: 12, marginTop: 8, borderRadius: 12, border: '1px solid #c7d2fe', background: '#eef2ff' }}>
              <div style={{ fontWeight: 700 }}>{selectedLinkedClient.clientCompany.name}</div>
              <div className="muted small" style={{ marginTop: 4 }}>
                {providerScopeLabel(selectedLinkedClient.role)} В· РѕС‚РєСЂС‹С‚С‹С… Р·Р°СЏРІРѕРє: {selectedLinkedClient.summary.openTickets} В· Р»РѕРєР°С†РёР№: {selectedLinkedClient.summary.locations}
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>
                Public intake: {selectedLinkedClient.summary.publicRequestEnabled ? 'РІРєР»СЋС‡С‘РЅ' : 'РІС‹РєР»СЋС‡РµРЅ'}
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
          <h3 style={{ marginBottom: 6 }}>РќРµС‚ СЃРІСЏР·Р°РЅРЅС‹С… РєР»РёРµРЅС‚РѕРІ</h3>
          <div className="muted small">РљРѕРіРґР° Сѓ provider company РїРѕСЏРІРёС‚СЃСЏ ACTIVE PRIMARY ServiceContract, Р·РґРµСЃСЊ РѕС‚РєСЂРѕРµС‚СЃСЏ Р°РЅР°Р»РёС‚РёРєР° РєР»РёРµРЅС‚Р°.</div>
        </div>
      ) : null}

      {providerRestrictedSelection && selectedLinkedClient ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 6 }}>РћРіСЂР°РЅРёС‡РµРЅРЅС‹Р№ РґРѕСЃС‚СѓРї</h3>
          <div className="muted small">SECONDARY provider РЅРµ РїРѕР»СѓС‡Р°РµС‚ РѕР±С‰РёР№ analytics overview РєР»РёРµРЅС‚Р° РЅР° СЌС‚РѕРј СЌС‚Р°РїРµ.</div>
        </div>
      ) : null}

      <div className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <div className="muted small">Р’СЃРµРіРѕ Р·Р°СЏРІРѕРє</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{analyticsEnabled && !q.isFetching ? fmtNumber(data.createdCount) : 'вЂ”'}</div>
        </div>
        <div>
          <div className="muted small">Backlog open</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{analyticsEnabled && !q.isFetching ? fmtNumber(data.summary?.backlogOpenTotal) : 'вЂ”'}</div>
        </div>
        <div>
          <div className="muted small">SLA РЅР°СЂСѓС€РµРЅРѕ</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{analyticsEnabled && !q.isFetching ? fmtNumber(data.sla.breachedCount) : 'вЂ”'}</div>
        </div>
        <div>
          <div className="muted small">Public quick requests</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{analyticsEnabled && !q.isFetching ? fmtNumber(data.bySource?.PUBLIC_QUICK_REQUEST ?? 0) : 'вЂ”'}</div>
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>РћС‚РєСЂС‹С‚С‹Рµ РїРѕ СЃС‚Р°С‚СѓСЃР°Рј</h3>
          <div className="kv">
            <div className="k">РќРѕРІС‹Рµ</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtNumber(data.openByStatus.NEW) : 'вЂ”'}</div>
            <div className="k">РќР°Р·РЅР°С‡РµРЅРЅС‹Рµ</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtNumber(data.openByStatus.ASSIGNED) : 'вЂ”'}</div>
            <div className="k">Р’ СЂР°Р±РѕС‚Рµ</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtNumber(data.openByStatus.IN_PROGRESS) : 'вЂ”'}</div>
            <div className="k">Р’СЃРµРіРѕ РѕС‚РєСЂС‹С‚С‹С…</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtNumber(openTotal) : 'вЂ”'}</div>
            <div className="k">Р‘РµР· РЅР°Р·РЅР°С‡РµРЅРёСЏ</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtNumber(data.summary?.unassignedOpenTickets) : 'вЂ”'}</div>
          </div>
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>SLA Рё СЃСЂРµРґРЅРёРµ РІСЂРµРјРµРЅР°</h3>
          <div className="kv">
            <div className="k">SLA evaluated</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtNumber(data.sla.evaluatedCount) : 'вЂ”'}</div>
            <div className="k">SLA OK %</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtPercent(data.sla.okPercent) : 'вЂ”'}</div>
            <div className="k">SLA breached %</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtPercent(data.sla.breachedPercent) : 'вЂ”'}</div>
            <div className="k">Р”Рѕ РЅР°Р·РЅР°С‡РµРЅРёСЏ</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtMinutes(data.timing.meanTimeToAssignMinutes) : 'вЂ”'}</div>
            <div className="k">Р”Рѕ Р·Р°РІРµСЂС€РµРЅРёСЏ</div>
            <div className="v">{analyticsEnabled && !q.isFetching ? fmtMinutes(data.timing.meanTimeToResolveMinutes) : 'вЂ”'}</div>
          </div>
          {analyticsEnabled && data.timing.note ? <div className="muted small" style={{ marginTop: 10 }}>{data.timing.note}</div> : null}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Public intake РїРѕ С‚РѕС‡РєР°Рј</h3>
        {analyticsEnabled && !q.isFetching && !(data.publicIntake?.byLocation?.length || 0) ? <div className="muted small">РџРѕРєР° РЅРµС‚ РїСѓР±Р»РёС‡РЅС‹С… Р·Р°СЏРІРѕРє РїРѕ С‚РѕС‡РєР°Рј.</div> : null}
        {!analyticsEnabled && canShowLinkedClients ? <div className="muted small">Р’С‹Р±РµСЂРёС‚Рµ РґРѕСЃС‚СѓРїРЅРѕРіРѕ linked client, С‡С‚РѕР±С‹ СѓРІРёРґРµС‚СЊ breakdown РїРѕ С‚РѕС‡РєР°Рј.</div> : null}
        <div style={{ display: 'grid', gap: 8 }}>
          {(data.publicIntake?.byLocation || []).slice(0, 8).map((row) => (
            <div key={row.locationId} className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 600 }}>{row.locationName}</div>
              <div className="muted small">Р’СЃРµРіРѕ: {fmtNumber(row.total)} В· repair: {fmtNumber(row.repairCount)} В· note: {fmtNumber(row.noteCount)} В· resolved: {fmtNumber(row.resolvedCount)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
