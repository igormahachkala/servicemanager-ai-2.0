import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { mobilePath } from './mobileRoute'
import { listOfflineQueue, offlineStore, refreshOfflineStatus } from './offline/runtime'
import { syncNow, useOfflineStatus } from './offline/useOffline'
import { OFFLINE_OPERATIONS, OFFLINE_SYNC_LABEL, syncStateOf, type OfflineQueueItem } from './offline/types'

/**
 * SMA-MOBILE-OFFLINE-INTEGRATION-113D.
 *
 * Очередь отложенной работы. Читает новый слой на IndexedDB: прежний экран
 * показывал очередь из localStorage и не знал ни о снимках, ни о состоянии
 * «Требует внимания».
 *
 * Главное правило экрана: не выдавать неотправленное за отправленное.
 * Строка исчезает отсюда только после подтверждения сервером — до тех пор
 * техник видит её и понимает, что работа ещё на устройстве.
 */

function operationLabel(item: OfflineQueueItem): string {
  return OFFLINE_OPERATIONS[item.kind]?.title ?? item.kind
}

function stateLabel(item: OfflineQueueItem): string {
  return OFFLINE_SYNC_LABEL[syncStateOf(item)]
}

function stateModifier(item: OfflineQueueItem): string {
  const state = syncStateOf(item)
  if (state === 'attention') return 'attention'
  if (state === 'failed') return 'failed'
  if (state === 'syncing') return 'syncing'
  return 'pending'
}

function summary(item: OfflineQueueItem): string {
  const payload = item.payload as { comment?: string; value?: string; status?: string }
  if (item.kind === 'ticket.comment' && payload.comment) {
    const c = payload.comment.trim()
    return c.length > 60 ? `«${c.slice(0, 60)}…»` : `«${c}»`
  }
  if (item.kind === 'checkpoint.update' && payload.value) {
    const LABELS: Record<string, string> = { OK: 'Норма', ISSUE: 'Проблема', CRITICAL: 'Критично' }
    return LABELS[payload.value] || String(payload.value)
  }
  if (item.blobId) return 'Снимок сохранён на устройстве'
  return ''
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export function MobileOfflineQueue() {
  const location = useLocation()
  const offline = useOfflineStatus()
  const [items, setItems] = useState<OfflineQueueItem[]>([])
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    const rows = await listOfflineQueue()
    setItems(rows)
    await refreshOfflineStatus()
  }, [])

  // Список перечитывается при каждом изменении счётчиков: отправка идёт
  // фоном, и строка обязана исчезнуть ровно тогда, когда сервер подтвердил.
  useEffect(() => {
    let alive = true
    void listOfflineQueue().then((rows) => {
      if (alive) setItems(rows)
    })
    return () => {
      alive = false
    }
  }, [offline.pending, offline.attention, offline.syncing])

  async function sendAll() {
    setBusy(true)
    try {
      await syncNow()
      await reload()
    } finally {
      setBusy(false)
    }
  }

  /**
   * Повтор строки из «Требует внимания» — осознанное действие техника.
   * Автоматически такие не повторяются: сервер уже сказал, что применить
   * изменение нельзя, и молча долбиться в него бессмысленно.
   */
  async function retryOne(item: OfflineQueueItem) {
    const store = offlineStore()
    if (!store) return
    setBusy(true)
    try {
      await store.setStatus(item.id, 'pending', { attempts: 0, attentionReason: undefined })
      await syncNow()
      await reload()
    } finally {
      setBusy(false)
    }
  }

  /**
   * Удаление строки. Единственный путь, которым локальная работа исчезает
   * без отправки, и он требует явного подтверждения: обратно её не вернуть.
   */
  async function dropOne(item: OfflineQueueItem) {
    const store = offlineStore()
    if (!store) return
    const ok = window.confirm(
      `Удалить «${operationLabel(item)}» без отправки? Работа будет потеряна безвозвратно.`,
    )
    if (!ok) return
    setBusy(true)
    try {
      await store.setStatus(item.id, 'synced')
      await store.removeSynced(item.id)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mobileSection">
      <div className="mobileTicketDetailsToolbar">
        <Link to={mobilePath(location.pathname, '/')} className="mobileDetailsBackLink">
          Главная
        </Link>
      </div>

      <div>
        <h1 className="mobileTitle">Очередь отправки</h1>
        <div className="mobileSubtitle">
          {!offline.ready && offline.unavailableReason
            ? offline.unavailableReason
            : !offline.online
              ? 'Нет сети. Работа сохранена на устройстве.'
              : offline.syncing
                ? OFFLINE_SYNC_LABEL.syncing
                : items.length === 0
                  ? 'Всё отправлено.'
                  : `${OFFLINE_SYNC_LABEL.pending}: ${offline.pending}`}
        </div>
      </div>

      {offline.attention > 0 ? (
        <div className="mobileNotice mobileNoticeError">
          {OFFLINE_SYNC_LABEL.attention}: {offline.attention}. Эти записи не отправятся сами —
          проверьте их и повторите вручную.
        </div>
      ) : null}

      {items.length > 0 && offline.online ? (
        <button type="button" className="mobileBtn" disabled={busy} onClick={sendAll}>
          {busy ? '…' : 'Отправить всё'}
        </button>
      ) : null}

      {items.length === 0 ? (
        <div className="mobileCard mobileEmptyState" role="status">
          <div className="mobileEmptyStateTitle">Очередь пуста</div>
          <p className="mobileEmptyStateHint">
            Всё, что вы делали без сети, уже подтверждено сервером.
          </p>
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="mobileCard" style={{ display: 'grid', gap: 4 }}>
            <div className="mobileRow">
              <span style={{ fontWeight: 600 }}>{operationLabel(item)}</span>
              <span className={`mobileQueueState mobileQueueState--${stateModifier(item)}`}>
                {stateLabel(item)}
              </span>
            </div>
            {summary(item) ? <div className="mobileMeta">{summary(item)}</div> : null}
            <div className="mobileMeta">{fmtDate(item.createdAt)}</div>
            {item.attentionReason ? (
              <div className="mobileMeta" style={{ color: '#b91c1c' }}>{item.attentionReason}</div>
            ) : null}
            {item.lastError && !item.attentionReason ? (
              <div className="mobileMeta">{item.lastError}</div>
            ) : null}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                className="mobileBtn mobileBtnGhost"
                disabled={busy || !offline.online}
                onClick={() => retryOne(item)}
              >
                Повторить
              </button>
              <button
                type="button"
                className="mobileBtn mobileBtnGhost"
                disabled={busy}
                onClick={() => dropOne(item)}
              >
                Удалить
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
