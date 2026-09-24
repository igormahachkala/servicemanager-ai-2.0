import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { PublicQrModalLazy, downloadQrPosterPng } from '../components/public/PublicQrLazy'

type CompanyFormValue = {
  name: string
  type: api.CompanyType
  timezone: string
}

type AdminFormValue = {
  firstName: string
  lastName: string
  email: string
  password: string
}

type QrTarget = {
  title: string
  subtitle?: string | null
  url: string
  fileName: string
}

const emptyCompanyForm: CompanyFormValue = {
  name: '',
  type: 'CLIENT',
  timezone: 'UTC',
}

const emptyAdminForm: AdminFormValue = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
}

function displayName(user: { firstName?: string | null; lastName?: string | null; email: string }) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return full || user.email
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

async function copyText(value: string, fallbackLabel = 'Скопируйте ссылку вручную') {
  if (!value) return false
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    window.prompt(fallbackLabel, value)
    return false
  }
}

function modeBadge(label: string, tone: 'platform' | 'observer' | 'public') {
  const palette = {
    platform: { bg: '#eef2ff', border: '#c7d2fe', color: '#3730a3' },
    observer: { bg: '#ecfeff', border: '#a5f3fc', color: '#155e75' },
    public: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534' },
  }[tone]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.color,
      }}
    >
      {label}
    </span>
  )
}

