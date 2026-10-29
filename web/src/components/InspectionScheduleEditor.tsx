import { useId, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import {
  SCHEDULE_EDIT_FREQUENCIES,
  buildNotStartedScheduleEdit,
  canEditNotStartedSchedule,
  changeScheduleEditClient,
  changeScheduleEditLocation,
  scheduleEditDraft,
  scheduleEditSelectionIssue,
} from '../lib/inspectionScheduleEditing'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Не удалось выполнить действие'
}

function personLabel(person: { email: string; firstName?: string | null; lastName?: string | null }) {
  return [person.lastName, person.firstName].filter(Boolean).join(' ') || person.email
}

const EDIT_SCOPE_MESSAGE = 'Можно изменить только активный план, по которому ещё не начинали ни одного обхода. Начатые обходы и история не меняются.'

/** A small card integration; the create form remains independent of this guarded action. */
export function InspectionScheduleEditAction({ schedule }: { schedule: api.InspectionSchedule }) {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const qc = useQueryClient()
  // A refreshed card must not silently discard an open draft; the guarded save reports conflicts.
  if (!open && !canEditNotStartedSchedule(schedule)) return null

  const close = () => {
    setOpen(false)
    // Evict synchronously: an immediate reopen must not reuse the previous revision.
    qc.removeQueries({ queryKey: ['inspection-schedule-edit', schedule.id], exact: true })
    void qc.invalidateQueries({ queryKey: ['inspection-schedules'] })
  }

  return (
    <div style={{ marginTop: 12 }}>
      {open ? (
        <InspectionScheduleEditor
          scheduleId={schedule.id}
          onCancel={close}
          onSaved={() => { setSaved(true); close() }}
        />
      ) : (
        <>
          <button type="button" className="ghost" onClick={() => { setSaved(false); setOpen(true) }}>
            Изменить до начала
          </button>
          {saved ? <span role="status" style={{ marginLeft: 10 }}>Изменения сохранены</span> : null}
        </>
      )}
    </div>
  )
}

