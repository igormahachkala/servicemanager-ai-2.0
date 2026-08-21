import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../lib/api'

import '../mobile/mobile.css'
import { SmaBrandLogo } from '../components/SmaBrandLogo'
import { SupportContactBlock } from '../components/SupportContactBlock'

type LoginPageProps = {
  onLoggedIn?: (token: string) => void
}

const VERSION = 'v0.1'
const BUILD = '2026'

function getLoginErrorMessage(err: unknown): string {
  if (api.isLoginSessionStorageError(err)) return api.LOGIN_SESSION_STORAGE_ERROR_MESSAGE
  if (err instanceof api.ApiRequestError) {
    if (err.status === 401) return 'Неверный email или пароль.'
    if (err.status === 429) return 'Слишком много попыток входа. Подождите и повторите попытку.'
  }
  return err instanceof Error && err.message ? err.message : 'Не удалось войти'
}

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await api.login({
        email: email.trim().toLowerCase(),
        password,
      })

      api.persistLoginSession(result)

      if (onLoggedIn) {
        onLoggedIn(result.access_token)
      }

      setPassword('')
      // После логина — экран выбора контура.
      navigate('/workspaces', { replace: true })
    } catch (err: unknown) {
      setError(getLoginErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page loginPageRoot">
      <div className="card loginPageCard">
        <div className="loginPageHeader">
          <h1 style={{ marginBottom: 6 }}>Сервис Менеджер</h1>
          <div className="muted">Платформа управления сервисом</div>
        </div>

        <h2 style={{ marginBottom: 16 }}>Войти</h2>

        {error && (
          <div className="alert" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="form">
          <label>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@company.com"
              autoComplete="username"
              disabled={loading}
            />
          </label>

          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              autoComplete="current-password"
              disabled={loading}
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>

        <div className="panel loginSupportPanel" style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Публичная регистрация компаний отключена</div>
          <div className="muted small" style={{ marginBottom: 12 }}>
            Для доступа свяжитесь с поддержкой в Telegram или MAX.
          </div>
          <SupportContactBlock titleTag="h3" />
        </div>

        <div
          style={{
            marginTop: 40,
            paddingTop: 20,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center',
            fontSize: 12,
            opacity: 0.8,
          }}
        >
          <SmaBrandLogo variant="footer" style={{ marginBottom: 10, opacity: 0.9 }} />
          <div className="muted small">Разработано компанией СМА-Тех</div>
          <div style={{ opacity: 0.6, marginTop: 8 }}>Version {VERSION} · Build {BUILD}</div>
        </div>
      </div>

    </div>
  )
}

export default LoginPage
