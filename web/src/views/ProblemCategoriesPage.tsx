import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import * as api from '../lib/api'

const CreateCategorySchema = z.object({
  name: z.string().min(2, 'Название: минимум 2 символа'),
  instructions: z.string().optional(),
  isActive: z.boolean(),
})

export function ProblemCategoriesPage() {
  const qc = useQueryClient()

  const [err, setErr] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [draftSpecs, setDraftSpecs] = useState<Record<string, string[]>>({})

  const categoriesQ = useQuery({
    queryKey: ['problem-categories'],
    queryFn: api.problemCategories,
  })

  const specializationsQ = useQuery({
    queryKey: ['specializations'],
    queryFn: api.specializations,
  })

  const createM = useMutation({
    mutationFn: (payload: api.CreateProblemCategoryInput) => api.createProblemCategory(payload),
    onSuccess: async () => {
      setErr(null)
      setName('')
      setInstructions('')
      setIsActive(true)
      await qc.invalidateQueries({ queryKey: ['problem-categories'] })
    },
    onError: (e: any) => setErr(e?.message || String(e)),
  })

  const toggleM = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.setProblemCategoryStatus(id, isActive),
    onSuccess: async () => {
      setErr(null)
      await qc.invalidateQueries({ queryKey: ['problem-categories'] })
    },
    onError: (e: any) => setErr(e?.message || String(e)),
  })

  const saveSpecsM = useMutation({
    mutationFn: ({ id, specializationIds }: { id: string; specializationIds: string[] }) =>
      api.setProblemCategorySpecializations(id, specializationIds),
    onSuccess: async () => {
      setErr(null)
      await qc.invalidateQueries({ queryKey: ['problem-categories'] })
    },
    onError: (e: any) => setErr(e?.message || String(e)),
  })

  const rows = useMemo(() => categoriesQ.data || [], [categoriesQ.data])
  const activeSpecializations = useMemo(
    () => (specializationsQ.data || []).filter((row) => row.isActive !== false),
    [specializationsQ.data],
  )

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)

    const parsed = CreateCategorySchema.safeParse({
      name,
      instructions,
      isActive,
    })

    if (!parsed.success) {
      setErr(parsed.error.issues.map((i) => i.message).join('\n'))
      return
    }

    createM.mutate({
      name: parsed.data.name,
      instructions: parsed.data.instructions?.trim() ? parsed.data.instructions.trim() : null,
      isActive: parsed.data.isActive,
    })
  }

  function getSelectedSpecIds(row: api.ProblemCategoryListItem) {
    const draft = draftSpecs[row.id]
    if (draft) return draft
    return (row.specializationLinks || []).map((x) => x.specializationId)
  }

  function toggleSpec(categoryId: string, specializationId: string, checked: boolean, baseIds: string[]) {
    const current = draftSpecs[categoryId] ?? baseIds
    const next = checked
      ? Array.from(new Set([...current, specializationId]))
      : current.filter((id) => id !== specializationId)

    setDraftSpecs((prev) => ({
      ...prev,
      [categoryId]: next,
    }))
  }

  function resetSpecs(row: api.ProblemCategoryListItem) {
    setDraftSpecs((prev) => {
      const next = { ...prev }
      delete next[row.id]
      return next
    })
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Категории проблем</h2>
          <div className="muted small">
            {categoriesQ.isFetching ? 'Загрузка…' : rows.length ? `Всего категорий: ${rows.length}` : 'Категорий пока нет'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="ghost" onClick={() => categoriesQ.refetch()} disabled={categoriesQ.isFetching}>
            Обновить
          </button>
          <Link to="/tickets/new">
            <button className="ghost">Создать заявку</button>
          </Link>
          <Link to="/board">
            <button className="ghost">← Назад к доске</button>
          </Link>
        </div>
      </div>

      {err ? <div className="alert">{err}</div> : null}
      {categoriesQ.isError ? <div className="alert">{(categoriesQ.error as any)?.message || String(categoriesQ.error)}</div> : null}
      {specializationsQ.isError ? <div className="alert">{(specializationsQ.error as any)?.message || String(specializationsQ.error)}</div> : null}

      <div className="grid2" style={{ gridTemplateColumns: '1fr 1.5fr' }}>
        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Добавить категорию</h3>

          <form onSubmit={submit} className="form">
            <label>
              Название *
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Сантехника" />
            </label>

            <label>
              Инструкция
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Что должен уточнить сотрудник при создании заявки"
                rows={5}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <span>Категория активна</span>
            </label>

            <button type="submit" disabled={createM.isPending}>
              {createM.isPending ? 'Создаём…' : 'Создать категорию'}
            </button>

            <div className="muted small">
              Активные категории будут доступны в форме создания заявки.
            </div>
          </form>
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 10 }}>Список категорий</h3>

          {categoriesQ.isFetching && !categoriesQ.data ? <div className="muted small">Загрузка…</div> : null}
          {!categoriesQ.isFetching && rows.length === 0 ? <div className="muted small">Категорий пока нет</div> : null}

          <div style={{ display: 'grid', gap: 12 }}>
            {rows.map((row) => {
              const selectedSpecIds = getSelectedSpecIds(row)
              const linkedSpecNames = (row.specializationLinks || []).map((x) => x.specialization.name)

              return (
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
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="tag">{row.isActive === false ? 'Неактивна' : 'Активна'}</span>

                      <button
                        className="ghost"
                        disabled={toggleM.isPending}
                        onClick={() => toggleM.mutate({ id: row.id, isActive: !(row.isActive !== false) })}
                      >
                        {row.isActive === false ? 'Включить' : 'Отключить'}
                      </button>
                    </div>
                  </div>

                  <div className="muted small" style={{ marginBottom: 10 }}>
                    {row.instructions?.trim() ? row.instructions : 'Инструкция не задана'}
                  </div>

                  <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Связанные специализации</div>

                  <div className="muted small" style={{ marginBottom: 10 }}>
                    {linkedSpecNames.length ? linkedSpecNames.join(', ') : 'Пока не привязаны'}
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gap: 8,
                      padding: 10,
                      border: '1px solid #eef2f7',
                      borderRadius: 12,
                      background: '#fafafa',
                    }}
                  >
                    {activeSpecializations.length === 0 ? (
                      <div className="muted small">Нет активных специализаций. Сначала создай их на странице специализаций.</div>
                    ) : (
                      activeSpecializations.map((spec) => (
                        <label
                          key={spec.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 13,
                            color: '#111827',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSpecIds.includes(spec.id)}
                            onChange={(e) => toggleSpec(row.id, spec.id, e.target.checked, (row.specializationLinks || []).map((x) => x.specializationId))}
                          />
                          <span>{spec.name}</span>
                        </label>
                      ))
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                      <button
                        disabled={saveSpecsM.isPending}
                        onClick={() =>
                          saveSpecsM.mutate({
                            id: row.id,
                            specializationIds: selectedSpecIds,
                          })
                        }
                      >
                        {saveSpecsM.isPending ? 'Сохраняем…' : 'Сохранить специализации'}
                      </button>

                      <button
                        className="ghost"
                        disabled={saveSpecsM.isPending}
                        onClick={() => resetSpecs(row)}
                      >
                        Сбросить
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="muted small" style={{ marginTop: 10 }}>
            После привязки специализаций система сможет показывать подходящих техников при назначении заявки.
          </div>
        </div>
      </div>
    </div>
  )
}
