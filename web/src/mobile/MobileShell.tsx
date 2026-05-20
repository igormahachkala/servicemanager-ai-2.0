import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import { useWsInvalidation } from '../ui/useWsInvalidation'
import { useRealtimeNotifications } from '../hooks/useRealtimeNotifications'
import {
  getPendingOfflineActionsCount,
  retryOfflineQueue,
  subscribeOfflineQueue,
  useOnlineStatus,
} from './offlineQueue'
import './mobile.css'

type MobileNavItem = {
  id: string
  label: string
  to: string
}

const mobileNavItems: MobileNavItem[] = [
  { id: 'home', label: 'Главная', to: '/m' },
  { id: 'create', label: 'Создать', to: '/m/create' },
  { id: 'my', label: 'Мои', to: '/m/my' },
  { id: 'profile', label: 'Профиль', to: '/m/profile' },
]

function isActivePath(pathname: string, target: string) {
  if (target === '/m') return pathname === '/m'
  return pathname.startsWith(target)
}

function isProviderLinkedClientRole(role?: api.Role | null) {
  return (
    role === 'ADMIN' ||
    role === 'ADMIN_PROVIDER' ||
    role === 'MASTER' ||
    role === 'DISPATCHER' ||
    role === 'NETWORK_DIRECTOR'
  )
}

