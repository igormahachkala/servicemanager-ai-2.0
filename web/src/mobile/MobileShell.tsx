import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import { useWsInvalidation } from '../ui/useWsInvalidation'
import { useRealtimeNotifications } from '../hooks/useRealtimeNotifications'
import {
  getPendingAndFailedCounts,
  getPendingOfflineActionsCount,
  retryOfflineQueue,
  subscribeOfflineQueue,
  useOnlineStatus,
} from './offlineQueue'
import { getMobileRouteRoot, mobilePath } from './mobileRoute'
import './mobile.css'

type MobileNavItem = {
  id: string
  label: string
  to: string
}

function NavIcon({ id, active }: { id: string; active: boolean }) {
  const stroke = active ? '#2563eb' : '#9ca3af'
  const base = { fill: 'none' as const, stroke, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (id === 'home') return (
    <svg width={22} height={22} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
  if (id === 'tickets') return (
    <svg width={22} height={22} viewBox="0 0 24 24" {...base} aria-hidden>
      <rect x="5" y="2" width="14" height="20" rx="2"/>
      <line x1="9" y1="8" x2="15" y2="8"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
      <line x1="9" y1="16" x2="13" y2="16"/>
    </svg>
  )
  if (id === 'notifications') return (
    <svg width={22} height={22} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
  if (id === 'analytics') return (
    <svg width={22} height={22} viewBox="0 0 24 24" {...base} aria-hidden>
      <line x1="3" y1="21" x2="21" y2="21"/>
      <rect x="6" y="11" width="3" height="7"/>
      <rect x="11" y="7" width="3" height="11"/>
      <rect x="16" y="13" width="3" height="5"/>
    </svg>
  )
  if (id === 'chats') return (
    <svg width={22} height={22} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      <path d="M8 9h8" />
      <path d="M8 13h6" />
    </svg>
  )
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" {...base} aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

function isActivePath(pathname: string, target: string) {
  const root = getMobileRouteRoot(pathname)
  if (target === root) return pathname === root
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
  const [queueCounts, setQueueCounts] = useState(() => getPendingAndFailedCounts())
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

  const onNotification = useRealtimeNotifications(`${getMobileRouteRoot(location.pathname)}/tickets/`)
  useWsInvalidation(scope, { onNotification })

  useEffect(() => {
    if (!meQ.data) return
    api.persistScopeFromSearchParams(new URLSearchParams(location.search), meQ.data)
  }, [location.search, meQ.data])

  useEffect(() => {
    const refresh = () => {
      setPendingCount(getPendingOfflineActionsCount())
      setQueueCounts(getPendingAndFailedCounts())
    }
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

  const prevIsOnlineRef = useRef(isOnline)
  useEffect(() => {
    const wasOffline = !prevIsOnlineRef.current
    prevIsOnlineRef.current = isOnline
    if (wasOffline && isOnline && getPendingOfflineActionsCount() > 0 && !retryM.isPending) {
      retryM.mutate()
    }
  }, [isOnline])

  const unread = notifQ.data?.unreadCount ?? 0
  const mobileRoot = getMobileRouteRoot(location.pathname)
  const mobileNavItems: MobileNavItem[] = [
    { id: 'home', label: 'Главная', to: mobileRoot },
    { id: 'tickets', label: 'Заявки', to: mobilePath(location.pathname, '/my') },
    { id: 'create', label: '+', to: mobilePath(location.pathname, '/create') },
    { id: 'analytics', label: 'Аналитика', to: mobilePath(location.pathname, '/analytics') },
    { id: 'chats', label: 'Чаты', to: mobilePath(location.pathname, '/chats') },
  ]

  const notificationsHref = api.appendScopeToPath(mobilePath(location.pathname, '/notifications'), scope, meQ.data)
  const profileHref = api.appendScopeToPath(mobilePath(location.pathname, '/profile'), scope, meQ.data)

  return (
    <div className="mobileShell">
      <header className="mobileTopBar" aria-label="Панель приложения">
        <div className="mobileTopBarMain">
          <div className="mobileTopBarBrandRow">
            <div className="mobileTopBarBrand">Сервис Менеджер</div>
            <div
              className={`mobileTopBarStatusChip ${isOnline ? 'mobileTopBarStatusChip--online' : 'mobileTopBarStatusChip--offline'}`}
              role="status"
              aria-live="polite"
            >
              <span className="mobileConnDot" aria-hidden />
              <span className="mobileConnText">{isOnline ? 'Онлайн' : 'Офлайн'}</span>
            </div>
          </div>
          {canShowLinkedClients ? (
            <div className="mobileTopBarSubline">
              {selectedLinkedClient?.clientCompany.name || 'Клиентский контур'}
            </div>
          ) : null}
        </div>
        <div className="mobileTopBarActions">
          <Link
            className="mobileTopBarAction"
            to={notificationsHref}
            aria-label={unread > 0 ? `Уведомления, непрочитано: ${unread}` : 'Уведомления'}
          >
            <svg className="mobileTopBarActionIcon" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unread > 0 ? <span className="mobileNavBadgeDot" aria-hidden /> : null}
          </Link>
          <Link
            className="mobileTopBarAction"
            to={profileHref}
            aria-label="Профиль"
          >
            <svg className="mobileTopBarActionIcon" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </Link>
        </div>
      </header>
      <main className="mobilePage">
        {!isOnline && pendingCount > 0 ? (
          <Link
            className="mobileOfflineBanner mobileOfflineBannerWarning mobileOfflineBannerLink"
            to={mobilePath(location.pathname, '/offline-queue')}
          >
            <div>Офлайн. Ожидает отправки: {pendingCount}</div>
          </Link>
        ) : !isOnline ? (
          <div className="mobileOfflineBanner mobileOfflineBannerWarning">
            <div>Нет соединения. Показываем сохранённые данные.</div>
          </div>
        ) : queueCounts.failed > 0 ? (
          <Link
            className="mobileOfflineBanner mobileOfflineBannerFailed mobileOfflineBannerLink"
            to={mobilePath(location.pathname, '/offline-queue')}
          >
            <div>Ошибка отправки: {queueCounts.failed}</div>
            <span className="mobileOfflineBannerLinkHint">Открыть очередь ›</span>
          </Link>
        ) : isOnline && pendingCount > 0 ? (
          <div className="mobileOfflineBanner mobileOfflineBannerPending">
            <div>{retryM.isPending ? 'Синхронизация…' : `Ожидает отправки: ${pendingCount}`}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="mobileBtn mobileOfflineBannerBtn" disabled={retryM.isPending} onClick={() => retryM.mutate()}>
                {retryM.isPending ? '…' : 'Отправить'}
              </button>
              <Link
                className="mobileBtn mobileBtnSecondary mobileOfflineBannerBtn"
                to={mobilePath(location.pathname, '/offline-queue')}
              >
                Очередь
              </Link>
            </div>
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
            const isCreate = item.id === 'create'
            if (isCreate) {
              return (
                <Link
                  key={item.id}
                  className="mobileNavItemCreate"
                  to={api.appendScopeToPath(item.to, scope, meQ.data)}
                  aria-label="Создать заявку"
                >
                  <button type="button" className="mobileNavCreateButton" aria-hidden>
                    +
                  </button>
                </Link>
              )
            }
            return (
              <Link
                key={item.id}
                className="mobileNavItem"
                to={api.appendScopeToPath(item.to, scope, meQ.data)}
                aria-current={active ? 'page' : undefined}
              >
                <div className={active ? 'mobileNavButton mobileNavButtonActive' : 'mobileNavButton'}>
                  <span className="mobileNavIconWrap">
                    <NavIcon id={item.id} active={active} />
                    {item.id === 'notifications' && unread > 0 ? <span className="mobileNavBadgeDot" aria-hidden /> : null}
                  </span>
                  <span className="mobileNavLabel">{item.label}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
