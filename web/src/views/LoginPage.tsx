import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../lib/api'

import '../mobile/mobile.css'
import { SmaBrandLogo } from '../components/SmaBrandLogo'
import { SupportContactBlock } from '../components/SupportContactBlock'

type LoginPageProps = {
  onLoggedIn?: (token: string) => void
}

type PostLoginChoice = {
  user: api.Me
  scope: api.TicketScopeParams
}

const VERSION = 'v0.1'
const BUILD = '2026'

function desktopHomeRoute(role?: api.Role | null) {
  if (role === 'PLATFORM_ADMIN') return '/companies'
  return '/board'
}

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [postLoginChoice, setPostLoginChoice] = useState<PostLoginChoice | null>(null)

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

      setPostLoginChoice({
        user: result.user,
        scope: restoredScope,
      })
      setPassword('')
    } catch (err: any) {
      setError(err?.message || 'Не удалось войти')
    } finally {
      setLoading(false)
    }
  }

  function enterDesktop() {
    if (!postLoginChoice) return
    const nextPath = api.appendScopeToPath(
      desktopHomeRoute(postLoginChoice.user.role),
      postLoginChoice.scope,
      postLoginChoice.user,
    )
    navigate(nextPath, { replace: true })
  }

  function enterMobile() {
    if (!postLoginChoice) return
    const nextPath = api.appendScopeToPath('/m', postLoginChoice.scope, postLoginChoice.user)
    navigate(nextPath, { replace: true })
  }

  function resetLoginChoice() {
    api.clearToken()
    setPostLoginChoice(null)
    setError(null)
  }

  return (
    <div className="page loginPageRoot">
      <div className="card loginPageCard">
        <div className="loginPageHeader">
          <h1 style={{ marginBottom: 6 }}>ServiceManager.AI</h1>
          <div className="muted">Service Operations Platform</div>
        </div>

        {postLoginChoice ? (
          <div className="loginModePicker">
            <div>
              <h2 style={{ marginBottom: 6 }}>Выберите режим</h2>
              <div className="muted small">
                {postLoginChoice.user.email}
              </div>
            </div>
            <div className="loginModeGrid">
              <button type="button" className="loginModeBtn" onClick={enterDesktop}>
                <span className="loginModeTitle">Управленческая часть</span>
                <span className="loginModeHint">Доска, заявки, справочники и отчёты</span>
              </button>
              <button type="button" className="loginModeBtn" onClick={enterMobile}>
                <span className="loginModeTitle">Мобильная версия</span>
                <span className="loginModeHint">Быстрые действия, фото и уведомления</span>
              </button>
            </div>
            <button type="button" className="ghost loginModeReset" onClick={resetLoginChoice}>
              Войти другим аккаунтом
            </button>
          </div>
        ) : (
          <>
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
          </>
        )}

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
          <div style={{ opacity: 0.6, marginTop: 8 }}>Version {VERSION} · Build {BUILD}</div>
        </div>
      </div>

    </div>
  )
}

export default LoginPage
