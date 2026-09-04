import { useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import { ProtectedUploadImg } from '../ui/ProtectedUploadMedia'
import { mobilePath } from './mobileRoute'
import { mobileTicketNavState } from './mobileTicketDisplay'

function fmtDateTime(value?: string | null): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return value
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const STATUS_LABEL: Record<api.InspectionRunItemStatus, string> = {
  PENDING: 'Ожидает',
  OK: 'OK',
  ISSUE: 'Нарушение',
  CRITICAL: 'Критично',
  SKIPPED: 'Пропущен',
}

const ITEM_MOD: Record<api.InspectionRunItemStatus, string> = {
  PENDING: 'pending',
  OK: 'ok',
  ISSUE: 'issue',
  CRITICAL: 'critical',
  SKIPPED: 'skipped',
}

type CreatedInspectionTicket = {
  ticketId: string
  ticketNumber?: number | null
}

export function MobileInspectionRunPage() {
  const params = useParams<{ runId: string }>()
  const runId = params.runId || ''
  const location = useLocation()
  const queryClient = useQueryClient()

  const [busyItemIds, setBusyItemIds] = useState<Set<string>>(new Set())
  const [activeIssueItemId, setActiveIssueItemId] = useState<string | null>(null)
  const [issueComment, setIssueComment] = useState('')
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [completeBusy, setCompleteBusy] = useState(false)
  const [flashMsg, setFlashMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [createdTicketsByItemId, setCreatedTicketsByItemId] = useState<Record<string, CreatedInspectionTicket>>({})
  const [uploadBusyItemIds, setUploadBusyItemIds] = useState<Set<string>>(new Set())
  const [uploadTargetItemId, setUploadTargetItemId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const runQ = useQuery({
    queryKey: ['inspection-run', runId],
    queryFn: () => api.getInspectionRun(runId),
    enabled: !!runId,
  })
  const categoriesQ = useQuery<api.ProblemCategoryListItem[]>({
    queryKey: ['problem-categories'],
    queryFn: () => api.problemCategories(),
  })

  const updateM = useMutation({
    mutationFn: (input: { itemId: string; payload: api.UpdateInspectionRunItemInput }) =>
      api.updateInspectionRunItem(runId, input.itemId, input.payload),
  })

  const uploadM = useMutation({
    mutationFn: (input: { itemId: string; file: File }) =>
      api.uploadInspectionRunItemAttachment(runId, input.itemId, input.file),
  })

  const backHref = mobilePath(location.pathname, '/inspection')

  const activeCategories = useMemo(
    () => (categoriesQ.data || []).filter((row) => row.isActive !== false),
    [categoriesQ.data],
  )

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ['inspection-run', runId] })
    await queryClient.invalidateQueries({ queryKey: ['inspection-runs'] })
    await queryClient.invalidateQueries({ queryKey: ['board'] })
    await queryClient.invalidateQueries({ queryKey: ['tickets'] })
  }

  function flash(type: 'ok' | 'err', text: string) {
    setFlashMsg({ type, text })
    setTimeout(() => setFlashMsg(null), 3000)
  }

  function getCreatedTicketId(item: api.InspectionRunItem): string {
    return (item.ticketId || item.ticket?.id || createdTicketsByItemId[item.id]?.ticketId || '').trim()
  }

  async function markOk(itemId: string) {
    if (busyItemIds.has(itemId)) return
    setBusyItemIds((s) => new Set(s).add(itemId))
    try {
      await updateM.mutateAsync({ itemId, payload: { status: 'OK', requiresRepair: false } })
      await invalidate()
    } catch (err: unknown) {
      flash('err', errorMessage(err))
    } finally {
      setBusyItemIds((s) => { const n = new Set(s); n.delete(itemId); return n })
    }
  }

  async function markIssue(itemId: string) {
    if (busyItemIds.has(itemId)) return
    setBusyItemIds((s) => new Set(s).add(itemId))
    try {
      await updateM.mutateAsync({
        itemId,
        payload: { status: 'ISSUE', requiresRepair: true, comment: issueComment.trim() || undefined },
      })
      await invalidate()
      setActiveIssueItemId(null)
      setIssueComment('')
    } catch (err: unknown) {
      flash('err', errorMessage(err))
    } finally {
      setBusyItemIds((s) => { const n = new Set(s); n.delete(itemId); return n })
    }
  }

  async function createTicket(item: api.InspectionRunItem) {
    if (busyItemIds.has(item.id)) return
    const categoryId = activeCategories[0]?.id || ''
    if (!categoryId) {
      flash('err', 'Нет активной категории для создания заявки')
      return
    }
    if (getCreatedTicketId(item)) return
    setBusyItemIds((s) => new Set(s).add(item.id))
    try {
      const created = await api.createTicketFromInspectionItem(runId, item.id, {
        categoryId,
        title: item.title?.trim() || undefined,
        description: item.comment?.trim() || item.description?.trim() || undefined,
        urgency: item.status === 'CRITICAL' ? 'URGENT' : 'NOT_URGENT',
      })
      const ticketId = created.ticket?.id || ''
      const ticketNumber = created.ticket?.ticketNumber ?? null
      if (ticketId) {
        setCreatedTicketsByItemId((current) => ({
          ...current,
          [item.id]: { ticketId, ticketNumber },
        }))
      }
      flash('ok', ticketNumber != null ? `Заявка #${ticketNumber} создана` : 'Заявка создана')
      await invalidate()
    } catch (err: unknown) {
      flash('err', errorMessage(err))
    } finally {
      setBusyItemIds((s) => {
        const n = new Set(s)
        n.delete(item.id)
        return n
      })
    }
  }

  async function completeRun() {
    setCompleteBusy(true)
    try {
      await api.completeInspectionRun(runId)
      await invalidate()
      setConfirmComplete(false)
      flash('ok', 'Обход завершён')
    } catch (err: unknown) {
      flash('err', errorMessage(err))
    } finally {
      setCompleteBusy(false)
    }
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0 || !uploadTargetItemId) return
    const itemId = uploadTargetItemId
    setUploadBusyItemIds((s) => new Set(s).add(itemId))
    try {
      for (const file of Array.from(files)) {
        await uploadM.mutateAsync({ itemId, file })
      }
      await invalidate()
    } catch (err: unknown) {
      flash('err', errorMessage(err))
    } finally {
      setUploadBusyItemIds((s) => { const n = new Set(s); n.delete(itemId); return n })
      setUploadTargetItemId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const run = runQ.data

  const summary = useMemo(() => {
    if (!run) return { ok: 0, issue: 0, critical: 0, pending: 0, total: 0 }
    return {
      ok: run.items.filter((i) => i.status === 'OK').length,
      issue: run.items.filter((i) => i.status === 'ISSUE').length,
      critical: run.items.filter((i) => i.status === 'CRITICAL').length,
      pending: run.items.filter((i) => i.status === 'PENDING').length,
      total: run.items.length,
    }
  }, [run])

  const isInProgress = run?.status === 'IN_PROGRESS'

  return (
    <>
      <div className="mobileTicketDetailsToolbar">
        <Link to={backHref} className="mobileDetailsBackLink mobilePatrolBackLink">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Обходы
        </Link>
      </div>

      <div className="mobileSection">
        {runQ.isError ? (
          <div className="mobileNotice mobileNoticeError">
            {errorMessage(runQ.error)}
          </div>
        ) : null}

        {flashMsg ? (
          <div className={`mobileNotice${flashMsg.type === 'err' ? ' mobileNoticeError' : ' mobileNoticeSuccess'}`}>
            {flashMsg.text}
          </div>
        ) : null}

        {runQ.isLoading ? (
          <div className="mobileCard mobileMeta">Загружаем обход…</div>
        ) : null}

        {run ? (
          <>
            {/* Run info */}
            <div className="mobileCard">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', flex: 1, minWidth: 0 }}>
                  {run.title}
                </div>
                <span className={`mobilePatrolRunStatus mobilePatrolRunStatus--${run.status === 'IN_PROGRESS' ? 'inprogress' : 'completed'}`}>
                  {run.status === 'IN_PROGRESS' ? 'В процессе' : 'Завершён'}
                </span>
              </div>
              <div className="mobilePatrolMeta">
                <div className="mobilePatrolMetaRow">
                  <span className="mobilePatrolMetaLabel">Локация</span>
                  <span style={{ fontSize: '0.88rem' }}>
                    {run.location.name}
                    {run.location.city ? ` · ${run.location.city}` : ''}
                  </span>
                </div>
                {run.location?.id ? (
                  <Link
                    to={mobilePath(location.pathname, `/inspection/object/${run.location.id}`)}
                    className="mobileBtn mobileBtnGhost"
                    style={{ textAlign: 'center', marginTop: 4 }}
                  >
                    История обходов объекта
                  </Link>
                ) : null}
                <div className="mobilePatrolMetaRow">
                  <span className="mobilePatrolMetaLabel">Шаблон</span>
                  <span style={{ fontSize: '0.88rem' }}>{run.template.name}</span>
                </div>
                {run.performedBy ? (
                  <div className="mobilePatrolMetaRow">
                    <span className="mobilePatrolMetaLabel">Исполнитель</span>
                    <span style={{ fontSize: '0.88rem' }}>
                      {[run.performedBy.firstName, run.performedBy.lastName].filter(Boolean).join(' ') || run.performedBy.email}
                    </span>
                  </div>
                ) : null}
                <div className="mobilePatrolMetaRow">
                  <span className="mobilePatrolMetaLabel">Начат</span>
                  <span style={{ fontSize: '0.88rem' }}>{fmtDateTime(run.createdAt)}</span>
                </div>
                {run.completedAt ? (
                  <div className="mobilePatrolMetaRow">
                    <span className="mobilePatrolMetaLabel">Завершён</span>
                    <span style={{ fontSize: '0.88rem' }}>{fmtDateTime(run.completedAt)}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Progress summary */}
            <div className="mobilePatrolSummary">
              <div className="mobilePatrolSummaryCell mobilePatrolSummaryCell--ok">
                <div className="mobilePatrolSummaryValue">{summary.ok}</div>
                <div className="mobilePatrolSummaryLabel">OK</div>
              </div>
              <div className="mobilePatrolSummaryCell mobilePatrolSummaryCell--issue">
                <div className="mobilePatrolSummaryValue">{summary.issue}</div>
                <div className="mobilePatrolSummaryLabel">Нарушений</div>
              </div>
              <div className="mobilePatrolSummaryCell mobilePatrolSummaryCell--critical">
                <div className="mobilePatrolSummaryValue">{summary.critical}</div>
                <div className="mobilePatrolSummaryLabel">Критично</div>
              </div>
              <div className="mobilePatrolSummaryCell mobilePatrolSummaryCell--pending">
                <div className="mobilePatrolSummaryValue">{summary.pending}</div>
                <div className="mobilePatrolSummaryLabel">Ожидает</div>
              </div>
            </div>

            {/* Checklist items */}
            <div className="mobilePatrolItems">
              {run.items.map((item) => {
                const mod = ITEM_MOD[item.status]
                const busy = busyItemIds.has(item.id)
                const uploadBusy = uploadBusyItemIds.has(item.id)
                const isShowingIssueForm = activeIssueItemId === item.id
                const createdTicketId = getCreatedTicketId(item)
                const createdTicketNumber = createdTicketsByItemId[item.id]?.ticketNumber ?? null
                const canCreateTicket = (item.status === 'ISSUE' || item.status === 'CRITICAL') && !createdTicketId
                return (
                  <div key={item.id} className={`mobilePatrolItem mobilePatrolItem--${mod}`}>
                    <div className="mobilePatrolItemTop">
                      <div className="mobilePatrolItemTitle">{item.title}</div>
                      <span className={`mobilePatrolItemBadge mobilePatrolItemBadge--${mod}`}>
                        {STATUS_LABEL[item.status]}
                      </span>
                    </div>

                    {item.description ? (
                      <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>{item.description}</div>
                    ) : null}
                    {item.comment ? (
                      <div className="mobilePatrolItemComment">"{item.comment}"</div>
                    ) : null}
                    {item.attachments.length > 0 ? (
                      <div className="mobilePatrolItemPhotos">
                        {item.attachments.map((a) => (
                          <ProtectedUploadImg
                            key={a.id}
                            url={api.resolveInspectionAttachmentUrl(a)}
                            alt=""
                            className="mobilePatrolItemPhoto"
                          />
                        ))}
                      </div>
                    ) : null}
                    {createdTicketId ? (
                      <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600 }}>
                        {createdTicketNumber != null ? `Заявка #${createdTicketNumber} создана` : 'Заявка создана'}
                      </div>
                    ) : null}

                    {isInProgress && !busy ? (
                      <div className="mobilePatrolItemActions">
                        {item.status !== 'OK' ? (
                          <button
                            type="button"
                            className="mobileBtn"
                            style={{ minHeight: 34, padding: '6px 14px', fontSize: '0.82rem', borderRadius: 8 }}
                            disabled={busy}
                            onClick={() => markOk(item.id)}
                          >
                            <span className="mobilePatrolBtnIcon" aria-hidden>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                            OK
                          </button>
                        ) : null}
                        {item.status !== 'ISSUE' && item.status !== 'CRITICAL' ? (
                          <button
                            type="button"
                            className="mobileBtn mobileBtnSecondary"
                            style={{ minHeight: 34, padding: '6px 14px', fontSize: '0.82rem', borderRadius: 8 }}
                            disabled={busy}
                            onClick={() => {
                              setActiveIssueItemId(isShowingIssueForm ? null : item.id)
                              setIssueComment(item.comment || '')
                            }}
                          >
                            {isShowingIssueForm ? 'Отмена' : 'Нарушение'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="mobileBtn mobileBtnSecondary"
                          style={{ minHeight: 34, padding: '6px 14px', fontSize: '0.82rem', borderRadius: 8 }}
                          disabled={uploadBusy}
                          onClick={() => {
                            setUploadTargetItemId(item.id)
                            fileInputRef.current?.click()
                          }}
                        >
                          {uploadBusy ? (
                            'Загружаем…'
                          ) : (
                            <>
                              <span className="mobilePatrolBtnIcon" aria-hidden>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M5 7h2l2 -2h6l2 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2" />
                                  <circle cx="12" cy="13" r="3" />
                                </svg>
                              </span>
                              Фото
                            </>
                          )}
                        </button>
                      </div>
                    ) : busy ? (
                      <div className="mobileMeta" style={{ fontSize: '0.82rem' }}>Сохраняем…</div>
                    ) : null}

                    {isShowingIssueForm ? (
                      <div className="mobilePatrolItemIssueForm">
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#92400e' }}>Комментарий к нарушению</div>
                        <textarea
                          className="mobilePatrolItemIssueFormTextarea"
                          rows={2}
                          placeholder="Опишите нарушение…"
                          value={issueComment}
                          onChange={(e) => setIssueComment(e.target.value)}
                        />
                        <button
                          type="button"
                          className="mobileBtn"
                          style={{ minHeight: 36, padding: '6px 14px', fontSize: '0.84rem', borderRadius: 8, background: '#d97706' }}
                          disabled={busyItemIds.has(item.id)}
                          onClick={() => markIssue(item.id)}
                        >
                          Подтвердить нарушение
                        </button>
                      </div>
                    ) : null}

                    {canCreateTicket ? (
                      <div className="mobilePatrolItemActions">
                        <button
                          type="button"
                          className="mobileBtn"
                          style={{ minHeight: 34, padding: '6px 14px', fontSize: '0.82rem', borderRadius: 8 }}
                          disabled={busy}
                          onClick={() => createTicket(item)}
                        >
                          {busy ? 'Создаём…' : 'Создать заявку'}
                        </button>
                      </div>
                    ) : null}

                    {createdTicketId ? (
                      <div className="mobilePatrolItemActions">
                        <Link
                          to={`${mobilePath(location.pathname, `/tickets/${createdTicketId}`)}${location.search}`}
                          state={mobileTicketNavState('home', run?.companyId)}
                          className="mobileBtn mobileBtnSecondary"
                          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 34, padding: '6px 14px', fontSize: '0.82rem', borderRadius: 8 }}
                        >
                          Открыть заявку
                        </Link>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>

            {/* Complete run */}
            {isInProgress ? (
              <div className="mobileCard" style={{ display: 'grid', gap: 8 }}>
                {!confirmComplete ? (
                  <button
                    type="button"
                    className="mobileBtn mobileBtnSecondary"
                    onClick={() => setConfirmComplete(true)}
                    disabled={completeBusy}
                  >
                    Завершить обход
                  </button>
                ) : (
                  <>
                    <div style={{ fontSize: '0.88rem', color: '#374151' }}>
                      Завершить обход? Отменить нельзя. Незаполненные пункты останутся в статусе «Ожидает».
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="mobileBtn"
                        style={{ flex: 1 }}
                        onClick={completeRun}
                        disabled={completeBusy}
                      >
                        {completeBusy ? 'Завершаем…' : 'Да, завершить'}
                      </button>
                      <button
                        type="button"
                        className="mobileBtn mobileBtnSecondary"
                        style={{ flex: 1 }}
                        onClick={() => setConfirmComplete(false)}
                        disabled={completeBusy}
                      >
                        Отмена
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFilesSelected(e.target.files)}
      />
    </>
  )
}
