import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  getMaxEnvironmentContext,
  getWebApp,
  isMaxEnvironment,
  getStartParamFromLocation,
  loadMaxBridgeScript,
  parseStartParam,
  type MaxWebApp,
} from './maxBridge'
import { MaxTicketEntry } from './MaxTicketEntry'

type LoadState = 'loading' | 'ready' | 'error'

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

export function MaxApp() {
  const location = useLocation()
  const navigate = useNavigate()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [webApp, setWebApp] = useState<MaxWebApp | null>(null)
  const [loadError, setLoadError] = useState('')
  const loggedRef = useRef(false)

  useEffect(() => {
    loadMaxBridgeScript()
      .then(() => {
        setWebApp(getWebApp())
        setLoadState('ready')
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : String(e))
        setLoadState('error')
      })
  }, [])

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

  if (loadState === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <span style={{ color: '#888', fontSize: 15 }}>Загрузка…</span>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div style={rootStyle}>
        <h2 style={{ margin: '0 0 12px', fontSize: 20 }}>Ошибка загрузки</h2>
        <p style={{ color: '#666', fontSize: 14, margin: '0 0 20px' }}>{loadError}</p>
        <button style={btnStyle} onClick={() => navigate('/m')}>Открыть мобильную версию</button>
      </div>
    )
  }

  const inMax = isMaxEnvironment()
  const envContext = getMaxEnvironmentContext()
  const rawStartParam = envContext.startParam || getStartParamFromLocation()
  const parsed = parseStartParam(rawStartParam)

  if (inMax && parsed.type === 'ticket' && location.pathname === '/max') {
    return <MaxTicketEntry ticketId={parsed.ticketId} webApp={webApp} />
  }

  if (!inMax) {
    return (
      <div style={rootStyle}>
        <h2 style={{ margin: '0 0 16px', fontSize: 20 }}>MAX Mini App context not detected</h2>
        <div style={{ padding: '12px 16px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, fontSize: 14, marginBottom: 24 }}>
          <strong>MAX Mini App context not detected</strong>
          <div style={{ marginTop: 4, color: '#666' }}>
            window.WebApp не обнаружен. Откройте через приложение MAX.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button style={btnStyle} onClick={() => navigate('/m')}>Открыть мобильную версию</button>
          <button style={btnGhostStyle} onClick={() => navigate('/m')}>Открыть заявки</button>
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
