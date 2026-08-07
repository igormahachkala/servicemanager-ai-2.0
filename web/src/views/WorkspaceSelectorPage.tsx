import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import { getAvailableWorkspaces, type WorkspaceCard } from '../lib/navigation'
import { SmaBrandLogo } from '../components/SmaBrandLogo'
import { useSessionRecoveryRefetch } from '../hooks/useSessionRecoveryRefetch'
import {
  SESSION_TEMPORARY_UNAVAILABLE_MESSAGE,
  buildLoginPathWithReturnTo,
  isTransientSessionState,
  resolveSessionState,
  sessionCheckQueryOptions,
} from '../lib/sessionContinuity'
import '../mobile/mobile.css'

/**
 * Экран выбора контура после логина (/workspaces).
 *
 * Показывает доступные пользователю контуры (управленческая часть, мобильная
 * версия, IT Company). Видимость карточек считается в `getAvailableWorkspaces`
 * (IT Company — строго PLATFORM_ADMIN). Если контур ровно один — сразу
 * переходим в него, не показывая выбор.
 */
export function WorkspaceSelectorPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me, ...sessionCheckQueryOptions })
  const user = meQ.data
  const sessionState = resolveSessionState({
    hasSessionData: !!user,
    isError: meQ.isError,
    error: meQ.error,
  })
  const hasTransientSessionIssue = meQ.isError && isTransientSessionState(sessionState)

  const scope = useMemo(() => (user ? api.restoreScopeForUser(user) : {}), [user])
  const workspaces = useMemo(() => getAvailableWorkspaces(user), [user])

  useSessionRecoveryRefetch({
    enabled: hasTransientSessionIssue,
    refetch: meQ.refetch,
  })

  function resolvePath(ws: WorkspaceCard): string {
    // IT Company не использует scope-параметры заявок.
    if (ws.id === 'it') return ws.to
    return api.appendScopeToPath(ws.to, scope, user)
  }

  // Невалидный токен — назад на логин. Временные ошибки не разлогинивают.
  useEffect(() => {
    if (!meQ.isError || sessionState !== 'AUTH_EXPIRED') return
    api.clearToken()
    queryClient.clear()
    navigate(buildLoginPathWithReturnTo('/workspaces'), { replace: true })
  }, [meQ.isError, navigate, queryClient, sessionState])

  // Единственный доступный контур — переходим сразу.
  useEffect(() => {
    if (!user || workspaces.length !== 1) return
    navigate(resolvePath(workspaces[0]), { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, workspaces])

  function logout() {
    api.clearToken()
    queryClient.clear()
    navigate('/login', { replace: true })
  }

  function enter(ws: WorkspaceCard) {
    navigate(resolvePath(ws), { replace: true })
  }

  return (
    <div className="page loginPageRoot">
      <div className="card loginPageCard">
        <div className="loginPageHeader">
          <h1 style={{ marginBottom: 6 }}>Сервис Менеджер</h1>
          <div className="muted">Платформа управления сервисом</div>
        </div>

        <div className="loginModePicker">
          <div>
            <h2 style={{ marginBottom: 6 }}>Выберите контур</h2>
            <div className="muted small">{user?.email || '—'}</div>
          </div>

          {hasTransientSessionIssue ? (
            <div className="alert" role="status" aria-live="polite">
              {SESSION_TEMPORARY_UNAVAILABLE_MESSAGE}
            </div>
          ) : meQ.isLoading ? (
            <div className="muted small">Загрузка…</div>
          ) : workspaces.length === 0 ? (
            <div className="alert">Нет доступных контуров. Обратитесь в поддержку.</div>
          ) : (
            <div className="loginModeGrid">
              {workspaces.map((ws) => (
                <button key={ws.id} type="button" className="loginModeBtn" onClick={() => enter(ws)}>
                  <span className="loginModeTitle">{ws.title}</span>
                  <span className="loginModeHint">{ws.description}</span>
                </button>
              ))}
            </div>
          )}

          <button type="button" className="ghost loginModeReset" onClick={logout}>
            Войти другим аккаунтом
          </button>
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
        </div>
      </div>
    </div>
  )
}

export default WorkspaceSelectorPage
