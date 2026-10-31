import { useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import {
  buildNextOccurrenceReschedule,
  canRescheduleNextOccurrence,
  formatOccurrenceDate,
  nextOccurrenceDraft,
} from '../lib/inspectionScheduleRescheduling'

const SCOPE_MESSAGE = 'Переносится только ближайший ещё не начатый обход. Начало и периодичность плана, льготные дни и история выполненных обходов не меняются.'
const RECURRENCE_MESSAGE = 'После завершения этого обхода следующие сроки рассчитываются по прежнему расписанию от начала плана. Пропущенные прошлые обходы не создаются.'
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Не удалось перенести срок'

type EditorProps = { scheduleId: string; onCancel: () => void; onSaved: () => void }

export function InspectionScheduleRescheduleAction({ schedule }: { schedule: api.InspectionSchedule }) {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const qc = useQueryClient()
  // A refreshed card must never replace or dismiss an open stale draft.
  if (!open && !canRescheduleNextOccurrence(schedule)) return null

  const close = () => {
    setOpen(false)
    qc.removeQueries({ queryKey: ['inspection-schedule-reschedule', schedule.id], exact: true })
    void qc.invalidateQueries({ queryKey: ['inspection-schedules'] })
  }
  return (
    <div style={{ marginTop: 12 }}>
      {open ? (
        <InspectionScheduleRescheduler scheduleId={schedule.id} onCancel={close}
          onSaved={() => { setSaved(true); close() }} />
      ) : (
        <>
          <button type="button" className="ghost" onClick={() => { setSaved(false); setOpen(true) }}>
            Перенести следующий срок
          </button>
          {saved ? <span role="status" style={{ marginLeft: 10 }}>Следующий срок перенесён</span> : null}
        </>
      )}
    </div>
  )
}

export function InspectionScheduleRescheduler({ scheduleId, onCancel, onSaved }: EditorProps) {
  const scheduleQ = useQuery({
    queryKey: ['inspection-schedule-reschedule', scheduleId],
    queryFn: () => api.getInspectionSchedule(scheduleId),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })
  if (scheduleQ.isPending) return (
    <div role="status">Загружаем план для переноса…{' '}
      <button type="button" className="ghost" onClick={onCancel}>Отмена</button>
    </div>
  )
  if (scheduleQ.isError || !scheduleQ.data) return (
    <div>
      <div className="alert" role="alert">{errorMessage(scheduleQ.error)}</div>
      <button type="button" className="ghost" onClick={() => { void scheduleQ.refetch() }}>Повторить загрузку</button>{' '}
      <button type="button" className="ghost" onClick={onCancel}>Закрыть</button>
    </div>
  )
  if (!canRescheduleNextOccurrence(scheduleQ.data)) return (
    <div>
      <div className="alert" role="alert">Перенос недоступен. Нужен активный повторяющийся план с завершённым обходом и без начатого обхода.</div>
      <button type="button" className="ghost" onClick={onCancel}>Закрыть и обновить план</button>
    </div>
  )
  return <NextOccurrenceForm key={scheduleId} schedule={scheduleQ.data} onCancel={onCancel} onSaved={onSaved} />
}

export function NextOccurrenceConfirmation({ input }: { input: api.RescheduleNextInspectionOccurrenceInput }) {
  return (
    <div role="status" className="alert">
      <strong>Подтвердите перенос следующего срока</strong>
      <dl>
        <dt>Было</dt><dd>{formatOccurrenceDate(input.expectedNextDueAt)}</dd>
        <dt>Станет</dt><dd>{formatOccurrenceDate(input.nextDueAt)}</dd>
      </dl>
      <p className="small">{SCOPE_MESSAGE}</p>
    </div>
  )
}

function NextOccurrenceForm({ schedule, onCancel, onSaved }: {
  schedule: api.InspectionSchedule
  onCancel: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState(() => nextOccurrenceDraft(schedule))
  const [confirmation, setConfirmation] = useState<api.RescheduleNextInspectionOccurrenceInput | null>(null)
  const [conflict, setConflict] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  const titleId = useId()
  const qc = useQueryClient()
  const saveM = useMutation({
    mutationFn: (input: api.RescheduleNextInspectionOccurrenceInput) => api.rescheduleNextInspectionOccurrence(schedule.id, input),
    retry: false,
    onSuccess: () => {
      for (const key of ['inspection-schedules', 'location-card-schedules', 'mobile-inspection-today', 'work-calendar']) {
        void qc.invalidateQueries({ queryKey: [key] })
      }
      onSaved()
    },
    onError: (failure: unknown) => {
      if (failure instanceof api.ApiRequestError && failure.status === 409) {
        setConflict(true)
        setError('План изменился или обход уже начат. Проверьте актуальный срок. Ваш выбор оставлен ниже; закройте форму и откройте план заново.')
      } else {
        setError(errorMessage(failure))
      }
    },
    onSettled: () => { saving.current = false },
  })

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving.current || conflict) return
    try {
      const input = buildNextOccurrenceReschedule(draft)
      setError('')
      if (!confirmation) {
        setConfirmation(input)
        return
      }
      saving.current = true
      saveM.mutate(confirmation)
    } catch (failure) {
      setError(errorMessage(failure))
      setConfirmation(null)
    }
  }

  return (
    <form onSubmit={submit} aria-labelledby={titleId} className="panel">
      <h3 id={titleId} style={{ marginTop: 0 }}>Перенести следующий срок</h3>
      <p className="muted small">{SCOPE_MESSAGE}</p>
      <p className="muted small">{RECURRENCE_MESSAGE}</p>
      <p className="small">Текущий срок: <strong>{formatOccurrenceDate(draft.expectedNextDueAt)}</strong></p>
      <p className="muted small">Дата и время — в часовом поясе вашего устройства ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Новый срок должен быть в будущем и позже всех предыдущих обходов.</p>
      {error ? <div className="alert" role="alert">{error}</div> : null}
      <fieldset disabled={saveM.isPending || conflict || !!confirmation} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <label><div className="muted small">Новая дата</div>
            <input type="date" value={draft.date} required onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
          </label>
          <label><div className="muted small">Новое время</div>
            <input type="time" value={draft.time} required onChange={(event) => setDraft({ ...draft, time: event.target.value })} />
          </label>
        </div>
      </fieldset>
      {confirmation ? <NextOccurrenceConfirmation input={confirmation} /> : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="submit" disabled={saveM.isPending || conflict}>
          {saveM.isPending ? 'Переносим…' : confirmation ? 'Подтвердить перенос' : 'Перейти к подтверждению'}
        </button>
        {confirmation && !conflict ? (
          <button type="button" className="ghost" disabled={saveM.isPending} onClick={() => setConfirmation(null)}>Изменить дату</button>
        ) : null}
        <button type="button" className="ghost" disabled={saveM.isPending} onClick={onCancel}>
          {conflict ? 'Закрыть и обновить план' : 'Отмена'}
        </button>
      </div>
    </form>
  )
}
