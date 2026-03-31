import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { PublicQrModal, downloadQrPosterPng } from '../components/public/PublicQrModal'

type QrTarget = {
  title: string
  subtitle?: string | null
  url: string
  fileName: string
}

function formatDate(value?: string | null) {
  if (!value) return 'вЂ”'
  try {
    return new Date(value).toLocaleString('ru-RU')
  } catch {
    return value
  }
}

function locationLabel(location: api.PublicRequestLocation) {
  return [location.city, location.externalCode || location.platformCode, location.name].filter(Boolean).join(' В· ')
}

function contractRoleLabel(role?: api.ServiceContractRole) {
  if (role === 'PRIMARY') return 'PRIMARY'
  if (role === 'SECONDARY') return 'SECONDARY'
  return 'вЂ”'
}

function isProviderManagerRole(role?: api.Role) {
  return role === 'ADMIN' || role === 'MASTER' || role === 'DISPATCHER' || role === 'NETWORK_DIRECTOR'
}

function buildBoardLink(params: { observerCompanyId?: string | null; linkedClientCompanyId?: string | null }) {
  if (params.observerCompanyId) return `/board?companyId=${params.observerCompanyId}`
  if (params.linkedClientCompanyId) return `/board?linkedClientCompanyId=${params.linkedClientCompanyId}`
  return '/board'
}

function buildAnalyticsLink(params: { observerCompanyId?: string | null; linkedClientCompanyId?: string | null }) {
  if (params.observerCompanyId) return `/analytics?companyId=${params.observerCompanyId}`
  if (params.linkedClientCompanyId) return `/analytics?linkedClientCompanyId=${params.linkedClientCompanyId}`
  return '/analytics'
}

function buildCompanyLink(params: { observerCompanyId?: string | null; linkedClientCompanyId?: string | null }) {
  if (params.observerCompanyId) return `/company?companyId=${params.observerCompanyId}`
  if (params.linkedClientCompanyId) return `/company?linkedClientCompanyId=${params.linkedClientCompanyId}`
  return '/company'
}

async function copyText(value: string) {
  if (!value) return false
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    window.prompt('РЎРєРѕРїРёСЂСѓР№С‚Рµ СЃСЃС‹Р»РєСѓ РІСЂСѓС‡РЅСѓСЋ', value)
    return false
  }
}

