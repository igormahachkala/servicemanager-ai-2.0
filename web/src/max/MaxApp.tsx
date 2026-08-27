import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import * as api from '../lib/api'
import {
  getMaxEnvironmentContext,
  getStartParamFromLocation,
  getWebApp,
  loadMaxBridgeScript,
  parseStartParam,
  type MaxWebApp,
} from './maxBridge'
import { MaxTicketEntry } from './MaxTicketEntry'
import {
  MAX_APP_ERROR_MESSAGE,
  MAX_APP_ERROR_TITLE,
  MAX_AUTH_TIMEOUT_MS,
  MAX_CONTEXT_UNAVAILABLE_MESSAGE,
  MAX_CONTEXT_UNAVAILABLE_TITLE,
  classifyMaxAuthFailure,
  hasSmaSessionToken,
  isMaxContextAvailable,
  resolveMaxReturnTo,
  type MaxBootstrapState,
} from './maxBootstrap'

const rootStyle: React.CSSProperties = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  maxWidth: 480,
  margin: '0 auto',
  padding: 24,
  minHeight: '100dvh',
  boxSizing: 'border-box',
}

const btnStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '12px 16px',
  borderRadius: 10,
  border: 'none',
  background: '#1a73e8',
  color: '#fff',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
}

const btnGhostStyle: React.CSSProperties = {
  ...btnStyle,
  background: 'transparent',
  border: '1px solid #d0d5dd',
  color: '#333',
  fontWeight: 400,
}

function currentMaxRoute(location: ReturnType<typeof useLocation>, startParam?: string | null): string {
  return resolveMaxReturnTo({
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
    startParam,
  })
}

function MaxLoadingScreen({ state }: { state: MaxBootstrapState }) {
  const label = state === 'checking_auth' ? 'Проверяем вход…' : state === 'detecting_context' ? 'Проверяем MAX…' : 'Загрузка…'
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
      <span style={{ color: '#888', fontSize: 15 }}>{label}</span>
    </div>
  )
}

export function MaxApp() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const latestLocationRef = useRef(location)
  latestLocationRef.current = location
  const [bootstrapState, setBootstrapState] = useState<MaxBootstrapState>('loading_bridge')
  const [webApp, setWebApp] = useState<MaxWebApp | null>(null)
  const [returnTo, setReturnTo] = useState('/max')
  const [retryNonce, setRetryNonce] = useState(0)
  const loggedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      setBootstrapState('loading_bridge')
      try {
        await loadMaxBridgeScript()
      } catch {
        if (!cancelled) setBootstrapState('temporary_error')
        return
      }

      if (cancelled) return
      setBootstrapState('detecting_context')
      const app = getWebApp()
      setWebApp(app)
      const envContext = getMaxEnvironmentContext()
      const rawStartParam = envContext.startParam || getStartParamFromLocation()
      const nextReturnTo = currentMaxRoute(latestLocationRef.current, rawStartParam)
      setReturnTo(nextReturnTo)

      if (!isMaxContextAvailable(envContext)) {
        setBootstrapState('context_unavailable')
        return
      }

      if (!hasSmaSessionToken(api.getToken())) {
        setBootstrapState('unauthenticated')
        return
      }

      setBootstrapState('checking_auth')
      try {
        await api.meWithTimeout(MAX_AUTH_TIMEOUT_MS)
      } catch (err) {
        if (cancelled) return
        const failure = classifyMaxAuthFailure(err)
        if (failure === 'unauthenticated') {
          api.clearToken()
          queryClient.clear()
          setBootstrapState('unauthenticated')
          return
        }
        setBootstrapState('temporary_error')
        return
      }

      if (!cancelled) setBootstrapState('authenticated')
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [queryClient, retryNonce])

  useEffect(() => {
    if (!webApp) return
    webApp.ready?.()
    webApp.BackButton?.hide()
  }, [webApp])

  useEffect(() => {
    const ctx = getMaxEnvironmentContext()
    if (!ctx.detected || loggedRef.current) return
    loggedRef.current = true
    console.info('[MAX mini app]', {
      platform: ctx.platform || null,
      version: ctx.version || null,
      hasUser: !!ctx.user,
      hasChat: !!ctx.chat,
      startParam: ctx.startParam || null,
      path: location.pathname,
    })
  }, [location.pathname, webApp])

  if (
    bootstrapState === 'loading_bridge' ||
    bootstrapState === 'detecting_context' ||
    bootstrapState === 'checking_auth'
  ) {
    return <MaxLoadingScreen state={bootstrapState} />
  }

  if (bootstrapState === 'temporary_error') {
    return (
      <div style={rootStyle}>
        <h2 style={{ margin: '0 0 12px', fontSize: 20 }}>{MAX_APP_ERROR_TITLE}</h2>
        <p style={{ color: '#666', fontSize: 14, margin: '0 0 20px' }}>{MAX_APP_ERROR_MESSAGE}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button style={btnStyle} onClick={() => setRetryNonce((value) => value + 1)}>Повторить</button>
          <button style={btnGhostStyle} onClick={() => navigate('/m')}>Открыть ServiceManager</button>
        </div>
      </div>
    )
  }

  const envContext = getMaxEnvironmentContext()
  const rawStartParam = envContext.startParam || getStartParamFromLocation()
  const parsed = parseStartParam(rawStartParam)

  if (bootstrapState === 'unauthenticated') {
    return <Navigate to={api.loginPathWithReturnTo(returnTo)} replace />
  }

  if (bootstrapState === 'context_unavailable') {
    return (
      <div style={rootStyle}>
        <h2 style={{ margin: '0 0 16px', fontSize: 20 }}>{MAX_CONTEXT_UNAVAILABLE_TITLE}</h2>
        <div style={{ padding: '12px 16px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, fontSize: 14, marginBottom: 24 }}>
          <strong>{MAX_CONTEXT_UNAVAILABLE_TITLE}</strong>
          <div style={{ marginTop: 4, color: '#666' }}>
            {MAX_CONTEXT_UNAVAILABLE_MESSAGE}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button style={btnStyle} onClick={() => setRetryNonce((value) => value + 1)}>Повторить</button>
          <button style={btnGhostStyle} onClick={() => navigate('/m')}>Открыть ServiceManager</button>
        </div>
        <div style={{ marginTop: 28, fontSize: 11, color: '#bbb', lineHeight: 1.6 }}>
          <div>start_param: {rawStartParam || '(нет)'}</div>
          <div>platform: {envContext.platform || '(не определена)'}</div>
          <div>version: {envContext.version || '(не определена)'}</div>
          <div>initData: {envContext.initData ? 'есть' : 'нет'}</div>
          <div>user: {envContext.user ? 'есть' : 'нет'}</div>
          <div>chat: {envContext.chat ? 'есть' : 'нет'}</div>
        </div>
      </div>
    )
  }

  if (parsed.type === 'ticket' && location.pathname === '/max') {
    return <MaxTicketEntry ticketId={parsed.ticketId} webApp={webApp} />
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#f3f4f6' }}>
      <Outlet />
      {import.meta.env.DEV ? (
        <div style={{ position: 'fixed', left: 8, bottom: 8, zIndex: 9999, fontSize: 10, color: '#6b7280', background: 'rgba(255,255,255,0.9)', padding: '4px 6px', borderRadius: 6 }}>
          MAX: {envContext.platform || '—'} · {envContext.version || '—'} · user:{envContext.user ? 'y' : 'n'} · start:{rawStartParam || '—'}
        </div>
      ) : null}
    </div>
  )
}
