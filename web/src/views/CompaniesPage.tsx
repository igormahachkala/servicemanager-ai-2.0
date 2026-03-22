import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'

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

function fmt(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU')
  } catch {
    return value
  }
}

export function CompaniesPage() {
  const qc = useQueryClient()
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

  const sortedCompanies = useMemo(() => [...(companiesQ.data || [])], [companiesQ.data])

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
      if (!adminTargetCompanyId) throw new Error('Company is not selected')
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

  if (meQ.isLoading) {
    return <div className="panel">Проверяем доступ…</div>
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

    if (!adminForm.firstName.trim()) {
      setErr('Имя обязательно')
      return
    }
    if (!adminForm.lastName.trim()) {
      setErr('Фамилия обязательна')
      return
    }
    if (!adminForm.email.trim()) {
      setErr('Email обязателен')
      return
    }
    if (adminForm.password.trim().length < 8) {
      setErr('Пароль должен содержать минимум 8 символов')
      return
    }

    createAdminM.mutate()
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Компании</h2>
          <div className="muted small">Platform-level управление компаниями и первыми администраторами.</div>
        </div>
        <Link to="/board">
          <button className="ghost">К доске</button>
        </Link>
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
              Тип
              <select
                value={companyForm.type}
                onChange={(e) => setCompanyForm((current) => ({ ...current, type: e.target.value as api.CompanyType }))}
              >
                <option value="CLIENT">CLIENT</option>
                <option value="PROVIDER">PROVIDER</option>
              </select>
            </label>

            <label>
              Timezone
              <input
                value={companyForm.timezone}
                onChange={(e) => setCompanyForm((current) => ({ ...current, timezone: e.target.value }))}
                placeholder="UTC"
              />
            </label>

            <button type="submit" disabled={createCompanyM.isPending}>
              {createCompanyM.isPending ? 'Создаём…' : 'Создать компанию'}
            </button>
          </form>
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 12 }}>Первый администратор компании</h3>

          {adminTargetCompanyId ? (
            <form className="form" onSubmit={submitAdmin}>
              <label>
                Имя
                <input
                  value={adminForm.firstName}
                  onChange={(e) => setAdminForm((current) => ({ ...current, firstName: e.target.value }))}
                />
              </label>

              <label>
                Фамилия
                <input
                  value={adminForm.lastName}
                  onChange={(e) => setAdminForm((current) => ({ ...current, lastName: e.target.value }))}
                />
              </label>

              <label>
                Email
                <input
                  value={adminForm.email}
                  onChange={(e) => setAdminForm((current) => ({ ...current, email: e.target.value }))}
                  placeholder="admin@company.com"
                />
              </label>

              <label>
                Пароль
                <input
                  type="password"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm((current) => ({ ...current, password: e.target.value }))}
                  placeholder="Минимум 8 символов"
                />
              </label>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={createAdminM.isPending}>
                  {createAdminM.isPending ? 'Создаём…' : 'Создать первого администратора'}
                </button>
                <button type="button" className="ghost" onClick={() => { setAdminTargetCompanyId(null); setAdminForm(emptyAdminForm) }}>
                  Отмена
                </button>
              </div>
            </form>
          ) : (
            <div className="muted small">Выберите компанию в списке ниже, чтобы создать первого администратора.</div>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Все компании</h3>
          <div className="muted small">Компаний: {sortedCompanies.length}</div>
        </div>

        {companiesQ.isLoading ? <div className="muted small">Загрузка компаний…</div> : null}
        {!companiesQ.isLoading && sortedCompanies.length === 0 ? <div className="muted small">Компаний пока нет</div> : null}

        <div style={{ display: 'grid', gap: 12 }}>
          {sortedCompanies.map((company) => {
            const hasAdmin = company.admins.some((admin) => admin.isActive !== false)
            return (
              <div key={company.id} className="card" style={{ padding: 16 }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{company.name}</div>
                    <div className="muted small">{company.type} · {company.timezone || 'UTC'}</div>
                    <div className="muted small">Создана: {fmt(company.createdAt)}</div>
                  </div>

                  <button
                    className="ghost"
                    onClick={() => {
                      setAdminTargetCompanyId(company.id)
                      setAdminForm(emptyAdminForm)
                      setErr(null)
                      setSuccess(null)
                    }}
                    disabled={hasAdmin}
                  >
                    {hasAdmin ? 'Администратор уже есть' : 'Создать первого админа'}
                  </button>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="muted small" style={{ marginBottom: 8 }}>Администраторы</div>
                  {company.admins.length === 0 ? (
                    <div className="muted small">Администраторов пока нет</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {company.admins.map((admin) => (
                        <div key={admin.id} className="card" style={{ padding: 12 }}>
                          <div style={{ fontWeight: 600 }}>{displayName(admin)}</div>
                          <div className="muted small">{admin.email}</div>
                          <div className="muted small">{admin.isActive === false ? 'Неактивен' : 'Активен'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}