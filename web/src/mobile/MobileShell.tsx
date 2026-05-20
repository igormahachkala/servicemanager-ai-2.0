import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
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

export function MobileShell() {
  const location = useLocation()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const queryClient = useQueryClient()
  const isOnline = useOnlineStatus()
  const [pendingCount, setPendingCount] = useState(getPendingOfflineActionsCount())
  const [syncMessage, setSyncMessage] = useState('')

  const scope = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const linked = (params.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
    const company = (params.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
    return {
      linkedClientCompanyId: linked || undefined,
      companyId: company || undefined,
    }
  }, [location.search, meQ.data])

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