export function InspectionScheduleEditor({ scheduleId, onCancel, onSaved }: {
  scheduleId: string
  onCancel: () => void
  onSaved: () => void
}) {
  // No stale card snapshot: each opening obtains the canonical schedule and its revision.
  const scheduleQ = useQuery({
    queryKey: ['inspection-schedule-edit', scheduleId],
    queryFn: () => api.getInspectionSchedule(scheduleId),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  })

  if (scheduleQ.isPending) return (
    <div role="status">
      Загружаем план для изменения…{' '}
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
  if (!canEditNotStartedSchedule(scheduleQ.data)) return (
    <div>
      <div className="alert" role="alert">Этот план больше нельзя изменить до начала. {EDIT_SCOPE_MESSAGE}</div>
      <button type="button" className="ghost" onClick={onCancel}>Закрыть и обновить план</button>
    </div>
  )

  return <InspectionScheduleEditForm key={scheduleId} schedule={scheduleQ.data} onCancel={onCancel} onSaved={onSaved} />
}

function InspectionScheduleEditForm({ schedule, onCancel, onSaved }: {
  schedule: api.InspectionSchedule
  onCancel: () => void
  onSaved: () => void
}) {
  // Keep the read revision with the draft; background data must never bless stale edits.
  const [draft, setDraft] = useState(() => scheduleEditDraft(schedule))
  const [conflict, setConflict] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  const titleId = useId()
  const qc = useQueryClient()
  const templatesQ = useQuery({ queryKey: ['inspection-templates'], queryFn: api.getInspectionTemplates })
  const clientsQ = useQuery({ queryKey: ['linked-clients'], queryFn: api.getLinkedClients })
  const locationsQ = useQuery({
    queryKey: ['locations', draft.clientCompanyId],
    queryFn: () => api.locations(draft.clientCompanyId || undefined),
  })
  const assigneesQ = useQuery({
    queryKey: ['round-assignable-technicians', draft.locationId],
    queryFn: () => api.getAssignableRoundTechnicians(draft.locationId),
    enabled: !!draft.locationId,
  })
  const equipmentQ = useQuery({
    queryKey: ['inspection-schedule-edit-equipment', draft.locationId, draft.clientCompanyId],
    queryFn: () => api.equipmentByLocation(draft.locationId, draft.clientCompanyId || undefined),
    enabled: !!draft.locationId,
  })
  const templates = (templatesQ.data || []).filter((row) => row.isActive)
  const clients = clientsQ.data || []
  const locations = locationsQ.data || []
  const assignees = assigneesQ.data || []
  const equipment = equipmentQ.data || []
  const lookupError = templatesQ.isError || clientsQ.isError || locationsQ.isError
    || (!!draft.locationId && (assigneesQ.isError || equipmentQ.isError))
  const lookupPending = templatesQ.isPending || clientsQ.isPending || locationsQ.isPending
    || (!!draft.locationId && (assigneesQ.isPending || equipmentQ.isPending))
  const selectionIssue = lookupError || lookupPending ? null : scheduleEditSelectionIssue(draft, {
    templates, locations, assignees, equipment,
  })

  const saveM = useMutation({
    mutationFn: (input: api.EditNotStartedInspectionScheduleInput) => api.editNotStartedInspectionSchedule(schedule.id, input),
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
        setError('План изменился или обход уже начат. Изменения не сохранены. Закройте редактор и откройте актуальный план заново.')
      } else {
        setError(errorMessage(failure))
      }
    },
    onSettled: () => { saving.current = false },
  })

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving.current || conflict || lookupPending || lookupError || selectionIssue) return
    try {
      const input = buildNotStartedScheduleEdit(draft)
      setError('')
      saving.current = true
      saveM.mutate(input)
    } catch (failure) {
      setError(errorMessage(failure))
    }
  }

  const missingTemplate = draft.templateId && !templates.some((row) => row.id === draft.templateId)
  const missingLocation = draft.locationId && !locations.some((row) => row.id === draft.locationId)
  const missingEquipment = draft.equipmentId && !equipment.some((row) => row.id === draft.equipmentId)
  const missingAssignee = draft.assignedToUserId && !assignees.some((row) => row.id === draft.assignedToUserId)

  return (
    <form onSubmit={submit} aria-labelledby={titleId} className="panel">
      <h3 id={titleId} style={{ marginTop: 0 }}>Изменить план до первого обхода</h3>
      <p className="muted small">{EDIT_SCOPE_MESSAGE}</p>
      <p className="muted small">Дата и время — в часовом поясе вашего устройства. Изменение даты перенесёт первый срок плана.</p>
      {error ? <div className="alert" role="alert">{error}</div> : null}
      {lookupError ? (
        <div className="alert" role="alert">
          Не удалось загрузить доступные значения. Выбор сохранён; сохранение плана недоступно до успешной загрузки.{' '}
          <button type="button" className="ghost" disabled={saveM.isPending} onClick={() => {
            void templatesQ.refetch()
            void clientsQ.refetch()
            void locationsQ.refetch()
            if (draft.locationId) { void assigneesQ.refetch(); void equipmentQ.refetch() }
          }}>Повторить загрузку</button>
        </div>
      ) : lookupPending ? <div role="status" className="muted">Загружаем доступные значения…</div> : null}
      {selectionIssue ? <div className="alert" role="alert">{selectionIssue}</div> : null}
      <fieldset disabled={saveM.isPending || conflict} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <label>
            <div className="muted small">Название плана</div>
            <input value={draft.name} maxLength={160} required onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label>
            <div className="muted small">Клиент</div>
            <select value={draft.clientCompanyId} disabled={clientsQ.isPending || clientsQ.isError} onChange={(event) => {
              setDraft(changeScheduleEditClient(draft, event.target.value))
            }}>
              <option value="">Своя компания</option>
              {draft.clientCompanyId && !clients.some((row) => row.clientCompany.id === draft.clientCompanyId)
                ? <option value={draft.clientCompanyId}>Текущий клиент плана</option> : null}
              {clients.map((row) => <option key={row.id} value={row.clientCompany.id}>{row.clientCompany.name}</option>)}
            </select>
          </label>
          <label>
            <div className="muted small">Шаблон обхода</div>
            <select value={draft.templateId} required disabled={templatesQ.isPending || templatesQ.isError}
              onChange={(event) => setDraft({ ...draft, templateId: event.target.value })}>
              <option value="">Не выбран</option>
              {missingTemplate ? <option value={draft.templateId}>{schedule.template.name} (текущий, доступность не подтверждена)</option> : null}
              {templates.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>
          <label>
            <div className="muted small">Точка</div>
            <select value={draft.locationId} required disabled={locationsQ.isPending || locationsQ.isError}
              onChange={(event) => setDraft(changeScheduleEditLocation(draft, event.target.value))}>
              <option value="">Не выбрана</option>
              {missingLocation ? <option value={draft.locationId}>{schedule.location.name} (текущая, доступность не подтверждена)</option> : null}
              {locations.map((row) => <option key={row.id} value={row.id}>{row.name}{row.city ? ` · ${row.city}` : ''}</option>)}
            </select>
          </label>
          <label>
            <div className="muted small">Оборудование (необязательно)</div>
            <select value={draft.equipmentId} disabled={!draft.locationId || equipmentQ.isPending || equipmentQ.isError}
              onChange={(event) => setDraft({ ...draft, equipmentId: event.target.value })}>
              <option value="">Без оборудования</option>
              {missingEquipment ? <option value={draft.equipmentId}>{schedule.equipment?.name || 'Текущее оборудование'} (доступность не подтверждена)</option> : null}
              {equipment.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
            {draft.locationId && equipmentQ.isSuccess && equipment.length === 0
              ? <div className="muted small">На этой точке нет оборудования. План может быть без оборудования.</div> : null}
          </label>
          <label>
            <div className="muted small">Техник</div>
            <select value={draft.assignedToUserId} disabled={!draft.locationId || assigneesQ.isPending || assigneesQ.isError}
              onChange={(event) => setDraft({ ...draft, assignedToUserId: event.target.value })}>
              <option value="">Без назначения</option>
              {missingAssignee ? <option value={draft.assignedToUserId}>{schedule.assignedTo ? personLabel(schedule.assignedTo) : 'Текущий техник'} (доступность не подтверждена)</option> : null}
              {assignees.map((row) => <option key={row.id} value={row.id}>{personLabel(row)}</option>)}
            </select>
            {draft.locationId && assigneesQ.isSuccess && assignees.length === 0
              ? <div className="muted small">Для этой точки нет доступных исполнителей.</div> : null}
          </label>
          <label>
            <div className="muted small">Дата</div>
            <input type="date" value={draft.date} required onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
          </label>
          <label>
            <div className="muted small">Время</div>
            <input type="time" value={draft.time} required onChange={(event) => setDraft({ ...draft, time: event.target.value })} />
          </label>
          <label>
            <div className="muted small">Повторение</div>
            <select value={draft.frequency} onChange={(event) => setDraft({ ...draft, frequency: event.target.value as api.InspectionFrequency })}>
              {Object.entries(SCHEDULE_EDIT_FREQUENCIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {draft.frequency === 'CUSTOM' ? (
            <label>
              <div className="muted small">Интервал, дней</div>
              <input type="number" min={1} max={3650} step={1} required value={draft.intervalDays}
                onChange={(event) => setDraft({ ...draft, intervalDays: event.target.value })} />
            </label>
          ) : null}
        </div>
      </fieldset>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button type="submit" disabled={saveM.isPending || conflict || lookupPending || lookupError || !!selectionIssue}>
          {saveM.isPending ? 'Сохраняем…' : 'Сохранить изменения'}
        </button>
        <button type="button" className="ghost" disabled={saveM.isPending} onClick={onCancel}>
          {conflict ? 'Закрыть и обновить план' : 'Отмена'}
        </button>
      </div>
    </form>
  )
}
