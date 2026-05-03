import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'

function formatNotifTime(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ''
  }
}

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

  const listQ = useQuery({
    queryKey: ['mobile-notifications'],
    queryFn: api.fetchNotifications,
    enabled: !!meQ.data,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  })

  const markOneM = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mobile-notifications'] }),
  })

  const markAllM = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mobile-notifications'] }),
  })

  const items = listQ.data?.items ?? []

  return (
    <div>
      <div className="mobileNotificationsHeader">
        <h1 className="mobileTitle">Уведомления</h1>
        <button
          type="button"
          className="mobileBtn mobileBtnSecondary mobileNotificationsMarkAll"
          disabled={markAllM.isPending || !items.some((n) => !n.readAt)}
          onClick={() => markAllM.mutate()}
        >
          Прочитать все
        </button>
      </div>
      {listQ.isLoading ? <div className="mobileSubtitle">Загрузка…</div> : null}
      {listQ.isError ? (
        <div className="mobileNotice mobileNoticeError">{(listQ.error as Error)?.message || 'Ошибка загрузки'}</div>
      ) : null}
      {!listQ.isLoading && items.length === 0 ? <div className="mobileSubtitle">Пока нет уведомлений</div> : null}
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
          return (
            <li key={n.id} className={unread ? 'mobileNotificationRow mobileNotificationRowUnread' : 'mobileNotificationRow'}>
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
                  <div className="mobileNotificationTitle">{n.title}</div>
                  <div className="mobileNotificationMessage">{n.message}</div>
                  <div className="mobileNotificationMeta">{formatNotifTime(n.createdAt)}</div>
                </button>
              ) : (
                <div className="mobileNotificationBtn">
                  <div className="mobileNotificationTitle">{n.title}</div>
                  <div className="mobileNotificationMessage">{n.message}</div>
                  <div className="mobileNotificationMeta">{formatNotifTime(n.createdAt)}</div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