export function CompanyPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const requestedCompanyId = useMemo(() => searchParams.get('companyId')?.trim() || '', [searchParams])
  const requestedLinkedClientCompanyId = useMemo(() => searchParams.get('linkedClientCompanyId')?.trim() || '', [searchParams])

  const observerCompanyId = meQ.data?.role === 'PLATFORM_ADMIN' ? requestedCompanyId : ''
  const isObserverMode = !!observerCompanyId && observerCompanyId !== meQ.data?.companyId

  const ownCompanyQ = useQuery({
    queryKey: ['company-own-context'],
    queryFn: () => api.company(),
    enabled: !observerCompanyId && !!meQ.data && meQ.data.role !== 'PLATFORM_ADMIN',
  })

  const isProviderCompany = !observerCompanyId && ownCompanyQ.data?.type === 'PROVIDER'
  const canManageLinkedClients = isProviderCompany && isProviderManagerRole(meQ.data?.role)

  const linkedClientsQ = useQuery({
    queryKey: ['linked-clients'],
    queryFn: api.getLinkedClients,
    enabled: canManageLinkedClients,
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
  const isProviderLinkedMode = canManageLinkedClients && !!requestedLinkedClientCompanyId
  const providerNeedsClientSelection = canManageLinkedClients && !linkedClientsQ.isLoading && primaryLinkedClients.length > 0 && !activeLinkedClientCompanyId
  const providerHasNoLinkedClients = canManageLinkedClients && !linkedClientsQ.isLoading && (linkedClientsQ.data || []).length === 0
  const providerRestrictedSelection = canManageLinkedClients && !!selectedLinkedClient && selectedLinkedClient.role !== 'PRIMARY'

  useEffect(() => {
    if (!canManageLinkedClients) return
    if (requestedLinkedClientCompanyId) return
    if (!primaryLinkedClients.length) return
    navigate(buildCompanyLink({ linkedClientCompanyId: primaryLinkedClients[0].clientCompany.id }), { replace: true })
  }, [canManageLinkedClients, requestedLinkedClientCompanyId, primaryLinkedClients, navigate])

  const companyQ = useQuery({
    queryKey: ['company', observerCompanyId, activeLinkedClientCompanyId],
    queryFn: () => api.company(observerCompanyId || undefined, activeLinkedClientCompanyId || undefined),
    enabled: isObserverMode || !canManageLinkedClients || !!activeLinkedClientCompanyId,
  })

  const linkedProvidersQ = useQuery({
    queryKey: ['linked-providers'],
    queryFn: api.linkedProviders,
    enabled: !isObserverMode && !isProviderLinkedMode && companyQ.data?.type === 'CLIENT',
  })

  const publicLocationsQ = useQuery({
    queryKey: ['company-public-locations', companyQ.data?.publicRequestToken],
    queryFn: () => api.publicRequestLocations(companyQ.data!.publicRequestToken!),
    enabled: !isObserverMode && !isProviderLinkedMode && !!companyQ.data?.publicRequestToken,
  })

  const [name, setName] = useState('')
  const [brandName, setBrandName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [taxId, setTaxId] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [signatureLineName, setSignatureLineName] = useState('')
  const [signatureLineTitle, setSignatureLineTitle] = useState('')
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false)
  const [timezone, setTimezone] = useState('UTC')
  const [allowTechnicianClaim, setAllowTechnicianClaim] = useState(true)
  const [slaStrictMode, setSlaStrictMode] = useState(false)
  const [publicRequestEnabled, setPublicRequestEnabled] = useState(true)
  const [publicRequestIntro, setPublicRequestIntro] = useState('')
  const [publicRequestAllowPhotos, setPublicRequestAllowPhotos] = useState(true)
  const [publicRequestMaxPhotos, setPublicRequestMaxPhotos] = useState(3)
  const [publicRequestRequirePhone, setPublicRequestRequirePhone] = useState(true)
  const [publicRequestDefaultType, setPublicRequestDefaultType] = useState<api.PublicRequestDefaultType>('REPAIR')
  const [publicRequestRateLimitEnabled, setPublicRequestRateLimitEnabled] = useState(true)
  const [publicRequestLocationPresetMode, setPublicRequestLocationPresetMode] = useState<api.PublicRequestLocationPresetMode>('HIDE_WHEN_VALID')
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [qrTarget, setQrTarget] = useState<QrTarget | null>(null)

  useEffect(() => {
    if (!companyQ.data) return
    setName(companyQ.data.name || '')
    setBrandName(companyQ.data.brandName || '')
    setLegalName(companyQ.data.legalName || '')
    setCompanyAddress(companyQ.data.address || '')
    setCompanyPhone(companyQ.data.phone || '')
    setCompanyEmail(companyQ.data.email || '')
    setTaxId(companyQ.data.taxId || '')
    setRegistrationNumber(companyQ.data.registrationNumber || '')
    setLogoUrl(companyQ.data.logoUrl || '')
    setSignatureLineName(companyQ.data.signatureLineName || '')
    setSignatureLineTitle(companyQ.data.signatureLineTitle || '')
    setAutoAssignEnabled(!!companyQ.data.autoAssignEnabled)
    setTimezone(companyQ.data.timezone || 'UTC')
    setAllowTechnicianClaim(companyQ.data.allowTechnicianClaim !== false)
    setSlaStrictMode(!!companyQ.data.slaStrictMode)
    setPublicRequestEnabled(companyQ.data.publicRequestEnabled !== false)
    setPublicRequestIntro(companyQ.data.publicRequestIntro || '')
    setPublicRequestAllowPhotos(companyQ.data.publicRequestAllowPhotos !== false)
    setPublicRequestMaxPhotos(companyQ.data.publicRequestMaxPhotos || 3)
    setPublicRequestRequirePhone(companyQ.data.publicRequestRequirePhone !== false)
    setPublicRequestDefaultType((companyQ.data.publicRequestDefaultType || 'REPAIR') as api.PublicRequestDefaultType)
    setPublicRequestRateLimitEnabled(companyQ.data.publicRequestRateLimitEnabled !== false)
    setPublicRequestLocationPresetMode((companyQ.data.publicRequestLocationPresetMode || 'HIDE_WHEN_VALID') as api.PublicRequestLocationPresetMode)
  }, [companyQ.data])

  useEffect(() => {
    if (!selectedLocationId && publicLocationsQ.data?.length) {
      setSelectedLocationId(publicLocationsQ.data[0].id)
    }
  }, [publicLocationsQ.data, selectedLocationId])

  const selectedLocation = useMemo(
    () => (publicLocationsQ.data || []).find((location) => location.id === selectedLocationId) || null,
    [publicLocationsQ.data, selectedLocationId],
  )

  const baseLink = useMemo(() => api.buildPublicRequestLink(companyQ.data?.publicRequestToken), [companyQ.data?.publicRequestToken])
  const presetLink = useMemo(
    () => api.buildPublicRequestLink(companyQ.data?.publicRequestToken, selectedLocationId || null),
    [companyQ.data?.publicRequestToken, selectedLocationId],
  )

  const readOnly = isObserverMode || isProviderLinkedMode
  const canImpersonate = meQ.data?.role === 'PLATFORM_ADMIN' && isObserverMode && !!companyQ.data?.id
  const boardLink = buildBoardLink({ observerCompanyId, linkedClientCompanyId: activeLinkedClientCompanyId })
  const analyticsLink = buildAnalyticsLink({ observerCompanyId, linkedClientCompanyId: activeLinkedClientCompanyId })

  const saveM = useMutation({
    mutationFn: async () =>
      api.updateCompany({
        name: name.trim(),
        brandName: brandName.trim() || null,
        legalName: legalName.trim() || null,
        address: companyAddress.trim() || null,
        phone: companyPhone.trim() || null,
        email: companyEmail.trim() || null,
        taxId: taxId.trim() || null,
        registrationNumber: registrationNumber.trim() || null,
        logoUrl: logoUrl.trim() || null,
        signatureLineName: signatureLineName.trim() || null,
        signatureLineTitle: signatureLineTitle.trim() || null,
        autoAssignEnabled,
        timezone: timezone.trim(),
        allowTechnicianClaim,
        slaStrictMode,
        publicRequestEnabled,
        publicRequestIntro: publicRequestIntro.trim() || null,
        publicRequestAllowPhotos,
        publicRequestMaxPhotos,
        publicRequestRequirePhone,
        publicRequestDefaultType,
        publicRequestRateLimitEnabled,
        publicRequestLocationPresetMode,
      }),
    onSuccess: async (updated) => {
      setErr(null)
      setSuccess('РќР°СЃС‚СЂРѕР№РєРё РєРѕРјРїР°РЅРёРё СЃРѕС…СЂР°РЅРµРЅС‹')
      api.setCompanyLabel(updated.name || 'РљРѕРјРїР°РЅРёСЏ')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['company'] }),
        qc.invalidateQueries({ queryKey: ['me'] }),
        qc.invalidateQueries({ queryKey: ['company-public-locations'] }),
        qc.invalidateQueries({ queryKey: ['linked-clients'] }),
        qc.invalidateQueries({ queryKey: ['linked-providers'] }),
      ])
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })

  const regenerateM = useMutation({
    mutationFn: api.regenerateCompanyPublicRequestToken,
    onSuccess: async () => {
      setErr(null)
      setSuccess('РџСѓР±Р»РёС‡РЅС‹Р№ С‚РѕРєРµРЅ РѕР±РЅРѕРІР»С‘РЅ')
      setSelectedLocationId('')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['company'] }),
        qc.invalidateQueries({ queryKey: ['company-public-locations'] }),
      ])
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })

  const impersonateM = useMutation({
    mutationFn: async () => api.impersonate(companyQ.data!.id),
    onSuccess: async (result) => {
      setErr(null)
      setSuccess(null)
      api.beginImpersonationSession(result)
      qc.clear()
      navigate(api.getHomeRoute('ADMIN'), { replace: true })
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })


  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (readOnly) return
    setErr(null)
    setSuccess(null)

    if (!name.trim()) return setErr('РќР°Р·РІР°РЅРёРµ РєРѕРјРїР°РЅРёРё РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ')
    if (!timezone.trim()) return setErr('Р§Р°СЃРѕРІРѕР№ РїРѕСЏСЃ РѕР±СЏР·Р°С‚РµР»РµРЅ')
    if (publicRequestMaxPhotos < 1 || publicRequestMaxPhotos > 3) return setErr('РњР°РєСЃРёРјСѓРј С„РѕС‚Рѕ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РѕС‚ 1 РґРѕ 3')

    saveM.mutate()
  }

  function onSelectLinkedClient(nextLinkedClientCompanyId: string) {
    navigate(buildCompanyLink({ linkedClientCompanyId: nextLinkedClientCompanyId }), { replace: false })
  }

  async function handleDownloadCompanyQr() {
    if (!companyQ.data || !baseLink) return
    await downloadQrPosterPng({
      url: baseLink,
      title: companyQ.data.name,
      subtitle: 'РћР±С‰РёР№ QR РєРѕРјРїР°РЅРёРё',
      fileName: `public-request-${companyQ.data.name}.png`,
    })
  }

  async function handleDownloadLocationQr() {
    if (!companyQ.data || !selectedLocation || !presetLink) return
    await downloadQrPosterPng({
      url: presetLink,
      title: companyQ.data.name,
      subtitle: locationLabel(selectedLocation),
      fileName: `public-request-${companyQ.data.name}-${selectedLocation.id}.png`,
    })
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>{isProviderLinkedMode ? 'Клиентский контур' : 'Компания'}</h2>
          <div className="muted small">
            {isProviderLinkedMode
              ? 'Связанный клиент в provider scope без перехода в own-tenant режим.'
              : 'Настройки tenant-компании, public intake и краткая сводка сервисных связей.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to={boardLink}><button className="ghost">К доске</button></Link>
          <Link to={analyticsLink}><button className="ghost">К аналитике</button></Link>
        </div>
      </div>

      {isObserverMode ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="row" style={{ alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Режим просмотра компании: {companyQ.data?.name || observerCompanyId}</div>
              <div className="muted small">PLATFORM_ADMIN просматривает компанию в read-only режиме.</div>
            </div>
            {canImpersonate ? (
              <button
                type="button"
                className="ghost"
                onClick={() => impersonateM.mutate()}
                disabled={impersonateM.isPending}
              >
                {impersonateM.isPending ? 'Входим...' : 'Войти как админ'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {canManageLinkedClients ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="row" style={{ marginBottom: 8, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Provider mode</div>
              <div className="muted small">Client summary РѕС‚РєСЂС‹РІР°РµС‚СЃСЏ РІ С‚РѕРј Р¶Рµ linked-client scope, С‡С‚Рѕ Рё board СЃ analytics.</div>
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
          {providerNeedsClientSelection ? <div className="muted small">Р’С‹Р±РµСЂРёС‚Рµ РєР»РёРµРЅС‚Р°, С‡С‚РѕР±С‹ РѕС‚РєСЂС‹С‚СЊ РµРіРѕ summary.</div> : null}
          {providerRestrictedSelection && selectedLinkedClient ? (
            <div className="muted small">Р”Р»СЏ РєР»РёРµРЅС‚Р° {selectedLinkedClient.clientCompany.name} СЃРІСЏР·СЊ РёРјРµРµС‚ СЂРѕР»СЊ SECONDARY, РїРѕСЌС‚РѕРјСѓ РїРѕР»РЅС‹Р№ client summary РїРѕРєР° РЅРµРґРѕСЃС‚СѓРїРµРЅ.</div>
          ) : null}
          {selectedLinkedClient && !providerRestrictedSelection ? (
            <div className="card" style={{ padding: 12, marginTop: 8, borderRadius: 12, border: '1px solid #c7d2fe', background: '#eef2ff' }}>
              <div style={{ fontWeight: 700 }}>{selectedLinkedClient.clientCompany.name}</div>
              <div className="muted small" style={{ marginTop: 4 }}>
                {contractRoleLabel(selectedLinkedClient.role)} В· РѕС‚РєСЂС‹С‚С‹С… Р·Р°СЏРІРѕРє: {selectedLinkedClient.summary.openTickets} В· Р»РѕРєР°С†РёР№: {selectedLinkedClient.summary.locations}
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>
                Public intake: {selectedLinkedClient.summary.publicRequestEnabled ? 'РІРєР»СЋС‡С‘РЅ' : 'РІС‹РєР»СЋС‡РµРЅ'}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {err ? <div className="alert">{err}</div> : null}
      {success ? <div className="alert">{success}</div> : null}
      {companyQ.isError ? <div className="alert">{(companyQ.error as any)?.message || String(companyQ.error)}</div> : null}
      {linkedClientsQ.isError ? <div className="alert">{(linkedClientsQ.error as any)?.message || String(linkedClientsQ.error)}</div> : null}

      {providerHasNoLinkedClients ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 6 }}>РќРµС‚ СЃРІСЏР·Р°РЅРЅС‹С… РєР»РёРµРЅС‚РѕРІ</h3>
          <div className="muted small">РљРѕРіРґР° Сѓ provider company РїРѕСЏРІРёС‚СЃСЏ ACTIVE PRIMARY ServiceContract, Р·РґРµСЃСЊ РѕС‚РєСЂРѕРµС‚СЃСЏ client summary.</div>
        </div>
      ) : null}

      {providerRestrictedSelection && selectedLinkedClient ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 6 }}>РћРіСЂР°РЅРёС‡РµРЅРЅС‹Р№ РґРѕСЃС‚СѓРї</h3>
          <div className="muted small">SECONDARY provider РїРѕРєР° РЅРµ РїРѕР»СѓС‡Р°РµС‚ РїРѕР»РЅС‹Р№ client summary.</div>
        </div>
      ) : null}

      {isProviderLinkedMode && !providerRestrictedSelection && companyQ.data ? (
        <div className="grid2">
          <div className="panel">
            <h3 style={{ marginBottom: 10 }}>РљР°СЂС‚РѕС‡РєР° РєР»РёРµРЅС‚Р°</h3>
            <div className="kv">
              <div className="k">РќР°Р·РІР°РЅРёРµ</div>
              <div className="v">{companyQ.data.name}</div>
              <div className="k">РўРёРї РєРѕРјРїР°РЅРёРё</div>
              <div className="v">{companyQ.data.type || 'CLIENT'}</div>
              <div className="k">Р§Р°СЃРѕРІРѕР№ РїРѕСЏСЃ</div>
              <div className="v">{companyQ.data.timezone}</div>
              <div className="k">Public request</div>
              <div className="v">{companyQ.data.publicRequestEnabled ? 'РІРєР»СЋС‡С‘РЅ' : 'РІС‹РєР»СЋС‡РµРЅ'}</div>
              <div className="k">Р¤РѕС‚Рѕ РІ public intake</div>
              <div className="v">{companyQ.data.publicRequestAllowPhotos ? 'СЂР°Р·СЂРµС€РµРЅС‹' : 'РІС‹РєР»СЋС‡РµРЅС‹'}</div>
              <div className="k">РўРµР»РµС„РѕРЅ РѕР±СЏР·Р°С‚РµР»РµРЅ</div>
              <div className="v">{companyQ.data.publicRequestRequirePhone ? 'РґР°' : 'РЅРµС‚'}</div>
              <div className="k">РЎРѕР·РґР°РЅР°</div>
              <div className="v">{formatDate(companyQ.data.createdAt)}</div>
            </div>
          </div>

          <div className="panel">
            <h3 style={{ marginBottom: 10 }}>РЎРІСЏР·Р°РЅРЅС‹Рµ РїСЂРѕРІР°Р№РґРµСЂС‹ РєР»РёРµРЅС‚Р°</h3>
            {!(companyQ.data.clientContracts || []).length ? <div className="muted small">РЈ РєР»РёРµРЅС‚Р° РїРѕРєР° РЅРµС‚ Р°РєС‚РёРІРЅС‹С… Р·Р°РїРёСЃРµР№ РІ summary.</div> : null}
            <div style={{ display: 'grid', gap: 8 }}>
              {(companyQ.data.clientContracts || []).map((contract) => (
                <div key={contract.id} className="card" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 600 }}>{contract.providerCompany.name}</div>
                  <div className="muted small">РЎС‚Р°С‚СѓСЃ: {contract.status}</div>
                  <div className="muted small">Р РѕР»СЊ СЃРІСЏР·Рё: {contractRoleLabel(contract.role)}</div>
                  <div className="muted small">Р”РµР№СЃС‚РІСѓРµС‚: {formatDate(contract.startsAt)} вЂ” {formatDate(contract.endsAt)}</div>
                  {contract.notes ? <div className="muted small">{contract.notes}</div> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {!isProviderLinkedMode ? (
        <>
          <div className="grid2">
            <div className="panel">
              <h3 style={{ marginBottom: 10 }}>РџСЂРѕС„РёР»СЊ РєРѕРјРїР°РЅРёРё</h3>
              <form onSubmit={submit} className="form">
                <label>
                  РќР°Р·РІР°РЅРёРµ РєРѕРјРїР°РЅРёРё
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="РќР°Р·РІР°РЅРёРµ РєРѕРјРїР°РЅРёРё" disabled={readOnly} />
                </label>
                <label>
                  РўРёРї РєРѕРјРїР°РЅРёРё
                  <input value={companyQ.data?.type || 'CLIENT'} readOnly />
                </label>
                <label>
                  Р§Р°СЃРѕРІРѕР№ РїРѕСЏСЃ
                  <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="UTC / Europe/Moscow" disabled={readOnly} />
                </label>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="checkbox" checked={autoAssignEnabled} onChange={(e) => setAutoAssignEnabled(e.target.checked)} disabled={readOnly} />
                  <span>Р’РєР»СЋС‡РёС‚СЊ Р°РІС‚РѕРЅР°Р·РЅР°С‡РµРЅРёРµ</span>
                </label>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="checkbox" checked={allowTechnicianClaim} onChange={(e) => setAllowTechnicianClaim(e.target.checked)} disabled={readOnly} />
                  <span>Р Р°Р·СЂРµС€РёС‚СЊ С‚РµС…РЅРёРєР°Рј Р±СЂР°С‚СЊ РґРѕСЃС‚СѓРїРЅС‹Рµ Р·Р°СЏРІРєРё</span>
                </label>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="checkbox" checked={slaStrictMode} onChange={(e) => setSlaStrictMode(e.target.checked)} disabled={readOnly} />
                  <span>РЎС‚СЂРѕРіРёР№ SLA-СЂРµР¶РёРј</span>
                </label>
                <button type="submit" disabled={readOnly || saveM.isPending}>{saveM.isPending ? 'РЎРѕС…СЂР°РЅСЏРµРјвЂ¦' : 'РЎРѕС…СЂР°РЅРёС‚СЊ'}</button>
              </form>
            </div>

            <div className="panel">
              <h3 style={{ marginBottom: 10 }}>РџСѓР±Р»РёС‡РЅС‹Рµ Р±С‹СЃС‚СЂС‹Рµ Р·Р°СЏРІРєРё</h3>
              <form onSubmit={submit} className="form">
                <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="checkbox" checked={publicRequestEnabled} onChange={(e) => setPublicRequestEnabled(e.target.checked)} disabled={readOnly} />
                  <span>Public intake РІРєР»СЋС‡С‘РЅ</span>
                </label>
                <label>
                  РљРѕСЂРѕС‚РєРёР№ С‚РµРєСЃС‚ РЅР° public СЃС‚СЂР°РЅРёС†Рµ
                  <textarea value={publicRequestIntro} onChange={(e) => setPublicRequestIntro(e.target.value)} rows={3} disabled={readOnly} />
                </label>
                <label>
                  РўРёРї Р·Р°СЏРІРєРё РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ
                  <select value={publicRequestDefaultType} onChange={(e) => setPublicRequestDefaultType(e.target.value as api.PublicRequestDefaultType)} disabled={readOnly}>
                    <option value="REPAIR">repair</option>
                    <option value="NOTE">note</option>
                  </select>
                </label>
                <label>
                  Р РµР¶РёРј preset-Р»РѕРєР°С†РёРё
                  <select value={publicRequestLocationPresetMode} onChange={(e) => setPublicRequestLocationPresetMode(e.target.value as api.PublicRequestLocationPresetMode)} disabled={readOnly}>
                    <option value="HIDE_WHEN_VALID">РЎРєСЂС‹РІР°С‚СЊ РІС‹Р±РѕСЂ С‚РѕС‡РєРё, РµСЃР»Рё preset РІР°Р»РёРґРµРЅ</option>
                    <option value="ALWAYS_OPTIONAL">Р Р°Р·СЂРµС€Р°С‚СЊ СЃРјРµРЅРёС‚СЊ С‚РѕС‡РєСѓ РґР°Р¶Рµ РїСЂРё preset</option>
                  </select>
                </label>
                <label>
                  РњР°РєСЃРёРјСѓРј С„РѕС‚Рѕ
                  <input type="number" min={1} max={3} value={publicRequestMaxPhotos} onChange={(e) => setPublicRequestMaxPhotos(Number(e.target.value) || 1)} disabled={readOnly || !publicRequestAllowPhotos} />
                </label>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="checkbox" checked={publicRequestAllowPhotos} onChange={(e) => setPublicRequestAllowPhotos(e.target.checked)} disabled={readOnly} />
                  <span>Р Р°Р·СЂРµС€РёС‚СЊ С„РѕС‚Рѕ</span>
                </label>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="checkbox" checked={publicRequestRequirePhone} onChange={(e) => setPublicRequestRequirePhone(e.target.checked)} disabled={readOnly} />
                  <span>РўРµР»РµС„РѕРЅ РѕР±СЏР·Р°С‚РµР»РµРЅ</span>
                </label>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="checkbox" checked={publicRequestRateLimitEnabled} onChange={(e) => setPublicRequestRateLimitEnabled(e.target.checked)} disabled={readOnly} />
                  <span>Р’РєР»СЋС‡РёС‚СЊ rate limiting</span>
                </label>
                <button type="submit" disabled={readOnly || saveM.isPending}>{saveM.isPending ? 'РЎРѕС…СЂР°РЅСЏРµРјвЂ¦' : 'РЎРѕС…СЂР°РЅРёС‚СЊ public intake'}</button>
              </form>
            </div>
          </div>

          <div className="grid2" style={{ marginTop: 12 }}>
            <div className="panel" style={{ display: 'grid', gap: 10 }}>
              <h3 style={{ marginBottom: 0 }}>QR РєРѕРјРїР°РЅРёРё</h3>
              <div className="muted small">РћР±С‰РёР№ QR РІРµРґС‘С‚ РЅР° public intake РєРѕРјРїР°РЅРёРё Р±РµР· preset С‚РѕС‡РєРё.</div>
              <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{baseLink || 'РџСѓР±Р»РёС‡РЅС‹Р№ С‚РѕРєРµРЅ РµС‰С‘ РЅРµ СЃРѕР·РґР°РЅ'}</code>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="ghost" onClick={() => void copyText(baseLink)} disabled={!baseLink}>РЎРєРѕРїРёСЂРѕРІР°С‚СЊ СЃСЃС‹Р»РєСѓ</button>
                <button type="button" className="ghost" onClick={() => companyQ.data && setQrTarget({ title: companyQ.data.name, subtitle: 'РћР±С‰РёР№ QR РєРѕРјРїР°РЅРёРё', url: baseLink, fileName: `public-request-${companyQ.data.name}.png` })} disabled={!baseLink || !companyQ.data}>РџРѕРєР°Р·Р°С‚СЊ QR</button>
                <button type="button" className="ghost" onClick={() => void handleDownloadCompanyQr()} disabled={!baseLink || !companyQ.data}>РЎРєР°С‡Р°С‚СЊ QR PNG</button>
                <button type="button" className="ghost" onClick={() => regenerateM.mutate()} disabled={readOnly || regenerateM.isPending}>{regenerateM.isPending ? 'РћР±РЅРѕРІР»СЏРµРјвЂ¦' : 'РћР±РЅРѕРІРёС‚СЊ С‚РѕРєРµРЅ'}</button>
              </div>
            </div>

            <div className="panel" style={{ display: 'grid', gap: 10 }}>
              <h3 style={{ marginBottom: 0 }}>QR РєРѕРЅРєСЂРµС‚РЅРѕР№ С‚РѕС‡РєРё</h3>
              <div className="muted small">РўР°РєРѕР№ QR СЃСЂР°Р·Сѓ РѕС‚РєСЂС‹РІР°РµС‚ public С„РѕСЂРјСѓ СЃ РІС‹Р±СЂР°РЅРЅРѕР№ С‚РѕС‡РєРѕР№.</div>
              <select value={selectedLocationId} onChange={(e) => setSelectedLocationId(e.target.value)} disabled={publicLocationsQ.isLoading || !(publicLocationsQ.data || []).length}>
                {(publicLocationsQ.data || []).map((location) => <option key={location.id} value={location.id}>{locationLabel(location)}</option>)}
              </select>
              {!publicLocationsQ.isLoading && !(publicLocationsQ.data || []).length ? <div className="muted small">РќРµС‚ Р°РєС‚РёРІРЅС‹С… public-С‚РѕС‡РµРє РґР»СЏ QR.</div> : null}
              <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{presetLink || 'Р’С‹Р±РµСЂРёС‚Рµ С‚РѕС‡РєСѓ, С‡С‚РѕР±С‹ РїРѕР»СѓС‡РёС‚СЊ preset link'}</code>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="ghost" onClick={() => void copyText(presetLink)} disabled={!presetLink}>РЎРєРѕРїРёСЂРѕРІР°С‚СЊ СЃСЃС‹Р»РєСѓ</button>
                <button type="button" className="ghost" onClick={() => companyQ.data && selectedLocation && setQrTarget({ title: companyQ.data.name, subtitle: locationLabel(selectedLocation), url: presetLink, fileName: `public-request-${companyQ.data.name}-${selectedLocation.id}.png` })} disabled={!presetLink || !companyQ.data || !selectedLocation}>РџРѕРєР°Р·Р°С‚СЊ QR С‚РѕС‡РєРё</button>
                <button type="button" className="ghost" onClick={() => void handleDownloadLocationQr()} disabled={!presetLink || !companyQ.data || !selectedLocation}>РЎРєР°С‡Р°С‚СЊ QR PNG</button>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 12 }}>
            <h3 style={{ marginBottom: 10 }}>РЎРµСЂРІРёСЃРЅР°СЏ СЃРµС‚СЊ</h3>
            {companyQ.data?.type === 'CLIENT' ? (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>РџРѕРґСЂСЏРґС‡РёРєРё РєР»РёРµРЅС‚Р°</div>
                {linkedProvidersQ.isLoading ? <div className="muted small">Р—Р°РіСЂСѓР¶Р°РµРј СЃРІСЏР·РёвЂ¦</div> : null}
                {!linkedProvidersQ.isLoading && !(linkedProvidersQ.data || []).length ? <div className="muted small">РђРєС‚РёРІРЅС‹С… РїРѕРґСЂСЏРґС‡РёРєРѕРІ РїРѕРєР° РЅРµС‚.</div> : null}
                <div style={{ display: 'grid', gap: 8 }}>
                  {(linkedProvidersQ.data || []).map((contract: any) => (
                    <div key={contract.id} className="card" style={{ padding: 12 }}>
                      <div style={{ fontWeight: 600 }}>{contract.providerCompany.name}</div>
                      <div className="muted small">РЎС‚Р°С‚СѓСЃ: {contract.status}</div>
                      <div className="muted small">Р РѕР»СЊ СЃРІСЏР·Рё: {contractRoleLabel(contract.role)}</div>
                      <div className="muted small">Р”РµР№СЃС‚РІСѓРµС‚: {formatDate(contract.startsAt)} вЂ” {formatDate(contract.endsAt)}</div>
                      {contract.notes ? <div className="muted small">{contract.notes}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>РЎРІСЏР·Р°РЅРЅС‹Рµ РєР»РёРµРЅС‚С‹ РїСЂРѕРІР°Р№РґРµСЂР°</div>
                {linkedClientsQ.isLoading ? <div className="muted small">Р—Р°РіСЂСѓР¶Р°РµРј СЃРІСЏР·РёвЂ¦</div> : null}
                {!linkedClientsQ.isLoading && !(linkedClientsQ.data || []).length ? <div className="muted small">РђРєС‚РёРІРЅС‹С… РєР»РёРµРЅС‚РѕРІ РїРѕРєР° РЅРµС‚.</div> : null}
                <div style={{ display: 'grid', gap: 8 }}>
                  {(linkedClientsQ.data || []).map((contract: any) => (
                    <div key={contract.id} className="card" style={{ padding: 12 }}>
                      <div style={{ fontWeight: 600 }}>{contract.clientCompany.name}</div>
                      <div className="muted small">РЎС‚Р°С‚СѓСЃ: {contract.status}</div>
                      <div className="muted small">Р РѕР»СЊ СЃРІСЏР·Рё: {contractRoleLabel(contract.role)}</div>
                      <div className="muted small">Open tickets: {contract.summary.openTickets} В· Locations: {contract.summary.locations}</div>
                      <div className="muted small">Public intake: {contract.summary.publicRequestEnabled ? 'РІРєР»СЋС‡С‘РЅ' : 'РІС‹РєР»СЋС‡РµРЅ'}</div>
                      <div className="muted small">Р”РµР№СЃС‚РІСѓРµС‚: {formatDate(contract.startsAt)} вЂ” {formatDate(contract.endsAt)}</div>
                      {contract.notes ? <div className="muted small">{contract.notes}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}

      <PublicQrModal open={!!qrTarget} url={qrTarget?.url || ''} title={qrTarget?.title || 'QR-РєРѕРґ'} subtitle={qrTarget?.subtitle} fileName={qrTarget?.fileName || 'public-request-qr.png'} onClose={() => setQrTarget(null)} />
    </div>
  )
}
