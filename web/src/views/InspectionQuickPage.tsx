import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { numericConstraintLabel, responseTypeLabel } from '../lib/inspectionZones'

const MAX_PHOTO_SIZE = 10 * 1024 * 1024

type IssueModalState = {
  itemId: string
  categoryId: string
  comment: string
  photo: File | null
}

function fmtDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU')
  } catch {
    return value
  }
}

export function InspectionQuickPage() {
  const params = useParams<{ runId: string }>()
  const runId = params.runId || ''
  const queryClient = useQueryClient()

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [okBusyItemId, setOkBusyItemId] = useState<string | null>(null)
  const [issueBusyItemId, setIssueBusyItemId] = useState<string | null>(null)
  const [issueModal, setIssueModal] = useState<IssueModalState | null>(null)

  const runQ = useQuery({
    queryKey: ['inspection-run', runId],
    queryFn: () => api.getInspectionRun(runId),
    enabled: !!runId,
  })
  const categoriesQ = useQuery<api.ProblemCategoryListItem[]>({
    queryKey: ['problem-categories'],
    queryFn: () => api.problemCategories(),
  })

  const activeCategories = useMemo(
    () => (categoriesQ.data || []).filter((row: api.ProblemCategoryListItem) => row.isActive !== false),
    [categoriesQ.data],
  )

  const updateItemM = useMutation({
    mutationFn: (input: { itemId: string; payload: api.UpdateInspectionRunItemInput }) =>
      api.updateInspectionRunItem(runId, input.itemId, input.payload),
  })
  const uploadM = useMutation({
    mutationFn: (input: { itemId: string; file: File }) =>
      api.uploadInspectionRunItemAttachment(runId, input.itemId, input.file),
  })
  const createTicketM = useMutation({
    mutationFn: (input: { itemId: string; payload: api.CreateTicketFromInspectionItemInput }) =>
      api.createTicketFromInspectionItem(runId, input.itemId, input.payload),
  })

  async function refetchRun() {
    await queryClient.invalidateQueries({ queryKey: ['inspection-run', runId] })
    await queryClient.invalidateQueries({ queryKey: ['inspection-runs'] })
    await queryClient.invalidateQueries({ queryKey: ['board'] })
    await queryClient.invalidateQueries({ queryKey: ['tickets'] })
  }

  async function markOk(item: api.InspectionRunItem) {
    if (okBusyItemId || issueBusyItemId) return
    setError(null)
    setSuccess(null)
    setOkBusyItemId(item.id)
    try {
      await updateItemM.mutateAsync({
        itemId: item.id,
        payload: {
          status: 'OK',
          requiresRepair: false,
        },
      })
      await refetchRun()
    } catch (err: any) {
      setError(err?.message || String(err))
    } finally {
      setOkBusyItemId(null)
    }
  }

  function openIssueModal(item: api.InspectionRunItem) {
    setError(null)
    setSuccess(null)
    setIssueModal({
      itemId: item.id,
      categoryId: activeCategories[0]?.id || '',
      comment: item.comment || '',
      photo: null,
    })
  }

  async function submitIssue() {
    if (!issueModal) return
    if (!issueModal.categoryId) {
      setError('Выберите категорию заявки')
      return
    }
    setError(null)
    setSuccess(null)
    setIssueBusyItemId(issueModal.itemId)
    try {
      await updateItemM.mutateAsync({
        itemId: issueModal.itemId,
        payload: {
          status: 'ISSUE',
          requiresRepair: true,
          comment: issueModal.comment.trim() || undefined,
        },
      })

      if (issueModal.photo) {
        if (!issueModal.photo.type.startsWith('image/')) {
          throw new Error('Можно загружать только изображения')
        }
        if (issueModal.photo.size > MAX_PHOTO_SIZE) {
          throw new Error('Изображение слишком большое. Максимум 10 МБ')
        }
        await uploadM.mutateAsync({ itemId: issueModal.itemId, file: issueModal.photo })
      }

      await createTicketM.mutateAsync({
        itemId: issueModal.itemId,
        payload: {
          categoryId: issueModal.categoryId,
          description: issueModal.comment.trim() || undefined,
          urgency: 'NOT_URGENT',
        },
      })

      await refetchRun()
      setIssueModal(null)
      setSuccess('Заявка создана')
    } catch (err: any) {
      setError(err?.message || String(err))
    } finally {
      setIssueBusyItemId(null)
    }
  }

  const run = runQ.data
  const busy = !!okBusyItemId || !!issueBusyItemId

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Быстрый обход</h2>
          <div className="muted small">Отметьте оборудование как OK в один тап или сразу создайте заявку из проблемы.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {runId ? (
            <Link to={`/inspection/runs/${runId}`}>
              <button className="ghost">Полный режим обхода</button>
            </Link>
          ) : null}
          <Link to="/inspection/runs">
            <button className="ghost">История</button>
          </Link>
        </div>
      </div>

      {error ? <div className="alert">{error}</div> : null}
      {success ? <div className="panel" style={{ marginBottom: 12, border: '1px solid #bbf7d0', background: '#f0fdf4' }}>✅ {success}</div> : null}
      {runQ.isError ? <div className="alert">{(runQ.error as any)?.message || String(runQ.error)}</div> : null}

      {run ? (
        <>
          <div className="panel" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700 }}>{run.title}</div>
            <div className="muted small" style={{ marginTop: 6 }}>
              Локация: {run.location.name}
              {run.location.city ? ` · ${run.location.city}` : ''}
              {' · '}Единиц в обходе: {run.items.length}
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>
              Equipment: {run.equipment ? `${run.equipment.name} · ${run.equipment.type}` : 'Не указано'}
              {' · '}Создан: {fmtDate(run.createdAt)}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {run.items.map((item, index) => {
              const isOk = item.status === 'OK'
              const isIssue = item.status === 'ISSUE' || item.status === 'CRITICAL'
              const isBusyRow = okBusyItemId === item.id || issueBusyItemId === item.id
              const previous = run.items[index - 1]
              const zoneName = item.zoneName?.trim() || 'Без зоны'
              const showZoneHeader =
                !previous ||
                (previous.zoneName?.trim() || 'Без зоны') !== zoneName ||
                (previous.zoneSortOrder ?? 0) !== (item.zoneSortOrder ?? 0)
              return (
                <div key={item.id}>
                  {showZoneHeader ? (
                    <div style={{ fontWeight: 800, margin: '8px 0 2px' }}>{zoneName}</div>
                  ) : null}
                  <div
                    className="panel"
                    style={{
                      border: isOk ? '1px solid #86efac' : isIssue ? '1px solid #fdba74' : undefined,
                      background: isOk ? '#f0fdf4' : isIssue ? '#fff7ed' : undefined,
                    }}
                  >
                  <div className="row" style={{ marginBottom: 6, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.checkpointSortOrder + 1}. {item.title}</div>
                      <div className="muted small">
                        {run.equipment?.name || 'Equipment'}{run.equipment?.type ? ` · ${run.equipment.type}` : ''}
                      </div>
                      <div className="muted small">
                        {responseTypeLabel(item.responseType)}
                        {numericConstraintLabel(item) ? ` · ${numericConstraintLabel(item)}` : ''}
                        {item.isRequired ? ' · обязательный' : ' · необязательный'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {item.ticketId ? (
                        <Link to={`/tickets/${item.ticketId}`}>
                          <button className="ghost" type="button">Открыть заявку</button>
                        </Link>
                      ) : null}
                      <span className="tag">{item.status}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" disabled={busy || isBusyRow} onClick={() => markOk(item)}>
                      {okBusyItemId === item.id ? 'Сохраняем…' : isOk ? 'OK ✓' : 'OK'}
                    </button>
                    <button className="ghost" type="button" disabled={busy || isBusyRow || !!item.ticketId} onClick={() => openIssueModal(item)}>
                      {isIssue ? 'Проблема ✓' : 'Проблема'}
                    </button>
                  </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : runQ.isLoading ? (
        <div className="panel">
          <div className="muted">Загружаем обход…</div>
        </div>
      ) : null}

      {issueModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.35)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 50,
          }}
        >
          <div className="panel" style={{ width: 'min(640px, 100%)' }}>
            <div className="row" style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>Проблема · создание заявки</div>
              <button className="ghost" type="button" onClick={() => setIssueModal(null)} disabled={!!issueBusyItemId}>
                Закрыть
              </button>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <label>
                Фото (опционально)
                <input
                  type="file"
                  accept="image/*"
                  disabled={!!issueBusyItemId}
                  onChange={(e) =>
                    setIssueModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            photo: e.target.files?.[0] || null,
                          }
                        : prev,
                    )
                  }
                />
              </label>
              <label>
                Категория
                <select
                  value={issueModal.categoryId}
                  disabled={!!issueBusyItemId}
                  onChange={(e) => setIssueModal((prev) => (prev ? { ...prev, categoryId: e.target.value } : prev))}
                >
                  <option value="">Выберите категорию</option>
                  {activeCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Комментарий (опционально)
                <textarea
                  rows={3}
                  value={issueModal.comment}
                  disabled={!!issueBusyItemId}
                  onChange={(e) => setIssueModal((prev) => (prev ? { ...prev, comment: e.target.value } : prev))}
                />
              </label>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => submitIssue()} disabled={!!issueBusyItemId}>
                {issueBusyItemId ? 'Создаём заявку…' : 'Создать заявку'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
