import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import {
  mobileTicketAttachmentReadScopes,
  mobileTicketCategoryLocationFromDetail,
  mobileTicketDetailGetOneScopes,
  mobileTicketNavState,
  mobileTicketNumberTitle,
  mobileTicketPriorityIsUrgent,
  mobileTicketSlaCountdownLabel,
  mobileTicketStatusLabelRu,
  resolveMobileCanSendComment,
  resolveMobileTicketContextMode,
  resolveMobileTicketResourceScope,
  type MobileTicketListOrigin,
  type MobileTicketNavState,
} from './mobileTicketDisplay'
import {
  MOBILE_HOME_BOARD_CHIP_LABELS,
  MOBILE_HOME_TAB_LABELS,
  type MobileHomeBoardChipId,
} from './mobileHomeBoardFilters'
import {
  enqueueOfflineComment,
  enqueueOfflineStatusChange,
  getOnlineStatus,
  loadAnyTicketDetailCache,
  loadTicketDetailCache,
  saveTicketDetailCache,
  useOnlineStatus,
} from './offlineQueue'
import { formatMobileMutationError } from './mobileActionErrors'
import { mobilePath } from './mobileRoute'
import {
  clientTicketLifecycleHintText,
  shouldShowClientTicketLifecycleHint,
} from '../lib/ticketClientGuidance'
import { CategoryGuidancePanel } from '../components/CategoryGuidancePanel'
import { MobileBoardClaimFallbackHint, MobileClaimReasonHintBox } from './MobileUxHints'
import { TicketCloseModal, type TicketCloseModalState } from './home/HomeList'
import { mobileAttachmentLabel } from './MobileAttachmentThumb'
import { toChatMessages } from '../lib/ticketChat'
import { FullscreenPhotoViewer, type PhotoViewerItem } from '../components/FullscreenPhotoViewer'
import { MobileTicketPhotoGallery } from './MobileTicketPhotoGallery'
import { MobileTicketActionsSheet, type TicketSheetAction } from './MobileTicketActionsSheet'
import { MobileModalBackdrop } from './MobileModalBackdrop'

// SMA-ACCEPTANCE-005: модалка клиентского отказа в приёмке (комментарий обязателен, фото — желательно).
type ClientRejectModalState =
  | { ticketId: string; title: string; file: File | null; previewUrl: string; comment: string; err: string }
  | null

function ClientAcceptanceRejectModal(props: {
  state: ClientRejectModalState
  busy: boolean
  cameraInputRef: { current: HTMLInputElement | null }
  galleryInputRef: { current: HTMLInputElement | null }
  setState: (next: ClientRejectModalState | ((prev: ClientRejectModalState) => ClientRejectModalState)) => void
  canSubmit: boolean
  onSubmit: () => void
}) {
  const { state, busy, cameraInputRef, galleryInputRef, setState, canSubmit, onSubmit } = props
  if (!state) return null
  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setState((prev) => {
      if (!prev) return prev
      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      const previewUrl = file ? URL.createObjectURL(file) : ''
      return { ...prev, file, previewUrl, err: '' }
    })
  }
  const cancel = () => {
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl)
    setState(null)
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    if (galleryInputRef.current) galleryInputRef.current.value = ''
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.55)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 12 }}>
      <div className="mobileCard" style={{ width: '100%', maxWidth: 720, marginBottom: 12 }}>
        <div className="mobileRow" style={{ alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 900 }}>Не принять работу</div>
            <div className="mobileMeta" style={{ marginTop: 4 }}>{state.title}</div>
          </div>
          <button type="button" className="mobileBtn mobileBtnSecondary" disabled={busy} onClick={cancel}>
            Отмена
          </button>
        </div>
        {state.err ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>{state.err}</div> : null}
        <div className="mobileForm" style={{ marginTop: 12 }}>
          <label className="mobileFormField">
            Причина отказа *
            <textarea
              rows={3}
              value={state.comment}
              disabled={busy}
              placeholder="Что не так с работой / что нужно доделать"
              onChange={(e) => setState((prev) => (prev ? { ...prev, comment: e.target.value, err: '' } : prev))}
            />
          </label>
          <div className="mobilePhotoCardBlock" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Фото (необязательно)</div>
            <input ref={cameraInputRef} className="mobileHiddenFileInput" type="file" accept="image/*" capture="environment" disabled={busy} onChange={pickFile} />
            <input ref={galleryInputRef} className="mobileHiddenFileInput" type="file" accept="image/*" disabled={busy} onChange={pickFile} />
            <div className="mobilePhotoSourceRow">
              <button type="button" className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn" disabled={busy} onClick={() => cameraInputRef.current?.click()}>
                Сделать фото
              </button>
              <button type="button" className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn" disabled={busy} onClick={() => galleryInputRef.current?.click()}>
                Выбрать из телефона
              </button>
            </div>
            {state.previewUrl ? (
              <div className="mobilePhotoPreview">
                <img src={state.previewUrl} alt={state.file?.name || 'preview'} style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, border: '1px solid #e5e7eb' }} />
              </div>
            ) : null}
            {state.file ? <div className="mobileMeta" style={{ marginTop: 10 }}>Файл: {state.file.name}</div> : null}
          </div>
          <div className="mobileFormSubmitStack">
            <button type="button" className="mobileBtn mobileBtnSecondary" disabled={!canSubmit} onClick={onSubmit}>
              {busy ? 'Отправляем…' : 'Отправить на доработку'}
            </button>
            <p className="mobileHint" style={{ marginBottom: 0 }}>
              Комментарий обязателен (не короче трёх символов). Заявка вернётся в статус «В работе».
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function readListOrigin(location: ReturnType<typeof useLocation>): MobileTicketListOrigin {
  const raw = (location.state as MobileTicketNavState | null)?.mobileListOrigin
  if (raw === 'my') return 'my'
  if (raw === 'chat') return 'chat'
  return 'home'
}

function isImageAttachment(a: api.TicketAttachmentItem) {
  return (a.mimeType || '').toLowerCase().startsWith('image/')
}

function isReportTicketImage(a: api.TicketAttachmentItem) {
  return a.purpose === 'WORK_REPORT'
}

function isNotFoundGetTicketError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /\b404\b/i.test(msg) || /not\s*found/i.test(msg) || /не\s+найден/i.test(msg)
}

const MAX_TICKET_PAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024

const PHOTO_ROLES: api.Role[] = [
  'ADMIN',
  'MASTER',
  'DISPATCHER',
  'NETWORK_DIRECTOR',
  'TECHNICIAN',
  'CLIENT',
  'TERRITORIAL_MANAGER',
]

function roleCanUploadTicketPhoto(role?: api.Role | null) {
  return !!role && PHOTO_ROLES.includes(role)
}