export function MobileShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const queryClient = useQueryClient()
  const isOnline = useOnlineStatus()
  const [pendingCount, setPendingCount] = useState(getPendingOfflineActionsCount())
  const [syncMessage, setSyncMessage] = useState('')

  const companyQ = useQuery({
    queryKey: ['mobile-shell-company'],
    queryFn: () => api.company(),
    enabled: !!meQ.data && meQ.data.role !== 'CLIENT' && meQ.data.role !== 'TECHNICIAN',
  })

  const isProviderCompany = companyQ.data?.type === 'PROVIDER'
  const canShowLinkedClients = !!meQ.data && isProviderCompany && isProviderLinkedClientRole(meQ.data.role)

  const linkedClientsQ = useQuery({
    queryKey: ['mobile-shell-linked-clients'],
    queryFn: api.getLinkedClients,
    enabled: canShowLinkedClients,
  })

  const linkedClients = linkedClientsQ.data || []
  const linkedClientsLoaded = !canShowLinkedClients || linkedClientsQ.isSuccess || linkedClientsQ.isError
  const selectedLinkedClientCompanyId = (new URLSearchParams(location.search).get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
  const selectedLinkedClient = useMemo(
    () => linkedClients.find((row) => row.clientCompany.id === selectedLinkedClientCompanyId) || null,
    [linkedClients, selectedLinkedClientCompanyId],
  )

  const scope = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const linked = (params.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
    const company = canShowLinkedClients ? '' : (params.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
    return {
      linkedClientCompanyId: linked || undefined,
      companyId: company || undefined,
    }
  }, [location.search, meQ.data, canShowLinkedClients])

  function updateProviderScope(nextLinkedClientCompanyId: string) {
    const params = new URLSearchParams(location.search)
    params.delete('companyId')
    if (nextLinkedClientCompanyId.trim()) {
      params.set('linkedClientCompanyId', nextLinkedClientCompanyId.trim())
    } else {
      params.delete('linkedClientCompanyId')
    }
    api.persistScopeFromSearchParams(params, meQ.data)
    const next = `${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
    if (next !== `${location.pathname}${location.search}`) {
      navigate(next, { replace: true })
    }
  }

  useEffect(() => {
    if (!canShowLinkedClients) return
    if (!linkedClientsLoaded) return
    const params = new URLSearchParams(location.search)
    const nextLinkedClientCompanyId = selectedLinkedClientCompanyId || api.pickDefaultLinkedClientCompanyId(linkedClients)
    const currentNext = nextLinkedClientCompanyId.trim()
    const needsCompanyCleanup = params.has('companyId')
    const needsLinkedSync = currentNext ? params.get('linkedClientCompanyId') !== currentNext : params.has('linkedClientCompanyId')
    if (!needsCompanyCleanup && !needsLinkedSync) return

    params.delete('companyId')
    if (currentNext) {
      params.set('linkedClientCompanyId', currentNext)
    } else {
      params.delete('linkedClientCompanyId')
    }
    api.persistScopeFromSearchParams(params, meQ.data)
    const next = `${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
    if (next !== `${location.pathname}${location.search}`) {
      navigate(next, { replace: true })
    }
  }, [canShowLinkedClients, linkedClients, linkedClientsLoaded, selectedLinkedClientCompanyId, location.pathname, location.search, meQ.data, navigate])

  const onNotification = useRealtimeNotifications('/m/tickets/')
  useWsInvalidation(scope, { onNotification })

  useEffect(() => {
    if (!meQ.data) return
    api.persistScopeFromSearchParams(new URLSearchParams(location.search), meQ.data)
  }, [location.search, meQ.data])

  useEffect(() => {
    const refresh = () => setPendingCount(getPendingOfflineActionsCount())
    refresh()
    return subscribeOfflineQueue(refresh)
  }, [])

  /** Тот же queryKey, что у `/m/notifications`: оптимистичные PATCH там сразу обновляют бейдж. */
  const notifQ = useQuery({
    queryKey: ['mobile-notifications'],
    queryFn: api.fetchNotifications,
    enabled: !!meQ.data,
    staleTime: 20_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  })

  const retryM = useMutation({
    mutationFn: retryOfflineQueue,
    onMutate: () => setSyncMessage(''),
    onSuccess: async (result) => {
      const { synced, failed } = result
      if (failed > 0) {
        setSyncMessage(`Не удалось отправить: ${failed}. Успешно синхронизировано: ${synced}.`)
      } else if (synced > 0) {
        setSyncMessage(`Изменения отправлены: ${synced}.`)
      } else {
        setSyncMessage('Очередь уже пуста.')
      }
      setPendingCount(getPendingOfflineActionsCount())
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-ticket-detail'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-ticket-attachments'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-ticket-timeline'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-notifications'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
    },
    onError: (error: any) => {
      setSyncMessage(error?.message || String(error))
      setPendingCount(getPendingOfflineActionsCount())
    },
  })

  const unread = notifQ.data?.unreadCount ?? 0

  return (
    <div className="mobileShell">
      <header className="mobileTopBar" aria-label="Действия">
        <div className="mobileTopBarFill" />
        <Link
          className="mobileBellLink"
          to={api.appendScopeToPath('/m/notifications', scope, meQ.data)}
          aria-label={unread > 0 ? `Уведомления, непрочитано: ${unread}` : 'Уведомления'}
        >
          <span className="mobileBellIcon" aria-hidden>
            🔔
          </span>
          {unread > 0 ? (
            <span className="mobileBellBadge" aria-hidden>
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Link>
      </header>
      {canShowLinkedClients ? (
        <div className="mobileProviderContextCard">
          <div className="mobileProviderContextLabel">Клиентский контур</div>
          {linkedClientsLoaded ? (
            linkedClients.length > 0 ? (
              <>
                <div className="mobileProviderContextValue">
                  {selectedLinkedClient?.clientCompany.name || 'Выберите клиента'}
                </div>
                <select
                  className="mobileProviderContextSelect"
                  value={selectedLinkedClientCompanyId}
                  onChange={(e) => updateProviderScope(e.target.value)}
                >
                  <option value="">Выберите клиента</option>
                  {linkedClients.map((item) => (
                    <option key={item.clientCompany.id} value={item.clientCompany.id}>
                      {item.clientCompany.name} · {item.role}
                    </option>
                  ))}
                </select>
                <div className="mobileProviderContextHint">
                  Контекст применяется к доске, созданию заявки и карточкам заявок.
                </div>
              </>
            ) : (
              <div className="mobileProviderContextHint">У этой компании пока нет связанных клиентов.</div>
            )
          ) : (
            <div className="mobileProviderContextHint">Загружаем список клиентов…</div>
          )}
          {linkedClientsQ.isError ? (
            <div className="mobileNotice mobileNoticeError" style={{ marginTop: 8 }}>
              {(linkedClientsQ.error as any)?.message || String(linkedClientsQ.error)}
            </div>
          ) : null}
        </div>
      ) : null}
      <main className="mobilePage">
        {!isOnline ? (
          <div className="mobileOfflineBanner mobileOfflineBannerWarning">
            <div>Офлайн-режим: данные могут быть устаревшими</div>
          </div>
        ) : null}
        {isOnline && pendingCount > 0 ? (
          <div className="mobileOfflineBanner mobileOfflineBannerPending">
            <div>Есть несинхронизированные изменения</div>
            <button type="button" className="mobileBtn mobileOfflineBannerBtn" disabled={retryM.isPending} onClick={() => retryM.mutate()}>
              {retryM.isPending ? 'Отправляем…' : 'Отправить изменения'}
            </button>
          </div>
        ) : null}
        {import.meta.env.DEV ? (
          <div className="mobileDevConnectivityDebug" aria-hidden>
            UI: {isOnline ? 'online' : 'offline'} · navigator.onLine:{' '}
            {typeof navigator !== 'undefined' ? String(navigator.onLine) : 'n/a'} · очередь: {pendingCount}
          </div>
        ) : null}
        {syncMessage ? <div className="mobileNotice mobileNoticeSuccess">{syncMessage}</div> : null}
        <Outlet />
      </main>
      <nav className="mobileBottomNav" aria-label="Мобильная навигация">
        <div className="mobileBottomNavInner">
          {mobileNavItems.map((item) => {
            const active = isActivePath(location.pathname, item.to)
            return (
              <Link
                key={item.id}
                className="mobileNavItem"
                to={api.appendScopeToPath(item.to, scope, meQ.data)}
                aria-current={active ? 'page' : undefined}
              >
                <button type="button" className={active ? 'mobileNavButton mobileNavButtonActive' : 'mobileNavButton'}>
                  {item.label}
                </button>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
