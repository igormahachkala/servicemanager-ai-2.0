import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import type { PushPreference } from '../lib/api'
import { mobilePath } from './mobileRoute'
import {
  canUsePush,
  detectPushPlatform,
  getExistingPushSubscription,
  getPushPermission,
  isPushBlockedByPlatform,
  isStandalonePwa,
  registerPushServiceWorker,
  requestPushPermission,
  serializeSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from '../lib/pushNotifications'
import { enablePushNotifications, PUSH_ENABLE_PREFS } from './mobilePushActivation'

const DEFAULT_PREFS: PushPreference = PUSH_ENABLE_PREFS

const TYPE_ROWS: Array<{ key: keyof PushPreference; label: string; hint?: string }> = [
  { key: 'chat', label: 'Сообщения в чатах', hint: 'Главный сценарий — рекомендуем не выключать' },
  { key: 'ticketNew', label: 'Новые заявки' },
  { key: 'assignment', label: 'Назначения' },
  { key: 'acceptance', label: 'Готово к приёмке' },
  { key: 'acceptanceReject', label: 'Возврат на доработку' },
  { key: 'statusChange', label: 'Смена статуса заявки' },
  { key: 'sla', label: 'SLA: предупреждения и просрочки' },
  { key: 'news', label: 'Новости и рассылки' },
]

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`mobilePushSwitch${checked ? ' mobilePushSwitch--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="mobilePushSwitchThumb" />
    </button>
  )
}

function BellIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" />
      <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
    </svg>
  )
}

export function MobilePushSettingsPage() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const backHref = mobilePath(location.pathname, '/profile')

  const supported = canUsePush()
  const platform = useMemo(() => detectPushPlatform(), [])
  const blockedByPlatform = isPushBlockedByPlatform()
  const standalone = isStandalonePwa()

  const [permission, setPermission] = useState<NotificationPermission>(supported ? getPushPermission() : 'denied')
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    ;(async () => {
      await registerPushServiceWorker()
      const existing = await getExistingPushSubscription()
      if (!cancelled) setSubscribed(!!existing)
    })()
    return () => {
      cancelled = true
    }
  }, [supported])

  // Пробуем реальный контракт с бэкенда; пока эндпоинтов нет — работаем в preview-режиме.
  const vapidQ = useQuery({
    queryKey: ['push-vapid-key'],
    queryFn: api.getPushVapidPublicKey,
    retry: false,
    staleTime: 5 * 60_000,
  })
  const backendReady = vapidQ.isSuccess

  const prefsQ = useQuery({
    queryKey: ['push-preferences'],
    queryFn: api.getPushPreferences,
    retry: false,
    enabled: backendReady,
  })

  const localPrefs = prefsQ.data ?? DEFAULT_PREFS

  const prefsM = useMutation({
    mutationFn: (patch: Partial<PushPreference>) => api.updatePushPreferences(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ['push-preferences'] })
      const prev = queryClient.getQueryData<PushPreference>(['push-preferences'])
      queryClient.setQueryData<PushPreference>(['push-preferences'], { ...(prev ?? DEFAULT_PREFS), ...patch })
      return { prev }
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['push-preferences'], ctx.prev)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['push-preferences'] })
    },
  })

  const testM = useMutation({ mutationFn: api.sendTestPush })

  async function handleEnable() {
    if (busy) return
    setLocalError(null)
    setBusy(true)
    try {
      const result = await enablePushNotifications({
        vapidPublicKey: vapidQ.data?.key,
        platform,
        deps: {
          requestPermission: requestPushPermission,
          registerServiceWorker: registerPushServiceWorker,
          getExistingSubscription: getExistingPushSubscription,
          subscribeToPush,
          serializeSubscription,
          saveSubscription: (payload) => api.subscribeToPushBackend(payload),
          updatePreferences: (patch) => api.updatePushPreferences(patch),
          refreshCanonicalState: async () => {
            await queryClient.invalidateQueries({ queryKey: ['push-preferences'] })
            await queryClient.invalidateQueries({ queryKey: ['push-vapid-key'] })
            await queryClient.refetchQueries({ queryKey: ['push-preferences'], type: 'active' })
          },
        },
      })
      setPermission(result.permission)
      setSubscribed(result.subscribed)
      if (!result.ok) {
        setLocalError(result.message)
        return
      }
      queryClient.setQueryData<PushPreference>(['push-preferences'], result.preferences)
    } catch (e) {
      const message = e instanceof Error && e.message ? e.message : 'Что-то пошло не так. Попробуйте ещё раз чуть позже.'
      setLocalError(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDisable() {
    if (busy) return
    setBusy(true)
    try {
      const { endpoint } = await unsubscribeFromPush()
      if (endpoint && backendReady) {
        await api.unsubscribeFromPushBackend(endpoint).catch(() => {})
      }
      setSubscribed(false)
    } finally {
      setBusy(false)
    }
  }

  const permissionLabel =
    permission === 'granted' ? 'Разрешено' : permission === 'denied' ? 'Запрещено в браузере' : 'Ещё не запрошено'
  const permissionTone = permission === 'granted' ? 'ok' : permission === 'denied' ? 'error' : 'default'

  return (
    <div className="mobileSection">
      <div className="mobileTicketDetailsToolbar">
        <Link to={backHref} className="mobileDetailsBackLink mobilePatrolBackLink">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Назад
        </Link>
      </div>

      <h1 className="mobileTitle">Push-уведомления</h1>
      <div className="mobilePageHint">
        Приходят даже когда приложение закрыто — как в мессенджере. Отдельно от списка «Уведомления» в приложении.
      </div>

      {!supported ? (
        <div className="mobileNotice mobileNoticeError" style={{ marginTop: 12 }}>
          Этот браузер не поддерживает push-уведомления.
        </div>
      ) : null}

      {supported && blockedByPlatform ? (
        <div className="mobileCard mobilePushInstallGuide" style={{ marginTop: 12 }}>
          <div className="mobilePushInstallGuideTitle">Добавьте приложение на экран «Домой»</div>
          <p className="mobileFieldHint">
            На iPhone push-уведомления работают только для установленного приложения. Откройте меню «Поделиться»
            в Safari → «На экран „Домой“», затем откройте приложение с иконки на рабочем столе.
          </p>
        </div>
      ) : null}

      {supported && !blockedByPlatform ? (
        <>
          <div className="mobileCard mobilePushStatusCard" style={{ marginTop: 12 }}>
            <div className="mobilePushStatusHeader">
              <span className="mobilePushStatusIcon" aria-hidden><BellIcon /></span>
              <div>
                <div className="mobilePushStatusTitle">
                  {subscribed ? 'Уведомления включены' : 'Уведомления выключены'}
                </div>
                <div className="mobileFieldHint" style={{ margin: 0 }}>
                  Платформа: {platform === 'ios-pwa' ? 'iPhone (установлено)' : platform === 'android' ? 'Android' : platform === 'desktop' ? 'Компьютер' : 'Браузер'}
                  {standalone ? ' · standalone' : ''}
                </div>
              </div>
            </div>

            <div className="mobilePushStatusRow">
              <span className="mobileFieldHint" style={{ margin: 0 }}>Разрешение браузера</span>
              <span className={`mobilePushBadge mobilePushBadge--${permissionTone}`}>{permissionLabel}</span>
            </div>

            {!backendReady ? (
              <div className="mobileNotice" style={{ marginTop: 10, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                Бэкенд для push ещё готовится (отдельный раунд с management). Экран и подписка на устройстве уже работают — доставка включится, когда бэкенд будет готов, без переустановки приложения.
              </div>
            ) : null}

            {localError ? (
              <div className="mobileNotice" style={{ marginTop: 10, background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>
                {localError}
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {!subscribed ? (
                <button type="button" className="mobileBtn" disabled={busy || permission === 'denied'} onClick={handleEnable}>
                  {busy ? 'Включаем…' : 'Включить уведомления'}
                </button>
              ) : (
                <button type="button" className="mobileBtn mobileBtnSecondary" disabled={busy} onClick={handleDisable}>
                  {busy ? 'Выключаем…' : 'Выключить'}
                </button>
              )}
              {subscribed && backendReady ? (
                <button
                  type="button"
                  className="mobileBtn mobileBtnGhost"
                  disabled={testM.isPending}
                  onClick={() => testM.mutate()}
                >
                  {testM.isPending ? 'Отправляем…' : 'Отправить тест'}
                </button>
              ) : null}
            </div>

            {permission === 'denied' ? (
              <div className="mobileFieldHint" style={{ marginTop: 10 }}>
                Разрешение отклонено в браузере. Включите уведомления в системных настройках браузера для этого сайта, затем вернитесь сюда.
              </div>
            ) : null}
            {testM.isSuccess ? (
              <div className="mobileFieldHint" style={{ marginTop: 6, color: '#065f46' }}>Тестовое уведомление отправлено.</div>
            ) : null}
          </div>

          <div className="mobileCard mobilePushTypesCard" style={{ marginTop: 12 }}>
            <div className="mobilePushStatusTitle" style={{ marginBottom: 4 }}>Какие события присылать</div>
            <p className="mobileFieldHint">
              {backendReady ? 'Изменения сохраняются сразу.' : 'Пока в режиме предпросмотра — сохранение появится вместе с бэкендом.'}
            </p>
            <ul className="mobilePushTypesList">
              {TYPE_ROWS.map((row) => (
                <li key={row.key} className="mobilePushTypeRow">
                  <div className="mobilePushTypeLabel">
                    <span>{row.label}</span>
                    {row.hint ? <span className="mobileFieldHint" style={{ margin: 0 }}>{row.hint}</span> : null}
                  </div>
                  <ToggleSwitch
                    label={row.label}
                    checked={!!localPrefs[row.key]}
                    disabled={!subscribed}
                    onChange={(next) => prefsM.mutate({ [row.key]: next })}
                  />
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  )
}
