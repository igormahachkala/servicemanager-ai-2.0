import { useState } from 'react'
import { safeGetItem, safeSetItem } from '../../lib/browserStorage'

const COLLAPSED_KEY = 'sm_mobile_offline_cache_banner_collapsed_v1'

type Props = {
  enabled: boolean
  online: boolean
  storageReady: boolean
  selectedCount: number
  busy: boolean
  progress: { current: number; total: number } | null
  error: string
  onCacheSelected: () => void
}

export function HomeOfflineCachePanel(props: Props) {
  const [collapsed, setCollapsed] = useState(
    () => safeGetItem('local', COLLAPSED_KEY, '0') === '1',
  )
  if (!props.enabled) return null

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    safeSetItem('local', COLLAPSED_KEY, next ? '1' : '0')
  }

  return (
    <div className="mobileNotice" style={{ marginBottom: 10 }}>
      <div className="mobileRow" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800 }}>Заявки без интернета</div>
          {!collapsed ? (
            <div className="mobileMeta" style={{ marginTop: 4 }}>
              При слабой связи откроются только сохранённые заявки.
              Заявки в работе и первые пять назначенных кэшируются сами.
              Остальные отметьте и нажмите «Кэшировать».
              Значок «Закешировано» значит, что карточка и все изображения лежат на устройстве.
              Через 8 часов копия устаревает. При связи её можно обновить.
            </div>
          ) : null}
        </div>
        <button type="button" className="mobileBtnLink" onClick={toggleCollapsed}>
          {collapsed ? 'Показать' : 'Скрыть'}
        </button>
      </div>

      {!collapsed ? (
        <div style={{ marginTop: 8 }}>
          {!props.storageReady ? (
            <div className="mobileNotice mobileNoticeError">
              Offline-режим недоступен. Освободите место или проверьте настройки браузера.
            </div>
          ) : null}
          {props.error ? <div className="mobileNotice mobileNoticeError">{props.error}</div> : null}
          {props.progress ? (
            <div className="mobileMeta">
              Кэшируем {props.progress.current} из {props.progress.total}
            </div>
          ) : null}
          <button
            type="button"
            className="mobileBtn mobileBtnSecondary"
            disabled={!props.online || !props.storageReady || props.busy || props.selectedCount === 0}
            onClick={props.onCacheSelected}
          >
            {props.busy ? 'Кэшируем…' : `Кэшировать${props.selectedCount ? ` (${props.selectedCount})` : ''}`}
          </button>
        </div>
      ) : null}
    </div>
  )
}
