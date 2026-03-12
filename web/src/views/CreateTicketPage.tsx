import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import * as api from '../lib/api'

const CreateTicketSchema = z.object({
  problemText: z.string().min(5, 'problemText: минимум 5 символов'),
  urgency: z.enum(['URGENT', 'NOT_URGENT']),
  problemCategoryId: z.string().uuid('problemCategoryId: uuid'),
  requesterName: z.string().optional().nullable(),
  requesterPhone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  pointName: z.string().optional().nullable(),
  slaMinutes: z
    .union([z.number().int().positive(), z.nan()])
    .optional()
    .transform((v) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined)),
})

function urgencyLabel(value: 'URGENT' | 'NOT_URGENT') {
  return value === 'URGENT' ? 'Срочно' : 'Не срочно'
}

export function CreateTicketPage() {
  const nav = useNavigate()
  const qc = useQueryClient()

  const [err, setErr] = useState<string | null>(null)

  const [problemText, setProblemText] = useState('Опиши проблему…')
  const [urgency, setUrgency] = useState<'URGENT' | 'NOT_URGENT'>('NOT_URGENT')
  const [problemCategoryId, setProblemCategoryId] = useState('')

  const [requesterName, setRequesterName] = useState<string>('')
  const [requesterPhone, setRequesterPhone] = useState<string>('')
  const [address, setAddress] = useState<string>('')
  const [pointName, setPointName] = useState<string>('')
  const [slaMinutes, setSlaMinutes] = useState<string>('')

  const categoriesQ = useQuery({
    queryKey: ['problem-categories'],
    queryFn: api.problemCategories,
  })

  const activeCategories = useMemo(() => {
    const rows = categoriesQ.data || []
    return rows.filter((row) => row.isActive !== false)
  }, [categoriesQ.data])

  useEffect(() => {
    if (!problemCategoryId && activeCategories.length > 0) {
      setProblemCategoryId(activeCategories[0].id)
    }
  }, [activeCategories, problemCategoryId])

  const selectedCategory = useMemo(() => {
    return activeCategories.find((c) => c.id === problemCategoryId) || null
  }, [activeCategories, problemCategoryId])

  function resetForm(keepCategory = true) {
    setProblemText('Опиши проблему…')
    setUrgency('NOT_URGENT')
    setRequesterName('')
    setRequesterPhone('')
    setAddress('')
    setPointName('')
    setSlaMinutes('')
    setErr(null)

    if (!keepCategory) {
      setProblemCategoryId(activeCategories[0]?.id || '')
    }
  }

  const createM = useMutation({
    mutationFn: (payload: api.CreateTicketInput) => api.createTicket(payload),
    onSuccess: async (created) => {
      setErr(null)
      await qc.invalidateQueries({ queryKey: ['board'] })

      const createdId = api.extractCreatedTicketId(created)
      if (!createdId) {
        setErr(`Не удалось определить id созданной заявки из ответа backend: ${JSON.stringify(created)}`)
        return
      }

      nav(`/tickets/${createdId}`)
    },
    onError: (e: any) => setErr(e?.message || String(e)),
  })

  const createAndNewM = useMutation({
    mutationFn: (payload: api.CreateTicketInput) => api.createTicket(payload),
    onSuccess: async () => {
      setErr(null)
      await qc.invalidateQueries({ queryKey: ['board'] })
      resetForm(true)
    },
    onError: (e: any) => setErr(e?.message || String(e)),
  })

  function buildPayload() {
    return {
      problemText,
      urgency,
      problemCategoryId,
      requesterName: requesterName || null,
      requesterPhone: requesterPhone || null,
      address: address || null,
      pointName: pointName || null,
      slaMinutes: slaMinutes.trim() ? Number(slaMinutes) : undefined,
    }
  }

  function validatePayload() {
    const parsed = CreateTicketSchema.safeParse(buildPayload())

    if (!parsed.success) {
      setErr(parsed.error.issues.map((i) => i.message).join('\n'))
      return null
    }

    return parsed.data as api.CreateTicketInput
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)

    const payload = validatePayload()
    if (!payload) return

    createM.mutate(payload)
  }

  function onCreateAndNew() {
    setErr(null)

    const payload = validatePayload()
    if (!payload) return

    createAndNewM.mutate(payload)
  }

  const isBusy = createM.isPending || createAndNewM.isPending

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Создать заявку</h2>
          <div className="muted small">Быстрая форма создания для демо</div>
        </div>
        <div>
          <Link to="/board">
            <button className="ghost">← Назад к доске</button>
          </Link>
        </div>
      </div>

      {err ? <div className="alert">{err}</div> : null}
      {categoriesQ.isError ? (
        <div className="alert">{(categoriesQ.error as any)?.message || String(categoriesQ.error)}</div>
      ) : null}

      <div className="panel">
        <form onSubmit={onSubmit} className="form" style={{ maxWidth: 860 }}>
          <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <label>
              Срочность *
              <select value={urgency} onChange={(e) => setUrgency(e.target.value as 'URGENT' | 'NOT_URGENT')}>
                <option value="NOT_URGENT">{urgencyLabel('NOT_URGENT')}</option>
                <option value="URGENT">{urgencyLabel('URGENT')}</option>
              </select>
            </label>

            <label>
              SLA, минут
              <input
                value={slaMinutes}
                onChange={(e) => setSlaMinutes(e.target.value)}
                placeholder="Например 120"
                inputMode="numeric"
              />
            </label>
          </div>

          <label>
            Описание проблемы *
            <input value={problemText} onChange={(e) => setProblemText(e.target.value)} />
          </label>

          <label>
            Категория проблемы *
            <select
              value={problemCategoryId}
              onChange={(e) => setProblemCategoryId(e.target.value)}
              disabled={categoriesQ.isFetching || activeCategories.length === 0}
            >
              {activeCategories.length === 0 ? <option value="">Нет доступных категорий</option> : null}

              {activeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <div className="muted small" style={{ marginTop: 6 }}>
              {categoriesQ.isFetching
                ? 'Загружаем категории…'
                : activeCategories.length === 0
                  ? 'Сначала создай хотя бы одну активную категорию проблем под ADMIN.'
                  : 'Категории загружаются из backend и выбираются сотрудником без ручного UUID.'}
            </div>
          </label>

          {selectedCategory?.instructions ? (
            <div className="panel" style={{ padding: 12 }}>
              <div className="muted small" style={{ marginBottom: 6 }}>
                Инструкция по выбранной категории
              </div>
              <div>{selectedCategory.instructions}</div>
            </div>
          ) : null}

          <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <label>
              Имя заявителя
              <input value={requesterName} onChange={(e) => setRequesterName(e.target.value)} />
            </label>

            <label>
              Телефон заявителя
              <input value={requesterPhone} onChange={(e) => setRequesterPhone(e.target.value)} />
            </label>
          </div>

          <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <label>
              Адрес
              <input value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>

            <label>
              Точка
              <input value={pointName} onChange={(e) => setPointName(e.target.value)} />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" disabled={isBusy || categoriesQ.isFetching || activeCategories.length === 0}>
              {createM.isPending ? 'Создаём…' : 'Создать'}
            </button>

            <button
              type="button"
              className="ghost"
              onClick={onCreateAndNew}
              disabled={isBusy || categoriesQ.isFetching || activeCategories.length === 0}
            >
              {createAndNewM.isPending ? 'Создаём…' : 'Создать и новую'}
            </button>

            <button type="button" className="ghost" onClick={() => resetForm(true)} disabled={isBusy}>
              Очистить форму
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
