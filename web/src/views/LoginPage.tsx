import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../lib/api'

import smaLogo from '../assets/sma-tech.png'
import '../mobile/mobile.css'
import { SupportContactBlock } from '../components/SupportContactBlock'

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
  const [postLoginUser, setPostLoginUser] = useState<api.Me | null>(null)
  const [postLoginScope, setPostLoginScope] = useState<api.TicketScopeParams>({})
  const [mobileEntryLoading, setMobileEntryLoading] = useState(false)
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
      setPostLoginUser(result.user)
      setPostLoginScope(restoredScope)
    } catch (err: any) {
      setError(err?.message || 'Не удалось войти')
    } finally {
      setLoading(false)
    }
  }

  function enterDesktop() {
    if (!postLoginUser) return
    const token = api.getToken()
    if (onLoggedIn && token) {
      onLoggedIn(token)
    }
    navigate(api.appendScopeToPath(api.getHomeRoute(postLoginUser.role), postLoginScope, postLoginUser))
  }

  async function enterMobile() {
    if (!postLoginUser) return
    const token = api.getToken()
    if (onLoggedIn && token) {
      onLoggedIn(token)
    }

    setMobileEntryLoading(true)
    try {
      let profile: api.Me = postLoginUser
      try {
        profile = await api.me()
      } catch {
        /* сеть — используем ответ логина */
      }

      const role = profile.role

      if (api.isClientRole(role)) {
        navigate(api.appendScopeToPath('/m', postLoginScope, profile))
        return
      }

      if (role === 'PLATFORM_ADMIN') {
        navigate(api.appendScopeToPath('/m', postLoginScope, profile))
        return
      }

      if (role === 'TECHNICIAN') {
        let linked = api.resolveTechnicianMobileLinkedClientCompanyId({
          profile,
          postLoginScope,
        }).linkedClientCompanyId
        if (!linked) {
          try {
            const contexts = await api.getTechnicianBoundContexts()
            linked = api.pickFirstTechnicianBoundLinkedClientCompanyId(contexts)
          } catch {
            /* сеть / 403 — без контура */
          }
        }
        const nextScope: api.TicketScopeParams = linked
          ? { ...postLoginScope, linkedClientCompanyId: linked }
          : { ...postLoginScope }
        if (linked) {
          api.persistScopeFromSearchParams(new URLSearchParams({ linkedClientCompanyId: linked }), profile)
        }
        navigate(api.appendScopeToPath('/m', nextScope, profile))
        return
      }

      if (api.shouldFetchDefaultLinkedClientOnMobileEntry(role)) {
        let linkedClientCompanyId = ''
        try {
          const list = await api.getLinkedClients()
          linkedClientCompanyId = api.pickDefaultLinkedClientCompanyId(list)
        } catch {
          /* 403 / сеть — fallback ниже */
        }

        if (!linkedClientCompanyId) {
          linkedClientCompanyId = (
            (postLoginScope.linkedClientCompanyId || '').trim() ||
            api.getLinkedClientCompanyId(profile).trim()
          ).trim()
        }

        const nextScope: api.TicketScopeParams = linkedClientCompanyId
          ? { ...postLoginScope, linkedClientCompanyId }
          : { ...postLoginScope }

        if (linkedClientCompanyId) {
          api.persistScopeFromSearchParams(new URLSearchParams({ linkedClientCompanyId }), profile)
        }
        navigate(api.appendScopeToPath('/m', nextScope, profile))
        return
      }

      navigate(api.appendScopeToPath('/m', postLoginScope, profile))
    } finally {
      setMobileEntryLoading(false)
    }
  }

  function resetSession() {
    api.clearToken()
    setPostLoginUser(null)
    setPostLoginScope({})
    setPassword('')
  }

  return (
    <div className="page loginPageRoot">
      <div className="card loginPageCard">
        <div className="loginPageHeader">
          <h1 style={{ marginBottom: 6 }}>ServiceManager.AI</h1>
          <div className="muted">Service Operations Platform</div>
        </div>

        <h2 style={{ marginBottom: 16 }}>Войти</h2>

        {error && (
          <div className="alert" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        {!postLoginUser ? (
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
        ) : (
          <div className="panel" style={{ padding: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Выберите режим входа</div>
            <div className="muted small" style={{ marginBottom: 12 }}>
              Сессия уже создана. Куда отправить вас дальше?
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <button type="button" className="mobileBtn" onClick={enterDesktop}>
                Вход: управленческая часть
              </button>
              <button
                type="button"
                className="mobileBtn mobileBtnGhost"
                disabled={mobileEntryLoading}
                onClick={() => void enterMobile()}
              >
                {mobileEntryLoading ? 'Открываем...' : 'Вход: мобильная версия для обслуживания'}
              </button>
              <button type="button" className="ghost" onClick={resetSession}>
                Выйти и ввести другой аккаунт
              </button>
            </div>
          </div>
        )}

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
