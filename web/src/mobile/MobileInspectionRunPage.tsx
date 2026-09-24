import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import { numericConstraintLabel, responseTypeLabel } from '../lib/inspectionZones'
import { ProtectedUploadImg } from '../ui/ProtectedUploadMedia'
import { mobilePath } from './mobileRoute'
import { queueOffline, useOfflineStatus } from './offline/useOffline'
import { LOCAL_ID_PREFIX } from './offline/store'
import { cacheRoundSnapshot, readPendingRoundTicketItemIds, readRoundSnapshot } from './offline/roundCache'
import {
  compactTicketScope,
  mobileTicketNavState,
  mobileTicketStatusLabelRu,
  scopeForMobileTicketLink,
} from './mobileTicketDisplay'
import {
  buildCompleteCheckpointPayload,
  canEditCheckpoint,
  checkpointDraftFromItem,
  checkpointPayloadForOfflineQueue,
  checkpointLinkedTicketNotice,
  checkpointStateLabel,
  checkpointStatusOptions,
  type CheckpointEditorDraft,
} from './mobileInspectionRunEditing'

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

/**
 * 116F: длительность обхода из тех же двух отметок, что уже есть в записи.
 * Пока обход не завершён, длительности нет — показывать растущий счётчик
 * как «итог» было бы неверно.
 */
