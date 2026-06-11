import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  deleteSingleQueueItem,
  getPendingAndFailedCounts,
  readOfflineQueue,
  retrySingleQueueItem,
  retryOfflineQueue,
  subscribeOfflineQueue,
  useOnlineStatus,
  type OfflineQueueItem,
} from './offlineQueue'
import { mobilePath } from './mobileRoute'

function actionTypeLabel(type: OfflineQueueItem['type']): string {
  if (type === 'ticket_comment') return 'Комментарий'
  if (type === 'ticket_status_change') return 'Смена статуса'
  if (type === 'ticket_photo_upload') return 'Фото'
  return type
}

function statusLabel(status: OfflineQueueItem['status']): string {
  if (status === 'pending') return 'Ожидает отправки'
  if (status === 'syncing') return 'Синхронизация'
  if (status === 'failed') return 'Ошибка'
  if (status === 'synced') return 'Отправлено'
  return status
}

function payloadSummary(item: OfflineQueueItem): string {
  if (item.type === 'ticket_comment') {
    const c = (item.payload.comment || '').trim()
    return c ? `"${c.length > 60 ? c.slice(0, 60) + '…' : c}"` : ''
  }
  if (item.type === 'ticket_status_change') {
    const STATUS_LABELS: Record<string, string> = {
      NEW: 'Новая',
      ASSIGNED: 'Назначена',
      IN_PROGRESS: 'В работе',
      DONE: 'Завершена',
      CANCELED: 'Отменена',
    }
    const st = item.payload.status || ''
    return `Статус: ${STATUS_LABELS[st] || st}`
  }
  return ''
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MobileOfflineQueue() {
  const location = useLocation()
  const isOnline = useOnlineStatus()

  const [items, setItems] = useState<OfflineQueueItem[]>(() =>
    readOfflineQueue().filter((i) => i.status !== 'synced'),
  )
  const [syncStatus, setSyncStatus] = useState<'' | 'syncing' | 'done' | 'error'>('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [retryErrors, setRetryErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const refresh = () => setItems(readOfflineQueue().filter((i) => i.status !== 'synced'))
    refresh()
    return subscribeOfflineQueue(refresh)
  }, [])

  useEffect(() => {
    if (syncStatus !== 'done' && syncStatus !== 'error') return
    const tid = window.setTimeout(() => setSyncStatus(''), 3000)
    return () => window.clearTimeout(tid)
  }, [syncStatus])

  async function handleSyncAll() {
    if (!isOnline) return
    setSyncStatus('syncing')
    try {
      const result = await retryOfflineQueue()
      setSyncStatus(result.failed > 0 ? 'error' : 'done')
    } catch {
      setSyncStatus('error')
    }
  }

  async function handleRetryOne(id: string) {
    if (!isOnline) {
      setRetryErrors((prev) => ({ ...prev, [id]: 'Нет соединения' }))
      return
    }
    setRetryErrors((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    const result = await retrySingleQueueItem(id)
    if (!result.ok && result.error) {
      setRetryErrors((prev) => ({ ...prev, [id]: result.error! }))
    }
  }

  function handleDelete(id: string) {
    if (pendingDeleteId === id) {
      deleteSingleQueueItem(id)
      setPendingDeleteId(null)
    } else {
      setPendingDeleteId(id)
      if (pendingDeleteId && pendingDeleteId !== id) {
        setPendingDeleteId(id)
      }
    }
  }

  const { pending, failed } = getPendingAndFailedCounts()
  const backPath = mobilePath(location.pathname, '/profile')
  const isEmpty = items.length === 0
  const syncAllDisabled = !isOnline || syncStatus === 'syncing'

  return (
    <div className="mobileSection">
      <div className="mobileTicketDetailsToolbar">
        <Link to={backPath} className="mobileDetailsBackLink">
          Назад
        </Link>
      </div>

      <div className="mobileRow" style={{ marginBottom: 12, alignItems: 'center' }}>
        <h1 className="mobileSectionTitle" style={{ margin: 0 }}>
          Очередь отправки
        </h1>
        {(pending > 0 || failed > 0) ? (
          <span className="mobileOfflineQueueCountBadge">
            {pending + failed}
          </span>
        ) : null}
      </div>

      {!isOnline ? (
        <div className="mobileOfflineBanner mobileOfflineBannerWarning" style={{ marginBottom: 10, position: 'static', margin: '0 0 10px' }}>
          Нет соединения. Синхронизация выполнится автоматически после восстановления сети.
        </div>
      ) : null}

      {!isEmpty ? (
        <div className="mobileCard" style={{ marginBottom: 10 }}>
          <button
            type="button"
            className="mobileBtn"
            style={{ width: '100%' }}
            disabled={syncAllDisabled}
            onClick={() => void handleSyncAll()}
          >
            {syncStatus === 'syncing' ? 'Синхронизация…' : 'Синхронизировать всё'}
          </button>
          {syncStatus === 'done' ? (
            <div className="mobileNotice mobileNoticeSuccess" style={{ marginTop: 8 }}>
              Готово
            </div>
          ) : null}
          {syncStatus === 'error' ? (
            <div className="mobileNotice mobileNoticeError" style={{ marginTop: 8 }}>
              Есть ошибки — проверьте элементы ниже
            </div>
          ) : null}
        </div>
      ) : null}

      {isEmpty ? (
        <div className="mobileCard mobileEmptyState">
          <div className="mobileEmptyStateTitle">Очередь пуста</div>
          <p className="mobileEmptyStateHint">Все действия отправлены.</p>
        </div>
      ) : null}

      {items.map((item) => {
        const isConfirmDelete = pendingDeleteId === item.id
        const isSyncing = item.status === 'syncing'
        const retryErr = retryErrors[item.id]
        const summary = payloadSummary(item)

        return (
          <div key={item.id} className="mobileCard mobileOfflineQueueItem">
            <div className="mobileRow" style={{ marginBottom: 6 }}>
              <span className={`mobileOfflineQueueStatusBadge mobileOfflineQueueStatusBadge--${item.status}`}>
                {statusLabel(item.status)}
              </span>
              <span className="mobileMeta" style={{ fontSize: '0.75rem' }}>
                {fmtDate(item.createdAt)}
              </span>
            </div>

            <div style={{ fontWeight: 700, marginBottom: 4 }}>{actionTypeLabel(item.type)}</div>

            <div className="mobileMeta" style={{ fontSize: '0.76rem', marginBottom: summary ? 4 : 0, wordBreak: 'break-all' }}>
              ID заявки: {item.ticketId}
            </div>

            {summary ? (
              <div className="mobileMeta" style={{ fontSize: '0.83rem', marginBottom: 6 }}>
                {summary}
              </div>
            ) : null}

            {item.lastError ? (
              <div className="mobileNotice mobileNoticeError" style={{ margin: '6px 0', fontSize: '0.78rem' }}>
                {item.lastError}
              </div>
            ) : null}

            {retryErr ? (
              <div className="mobileNotice mobileNoticeError" style={{ margin: '6px 0', fontSize: '0.78rem' }}>
                {retryErr}
              </div>
            ) : null}

            {isSyncing ? (
              <div className="mobileMeta" style={{ fontSize: '0.82rem', marginTop: 6 }}>
                Синхронизация…
              </div>
            ) : (
              <div className="mobileRow" style={{ gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="mobileBtn mobileBtnSecondary mobileOfflineQueueAction"
                  onClick={() => void handleRetryOne(item.id)}
                >
                  Повторить
                </button>
                <button
                  type="button"
                  className={`mobileBtn mobileOfflineQueueAction${isConfirmDelete ? ' mobileOfflineQueueAction--danger' : ' mobileBtnSecondary'}`}
                  onClick={() => handleDelete(item.id)}
                >
                  {isConfirmDelete ? 'Подтвердить удаление' : 'Удалить'}
                </button>
              </div>
            )}

            {isConfirmDelete && !isSyncing ? (
              <button
                type="button"
                className="mobileBtn mobileBtnSecondary"
                style={{ width: '100%', marginTop: 6, fontSize: '0.82rem', minHeight: 36 }}
                onClick={() => setPendingDeleteId(null)}
              >
                Отмена
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
