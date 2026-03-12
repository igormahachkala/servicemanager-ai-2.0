import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'

function fmt(dt?: string | null) {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString('ru-RU')
  } catch {
    return dt
  }
}

export function CompanyPage() {
  const qc = useQueryClient()

  const companyQ = useQuery({
    queryKey: ['company'],
    queryFn: api.company,
  })

  const [name, setName] = useState('')
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false)
  const [timezone, setTimezone] = useState('UTC')
  const [allowTechnicianClaim, setAllowTechnicianClaim] = useState(true)
  const [slaStrictMode, setSlaStrictMode] = useState(false)

  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!companyQ.data) return
    setName(companyQ.data.name || '')
    setAutoAssignEnabled(!!companyQ.data.autoAssignEnabled)
    setTimezone(companyQ.data.timezone || 'UTC')
    setAllowTechnicianClaim(companyQ.data.allowTechnicianClaim !== false)
    setSlaStrictMode(!!companyQ.data.slaStrictMode)
  }, [companyQ.data])

  const saveM = useMutation({
    mutationFn: async () => {
      return api.updateCompany({
        name: name.trim(),
        autoAssignEnabled,
        timezone: timezone.trim(),
        allowTechnicianClaim,
        slaStrictMode,
      })
    },
    onSuccess: async (updated) => {
      setErr(null)
      setSuccess('Настройки компании сохранены')
      api.setCompanyLabel(updated.name || 'Компания')

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['company'] }),
        qc.invalidateQueries({ queryKey: ['me'] }),
      ])
    },
    onError: (e: any) => {
      setSuccess(null)
      setErr(e?.message || String(e))
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSuccess(null)

    const trimmedName = name.trim()
    const trimmedTimezone = timezone.trim()

    if (!trimmedName) {
      setErr('Название компании обязательно')
      return
    }

    if (!trimmedTimezone) {
      setErr('Timezone обязательна')
      return
    }

    saveM.mutate()
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Компания</h2>
          <div className="muted small">Tenant-level настройки компании и диспетчеризации</div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/settings">
            <button className="ghost">← К настройкам</button>
          </Link>
          <Link to="/board">
            <button className="ghost">К доске</button>
          </Link>
        </div>
      </div>

      {err ? <div className="alert">{err}</div> : null}
      {success ? <div className="alert">{success}</div> : null}
      {companyQ.isError ? <div className="alert">{(companyQ.error as any)?.message || String(companyQ.error)}</div> : null}

      <div className="grid2">
        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Профиль компании</h3>

          {companyQ.isFetching && !companyQ.data ? <div className="muted small">Загрузка…</div> : null}

          <form onSubmit={submit} className="form">
            <label>
              Название компании
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название компании" />
            </label>

            <label>
              Timezone
              <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="UTC / Europe/Moscow" />
            </label>

            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={autoAssignEnabled}
                onChange={(e) => setAutoAssignEnabled(e.target.checked)}
              />
              <span>Включить auto assign</span>
            </label>

            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={allowTechnicianClaim}
                onChange={(e) => setAllowTechnicianClaim(e.target.checked)}
              />
              <span>Разрешить техникам брать доступные заявки</span>
            </label>

            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={slaStrictMode}
                onChange={(e) => setSlaStrictMode(e.target.checked)}
              />
              <span>Строгий SLA режим</span>
            </label>

            <button type="submit" disabled={saveM.isPending}>
              {saveM.isPending ? 'Сохранение…' : 'Сохранить'}
            </button>

            <div className="muted small">
              Эти параметры уже сохраняются в backend и являются основой для следующих фаз: smart assignment, automation и
              mobile dispatch.
            </div>
          </form>
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Текущее состояние</h3>

          {companyQ.data ? (
            <div className="kv">
              <div className="k">ID компании</div>
              <div className="v">{companyQ.data.id}</div>

              <div className="k">Название</div>
              <div className="v">{companyQ.data.name}</div>

              <div className="k">Auto assign</div>
              <div className="v">{companyQ.data.autoAssignEnabled ? 'Включён' : 'Выключен'}</div>

              <div className="k">Timezone</div>
              <div className="v">{companyQ.data.timezone}</div>

              <div className="k">Technician claim</div>
              <div className="v">{companyQ.data.allowTechnicianClaim ? 'Разрешён' : 'Запрещён'}</div>

              <div className="k">SLA strict mode</div>
              <div className="v">{companyQ.data.slaStrictMode ? 'Включён' : 'Выключен'}</div>

              <div className="k">Создана</div>
              <div className="v">{fmt(companyQ.data.createdAt)}</div>

              <div className="k">Обновлена</div>
              <div className="v">{fmt(companyQ.data.updatedAt)}</div>
            </div>
          ) : (
            <div className="muted small">Нет данных компании</div>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Что это даёт дальше</h3>
        <div className="muted small">
          Этот экран — фундамент для следующей логики платформы: Company Administration, Smart Assignment, Technician
          Mobile Readiness и дальнейшей Automation Phase.
        </div>
      </div>
    </div>
  )
}
