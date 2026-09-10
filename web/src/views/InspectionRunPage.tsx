import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { numericConstraintLabel, responseTypeLabel } from '../lib/inspectionZones'
import { ProtectedUploadThumbLink } from '../ui/ProtectedUploadMedia'
import { InspectionTicketReview } from '../components/inspection/InspectionTicketReview'
import {
  inspectionItemStatusLabel,
  inspectionRunStatusLabel,
  ticketStatusLabel,
  ticketUrgencyLabel,
} from '../lib/inspectionPresentation'

const MAX_PHOTO_SIZE = 10 * 1024 * 1024

type ItemDraft = {
  status: api.InspectionRunItemStatus
  requiresRepair: boolean
  comment: string
  categoryId: string
  title: string
  description: string
  booleanValue: boolean | null
  numberValue: string
  textValue: string
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

function parseOptionalDraftNumber(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
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
  const [reviewingTicketItemId, setReviewingTicketItemId] = useState<string | null>(null)
  const submittingTicketItemIdsRef = useRef(new Set<string>())

  const runQ = useQuery({
    queryKey: ['inspection-run', runId],
    queryFn: () => api.getInspectionRun(runId),
    enabled: !!runId,
  })
  /**
   * Каталог категорий берётся по компании-владельцу площадки, а не по компании
   * исполнителя. Обход по площадке клиента ведёт провайдер, а заявка по найденной
   * проблеме принадлежит клиенту: канонический TicketsService выводит владельца
   * из Location.clientCompanyId, и категория обязана принадлежать тому же
   * владельцу — иначе getCategory её не найдёт.
   *
   * Эндпоинт тот же самый, /problem-categories?companyId=<клиент>: он сам
   * проверяет связь провайдер→клиент через getLinkedClientAccess и отвечает
   * «Linked client not found», если связи нет. Своей проверки здесь не нужно
   * и заводить её нельзя.
   *
   * companyId входит в ключ кэша: иначе каталог одного клиента показался бы
   * в обходе по площадке другого.
   */
  const targetClientCompanyId = runQ.data?.location?.clientCompanyId || ''
  const categoriesQ = useQuery<api.ProblemCategoryListItem[]>({
    queryKey: ['problem-categories', targetClientCompanyId],
    queryFn: () => api.problemCategories(targetClientCompanyId),
    enabled: !!targetClientCompanyId,
  })
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const categories = useMemo(
    () => (categoriesQ.data || []).filter((item: api.ProblemCategoryListItem) => item.isActive !== false),
    [categoriesQ.data],
  )

  useEffect(() => {
    if (!runQ.data) return
    setDrafts((current) => {
      const next: Record<string, ItemDraft> = {}
      for (const item of runQ.data.items) {
        next[item.id] = current[item.id] || {
          status: item.status,
          requiresRepair: item.requiresRepair,
          comment: item.comment || '',
          categoryId: '',
          title: item.title,
          description: item.comment || item.description || '',
          booleanValue: item.booleanValue ?? null,
          numberValue: item.numberValue === null || item.numberValue === undefined ? '' : String(item.numberValue),
          textValue: item.textValue || '',
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
    onError: () => {
      setSavingItemId(null)
      setError('Не удалось сохранить пункт обхода. Повторите ещё раз.')
    },
  })

  const uploadM = useMutation({
    mutationFn: (input: { itemId: string; file: File }) => api.uploadInspectionRunItemAttachment(runId, input.itemId, input.file),
    onSuccess: async () => {
      setError(null)
      setUploadingItemId(null)
      await queryClient.invalidateQueries({ queryKey: ['inspection-run', runId] })
    },
    onError: () => {
      setUploadingItemId(null)
      setError('Не удалось загрузить фото. Выберите изображение и повторите.')
    },
  })

  const createTicketM = useMutation({
    mutationFn: (input: { itemId: string; payload: api.CreateTicketFromInspectionItemInput }) =>
      api.createTicketFromInspectionItem(runId, input.itemId, input.payload),
    onSuccess: async () => {
      setError(null)
      setCreatingTicketItemId(null)
      setReviewingTicketItemId(null)
      await queryClient.invalidateQueries({ queryKey: ['inspection-run', runId] })
      await queryClient.invalidateQueries({ queryKey: ['inspection-runs'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
      await queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
    onError: () => {
      setCreatingTicketItemId(null)
      setError('Не удалось создать заявку. Проверьте выбранную категорию и доступ по договору.')
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
    onError: () => setError('Не удалось завершить обход. Проверьте заполнение пунктов и повторите.'),
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
    const numberValue = parseOptionalDraftNumber(draft.numberValue)
    if (item.responseType === 'NUMBER' && draft.numberValue.trim() && numberValue === undefined) {
      setError('Укажите числовое значение пункта')
      return
    }
    setSavingItemId(item.id)
    updateItemM.mutate({
      itemId: item.id,
      payload: {
        status: draft.status,
        requiresRepair: draft.status === 'ISSUE' || draft.status === 'CRITICAL' ? draft.requiresRepair : false,
        comment: draft.comment,
        booleanValue: item.responseType === 'YES_NO' ? draft.booleanValue ?? undefined : undefined,
        numberValue: item.responseType === 'NUMBER' ? numberValue : undefined,
        textValue: item.responseType === 'TEXT' ? draft.textValue : undefined,
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
    if (submittingTicketItemIdsRef.current.has(item.id)) return
    const draft = drafts[item.id]
    if (!draft?.categoryId) {
      setError('Выберите категорию для создания заявки')
      return
    }
    submittingTicketItemIdsRef.current.add(item.id)
    setCreatingTicketItemId(item.id)
    createTicketM.mutate(
      {
        itemId: item.id,
        payload: {
          categoryId: draft.categoryId,
          title: draft.title.trim() || undefined,
          description: draft.description.trim() || draft.comment.trim() || undefined,
        },
      },
      { onSettled: () => submittingTicketItemIdsRef.current.delete(item.id) },
    )
  }

  return (
    <div className="inspectionRunPage">
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
      {runQ.isError ? <div className="alert">Не удалось загрузить обход. Обновите страницу и повторите.</div> : null}

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
                  {' · '}Статус: {inspectionRunStatusLabel(run.status)}
                  {' · '}Создан: {fmtDate(run.createdAt)}
                  {run.completedAt ? ` · Завершён: ${fmtDate(run.completedAt)}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="tag">{inspectionRunStatusLabel(run.status)}</span>
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
                <div><div className="muted small">Норма</div><div style={{ fontWeight: 800 }}>{summary.okCount}</div></div>
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
                categoryId: '',
                title: item.title,
                description: item.comment || item.description || '',
                booleanValue: item.booleanValue ?? null,
                numberValue: item.numberValue === null || item.numberValue === undefined ? '' : String(item.numberValue),
                textValue: item.textValue || '',
              }
              const problemState = draft.status === 'ISSUE' || draft.status === 'CRITICAL'
              const ticketExists = !!item.ticketId
              const itemReadOnly = isCompleted
              const previous = run.items[index - 1]
              const zoneName = item.zoneName?.trim() || 'Без зоны'
              const showZoneHeader =
                !previous ||
                (previous.zoneName?.trim() || 'Без зоны') !== zoneName ||
                (previous.zoneSortOrder ?? 0) !== (item.zoneSortOrder ?? 0)

              return (
                <div key={item.id}>
                  {showZoneHeader ? (
                    <div style={{ fontWeight: 800, margin: '8px 0 2px' }}>
                      {zoneName}
                    </div>
                  ) : null}
                <div className="panel">
                  <div className="row" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.checkpointSortOrder + 1}. {item.title}</div>
                      {item.description ? <div className="muted small" style={{ marginTop: 4 }}>{item.description}</div> : null}
                      <div className="muted small" style={{ marginTop: 4 }}>
                        {responseTypeLabel(item.responseType)}
                        {numericConstraintLabel(item) ? ` · ${numericConstraintLabel(item)}` : ''}
                        {item.isRequired ? ' · обязательный' : ' · необязательный'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span className="tag">{inspectionItemStatusLabel(item.status)}</span>
                      {ticketExists ? <span className="tag">Заявка создана</span> : null}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <button type="button" disabled={itemReadOnly} style={statusButtonStyle(draft.status === 'OK', 'good')} onClick={() => patchDraft(item.id, { status: 'OK', requiresRepair: false })}>Норма</button>
                    <button type="button" disabled={itemReadOnly} style={statusButtonStyle(draft.status === 'ISSUE', 'warn')} onClick={() => patchDraft(item.id, { status: 'ISSUE' })}>Проблема</button>
                    <button type="button" disabled={itemReadOnly} style={statusButtonStyle(draft.status === 'CRITICAL', 'danger')} onClick={() => patchDraft(item.id, { status: 'CRITICAL', requiresRepair: true })}>Критично</button>
                    <button type="button" disabled={itemReadOnly} style={statusButtonStyle(draft.status === 'SKIPPED', 'neutral')} onClick={() => patchDraft(item.id, { status: 'SKIPPED', requiresRepair: false })}>Пропустить</button>
                  </div>

                  {item.responseType === 'YES_NO' ? (
                    <label style={{ display: 'block', marginBottom: 12 }}>
                      Ответ
                      <select
                        value={draft.booleanValue === null ? '' : draft.booleanValue ? 'true' : 'false'}
                        onChange={(e) =>
                          patchDraft(item.id, {
                            booleanValue: e.target.value === '' ? null : e.target.value === 'true',
                          })
                        }
                        disabled={itemReadOnly}
                      >
                        <option value="">Не выбран</option>
                        <option value="true">Да</option>
                        <option value="false">Нет</option>
                      </select>
                    </label>
                  ) : null}

                  {item.responseType === 'NUMBER' ? (
                    <label style={{ display: 'block', marginBottom: 12 }}>
                      Значение{item.numericUnit ? `, ${item.numericUnit}` : ''}
                      <input
                        type="number"
                        value={draft.numberValue}
                        min={item.numericMin ?? undefined}
                        max={item.numericMax ?? undefined}
                        onChange={(e) => patchDraft(item.id, { numberValue: e.target.value })}
                        disabled={itemReadOnly}
                      />
                    </label>
                  ) : null}

                  {item.responseType === 'TEXT' ? (
                    <label style={{ display: 'block', marginBottom: 12 }}>
                      Текстовый ответ
                      <textarea
                        value={draft.textValue}
                        onChange={(e) => patchDraft(item.id, { textValue: e.target.value })}
                        rows={2}
                        disabled={itemReadOnly}
                      />
                    </label>
                  ) : null}

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
                    <label className="inspectionUploadControl">
                      <span>{uploadingItemId === item.id ? 'Загружаем…' : 'Добавить фото'}</span>
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
                    </label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                      {item.attachments.map((attachment) => (
                        <ProtectedUploadThumbLink
                          key={attachment.id}
                          url={api.resolveInspectionAttachmentUrl(attachment)}
                          alt={attachment.originalName}
                          style={{ textDecoration: 'none' }}
                          imgStyle={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 12, border: '1px solid #e5e7eb' }}
                        />
                      ))}
                      {item.attachments.length === 0 ? <div className="muted small">Фото пока не загружены.</div> : null}
                    </div>
                  </div>

                  {problemState ? (
                    <div className="panel" style={{ marginTop: 12, padding: 12 }}>
                      <div className="row" style={{ marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>Создание заявки</div>
                          <div className="muted small">Проверьте контекст и подтвердите создание заявки.</div>
                        </div>
                        {ticketExists && item.ticketId ? (
                          <Link to={'/tickets/' + item.ticketId}>
                            <button className="ghost">
                              {item.ticket?.ticketNumber != null ? `Открыть заявку №${item.ticket.ticketNumber}` : 'Открыть заявку'}
                            </button>
                          </Link>
                        ) : null}
                      </div>

                      {ticketExists ? (
                        <div className="muted small">
                          {item.ticket
                            ? `Создана заявка №${item.ticket.ticketNumber} — ${ticketStatusLabel(item.ticket.status)}. ${ticketUrgencyLabel(item.ticket.urgency) || ''} Обход можно продолжать.`
                            : 'Заявка уже создана для этого пункта.'}
                        </div>
                      ) : (
                        <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <label>
                            Категория заявки
                            <select
                              value={draft.categoryId}
                              onChange={(e) => {
                                patchDraft(item.id, { categoryId: e.target.value })
                                setReviewingTicketItemId(null)
                              }}
                              disabled={itemReadOnly || creatingTicketItemId === item.id}
                            >
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

                      {!ticketExists && reviewingTicketItemId !== item.id ? (
                        <button
                          type="button"
                          style={{ marginTop: 10 }}
                          onClick={() => setReviewingTicketItemId(item.id)}
                          disabled={itemReadOnly || creatingTicketItemId === item.id || !draft.categoryId}
                        >
                          Проверить заявку
                        </button>
                      ) : null}

                      {!ticketExists && reviewingTicketItemId === item.id && draft.categoryId ? (
                        <InspectionTicketReview
                          checkpointTitle={item.title}
                          location={run.location}
                          equipment={run.equipment}
                          categoryName={categories.find((category) => category.id === draft.categoryId)?.name || 'Категория не найдена'}
                          status={draft.status as 'ISSUE' | 'CRITICAL'}
                          description={draft.description || draft.comment}
                          attachments={item.attachments}
                          busy={creatingTicketItemId === item.id}
                          onConfirm={() => createTicket(item)}
                          onCancel={() => setReviewingTicketItemId(null)}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
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
