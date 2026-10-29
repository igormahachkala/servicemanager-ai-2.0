import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import * as api from '../../lib/api'
import {
  errorMessage,
  readPositive,
  type GeoAccuracySettingsView,
} from './geoAccuracyModel'

type Props = {
  open: boolean
  settings: GeoAccuracySettingsView | null
  onClose: () => void
}

type FieldKey = 'accuracy' | 'freshness' | 'radius'

const emptyErrors: Record<FieldKey, string> = {
  accuracy: '',
  freshness: '',
  radius: '',
}

export function GeoAccuracySettingsModal({ open, settings, onClose }: Props) {
  const queryClient = useQueryClient()
  const [accuracy, setAccuracy] = useState('')
  const [freshness, setFreshness] = useState('')
  const [radius, setRadius] = useState('')
  const [fieldError, setFieldError] = useState(emptyErrors)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !settings) return
    setAccuracy(String(settings.accuracyMeters))
    setFreshness(String(settings.freshnessMinutes))
    setRadius(String(settings.radiusMeters))
    setFieldError(emptyErrors)
    setFormError(null)
  }, [open, settings])

  const saveM = useMutation({
    mutationFn: (body: GeoAccuracySettingsView) => api.updateGeoAccuracySettings(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['geo-accuracy-settings'] })
      onClose()
    },
    onError: (error: unknown) => {
      setFormError(errorMessage(error))
    },
  })

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saveM.isPending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, saveM.isPending])

  if (!open) return null

  function submit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    if (!settings) {
      setFormError('Пороги ещё не загружены.')
      return
    }

    const accuracyRead = readPositive(accuracy)
    const freshnessRead = readPositive(freshness)
    const radiusRead = readPositive(radius)
    const nextErrors = {
      accuracy: accuracyRead.ok ? '' : accuracyRead.message,
      freshness: freshnessRead.ok ? '' : freshnessRead.message,
      radius: radiusRead.ok ? '' : radiusRead.message,
    }
    setFieldError(nextErrors)
    if (!accuracyRead.ok || !freshnessRead.ok || !radiusRead.ok) return

    if (accuracyRead.omit && freshnessRead.omit && radiusRead.omit) {
      setFormError('Нет чисел для записи. Пустое поле оставляет прежнее значение.')
      return
    }

    saveM.mutate({
      accuracyMeters: accuracyRead.omit ? settings.accuracyMeters : accuracyRead.value,
      freshnessMinutes: freshnessRead.omit ? settings.freshnessMinutes : freshnessRead.value,
      radiusMeters: radiusRead.omit ? settings.radiusMeters : radiusRead.value,
    })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="geo-accuracy-settings-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17,24,39,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 80,
        padding: 16,
      }}
      onClick={() => {
        if (!saveM.isPending) onClose()
      }}
    >
      <div className="panel" style={{ maxWidth: 440, width: '100%' }} onClick={(event) => event.stopPropagation()}>
        <h2 id="geo-accuracy-settings-title" style={{ marginTop: 0, marginBottom: 6, fontSize: 18 }}>
          Пороги прибытия
        </h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Пустое поле оставляет прежнее число. Ноль и отрицательное значение не записываются. Новые числа действуют на
          следующие сверки. Уже записанные факты прибытия не меняются.
        </p>
        {settings ? (
          <p className="small" style={{ marginTop: 0 }}>
            Сейчас необходимая точность {settings.accuracyMeters} м, свежесть {settings.freshnessMinutes} мин, радиус{' '}
            {settings.radiusMeters} м.
          </p>
        ) : (
          <p className="small" style={{ marginTop: 0 }}>
            Пороги ещё загружаются.
          </p>
        )}

        <form className="form" onSubmit={submit}>
          <label>
            Необходимая точность, м
            <input
              value={accuracy}
              onChange={(event) => setAccuracy(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              disabled={!settings || saveM.isPending}
            />
            {fieldError.accuracy ? <span className="alert">{fieldError.accuracy}</span> : null}
          </label>
          <label>
            Свежесть, мин
            <input
              value={freshness}
              onChange={(event) => setFreshness(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              disabled={!settings || saveM.isPending}
            />
            {fieldError.freshness ? <span className="alert">{fieldError.freshness}</span> : null}
          </label>
          <label>
            Радиус, м
            <input
              value={radius}
              onChange={(event) => setRadius(event.target.value)}
              inputMode="decimal"
              autoComplete="off"
              disabled={!settings || saveM.isPending}
            />
            {fieldError.radius ? <span className="alert">{fieldError.radius}</span> : null}
          </label>
          {formError ? <div className="alert">{formError}</div> : null}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="ghost" onClick={onClose} disabled={saveM.isPending}>
              Отмена
            </button>
            <button type="submit" disabled={!settings || saveM.isPending}>
              {saveM.isPending ? 'Записываем…' : 'Записать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
