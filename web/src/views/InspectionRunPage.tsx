import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'

const MAX_PHOTO_SIZE = 10 * 1024 * 1024

type ItemDraft = {
  status: api.InspectionRunItemStatus
  requiresRepair: boolean
  comment: string
  categoryId: string
  title: string
  description: string
}

function statusLabel(status: api.InspectionRunItemStatus) {
  if (status === 'PENDING') return 'Не заполнено'
  if (status === 'OK') return 'OK'
  if (status === 'ISSUE') return 'Проблема'
  if (status === 'CRITICAL') return 'Критично'
  if (status === 'SKIPPED') return 'Пропущено'
  return status
}

function statusButtonStyle(active: boolean, tone: 'neutral' | 'good' | 'warn' | 'danger') {
  const palettes = {
    neutral: active ? ['#e0f2fe', '#0284c7', '#075985'] : ['#fff', '#d1d5db', '#374151'],
    good: active ? ['#dcfce7', '#16a34a', '#166534'] : ['#fff', '#d1d5db', '#374151'],
    warn: active ? ['#fef3c7', '#f59e0b', '#92400e'] : ['#fff', '#d1d5db', '#374151'],
    danger: active ? ['#fee2e2', '#ef4444', '#991b1b'] : ['#fff', '#d1d5db', '#374151'],
  } as const
  const [bg, border, color] = palettes[tone]
  return { background: bg, border: `1px solid ${border}`, color }
}

function fmtDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU')
  } catch {
    return value
  }
}

function buildSummaryFromRun(run: api.InspectionRun): api.InspectionRunSummary {
  return {
    totalItems: run.items.length,
    okCount: run.items.filter((item) => item.status === 'OK').length,
    issueCount: run.items.filter((item) => item.status === 'ISSUE').length,
    criticalCount: run.items.filter((item) => item.status === 'CRITICAL').length,
    skippedCount: run.items.filter((item) => item.status === 'SKIPPED').length,
    repairRequiredCount: run.items.filter((item) => item.requiresRepair).length,
    createdTicketsCount: run.items.filter((item) => !!item.ticketId).length,
  }
}