function durationLabel(startedAt?: string | null, completedAt?: string | null) {
  if (!startedAt || !completedAt) return null
  const from = new Date(startedAt).getTime()
  const to = new Date(completedAt).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null
  const minutes = Math.round((to - from) / 60000)
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`
}

function reviewStatusLabel(status?: api.InspectionReportStatus | null) {
  if (status === 'DRAFT') return 'Черновик'
  if (status === 'SUBMITTED') return 'На проверке'
  if (status === 'APPROVED') return 'Утверждён'
  if (status === 'REJECTED') return 'Возвращён'
  return null
}

function reviewerLabel(person?: api.InspectionRunPerson | null) {
  if (!person) return null
  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || person.email
}

export function MobileInspectionRunPage() {
  const params = useParams<{ runId: string }>()
  const runId = params.runId || ''
  const location = useLocation()
  const queryClient = useQueryClient()

  const [busyItemIds, setBusyItemIds] = useState<Set<string>>(new Set())
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editorDraft, setEditorDraft] = useState<CheckpointEditorDraft | null>(null)
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

  // SMA-MOBILE-OFFLINE-INTEGRATION-113D: обход продолжается без сети.
  const offline = useOfflineStatus()

  /**
   * Локальная правка открытого обхода. Действует и в памяти вкладки, и в
   * сохранённой копии, чтобы отметка пережила перезагрузку без сети.
   */
  function patchRunItemLocally(itemId: string, payload: api.UpdateInspectionRunItemInput) {
    queryClient.setQueryData<api.InspectionRun>(['inspection-run', runId], (prev) =>
      prev
        ? { ...prev, items: prev.items.map((i) => (i.id === itemId ? { ...i, ...payload } : i)) }
        : prev,
    )
    setCachedRun((prev) =>
      prev ? { ...prev, items: prev.items.map((i) => (i.id === itemId ? { ...i, ...payload } : i)) } : prev,
    )
  }

  const updateM = useMutation({
    /**
     * networkMode: 'always' обязателен.
     *
     * По умолчанию react-query ставит мутацию на паузу, когда браузер считает
     * себя офлайн: mutationFn не вызывается вовсе. Вся офлайн-ветка внутри неё
     * оказалась бы мёртвым кодом — отметка техника не попала бы ни на сервер,
     * ни в очередь, а экран навсегда остался бы в «Сохраняем…».
     *
     * Здесь отсутствие сети обрабатывается самой функцией, поэтому пауза
     * не нужна и вредна. Обнаружено живой приёмкой 113D на Stage.
     */
    networkMode: 'always',
    mutationFn: async (input: { itemId: string; payload: api.UpdateInspectionRunItemInput }) => {
      if (!offline.online) {
        // Отметка чек-поинта схлопывается по цели: серверу нужно последнее
        // значение, а не цепочка переключений Норма → Проблема → Норма.
        const queued = await queueOffline({
          kind: 'checkpoint.update',
          target: { roundId: runId, checkpointId: input.itemId },
          payload: checkpointPayloadForOfflineQueue(input.payload),
        })
        if (!queued.ok) throw new Error(`Не удалось сохранить на устройстве: ${queued.message}`)
        // Отметка сразу видна в открытом обходе: иначе техник решит, что
        // нажатие не сработало, и отметит чек-поинт ещё раз.
        patchRunItemLocally(input.itemId, input.payload)
        return null
      }
      return api.updateInspectionRunItem(runId, input.itemId, input.payload)
    },
  })

  const uploadM = useMutation({
    // Причина та же, что у updateM: снимок сохраняется на устройстве сам,
    // пауза по отсутствию сети отменила бы это.
    networkMode: 'always',
    mutationFn: async (input: { itemId: string; file: File }) => {
      if (!offline.online) {
        const queued = await queueOffline({
          kind: 'checkpoint.attachment',
          target: { roundId: runId, checkpointId: input.itemId },
          blob: input.file,
        })
        if (!queued.ok) throw new Error(`Не удалось сохранить на устройстве: ${queued.message}`)
        return null
      }
      return api.uploadInspectionRunItemAttachment(runId, input.itemId, input.file)
    },
    onSuccess: (result) => {
      if (result === null) flash('ok', 'Снимок сохранён на устройстве. Отправим после восстановления связи.')
    },
  })

  const backHref = mobilePath(location.pathname, '/inspection')

  const activeCategories = useMemo(
    () => (categoriesQ.data || []).filter((row) => row.isActive !== false),
    [categoriesQ.data],
  )

  async function invalidate() {
    // Без сети перезапрашивать нечего, а ждать нельзя: react-query держит
    // такой перезапрос приостановленным, и обещание не разрешается до
    // восстановления связи — вызывающий код навсегда остался бы «занят».
    if (!offline.online) return
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

  function openItemEditor(item: api.InspectionRunItem) {
    if (!run || !canEditCheckpoint(run.status)) return
    setEditingItemId(item.id)
    setEditorDraft(checkpointDraftFromItem(item))
  }

  function closeItemEditor() {
    setEditingItemId(null)
    setEditorDraft(null)
  }

  async function saveItem(item: api.InspectionRunItem) {
    if (!editorDraft || busyItemIds.has(item.id)) return
    const complete = buildCompleteCheckpointPayload(item, editorDraft)
    if (!complete.ok) {
      flash('err', complete.message)
      return
    }

    setBusyItemIds((current) => new Set(current).add(item.id))
    try {
      await updateM.mutateAsync({ itemId: item.id, payload: complete.payload })
      await invalidate()
      closeItemEditor()
      flash(
        'ok',
        offline.online
          ? 'Изменения сохранены'
          : 'Изменения сохранены на устройстве. Отправим после восстановления связи.',
      )
    } catch (err: unknown) {
      flash('err', errorMessage(err))
    } finally {
      setBusyItemIds((current) => {
        const next = new Set(current)
        next.delete(item.id)
        return next
      })
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
    if (pendingTicketItemIds.has(item.id)) return
    setBusyItemIds((s) => new Set(s).add(item.id))
    try {
      const payload: api.CreateTicketFromInspectionItemInput = {
        categoryId,
        title: item.title?.trim() || undefined,
        description: item.comment?.trim() || item.description?.trim() || undefined,
        urgency: item.status === 'CRITICAL' ? 'URGENT' : 'NOT_URGENT',
      }

      if (!offline.online) {
        // Локальный идентификатор нужен зависимым операциям: пока заявка
        // не создана на сервере, её нечем адресовать. Настоящий id подставит
        // координатор после подтверждения.
        const queued = await queueOffline({
          kind: 'ticket.fromRound',
          target: {
            ticketId: `${LOCAL_ID_PREFIX}${runId}:${item.id}`,
            roundId: runId,
            checkpointId: item.id,
          },
          payload,
          producesTicketId: true,
        })
        if (!queued.ok) {
          flash('err', `Не удалось сохранить на устройстве: ${queued.message}`)
        } else {
          // Успех сервера не показывается: заявки ещё нет.
          flash('ok', 'Сохранено на устройстве. Заявка будет создана при связи.')
          setPendingTicketItemIds((prev) => new Set(prev).add(item.id))
        }
        setBusyItemIds((s2) => {
          const next = new Set(s2)
          next.delete(item.id)
          return next
        })
        return
      }

      const created = await api.createTicketFromInspectionItem(runId, item.id, payload)
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

  /**
   * Обход без сети. Пока связь есть, свежая копия ложится в IndexedDB;
   * когда её нет — читается оттуда вместе с неотправленными отметками.
   * Кэш react-query живёт в памяти вкладки и перезагрузку не переживает,
   * а техник перезагружает приложение именно там, где связи нет.
   */
  const [cachedRun, setCachedRun] = useState<api.InspectionRun | null>(null)
  /** Чек-поинты с заявкой, сохранённой на устройстве и ещё не созданной. */
  const [pendingTicketItemIds, setPendingTicketItemIds] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    if (!runId) return
    let alive = true
    void readPendingRoundTicketItemIds(runId).then((ids) => {
      if (alive) setPendingTicketItemIds(ids)
    })
    return () => {
      alive = false
    }
  }, [runId, offline.pending, offline.attention, offline.ready])
  useEffect(() => {
    if (runQ.data) void cacheRoundSnapshot(runQ.data)
  }, [runQ.data])
  useEffect(() => {
    if (runQ.data || !runId) return
    let alive = true
    void readRoundSnapshot<api.InspectionRun>(runId).then((row) => {
      if (alive) setCachedRun(row)
    })
    return () => {
      alive = false
    }
  }, [runQ.data, runId, offline.pending, offline.ready])

  const run = runQ.data ?? cachedRun ?? undefined
  const isFromCache = !runQ.data && !!cachedRun

  const summary = useMemo(() => {
    if (!run) return { ok: 0, issue: 0, critical: 0, pending: 0, total: 0, tickets: 0 }
    return {
      ok: run.items.filter((i) => i.status === 'OK').length,
      issue: run.items.filter((i) => i.status === 'ISSUE').length,
      critical: run.items.filter((i) => i.status === 'CRITICAL').length,
      pending: run.items.filter((i) => i.status === 'PENDING').length,
      total: run.items.length,
      tickets: run.items.filter((i) => !!i.ticketId).length,
    }
  }, [run])

  const isInProgress = run ? canEditCheckpoint(run.status) : false

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
        {runQ.isError && !isFromCache ? (
          <div className="mobileNotice mobileNoticeError">
            {errorMessage(runQ.error)}
          </div>
        ) : null}

        {isFromCache ? (
          <div className="mobileNotice">
            Нет сети. Показана копия, сохранённая на устройстве. Отметки уйдут после восстановления связи.
          </div>
        ) : null}

        {flashMsg ? (
          <div className={`mobileNotice${flashMsg.type === 'err' ? ' mobileNoticeError' : ' mobileNoticeSuccess'}`}>
            {flashMsg.text}
          </div>
        ) : null}

        {runQ.isLoading && !isFromCache ? (
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
                  <span style={{ fontSize: '0.88rem' }}>{run.title}</span>
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
                {durationLabel(run.createdAt, run.completedAt) ? (
                  <div className="mobilePatrolMetaRow">
                    <span className="mobilePatrolMetaLabel">Длительность</span>
                    <span style={{ fontSize: '0.88rem' }}>{durationLabel(run.createdAt, run.completedAt)}</span>
                  </div>
                ) : null}
                {!isInProgress && summary.tickets > 0 ? (
                  <div className="mobilePatrolMetaRow">
                    <span className="mobilePatrolMetaLabel">Заявок создано</span>
                    <span style={{ fontSize: '0.88rem' }}>{summary.tickets}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/*
              116F: итог проверки акта на телефоне. Это чтение уже принятого
              решения, а не управление им: кнопок утверждения здесь нет,
              submit/review остаются за десктопным управлением и своей ролью.
            */}
            {!isInProgress && reviewStatusLabel(run.reportStatus) ? (
              <div className="mobileCard" style={{ display: 'grid', gap: 6 }}>
                <div className="mobilePatrolMetaRow">
                  <span className="mobilePatrolMetaLabel">Статус акта</span>
                  <span style={{ fontSize: '0.88rem' }}>{reviewStatusLabel(run.reportStatus)}</span>
                </div>
                {run.reportSubmittedAt ? (
                  <div className="mobilePatrolMetaRow">
                    <span className="mobilePatrolMetaLabel">Отправлен</span>
                    <span style={{ fontSize: '0.88rem' }}>{fmtDateTime(run.reportSubmittedAt)}</span>
                  </div>
                ) : null}
                {run.reportReviewedAt ? (
                  <div className="mobilePatrolMetaRow">
                    <span className="mobilePatrolMetaLabel">{run.reportStatus === 'REJECTED' ? 'Возвращён' : 'Проверен'}</span>
                    <span style={{ fontSize: '0.88rem' }}>{fmtDateTime(run.reportReviewedAt)}</span>
                  </div>
                ) : null}
                {reviewerLabel(run.reportReviewedBy) ? (
                  <div className="mobilePatrolMetaRow">
                    <span className="mobilePatrolMetaLabel">Проверил</span>
                    <span style={{ fontSize: '0.88rem' }}>{reviewerLabel(run.reportReviewedBy)}</span>
                  </div>
                ) : null}
                {run.reportReviewComment ? (
                  <div style={{ fontSize: '0.85rem', color: '#374151' }}>
                    Комментарий проверки: {run.reportReviewComment}
                  </div>
                ) : null}
              </div>
            ) : null}

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
              {run.items.map((item, index) => {
                const mod = ITEM_MOD[item.status]
                const busy = busyItemIds.has(item.id)
                const uploadBusy = uploadBusyItemIds.has(item.id)
                const isEditing = editingItemId === item.id && editorDraft !== null
                const createdTicketId = getCreatedTicketId(item)
                const createdTicketNumber = getCreatedTicketNumber(item)
                const createdTicketStatus = item.ticket?.status ?? null
                const ticketQueuedOffline = pendingTicketItemIds.has(item.id)
                /**
                 * 120W: заявка и отметка живут отдельно. Пока редактор закрыт, говорить
                 * об этом незачем — сообщение считается только для открытого редактора
                 * и только когда заявка действительно есть.
                 */
                const linkedTicketNotice = checkpointLinkedTicketNotice({
                  hasLinkedTicket: !!createdTicketId,
                  ticketNumber: createdTicketNumber,
                  draftStatus: isEditing ? editorDraft.status : null,
                })
                const canCreateTicket =
                  (item.status === 'ISSUE' || item.status === 'CRITICAL') && !createdTicketId && !ticketQueuedOffline
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
                        {checkpointStateLabel(item.status)}
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

                    {/* Ссылки нет намеренно: заявки на сервере ещё не существует. */}
                    {ticketQueuedOffline && !createdTicketId ? (
                      <div style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: 600 }}>
                        Заявка сохранена на устройстве · ожидает отправки
                      </div>
                    ) : null}

                    {isInProgress && !busy ? (
                      <div className="mobilePatrolItemActions">
                        <button
                          type="button"
                          className="mobileBtn"
                          style={{ minHeight: 34, padding: '6px 14px', fontSize: '0.82rem', borderRadius: 8 }}
                          onClick={() => (isEditing ? closeItemEditor() : openItemEditor(item))}
                        >
                          {isEditing
                            ? 'Закрыть'
                            : item.status === 'PENDING' || item.status === 'SKIPPED'
                              ? 'Заполнить'
                              : 'Изменить'}
                        </button>
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

                    {isEditing && editorDraft && isInProgress ? (
                      <div className="mobilePatrolItemIssueForm mobilePatrolItemEditor">
                        <div className="mobilePatrolItemEditorLabel">Результат проверки</div>
                        <div className="mobilePatrolStatusChoices" role="group" aria-label="Результат проверки">
                          {checkpointStatusOptions(editorDraft.status).map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className={`mobilePatrolStatusChoice${editorDraft.status === option.value ? ' mobilePatrolStatusChoice--selected' : ''}`}
                              aria-pressed={editorDraft.status === option.value}
                              onClick={() => setEditorDraft((current) => current ? { ...current, status: option.value } : current)}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>

                        {item.responseType === 'YES_NO' ? (
                          <div>
                            <div className="mobilePatrolItemEditorLabel">Ответ</div>
                            <div className="mobilePatrolStatusChoices" role="group" aria-label="Ответ да или нет">
                              {(['true', 'false'] as const).map((value) => (
                                <button
                                  key={value}
                                  type="button"
                                  className={`mobilePatrolStatusChoice${editorDraft.booleanValue === value ? ' mobilePatrolStatusChoice--selected' : ''}`}
                                  aria-pressed={editorDraft.booleanValue === value}
                                  onClick={() => setEditorDraft((current) => current ? { ...current, booleanValue: value } : current)}
                                >
                                  {value === 'true' ? 'Да' : 'Нет'}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {item.responseType === 'NUMBER' ? (
                          <label className="mobilePatrolItemEditorLabel">
                            Значение{item.numericUnit ? `, ${item.numericUnit}` : ''}
                            <input
                              className="mobileInput"
                              type="number"
                              inputMode="decimal"
                              step="any"
                              min={item.numericMin ?? undefined}
                              max={item.numericMax ?? undefined}
                              value={editorDraft.numberValue}
                              onChange={(event) => setEditorDraft((current) => current ? { ...current, numberValue: event.target.value } : current)}
                            />
                          </label>
                        ) : null}

                        {item.responseType === 'TEXT' ? (
                          <label className="mobilePatrolItemEditorLabel">
                            Ответ
                            <textarea
                              className="mobilePatrolItemIssueFormTextarea"
                              rows={3}
                              value={editorDraft.textValue}
                              onChange={(event) => setEditorDraft((current) => current ? { ...current, textValue: event.target.value } : current)}
                            />
                          </label>
                        ) : null}

                        <label className="mobilePatrolItemEditorLabel">
                          Комментарий
                          <textarea
                            className="mobilePatrolItemIssueFormTextarea"
                            rows={2}
                            placeholder="Добавьте комментарий при необходимости"
                            value={editorDraft.comment}
                            onChange={(event) => setEditorDraft((current) => current ? { ...current, comment: event.target.value } : current)}
                          />
                        </label>

                        {linkedTicketNotice.kind !== 'none' ? (
                          <div
                            className={`mobilePatrolLinkedTicketNotice mobilePatrolLinkedTicketNotice--${linkedTicketNotice.kind}`}
                            role={linkedTicketNotice.kind === 'warning' ? 'alert' : 'note'}
                          >
                            {linkedTicketNotice.text}
                          </div>
                        ) : null}

                        <div className="mobilePatrolItemEditorActions">
                          <button
                            type="button"
                            className="mobileBtn"
                            disabled={busy}
                            onClick={() => saveItem(item)}
                          >
                            Сохранить
                          </button>
                          <button
                            type="button"
                            className="mobileBtn mobileBtnGhost"
                            disabled={busy}
                            onClick={closeItemEditor}
                          >
                            Закрыть
                          </button>
                        </div>
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
