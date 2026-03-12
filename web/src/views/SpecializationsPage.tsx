import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import * as api from '../lib/api'

const CreateSpecializationSchema = z.object({
  name: z.string().min(2, 'Название: минимум 2 символа'),
  isActive: z.boolean(),
})

function fmt(dt?: string) {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString('ru-RU')
  } catch {
    return dt
  }
}

export function SpecializationsPage() {
  const qc = useQueryClient()

  const [err, setErr] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)

  const specsQ = useQuery({
    queryKey: ['specializations'],
    queryFn: api.specializations,
  })

  const createM = useMutation({
    mutationFn: (payload: api.CreateSpecializationInput) => api.createSpecialization(payload),
    onSuccess: async (created) => {
      setErr(null)
      setSuccess(`Специализация ${created.name} создана`)
      setName('')
      setIsActive(true)

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['specializations'] }),
        qc.invalidateQueries({ queryKey: ['technicians'] }),
      ])
    },
    onError: (e: any) => {
      setSuccess(null)
      setErr(e?.message || String(e))
    },
  })

  const toggleM = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.setSpecializationStatus(id, isActive),
    onSuccess: async () => {
      setErr(null)
      setSuccess('Статус специализации обновлён')

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['specializations'] }),
        qc.invalidateQueries({ queryKey: ['technicians'] }),
      ])
    },
    onError: (e: any) => {
      setSuccess(null)
      setErr(e?.message || String(e))
    },
  })

  const rows = useMemo(() => specsQ.data || [], [specsQ.data])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSuccess(null)

    const parsed = CreateSpecializationSchema.safeParse({
      name: name.trim(),
      isActive,
    })

    if (!parsed.success) {
      setErr(parsed.error.issues.map((i) => i.message).join('\n'))
      return
    }

    createM.mutate({
      name: parsed.data.name,
      isActive: parsed.data.isActive,
    })
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Специализации</h2>
          <div className="muted small">
            {specsQ.isFetching ? 'Загрузка…' : rows.length ? `Всего специализаций: ${rows.length}` : 'Специализаций пока нет'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="ghost" onClick={() => specsQ.refetch()} disabled={specsQ.isFetching || createM.isPending || toggleM.isPending}>
            Обновить
          </button>
          <Link to="/employees">
            <button className="ghost">Сотрудники</button>
          </Link>
          <Link to="/board">
            <button className="ghost">← Назад к доске</button>
          </Link>
        </div>
      </div>

      {err ? <div className="alert">{err}</div> : null}
      {success ? <div className="panel" style={{ marginBottom: 12 }}>{success}</div> : null}
      {specsQ.isError ? <div className="alert">{(specsQ.error as any)?.message || String(specsQ.error)}</div> : null}

      <div className="grid2" style={{ gridTemplateColumns: '1fr 1.35fr' }}>
        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Добавить специализацию</h3>

          <form onSubmit={submit} className="form">
            <label>
              Название *
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Электрика"
                disabled={createM.isPending}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={createM.isPending}
              />
              <span>Специализация активна</span>
            </label>

            <button type="submit" disabled={createM.isPending || toggleM.isPending}>
              {createM.isPending ? 'Создаём…' : 'Создать специализацию'}
            </button>

            <div className="muted small">
              Активные специализации доступны при назначении техникам.
            </div>
          </form>
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Список специализаций</h3>

          {specsQ.isFetching && !specsQ.data ? <div className="muted small">Загрузка…</div> : null}
          {!specsQ.isFetching && rows.length === 0 ? <div className="muted small">Специализаций пока нет</div> : null}

          <div style={{ display: 'grid', gap: 10 }}>
            {rows.map((row) => (
              <div
                key={row.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 12,
                  background: '#fff',
                }}
              >
                <div className="row" style={{ marginBottom: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{row.name}</div>
                    <div className="muted small" style={{ marginTop: 4 }}>
                      ID: {row.id}
                    </div>
                    <div className="muted small" style={{ marginTop: 4 }}>
                      Создано: {fmt(row.createdAt)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="tag">{row.isActive === false ? 'Неактивна' : 'Активна'}</span>

                    <button
                      className="ghost"
                      disabled={toggleM.isPending || createM.isPending}
                      onClick={() => toggleM.mutate({ id: row.id, isActive: !(row.isActive !== false) })}
                    >
                      {row.isActive === false ? 'Включить' : 'Отключить'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="muted small" style={{ marginTop: 10 }}>
            Для V1 этого достаточно: создание специализации и включение/выключение её доступности для назначения техникам.
          </div>
        </div>
      </div>
    </div>
  )
}
