import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import {
  mobileTicketCategoryLocationFromDetail,
  mobileTicketDetailGetOneScopes,
  mobileTicketNavState,
  mobileTicketNumberTitle,
  mobileTicketPriorityIsUrgent,
  mobileTicketSlaCountdownLabel,
  mobileTicketStatusLabelRu,
  type MobileTicketListOrigin,
  type MobileTicketNavState,
} from './mobileTicketDisplay'
import {
  MOBILE_HOME_BOARD_CHIP_LABELS,
  MOBILE_HOME_TAB_LABELS,
  type MobileHomeBoardChipId,
} from './mobileHomeBoardFilters'
import {
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
import { MobileAttachmentThumb, mobileAttachmentLabel } from './MobileAttachmentThumb'
import { MobilePhotoLightbox } from './MobilePhotoLightbox'
import { toChatMessages } from '../lib/ticketChat'

function readListOrigin(location: ReturnType<typeof useLocation>): MobileTicketListOrigin {
  const raw = (location.state as MobileTicketNavState | null)?.mobileListOrigin
  if (raw === 'my') return 'my'
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

  const observerCompanyId = useMemo(
    () => (searchParams.get('companyId') || api.getObserverCompanyId(meQ.data)).trim(),
    [searchParams, meQ.data],
  )

  const linkedClientCompanyId = useMemo(() => {
    const q = (searchParams.get('linkedClientCompanyId') || '').trim()
    if (q) return q
    const fromNav = (navState?.ticketOwnerCompanyId || '').trim()
    if (fromNav) return fromNav
    return (api.getLinkedClientCompanyId(meQ.data) || '').trim()
  }, [searchParams, navState?.ticketOwnerCompanyId, meQ.data])

  const ticketOwnerNav = (navState?.ticketOwnerCompanyId || '').trim()

  const scopeNorm = useMemo<api.TicketScopeParams>(
    () => ({
      companyId: observerCompanyId || undefined,
      linkedClientCompanyId: linkedClientCompanyId || undefined,
    }),
    [observerCompanyId, linkedClientCompanyId],
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
      linkedClientCompanyId,
      ticketOwnerNav,
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
        stateTicketOwnerCompanyId: ticketOwnerNav,
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

  const inferredLinkedClientCompanyId = useMemo(() => {
    if (linkedClientCompanyId) return linkedClientCompanyId
    if (ticketQ.data?.meta?.visibilityMode === 'provider_primary') {
      return (ticketQ.data.meta.scopeCompanyId || '').trim()
    }
    return ''
  }, [linkedClientCompanyId, ticketQ.data?.meta?.visibilityMode, ticketQ.data?.meta?.scopeCompanyId])

  const effectiveTicketScope = useMemo<api.TicketScopeParams>(
    () => ({
      companyId: observerCompanyId || undefined,
      linkedClientCompanyId: inferredLinkedClientCompanyId || undefined,
    }),
    [observerCompanyId, inferredLinkedClientCompanyId],
  )

  const canUploadTicketPhotos = useMemo(() => {
    const role = meQ.data?.role
    const isClientRole = role === 'CLIENT'
    const contextMode = observerCompanyId ? 'observer' : inferredLinkedClientCompanyId ? 'provider' : 'tenant'
    const readOnlyByVisibilityMode = contextMode === 'observer'
    const canMutateTicket = !readOnlyByVisibilityMode && !(isClientRole && contextMode !== 'tenant')
    return canMutateTicket && roleCanUploadTicketPhoto(role)
  }, [meQ.data?.role, observerCompanyId, inferredLinkedClientCompanyId])

  const canSendComment = useMemo(() => {
    const role = meQ.data?.role
    if (!role) return false
    const isClientRole = role === 'CLIENT'
    const contextMode = observerCompanyId ? 'observer' : inferredLinkedClientCompanyId ? 'provider' : 'tenant'
    return contextMode !== 'observer' && !(isClientRole && contextMode !== 'tenant')
  }, [meQ.data?.role, observerCompanyId, inferredLinkedClientCompanyId])

  /**
   * Claim / status / assign на linked-client заявке: query `linkedClientCompanyId` должен совпадать
   * с tenant заявки (`ticket.companyId`). Иначе бэкенд сужает operational scope до «чужого» клиента и claim даёт 404.
   */
  const ticketMutationScope = useMemo<api.TicketScopeParams>(() => {
    const base: api.TicketScopeParams = {
      companyId: observerCompanyId || undefined,
      linkedClientCompanyId: inferredLinkedClientCompanyId || undefined,
    }
    const t = ticketQ.data
    if (!t || meQ.data?.role !== 'TECHNICIAN') return base
    const meCo = (meQ.data.companyId || '').trim()
    const tCo = (t.companyId || '').trim()
    if (!meCo || !tCo || tCo === meCo) return base
    return {
      ...base,
      linkedClientCompanyId: tCo,
    }
  }, [observerCompanyId, inferredLinkedClientCompanyId, ticketQ.data, meQ.data?.role, meQ.data?.companyId])

  const attachmentsQ = useQuery({
    enabled: !!ticketId && !!ticketQ.data,
    queryKey: ['mobile-ticket-attachments', ticketId, observerCompanyId, inferredLinkedClientCompanyId],
    queryFn: async () => {
      if (!getOnlineStatus()) {
        const cached = loadTicketDetailCache(ticketId, scopeNorm) ?? loadAnyTicketDetailCache(ticketId)
        if (cached?.data) return cached.data.attachments
        throw new Error('Нет сохранённых вложений для офлайна.')
      }
      return api.ticketAttachments(ticketId, effectiveTicketScope)
    },
  })

  const timelineQ = useQuery({
    enabled: !!ticketId && !!ticketQ.data,
    queryKey: ['mobile-ticket-timeline', ticketId, observerCompanyId, inferredLinkedClientCompanyId],
    queryFn: async () => {
      if (!getOnlineStatus()) {
        const cached = loadTicketDetailCache(ticketId, scopeNorm) ?? loadAnyTicketDetailCache(ticketId)
        if (cached?.data) return cached.data.timeline ?? null
        throw new Error('Нет сохранённой истории для офлайна.')
      }
      return api.timeline(ticketId, effectiveTicketScope)
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
      scope: effectiveTicketScope,
      ticket: ticketQ.data,
      attachments: attachmentsQ.data ?? [],
      timeline: timelineQ.data ?? null,
    })
  }, [
    ticketId,
    effectiveTicketScope.companyId,
    effectiveTicketScope.linkedClientCompanyId,
    ticketQ.isSuccess,
    ticketQ.data,
    attachmentsQ.isSuccess,
    attachmentsQ.data,
    timelineQ.isFetched,
    timelineQ.isError,
    timelineQ.data,
  ])

  const ticket = ticketQ.data
  const canAssignProvider = api.isProviderTicketAssignRole(meQ.data?.role)
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
  const canShowTechStart =
    meQ.data?.role === 'TECHNICIAN' && !!ticket && (aa ? aa.canStart : techPrimary === 'start')
  const assigneeIdForMe =
    ticket && meQ.data?.id ? (ticket.assignedTechnicianId || ticket.assignedTechnician?.id || '').trim() : ''
  const canShowComplete =
    meQ.data?.role === 'TECHNICIAN' &&
    !!ticket &&
    ticket.status === 'IN_PROGRESS' &&
    assigneeIdForMe === meQ.data.id &&
    (aa ? aa.canComplete : transitions.includes('DONE'))

  const [assignTicketOpen, setAssignTicketOpen] = useState(false)
  const [assignTechId, setAssignTechId] = useState('')
  const [assignErr, setAssignErr] = useState('')
  const [techActionErr, setTechActionErr] = useState('')
  const [assignmentRequestErr, setAssignmentRequestErr] = useState('')
  const [assignmentRequestToast, setAssignmentRequestToast] = useState('')
  const [photoPreview, setPhotoPreview] = useState<{ src: string; alt: string } | null>(null)
  const [chatText, setChatText] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [chatSendError, setChatSendError] = useState<string | null>(null)
  const addTicketCameraRef = useRef<HTMLInputElement | null>(null)
  const addTicketGalleryRef = useRef<HTMLInputElement | null>(null)
  const [ticketAddPhotoError, setTicketAddPhotoError] = useState<string | null>(null)
  const [ticketAddPhotoProgress, setTicketAddPhotoProgress] = useState<{ current: number; total: number } | null>(null)

  const assignCandidatesQ = useQuery({
    queryKey: [
      'mobile-ticket-assign-candidates',
      ticketId,
      observerCompanyId,
      ticketMutationScope.linkedClientCompanyId,
      ticketMutationScope.companyId,
    ],
    queryFn: () => api.assignmentCandidates(ticketId, ticketMutationScope),
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
        await api.uploadTicketAttachment(ticketId, files[i], effectiveTicketScope)
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

  const techActionM = useMutation({
    mutationFn: async (mode: 'claim' | 'start') => {
      if (!ticket) throw new Error('Нет заявки')
      if (mode === 'claim') await api.claimTicket(ticket.id, ticketMutationScope)
      else await api.updateTicketStatus(ticket.id, { status: 'IN_PROGRESS' }, ticketMutationScope)
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
      return api.requestTicketAssignment(ticket.id, ticketMutationScope)
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
      await api.assignTicket(ticketId, params.technicianId, ticketMutationScope)
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
      await api.uploadTicketAttachment(closeModal.ticketId, closeModal.file, ticketMutationScope)
      await api.addTicketComment(closeModal.ticketId, comment, ticketMutationScope)
      await api.updateTicketStatus(closeModal.ticketId, { status: 'DONE' }, ticketMutationScope)
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
      setOperationalToast('Заявка завершена.')
    },
    onError: (e: unknown) => {
      setCloseModal((prev) => (prev ? { ...prev, err: formatMobileMutationError(e, { operation: 'close' }) } : prev))
    },
  })

  const listOrigin = readListOrigin(location)
  const backPath = listOrigin === 'my' ? mobilePath(location.pathname, '/my') : mobilePath(location.pathname, '')
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

  const timelineItems = timelineQ.data?.timeline || timelineQ.data?.items || []
  const chatMessages = useMemo(() => toChatMessages(timelineItems, meQ.data?.id ?? ''), [timelineItems, meQ.data?.id])

  const requestImages = useMemo(() => {
    const imgs = (attachmentsQ.data || []).filter(isImageAttachment)
    return imgs.filter((a) => !isReportTicketImage(a))
  }, [attachmentsQ.data])

  const reportImages = useMemo(() => {
    const imgs = (attachmentsQ.data || []).filter(isImageAttachment)
    return imgs.filter((a) => isReportTicketImage(a))
  }, [attachmentsQ.data])

  const otherFiles = useMemo(() => (attachmentsQ.data || []).filter((a) => !isImageAttachment(a)), [attachmentsQ.data])

  const executorLine = ticket
    ? (ticket.assignedTechnician?.email || '').trim() || 'Не назначен'
    : '—'

  const showAssignButton =
    !!ticket &&
    canAssignProvider &&
    ticket.status === 'NEW' &&
    !ticket.assignedTechnicianId &&
    !ticket.assignedTechnician

  const claimBtnPending = techActionM.isPending && techActionM.variables === 'claim'
  const startBtnPending = techActionM.isPending && techActionM.variables === 'start'
  const assignBusy = assignM.isPending
  const closeBusy = closeM.isPending
  const closeCanSubmit = !!closeModal?.file && closeModal.comment.trim().length >= 3 && !closeBusy

  const showCompleteBlockedHint =
    meQ.data?.role === 'TECHNICIAN' &&
    !!ticket &&
    ticket.status === 'IN_PROGRESS' &&
    assigneeIdForMe === meQ.data.id &&
    !canShowComplete

  const hasTechnicianActionsBlock =
    canShowTechClaimButton ||
    canShowAssignmentRequest ||
    showAssignmentRequestAck ||
    canShowTechStart ||
    showAssignButton ||
    canShowComplete ||
    showCompleteBlockedHint
  const showTechnicianNoActionsHint =
    meQ.data?.role === 'TECHNICIAN' &&
    !!ticket &&
    ticket.status !== 'DONE' &&
    ticket.status !== 'CANCELED' &&
    !hasTechnicianActionsBlock

  const padBottomForOpsDock = hasTechnicianActionsBlock

  async function handleChatSend() {
    const trimmed = chatText.trim()
    if (!trimmed || chatSending) return
    if (!isOnline) { setChatSendError('Нет подключения к сети'); return }
    setChatSendError(null)
    setChatSending(true)
    try {
      await api.addTicketComment(ticketId, trimmed, effectiveTicketScope)
      setChatText('')
      await queryClient.invalidateQueries({ queryKey: ['mobile-ticket-timeline', ticketId] })
    } catch (e: unknown) {
      setChatSendError(formatMobileMutationError(e, { operation: 'other' }))
    } finally {
      setChatSending(false)
    }
  }

  return (
    <div className={`mobileSection mobileTicketDetailsRoot${padBottomForOpsDock ? ' mobileTicketDetailsRoot--opsDock' : ''}`}>
      <div className="mobileTicketDetailsToolbar">
        <Link
          to={backHref}
          state={(location.state as MobileTicketNavState | null | undefined) ?? undefined}
          className="mobileDetailsBackLink"
        >
          Назад
        </Link>
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
            <div className="mobileTicketDetailsHeadline">{mobileTicketNumberTitle(ticket.ticketNumber)}</div>
            <div className="mobileRow" style={{ marginTop: 8 }}>
              <span className="mobileMeta">ID</span>
              <span style={{ fontSize: '0.78rem', textAlign: 'right', wordBreak: 'break-all' }}>{ticket.id}</span>
            </div>
            <div className="mobileMeta" style={{ marginTop: 8 }}>
              {mobileTicketCategoryLocationFromDetail(ticket)}
            </div>
            <div className="mobileRow" style={{ marginTop: 12 }}>
              <span className="mobileMeta">Статус</span>
              <span className={`mobileTicketStatus mobileTicketStatus--${ticket.status}`}>{mobileTicketStatusLabelRu(ticket.status)}</span>
            </div>
            <div style={{ marginTop: 10 }}>
              <div className="mobileMeta" style={{ marginBottom: 4 }}>
                SLA
              </div>
              <div style={{ fontSize: '0.92rem', lineHeight: 1.5 }}>
                {mobileTicketPriorityIsUrgent(ticket.priority ?? 'NORMAL') ? (
                  <span className="mobileSlaUrgentPill" style={{ marginRight: 8 }}>
                    Срочно
                  </span>
                ) : null}
                <span>Приоритет: {ticket.priority === 'URGENT' ? 'срочный ответ (2 ч)' : 'обычный (24 ч)'}</span>
                {ticket.slaDueAt ? (
                  <div style={{ marginTop: 6 }}>
                    Дедлайн:{' '}
                    {new Date(ticket.slaDueAt).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                ) : null}
                {(() => {
                  const line = mobileTicketSlaCountdownLabel({
                    slaDueAt: ticket.slaDueAt,
                    slaBreached: !!ticket.slaBreachedAt || (ticket.slaDueAt ? Date.now() > new Date(ticket.slaDueAt).getTime() : false),
                    status: ticket.status,
                  })
                  return line ? <div style={{ marginTop: 4 }}>{line}</div> : null
                })()}
              </div>
            </div>
            <div className="mobileRow" style={{ marginTop: 10 }}>
              <span className="mobileMeta">Категория</span>
              <strong style={{ textAlign: 'right', fontSize: '0.9rem' }}>{ticket.problemCategory?.name || '—'}</strong>
            </div>
            {shouldShowClientTicketLifecycleHint(meQ.data, ticket) && ticket.problemCategory?.name ? (
              <CategoryGuidancePanel categoryName={ticket.problemCategory.name} variant="mobile" />
            ) : null}
            <div style={{ marginTop: 10 }}>
              <div className="mobileMeta" style={{ marginBottom: 4 }}>
                Локация / адрес
              </div>
              <div style={{ fontSize: '0.95rem', lineHeight: 1.45 }}>{formatAddressBlock(ticket)}</div>
            </div>
            <div className="mobileRow" style={{ marginTop: 12 }}>
              <span className="mobileMeta">Исполнитель</span>
              <strong style={{ textAlign: 'right', fontSize: '0.9rem' }}>{executorLine}</strong>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="mobileMeta" style={{ marginBottom: 6 }}>
                Описание
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem', lineHeight: 1.45 }}>{desc}</div>
            </div>
          </div>

          {hasTechnicianActionsBlock ? (
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
                  onClick={() => techActionM.mutate('claim')}
                >
                  {claimBtnPending ? 'Берём заявку…' : 'Взять заявку'}
                </button>
              ) : null}
              {canShowAssignmentRequest || showAssignmentRequestAck ? (
                <button
                  type="button"
                  className="mobileBtn mobileBtnSecondary"
                  style={{ width: '100%', marginTop: canShowTechClaimButton ? 8 : 0 }}
                  disabled={
                    showAssignmentRequestAck || assignmentRequestM.isPending || techActionM.isPending
                  }
                  onClick={() => {
                    if (showAssignmentRequestAck) return
                    assignmentRequestM.mutate()
                  }}
                >
                  {showAssignmentRequestAck
                    ? 'Запрос отправлен'
                    : assignmentRequestM.isPending
                      ? 'Отправляем запрос…'
                      : 'Запросить назначение'}
                </button>
              ) : null}
              {canShowTechStart ? (
                <button
                  type="button"
                  className="mobileBtn mobileBtn--start"
                  style={{ width: '100%' }}
                  disabled={startBtnPending || assignmentRequestM.isPending}
                  onClick={() => techActionM.mutate('start')}
                >
                  {startBtnPending ? 'Начинаем…' : 'Начать работу'}
                </button>
              ) : null}
              {assignmentRequestErr ? (
                <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>
                  {assignmentRequestErr}
                </div>
              ) : null}
              {techActionErr ? (
                <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>
                  {techActionErr}
                </div>
              ) : null}
              {canShowComplete ? (
                <button
                  type="button"
                  className="mobileBtn mobileBtn--done"
                  style={{ width: '100%', marginTop: 8, minHeight: 48 }}
                  disabled={closeBusy || techActionM.isPending || assignmentRequestM.isPending || !isOnline}
                  onClick={() => {
                    if (!ticket) return
                    setCloseModal({
                      ticketId: ticket.id,
                      title: `${mobileTicketNumberTitle(ticket.ticketNumber)} — ${mobileTicketCategoryLocationFromDetail(ticket)}`,
                      file: null,
                      previewUrl: '',
                      comment: '',
                      err: '',
                    })
                  }}
                >
                  Завершить работу (фото отчёта)
                </button>
              ) : null}
              {showCompleteBlockedHint ? (
                <div className="mobileUxHintReason mobileUxHintReason--compact" role="status" style={{ marginTop: 10 }}>
                  <div className="mobileUxHintReasonTitle">Завершение недоступно</div>
                  <div className="mobileUxHintReasonDetail">
                    {(ticket.meta?.availableActionHints?.canComplete || '').trim() ||
                      'Политика или отсутствие данных (комментарий, фото) не позволяют закрыть заявку из приложения.'}
                  </div>
                </div>
              ) : null}
              {showAssignButton ? (
                <button
                  type="button"
                  className="mobileBtn mobileBtnSecondary"
                  style={{ width: '100%', marginTop: techPrimary ? 8 : 0 }}
                  onClick={() => {
                    setAssignErr('')
                    setAssignTicketOpen(true)
                  }}
                >
                  Назначить исполнителя
                </button>
              ) : null}
            </div>
          ) : null}

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

          <div className="mobileCard" style={{ marginTop: 8 }}>
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
                <div className="mobileSectionTitle" style={{ marginBottom: 8 }}>
                  Фото заявки
                </div>
                {requestImages.length === 0 ? (
                  <div className="mobileMeta">Нет фото</div>
                ) : (
                  <div className="mobilePhotoGrid">
                    {requestImages.map((a) => (
                      <MobileAttachmentThumb key={a.id} attachment={a} onOpenPreview={setPhotoPreview} />
                    ))}
                  </div>
                )}
                <div className="mobileSectionTitle" style={{ marginTop: 14, marginBottom: 8 }}>
                  Фото отчёта
                </div>
                {reportImages.length === 0 ? (
                  <div className="mobileMeta">Нет фото отчёта</div>
                ) : (
                  <div className="mobilePhotoGrid">
                    {reportImages.map((a) => (
                      <MobileAttachmentThumb key={a.id} attachment={a} onOpenPreview={setPhotoPreview} />
                    ))}
                  </div>
                )}
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

          <div className="mobileCard" style={{ marginTop: 8 }}>
            <div className="mobileSectionTitle" style={{ marginBottom: 8 }}>Чат заявки</div>
            {timelineQ.isLoading ? <div className="mobileMeta">Загрузка…</div> : null}
            {!timelineQ.isLoading && chatMessages.length === 0 ? (
              <div className="mobileMeta" style={{ marginBottom: canSendComment ? 10 : 0 }}>Комментариев пока нет</div>
            ) : null}
            {chatMessages.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 4, marginBottom: 10 }}>
                {chatMessages.map((msg) => (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.isOwn ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '82%',
                      background: msg.isOwn ? '#4f46e5' : '#f3f4f6',
                      color: msg.isOwn ? '#fff' : '#111827',
                      borderRadius: msg.isOwn ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      padding: '8px 12px',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.92rem',
                    }}>
                      {msg.text}
                    </div>
                    <div className="mobileMeta" style={{ marginTop: 2, fontSize: '0.72rem' }}>
                      {msg.authorEmail || 'система'} · {new Date(msg.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {canSendComment ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <textarea
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void handleChatSend() } }}
                  placeholder="Написать комментарий…"
                  disabled={chatSending}
                  rows={2}
                  style={{ flex: 1, resize: 'none', borderRadius: 10, border: '1px solid #e5e7eb', padding: '8px 10px', fontSize: '0.92rem', fontFamily: 'inherit' }}
                />
                <button
                  type="button"
                  className="mobileBtn"
                  style={{ alignSelf: 'flex-end', flexShrink: 0, padding: '8px 14px', minHeight: 44 }}
                  disabled={chatSending || !chatText.trim()}
                  onClick={() => void handleChatSend()}
                >
                  {chatSending ? '…' : '→'}
                </button>
              </div>
            ) : null}
            {chatSendError ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 8 }}>{chatSendError}</div> : null}
          </div>

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
                      [navState?.ticketOwnerCompanyId, ticketCompanyId, inferredLinkedClientCompanyId, linkedClientCompanyId]
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

      <MobilePhotoLightbox preview={photoPreview} onClose={() => setPhotoPreview(null)} />

      {assignTicketOpen && ticket ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(17, 24, 39, 0.55)',
            zIndex: 62,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 12,
          }}
        >
          <div className="mobileCard" style={{ width: '100%', maxWidth: 720, marginBottom: 12 }}>
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
                    className="mobileBtn"
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
        </div>
      ) : null}
      {assignmentRequestToast || operationalToast ? (
        <div
          className={`mobileToastHost${assignmentRequestToast && operationalToast ? ' mobileToastHost--stack' : ''}`}
          role="status"
        >
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
      />
    </div>
  )
}
