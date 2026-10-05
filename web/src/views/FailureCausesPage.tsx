import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'

type FailureCauseForm = { name: string; active: boolean }

const EMPTY_FORM: FailureCauseForm = { name: '', active: true }

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function FailureCausesPage() {
  const qc = useQueryClient()
  const [create, setCreate] = useState<FailureCauseForm>(EMPTY_FORM)
  const [editing, setEditing] = useState<(FailureCauseForm & { id: string }) | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const causesQ = useQuery({
    queryKey: ['failure-causes'],
    queryFn: () => api.failureCauses(),
  })

  const rows = useMemo(() => causesQ.data || [], [causesQ.data])
  const invalidate = () => qc.invalidateQueries({ queryKey: ['failure-causes'] })

  const createM = useMutation({
    mutationFn: api.createFailureCause,
    onSuccess: async () => {
      setCreate(EMPTY_FORM)
      setMessage('Причина создана')
      await invalidate()
    },
  })

  const updateM = useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.UpdateFailureCauseInput }) =>
      api.updateFailureCause(id, input),
    onSuccess: async () => {
      setEditing(null)
      setMessage('Причина обновлена')
      await invalidate()
    },
  })

  const toggleM = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.setFailureCauseStatus(id, active),
    onSuccess: async () => {
      setMessage('Статус причины обновлён')
      await invalidate()
    },
  })

  const mutationError = createM.error || updateM.error || toggleM.error

  function validateName(name: string) {
    const normalized = name.trim()
    if (normalized.length < 2) return null
    return normalized
  }

  function submitCreate(event: FormEvent) {
    event.preventDefault()
    const name = validateName(create.name)
    if (!name) {
      setMessage('Название: минимум 2 символа')
      return
    }
    setMessage(null)
    createM.mutate({ name, active: create.active })
  }

  function submitEdit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    const name = validateName(editing.name)
    if (!name) {
      setMessage('Название: минимум 2 символа')
      return
    }
    setMessage(null)
    updateM.mutate({ id: editing.id, input: { name, active: editing.active } })
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Причины неисправности</h2>
          <div className="muted small">
            {causesQ.isFetching ? 'Загрузка…' : rows.length ? `Причин: ${rows.length}` : 'Справочник пуст'}
          </div>
        </div>
        <Link to="/settings">
          <button className="ghost">← К настройкам</button>
        </Link>
      </div>

      <div className="pageHint">
        Причина отвечает на вопрос «почему это произошло». Техник выбирает активную причину при отправке заявки на приёмку.
        История заявок хранит снимок названия, поэтому переименование справочника не меняет прошлые циклы.
      </div>

      {message ? <div className="panel" style={{ marginBottom: 12 }}>{message}</div> : null}
      {causesQ.isError ? <div className="alert">{formatError(causesQ.error)}</div> : null}
      {mutationError ? <div className="alert">{formatError(mutationError)}</div> : null}

      <div className="grid2" style={{ gridTemplateColumns: '1fr 1.5fr' }}>
        <form className="panel form" onSubmit={submitCreate}>
          <h3 style={{ marginBottom: 10 }}>Новая причина</h3>
          <label>
            Название *
            <input
              value={create.name}
              onChange={(event) => setCreate((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Естественный износ"
              disabled={createM.isPending}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={create.active}
              onChange={(event) => setCreate((prev) => ({ ...prev, active: event.target.checked }))}
              disabled={createM.isPending}
            />
            <span>Причина активна</span>
          </label>
          <button type="submit" disabled={createM.isPending}>{createM.isPending ? 'Создаём…' : 'Создать причину'}</button>
        </form>

        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Справочник</h3>
          {causesQ.isFetching && !causesQ.data ? <div className="muted small">Загрузка…</div> : null}
          {!causesQ.isFetching && rows.length === 0 ? (
            <div className="muted small">Создайте первую причину, чтобы техник мог отправлять выполненные заявки на приёмку.</div>
          ) : null}
          <div style={{ display: 'grid', gap: 12 }}>
            {rows.map((row) => (
              <div key={row.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#fff' }}>
                <div className="row" style={{ marginBottom: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{row.name}</div>
                    <div className="muted small" style={{ marginTop: 4 }}>ID: {row.id}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="tag">{row.active === false ? 'Неактивна' : 'Активна'}</span>
                    <button
                      type="button"
                      className="ghost"
                      disabled={toggleM.isPending || updateM.isPending}
                      onClick={() => toggleM.mutate({ id: row.id, active: !(row.active !== false) })}
                    >
                      {row.active === false ? 'Активировать' : 'Деактивировать'}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      disabled={toggleM.isPending || updateM.isPending}
                      onClick={() => setEditing({ id: row.id, name: row.name, active: row.active !== false })}
                    >
                      Изменить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {editing ? (
        <form className="panel form" onSubmit={submitEdit} style={{ marginTop: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Редактировать причину</h3>
          <label>
            Название *
            <input
              value={editing.name}
              onChange={(event) => setEditing((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
              disabled={updateM.isPending}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={editing.active}
              onChange={(event) => setEditing((prev) => (prev ? { ...prev, active: event.target.checked } : prev))}
              disabled={updateM.isPending}
            />
            <span>Причина активна</span>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={updateM.isPending}>{updateM.isPending ? 'Сохраняем…' : 'Сохранить'}</button>
            <button type="button" className="ghost" disabled={updateM.isPending} onClick={() => setEditing(null)}>Отмена</button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