export function CompaniesPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const companiesQ = useQuery({
    queryKey: ['platform-companies'],
    queryFn: api.companies,
    enabled: meQ.data?.role === 'PLATFORM_ADMIN',
  })

  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [companyForm, setCompanyForm] = useState<CompanyFormValue>(emptyCompanyForm)
  const [adminTargetCompanyId, setAdminTargetCompanyId] = useState<string | null>(null)
  const [adminForm, setAdminForm] = useState<AdminFormValue>(emptyAdminForm)
  const [qrTarget, setQrTarget] = useState<QrTarget | null>(null)
  const [locationQrCompanyId, setLocationQrCompanyId] = useState<string | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState('')

  const sortedCompanies = useMemo(() => [...(companiesQ.data || [])], [companiesQ.data])
  const locationQrCompany = useMemo(
    () => sortedCompanies.find((company) => company.id === locationQrCompanyId) || null,
    [sortedCompanies, locationQrCompanyId],
  )

  const locationOptionsQ = useQuery({
    queryKey: ['platform-company-public-locations', locationQrCompany?.id, locationQrCompany?.publicRequestToken],
    queryFn: () => api.publicRequestLocations(locationQrCompany!.publicRequestToken!),
    enabled: !!locationQrCompany?.publicRequestToken,
  })

  useEffect(() => {
    if (!selectedLocationId && locationOptionsQ.data?.length) {
      setSelectedLocationId(locationOptionsQ.data[0].id)
    }
  }, [locationOptionsQ.data, selectedLocationId])

  const selectedLocation = useMemo(
    () => (locationOptionsQ.data || []).find((location) => location.id === selectedLocationId) || null,
    [locationOptionsQ.data, selectedLocationId],
  )

  const createCompanyM = useMutation({
    mutationFn: async () =>
      api.createCompany({
        name: companyForm.name.trim(),
        type: companyForm.type,
        timezone: companyForm.timezone.trim() || 'UTC',
      }),
    onSuccess: async (created) => {
      setErr(null)
      setSuccess(`Компания ${created.name} создана`)
      setCompanyForm(emptyCompanyForm)
      await qc.invalidateQueries({ queryKey: ['platform-companies'] })
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })

  const createAdminM = useMutation({
    mutationFn: async () => {
      if (!adminTargetCompanyId) throw new Error('Компания не выбрана')
      return api.createCompanyAdmin(adminTargetCompanyId, {
        firstName: adminForm.firstName.trim(),
        lastName: adminForm.lastName.trim(),
        email: adminForm.email.trim().toLowerCase(),
        password: adminForm.password,
      })
    },
    onSuccess: async (created) => {
      setErr(null)
      setSuccess(`Первый администратор ${displayName(created)} создан`)
      setAdminTargetCompanyId(null)
      setAdminForm(emptyAdminForm)
      await qc.invalidateQueries({ queryKey: ['platform-companies'] })
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })

  const regenerateTokenM = useMutation({
    mutationFn: async (companyId: string) => api.regeneratePlatformCompanyPublicRequestToken(companyId),
    onSuccess: async (updated) => {
      setErr(null)
      setSuccess(`Публичный токен для ${updated.name} обновлён`)
      if (locationQrCompanyId === updated.id) {
        setSelectedLocationId('')
      }
      await qc.invalidateQueries({ queryKey: ['platform-companies'] })
      await qc.invalidateQueries({ queryKey: ['platform-company-public-locations'] })
    },
    onError: (error: any) => {
      setSuccess(null)
      setErr(error?.message || String(error))
    },
  })

  const impersonateM = useMutation({
    mutationFn: async (company: api.PlatformCompanyItem) => api.impersonate(company.id),
    onSuccess: (result) => {
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

  if (meQ.isLoading) {
    return <div className="panel">Проверяем доступ...</div>
  }

  if (meQ.data?.role !== 'PLATFORM_ADMIN') {
    return <Navigate to={api.getHomeRoute(meQ.data?.role)} replace />
  }

  function submitCompany(event: React.FormEvent) {
    event.preventDefault()
    setErr(null)
    setSuccess(null)

    if (!companyForm.name.trim()) {
      setErr('Название компании обязательно')
      return
    }

    createCompanyM.mutate()
  }

  function submitAdmin(event: React.FormEvent) {
    event.preventDefault()
    setErr(null)
    setSuccess(null)

    if (!adminForm.firstName.trim()) return setErr('Имя обязательно')
    if (!adminForm.lastName.trim()) return setErr('Фамилия обязательна')
    if (!adminForm.email.trim()) return setErr('Email обязателен')
    if (adminForm.password.trim().length < 8) return setErr('Пароль должен содержать минимум 8 символов')

    createAdminM.mutate()
  }

  async function handleDownloadCompanyQr(company: api.PlatformCompanyItem) {
    const link = api.buildPublicRequestLink(company.publicRequestToken)
    if (!link) return

    await downloadQrPosterPng({
      url: link,
      title: company.name,
      subtitle: 'Общий QR компании',
      fileName: `public-request-${company.name}.png`,
    })
  }

  async function handleDownloadLocationQr() {
    if (!locationQrCompany || !selectedLocation) return
    const link = api.buildPublicRequestLink(locationQrCompany.publicRequestToken, selectedLocation.id)
    if (!link) return

    await downloadQrPosterPng({
      url: link,
      title: locationQrCompany.name,
      subtitle: locationLabel(selectedLocation),
      fileName: `public-request-${locationQrCompany.name}-${selectedLocation.id}.png`,
    })
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Компании</h2>
          <div className="muted small">
            Platform control center: создание компаний, observer mode, impersonation и управление public intake.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {modeBadge('Platform mode', 'platform')}
          <Link to="/service-contracts"><button className="ghost">Связи клиент - подрядчик</button></Link>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="row" style={{ alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700 }}>Режим платформы</div>
            <div className="muted small">
              Открывайте компании в observer mode или входите внутрь tenant-контура как ADMIN без повторного логина.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {modeBadge('Observer mode', 'observer')}
            {modeBadge('Public intake', 'public')}
          </div>
        </div>
      </div>

      {err ? <div className="alert">{err}</div> : null}
      {success ? <div className="alert">{success}</div> : null}
      {companiesQ.isError ? <div className="alert">{(companiesQ.error as any)?.message || String(companiesQ.error)}</div> : null}

      <div className="grid2">
        <div className="panel">
          <h3 style={{ marginBottom: 12 }}>Создать компанию</h3>
          <form className="form" onSubmit={submitCompany}>
            <label>
              Название
              <input
                value={companyForm.name}
                onChange={(e) => setCompanyForm((current) => ({ ...current, name: e.target.value }))}
                placeholder="Новая компания"
              />
            </label>

            <label>
              Тип компании
              <select
                value={companyForm.type}
                onChange={(e) => setCompanyForm((current) => ({ ...current, type: e.target.value as api.CompanyType }))}
              >
                <option value="CLIENT">CLIENT</option>
                <option value="PROVIDER">PROVIDER</option>
              </select>
            </label>

            <label>
              Часовой пояс
              <input
                value={companyForm.timezone}
                onChange={(e) => setCompanyForm((current) => ({ ...current, timezone: e.target.value }))}
                placeholder="UTC"
              />
            </label>

            <button type="submit" disabled={createCompanyM.isPending}>
              {createCompanyM.isPending ? 'Создаём...' : 'Создать компанию'}
            </button>
          </form>
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 12 }}>Первый администратор компании</h3>
          {adminTargetCompanyId ? (
            <form className="form" onSubmit={submitAdmin}>
              <label>
                Имя
                <input value={adminForm.firstName} onChange={(e) => setAdminForm((current) => ({ ...current, firstName: e.target.value }))} />
              </label>
              <label>
                Фамилия
                <input value={adminForm.lastName} onChange={(e) => setAdminForm((current) => ({ ...current, lastName: e.target.value }))} />
              </label>
              <label>
                Email
                <input value={adminForm.email} onChange={(e) => setAdminForm((current) => ({ ...current, email: e.target.value }))} placeholder="admin@company.com" />
              </label>
              <label>
                Пароль
                <input type="password" value={adminForm.password} onChange={(e) => setAdminForm((current) => ({ ...current, password: e.target.value }))} placeholder="Минимум 8 символов" />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={createAdminM.isPending}>
                  {createAdminM.isPending ? 'Создаём...' : 'Создать первого администратора'}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setAdminTargetCompanyId(null)
                    setAdminForm(emptyAdminForm)
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          ) : (
            <div className="muted small">Выберите компанию в списке ниже, чтобы создать первого администратора.</div>
          )}
        </div>
      </div>

      {locationQrCompany ? (
        <div className="panel" style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          <div className="row">
            <div>
              <h3 style={{ margin: 0 }}>QR конкретной точки</h3>
              <div className="muted small">Компания: {locationQrCompany.name}</div>
            </div>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setLocationQrCompanyId(null)
                setSelectedLocationId('')
              }}
            >
              Закрыть
            </button>
          </div>

          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            disabled={locationOptionsQ.isLoading || !(locationOptionsQ.data || []).length}
          >
            {(locationOptionsQ.data || []).map((location) => (
              <option key={location.id} value={location.id}>
                {locationLabel(location)}
              </option>
            ))}
          </select>

          {locationOptionsQ.isLoading ? <div className="muted small">Загружаем точки компании...</div> : null}
          {!locationOptionsQ.isLoading && !(locationOptionsQ.data || []).length ? (
            <div className="muted small">У этой компании пока нет активных публичных точек.</div>
          ) : null}

          <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {selectedLocation && locationQrCompany.publicRequestToken
              ? api.buildPublicRequestLink(locationQrCompany.publicRequestToken, selectedLocation.id)
              : 'Выберите точку, чтобы получить preset link'}
          </code>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="ghost"
              onClick={() =>
                selectedLocation &&
                locationQrCompany.publicRequestToken &&
                void copyText(
                  api.buildPublicRequestLink(locationQrCompany.publicRequestToken, selectedLocation.id),
                )
              }
              disabled={!selectedLocation || !locationQrCompany.publicRequestToken}
            >
              Скопировать ссылку
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                if (!selectedLocation || !locationQrCompany.publicRequestToken) return
                window.open(api.buildPublicRequestLink(locationQrCompany.publicRequestToken, selectedLocation.id), '_blank', 'noopener,noreferrer')
              }}
              disabled={!selectedLocation || !locationQrCompany.publicRequestToken}
            >
              Открыть ссылку
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() =>
                selectedLocation &&
                locationQrCompany.publicRequestToken &&
                setQrTarget({
                  title: locationQrCompany.name,
                  subtitle: locationLabel(selectedLocation),
                  url: api.buildPublicRequestLink(locationQrCompany.publicRequestToken, selectedLocation.id),
                  fileName: `public-request-${locationQrCompany.name}-${selectedLocation.id}.png`,
                })
              }
              disabled={!selectedLocation || !locationQrCompany.publicRequestToken}
            >
              QR точки
            </button>
            <button type="button" className="ghost" onClick={() => void handleDownloadLocationQr()} disabled={!selectedLocation || !locationQrCompany.publicRequestToken}>
              Скачать PNG
            </button>
          </div>
        </div>
      ) : null}

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Все компании</h3>
          <div className="muted small">Компаний: {sortedCompanies.length}</div>
        </div>

        {companiesQ.isLoading ? <div className="muted small">Загрузка компаний...</div> : null}
        {!companiesQ.isLoading && sortedCompanies.length === 0 ? <div className="muted small">Компаний пока нет</div> : null}

        <div style={{ display: 'grid', gap: 12 }}>
          {sortedCompanies.map((company) => {
            const activeAdmins = company.admins.filter((admin) => admin.isActive !== false)
            const hasAdmin = activeAdmins.length > 0
            const baseLink = api.buildPublicRequestLink(company.publicRequestToken)
            const isImpersonatingThisCompany = api.getImpersonationMeta()?.companyId === company.id
            const adminButtonTitle = hasAdmin ? 'Switch to this company tenant session' : 'At least one active ADMIN is required'

            return (
              <div key={company.id} className="card" style={{ padding: 16 }}>
                <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 280, display: 'grid', gap: 12 }}>
                    <div>
                      <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ fontWeight: 700 }}>{company.name}</div>
                        {modeBadge(company.type, company.type === 'PROVIDER' ? 'observer' : 'platform')}
                        {company.publicRequestEnabled ? modeBadge('Public intake включён', 'public') : null}
                        {isImpersonatingThisCompany ? modeBadge('Impersonation mode', 'observer') : null}
                      </div>

                      <div className="muted small">Часовой пояс: {company.timezone || 'UTC'}</div>
                      <div className="muted small">Создана: {formatDate(company.createdAt)}</div>
                      <div className="muted small">Админов: {activeAdmins.length}</div>
                      <div className="muted small">Public intake: {company.publicRequestEnabled ? 'включён' : 'выключен'}</div>
                    </div>

                    <div className="panel" style={{ padding: 12, display: 'grid', gap: 8 }}>
                      <div style={{ fontWeight: 700 }}>Platform actions</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Link to={`/company?companyId=${company.id}`}><button className="ghost">Открыть</button></Link>
                        <Link to={`/board?companyId=${company.id}`}><button className="ghost">Observer</button></Link>
                        <Link to={`/analytics?companyId=${company.id}`}><button className="ghost">Открыть аналитику</button></Link>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => impersonateM.mutate(company)}
                          disabled={!hasAdmin || impersonateM.isPending}
                          title={adminButtonTitle}
                        >
                          {impersonateM.isPending ? 'Opening...' : 'Impersonate admin'}
                        </button>
                      </div>
                      {!hasAdmin ? <div className="muted small">No active administrator.</div> : null}
                      {isImpersonatingThisCompany ? <div className="muted small">You are already inside this company.</div> : null}
                      {hasAdmin ? (
                        <div className="muted small">Администратор уже есть</div>
                      ) : (
                        <button
                          className="ghost"
                          onClick={() => {
                            setAdminTargetCompanyId(company.id)
                            setAdminForm(emptyAdminForm)
                            setErr(null)
                            setSuccess(null)
                          }}
                        >
                          Создать первого админа
                        </button>
                      )}
                    </div>

                    <div className="panel" style={{ padding: 12, display: 'grid', gap: 8 }}>
                      <div style={{ fontWeight: 700 }}>Public intake</div>
                      <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {baseLink || 'Публичный токен ещё не создан'}
                      </code>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" className="ghost" onClick={() => void copyText(baseLink)} disabled={!baseLink}>
                          Скопировать public link
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => baseLink && window.open(baseLink, '_blank', 'noopener,noreferrer')}
                          disabled={!baseLink}
                        >
                          Открыть public link
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() =>
                            setQrTarget({
                              title: company.name,
                              subtitle: 'Общий QR компании',
                              url: baseLink,
                              fileName: `public-request-${company.name}.png`,
                            })
                          }
                          disabled={!baseLink}
                        >
                          QR компании
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            setLocationQrCompanyId(company.id)
                            setSelectedLocationId('')
                          }}
                          disabled={!company.publicRequestToken}
                        >
                          QR точки
                        </button>
                        <button type="button" className="ghost" onClick={() => void handleDownloadCompanyQr(company)} disabled={!baseLink}>
                          Скачать PNG
                        </button>
                        <button type="button" className="ghost" onClick={() => regenerateTokenM.mutate(company.id)} disabled={regenerateTokenM.isPending}>
                          {regenerateTokenM.isPending ? 'Обновляем...' : 'Обновить public token'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ width: 280, display: 'grid', gap: 8 }}>
                    <div className="muted small" style={{ marginBottom: 4 }}>Администраторы</div>
                    {company.admins.length === 0 ? (
                      <div className="muted small">Администраторов пока нет</div>
                    ) : (
                      company.admins.map((admin) => (
                        <div key={admin.id} className="card" style={{ padding: 12 }}>
                          <div style={{ fontWeight: 600 }}>{displayName(admin)}</div>
                          <div className="muted small">{admin.email}</div>
                          <div className="muted small">{admin.isActive === false ? 'Неактивен' : 'Активен'}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <PublicQrModalLazy
        open={!!qrTarget}
        url={qrTarget?.url || ''}
        title={qrTarget?.title || 'QR-код'}
        subtitle={qrTarget?.subtitle}
        fileName={qrTarget?.fileName || 'public-request-qr.png'}
        onClose={() => setQrTarget(null)}
      />
    </div>
  )
}
