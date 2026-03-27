import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU')
  } catch {
    return value
  }
}

function locationLabel(location: api.PublicRequestLocation) {
  return [location.city, location.externalCode || location.platformCode, location.name].filter(Boolean).join(' · ')
}

function contractRoleLabel(role?: api.ServiceContractRole) {
  if (role === 'PRIMARY') return 'PRIMARY'
  if (role === 'SECONDARY') return 'SECONDARY'
  return '—'
}

async function copyText(value: string) {
  if (!value) return false
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    window.prompt('Скопируйте ссылку вручную', value)
    return false
  }
}

export function CompanyPage() {
  const qc = useQueryClient()
  const companyQ = useQuery({ queryKey: ['company'], queryFn: api.company })
  const linkedClientsQ = useQuery({
    queryKey: ['linked-clients'],
    queryFn: api.linkedClients,
    enabled: companyQ.data?.type === 'PROVIDER',
  })
  const linkedProvidersQ = useQuery({
    queryKey: ['linked-providers'],
    queryFn: api.linkedProviders,
    enabled: companyQ.data?.type === 'CLIENT',
  })
  const publicLocationsQ = useQuery({
    queryKey: ['company-public-locations', companyQ.data?.publicRequestToken],
    queryFn: () => api.publicRequestLocations(companyQ.data!.publicRequestToken!),
    enabled: !!companyQ.data?.publicRequestToken,
  })

  const [name, setName] = useState('')
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

  const saveM = useMutation({
    mutationFn: async () => api.updateCompany({
      name: name.trim(),
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
      setSuccess('Настройки компании сохранены')
      api.setCompanyLabel(updated.name || 'Компания')
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
      setSuccess('Публичный токен обновлён')
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

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setErr(null)
    setSuccess(null)

    if (!name.trim()) return setErr('Название компании обязательно')
    if (!timezone.trim()) return setErr('Часовой пояс обязателен')
    if (publicRequestMaxPhotos < 1 || publicRequestMaxPhotos > 3) return setErr('Максимум фото должен быть от 1 до 3')

    saveM.mutate()
  }

  async function handleDownloadCompanyQr() {
    if (!companyQ.data || !baseLink) return
    await downloadQrPosterPng({
      url: baseLink,
      title: companyQ.data.name,
      subtitle: 'Общий QR компании',
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
          <h2 style={{ marginBottom: 4 }}>Компания</h2>
          <div className="muted small">Настройки tenant-компании, public intake и краткая сводка сервисных связей.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/settings"><button className="ghost">К настройкам</button></Link>
          <Link to="/board"><button className="ghost">К доске</button></Link>
        </div>
      </div>

      {err ? <div className="alert">{err}</div> : null}
      {success ? <div className="alert">{success}</div> : null}
      {companyQ.isError ? <div className="alert">{(companyQ.error as any)?.message || String(companyQ.error)}</div> : null}

      <div className="grid2">
        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Профиль компании</h3>
          <form onSubmit={submit} className="form">
            <label>
              Название компании
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название компании" />
            </label>
            <label>
              Тип компании
              <input value={companyQ.data?.type || 'CLIENT'} readOnly />
            </label>
            <label>
              Часовой пояс
              <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="UTC / Europe/Moscow" />
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="checkbox" checked={autoAssignEnabled} onChange={(e) => setAutoAssignEnabled(e.target.checked)} />
              <span>Включить автоназначение</span>
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="checkbox" checked={allowTechnicianClaim} onChange={(e) => setAllowTechnicianClaim(e.target.checked)} />
              <span>Разрешить техникам брать доступные заявки</span>
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="checkbox" checked={slaStrictMode} onChange={(e) => setSlaStrictMode(e.target.checked)} />
              <span>Строгий SLA-режим</span>
            </label>
            <button type="submit" disabled={saveM.isPending}>{saveM.isPending ? 'Сохраняем...' : 'Сохранить'}</button>
          </form>
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Публичные быстрые заявки</h3>
          <form onSubmit={submit} className="form">
            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="checkbox" checked={publicRequestEnabled} onChange={(e) => setPublicRequestEnabled(e.target.checked)} />
              <span>Публичный intake включён</span>
            </label>
            <label>
              Текст на публичной странице
              <textarea value={publicRequestIntro} onChange={(e) => setPublicRequestIntro(e.target.value)} rows={3} />
            </label>
            <label>
              Тип заявки по умолчанию
              <select value={publicRequestDefaultType} onChange={(e) => setPublicRequestDefaultType(e.target.value as api.PublicRequestDefaultType)}>
                <option value="REPAIR">repair</option>
                <option value="NOTE">note</option>
              </select>
            </label>
            <label>
              Режим preset-локации
              <select value={publicRequestLocationPresetMode} onChange={(e) => setPublicRequestLocationPresetMode(e.target.value as api.PublicRequestLocationPresetMode)}>
                <option value="HIDE_WHEN_VALID">Скрывать выбор точки, если preset валиден</option>
                <option value="ALWAYS_OPTIONAL">Разрешать сменить точку даже при preset</option>
              </select>
            </label>
            <label>
              Максимум фото
              <input type="number" min={1} max={3} value={publicRequestMaxPhotos} onChange={(e) => setPublicRequestMaxPhotos(Number(e.target.value) || 1)} disabled={!publicRequestAllowPhotos} />
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="checkbox" checked={publicRequestAllowPhotos} onChange={(e) => setPublicRequestAllowPhotos(e.target.checked)} />
              <span>Разрешить фото</span>
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="checkbox" checked={publicRequestRequirePhone} onChange={(e) => setPublicRequestRequirePhone(e.target.checked)} />
              <span>Телефон обязателен</span>
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="checkbox" checked={publicRequestRateLimitEnabled} onChange={(e) => setPublicRequestRateLimitEnabled(e.target.checked)} />
              <span>Включить rate limiting</span>
            </label>
            <button type="submit" disabled={saveM.isPending}>{saveM.isPending ? 'Сохраняем...' : 'Сохранить public intake'}</button>
          </form>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="panel" style={{ display: 'grid', gap: 10 }}>
          <h3 style={{ marginBottom: 0 }}>QR компании</h3>
          <div className="muted small">Общий QR ведёт на public intake форму компании без preset точки.</div>
          <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{baseLink || 'Публичный токен ещё не создан'}</code>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="ghost" onClick={() => void copyText(baseLink)} disabled={!baseLink}>Скопировать ссылку</button>
            <button type="button" className="ghost" onClick={() => companyQ.data && setQrTarget({ title: companyQ.data.name, subtitle: 'Общий QR компании', url: baseLink, fileName: `public-request-${companyQ.data.name}.png` })} disabled={!baseLink || !companyQ.data}>Показать QR</button>
            <button type="button" className="ghost" onClick={() => void handleDownloadCompanyQr()} disabled={!baseLink || !companyQ.data}>Скачать QR PNG</button>
            <button type="button" className="ghost" onClick={() => regenerateM.mutate()} disabled={regenerateM.isPending}>{regenerateM.isPending ? 'Обновляем...' : 'Обновить токен'}</button>
          </div>
        </div>

        <div className="panel" style={{ display: 'grid', gap: 10 }}>
          <h3 style={{ marginBottom: 0 }}>QR конкретной точки</h3>
          <div className="muted small">Такой QR сразу открывает public форму с уже выбранной точкой.</div>
          <select value={selectedLocationId} onChange={(e) => setSelectedLocationId(e.target.value)} disabled={publicLocationsQ.isLoading || !(publicLocationsQ.data || []).length}>
            {(publicLocationsQ.data || []).map((location) => <option key={location.id} value={location.id}>{locationLabel(location)}</option>)}
          </select>
          {!publicLocationsQ.isLoading && !(publicLocationsQ.data || []).length ? <div className="muted small">Нет активных public-точек для QR.</div> : null}
          <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{presetLink || 'Выберите точку, чтобы получить preset link'}</code>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="ghost" onClick={() => void copyText(presetLink)} disabled={!presetLink}>Скопировать ссылку</button>
            <button type="button" className="ghost" onClick={() => companyQ.data && selectedLocation && setQrTarget({ title: companyQ.data.name, subtitle: locationLabel(selectedLocation), url: presetLink, fileName: `public-request-${companyQ.data.name}-${selectedLocation.id}.png` })} disabled={!presetLink || !companyQ.data || !selectedLocation}>Показать QR точки</button>
            <button type="button" className="ghost" onClick={() => void handleDownloadLocationQr()} disabled={!presetLink || !companyQ.data || !selectedLocation}>Скачать QR PNG</button>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Сервисная сеть</h3>
        {companyQ.data?.type === 'CLIENT' ? (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Подрядчики клиента</div>
            {linkedProvidersQ.isLoading ? <div className="muted small">Загружаем связи...</div> : null}
            {!linkedProvidersQ.isLoading && !(linkedProvidersQ.data || []).length ? <div className="muted small">Активных подрядчиков пока нет.</div> : null}
            <div style={{ display: 'grid', gap: 8 }}>
              {(linkedProvidersQ.data || []).map((contract) => (
                <div key={contract.id} className="card" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 600 }}>{contract.providerCompany.name}</div>
                  <div className="muted small">Статус: {contract.status}</div>
                  <div className="muted small">Роль связи: {contractRoleLabel(contract.role)}</div>
                  <div className="muted small">Действует: {formatDate(contract.startsAt)} — {formatDate(contract.endsAt)}</div>
                  {contract.notes ? <div className="muted small">{contract.notes}</div> : null}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Связанные клиенты провайдера</div>
            {linkedClientsQ.isLoading ? <div className="muted small">Загружаем связи...</div> : null}
            {!linkedClientsQ.isLoading && !(linkedClientsQ.data || []).length ? <div className="muted small">Активных клиентов пока нет.</div> : null}
            <div style={{ display: 'grid', gap: 8 }}>
              {(linkedClientsQ.data || []).map((contract) => (
                <div key={contract.id} className="card" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 600 }}>{contract.clientCompany.name}</div>
                  <div className="muted small">Статус: {contract.status}</div>
                  <div className="muted small">Роль связи: {contractRoleLabel(contract.role)}</div>
                  <div className="muted small">Open tickets: {contract.summary.openTickets} · Locations: {contract.summary.locations}</div>
                  <div className="muted small">Public intake: {contract.summary.publicRequestEnabled ? 'включён' : 'выключен'}</div>
                  <div className="muted small">Действует: {formatDate(contract.startsAt)} — {formatDate(contract.endsAt)}</div>
                  {contract.notes ? <div className="muted small">{contract.notes}</div> : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <PublicQrModal open={!!qrTarget} url={qrTarget?.url || ''} title={qrTarget?.title || 'QR-код'} subtitle={qrTarget?.subtitle} fileName={qrTarget?.fileName || 'public-request-qr.png'} onClose={() => setQrTarget(null)} />
    </div>
  )
}
