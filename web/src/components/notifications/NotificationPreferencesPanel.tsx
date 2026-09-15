import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../../lib/api'

/**
 * SMA-NOTIFICATION-PREFERENCES-UI-105C — «Настройки → Уведомления».
 *
 * Список событий, их русские подписи и группы приходят с бэкенда: он же
 * решает, что адресовано роли и контуру пользователя. Клиент ничего
 * не достраивает — иначе появилась бы вторая версия каталога.
 *
 * Настройка может только погасить уведомление, которое доставка уже
 * разрешила по доступу. Никакой тумблер здесь не открывает данные.
 */

const CHANNEL_LABELS: Record<string, string> = {
  IN_APP: 'В системе',
  PUSH: 'Push',
  MAX: 'MAX',
}

function channelLabel(channel: string) {
  return CHANNEL_LABELS[channel] || channel
}

type PendingKey = string

function pendingKeyOf(eventKey: string, channel: string) {
  return `${eventKey}:${channel}`
}

export function NotificationPreferencesPanel() {
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<PendingKey | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const settingsQ = useQuery({
    queryKey: ['notification-settings'],
    queryFn: api.getNotificationSettings,
  })

  function applyResult(next: api.NotificationSettings) {
    queryClient.setQueryData(['notification-settings'], next)
    setActionError(null)
  }

  const toggleM = useMutation({
    mutationFn: (input: { eventType: string; channel: api.NotificationSettingsChannel; enabled: boolean }) =>
      api.setNotificationPreference(input),
    onSuccess: applyResult,
    onError: (error: any) => setActionError(error?.message || 'Не удалось сохранить настройку'),
    onSettled: () => setPending(null),
  })

  const resetM = useMutation({
    mutationFn: (input: { eventType: string; channel: api.NotificationSettingsChannel }) =>
      api.clearNotificationPreference(input),
    onSuccess: applyResult,
    onError: (error: any) => setActionError(error?.message || 'Не удалось вернуть умолчание'),
    onSettled: () => setPending(null),
  })

  const data = settingsQ.data
  const busy = toggleM.isPending || resetM.isPending

  if (settingsQ.isLoading) {
    return (
      <div className="panel" aria-busy="true">
        <h3 style={{ marginBottom: 10 }}>Уведомления</h3>
        <div className="muted">Загружаем настройки…</div>
      </div>
    )
  }

  if (settingsQ.isError) {
    return (
      <div className="panel">
        <h3 style={{ marginBottom: 10 }}>Уведомления</h3>
        <div className="alert" role="alert">
          {(settingsQ.error as any)?.message || 'Не удалось загрузить настройки уведомлений'}
        </div>
        <button type="button" onClick={() => settingsQ.refetch()}>Повторить</button>
      </div>
    )
  }

  /**
   * Ответ может прийти неполным — например, со старого бэкенда без 105C.
   * Пустая форма честнее, чем падение всей страницы настроек.
   */
  const groups = Array.isArray(data?.groups) ? data.groups : []

  if (!groups.length) {
    return (
      <div className="panel">
        <h3 style={{ marginBottom: 10 }}>Уведомления</h3>
        <div className="muted">
          Для вашей роли пока нет настраиваемых уведомлений. Это не отключает доставку:
          вы продолжите получать всё, что адресовано вам по работе.
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 6 }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>Уведомления</h3>
          <div className="muted small">
            Здесь можно отключить то, что вам не нужно. Настройка уменьшает поток уведомлений
            и никогда не открывает доступ к данным.
          </div>
        </div>
      </div>

      {actionError ? <div className="alert" role="alert">{actionError}</div> : null}

      {groups.map((group) => (
        <section key={group.key} className="notifPrefGroup">
          <h4 className="notifPrefGroupTitle">{group.titleRu}</h4>
          <ul className="notifPrefList">
            {(group.events || []).map((event) => (
              <li key={event.key} className="notifPrefRow">
                <div className="notifPrefRowText">
                  <div className="notifPrefRowLabel">{event.labelRu}</div>
                  <div className="muted small">{event.descriptionRu}</div>
                </div>
                <div className="notifPrefRowControls">
                  {(event.channels || []).map((state) => {
                    const key = pendingKeyOf(event.key, state.channel)
                    const isPending = pending === key && busy
                    return (
                      <div key={state.channel} className="notifPrefControl">
                        <label className="notifPrefToggle">
                          <input
                            type="checkbox"
                            checked={state.enabled}
                            disabled={busy}
                            aria-label={`${event.labelRu} — ${channelLabel(state.channel)}`}
                            onChange={(e) => {
                              setPending(key)
                              toggleM.mutate({
                                eventType: event.key,
                                channel: state.channel,
                                enabled: e.target.checked,
                              })
                            }}
                          />
                          <span>{channelLabel(state.channel)}</span>
                        </label>
                        <div className="notifPrefState" aria-live="polite">
                          {isPending ? (
                            <span className="muted small">Сохраняем…</span>
                          ) : state.isOverride ? (
                            <button
                              type="button"
                              className="ghost notifPrefReset"
                              disabled={busy}
                              onClick={() => {
                                setPending(key)
                                resetM.mutate({ eventType: event.key, channel: state.channel })
                              }}
                            >
                              Вернуть умолчание
                            </button>
                          ) : (
                            <span className="muted small">По умолчанию</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="muted small" style={{ marginTop: 10 }}>
        Push-уведомления на устройство настраиваются отдельно — в разделе Push.
      </div>
    </div>
  )
}