export function InspectionRunPage() {
  const params = useParams<{ id: string }>()
  const runId = params.id || ''
  const queryClient = useQueryClient()

  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({})
  const [summary, setSummary] = useState<api.InspectionRunSummary | null>(null)
  const [savingItemId, setSavingItemId] = useState<string | null>(null)
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null)
  const [creatingTicketItemId, setCreatingTicketItemId] = useState<string | null>(null)

  const runQ = useQuery({
    queryKey: ['inspection-run', runId],
    queryFn: () => api.getInspectionRun(runId),
    enabled: !!runId,
  })
  const categoriesQ = useQuery<api.ProblemCategoryListItem[]>({
    queryKey: ['problem-categories'],
    queryFn: () => api.problemCategories(),
  })
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const categories = useMemo(
    () => (categoriesQ.data || []).filter((item: api.ProblemCategoryListItem) => item.isActive !== false),
    [categoriesQ.data],
  )

  useEffect(() => {
    if (!runQ.data) return
    const firstCategoryId = categories[0]?.id || ''
    setDrafts((current) => {
      const next: Record<string, ItemDraft> = {}
      for (const item of runQ.data.items) {
        next[item.id] = current[item.id] || {
          status: item.status,
          requiresRepair: item.requiresRepair,
          comment: item.comment || '',
          categoryId: firstCategoryId,
          title: item.title,
          description: item.comment || item.description || '',
        }
      }
      return next
    })

    if (runQ.data.status === 'COMPLETED') {
      setSummary((prev) => prev || buildSummaryFromRun(runQ.data))
    }
  }, [runQ.data, categories])

  const updateItemM = useMutation({
    mutationFn: (input: { itemId: string; payload: api.UpdateInspectionRunItemInput }) =>
      api.updateInspectionRunItem(runId, input.itemId, input.payload),
    onSuccess: async () => {
      setError(null)
      setSavingItemId(null)
      await queryClient.invalidateQueries({ queryKey: ['inspection-run', runId] })
      await queryClient.invalidateQueries({ queryKey: ['inspection-runs'] })
    },
    onError: (err: any) => {
      setSavingItemId(null)
      setError(err?.message || String(err))
    },
  })

  const uploadM = useMutation({
    mutationFn: (input: { itemId: string; file: File }) => api.uploadInspectionRunItemAttachment(runId, input.itemId, input.file),
    onSuccess: async () => {
      setError(null)
      setUploadingItemId(null)
      await queryClient.invalidateQueries({ queryKey: ['inspection-run', runId] })
    },
    onError: (err: any) => {
      setUploadingItemId(null)
      setError(err?.message || String(err))
    },
  })

  const createTicketM = useMutation({
    mutationFn: (input: { itemId: string; payload: api.CreateTicketFromInspectionItemInput }) =>
      api.createTicketFromInspectionItem(runId, input.itemId, input.payload),
    onSuccess: async () => {
      setError(null)
      setCreatingTicketItemId(null)
      await queryClient.invalidateQueries({ queryKey: ['inspection-run', runId] })
      await queryClient.invalidateQueries({ queryKey: ['inspection-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
      await queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
    onError: (err: any) => {
      setCreatingTicketItemId(null)
      setError(err?.message || String(err))
    },
  })

  const completeM = useMutation({
    mutationFn: () => api.completeInspectionRun(runId),
    onSuccess: async (result) => {
      setError(null)
      setSummary(result.summary)
      queryClient.setQueryData(['inspection-run', runId], result.run)
      await queryClient.invalidateQueries({ queryKey: ['inspection-run', runId] })
      await queryClient.invalidateQueries({ queryKey: ['inspection-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['inspection-run-report', runId] })
    },
    onError: (err: any) => setError(err?.message || String(err)),
  })

  const run = runQ.data
  const isCompleted = run?.status === 'COMPLETED'

  function patchDraft(itemId: string, patch: Partial<ItemDraft>) {
    setDrafts((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId],
        ...patch,
      },
    }))
  }

  function saveItem(item: api.InspectionRunItem) {
    const draft = drafts[item.id]
    if (!draft) return
    setSavingItemId(item.id)
    updateItemM.mutate({
      itemId: item.id,
      payload: {
        status: draft.status,
        requiresRepair: draft.status === 'ISSUE' || draft.status === 'CRITICAL' ? draft.requiresRepair : false,
        comment: draft.comment,
      },
    })
  }

  function uploadFile(item: api.InspectionRunItem, file: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Можно загружать только изображения')
      return
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setError('Изображение слишком большое. Максимум 10 МБ')
      return
    }
    setUploadingItemId(item.id)
    uploadM.mutate({ itemId: item.id, file })
  }

  function createTicket(item: api.InspectionRunItem) {
    const draft = drafts[item.id]
    if (!draft?.categoryId) {
      setError('Выберите категорию для создания заявки')
      return
    }
    setCreatingTicketItemId(item.id)
    createTicketM.mutate({
      itemId: item.id,
      payload: {
        categoryId: draft.categoryId,
        title: draft.title.trim() || undefined,
        description: draft.description.trim() || draft.comment.trim() || undefined,
        urgency: draft.status === 'CRITICAL' ? 'URGENT' : 'NOT_URGENT',
      },
    })
  }

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Прохождение обхода</h2>
          <div className="muted small">Отметьте каждый пункт, приложите фото и создайте заявки по проблемным местам.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {runId ? (
            <Link to={`/inspection/quick/${runId}`}>
              <button className="ghost">Быстрый обход</button>
            </Link>
          ) : null}
          <Link to="/inspection/templates"><button className="ghost">Все шаблоны</button></Link>
          <Link to="/inspection/runs"><button className="ghost">История</button></Link>
        </div>
      </div>

      {error ? <div className="alert">{error}</div> : null}
      {runQ.isError ? <div className="alert">{(runQ.error as any)?.message || String(runQ.error)}</div> : null}

      {run ? (
        <>
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="row" style={{ alignItems: 'flex-start', marginBottom: 0 }}>
              <div>
                <h3 style={{ margin: 0 }}>{run.title}</h3>
                <div className="muted small" style={{ marginTop: 6 }}>
                  Шаблон: {run.template.name} · Локация: {run.location.name}
                  {run.location.city ? ` · ${run.location.city}` : ''}
                  {run.equipment ? ` · Оборудование: ${run.equipment.name}` : ''}
                </div>
                <div className="muted small" style={{ marginTop: 4 }}>
                  Исполнитель: {run.performedBy ? `${run.performedBy.firstName || ''} ${run.performedBy.lastName || ''}`.trim() || run.performedBy.email : meQ.data?.email || '—'}
                  {' · '}Статус: {run.status}
                  {' · '}Создан: {fmtDate(run.createdAt)}
                  {run.completedAt ? ` · Завершён: ${fmtDate(run.completedAt)}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="tag">{run.status}</span>
                {isCompleted ? (
                  <Link to={`/inspection/runs/${run.id}/report`}>
                    <button type="button" className="ghost">Открыть отчёт</button>
                  </Link>
                ) : null}
                <button type="button" onClick={() => completeM.mutate()} disabled={isCompleted || completeM.isPending || updateItemM.isPending || uploadM.isPending || createTicketM.isPending}>
                  {completeM.isPending ? 'Завершаем…' : 'Завершить обход'}
                </button>
              </div>
            </div>
          </div>

          {summary ? (
            <div className="panel" style={{ marginBottom: 12 }}>
              <h3 style={{ marginBottom: 10 }}>Итоги обхода</h3>
              <div className="grid2" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12 }}>
                <div><div className="muted small">Всего</div><div style={{ fontWeight: 800 }}>{summary.totalItems}</div></div>
                <div><div className="muted small">OK</div><div style={{ fontWeight: 800 }}>{summary.okCount}</div></div>
                <div><div className="muted small">Проблемы</div><div style={{ fontWeight: 800 }}>{summary.issueCount}</div></div>
                <div><div className="muted small">Критичные</div><div style={{ fontWeight: 800 }}>{summary.criticalCount}</div></div>
                <div><div className="muted small">Пропущено</div><div style={{ fontWeight: 800 }}>{summary.skippedCount || 0}</div></div>
                <div><div className="muted small">Создано заявок</div><div style={{ fontWeight: 800 }}>{summary.createdTicketsCount}</div></div>
              </div>
            </div>
          ) : null}

          <div style={{ display: 'grid', gap: 12 }}>
            {run.items.map((item, index) => {
              const draft = drafts[item.id] || {
                status: item.status,
                requiresRepair: item.requiresRepair,
                comment: item.comment || '',
                categoryId: categories[0]?.id || '',
                title: item.title,
                description: item.comment || item.description || '',
              }
              const problemState = draft.status === 'ISSUE' || draft.status === 'CRITICAL'
              const ticketExists = !!item.ticketId
              const itemReadOnly = isCompleted

              return (
                <div key={item.id} className="panel">
                  <div className="row" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{index + 1}. {item.title}</div>
                      {item.description ? <div className="muted small" style={{ marginTop: 4 }}>{item.description}</div> : null}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="tag">{statusLabel(item.status)}</span>
                      {ticketExists ? <span className="tag">Заявка создана</span> : null}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <button type="button" disabled={itemReadOnly} style={statusButtonStyle(draft.status === 'OK', 'good')} onClick={() => patchDraft(item.id, { status: 'OK', requiresRepair: false })}>OK</button>
                    <button type="button" disabled={itemReadOnly} style={statusButtonStyle(draft.status === 'ISSUE', 'warn')} onClick={() => patchDraft(item.id, { status: 'ISSUE' })}>ISSUE</button>
                    <button type="button" disabled={itemReadOnly} style={statusButtonStyle(draft.status === 'CRITICAL', 'danger')} onClick={() => patchDraft(item.id, { status: 'CRITICAL', requiresRepair: true })}>CRITICAL</button>
                    <button type="button" disabled={itemReadOnly} style={statusButtonStyle(draft.status === 'SKIPPED', 'neutral')} onClick={() => patchDraft(item.id, { status: 'SKIPPED', requiresRepair: false })}>Пропустить</button>
                  </div>

                  <div className="grid2" style={{ gridTemplateColumns: '1.3fr 0.7fr', gap: 12 }}>
                    <label>
                      Комментарий
                      <textarea value={draft.comment} onChange={(e) => patchDraft(item.id, { comment: e.target.value, description: e.target.value || draft.description })} rows={3} disabled={itemReadOnly} />
                    </label>

                    <div style={{ display: 'grid', gap: 10 }}>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={problemState ? draft.requiresRepair : false}
                          disabled={itemReadOnly || !problemState}
                          onChange={(e) => patchDraft(item.id, { requiresRepair: e.target.checked })}
                        />
                        Нужен ремонт
                      </label>

                      <button type="button" onClick={() => saveItem(item)} disabled={itemReadOnly || savingItemId === item.id}>
                        {savingItemId === item.id ? 'Сохраняем…' : 'Сохранить пункт'}
                      </button>
                    </div>
                  </div>

                  <div className="panel" style={{ marginTop: 12, padding: 12 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Фото</div>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={itemReadOnly || uploadingItemId === item.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null
                        uploadFile(item, file)
                        e.currentTarget.value = ''
                      }}
                    />
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                      {item.attachments.map((attachment) => (
                        <a key={attachment.id} href={api.resolveInspectionAttachmentUrl(attachment)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                          <img
                            src={api.resolveInspectionAttachmentUrl(attachment)}
                            alt={attachment.originalName}
                            style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 12, border: '1px solid #e5e7eb' }}
                          />
                        </a>
                      ))}
                      {item.attachments.length === 0 ? <div className="muted small">Фото пока не загружены.</div> : null}
                    </div>
                  </div>

                  {problemState ? (
                    <div className="panel" style={{ marginTop: 12, padding: 12 }}>
                      <div className="row" style={{ marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>Создание заявки</div>
                          <div className="muted small">Проблемный пункт можно сразу перевести в обычный ticket.</div>
                        </div>
                        {ticketExists && item.ticketId ? (
                          <Link to={'/tickets/' + item.ticketId}><button className="ghost">Открыть заявку</button></Link>
                        ) : null}
                      </div>

                      {ticketExists ? (
                        <div className="muted small">Заявка уже создана для этого пункта.</div>
                      ) : (
                        <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <label>
                            Категория заявки
                            <select value={draft.categoryId} onChange={(e) => patchDraft(item.id, { categoryId: e.target.value })} disabled={itemReadOnly || creatingTicketItemId === item.id}>
                              <option value="">Выберите категорию</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>{category.name}</option>
                              ))}
                            </select>
                          </label>

                          <label>
                            Заголовок заявки
                            <input value={draft.title} onChange={(e) => patchDraft(item.id, { title: e.target.value })} disabled={itemReadOnly || creatingTicketItemId === item.id} />
                          </label>

                          <label style={{ gridColumn: '1 / -1' }}>
                            Описание заявки
                            <textarea value={draft.description} onChange={(e) => patchDraft(item.id, { description: e.target.value })} rows={3} disabled={itemReadOnly || creatingTicketItemId === item.id} />
                          </label>
                        </div>
                      )}

                      {!ticketExists ? (
                        <button type="button" style={{ marginTop: 10 }} onClick={() => createTicket(item)} disabled={itemReadOnly || creatingTicketItemId === item.id || !draft.categoryId}>
                          {creatingTicketItemId === item.id ? 'Создаём заявку…' : 'Создать заявку'}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </>
      ) : runQ.isLoading ? (
        <div className="panel"><div className="muted">Загружаем обход…</div></div>
      ) : null}
    </div>
  )
}
