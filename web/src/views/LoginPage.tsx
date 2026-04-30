import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as api from '../lib/api'

import smaLogo from '../assets/sma-tech.png'

type LoginPageProps = {
  onLoggedIn?: (token: string) => void
}

const VERSION = 'v0.1'
const BUILD = '2026'

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

      api.clearImpersonationState()
      api.setToken(result.access_token)
      api.setUserRole(result.user.role)
      api.setCompanyLabel(result.user.companyName || result.user.email)
      const restoredScope = api.restoreScopeForUser(result.user)

      if (onLoggedIn) {
        onLoggedIn(result.access_token)
      }

      navigate(api.appendScopeToPath(api.getHomeRoute(result.user.role), restoredScope, result.user))
    } catch (err: any) {
      setError(err?.message || 'Не удалось войти')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 520, margin: '40px auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h1 style={{ marginBottom: 6 }}>ServiceManager.AI</h1>
          <div className="muted">Service Operations Platform</div>
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

        <div className="panel" style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Публичная регистрация компаний отключена</div>
          <div className="muted small" style={{ marginBottom: 12 }}>
            Новые компании и первые администраторы создаются только через platform-admin flow.
          </div>
          <Link to="/request-access" style={{ textDecoration: 'none' }}>
            <button type="button" className="ghost">Связаться с поддержкой</button>
          </Link>
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
          <img
            src={smaLogo}
            alt="SMA Tech"
            style={{
              width: 120,
              marginBottom: 10,
              opacity: 0.9,
            }}
          />

          <div>Powered by SMA Tech</div>
          <div style={{ opacity: 0.6 }}>Version {VERSION} · Build {BUILD}</div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
