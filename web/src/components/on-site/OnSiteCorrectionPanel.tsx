import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../../lib/api'
import { dateTimeLocalToIso } from '../../lib/plannedDueAt'
import { formatOnSiteInstant, onSiteErrorText } from './onSiteDisplay'

type Props = {
  ticketId: string
  /** На строке заявки форма и история видны сразу. На карточке списка они в раскрытии. */
  expanded?: boolean
}

export function OnSiteCorrectionPanel({ ticketId, expanded = false }: Props) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(expanded)
  const [reason, setReason] = useState('')
  const [arrivedLocal, setArrivedLocal] = useState('')
  const [departedLocal, setDepartedLocal] = useState('')
  const [formError, setFormError] = useState('')

  const historyEnabled = expanded || open
  const historyQ = useQuery({
    queryKey: ['on-site-corrections', ticketId],
    queryFn: () => api.listOnSiteCorrections(ticketId),
    enabled: historyEnabled && !!ticketId,
  })

  const saveM = useMutation({
    mutationFn: (input: api.OnSiteCorrectionInput) => api.createOnSiteCorrection(ticketId, input),
    onSuccess: async () => {
      setReason('')
      setArrivedLocal('')
      setDepartedLocal('')
      setFormError('')
      await queryClient.invalidateQueries({ queryKey: ['on-site-corrections', ticketId] })
      await queryClient.invalidateQueries({ queryKey: ['on-site-ticket', ticketId] })
      await queryClient.invalidateQueries({ queryKey: ['on-site'] })
    },
    onError: (error: unknown) => setFormError(onSiteErrorText(error)),
  })

  function submit() {
    const trimmed = reason.trim()
    if (!trimmed) {
      setFormError('Укажите причину правки.')
      return
    }
    const correctedArrivedAt = dateTimeLocalToIso(arrivedLocal)
    const correctedDepartedAt = dateTimeLocalToIso(departedLocal)
    if (arrivedLocal.trim() && !correctedArrivedAt) {
      setFormError('Время прибытия не разобрано.')
      return
    }
    if (departedLocal.trim() && !correctedDepartedAt) {
      setFormError('Время ухода не разобрано.')
      return
    }
    setFormError('')
    saveM.mutate({
      reason: trimmed,
      correctedArrivedAt,
      correctedDepartedAt,
    })
  }

  const body = (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ fontWeight: 700 }}>Правка прибытия</div>
      <div className="muted small">Пустое время значит, что этого факта не было. Правка не пишет комментарий заявки.</div>
      <label>
        Причина
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} disabled={saveM.isPending} />
      </label>
      <label>
        Прибытие
        <input type="datetime-local" value={arrivedLocal} onChange={(event) => setArrivedLocal(event.target.value)} disabled={saveM.isPending} />
      </label>
      <label>
        Уход
        <input type="datetime-local" value={departedLocal} onChange={(event) => setDepartedLocal(event.target.value)} disabled={saveM.isPending} />
      </label>
      <div>
        <button type="button" onClick={submit} disabled={saveM.isPending || !reason.trim()}>
          {saveM.isPending ? 'Сохраняем…' : 'Сохранить правку'}
        </button>
      </div>
      {formError ? <div className="alert">{formError}</div> : null}

      <div style={{ fontWeight: 700 }}>История правок</div>
      {historyQ.isLoading ? <div className="muted small">Загрузка…</div> : null}
      {historyQ.isError ? <div className="alert">{onSiteErrorText(historyQ.error)}</div> : null}
      {historyQ.data && historyQ.data.items.length === 0 ? <div className="muted small">Правок ещё нет.</div> : null}
      {historyQ.data && historyQ.data.items.length > 0 ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {historyQ.data.items.map((item) => (
            <div key={item.id} className="uiCard" style={{ padding: 8 }}>
              <div className="muted small">{formatOnSiteInstant(item.createdAt)}{item.correctedByName ? ` · ${item.correctedByName}` : ''}</div>
              <div>Прибытие. {formatOnSiteInstant(item.correctedArrivedAt)}</div>
              <div>Уход. {formatOnSiteInstant(item.correctedDepartedAt)}</div>
              <div>{item.reason}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )

  if (expanded) return body

  return (
    <details
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="muted small" style={{ cursor: 'pointer' }}>Правка и история</summary>
      <div style={{ marginTop: 8 }}>{body}</div>
    </details>
  )
}
