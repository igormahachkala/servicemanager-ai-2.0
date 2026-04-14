import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'

function roleLabel(role?: string) {
  if (!role) return '—'
  if (role === 'ADMIN') return 'Администратор'
  if (role === 'DISPATCHER') return 'Диспетчер'
  if (role === 'MASTER') return 'Мастер'
  if (role === 'TECHNICIAN') return 'Техник'
  if (role === 'CLIENT') return 'Клиент'
  if (role === 'TERRITORIAL_MANAGER') return 'Территориальный менеджер'
  if (role === 'NETWORK_DIRECTOR') return 'Сетевой директор'
  if (role === 'STAFF') return 'Сотрудник'
  return role
}

export function SettingsPage() {
  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
  })

  const [baseUrl, setBaseUrlState] = useState(api.getBaseUrl())
  const [companyLabel, setCompanyLabelState] = useState(api.getCompanyLabel())
  const [saved, setSaved] = useState<string | null>(null)
  const canManualBackendConfig = api.canUseManualBackendConfig()

  function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    if (canManualBackendConfig) {
      api.setBaseUrl(baseUrl)
    }
    api.setCompanyLabel(companyLabel)
    setSaved('Настройки сохранены. При необходимости обнови страницу.')
    setTimeout(() => setSaved(null), 2500)
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Настройки</h2>
          <div className="muted small">Минимальные настройки V1 для демо и внутренней работы</div>
        </div>

        <div>
          <Link to="/board">
            <button className="ghost">← Назад к доске</button>
          </Link>
        </div>
      </div>

      {saved ? <div className="alert">{saved}</div> : null}
      {meQ.isError ? <div className="alert">{(meQ.error as any)?.message || String(meQ.error)}</div> : null}

      <div className="grid2">
        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Параметры приложения</h3>

          <form onSubmit={saveSettings} className="form">
            {canManualBackendConfig ? (
              <label>
                URL backend (dev)
                <input value={baseUrl} onChange={(e) => setBaseUrlState(e.target.value)} placeholder="http://localhost:3000" />
              </label>
            ) : null}

            <label>
              Название компании в интерфейсе
              <input value={companyLabel} onChange={(e) => setCompanyLabelState(e.target.value)} placeholder="Моя компания" />
            </label>

            <button type="submit">Сохранить настройки</button>

            <div className="muted small">
              {canManualBackendConfig
                ? 'Локальные настройки сохраняются в браузере. Ручной backend URL доступен только в dev-режиме.'
                : 'Локальные настройки сохраняются в браузере. Backend URL фиксирован через VITE_API_BASE_URL.'}
            </div>
          </form>
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Текущий пользователь</h3>

          {meQ.isFetching && !meQ.data ? <div className="muted small">Загрузка…</div> : null}

          {meQ.data ? (
            <div className="kv">
              <div className="k">Email</div>
              <div className="v">{meQ.data.email}</div>

              <div className="k">Роль</div>
              <div className="v">{roleLabel(meQ.data.role)}</div>

              <div className="k">Company ID</div>
              <div className="v">{meQ.data.companyId}</div>

              <div className="k">Backend</div>
              <div className="v">{api.getBaseUrl()}</div>

              <div className="k">Название компании</div>
              <div className="v">{api.getCompanyLabel()}</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Настройки компании</h3>
        <div className="muted small" style={{ marginBottom: 10 }}>
          Здесь можно перейти к tenant-level настройкам компании и диспетчеризации.
        </div>

        <Link to="/company">
          <button>Открыть Company Settings</button>
        </Link>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ marginBottom: 10 }}>Что можно добавить следующим шагом</h3>
        <div className="muted small">
          Редактирование профиля компании, правила SLA, настройки ролей, специализации техников, загрузку логотипа и параметры
          уведомлений.
        </div>
      </div>
    </div>
  )
}
