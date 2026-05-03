import { useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import { formatMobileMutationError } from './mobileActionErrors'

export function MobileNotificationsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const scope = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return {
      linkedClientCompanyId: (params.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim() || undefined,
      companyId: (params.get('companyId') || api.getObserverCompanyId(meQ.data)).trim() || undefined,
    }
  }, [location.search, meQ.data])

  const backHref = useMemo(() => api.appendScopeToPath('/m', scope, meQ.data), [scope, meQ.data])

  const listQ = useQuery({
    queryKey: ['mobile-notifications'],
    queryFn: api.fetchNotifications,
    enabled: !!meQ.data,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  })

  const markOneM = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['mobile-notifications'] })
      const prev = queryClient.getQueryData<api.NotificationsListResponse>(['mobile-notifications'])
      if (!prev) return { prev: undefined as api.NotificationsListResponse | undefined }
      const target = prev.items.find((n) => n.id === id)
      const wasUnread = !!target && !target.readAt
      const readStamp = new Date().toISOString()
      queryClient.setQueryData<api.NotificationsListResponse>(['mobile-notifications'], {
        ...prev,
        unreadCount: wasUnread ? Math.max(0, prev.unreadCount - 1) : prev.unreadCount,
        items: prev.items.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: readStamp } : n)),
      })
      return { prev }
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['mobile-notifications'], ctx.prev)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['mobile-notifications'] })
    },
  })

  const markAllM = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['mobile-notifications'] })
      const prev = queryClient.getQueryData<api.NotificationsListResponse>(['mobile-notifications'])
      if (!prev) return { prev: undefined as api.NotificationsListResponse | undefined }
      const readStamp = new Date().toISOString()
      queryClient.setQueryData<api.NotificationsListResponse>(['mobile-notifications'], {
        items: prev.items.map((n) => ({ ...n, readAt: n.readAt ?? readStamp })),
        unreadCount: 0,
      })
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['mobile-notifications'], ctx.prev)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['mobile-notifications'] })
    },
  })

  const items = listQ.data?.items ?? []

  return (
    <div className="mobileSection">
      <div className="mobileTicketDetailsToolbar">
        <Link to={backHref} className="mobileDetailsBackLink">
          Назад
        </Link>
      </div>
      <div className="mobileNotificationsHeader">
        <h1 className="mobileTitle">Уведомления</h1>
        <button
          type="button"
          className="mobileBtn mobileBtnSecondary mobileNotificationsMarkAll"
          disabled={markAllM.isPending || !items.some((n) => !n.readAt)}
          onClick={() => markAllM.mutate()}
        >
          {markAllM.isPending ? 'Сохраняем…' : 'Прочитать все'}
        </button>
      </div>
      {listQ.isLoading ? <div className="mobileSubtitle">Загрузка…</div> : null}
      {listQ.isError ? (
        <div className="mobileNotice mobileNoticeError">
          {formatMobileMutationError(listQ.error, { operation: 'other' })}
        </div>
      ) : null}
      {!listQ.isLoading && items.length === 0 ? (
        <div className="mobileCard mobileEmptyState mobileNotificationsEmpty" role="status">
          <div className="mobileEmptyStateTitle">Уведомлений нет</div>
          <p className="mobileEmptyStateHint">Сюда попадают назначения, смена статусов и другие события по вашим заявкам.</p>
        </div>
      ) : null}
      {items.length > 0 ? (
        <ul className="mobileNotificationsList">
          {items.map((n) => {
            const ticketScope = {
              linkedClientCompanyId: (n.linkedClientCompanyId || scope.linkedClientCompanyId || '').trim() || undefined,
              companyId: scope.companyId,
            }
            const href =
              n.entityType === 'Ticket'
                ? api.appendScopeToPath(`/m/tickets/${encodeURIComponent(n.entityId)}`, ticketScope, meQ.data)
                : undefined
            const unread = !n.readAt
            const tone = api.getNotificationTypeTone(n.type)
            const typeLabel = api.getNotificationTypeLabel(n.type)
            const when = api.formatNotificationDateTime(n.createdAt)
            return (
              <li
                key={n.id}
                className={
                  unread
                    ? 'mobileNotificationRow mobileNotificationRowUnread'
                    : 'mobileNotificationRow mobileNotificationRowRead'
                }
              >
                {href ? (
                  <button
                    type="button"
                    className="mobileNotificationBtn"
                    disabled={markOneM.isPending}
                    onClick={async () => {
                      if (unread) {
                        try {
                          await markOneM.mutateAsync(n.id)
                        } catch {
                          /* навигация всё равно полезна */
                        }
                      }
                      navigate(href)
                    }}
                  >
                    <div className="mobileNotificationTop">
                      <span className={`mobileNotifType mobileNotifType--${tone}`}>{typeLabel}</span>
                      {when ? <span className="mobileNotificationTime">{when}</span> : null}
                    </div>
                    <div className="mobileNotificationTitle">{n.title}</div>
                    <div className="mobileNotificationMessage">{n.message}</div>
                  </button>
                ) : (
                  <div className="mobileNotificationBtn">
                    <div className="mobileNotificationTop">
                      <span className={`mobileNotifType mobileNotifType--${tone}`}>{typeLabel}</span>
                      {when ? <span className="mobileNotificationTime">{when}</span> : null}
                    </div>
                    <div className="mobileNotificationTitle">{n.title}</div>
                    <div className="mobileNotificationMessage">{n.message}</div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
