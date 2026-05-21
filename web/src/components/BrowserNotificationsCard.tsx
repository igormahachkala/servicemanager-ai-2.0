import { useEffect, useMemo, useState } from 'react'
import {
  canUseBrowserNotifications,
  getBrowserNotificationsEnabled,
  requestBrowserNotificationPermission,
  setBrowserNotificationsEnabled,
} from '../lib/browserNotifications'

type BrowserNotificationsCardProps = {
  title?: string
  description?: string
  className?: string
}

function permissionText(permission: NotificationPermission, enabled: boolean): string {
  if (!canUseBrowserNotifications()) return 'Браузерные уведомления не поддерживаются этим браузером.'
  if (permission === 'denied') return 'Уведомления запрещены в браузере.'
  if (permission === 'default') return 'Разрешение ещё не запрошено. Нажмите кнопку, чтобы включить уведомления.'
  if (enabled) return 'Браузерные уведомления включены.'
  return 'Разрешение в браузере уже выдано, но уведомления отключены в приложении.'
}

export function BrowserNotificationsCard({
  title = 'Браузерные уведомления',
  description = 'Показывать системные уведомления для realtime-событий, когда приложение открыто в браузере.',
  className,
}: BrowserNotificationsCardProps) {
  const supported = canUseBrowserNotifications()
  const [permission, setPermission] = useState<NotificationPermission>(supported ? Notification.permission : 'denied')
  const [enabled, setEnabled] = useState(() => getBrowserNotificationsEnabled())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supported) return
    setPermission(Notification.permission)
    setEnabled(getBrowserNotificationsEnabled())
  }, [supported])

  const status = useMemo(() => permissionText(permission, enabled), [enabled, permission])
  const canEnable = supported && permission !== 'denied'

  async function handleEnable() {
    if (!supported) return
    setBusy(true)
    try {
      const nextPermission = permission === 'granted' ? 'granted' : await requestBrowserNotificationPermission()
      setPermission(nextPermission)
      const nextEnabled = nextPermission === 'granted'
      setBrowserNotificationsEnabled(nextEnabled)
      setEnabled(nextEnabled)
    } finally {
      setBusy(false)
    }
  }

  function handleDisable() {
    setBrowserNotificationsEnabled(false)
    setEnabled(false)
  }

  return (
    <div className={className}>
      <h3 style={{ marginBottom: 10 }}>{title}</h3>
      <div className="muted small" style={{ marginBottom: 10 }}>
        {description}
      </div>
      <div className="mobileFieldHint" style={{ marginBottom: 12 }}>
        {status}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" onClick={handleEnable} disabled={busy || !canEnable}>
          {permission === 'granted' && enabled ? 'Перезапросить доступ' : 'Включить уведомления'}
        </button>
        <button type="button" className="ghost" onClick={handleDisable} disabled={busy || !enabled}>
          Отключить
        </button>
      </div>
      {permission === 'denied' ? (
        <div className="mobileFieldHint" style={{ marginTop: 10 }}>
          Разрешение уже отклонено. Включите уведомления в настройках браузера, затем нажмите «Включить уведомления» снова.
        </div>
      ) : null}
    </div>
  )
}

