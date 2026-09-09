import { useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import { numericConstraintLabel, responseTypeLabel } from '../lib/inspectionZones'
import { ProtectedUploadImg } from '../ui/ProtectedUploadMedia'
import { mobilePath } from './mobileRoute'
import {
  compactTicketScope,
  mobileTicketNavState,
  mobileTicketStatusLabelRu,
  scopeForMobileTicketLink,
} from './mobileTicketDisplay'

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
  OK: 'Норма',
  ISSUE: 'Проблема',
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
  const [activeProblemItemId, setActiveProblemItemId] = useState<string | null>(null)
  const [problemStatus, setProblemStatus] = useState<'ISSUE' | 'CRITICAL'>('ISSUE')
  const [problemComment, setProblemComment] = useState('')
  /**
   * Категория заявки выбирается человеком.
   *
   * Раньше мобильный молча брал activeCategories[0]. Каталог приходит
   * отсортированным по createdAt desc, то есть первой оказывается самая свежая
   * категория клиента — какая угодно. Если её специализации нет в контракте,
   * заявка создаётся, но обратно провайдеру уже не видна: чтение линкованных
   * заявок сужается специализациями контракта, и карточка отвечает 404.
   * Проверено на Stage: #777 с категорией из контракта открывается, #778 и #779
   * с «Wrong Specialization Category» — нет.
   *
   * Десктоп категорию всегда спрашивал; мобильный теперь тоже.
   */
  const [ticketCategoryId, setTicketCategoryId] = useState('')
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [completeBusy, setCompleteBusy] = useState(false)
  const [flashMsg, setFlashMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [createdTicketsByItemId, setCreatedTicketsByItemId] = useState<Record<string, CreatedInspectionTicket>>({})
  const [uploadBusyItemIds, setUploadBusyItemIds] = useState<Set<string>>(new Set())
  const [uploadTargetItemId, setUploadTargetItemId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  /**
   * Контур текущей страницы: то же чтение, что в «Моих заявках» — параметр URL,
   * иначе сохранённый контур владельца.
   */
  const pageScope = useMemo<api.TicketScopeParams>(() => {
    const search = new URLSearchParams(location.search)
    const linked = (search.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
    const company = (search.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
    return { linkedClientCompanyId: linked || undefined, companyId: company || undefined }
  }, [location.search, meQ.data])

  const runQ = useQuery({
    queryKey: ['inspection-run', runId],
    queryFn: () => api.getInspectionRun(runId),
    enabled: !!runId,
  })
  /**
   * Каталог категорий — по компании-владельцу площадки, а не по компании
   * исполнителя: обход по площадке клиента ведёт провайдер, а заявка
   * принадлежит клиенту. Тот же эндпоинт /problem-categories?companyId=<клиент>
   * сам проверяет связь провайдер→клиент; своей проверки здесь нет.
   * Подробнее — тот же блок в InspectionRunPage.
   */
  const targetClientCompanyId = runQ.data?.location?.clientCompanyId || ''
  const categoriesQ = useQuery<api.ProblemCategoryListItem[]>({
    queryKey: ['problem-categories', targetClientCompanyId],
    queryFn: () => api.problemCategories(targetClientCompanyId),
    enabled: !!targetClientCompanyId,
  })

  const updateM = useMutation({
    mutationFn: (input: { itemId: string; payload: api.UpdateInspectionRunItemInput }) =>
      api.updateInspectionRunItem(runId, input.itemId, input.payload),
  })

  const uploadM = useMutation({
    mutationFn: (input: { itemId: string; file: File }) =>
      api.uploadInspectionRunItemAttachment(runId, input.itemId, input.file),
  })

  const backHref = `${mobilePath(location.pathname, '/inspection')}${location.search}`

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

  /**
   * Ссылка на связанную заявку.
   *
   * Заявка принадлежит владельцу площадки, а обход ведёт исполнитель. Раньше сюда
   * уходил run.companyId — компания исполнителя, — и на провайдерском обходе по
   * площадке клиента мобильная карточка заявки запрашивалась в контуре самого
   * провайдера и отвечала «Заявка не найдена или недоступна». Десктоп этим путём
   * не ходит: там обычная ссылка /tickets/<id> без мобильного контура.
   *
   * Контур считает scopeForMobileTicketLink — тот же помощник, которым пользуются
   * «Мои заявки» и чаты: своя компания — контур не добавляется, чужая — добавляется
   * linkedClientCompanyId владельца, и только для ролей из его списка. Своих правил
   * доступа здесь нет, доступ по-прежнему решает бэкенд.
   *
   * Раньше к ссылке подставлялся location.search обхода целиком: чужой
   * linkedClientCompanyId из него побеждал бы владельца заявки.
   */
  function linkedTicketHref(ticketId: string): string {
    const base = mobilePath(location.pathname, `/tickets/${ticketId}`)
    if (!meQ.data || !targetClientCompanyId) return `${base}${location.search}`
    const linkScope = scopeForMobileTicketLink(meQ.data, pageScope, { companyId: targetClientCompanyId })
    return api.appendScopeToPath(base, compactTicketScope(linkScope), meQ.data)
  }

  /**
   * Номер связанной заявки. Канонический источник — item.ticket с сервера:
   * состояние createdTicketsByItemId живёт только до перезагрузки, а обход
   * открывают повторно. Оно остаётся запасным вариантом на те секунды между
   * ответом на создание и обновлением обхода.
   */
  function getCreatedTicketNumber(item: api.InspectionRunItem): number | null {
    return item.ticket?.ticketNumber ?? createdTicketsByItemId[item.id]?.ticketNumber ?? null
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

  async function markProblem(itemId: string) {
    if (busyItemIds.has(itemId)) return
    setBusyItemIds((s) => new Set(s).add(itemId))
    try {
      await updateM.mutateAsync({
        itemId,
        payload: { status: problemStatus, requiresRepair: true, comment: problemComment.trim() || undefined },
      })
      await invalidate()
      setActiveProblemItemId(null)
      setProblemComment('')
    } catch (err: unknown) {
      flash('err', errorMessage(err))
    } finally {
      setBusyItemIds((s) => { const n = new Set(s); n.delete(itemId); return n })
    }
  }

  async function createTicket(item: api.InspectionRunItem) {
    if (busyItemIds.has(item.id)) return
    if (!activeCategories.length) {
      flash('err', 'Нет активной категории для создания заявки')
      return
    }
    const categoryId = ticketCategoryId.trim()
    if (!categoryId) {
      flash('err', 'Выберите категорию заявки')
      return
    }
    if (getCreatedTicketId(item)) return
    setBusyItemIds((s) => new Set(s).add(item.id))
    try {
      const created = await api.createTicketFromInspectionItem(runId, item.id, {
        categoryId,
        title: item.title?.trim() || undefined,
        description: item.comment?.trim() || item.description?.trim() || undefined,
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
                    to={`${mobilePath(location.pathname, `/inspection/object/${run.location.id}`)}${location.search}`}
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
                <div className="mobilePatrolSummaryLabel">Норма</div>
              </div>
              <div className="mobilePatrolSummaryCell mobilePatrolSummaryCell--issue">
                <div className="mobilePatrolSummaryValue">{summary.issue}</div>
                <div className="mobilePatrolSummaryLabel">Проблем</div>
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
              {run.items.map((item, index) => {
                const mod = ITEM_MOD[item.status]
                const busy = busyItemIds.has(item.id)
                const uploadBusy = uploadBusyItemIds.has(item.id)
                const isShowingProblemForm = activeProblemItemId === item.id
                const createdTicketId = getCreatedTicketId(item)
                const createdTicketNumber = getCreatedTicketNumber(item)
                const createdTicketStatus = item.ticket?.status ?? null
                const canCreateTicket = (item.status === 'ISSUE' || item.status === 'CRITICAL') && !createdTicketId
                const previous = run.items[index - 1]
                const zoneName = item.zoneName?.trim() || 'Без зоны'
                const showZoneHeader =
                  !previous ||
                  (previous.zoneName?.trim() || 'Без зоны') !== zoneName ||
                  (previous.zoneSortOrder ?? 0) !== (item.zoneSortOrder ?? 0)
                return (
                  <div key={item.id}>
                    {showZoneHeader ? (
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#111827', margin: '4px 2px -2px' }}>
                        {zoneName}
                      </div>
                    ) : null}
                  <div className={`mobilePatrolItem mobilePatrolItem--${mod}`}>
                    <div className="mobilePatrolItemTop">
                      <div className="mobilePatrolItemTitle">{item.checkpointSortOrder + 1}. {item.title}</div>
                      <span className={`mobilePatrolItemBadge mobilePatrolItemBadge--${mod}`}>
                        {STATUS_LABEL[item.status]}
                      </span>
                    </div>

                    {item.description ? (
                      <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>{item.description}</div>
                    ) : null}
                    <div style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600 }}>
                      {responseTypeLabel(item.responseType)}
                      {numericConstraintLabel(item) ? ` · ${numericConstraintLabel(item)}` : ''}
                      {item.isRequired ? ' · обязательный' : ' · необязательный'}
                    </div>
                    {item.booleanValue !== null && item.booleanValue !== undefined ? (
                      <div className="mobileMeta">Ответ: {item.booleanValue ? 'Да' : 'Нет'}</div>
                    ) : null}
                    {item.numberValue !== null && item.numberValue !== undefined ? (
                      <div className="mobileMeta">Значение: {item.numberValue}{item.numericUnit ? ` ${item.numericUnit}` : ''}</div>
                    ) : null}
                    {item.textValue ? <div className="mobileMeta">Ответ: {item.textValue}</div> : null}
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
                        {createdTicketNumber != null ? `Заявка #${createdTicketNumber}` : 'Заявка создана'}
                        {createdTicketStatus ? ` — ${mobileTicketStatusLabelRu(createdTicketStatus)}` : ''}
                      </div>
                    ) : null}

                    {isInProgress && !busy ? (
                      <>
                        <div className="mobilePatrolStatusChoices" aria-label="Результат проверки">
                          <button
                            type="button"
                            className={`mobilePatrolStatusChoice mobilePatrolStatusChoice--ok${item.status === 'OK' ? ' mobilePatrolStatusChoice--selected' : ''}`}
                            aria-pressed={item.status === 'OK'}
                            onClick={() => markOk(item.id)}
                          >
                            Норма
                          </button>
                          <button
                            type="button"
                            className={`mobilePatrolStatusChoice mobilePatrolStatusChoice--issue${item.status === 'ISSUE' ? ' mobilePatrolStatusChoice--selected' : ''}`}
                            aria-pressed={item.status === 'ISSUE'}
                            onClick={() => {
                              setActiveProblemItemId(isShowingProblemForm && problemStatus === 'ISSUE' ? null : item.id)
                              setProblemStatus('ISSUE')
                              setProblemComment(item.comment || '')
                            }}
                          >
                            Проблема
                          </button>
                          <button
                            type="button"
                            className={`mobilePatrolStatusChoice mobilePatrolStatusChoice--critical${item.status === 'CRITICAL' ? ' mobilePatrolStatusChoice--selected' : ''}`}
                            aria-pressed={item.status === 'CRITICAL'}
                            onClick={() => {
                              setActiveProblemItemId(isShowingProblemForm && problemStatus === 'CRITICAL' ? null : item.id)
                              setProblemStatus('CRITICAL')
                              setProblemComment(item.comment || '')
                            }}
                          >
                            Критично
                          </button>
                        </div>
                        <div className="mobilePatrolItemActions">
                        <button
                          type="button"
                          className="mobileBtn mobileBtnSecondary"
                          style={{ width: '100%' }}
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
                      </>
                    ) : busy ? (
                      <div className="mobileMeta" style={{ fontSize: '0.82rem' }}>Сохраняем…</div>
                    ) : null}

                    {isShowingProblemForm ? (
                      <div className={`mobilePatrolItemIssueForm${problemStatus === 'CRITICAL' ? ' mobilePatrolItemIssueForm--critical' : ''}`}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: problemStatus === 'CRITICAL' ? '#991b1b' : '#92400e' }}>
                          {problemStatus === 'CRITICAL' ? 'Комментарий к критичному состоянию' : 'Комментарий к проблеме'}
                        </div>
                        <textarea
                          className="mobilePatrolItemIssueFormTextarea"
                          rows={2}
                          placeholder={problemStatus === 'CRITICAL' ? 'Опишите критичное состояние…' : 'Опишите проблему…'}
                          value={problemComment}
                          onChange={(e) => setProblemComment(e.target.value)}
                        />
                        <button
                          type="button"
                          className="mobileBtn"
                          style={{ background: problemStatus === 'CRITICAL' ? '#dc2626' : '#d97706' }}
                          disabled={busyItemIds.has(item.id)}
                          onClick={() => markProblem(item.id)}
                        >
                          {problemStatus === 'CRITICAL' ? 'Подтвердить критичное состояние' : 'Подтвердить проблему'}
                        </button>
                      </div>
                    ) : null}

                    {canCreateTicket ? (
                      <div className="mobilePatrolItemActions" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>
                          Категория заявки
                          <select
                            style={{ width: '100%', marginTop: 4, minHeight: 34, fontSize: '0.82rem', borderRadius: 8 }}
                            value={ticketCategoryId}
                            disabled={busy}
                            onChange={(e) => setTicketCategoryId(e.target.value)}
                          >
                            <option value="">— выберите категорию —</option>
                            {activeCategories.map((category) => (
                              <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="mobileBtn"
                          style={{ minHeight: 34, padding: '6px 14px', fontSize: '0.82rem', borderRadius: 8 }}
                          disabled={busy || !ticketCategoryId}
                          onClick={() => createTicket(item)}
                        >
                          {busy ? 'Создаём…' : 'Создать заявку'}
                        </button>
                      </div>
                    ) : null}

                    {createdTicketId ? (
                      <div className="mobilePatrolItemActions">
                        <Link
                          to={linkedTicketHref(createdTicketId)}
                          state={mobileTicketNavState('home', targetClientCompanyId || run?.companyId)}
                          className="mobileBtn mobileBtnSecondary"
                          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 34, padding: '6px 14px', fontSize: '0.82rem', borderRadius: 8 }}
                        >
                          {createdTicketNumber != null ? `Открыть заявку #${createdTicketNumber}` : 'Открыть заявку'}
                        </Link>
                      </div>
                    ) : null}
                  </div>
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