function dedupeTimeline(items: api.TimelineItem[]): api.TimelineItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const ev = ((item.timelineEvent || item.type || item.domainType) ?? '').toUpperCase()
    const key = `${item.at}|${ev}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function formatAddressBlock(ticket: api.TicketGetOne): string {
  const loc = ticket.location
  const parts: string[] = []
  const name = (loc?.name || ticket.pointName || '').trim()
  if (name) parts.push(name)
  const addr = (loc?.address || ticket.address || '').trim()
  if (addr) parts.push(addr)
  const city = (loc?.city || '').trim()
  if (city && !parts.join(' ').includes(city)) parts.push(city)
  return parts.length ? parts.join(' · ') : '—'
}

export function MobileTicketPage() {
  const { id } = useParams()
  const ticketId = id || ''
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const queryClient = useQueryClient()

  const [operationalToast, setOperationalToast] = useState('')
  const [closeModal, setCloseModal] = useState<TicketCloseModalState>(null)
  const closeModalCameraRef = useRef<HTMLInputElement | null>(null)
  const closeModalGalleryRef = useRef<HTMLInputElement | null>(null)
  // SMA-ACCEPTANCE-005: клиентский отказ в приёмке (комментарий обязателен, фото — желательно).
  const [rejectModal, setRejectModal] = useState<ClientRejectModalState>(null)
  const rejectCameraRef = useRef<HTMLInputElement | null>(null)
  const rejectGalleryRef = useRef<HTMLInputElement | null>(null)

  const navState = location.state as MobileTicketNavState | null | undefined

  useEffect(() => {
    const st = (location.state || null) as MobileTicketNavState | null
    if (!st) return
    const t = (st.mobileOperationalToast || '').trim()
    if (!t) return
    setOperationalToast(t)
    const next: MobileTicketNavState = { ...st }
    delete next.mobileOperationalToast
    navigate(
      { pathname: location.pathname, search: location.search },
      { replace: true, state: Object.keys(next).length ? next : null },
    )
  }, [location.key, location.pathname, location.search, navigate])

  useEffect(() => {
    if (!operationalToast) return
    const tid = window.setTimeout(() => setOperationalToast(''), 3400)
    return () => window.clearTimeout(tid)
  }, [operationalToast])

  useEffect(() => {
    return () => {
      if (closeModal?.previewUrl) URL.revokeObjectURL(closeModal.previewUrl)
    }
  }, [closeModal?.previewUrl])

  useEffect(() => {
    return () => {
      if (rejectModal?.previewUrl) URL.revokeObjectURL(rejectModal.previewUrl)
    }
  }, [rejectModal?.previewUrl])

  const observerCompanyId = useMemo(
    () => (searchParams.get('companyId') || api.getObserverCompanyId(meQ.data)).trim(),
    [searchParams, meQ.data],
  )

  const ownCompanyQ = useQuery({
    queryKey: ['mobile-own-company'],
    queryFn: () => api.company(),
    enabled: !observerCompanyId,
  })

  const urlLinkedClientCompanyId = useMemo(() => {
    const q = (searchParams.get('linkedClientCompanyId') || '').trim()
    if (q) return q
    return (api.getLinkedClientCompanyId(meQ.data) || '').trim()
  }, [searchParams, meQ.data])

  const navTicketOwnerCompanyId = (navState?.ticketOwnerCompanyId || '').trim()

  const scopeNorm = useMemo<api.TicketScopeParams>(
    () => ({
      companyId: observerCompanyId || undefined,
      linkedClientCompanyId: urlLinkedClientCompanyId || undefined,
    }),
    [observerCompanyId, urlLinkedClientCompanyId],
  )

  useEffect(() => {
    api.persistScopeFromSearchParams(searchParams, meQ.data)
  }, [searchParams, meQ.data])

  const isOnline = useOnlineStatus()

  const ticketQ = useQuery({
    enabled: !!ticketId,
    queryKey: [
      'mobile-ticket-detail',
      ticketId,
      observerCompanyId,
      urlLinkedClientCompanyId,
      navTicketOwnerCompanyId,
      meQ.data?.id,
      meQ.data?.role,
    ],
    queryFn: async () => {
      if (!ticketId) throw new Error('Нет идентификатора заявки')

      if (!getOnlineStatus()) {
        const cached = loadTicketDetailCache(ticketId, scopeNorm) ?? loadAnyTicketDetailCache(ticketId)
        if (cached?.data?.ticket) return cached.data.ticket
        throw new Error('Нет сохранённой заявки. Откройте заявку при подключении к сети хотя бы раз.')
      }

      const urlCo = (searchParams.get('companyId') || '').trim()
      const urlLi = (searchParams.get('linkedClientCompanyId') || '').trim()
      const persistedObs = (api.getObserverCompanyId(meQ.data) || '').trim()
      const persistedLinked = (api.getLinkedClientCompanyId(meQ.data) || '').trim()

      const scopes = mobileTicketDetailGetOneScopes({
        urlCompanyId: urlCo,
        urlLinkedClientCompanyId: urlLi,
        stateTicketOwnerCompanyId: navTicketOwnerCompanyId,
        persistedCompanyId: persistedObs,
        persistedLinkedClientCompanyId: persistedLinked,
        meRole: meQ.data?.role,
      })

      let lastErr: unknown
      for (const sc of scopes) {
        try {
          return await api.getTicket(ticketId, sc)
        } catch (e) {
          lastErr = e
          if (!isNotFoundGetTicketError(e)) throw e
        }
      }

      if (!urlLi) {
        try {
          const co = await api.company()
          if (co.type === 'PROVIDER') {
            const linkedClients = await api.getLinkedClients()
            for (const lc of linkedClients) {
              const clientId = (lc.clientCompany.id || '').trim()
              if (!clientId) continue
              if (scopes.some((s) => (s.linkedClientCompanyId || '').trim() === clientId)) continue
              try {
                return await api.getTicket(ticketId, { linkedClientCompanyId: clientId })
              } catch (e) {
                lastErr = e
                if (!isNotFoundGetTicketError(e)) throw e
              }
            }
          }
        } catch (e) {
          if (!isNotFoundGetTicketError(e)) throw e
        }
      }

      throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? 'Заявка не найдена'))
    },
  })

  const ticket = ticketQ.data

  const ticketResourceScope = useMemo<api.TicketScopeParams>(
    () =>
      resolveMobileTicketResourceScope(meQ.data, ticket, {
        observerCompanyId,
        urlLinkedClientCompanyId,
      }),
    [meQ.data, ticket, observerCompanyId, urlLinkedClientCompanyId],
  )

  const contextMode = useMemo(
    () => resolveMobileTicketContextMode(meQ.data, ticket, observerCompanyId),
    [meQ.data, ticket, observerCompanyId],
  )

  const canUploadTicketPhotos = useMemo(() => {
    const role = meQ.data?.role
    const isClientRole = role === 'CLIENT'
    const readOnlyByVisibilityMode = contextMode === 'observer'
    const canMutateTicket = !readOnlyByVisibilityMode && !(isClientRole && contextMode !== 'tenant')
    return canMutateTicket && roleCanUploadTicketPhoto(role)
  }, [meQ.data?.role, contextMode])

  const canSendComment = useMemo(
    () => resolveMobileCanSendComment(meQ.data, ticket, observerCompanyId),
    [meQ.data, ticket, observerCompanyId],
  )

  const attachmentsQ = useQuery({
    enabled: !!ticketId && !!ticket,
    queryKey: [
      'mobile-ticket-attachments',
      ticketId,
      ticketResourceScope.companyId,
      ticketResourceScope.linkedClientCompanyId,
      meQ.data?.id,
      meQ.data?.role,
      ticket?.companyId,
    ],
    queryFn: async () => {
      if (!ticket) return [] as api.TicketAttachmentItem[]

      if (!getOnlineStatus()) {
        const cached =
          loadTicketDetailCache(ticketId, ticketResourceScope) ??
          loadTicketDetailCache(ticketId, scopeNorm) ??
          loadAnyTicketDetailCache(ticketId)
        if (cached?.data) return cached.data.attachments
        throw new Error('Нет сохранённых вложений для офлайна.')
      }

      const scopes = mobileTicketAttachmentReadScopes({
        me: meQ.data,
        ticket,
        observerCompanyId,
        urlLinkedClientCompanyId,
        stateTicketOwnerCompanyId: navTicketOwnerCompanyId,
        persistedCompanyId: (api.getObserverCompanyId(meQ.data) || '').trim(),
        persistedLinkedClientCompanyId: (api.getLinkedClientCompanyId(meQ.data) || '').trim(),
      })

      let lastEmpty: api.TicketAttachmentItem[] = []
      let lastErr: unknown
      for (const sc of scopes) {
        try {
          const data = await api.ticketAttachments(ticketId, sc)
          if (Array.isArray(data) && data.length > 0) return data
          lastEmpty = Array.isArray(data) ? data : []
        } catch (e) {
          lastErr = e
          if (!isNotFoundGetTicketError(e)) throw e
        }
      }

      if (lastErr && lastEmpty.length === 0) {
        throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? 'Вложения недоступны'))
      }
      return lastEmpty
    },
  })

  const timelineQ = useQuery({
    enabled: !!ticketId && !!ticket,
    queryKey: [
      'mobile-ticket-timeline',
      ticketId,
      ticketResourceScope.companyId,
      ticketResourceScope.linkedClientCompanyId,
    ],
    queryFn: async () => {
      if (!getOnlineStatus()) {
        const cached = loadTicketDetailCache(ticketId, scopeNorm) ?? loadAnyTicketDetailCache(ticketId)
        if (cached?.data) return cached.data.timeline ?? null
        throw new Error('Нет сохранённой истории для офлайна.')
      }
      return api.timeline(ticketId, ticketResourceScope)
    },
  })

  useEffect(() => {
    if (!getOnlineStatus()) return
    if (!ticketQ.isSuccess || !ticketId || !ticketQ.data) return
    if (!attachmentsQ.isSuccess) return
    if (timelineQ.isError) return
    if (!timelineQ.isFetched) return
    saveTicketDetailCache({
      ticketId,
      scope: ticketResourceScope,
      ticket: ticketQ.data,
      attachments: attachmentsQ.data ?? [],
      timeline: timelineQ.data ?? null,
    })
  }, [
    ticketId,
    ticketResourceScope.companyId,
    ticketResourceScope.linkedClientCompanyId,
    ticketQ.isSuccess,
    ticketQ.data,
    attachmentsQ.isSuccess,
    attachmentsQ.data,
    timelineQ.isFetched,
    timelineQ.isError,
    timelineQ.data,
  ])

  const isOwnCompanyClient = !observerCompanyId && ownCompanyQ.data?.type === 'CLIENT'
  const canAssignProvider = !isOwnCompanyClient && api.isProviderTicketAssignRole(meQ.data?.role)
  const techPrimary = ticket && meQ.data?.id ? api.mobileTechnicianTicketPrimaryAction(ticket, meQ.data.id) : null
  const assigneePresent = !!(ticket?.assignedTechnicianId || ticket?.assignedTechnician)
  const aa = ticket?.meta?.availableActions
  const transitions = ticket?.meta?.availableStatusTransitions || []
  const canShowTechClaimButton =
    meQ.data?.role === 'TECHNICIAN' &&
    !!ticket &&
    ticket.status === 'NEW' &&
    !assigneePresent &&
    (aa ? aa.canClaim : techPrimary === 'claim' && ticket.meta?.canClaimByCurrentUser !== false) &&
    !ticket.meta?.assignmentRequestedByCurrentUser
  const canShowAssignmentRequest =
    meQ.data?.role === 'TECHNICIAN' &&
    !!ticket &&
    ticket.status === 'NEW' &&
    !assigneePresent &&
    (aa ? !aa.canClaim : techPrimary === 'claim' && ticket.meta?.canClaimByCurrentUser === false) &&
    !ticket.meta?.assignmentRequestedByCurrentUser
  const showAssignmentRequestAck =
    meQ.data?.role === 'TECHNICIAN' &&
    !!ticket &&
    ticket.status === 'NEW' &&
    !assigneePresent &&
    (aa ? !aa.canClaim : techPrimary === 'claim') &&
    ticket.meta?.assignmentRequestedByCurrentUser === true
  const assigneeIdForMe =
    ticket && meQ.data?.id ? (ticket.assignedTechnicianId || ticket.assignedTechnician?.id || '').trim() : ''
  const isSelfAssigned = !!meQ.data?.id && assigneeIdForMe === meQ.data.id
  const canShowTechStart =
    !!ticket &&
    (
      (meQ.data?.role === 'TECHNICIAN' && (aa ? aa.canStart : techPrimary === 'start')) ||
      (canAssignProvider && isSelfAssigned && (aa ? aa.canStart : false))
    )
  const canShowComplete =
    !!ticket &&
    ticket.status === 'IN_PROGRESS' &&
    isSelfAssigned &&
    (aa ? aa.canComplete : transitions.includes('DONE')) &&
    (meQ.data?.role === 'TECHNICIAN' || canAssignProvider)

  // SMA-ACCEPTANCE-ROLE-GAP-001: «Принять/Не принять» — только клиентские управленческие роли
  // (ADMIN / TERRITORIAL_MANAGER / NETWORK_DIRECTOR) в client-компании; CLIENT-заявитель исключён.
  const canShowClientAcceptance =
    isOwnCompanyClient &&
    api.isClientAcceptanceRole(meQ.data?.role) &&
    !!ticket &&
    ticket.status === 'AWAITING_ACCEPTANCE'

  const [detailTab, setDetailTab] = useState<'chat' | 'info' | 'photos' | 'actions'>('chat')

  type OfflinePendingComment = { queueId: string; text: string; at: string }
  const [offlinePendingComments, setOfflinePendingComments] = useState<OfflinePendingComment[]>([])
  const [offlineQueuedNotice, setOfflineQueuedNotice] = useState('')
  const timelineFirstMountRef = useRef(true)

  const [assignTicketOpen, setAssignTicketOpen] = useState(false)
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false)
  const [assignTechId, setAssignTechId] = useState('')
  const [assignErr, setAssignErr] = useState('')
  const [techActionErr, setTechActionErr] = useState('')
  const [acceptanceErr, setAcceptanceErr] = useState('')
  const [assignmentRequestErr, setAssignmentRequestErr] = useState('')
  const [assignmentRequestToast, setAssignmentRequestToast] = useState('')
  const [requestPhotoIndex, setRequestPhotoIndex] = useState<number | null>(null)
  const [reportPhotoIndex, setReportPhotoIndex] = useState<number | null>(null)
  const [chatText, setChatText] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [chatSendError, setChatSendError] = useState<string | null>(null)
  const addTicketCameraRef = useRef<HTMLInputElement | null>(null)
  const addTicketGalleryRef = useRef<HTMLInputElement | null>(null)
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null)
  const [ticketAddPhotoError, setTicketAddPhotoError] = useState<string | null>(null)
  const [ticketAddPhotoProgress, setTicketAddPhotoProgress] = useState<{ current: number; total: number } | null>(null)

  const assignCandidatesQ = useQuery({
    queryKey: [
      'mobile-ticket-assign-candidates',
      ticketId,
      observerCompanyId,
      ticketResourceScope.linkedClientCompanyId,
      ticketResourceScope.companyId,
    ],
    queryFn: () => api.assignmentCandidates(ticketId, ticketResourceScope),
    enabled: !!ticketId && !!ticket && assignTicketOpen && canAssignProvider,
  })

  const assignTechOptions = useMemo(() => {
    const d = assignCandidatesQ.data
    if (!d) return []
    const seen = new Set<string>()
    const out: api.AssignmentCandidateTechnician[] = []
    for (const row of [...d.matched, ...d.others]) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      out.push(row)
    }
    return out
  }, [assignCandidatesQ.data])

  useEffect(() => {
    if (!assignTechOptions.length) {
      setAssignTechId('')
      return
    }
    setAssignTechId((prev) => {
      if (prev && assignTechOptions.some((r) => r.id === prev)) return prev
      return assignTechOptions[0]!.id
    })
  }, [assignTechOptions])

  const invalidateTicketQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ['mobile-ticket-detail'] })
    await queryClient.invalidateQueries({ queryKey: ['mobile-ticket-attachments'] })
    await queryClient.invalidateQueries({ queryKey: ['mobile-ticket-timeline'] })
    await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
    await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
    await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
    await queryClient.invalidateQueries({ queryKey: ['board'] })
  }

  const isTicketAddPhotoUploading = ticketAddPhotoProgress !== null

  function clearTicketAddPhotoInputs() {
    if (addTicketCameraRef.current) addTicketCameraRef.current.value = ''
    if (addTicketGalleryRef.current) addTicketGalleryRef.current.value = ''
  }

  async function uploadFilesToExistingTicket(files: File[]) {
    if (files.length === 0) return
    if (!ticketId) return
    if (!canUploadTicketPhotos) {
      setTicketAddPhotoError('Недостаточно прав для загрузки')
      return
    }
    if (!isOnline) {
      setTicketAddPhotoError('Нужно подключение к сети, чтобы загрузить фото')
      return
    }
    setTicketAddPhotoError(null)
    setTicketAddPhotoProgress({ current: 0, total: files.length })
    try {
      for (let i = 0; i < files.length; i++) {
        setTicketAddPhotoProgress({ current: i + 1, total: files.length })
        await api.uploadTicketAttachment(ticketId, files[i], ticketResourceScope)
      }
      await invalidateTicketQueries()
    } catch (e: unknown) {
      setTicketAddPhotoError(formatMobileMutationError(e, { operation: 'upload_attachment' }))
    } finally {
      setTicketAddPhotoProgress(null)
      clearTicketAddPhotoInputs()
    }
  }

  function handleTicketAddPhotos(e: ChangeEvent<HTMLInputElement>) {
    setTicketAddPhotoError(null)
    const list = e.target.files
    const files = list ? Array.from(list) : []
    e.target.value = ''
    if (files.length === 0) return
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setTicketAddPhotoError('Можно загружать только изображения')
        return
      }
      if (file.size <= 0) {
        setTicketAddPhotoError('Файл пустой')
        return
      }
      if (file.size > MAX_TICKET_PAGE_ATTACHMENT_BYTES) {
        setTicketAddPhotoError('Изображение слишком большое (максимум 10 МБ)')
        return
      }
    }
    void uploadFilesToExistingTicket(files)
  }

  useEffect(() => {
    setAssignmentRequestErr('')
  }, [ticketId, ticket?.id, ticket?.status, ticket?.assignedTechnicianId])

  useEffect(() => {
    if (!assignmentRequestToast) return
    const tid = window.setTimeout(() => setAssignmentRequestToast(''), 2800)
    return () => window.clearTimeout(tid)
  }, [assignmentRequestToast])

  useEffect(() => {
    if (!offlineQueuedNotice) return
    const tid = window.setTimeout(() => setOfflineQueuedNotice(''), 3200)
    return () => window.clearTimeout(tid)
  }, [offlineQueuedNotice])

  useEffect(() => {
    if (timelineFirstMountRef.current) { timelineFirstMountRef.current = false; return }
    if (isOnline) setOfflinePendingComments([])
  }, [timelineQ.dataUpdatedAt])

  const techActionM = useMutation({
    mutationFn: async (mode: 'claim' | 'start') => {
      if (!ticket) throw new Error('Нет заявки')
      if (mode === 'claim') await api.claimTicket(ticket.id, ticketResourceScope)
      else await api.updateTicketStatus(ticket.id, { status: 'IN_PROGRESS' }, ticketResourceScope)
    },
    onMutate: () => setTechActionErr(''),
    onSuccess: async () => {
      await invalidateTicketQueries()
      await queryClient.refetchQueries({ queryKey: ['mobile-ticket-detail', ticketId] })
    },
    onError: (e: unknown, vars: 'claim' | 'start') => {
      const claimBlocked = ticket?.meta?.availableActions
        ? !ticket.meta.availableActions.canClaim
        : ticket?.meta?.canClaimByCurrentUser === false
      setTechActionErr(
        formatMobileMutationError(e, {
          operation: vars,
          claimBlockedByCategoryPolicy: vars === 'claim' && claimBlocked,
        }),
      )
    },
  })

  const assignmentRequestM = useMutation({
    mutationFn: async () => {
      if (!ticket) throw new Error('Нет заявки')
      return api.requestTicketAssignment(ticket.id, ticketResourceScope)
    },
    onMutate: () => {
      setAssignmentRequestErr('')
    },
    onSuccess: async (data) => {
      setAssignmentRequestToast(
        data?.alreadyRequested ? 'Запрос уже был отправлен' : 'Запрос отправлен',
      )
      await invalidateTicketQueries()
      await queryClient.refetchQueries({ queryKey: ['mobile-ticket-detail', ticketId] })
    },
    onError: (e: unknown) => {
      setAssignmentRequestErr(formatMobileMutationError(e, { operation: 'request_assignment' }))
    },
  })

  const assignM = useMutation({
    mutationFn: async (params: { technicianId: string }) => {
      if (!ticketId) throw new Error('Нет заявки')
      await api.assignTicket(ticketId, params.technicianId, ticketResourceScope)
    },
    onMutate: () => setAssignErr(''),
    onSuccess: async () => {
      setAssignTicketOpen(false)
      setAssignTechId('')
      await invalidateTicketQueries()
    },
    onError: (e: unknown) => {
      setAssignErr(formatMobileMutationError(e, { operation: 'assign' }))
    },
  })

  const closeM = useMutation({
    mutationFn: async () => {
      if (!closeModal) throw new Error('Нет данных для закрытия')
      if (!closeModal.file) throw new Error('Нужно фото отчёта')
      const comment = closeModal.comment.trim()
      if (comment.length < 3) throw new Error('Нужен комментарий не короче 3 символов')
      await api.uploadTicketAttachment(closeModal.ticketId, closeModal.file, ticketResourceScope)
      await api.addTicketComment(closeModal.ticketId, comment, ticketResourceScope)
      // SMA-ACCEPTANCE-005: техник отправляет работу на клиентскую приёмку, а не закрывает напрямую.
      await api.updateTicketStatus(closeModal.ticketId, { status: 'AWAITING_ACCEPTANCE' }, ticketResourceScope)
    },
    onSuccess: async () => {
      if (closeModal?.previewUrl) URL.revokeObjectURL(closeModal.previewUrl)
      setCloseModal(null)
      if (closeModalCameraRef.current) closeModalCameraRef.current.value = ''
      if (closeModalGalleryRef.current) closeModalGalleryRef.current.value = ''
      await invalidateTicketQueries()
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-notifications'] })
      await queryClient.refetchQueries({ queryKey: ['mobile-ticket-detail', ticketId] })
      setOperationalToast('Работа отправлена на приёмку клиенту.')
    },
    onError: (e: unknown) => {
      setCloseModal((prev) => (prev ? { ...prev, err: formatMobileMutationError(e, { operation: 'close' }) } : prev))
    },
  })

  // SMA-ACCEPTANCE-005: клиент принимает работу (контракт POST /tickets/:id/acceptance, decision=ACCEPT → DONE).
  const acceptM = useMutation({
    mutationFn: async () => {
      if (!ticket) throw new Error('Нет заявки')
      await api.decideTicketAcceptance(ticket.id, { decision: 'ACCEPT' }, ticketResourceScope)
    },
    onSuccess: async () => {
      await invalidateTicketQueries()
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-notifications'] })
      await queryClient.refetchQueries({ queryKey: ['mobile-ticket-detail', ticketId] })
      setOperationalToast('Работа принята. Заявка завершена.')
    },
    onError: (e: unknown) => setAcceptanceErr(formatMobileMutationError(e, { operation: 'other' })),
  })

  // SMA-ACCEPTANCE-005: клиент не принимает работу (decision=REJECT → IN_PROGRESS). Комментарий обязателен, фото желательно.
  const rejectM = useMutation({
    mutationFn: async () => {
      if (!rejectModal) throw new Error('Нет данных для отказа')
      const comment = rejectModal.comment.trim()
      if (comment.length < 3) throw new Error('Нужен комментарий не короче 3 символов')
      // Фото (по желанию) прикрепляем к заявке до решения, чтобы оно осталось в истории.
      if (rejectModal.file) await api.uploadTicketAttachment(rejectModal.ticketId, rejectModal.file, ticketResourceScope)
      await api.decideTicketAcceptance(rejectModal.ticketId, { decision: 'REJECT', comment }, ticketResourceScope)
    },
    onSuccess: async () => {
      if (rejectModal?.previewUrl) URL.revokeObjectURL(rejectModal.previewUrl)
      setRejectModal(null)
      if (rejectCameraRef.current) rejectCameraRef.current.value = ''
      if (rejectGalleryRef.current) rejectGalleryRef.current.value = ''
      await invalidateTicketQueries()
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-notifications'] })
      await queryClient.refetchQueries({ queryKey: ['mobile-ticket-detail', ticketId] })
      setOperationalToast('Работа отправлена на доработку.')
    },
    onError: (e: unknown) => {
      setRejectModal((prev) => (prev ? { ...prev, err: formatMobileMutationError(e, { operation: 'other' }) } : prev))
    },
  })

  const listOrigin = readListOrigin(location)
  // SMA-CHAT-UX-004: если пришли из чата — «Назад» возвращает в чат заявки, а не на главную.
  const backPath =
    listOrigin === 'chat'
      ? mobilePath(location.pathname, '/chats')
      : listOrigin === 'my'
        ? mobilePath(location.pathname, '/my')
        : mobilePath(location.pathname, '')
  const backHref = api.appendScopeToPath(backPath, scopeNorm, meQ.data)
  const boardTabLabel = navState?.homeBoardTab ? MOBILE_HOME_TAB_LABELS[navState.homeBoardTab] : ''
  const boardChipLabels = useMemo(() => {
    const chips = navState?.homeBoardChips
    if (!Array.isArray(chips) || chips.length === 0) return []
    return chips
      .filter((chip): chip is MobileHomeBoardChipId => chip in MOBILE_HOME_BOARD_CHIP_LABELS)
      .map((chip) => MOBILE_HOME_BOARD_CHIP_LABELS[chip])
  }, [navState?.homeBoardChips])
  const boardSearchLabel = (navState?.homeBoardSearch || '').trim()
  const hasBoardContext = !!boardTabLabel || boardChipLabels.length > 0 || !!boardSearchLabel
  const resetBoardContextState: MobileTicketNavState | undefined = useMemo(() => {
    if (listOrigin !== 'home') return undefined
    return {
      mobileListOrigin: 'home',
      ticketOwnerCompanyId: navState?.ticketOwnerCompanyId,
      homeBoardTab: 'all',
      homeBoardChips: [],
      homeBoardSearch: '',
    }
  }, [listOrigin, navState?.ticketOwnerCompanyId])

  const ticketCompanyId = (ticket?.companyId || '').trim()

  const childHref = (childId: string) =>
    api.appendScopeToPath(mobilePath(location.pathname, `/tickets/${childId}`), scopeNorm, meQ.data)

  const desc = ticket ? `${ticket.problemText || ''}`.trim() || ticket.description?.trim() || '—' : '—'

  const timelineItems = useMemo(
    () => dedupeTimeline(timelineQ.data?.timeline || timelineQ.data?.items || []),
    [timelineQ.data],
  )
  const chatMessages = useMemo(
    () =>
      toChatMessages(timelineItems, meQ.data?.id ?? '', {
        categoryName: ticket?.problemCategory?.name ?? null,
        locationName: ticket?.location?.name || ticket?.pointName || null,
        description: ticket?.problemText || ticket?.description || ticket?.title || null,
      }),
    [
      timelineItems,
      meQ.data?.id,
      ticket?.description,
      ticket?.location?.name,
      ticket?.pointName,
      ticket?.problemCategory?.name,
      ticket?.problemText,
      ticket?.title,
    ],
  )

  const requestImages = useMemo(() => {
    const imgs = (attachmentsQ.data || []).filter(isImageAttachment)
    return imgs.filter((a) => !isReportTicketImage(a))
  }, [attachmentsQ.data])

  const reportImages = useMemo(() => {
    const imgs = (attachmentsQ.data || []).filter(isImageAttachment)
    return imgs.filter((a) => isReportTicketImage(a))
  }, [attachmentsQ.data])

  const otherFiles = useMemo(() => (attachmentsQ.data || []).filter((a) => !isImageAttachment(a)), [attachmentsQ.data])

  const [requestPhotoItems, setRequestPhotoItems] = useState<PhotoViewerItem[]>([])
  const [reportPhotoItems, setReportPhotoItems] = useState<PhotoViewerItem[]>([])

  useEffect(() => {
    setRequestPhotoItems(requestImages.map((a) => ({ src: api.resolveTicketAttachmentUrl(a), alt: a.originalName || 'Фото' })))
  }, [requestImages])

  useEffect(() => {
    setReportPhotoItems(reportImages.map((a) => ({ src: api.resolveTicketAttachmentUrl(a), alt: a.originalName || 'Фото отчёта' })))
  }, [reportImages])

  function openRequestPhoto(idx: number, resolvedSrc: string) {
    setRequestPhotoItems((prev) => {
      const next = [...prev]
      if (next[idx]) next[idx] = { ...next[idx]!, src: resolvedSrc }
      return next
    })
    setRequestPhotoIndex(idx)
  }

  function openReportPhoto(idx: number, resolvedSrc: string) {
    setReportPhotoItems((prev) => {
      const next = [...prev]
      if (next[idx]) next[idx] = { ...next[idx]!, src: resolvedSrc }
      return next
    })
    setReportPhotoIndex(idx)
  }

  const executorLine = ticket
    ? (() => {
        if (!ticket.assignedTechnician) return 'Не назначен'
        const name = [ticket.assignedTechnician.firstName, ticket.assignedTechnician.lastName].filter(Boolean).join(' ').trim()
        const label = name || ticket.assignedTechnician.email
        return ticket.assignedTechnician.phone ? `${label}\n${ticket.assignedTechnician.phone}` : label
      })()
    : '—'

  const showAssignButton =
    !!ticket &&
    canAssignProvider &&
    ticket.status === 'NEW' &&
    !ticket.assignedTechnicianId &&
    !ticket.assignedTechnician

  const showSelfAssignButton =
    !!ticket &&
    canAssignProvider &&
    ticket.status === 'NEW' &&
    !assigneePresent

  const claimBtnPending = techActionM.isPending && techActionM.variables === 'claim'
  const startBtnPending = techActionM.isPending && techActionM.variables === 'start'
  const assignBusy = assignM.isPending
  const closeBusy = closeM.isPending
  const closeCanSubmit = !!closeModal?.file && closeModal.comment.trim().length >= 3 && !closeBusy
  // SMA-ACCEPTANCE-005: для отказа достаточно комментария (фото — по желанию).
  const rejectCanSubmit = !!rejectModal && rejectModal.comment.trim().length >= 3 && !rejectM.isPending

  const showCompleteBlockedHint =
    (meQ.data?.role === 'TECHNICIAN' || canAssignProvider) &&
    !!ticket &&
    ticket.status === 'IN_PROGRESS' &&
    isSelfAssigned &&
    !canShowComplete

  const hasTechnicianActionsBlock =
    canShowTechClaimButton ||
    canShowAssignmentRequest ||
    showAssignmentRequestAck ||
    canShowTechStart ||
    showAssignButton ||
    showSelfAssignButton ||
    canShowComplete ||
    showCompleteBlockedHint
  const showTechnicianNoActionsHint =
    meQ.data?.role === 'TECHNICIAN' &&
    !!ticket &&
    ticket.status !== 'DONE' &&
    ticket.status !== 'CANCELED' &&
    !hasTechnicianActionsBlock

  const padBottomForOpsDock = (hasTechnicianActionsBlock || canShowClientAcceptance) && detailTab !== 'actions'

  useEffect(() => {
    const el = chatInputRef.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(Math.max(el.scrollHeight, 48), 140)
    el.style.height = `${next}px`
  }, [chatText])

  async function handleChatSend() {
    const trimmed = chatText.trim()
    if (!trimmed || chatSending) return

    if (!isOnline) {
      const queued = enqueueOfflineComment({ ticketId, scope: ticketResourceScope, comment: trimmed })
      setChatText('')
      setOfflinePendingComments((prev) => [...prev, { queueId: queued.id, text: trimmed, at: queued.createdAt }])
      return
    }

    setChatSendError(null)
    setChatSending(true)
    try {
      await api.addTicketComment(ticketId, trimmed, ticketResourceScope)
      setChatText('')
      await invalidateTicketQueries()
    } catch (e: unknown) {
      setChatSendError(formatMobileMutationError(e, { operation: 'other' }))
    } finally {
      setChatSending(false)
    }
  }

  function handleTechActionWithOfflineSupport(mode: 'claim' | 'start') {
    if (!getOnlineStatus()) {
      if (mode === 'start' && ticket) {
        enqueueOfflineStatusChange({ ticketId: ticket.id, scope: ticketResourceScope, status: 'IN_PROGRESS' })
        setOfflineQueuedNotice('Действие сохранено и будет отправлено после восстановления сети.')
        return
      }
      setTechActionErr('Нет соединения. Действие требует подключения к сети.')
      return
    }
    techActionM.mutate(mode)
  }

  function openChatComposer() {
    setDetailTab('chat')
    window.setTimeout(() => chatInputRef.current?.focus(), 60)
  }

  const ticketSheetActions: TicketSheetAction[] = ticket
    ? ([
        meQ.data?.role === 'TECHNICIAN' && ticket.status === 'NEW' && !assigneePresent
          ? { id: 'take', label: 'Взять в работу', icon: '🙋', onClick: () => handleTechActionWithOfflineSupport('claim') }
          : null,
        showSelfAssignButton
          ? { id: 'self-assign', label: 'Взять заявку себе', icon: '🙋', onClick: () => { if (meQ.data?.id) assignM.mutate({ technicianId: meQ.data.id }) } }
          : null,
        showAssignButton
          ? { id: 'assign', label: 'Назначить исполнителя', icon: '👷', onClick: () => { setAssignErr(''); setAssignTicketOpen(true) } }
          : null,
        { id: 'comment', label: 'Написать в чат', icon: '💬', onClick: openChatComposer },
        { id: 'photo', label: 'Добавить фото', icon: '📷', onClick: () => setDetailTab('photos') },
        { id: 'chat', label: 'Чат', icon: '🗨️', onClick: () => setDetailTab('chat') },
        { id: 'actions', label: 'Действия', icon: '⚡', onClick: () => setDetailTab('actions') },
        { id: 'object', label: 'Инфо о заявке', icon: '📍', onClick: () => setDetailTab('info') },
        canShowComplete
          ? {
              id: 'close',
              label: 'Отправить на приёмку',
              icon: '✅',
              onClick: () =>
                setCloseModal({
                  ticketId: ticket.id,
                  title: `${mobileTicketNumberTitle(ticket.ticketNumber)} — ${mobileTicketCategoryLocationFromDetail(ticket)}`,
                  file: null,
                  previewUrl: '',
                  comment: '',
                  err: '',
                }),
            }
          : null,
        canShowClientAcceptance
          ? { id: 'accept', label: 'Принять работу', icon: '✅', onClick: () => { setAcceptanceErr(''); acceptM.mutate() } }
          : null,
        canShowClientAcceptance
          ? {
              id: 'reject',
              label: 'Не принять работу',
              icon: '↩️',
              onClick: () => {
                setAcceptanceErr('')
                setRejectModal({
                  ticketId: ticket.id,
                  title: `${mobileTicketNumberTitle(ticket.ticketNumber)} — ${mobileTicketCategoryLocationFromDetail(ticket)}`,
                  file: null,
                  previewUrl: '',
                  comment: '',
                  err: '',
                })
              },
            }
          : null,
      ].filter(Boolean) as TicketSheetAction[])
    : []

  return (
    <div className={`mobileSection mobileTicketDetailsRoot${padBottomForOpsDock ? ' mobileTicketDetailsRoot--opsDock' : ''}`}>
      <MobileTicketActionsSheet
        open={actionsSheetOpen}
        onClose={() => setActionsSheetOpen(false)}
        actions={ticketSheetActions}
      />
      <div className="mobileTicketDetailsToolbar">
        <Link
          to={backHref}
          state={(location.state as MobileTicketNavState | null | undefined) ?? undefined}
          className="mobileDetailsBackLink"
        >
          Назад
        </Link>
        {ticket ? (
          <button
            type="button"
            className="mobileTicketActionsTrigger"
            aria-label="Быстрые действия"
            onClick={() => setActionsSheetOpen(true)}
          >
            •••
          </button>
        ) : null}
      </div>

      {hasBoardContext ? (
        <div className="mobileCard" style={{ marginBottom: 8 }}>
          <div className="mobileRow" style={{ marginBottom: 6 }}>
            <strong style={{ fontSize: '0.9rem' }}>Контекст доски</strong>
            <Link
              to={backHref}
              state={resetBoardContextState}
              className="mobileBtn mobileBtnSecondary"
              style={{ padding: '6px 10px', minHeight: 'auto' }}
            >
              Без фильтров
            </Link>
          </div>
          {boardTabLabel ? <div className="mobileMeta">Вкладка: {boardTabLabel}</div> : null}
          {boardChipLabels.length > 0 ? <div className="mobileMeta">Фильтры: {boardChipLabels.join(', ')}</div> : null}
          {boardSearchLabel ? <div className="mobileMeta">Поиск: {boardSearchLabel}</div> : null}
        </div>
      ) : null}

      {!isOnline && ticketQ.isSuccess && ticket ? (
        <div className="mobileStaleDataBanner" role="status">
          Показаны сохранённые данные
        </div>
      ) : null}

      {ticketQ.isLoading ? <div className="mobileCard mobileMeta">Загрузка…</div> : null}
      {ticketQ.isError ? (
        <div className="mobileNotice mobileNoticeError">
          {formatMobileMutationError(ticketQ.error, { operation: 'other' })}
        </div>
      ) : null}

      {ticket ? (
        <>
          {/* ── Tab bar ─────────────────────────────────────── */}
          <div className="mobileDetailTabs">
            <button
              type="button"
              className={`mobileDetailTab${detailTab === 'chat' ? ' mobileDetailTab--active' : ''}`}
              onClick={() => setDetailTab('chat')}
            >
              Чат
              {chatMessages.length > 0 ? (
                <span className="mobileDetailTabBadge">{chatMessages.length}</span>
              ) : null}
            </button>
            <button
              type="button"
              className={`mobileDetailTab${detailTab === 'info' ? ' mobileDetailTab--active' : ''}`}
              onClick={() => setDetailTab('info')}
            >
              Инфо
            </button>
            <button
              type="button"
              className={`mobileDetailTab${detailTab === 'photos' ? ' mobileDetailTab--active' : ''}`}
              onClick={() => setDetailTab('photos')}
            >
              Фото
              {requestImages.length + reportImages.length > 0 ? (
                <span className="mobileDetailTabBadge">{requestImages.length + reportImages.length}</span>
              ) : null}
            </button>
            <button
              type="button"
              className={`mobileDetailTab${detailTab === 'actions' ? ' mobileDetailTab--active' : ''}`}
              onClick={() => setDetailTab('actions')}
            >
              Действия
              {(hasTechnicianActionsBlock || canShowClientAcceptance) ? (
                <span className="mobileDetailTabBadge mobileDetailTabBadge--action">!</span>
              ) : null}
            </button>
          </div>

          {/* ── Info tab ─────────────────────────────────────── */}
          {detailTab === 'info' ? (
          <>
          {shouldShowClientTicketLifecycleHint(meQ.data, ticket) ? (
            <div className="mobileCard mobileClientLifecycleHint" role="status">
              <div className="mobileMeta" style={{ fontWeight: 800, marginBottom: 6 }}>
                Для вас
              </div>
              <p className="mobileClientLifecycleHintText">{clientTicketLifecycleHintText(ticket.status)}</p>
            </div>
          ) : null}
          <div
            className={[
              'mobileCard',
              'mobileTicketCard',
              `mobileTicketCard--${ticket.status}`,
              ticket.status !== 'DONE' &&
              ticket.status !== 'CANCELED' &&
              (ticket.slaBreachedAt ||
                (ticket.slaDueAt && !Number.isNaN(new Date(ticket.slaDueAt).getTime()) && Date.now() > new Date(ticket.slaDueAt).getTime()))
                ? 'mobileTicketCardSlaOverdue'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {/* Status badge + number */}
            <div className="mobileRow" style={{ marginBottom: 4 }}>
              <span className={`mobileTicketStatusLarge mobileTicketStatusLarge--${ticket.status}`}>
                {mobileTicketStatusLabelRu(ticket.status)}
              </span>
              <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                {mobileTicketNumberTitle(ticket.ticketNumber)}
              </span>
            </div>

            {/* Problem description (title) */}
            <div className="mobileDetailTitle">{desc}</div>

            {/* Field rows */}
            <div className="mobileDetailSection">
              {ticket.problemCategory?.name ? (
                <div className="mobileDetailRow">
                  <span className="mobileDetailRowLabel">Категория</span>
                  <span className="mobileDetailRowValue">{ticket.problemCategory.name}</span>
                </div>
              ) : null}
              <div className="mobileDetailRow">
                <span className="mobileDetailRowLabel">Объект</span>
                <span className="mobileDetailRowValue">{formatAddressBlock(ticket)}</span>
              </div>
              <div className="mobileDetailRow">
                <span className="mobileDetailRowLabel">Приоритет</span>
                <span className="mobileDetailRowValue">
                  {mobileTicketPriorityIsUrgent(ticket.priority ?? 'NORMAL') ? (
                    <span className="mobileSlaUrgentPill" style={{ marginRight: 6 }}>Срочно</span>
                  ) : null}
                  {ticket.priority === 'URGENT' ? 'Срочный (2 ч)' : 'Обычный (24 ч)'}
                  {(() => {
                    const line = mobileTicketSlaCountdownLabel({
                      slaDueAt: ticket.slaDueAt,
                      slaBreached: !!ticket.slaBreachedAt || (ticket.slaDueAt ? Date.now() > new Date(ticket.slaDueAt).getTime() : false),
                      status: ticket.status,
                    })
                    return line ? <span style={{ marginLeft: 8, color: '#dc2626', fontWeight: 700 }}>{line}</span> : null
                  })()}
                </span>
              </div>
              <div className="mobileDetailRow">
                <span className="mobileDetailRowLabel">Исполнитель</span>
                <span className="mobileDetailRowValue" style={{ whiteSpace: 'pre-line' }}>{executorLine}</span>
              </div>
              {ticket.slaDueAt ? (
                <div className="mobileDetailRow">
                  <span className="mobileDetailRowLabel">SLA</span>
                  <span className="mobileDetailRowValue">
                    {new Date(ticket.slaDueAt).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ) : null}
              <div className="mobileDetailRow" style={{ borderBottom: 'none' }}>
                <span className="mobileDetailRowLabel">ID</span>
                <span className="mobileDetailRowValue" style={{ fontSize: '0.72rem', color: '#9ca3af', wordBreak: 'break-all' }}>{ticket.id}</span>
              </div>
            </div>

            {shouldShowClientTicketLifecycleHint(meQ.data, ticket) && ticket.problemCategory?.name ? (
              <CategoryGuidancePanel categoryName={ticket.problemCategory.name} variant="mobile" />
            ) : null}
          </div>

          {showTechnicianNoActionsHint ? (
            <div className="mobileCard mobileEmptyState" style={{ marginTop: 8 }} role="status">
              <div className="mobileEmptyStateTitle">Действий нет</div>
              <p className="mobileEmptyStateHint">
                В этом статусе с заявкой нельзя выполнить полевое действие (например, исполнитель — другой техник, или доступ только
                на просмотр).
              </p>
              {ticket.status === 'NEW' && (ticket.meta?.claimAvailabilityReason || '').trim() ? (
                <div style={{ marginTop: 12, textAlign: 'left' }}>
                  <MobileClaimReasonHintBox reason={ticket.meta?.claimAvailabilityReason} />
                </div>
              ) : null}
            </div>
          ) : null}

          {ticket.children?.length ? (
            <div className="mobileSection" style={{ marginTop: 4 }}>
              <h2 className="mobileSectionTitle">Связанные заявки</h2>
              {ticket.children.map((ch) => {
                const pc = ch.problemCategory
                const normalizedProblemCategory = {
                  id: pc?.id || '_',
                  name: pc?.name || 'Без категории',
                  instructions: (pc as { instructions?: string | null } | null | undefined)?.instructions ?? null,
                }
                return (
                  <Link
                    key={ch.id}
                    to={childHref(ch.id)}
                    state={mobileTicketNavState(
                      listOrigin,
                      [navState?.ticketOwnerCompanyId, ticketCompanyId, urlLinkedClientCompanyId, ticket?.companyId]
                        .map((x) => (x || '').trim())
                        .find((x) => x.length > 0),
                    )}
                    className={`mobileCard mobileTicketCard mobileTicketCard--${ch.status} mobileCardClickable`}
                    style={{ display: 'block', padding: 12 }}
                  >
                    <div className="mobileTicketDetailsHeadline">
                      {mobileTicketNumberTitle((ch as { ticketNumber?: number }).ticketNumber)}
                    </div>
                    <div className="mobileMeta" style={{ marginTop: 4 }}>
                      {mobileTicketCategoryLocationFromDetail({
                        problemCategory: normalizedProblemCategory,
                        title: ch.problemText || '',
                        location: ch.location ?? null,
                        pointName: null,
                      })}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span className={`mobileTicketStatus mobileTicketStatus--${ch.status}`}>{mobileTicketStatusLabelRu(ch.status)}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : null}
          </>
          ) : null}

          {/* ── Persistent action dock (Чат / Инфо / Фото tabs) ─ */}
          {canShowClientAcceptance && detailTab !== 'actions' ? (
            <div className="mobileCard mobileTicketOpsDock mobileTicketOpsDock--fixed">
              <div className="mobileSectionTitle" style={{ marginBottom: 8 }}>
                Приёмка работ
              </div>
              <p className="mobileFieldHint" style={{ marginBottom: 10 }}>
                Исполнитель отправил работу на приёмку. Примите её или отправьте на доработку с комментарием.
              </p>
              {acceptanceErr ? (
                <div className="mobileNotice mobileNoticeError" style={{ marginBottom: 10 }}>{acceptanceErr}</div>
              ) : null}
              <button
                type="button"
                className="mobileBtn mobileBtn--done"
                style={{ width: '100%', minHeight: 48 }}
                disabled={acceptM.isPending || rejectM.isPending || !isOnline}
                onClick={() => { setAcceptanceErr(''); acceptM.mutate() }}
              >
                {acceptM.isPending ? 'Принимаем…' : 'Принять работу'}
              </button>
              <button
                type="button"
                className="mobileBtn mobileBtnSecondary"
                style={{ width: '100%', marginTop: 8, minHeight: 48 }}
                disabled={acceptM.isPending || rejectM.isPending || !isOnline}
                onClick={() => {
                  if (!ticket) return
                  setAcceptanceErr('')
                  setRejectModal({
                    ticketId: ticket.id,
                    title: `${mobileTicketNumberTitle(ticket.ticketNumber)} — ${mobileTicketCategoryLocationFromDetail(ticket)}`,
                    file: null,
                    previewUrl: '',
                    comment: '',
                    err: '',
                  })
                }}
              >
                Не принять работу
              </button>
            </div>
          ) : null}

          {hasTechnicianActionsBlock && detailTab !== 'actions' ? (
            <div className="mobileCard mobileTicketOpsDock mobileTicketOpsDock--fixed">
              <div className="mobileSectionTitle" style={{ marginBottom: 8 }}>
                Действия
              </div>
              {showAssignmentRequestAck ? (
                <div className="mobileUxHintReason mobileUxHintReason--compact" role="status" style={{ marginBottom: 10 }}>
                  <div className="mobileUxHintReasonTitle">Запрос отправлен</div>
                  <div className="mobileUxHintReasonDetail">Диспетчер получил запрос на назначение. Повторно отправлять не нужно.</div>
                </div>
              ) : null}
              {canShowAssignmentRequest ? (
                (ticket.meta?.claimAvailabilityReason || '').trim() ? (
                  <MobileClaimReasonHintBox reason={ticket.meta?.claimAvailabilityReason} />
                ) : (
                  <MobileBoardClaimFallbackHint />
                )
              ) : canShowTechClaimButton ? (
                <div className="mobileFieldHint" style={{ marginBottom: 10 }}>
                  «Взять заявку» — если самовзятие разрешено политикой компании и вашим профилем.
                </div>
              ) : null}
              {canShowTechClaimButton ? (
                <button
                  type="button"
                  className="mobileBtn mobileBtn--claim"
                  style={{ width: '100%' }}
                  disabled={claimBtnPending || assignmentRequestM.isPending}
                  onClick={() => handleTechActionWithOfflineSupport('claim')}
                >
                  {claimBtnPending ? 'Берём заявку…' : 'Взять заявку'}
                </button>
              ) : null}
              {canShowAssignmentRequest || showAssignmentRequestAck ? (
                <button
                  type="button"
                  className="mobileBtn mobileBtnSecondary"
                  style={{ width: '100%', marginTop: canShowTechClaimButton ? 8 : 0 }}
                  disabled={showAssignmentRequestAck || assignmentRequestM.isPending || techActionM.isPending}
                  onClick={() => { if (showAssignmentRequestAck) return; assignmentRequestM.mutate() }}
                >
                  {showAssignmentRequestAck ? 'Запрос отправлен' : assignmentRequestM.isPending ? 'Отправляем запрос…' : 'Запросить назначение'}
                </button>
              ) : null}
              {canShowTechStart ? (
                <button
                  type="button"
                  className="mobileBtn mobileBtn--start"
                  style={{ width: '100%' }}
                  disabled={startBtnPending || assignmentRequestM.isPending}
                  onClick={() => handleTechActionWithOfflineSupport('start')}
                >
                  {startBtnPending ? 'Начинаем…' : 'Начать работу'}
                </button>
              ) : null}
              {assignmentRequestErr ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>{assignmentRequestErr}</div> : null}
              {techActionErr ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>{techActionErr}</div> : null}
              {canShowComplete ? (
                <button
                  type="button"
                  className="mobileBtn mobileBtn--done"
                  style={{ width: '100%', marginTop: 8, minHeight: 48 }}
                  disabled={closeBusy || techActionM.isPending || assignmentRequestM.isPending || !isOnline}
                  onClick={() => {
                    if (!ticket) return
                    setCloseModal({ ticketId: ticket.id, title: `${mobileTicketNumberTitle(ticket.ticketNumber)} — ${mobileTicketCategoryLocationFromDetail(ticket)}`, file: null, previewUrl: '', comment: '', err: '' })
                  }}
                >
                  Отправить на приёмку (фото отчёта)
                </button>
              ) : null}
              {showCompleteBlockedHint ? (
                <div className="mobileUxHintReason mobileUxHintReason--compact" role="status" style={{ marginTop: 10 }}>
                  <div className="mobileUxHintReasonTitle">Завершение недоступно</div>
                  <div className="mobileUxHintReasonDetail">
                    {(ticket.meta?.availableActionHints?.canComplete || '').trim() || 'Политика или отсутствие данных (комментарий, фото) не позволяют закрыть заявку из приложения.'}
                  </div>
                </div>
              ) : null}
              {showSelfAssignButton ? (
                <button
                  type="button"
                  className="mobileBtn mobileBtn--claim"
                  style={{ width: '100%', marginTop: 8 }}
                  disabled={assignBusy}
                  onClick={() => { if (!meQ.data?.id) return; assignM.mutate({ technicianId: meQ.data.id }) }}
                >
                  {assignBusy ? 'Берём заявку…' : 'Взять заявку себе'}
                </button>
              ) : null}
              {showAssignButton ? (
                <button
                  type="button"
                  className="mobileBtn mobileBtnSecondary"
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={() => { setAssignErr(''); setAssignTicketOpen(true) }}
                >
                  Назначить исполнителя
                </button>
              ) : null}
            </div>
          ) : null}

          {/* ── Photos tab ───────────────────────────────────── */}
          {detailTab === 'photos' ? (
            <div className="mobileCard">
              {canUploadTicketPhotos && !isOnline ? (
                <div className="mobileMeta" style={{ marginBottom: 10 }}>
                  Офлайн: загрузка фото недоступна. Подключитесь к сети, чтобы добавить снимки.
                </div>
              ) : null}
              {canUploadTicketPhotos && isOnline ? (
                <div className="mobileTicketAddPhotos">
                  <div className="mobileSectionTitle" style={{ marginBottom: 8 }}>
                    Добавить фото
                  </div>
                  <p className="mobileHint" style={{ marginTop: 0 }}>
                    Несколько файлов — из галереи; камера добавляет по одному снимку за раз.
                  </p>
                  <input
                    ref={addTicketCameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="mobilePhotoInputHidden"
                    aria-label="Сделать фото для заявки"
                    onChange={handleTicketAddPhotos}
                    disabled={isTicketAddPhotoUploading}
                  />
                  <input
                    ref={addTicketGalleryRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="mobilePhotoInputHidden"
                    aria-label="Выбрать фото из галереи для заявки"
                    onChange={handleTicketAddPhotos}
                    disabled={isTicketAddPhotoUploading}
                  />
                  <div className="mobilePhotoSourceRow">
                    <button
                      type="button"
                      className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn"
                      disabled={isTicketAddPhotoUploading}
                      onClick={() => addTicketCameraRef.current?.click()}
                    >
                      Сделать фото
                    </button>
                    <button
                      type="button"
                      className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn"
                      disabled={isTicketAddPhotoUploading}
                      onClick={() => addTicketGalleryRef.current?.click()}
                    >
                      Из галереи
                    </button>
                  </div>
                  {isTicketAddPhotoUploading && ticketAddPhotoProgress ? (
                    <div className="mobileMeta" style={{ marginTop: 10 }}>
                      Загружаем… {ticketAddPhotoProgress.current} из {ticketAddPhotoProgress.total}
                    </div>
                  ) : null}
                  {ticketAddPhotoError ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>{ticketAddPhotoError}</div> : null}
                </div>
              ) : null}
              {attachmentsQ.isLoading ? <div className="mobileMeta">Загрузка вложений…</div> : null}
              {attachmentsQ.isError ? (
                <div className="mobileNotice mobileNoticeError">
                  {formatMobileMutationError(attachmentsQ.error, { operation: 'attachments_list' })}
                </div>
              ) : null}
              {!attachmentsQ.isLoading && !attachmentsQ.isError ? (
                <>
                  <MobileTicketPhotoGallery
                    title="Фото заявки"
                    photos={requestImages}
                    emptyText="Нет фото"
                    onOpen={openRequestPhoto}
                  />
                  <div style={{ marginTop: 14 }}>
                    <MobileTicketPhotoGallery
                      title="Фото отчёта"
                      photos={reportImages}
                      emptyText="Нет фото отчёта"
                      onOpen={openReportPhoto}
                    />
                  </div>
                  {otherFiles.length > 0 ? (
                    <>
                      <div className="mobileSectionTitle" style={{ marginTop: 14, marginBottom: 8 }}>
                        Другие вложения
                      </div>
                      <ul className="mobileMeta" style={{ margin: 0, paddingLeft: 18 }}>
                        {otherFiles.map((a) => {
                          const href = api.resolveTicketAttachmentUrl(a)
                          return (
                            <li key={a.id} style={{ marginBottom: 6 }}>
                              {href ? (
                                <a href={href} target="_blank" rel="noreferrer">
                                  {mobileAttachmentLabel(a)}
                                </a>
                              ) : (
                                mobileAttachmentLabel(a)
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {/* ── Chat tab ─────────────────────────────────────── */}
          {detailTab === 'chat' ? (
            <div className="mobileCard mobileTicketChatCard">
              {/* Ticket info summary — first pinned message */}
              <div className="mobileChatsSystemRow" style={{ marginBottom: 8 }}>
                <div className="mobileChatsSystemPill" style={{ textAlign: 'left', maxWidth: '100%', padding: '10px 14px' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: '#374151' }}>
                    {mobileTicketNumberTitle(ticket.ticketNumber)} · {mobileTicketStatusLabelRu(ticket.status)}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 2 }}>{desc}</div>
                  {ticket.problemCategory?.name ? <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Категория: {ticket.problemCategory.name}</div> : null}
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Объект: {ticket.location?.name || ticket.pointName || '—'}</div>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                    Создана: {new Date(ticket.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              {timelineQ.isLoading ? <div className="mobileMeta">Загрузка…</div> : null}
              {!timelineQ.isLoading && chatMessages.length === 0 ? (
                <div className="mobileMeta" style={{ marginBottom: canSendComment ? 10 : 0 }}>Комментариев пока нет</div>
              ) : null}
              {chatMessages.length > 0 ? (
                <div className="mobileTicketChatMessages">
                  {chatMessages.map((msg) => {
                    if (msg.kind === 'system') {
                      return (
                        <div className="mobileChatsSystemRow" key={msg.id}>
                          <div className="mobileChatsSystemPill">
                            <div className="mobileChatsSystemText">{msg.text}</div>
                            <div className="mobileChatsSystemTime">{new Date(msg.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        </div>
                      )
                    }
                    const authorDisplay = msg.authorEmail ? msg.authorEmail.split('@')[0] : 'система'
                    const timeStr = new Date(msg.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    return (
                      <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.isOwn ? 'flex-end' : 'flex-start' }}>
                        <div className="mobileTicketChatAuthor" style={{ textAlign: msg.isOwn ? 'right' : 'left' }}>
                          {authorDisplay} · {timeStr}
                        </div>
                        <div style={{
                          maxWidth: '82%',
                          background: msg.isOwn ? '#4f46e5' : '#f3f4f6',
                          color: msg.isOwn ? '#fff' : '#111827',
                          borderRadius: msg.isOwn ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          padding: '9px 13px',
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                          fontSize: '0.9rem',
                          lineHeight: 1.5,
                        }}>
                          {msg.text}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
              {offlinePendingComments.length > 0 ? (
                <div className="mobileTicketChatMessages" style={{ marginTop: chatMessages.length > 0 ? 0 : undefined }}>
                  {offlinePendingComments.map((pending) => {
                    const timeStr = new Date(pending.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    return (
                      <div key={pending.queueId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', opacity: 0.65 }}>
                        <div className="mobileTicketChatAuthor" style={{ textAlign: 'right' }}>
                          я · {timeStr}
                        </div>
                        <div style={{
                          maxWidth: '82%',
                          background: '#4f46e5',
                          color: '#fff',
                          borderRadius: '14px 14px 4px 14px',
                          padding: '9px 13px',
                          wordBreak: 'break-word',
                          whiteSpace: 'pre-wrap',
                          fontSize: '0.9rem',
                          lineHeight: 1.5,
                        }}>
                          {pending.text}
                          <span className="mobileOfflinePendingBadge">Ожидает отправки</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
              {canSendComment ? (
                <div className="mobileTicketChatComposer">
                  <textarea
                    ref={chatInputRef}
                    className="mobileTicketChatInput"
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void handleChatSend() } }}
                    placeholder={isOnline ? 'Написать комментарий…' : 'Офлайн: сохранится в очередь…'}
                    disabled={chatSending}
                    rows={1}
                  />
                  <button
                    type="button"
                    className="mobileTicketChatSendButton"
                    aria-label="Отправить сообщение"
                    disabled={chatSending || !chatText.trim()}
                    onClick={() => void handleChatSend()}
                  >
                    {chatSending ? '…' : '→'}
                  </button>
                </div>
              ) : null}
              {!isOnline && canSendComment ? (
                <div className="mobileMeta" style={{ marginTop: 6 }}>Офлайн: комментарий будет отправлен после восстановления сети.</div>
              ) : null}
              {chatSendError ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 8 }}>{chatSendError}</div> : null}
            </div>
          ) : null}

          {/* ── Actions tab ──────────────────────────────────── */}
          {detailTab === 'actions' ? (
            <div>
              {canShowClientAcceptance ? (
                <div className="mobileCard mobileTicketOpsDock" style={{ marginBottom: 8 }}>
                  <div className="mobileSectionTitle" style={{ marginBottom: 8 }}>Приёмка работ</div>
                  <p className="mobileFieldHint" style={{ marginBottom: 10 }}>
                    Исполнитель отправил работу на приёмку. Примите её или отправьте на доработку с комментарием.
                  </p>
                  {acceptanceErr ? <div className="mobileNotice mobileNoticeError" style={{ marginBottom: 10 }}>{acceptanceErr}</div> : null}
                  <button
                    type="button"
                    className="mobileBtn mobileBtn--done"
                    style={{ width: '100%', minHeight: 48 }}
                    disabled={acceptM.isPending || rejectM.isPending || !isOnline}
                    onClick={() => { setAcceptanceErr(''); acceptM.mutate() }}
                  >
                    {acceptM.isPending ? 'Принимаем…' : 'Принять работу'}
                  </button>
                  <button
                    type="button"
                    className="mobileBtn mobileBtnSecondary"
                    style={{ width: '100%', marginTop: 8, minHeight: 48 }}
                    disabled={acceptM.isPending || rejectM.isPending || !isOnline}
                    onClick={() => {
                      if (!ticket) return
                      setAcceptanceErr('')
                      setRejectModal({ ticketId: ticket.id, title: `${mobileTicketNumberTitle(ticket.ticketNumber)} — ${mobileTicketCategoryLocationFromDetail(ticket)}`, file: null, previewUrl: '', comment: '', err: '' })
                    }}
                  >
                    Не принять работу
                  </button>
                </div>
              ) : null}
              {hasTechnicianActionsBlock ? (
                <div className="mobileCard mobileTicketOpsDock" style={{ marginBottom: 8 }}>
                  <div className="mobileSectionTitle" style={{ marginBottom: 8 }}>Действия по заявке</div>
                  {showAssignmentRequestAck ? (
                    <div className="mobileUxHintReason mobileUxHintReason--compact" role="status" style={{ marginBottom: 10 }}>
                      <div className="mobileUxHintReasonTitle">Запрос отправлен</div>
                      <div className="mobileUxHintReasonDetail">Диспетчер получил запрос на назначение. Повторно отправлять не нужно.</div>
                    </div>
                  ) : null}
                  {canShowAssignmentRequest ? (
                    (ticket.meta?.claimAvailabilityReason || '').trim() ? (
                      <MobileClaimReasonHintBox reason={ticket.meta?.claimAvailabilityReason} />
                    ) : (
                      <MobileBoardClaimFallbackHint />
                    )
                  ) : canShowTechClaimButton ? (
                    <div className="mobileFieldHint" style={{ marginBottom: 10 }}>
                      «Взять заявку» — если самовзятие разрешено политикой компании и вашим профилем.
                    </div>
                  ) : null}
                  {canShowTechClaimButton ? (
                    <button
                      type="button"
                      className="mobileBtn mobileBtn--claim"
                      style={{ width: '100%' }}
                      disabled={claimBtnPending || assignmentRequestM.isPending}
                      onClick={() => handleTechActionWithOfflineSupport('claim')}
                    >
                      {claimBtnPending ? 'Берём заявку…' : 'Взять заявку'}
                    </button>
                  ) : null}
                  {canShowAssignmentRequest || showAssignmentRequestAck ? (
                    <button
                      type="button"
                      className="mobileBtn mobileBtnSecondary"
                      style={{ width: '100%', marginTop: canShowTechClaimButton ? 8 : 0 }}
                      disabled={showAssignmentRequestAck || assignmentRequestM.isPending || techActionM.isPending}
                      onClick={() => { if (showAssignmentRequestAck) return; assignmentRequestM.mutate() }}
                    >
                      {showAssignmentRequestAck ? 'Запрос отправлен' : assignmentRequestM.isPending ? 'Отправляем запрос…' : 'Запросить назначение'}
                    </button>
                  ) : null}
                  {canShowTechStart ? (
                    <button
                      type="button"
                      className="mobileBtn mobileBtn--start"
                      style={{ width: '100%' }}
                      disabled={startBtnPending || assignmentRequestM.isPending}
                      onClick={() => handleTechActionWithOfflineSupport('start')}
                    >
                      {startBtnPending ? 'Начинаем…' : 'Начать работу'}
                    </button>
                  ) : null}
                  {assignmentRequestErr ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>{assignmentRequestErr}</div> : null}
                  {techActionErr ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>{techActionErr}</div> : null}
                  {canShowComplete ? (
                    <button
                      type="button"
                      className="mobileBtn mobileBtn--done"
                      style={{ width: '100%', marginTop: 8, minHeight: 48 }}
                      disabled={closeBusy || techActionM.isPending || assignmentRequestM.isPending || !isOnline}
                      onClick={() => {
                        if (!ticket) return
                        setCloseModal({ ticketId: ticket.id, title: `${mobileTicketNumberTitle(ticket.ticketNumber)} — ${mobileTicketCategoryLocationFromDetail(ticket)}`, file: null, previewUrl: '', comment: '', err: '' })
                      }}
                    >
                      Отправить на приёмку (фото отчёта)
                    </button>
                  ) : null}
                  {showCompleteBlockedHint ? (
                    <div className="mobileUxHintReason mobileUxHintReason--compact" role="status" style={{ marginTop: 10 }}>
                      <div className="mobileUxHintReasonTitle">Завершение недоступно</div>
                      <div className="mobileUxHintReasonDetail">
                        {(ticket.meta?.availableActionHints?.canComplete || '').trim() || 'Политика или отсутствие данных (комментарий, фото) не позволяют закрыть заявку из приложения.'}
                      </div>
                    </div>
                  ) : null}
                  {showSelfAssignButton ? (
                    <button
                      type="button"
                      className="mobileBtn mobileBtn--claim"
                      style={{ width: '100%', marginTop: 8 }}
                      disabled={assignBusy}
                      onClick={() => { if (!meQ.data?.id) return; assignM.mutate({ technicianId: meQ.data.id }) }}
                    >
                      {assignBusy ? 'Берём заявку…' : 'Взять заявку себе'}
                    </button>
                  ) : null}
                  {showAssignButton ? (
                    <button
                      type="button"
                      className="mobileBtn mobileBtnSecondary"
                      style={{ width: '100%', marginTop: 8 }}
                      onClick={() => { setAssignErr(''); setAssignTicketOpen(true) }}
                    >
                      Назначить исполнителя
                    </button>
                  ) : null}
                </div>
              ) : null}
              {!canShowClientAcceptance && !hasTechnicianActionsBlock ? (
                <div className="mobileCard mobileEmptyState" role="status">
                  <div className="mobileEmptyStateTitle">Нет доступных действий</div>
                  <p className="mobileEmptyStateHint">В текущем статусе заявки нет действий для вашей роли.</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {requestPhotoIndex !== null && requestPhotoItems.length > 0 ? (
        <FullscreenPhotoViewer
          items={requestPhotoItems}
          initialIndex={requestPhotoIndex}
          onClose={() => setRequestPhotoIndex(null)}
        />
      ) : null}
      {reportPhotoIndex !== null && reportPhotoItems.length > 0 ? (
        <FullscreenPhotoViewer
          items={reportPhotoItems}
          initialIndex={reportPhotoIndex}
          onClose={() => setReportPhotoIndex(null)}
        />
      ) : null}

      {assignTicketOpen && ticket ? (
        <MobileModalBackdrop
          ariaLabel="Назначить исполнителя"
          onClose={() => {
            if (assignBusy) return
            setAssignTicketOpen(false)
            setAssignErr('')
          }}
        >
          <div className="mobileAssignModal">
            <div className="mobileRow" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 900 }}>Назначить исполнителя</div>
                <div className="mobileMeta" style={{ marginTop: 4 }}>
                  {mobileTicketNumberTitle(ticket.ticketNumber)}
                </div>
              </div>
              <button
                type="button"
                className="mobileBtn mobileBtnSecondary"
                disabled={assignBusy}
                onClick={() => {
                  setAssignTicketOpen(false)
                  setAssignErr('')
                }}
              >
                Отмена
              </button>
            </div>
            {assignCandidatesQ.isLoading ? (
              <div className="mobileMeta" style={{ marginTop: 12 }}>
                Загружаем список техников…
              </div>
            ) : null}
            {assignCandidatesQ.isError ? (
              <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>
                {formatMobileMutationError(assignCandidatesQ.error, { operation: 'assign_candidates' })}
              </div>
            ) : null}
            {assignErr ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>{assignErr}</div> : null}
            {assignCandidatesQ.data && assignTechOptions.length > 0 ? (
              <div className="mobileForm" style={{ marginTop: 12 }}>
                <label className="mobileFormFieldAfterPhoto">
                  Техник
                  <select value={assignTechId} disabled={assignBusy} onChange={(e) => setAssignTechId(e.target.value)}>
                    {assignTechOptions.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.email}
                        {row.matched ? ' · рекомендован' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mobileFormSubmitStack" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="mobileBtn mobileAssignModalConfirm"
                    disabled={!assignTechId || assignBusy || assignCandidatesQ.isLoading}
                    onClick={() => assignM.mutate({ technicianId: assignTechId })}
                  >
                    {assignBusy ? 'Назначаем…' : 'Назначить'}
                  </button>
                </div>
              </div>
            ) : null}
            {!assignCandidatesQ.isLoading && assignCandidatesQ.data && assignTechOptions.length === 0 ? (
              <div className="mobileMeta" style={{ marginTop: 12 }}>
                Нет доступных техников для назначения.
              </div>
            ) : null}
          </div>
        </MobileModalBackdrop>
      ) : null}
      {assignmentRequestToast || operationalToast || offlineQueuedNotice ? (
        <div
          className="mobileToastHost mobileToastHost--stack"
          role="status"
        >
          {offlineQueuedNotice ? <div className="mobileToast">{offlineQueuedNotice}</div> : null}
          {assignmentRequestToast ? <div className="mobileToast">{assignmentRequestToast}</div> : null}
          {operationalToast ? <div className="mobileToast">{operationalToast}</div> : null}
        </div>
      ) : null}

      <TicketCloseModal
        closeModal={closeModal}
        closeBusy={closeBusy}
        closeCameraInputRef={closeModalCameraRef}
        closeGalleryInputRef={closeModalGalleryRef}
        setCloseModal={setCloseModal}
        closeCanSubmit={closeCanSubmit}
        closeM={closeM}
        heading="Отправить на приёмку"
        submitLabel="Отправить на приёмку"
        submitBusyLabel="Отправляем…"
      />
      <ClientAcceptanceRejectModal
        state={rejectModal}
        busy={rejectM.isPending}
        cameraInputRef={rejectCameraRef}
        galleryInputRef={rejectGalleryRef}
        setState={setRejectModal}
        canSubmit={rejectCanSubmit}
        onSubmit={() => rejectM.mutate()}
      />
    </div>
  )
}
