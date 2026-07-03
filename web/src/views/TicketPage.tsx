import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import { mapReason } from '../lib/assignmentExplain'
import {
  clientTicketLifecycleHintText,
  shouldShowClientTicketLifecycleHint,
} from '../lib/ticketClientGuidance'
import { TicketHeader } from './ticket-page/TicketHeader'
import {
  sanitizeBoardNavigationContext,
  type BoardTicketNavState,
} from '../lib/boardNavigationContext'
import { pushToast } from '../lib/appToast'
import { logTicketActionError, mapTicketActionError } from '../lib/ticketOperationalErrors'
import { computePrimaryTicketAction } from '../lib/ticketOperationalModel'
import { toChatMessages } from '../lib/ticketChat'
import { resolveAdminProfile } from '../lib/resolveAdminProfile'
import {
  TicketActionsPanel,
  TicketChatPanel,
  TicketChildTicketsPanel,
  TicketContextPanel,
  TicketPhotosPanel,
  TicketSlaPanel,
  TicketSummaryPanel,
  TicketTimelinePanel,
} from '../components/ticket-card-v2'

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

const MANAGEMENT_ROLES: api.Role[] = ['ADMIN', 'ADMIN_PROVIDER', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR']
// SMA-ACCEPTANCE-ROLE-GAP-001: CLIENT requester can create/comment/photo but cannot edit.
const EDIT_ROLES: api.Role[] = ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR', 'TERRITORIAL_MANAGER']
const STATUS_CHANGE_ROLES: api.Role[] = ['ADMIN', 'ADMIN_PROVIDER', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR', 'TECHNICIAN']
const PHOTO_ROLES: api.Role[] = ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR', 'TECHNICIAN', 'CLIENT', 'TERRITORIAL_MANAGER']
const CHILD_CREATE_ROLES: api.Role[] = ['ADMIN', 'MASTER', 'DISPATCHER']

function fmt(dt?: string | null) {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString('ru-RU')
  } catch {
    return dt
  }
}

function fmtBytes(v?: number | null) {
  if (!v || v <= 0) return '—'
  if (v < 1024) return `${v} Б`
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} КБ`
  return `${(v / (1024 * 1024)).toFixed(1)} МБ`
}

function statusLabel(status: api.TicketStatus) {
  if (status === 'NEW') return 'Новая'
  if (status === 'ASSIGNED') return 'Назначена'
  if (status === 'IN_PROGRESS') return 'В работе'
  if (status === 'AWAITING_ACCEPTANCE') return 'Ожидает приёмки'
  if (status === 'DONE') return 'Завершена'
  if (status === 'CANCELED') return 'Отменена'
  return status
}

function sourceLabel(source: api.TimelineItem['source']) {
  if (source === 'history' || source === 'status_history') return 'История статусов'
  if (source === 'event' || source === 'domain_event') return 'Событие системы'
  return source
}

function timelineTypeLabel(type: string) {
  if (type === 'ticket.sla_warning') return 'Предупреждение SLA'
  if (type === 'ticket.sla_breached') return 'Нарушение SLA'
  return type
}

function roleCanAssign(role?: api.Role | null) {
  return !!role && MANAGEMENT_ROLES.includes(role)
}

function roleCanEdit(role?: api.Role | null) {
  return !!role && EDIT_ROLES.includes(role)
}

function roleCanChangeStatus(role?: api.Role | null) {
  return !!role && STATUS_CHANGE_ROLES.includes(role)
}

function roleCanUploadPhoto(role?: api.Role | null) {
  return !!role && PHOTO_ROLES.includes(role)
}

function roleCanCreateChildTicket(role?: api.Role | null) {
  return !!role && CHILD_CREATE_ROLES.includes(role)
}

function canUseAdminManagementActions(profile?: ReturnType<typeof resolveAdminProfile> | null) {
  if (!profile) return false
  if (profile.backendRole !== 'ADMIN') return false
  return profile.profile !== 'CLIENT_ADMIN'
}

function StatusPill({ status }: { status: api.TicketStatus }) {
  const style: Record<string, string | number> = {
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1,
    border: '1px solid #d1d5db',
    background: '#f3f4f6',
    color: '#111827',
    minWidth: 110,
    textAlign: 'center',
  }

  if (status === 'NEW') Object.assign(style, { background: '#eef2ff', borderColor: '#c7d2fe', color: '#3730a3' })
  if (status === 'ASSIGNED') Object.assign(style, { background: '#ecfeff', borderColor: '#a5f3fc', color: '#155e75' })
  if (status === 'IN_PROGRESS') Object.assign(style, { background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' })
  if (status === 'AWAITING_ACCEPTANCE') Object.assign(style, { background: '#fff7ed', borderColor: '#fdba74', color: '#9a3412' })
  if (status === 'DONE') Object.assign(style, { background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' })
  if (status === 'CANCELED') Object.assign(style, { background: '#f3f4f6', borderColor: '#e5e7eb', color: '#6b7280' })

  return <span className="uiStatusBadge" style={style}>{statusLabel(status)}</span>
}

function Skeleton({ w, h }: { w: number | string; h: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 10,
        background: '#eef2ff',
        border: '1px solid #e6e8f0',
      }}
    />
  )
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        borderRadius: 999,
        border: '1px solid #e5e7eb',
        background: '#f9fafb',
        fontSize: 12,
      }}
    >
      {children}
    </span>
  )
}

function RecommendationBadge({ matched, matchedBy }: { matched: boolean; matchedBy: string[] }) {
  if (matched) {
    return <span className="uxBadge uxBadgeSuccess">Подходит{matchedBy.length ? `: ${matchedBy.join(', ')}` : ''}</span>
  }

  return <span className="uxBadge uxBadgeWarn">Не подходит по специализациям</span>
}

function InlineError({ message }: { message?: string | null }) {
  if (!message) return null
  return <div className="alert" style={{ marginTop: 10 }}>{message}</div>
}

export function TicketPage() {
  const { id } = useParams()
  const ticketId = id || ''
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const operationalFileInputRef = useRef<HTMLInputElement | null>(null)
  const acceptanceFileInputRef = useRef<HTMLInputElement | null>(null)

  const observerCompanyId = (searchParams.get('companyId') || api.getObserverCompanyId()).trim()
  const linkedClientCompanyId = (searchParams.get('linkedClientCompanyId') || api.getLinkedClientCompanyId()).trim()
  const [autoLinkedClientCompanyId, setAutoLinkedClientCompanyId] = useState('')
  const effectiveLinkedClientCompanyId = linkedClientCompanyId || autoLinkedClientCompanyId

  const baseTicketScope = useMemo<api.TicketScopeParams>(
    () => ({
      companyId: observerCompanyId || undefined,
      linkedClientCompanyId: effectiveLinkedClientCompanyId || undefined,
    }),
    [observerCompanyId, effectiveLinkedClientCompanyId],
  )

  const contextMode = observerCompanyId ? 'observer' : effectiveLinkedClientCompanyId ? 'provider' : 'tenant'

  const [editOpen, setEditOpen] = useState(false)
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [acceptanceFile, setAcceptanceFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [acceptanceFileError, setAcceptanceFileError] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deleteAttachmentError, setDeleteAttachmentError] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [showFullTimeline, setShowFullTimeline] = useState(false)
  const [showAssignmentEditor, setShowAssignmentEditor] = useState(false)
  const [showChildCreateForm, setShowChildCreateForm] = useState(false)
  const [showSubmitToAcceptanceForm, setShowSubmitToAcceptanceForm] = useState(false)

  const [editProblemCategoryId, setEditProblemCategoryId] = useState('')
  const [editLocationId, setEditLocationId] = useState('')
  const [editProblemText, setEditProblemText] = useState('')
  const [editEquipmentId, setEditEquipmentId] = useState('')
  const [editUrgency, setEditUrgency] = useState<api.TicketUrgency>('NOT_URGENT')
  const [editRequesterName, setEditRequesterName] = useState('')
  const [editRequesterPhone, setEditRequesterPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editPointName, setEditPointName] = useState('')
  const [editComment, setEditComment] = useState('')
  const [newComment, setNewComment] = useState('')
  const [acceptanceComment, setAcceptanceComment] = useState('')
  const [closeReportComment, setCloseReportComment] = useState('')
  const [childCategoryId, setChildCategoryId] = useState('')
  const [childProblemText, setChildProblemText] = useState('')
  const [childUrgency, setChildUrgency] = useState<api.TicketUrgency>('NOT_URGENT')
  const [childCreateError, setChildCreateError] = useState<string | null>(null)

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const backToBoardHref = useMemo(() => {
    if (observerCompanyId) return `/board?companyId=${observerCompanyId}`
    if (effectiveLinkedClientCompanyId) return `/board?linkedClientCompanyId=${effectiveLinkedClientCompanyId}`
    return '/board'
  }, [observerCompanyId, effectiveLinkedClientCompanyId])
  const boardNavContext = useMemo(() => {
    const state = location.state as BoardTicketNavState | null | undefined
    return sanitizeBoardNavigationContext(state?.boardContext)
  }, [location.state])
  const backToBoardState = useMemo<BoardTicketNavState | undefined>(
    () => (boardNavContext ? { boardContext: boardNavContext } : undefined),
    [boardNavContext],
  )

  useEffect(() => {
    api.persistScopeFromSearchParams(searchParams, meQ.data)
  }, [searchParams, meQ.data])
  const ownCompanyQ = useQuery({
    queryKey: ['ticket-own-company'],
    queryFn: () => api.company(),
    enabled: !observerCompanyId && !linkedClientCompanyId,
  })
  const linkedClientsQ = useQuery({
    queryKey: ['ticket-linked-clients-fallback'],
    queryFn: api.getLinkedClients,
    enabled: !observerCompanyId && !linkedClientCompanyId && ownCompanyQ.data?.type === 'PROVIDER',
  })

  const ticketQ = useQuery({
    enabled: !!ticketId,
    queryKey: ['ticket', ticketId, observerCompanyId, effectiveLinkedClientCompanyId],
    queryFn: () => api.getTicket(ticketId, baseTicketScope),
  })

  const inferredLinkedClientCompanyId = useMemo(() => {
    if (effectiveLinkedClientCompanyId) return effectiveLinkedClientCompanyId
    if (observerCompanyId) return ''
    if (ticketQ.data?.meta?.visibilityMode !== 'provider_primary') return ''
    return ticketQ.data?.meta?.scopeCompanyId || ''
  }, [effectiveLinkedClientCompanyId, observerCompanyId, ticketQ.data?.meta?.visibilityMode, ticketQ.data?.meta?.scopeCompanyId])

  useEffect(() => {
    if (!ticketId) return
    if (observerCompanyId || linkedClientCompanyId || autoLinkedClientCompanyId) return
    if (ownCompanyQ.data?.type !== 'PROVIDER') return
    if (!ticketQ.isError) return
    const linkedClients = linkedClientsQ.data || []
    if (!linkedClients.length) return

    let cancelled = false
    ;(async () => {
      for (const linkedClient of linkedClients) {
        try {
          await api.getTicket(ticketId, { linkedClientCompanyId: linkedClient.clientCompany.id })
          if (!cancelled) {
            setAutoLinkedClientCompanyId(linkedClient.clientCompany.id)
          }
          return
        } catch {
          // try next linked client scope
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    ticketId,
    observerCompanyId,
    linkedClientCompanyId,
    autoLinkedClientCompanyId,
    ownCompanyQ.data?.type,
    ticketQ.isError,
    linkedClientsQ.data,
  ])

  const effectiveTicketScope = useMemo<api.TicketScopeParams>(
    () => ({
      companyId: observerCompanyId || undefined,
      linkedClientCompanyId: inferredLinkedClientCompanyId || undefined,
    }),
    [observerCompanyId, inferredLinkedClientCompanyId],
  )

  const timelineQ = useQuery({
    enabled: !!ticketId,
    queryKey: ['timeline', ticketId, observerCompanyId, inferredLinkedClientCompanyId],
    queryFn: () => api.timeline(ticketId, effectiveTicketScope),
  })

  const attachmentsQ = useQuery({
    enabled: !!ticketId,
    queryKey: ['ticket-attachments', ticketId, observerCompanyId, inferredLinkedClientCompanyId],
    queryFn: () => api.ticketAttachments(ticketId, effectiveTicketScope),
  })

  const role = meQ.data?.role
  const adminProfile = useMemo(
    () =>
      resolveAdminProfile({
        role,
        companyType: ownCompanyQ.data?.type ?? null,
      }),
    [role, ownCompanyQ.data?.type],
  )
  const isClientRole = role === 'CLIENT'
  const readOnlyByVisibilityMode = contextMode === 'observer'
  const canMutateTicket = !readOnlyByVisibilityMode && !(isClientRole && contextMode !== 'tenant')
  const isClientTenantCompany = !observerCompanyId && !linkedClientCompanyId && ownCompanyQ.data?.type === 'CLIENT'
  const executorActionsAllowed = canMutateTicket && !isClientTenantCompany
  const canEditTicket = canMutateTicket && roleCanEdit(role)

  const categoriesQ = useQuery({
    queryKey: ['problem-categories', ticketQ.data?.meta?.scopeCompanyId || ''],
    queryFn: () => api.problemCategories(ticketQ.data?.meta?.scopeCompanyId || undefined),
  })
  const locationsQ = useQuery({
    queryKey: ['locations', ticketQ.data?.meta?.scopeCompanyId || ''],
    queryFn: () => api.locations(ticketQ.data?.meta?.scopeCompanyId || undefined),
    enabled: canEditTicket && editOpen,
  })
  const equipmentQ = useQuery({
    queryKey: ['equipment-by-location', editLocationId || ticketQ.data?.location?.id || ''],
    queryFn: () => api.equipmentByLocation(editLocationId || ticketQ.data?.location?.id || ''),
    enabled: !!(editLocationId || ticketQ.data?.location?.id) && roleCanEdit(meQ.data?.role) && editOpen,
  })

  const canAssign =
    executorActionsAllowed &&
    !isClientRole &&
    (role === 'ADMIN' ? canUseAdminManagementActions(adminProfile) : roleCanAssign(role))
  const canChangeStatus =
    executorActionsAllowed &&
    (role === 'ADMIN' ? canUseAdminManagementActions(adminProfile) : roleCanChangeStatus(role))
  const canUploadPhoto = canMutateTicket && roleCanUploadPhoto(role)
  const canDeletePhoto = canMutateTicket && roleCanUploadPhoto(role)
  const canCreateChildTicket = canMutateTicket && roleCanCreateChildTicket(role)
  const isTechnicianRole = role === 'TECHNICIAN'

  const assignmentCandidatesQ = useQuery({
    enabled: !!ticketId && canAssign,
    queryKey: ['ticket-assignment-candidates', ticketId, observerCompanyId, inferredLinkedClientCompanyId],
    queryFn: () => api.getTicketAssignmentCandidates(ticketId, effectiveTicketScope),
  })

  const assignmentDecisionQ = useQuery({
    enabled: !!ticketId,
    queryKey: ['ticket-assignment-decision', ticketId, observerCompanyId, inferredLinkedClientCompanyId],
    queryFn: () => api.latestAssignmentDecision(ticketId, effectiveTicketScope),
  })

  const refreshAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['ticket', ticketId] }),
      qc.invalidateQueries({ queryKey: ['timeline', ticketId] }),
      qc.invalidateQueries({ queryKey: ['ticket-attachments', ticketId] }),
      qc.invalidateQueries({ queryKey: ['ticket-assignment-candidates', ticketId] }),
      qc.invalidateQueries({ queryKey: ['board'] }),
      qc.invalidateQueries({ queryKey: ['mobile-home-board'] }),
      qc.invalidateQueries({ queryKey: ['mobile-my-board'] }),
      qc.invalidateQueries({ queryKey: ['mobile-ticket-detail'] }),
      qc.invalidateQueries({ queryKey: ['tickets'] }),
    ])
  }

  useEffect(() => {
    const t = ticketQ.data
    if (!t) return

    setEditProblemCategoryId(t.problemCategory?.id || '')
    setEditLocationId(t.location?.id || '')
    setEditProblemText(t.problemText || '')
    setEditEquipmentId(t.equipment?.id || '')
    setEditUrgency(t.urgency)
    setEditRequesterName(t.requesterName || '')
    setEditRequesterPhone(t.requesterPhone || '')
    setEditAddress(t.address || '')
    setEditPointName(t.pointName || '')
    setEditComment('')
  }, [ticketQ.data])

  useEffect(() => {
    if (!editOpen) return
    const currentLocationId = editLocationId || ticketQ.data?.location?.id || ''
    if (!currentLocationId) {
      setEditEquipmentId('')
      return
    }
    if (editEquipmentId && equipmentQ.data && !equipmentQ.data.some((item) => item.id === editEquipmentId)) {
      setEditEquipmentId('')
    }
  }, [editOpen, ticketQ.data?.location?.id, editEquipmentId, equipmentQ.data])

  useEffect(() => {
    const data = assignmentCandidatesQ.data
    if (!data) return
    if (selectedTechnicianId) return

    if (data.currentAssigneeId) {
      setSelectedTechnicianId(data.currentAssigneeId)
      return
    }

    if (data.matched.length > 0) {
      setSelectedTechnicianId(data.matched[0].id)
    }
  }, [assignmentCandidatesQ.data, selectedTechnicianId])

  const clearActionErrors = () => {
    setClaimError(null)
    setAssignError(null)
    setStatusError(null)
    setUploadError(null)
    setDeleteAttachmentError(null)
    setUpdateError(null)
  }

  const claimM = useMutation({
    mutationFn: () => {
      if (!canMutateTicket) throw new Error('Изменение заявки запрещено в текущем режиме видимости')
      return api.claim(ticketId, effectiveTicketScope)
    },
    onSuccess: async () => {
      setClaimError(null)
      clearActionErrors()
      pushToast('Заявка закреплена за вами', 'success')
      await refreshAll()
    },
    onError: (e: any) => {
      const raw = e?.message || String(e)
      logTicketActionError('claim', raw)
      setClaimError(mapTicketActionError(raw))
    },
  })

  const assignM = useMutation({
    mutationFn: () => {
      if (isClientRole) throw new Error('Клиент не может назначать техников')
      if (!canMutateTicket) throw new Error('Изменение заявки запрещено в текущем режиме видимости')
      if (!selectedTechnicianId) throw new Error('Сначала выберите техника')
      return api.assignTicket(ticketId, selectedTechnicianId, effectiveTicketScope)
    },
    onSuccess: async () => {
      setAssignError(null)
      clearActionErrors()
      await refreshAll()
    },
    onError: (e: any) => {
      const raw = e?.message || String(e)
      logTicketActionError('assign', raw)
      setAssignError(mapTicketActionError(raw))
    },
  })

  const selfAssignM = useMutation({
    mutationFn: () => {
      if (!canMutateTicket) throw new Error('Изменение заявки запрещено в текущем режиме видимости')
      if (!meQ.data?.id) throw new Error('Не удалось определить пользователя')
      return api.assignTicket(ticketId, meQ.data.id, effectiveTicketScope)
    },
    onSuccess: async () => {
      clearActionErrors()
      pushToast('Заявка взята на себя', 'success')
      await refreshAll()
    },
    onError: (e: any) => {
      const raw = e?.message || String(e)
      logTicketActionError('self_assign', raw)
      setAssignError(mapTicketActionError(raw))
    },
  })

  const statusM = useMutation({
    mutationFn: (input: api.UpdateTicketStatusInput) => {
      if (!canMutateTicket) throw new Error('Изменение заявки запрещено в текущем режиме видимости')
      return api.updateTicketStatus(ticketId, input, effectiveTicketScope)
    },
    onSuccess: async (_data, vars) => {
      setStatusError(null)
      clearActionErrors()
      if (vars.status === 'AWAITING_ACCEPTANCE') pushToast('Заявка отправлена на приёмку', 'success')
      else if (vars.status === 'DONE') pushToast('Заявка завершена', 'success')
      else if (vars.status === 'IN_PROGRESS') pushToast('Работы начаты', 'success')
      else if (vars.status === 'CANCELED') pushToast('Заявка отменена', 'info')
      setNewComment('')
      await refreshAll()
    },
    onError: (e: any) => {
      const raw = e?.message || String(e)
      logTicketActionError('status', raw)
      setStatusError(mapTicketActionError(raw))
    },
  })

  const acceptanceM = useMutation({
    mutationFn: async (decision: api.TicketAcceptanceDecision) => {
      if (!ticket) throw new Error('Заявка не загружена')
      if (!canMutateTicket) throw new Error('Изменение заявки запрещено в текущем режиме видимости')

      const normalizedComment = acceptanceComment.trim()
      if (decision === 'REJECT' && !normalizedComment) {
        throw new Error('Добавьте комментарий при отказе')
      }

      const attachmentIds: string[] = []
      if (acceptanceFile) {
        const uploaded = await api.uploadTicketAttachment(ticketId, acceptanceFile, effectiveTicketScope)
        if (uploaded?.id) attachmentIds.push(uploaded.id)
      }

      return api.decideTicketAcceptance(
        ticketId,
        {
          decision,
          comment: normalizedComment || undefined,
          attachmentIds: attachmentIds.length ? attachmentIds : undefined,
        },
        effectiveTicketScope,
      )
    },
    onSuccess: async (_data, decision) => {
      setAcceptanceComment('')
      setAcceptanceFile(null)
      setAcceptanceFileError(null)
      if (acceptanceFileInputRef.current) acceptanceFileInputRef.current.value = ''
      clearActionErrors()
      pushToast(decision === 'ACCEPT' ? 'Работа принята' : 'Заявка возвращена в работу', 'success')
      await refreshAll()
    },
    onError: (e: any) => {
      const raw = e?.message || String(e)
      logTicketActionError('acceptance', raw)
      setStatusError(mapTicketActionError(raw))
    },
  })

  const uploadM = useMutation({
    mutationFn: (fileOverride?: File | null) => {
      if (!canMutateTicket) throw new Error('Изменение заявки запрещено в текущем режиме видимости')
      const file = fileOverride ?? selectedFile
      if (!file) throw new Error('Сначала выберите файл')
      return api.uploadTicketAttachment(ticketId, file, effectiveTicketScope)
    },
    onSuccess: async () => {
      setUploadError(null)
      setFileError(null)
      clearActionErrors()
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      if (operationalFileInputRef.current) {
        operationalFileInputRef.current.value = ''
      }
      pushToast('Фото добавлено', 'success')
      await refreshAll()
    },
    onError: (e: any) => {
      const raw = e?.message || String(e)
      logTicketActionError('upload', raw)
      setUploadError(mapTicketActionError(raw))
    },
  })

  const deleteAttachmentM = useMutation({
    mutationFn: (attachmentId: string) => {
      if (!canMutateTicket) throw new Error('Изменение заявки запрещено в текущем режиме видимости')
      return api.deleteTicketAttachment(ticketId, attachmentId, effectiveTicketScope)
    },
    onSuccess: async () => {
      setDeleteAttachmentError(null)
      clearActionErrors()
      await refreshAll()
    },
    onError: (e: any) => {
      const raw = e?.message || String(e)
      logTicketActionError('delete_attachment', raw)
      setDeleteAttachmentError(mapTicketActionError(raw))
    },
  })

  const updateTicketM = useMutation({
    mutationFn: () =>
      {
        if (!canMutateTicket) throw new Error('Изменение заявки запрещено в текущем режиме видимости')
        return api.updateTicket(
          ticketId,
          {
            problemCategoryId: editProblemCategoryId,
            locationId: editLocationId,
            equipmentId: editEquipmentId || null,
            problemText: editProblemText,
            urgency: editUrgency,
            requesterName: editRequesterName || null,
            requesterPhone: editRequesterPhone || null,
            address: editAddress || null,
            pointName: editPointName || null,
            comment: editComment.trim() || undefined,
          },
          effectiveTicketScope,
        )
      },
    onSuccess: async () => {
      setUpdateError(null)
      clearActionErrors()
      setEditOpen(false)
      setSelectedTechnicianId('')
      await refreshAll()
    },
    onError: (e: any) => {
      const raw = e?.message || String(e)
      logTicketActionError('update_ticket', raw)
      setUpdateError(mapTicketActionError(raw))
    },
  })

  const addCommentM = useMutation({
    mutationFn: () => {
      if (!canMutateTicket) throw new Error('Изменение заявки запрещено в текущем режиме видимости')
      if (!newComment.trim()) throw new Error('Введите комментарий')
      return api.addTicketComment(ticketId, newComment.trim(), effectiveTicketScope)
    },
    onSuccess: async () => {
      setNewComment('')
      pushToast('Комментарий добавлен', 'success')
      await refreshAll()
    },
    onError: (e: any) => {
      const raw = e?.message || String(e)
      logTicketActionError('comment', raw)
      setStatusError(mapTicketActionError(raw))
    },
  })

  const closeReportM = useMutation({
    mutationFn: async () => {
      if (!canMutateTicket) throw new Error('Изменение заявки запрещено в текущем режиме видимости')
      const normalizedComment = closeReportComment.trim()
      if (!normalizedComment) throw new Error('Добавьте комментарий к закрытию')
      const hasPhotoAlready = hasWorkReportPhotoEvidence
      if (!hasPhotoAlready && !selectedFile) throw new Error('Добавьте фото для отправки на приёмку')
      if (selectedFile) {
        await api.uploadTicketAttachment(ticketId, selectedFile, effectiveTicketScope)
      }
      await api.addTicketComment(ticketId, normalizedComment, effectiveTicketScope)
      await api.updateTicketStatus(
        ticketId,
        { status: 'AWAITING_ACCEPTANCE', comment: normalizedComment },
        effectiveTicketScope,
      )
    },
    onSuccess: async () => {
      setCloseReportComment('')
      setNewComment('')
      setSelectedFile(null)
      setShowSubmitToAcceptanceForm(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      clearActionErrors()
      pushToast('Заявка отправлена на приёмку', 'success')
      await refreshAll()
    },
    onError: (e: any) => {
      const raw = e?.message || String(e)
      logTicketActionError('close_report', raw)
      setStatusError(mapTicketActionError(raw))
    },
  })

  const createChildM = useMutation({
    mutationFn: () => {
      if (!ticket) throw new Error('Родительская заявка не загружена')
      if (!canCreateChildTicket) throw new Error('Недостаточно прав для создания дополнительной работы')
      if (!childCategoryId.trim()) throw new Error('Выберите категорию')
      if (!childProblemText.trim()) throw new Error('Опишите проблему')
      return api.createChildTicket(ticket.id, {
        problemCategoryId: childCategoryId.trim(),
        problemText: childProblemText.trim(),
        urgency: childUrgency,
      })
    },
    onSuccess: async () => {
      setChildCreateError(null)
      setChildProblemText('')
      setShowChildCreateForm(false)
      await refreshAll()
    },
    onError: (e: any) => {
      const raw = e?.message || String(e)
      logTicketActionError('child_ticket', raw)
      setChildCreateError(mapTicketActionError(raw))
    },
  })

  const ticket = ticketQ.data
  const hasAssignedTechnician = !!ticket?.assignedTechnician
  const canClaim = useMemo(() => {
    if (role !== 'TECHNICIAN' || !ticket) return false
    if (!executorActionsAllowed) return false
    const aa = ticket.meta?.availableActions
    if (aa) return aa.canClaim
    return ticket.meta?.canClaimByCurrentUser === true
  }, [role, ticket, executorActionsAllowed])

  const showSelfAssign =
    canAssign &&
    !!ticket &&
    ticket.status === 'NEW' &&
    !hasAssignedTechnician

  const assignmentData = assignmentCandidatesQ.data
  const availableStatusTransitions = ticket?.meta?.availableStatusTransitions || []
  const canTransitionTo = (status: api.TicketStatus) => availableStatusTransitions.includes(status)
  const primaryAction = useMemo(
    () =>
      ticket
        ? computePrimaryTicketAction({
            ticket,
            canClaim,
            canChangeStatus,
            availableStatusTransitions,
          })
        : null,
    [ticket, canClaim, canChangeStatus, availableStatusTransitions],
  )

  const showCancelInTechnicianBar =
    !!ticket &&
    canChangeStatus &&
    canTransitionTo('CANCELED') &&
    (!isTechnicianRole || !!ticket.meta?.availableActions?.canClose)

  const technicianBarCloseHint = ticket?.meta?.availableActionHints?.canClose ?? null

  const selectedCandidate = useMemo(() => {
    if (!assignmentData || !selectedTechnicianId) return null
    return [...assignmentData.matched, ...assignmentData.others].find((item) => item.id === selectedTechnicianId) || null
  }, [assignmentData, selectedTechnicianId])

  const selectedIsMatched = !!selectedCandidate?.matched
  const selectedIsCurrent = !!assignmentData?.currentAssigneeId && assignmentData.currentAssigneeId === selectedTechnicianId

  const slaState = useMemo(() => {
    if (!ticket?.slaDueAt) {
      return { hasSla: false, isBreached: false, isAtRisk: false }
    }

    const nowMs = Date.now()
    const dueMs = new Date(ticket.slaDueAt).getTime()
    const warningWindowMs = 60 * 60_000

    const isBreached = !!ticket.slaBreachedAt || nowMs > dueMs
    const isAtRisk = !isBreached && nowMs >= dueMs - warningWindowMs

    return { hasSla: true, isBreached, isAtRisk }
  }, [ticket?.slaDueAt, ticket?.slaBreachedAt])

  const contextBadge = useMemo(() => {
    if (contextMode === 'observer') return 'Режим наблюдения'
    if (contextMode === 'provider') return 'Режим подрядчика'
    return 'Контекст компании'
  }, [contextMode])
  const timelineItems = timelineQ.data?.timeline || timelineQ.data?.items || []
  const childTickets = ticket?.children || []
  // SMA-ACCEPTANCE-ROLE-GAP-001: accept/reject only for client-company ADMIN / TERRITORIAL_MANAGER / NETWORK_DIRECTOR.
  const isAwaitingAcceptanceClient =
    !!ticket &&
    canMutateTicket &&
    isClientTenantCompany &&
    api.isClientAcceptanceRole(role) &&
    ticket.status === 'AWAITING_ACCEPTANCE'
  const requestAttachments = useMemo(
    () => (attachmentsQ.data || []).filter((item: any) => item?.purpose !== 'WORK_REPORT'),
    [attachmentsQ.data],
  )
  const workReportAttachments = useMemo(
    () => (attachmentsQ.data || []).filter((item: any) => item?.purpose === 'WORK_REPORT'),
    [attachmentsQ.data],
  )
  const hasWorkReportPhotoEvidence = useMemo(
    () => workReportAttachments.some((item) => (item.mimeType || '').startsWith('image/')),
    [workReportAttachments],
  )
  const timelinePreviewItems = useMemo(
    () => (showFullTimeline ? timelineItems : timelineItems.slice(0, 5)),
    [showFullTimeline, timelineItems],
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
  const shortProblemText = useMemo(() => {
    const text = ticket?.problemText || ''
    if (text.length <= 180) return text
    return `${text.slice(0, 180)}…`
  }, [ticket?.problemText])

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFileError(null)
    setUploadError(null)

    const file = e.target.files?.[0] || null
    if (!file) {
      setSelectedFile(null)
      return
    }

    if (!file.type.startsWith('image/')) {
      setSelectedFile(null)
      e.target.value = ''
      setFileError('Можно загружать только изображения')
      return
    }

    if (file.size <= 0) {
      setSelectedFile(null)
      e.target.value = ''
      setFileError('Файл пустой')
      return
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setSelectedFile(null)
      e.target.value = ''
      setFileError('Изображение слишком большое. Максимум 10 МБ.')
      return
    }

    setSelectedFile(file)
  }

  function handleOperationalPhotoPick(e: ChangeEvent<HTMLInputElement>) {
    setFileError(null)
    setUploadError(null)
    const file = e.target.files?.[0] || null
    if (!file) return
    if (!file.type.startsWith('image/')) {
      e.target.value = ''
      setFileError('Можно загружать только изображения')
      return
    }
    if (file.size <= 0) {
      e.target.value = ''
      setFileError('Файл пустой')
      return
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      e.target.value = ''
      setFileError('Изображение слишком большое. Максимум 10 МБ.')
      return
    }
    uploadM.mutate(file)
  }

  function handleAcceptanceFileChange(e: ChangeEvent<HTMLInputElement>) {
    setAcceptanceFileError(null)
    const file = e.target.files?.[0] || null
    if (!file) {
      setAcceptanceFile(null)
      return
    }

    if (!file.type.startsWith('image/')) {
      setAcceptanceFile(null)
      e.target.value = ''
      setAcceptanceFileError('Можно загружать только изображения')
      return
    }

    if (file.size <= 0) {
      setAcceptanceFile(null)
      e.target.value = ''
      setAcceptanceFileError('Файл пустой')
      return
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setAcceptanceFile(null)
      e.target.value = ''
      setAcceptanceFileError('Изображение слишком большое. Максимум 10 МБ.')
      return
    }

    setAcceptanceFile(file)
  }

  useEffect(() => {
    setAcceptanceComment('')
    setAcceptanceFile(null)
    setAcceptanceFileError(null)
    if (acceptanceFileInputRef.current) {
      acceptanceFileInputRef.current.value = ''
    }
  }, [ticketId])

  function handleUploadClick() {
    if (uploadM.isPending) return
    if (!selectedFile) {
      fileInputRef.current?.click()
      return
    }
    uploadM.mutate(selectedFile)
  }

  function buildTicketHref(targetTicketId: string) {
    const base = `/tickets/${targetTicketId}`
    return api.appendScopeToPath(
      base,
      {
        companyId: observerCompanyId || undefined,
        linkedClientCompanyId: inferredLinkedClientCompanyId || undefined,
      },
      meQ.data,
    )
  }

  const showTechnicianActionBar = !!(ticket && isTechnicianRole && executorActionsAllowed)
  const canSubmitToAcceptance = !!(ticket && executorActionsAllowed && canChangeStatus && canTransitionTo('AWAITING_ACCEPTANCE'))

  return (
    <div>
      <TicketHeader
        ticket={ticket}
        ticketId={ticketId}
        isFetching={ticketQ.isFetching}
        observerCompanyId={observerCompanyId}
        linkedClientCompanyId={effectiveLinkedClientCompanyId}
        contextBadge={contextBadge}
        backToBoardHref={backToBoardHref}
        backToBoardState={backToBoardState}
        canEditTicket={canEditTicket}
        editOpen={editOpen}
        onToggleEdit={() => setEditOpen((value) => !value)}
        role={role}
        meUserId={meQ.data?.id}
        hintCanClaim={canClaim}
      />

      {boardNavContext ? (
        <div className="panel uiCard" style={{ marginBottom: 12 }}>
          <div className="row" style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 700 }}>Контекст доски</div>
            <Link to={backToBoardHref} style={{ textDecoration: 'none' }}>
              <button className="ghost">Без фильтров</button>
            </Link>
          </div>
          <div className="muted small">
            {boardNavContext.selectedStatus ? `Статус: ${statusLabel(boardNavContext.selectedStatus)} · ` : ''}
            {boardNavContext.selectedLocationId ? `Локация: ${boardNavContext.selectedLocationId} · ` : ''}
            {boardNavContext.selectedEquipmentId ? `Оборудование: ${boardNavContext.selectedEquipmentId} · ` : ''}
            {boardNavContext.includeArchived ? 'Архив: включён' : 'Архив: выключен'}
          </div>
        </div>
      ) : null}

      {ticket && shouldShowClientTicketLifecycleHint(meQ.data, ticket) ? (
        <div className="panel uiCard" style={{ marginBottom: 12, borderColor: '#c7d2fe', background: '#f8fafc' }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Что дальше</div>
          <div className="muted" style={{ lineHeight: 1.55 }}>
            {clientTicketLifecycleHintText(ticket.status)}
          </div>
        </div>
      ) : null}

      <div className="pageHint">
        Карточка заявки: статус, исполнитель, вложения и история. Доступные действия зависят от роли и статуса; диспетчер назначает
        техника, техник ведёт работу до закрытия.
      </div>

      {!showTechnicianActionBar ? <InlineError message={claimError} /> : null}
      {ticketQ.isError ? (
        <div className="alert">{mapTicketActionError((ticketQ.error as any)?.message || String(ticketQ.error))}</div>
      ) : null}
      {readOnlyByVisibilityMode ? (
        <div className="panel uiCard" style={{ marginBottom: 12 }}>
          <div className="muted small">
            Режим только просмотра: изменение заявки доступно только в tenant-контуре.
          </div>
        </div>
      ) : null}
      {isClientTenantCompany ? (
        <div className="panel uiCard" style={{ marginBottom: 12 }}>
          <div className="muted small">
            Клиентский контур: действия исполнителя (назначение, claim, операционные статусы) недоступны.
          </div>
        </div>
      ) : null}

      {ticket ? (
        <div className="panel uiCard" style={{ marginBottom: 12 }}>
          <div className="row" style={{ marginBottom: 0 }}>
            <div style={{ minWidth: 0 }}>
              <div className="muted small">Карточка заявки</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {ticket.ticketNumber != null ? `Заявка #${ticket.ticketNumber}` : 'Заявка'}
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>
                создана: {fmt(ticket.createdAt)} · обновлена: {fmt(ticket.updatedAt)}
              </div>
              <div className="muted small" style={{ marginTop: 2 }}>
                ID: {ticket.id}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <StatusPill status={ticket.status} />
              {slaState.isBreached ? <span className="tag danger">SLA нарушен</span> : null}
              {!slaState.isBreached && slaState.isAtRisk ? <span className="tag">SLA в риске</span> : null}
              <span className="tag">срок: {ticket.slaDueAt ? fmt(ticket.slaDueAt) : '—'}</span>
            </div>
          </div>
        </div>
      ) : ticketQ.isLoading ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="row" style={{ marginBottom: 0 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <Skeleton w={220} h={16} />
              <Skeleton w={340} h={12} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Skeleton w={80} h={24} />
              <Skeleton w={120} h={24} />
            </div>
          </div>
        </div>
      ) : null}

      <TicketSummaryPanel
        ticket={ticket ?? null}
        shortProblemText={shortProblemText}
        showLifecycleHint={shouldShowClientTicketLifecycleHint(meQ.data, ticket)}
        statusNode={<StatusPill status={ticket?.status || 'NEW'} />}
      />

      <TicketSlaPanel ticket={ticket ?? null} slaState={slaState} />

      {isAwaitingAcceptanceClient && ticket ? (
        <div className="panel uiCard" style={{ marginBottom: 12, borderColor: '#fdba74', background: '#fff7ed' }}>
          <h3 style={{ marginBottom: 8 }}>Приёмка работы</h3>
          <div className="muted small" style={{ marginBottom: 10, lineHeight: 1.5 }}>
            Техник отметил работу как завершённую. Проверьте результат и примите заявку либо верните её в работу с комментарием.
          </div>
          <div className="form">
            <label>
              Комментарий при отказе
              <textarea
                value={acceptanceComment}
                onChange={(e) => setAcceptanceComment(e.target.value)}
                rows={3}
                placeholder="Объясните, что нужно исправить. Обязательно при отказе."
                disabled={acceptanceM.isPending}
              />
            </label>
            <label>
              Фото при отказе / приёмке (необязательно)
              <input
                ref={acceptanceFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAcceptanceFileChange}
                disabled={acceptanceM.isPending}
              />
              <div className="muted small" style={{ marginTop: 6 }}>
                Можно приложить фото результата. При приёмке фото не обязательно.
              </div>
            </label>
            <div className="uiActions">
              <button
                onClick={() => acceptanceM.mutate('ACCEPT')}
                disabled={acceptanceM.isPending}
              >
                {acceptanceM.isPending ? 'Сохраняем…' : 'Принять работу'}
              </button>
              <button
                className="ghost"
                onClick={() => acceptanceM.mutate('REJECT')}
                disabled={acceptanceM.isPending || !acceptanceComment.trim()}
                title={!acceptanceComment.trim() ? 'Комментарий обязателен при отказе' : undefined}
              >
                {acceptanceM.isPending ? 'Сохраняем…' : 'Не принять работу'}
              </button>
            </div>
          </div>
          <InlineError message={acceptanceFileError || statusError} />
        </div>
      ) : null}

      {ticket ? (
        <>
          <input
            ref={operationalFileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleOperationalPhotoPick}
          />
          <TicketActionsPanel
            showTechnicianActionBar={showTechnicianActionBar}
            ticket={ticket}
            backToBoardHref={backToBoardHref}
            primaryAction={primaryAction}
            canClaim={canClaim}
            canChangeStatus={canChangeStatus}
            canTransitionTo={canTransitionTo}
            showCancelInTechnicianBar={showCancelInTechnicianBar}
            technicianBarCloseHint={technicianBarCloseHint}
            claimPending={claimM.isPending}
            statusPending={statusM.isPending}
            newComment={newComment}
            onNewCommentChange={setNewComment}
            onAddComment={() => addCommentM.mutate()}
            addCommentPending={addCommentM.isPending}
            onClaim={() => claimM.mutate()}
            onSetStatus={(input) => statusM.mutate(input)}
            onPickOperationalPhoto={() => operationalFileInputRef.current?.click()}
            operationalPhotoPending={uploadM.isPending}
            hasOperationalPhotoSelected={false}
            claimError={claimError}
            statusError={statusError}
            onOpenSubmitForm={canSubmitToAcceptance ? () => setShowSubmitToAcceptanceForm(true) : undefined}
            showSelfAssign={showSelfAssign}
            selfAssignPending={selfAssignM.isPending}
            onSelfAssign={() => selfAssignM.mutate()}
            canEditTicket={canEditTicket}
            editOpen={editOpen}
            onToggleEdit={() => setEditOpen((value) => !value)}
            canCreateChildTicket={canCreateChildTicket}
            showChildCreateForm={showChildCreateForm}
            childCreatePending={createChildM.isPending}
            onToggleChildCreateForm={() => {
              setShowChildCreateForm((value) => !value)
              setChildCreateError(null)
            }}
            isTechnicianRole={isTechnicianRole}
            onShowSubmitForm={() => setShowSubmitToAcceptanceForm(true)}
          />
        </>
      ) : null}

      {canSubmitToAcceptance && showSubmitToAcceptanceForm ? (
        <div className="panel uiCard" style={{ marginBottom: 12, borderColor: '#c7d2fe', background: '#f8fafc' }}>
          <h3 style={{ marginBottom: 8 }}>Отправить на приёмку</h3>
          <div className="muted small" style={{ marginBottom: 12, lineHeight: 1.5 }}>
            Заполните комментарий и прикрепите фото выполненной работы. После отправки заявка перейдёт в статус «Ожидает приёмки».
          </div>
          <div className="form">
            <label>
              Комментарий *
              <textarea
                value={closeReportComment}
                onChange={(e) => setCloseReportComment(e.target.value)}
                rows={3}
                placeholder="Что сделано, результат работ"
                disabled={closeReportM.isPending}
              />
            </label>
            <label>
              Фото отчёта {hasWorkReportPhotoEvidence ? `(уже загружено: ${workReportAttachments.filter((a) => (a.mimeType || '').startsWith('image/')).length} шт.)` : '*'}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={closeReportM.isPending}
              />
              {hasWorkReportPhotoEvidence ? (
                <div className="muted small" style={{ marginTop: 6 }}>
                  Уже есть фото отчёта. Можно добавить ещё или оставить как есть.
                </div>
              ) : (
                <div className="muted small" style={{ marginTop: 6 }}>
                  Обязательно прикрепите фото результата работ.
                </div>
              )}
            </label>
            <InlineError message={fileError || statusError} />
            <div className="uiActions">
              <button
                onClick={() => closeReportM.mutate()}
                disabled={
                  closeReportM.isPending ||
                  !closeReportComment.trim() ||
                  (!hasWorkReportPhotoEvidence && !selectedFile)
                }
              >
                {closeReportM.isPending ? 'Отправляем…' : 'Отправить на приёмку'}
              </button>
              <button
                className="ghost"
                onClick={() => {
                  setShowSubmitToAcceptanceForm(false)
                  setCloseReportComment('')
                  setSelectedFile(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                disabled={closeReportM.isPending}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {ticket && canEditTicket && editOpen ? (
        <div className="panel uiCard" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Редактирование заявки</h3>
          <div className="form">
            <label>
              Категория
              <select value={editProblemCategoryId} onChange={(e) => setEditProblemCategoryId(e.target.value)} disabled={updateTicketM.isPending}>
                <option value="">Выберите категорию</option>
                {(categoriesQ.data || []).filter((row) => row.isActive !== false).map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </label>
            <label>
              Локация
              <select value={editLocationId} onChange={(e) => setEditLocationId(e.target.value)} disabled={updateTicketM.isPending || locationsQ.isFetching}>
                <option value="">Выберите локацию</option>
                {(locationsQ.data || []).filter((row) => row.isActive !== false).map((row) => (
                  <option key={row.id} value={row.id}>{[row.name, row.city, row.address].filter(Boolean).join(' · ')}</option>
                ))}
              </select>
            </label>
            <label>
              Оборудование / Asset (опционально)
              <select
                value={editEquipmentId}
                onChange={(e) => setEditEquipmentId(e.target.value)}
                disabled={updateTicketM.isPending || equipmentQ.isFetching}
              >
                <option value="">Без оборудования</option>
                {(equipmentQ.data || []).map((equipment) => (
                  <option key={equipment.id} value={equipment.id}>
                    {[equipment.name, equipment.type, equipment.status].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </select>
              <div className="muted small" style={{ marginTop: 6 }}>
                {equipmentQ.isFetching
                  ? 'Загружаем оборудование для текущей локации...'
                  : (equipmentQ.data || []).length === 0
                    ? 'Для текущей локации оборудование не найдено. Можно сохранить без оборудования.'
                    : 'Оборудование доступно только из текущей локации заявки.'}
              </div>
            </label>
            <label>
              Описание проблемы
              <textarea value={editProblemText} onChange={(e) => setEditProblemText(e.target.value)} rows={5} disabled={updateTicketM.isPending} />
            </label>
            <label>
              Срочность
              <select value={editUrgency} onChange={(e) => setEditUrgency(e.target.value as api.TicketUrgency)} disabled={updateTicketM.isPending}>
                <option value="NOT_URGENT">Не срочно</option>
                <option value="URGENT">Срочно</option>
              </select>
              <div className="fieldHint">«Срочно» — более жёсткие сроки первого ответа по правилам SLA.</div>
            </label>
            <label>
              Заявитель
              <input value={editRequesterName} onChange={(e) => setEditRequesterName(e.target.value)} disabled={updateTicketM.isPending} />
            </label>
            <label>
              Телефон
              <input value={editRequesterPhone} onChange={(e) => setEditRequesterPhone(e.target.value)} disabled={updateTicketM.isPending} />
            </label>
            <label>
              Точка
              <input value={editPointName} onChange={(e) => setEditPointName(e.target.value)} disabled={updateTicketM.isPending} />
            </label>
            <label>
              Адрес
              <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} disabled={updateTicketM.isPending} />
            </label>
            <label>
              Комментарий
              <textarea value={editComment} onChange={(e) => setEditComment(e.target.value)} rows={3} disabled={updateTicketM.isPending} />
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => updateTicketM.mutate()} disabled={updateTicketM.isPending}>
                {updateTicketM.isPending ? 'Сохраняем…' : 'Сохранить изменения'}
              </button>
              <button
                className="ghost"
                onClick={() => {
                  if (!ticket) return
                  setEditProblemCategoryId(ticket.problemCategory?.id || '')
                  setEditLocationId(ticket.location?.id || '')
                  setEditProblemText(ticket.problemText || '')
                  setEditEquipmentId(ticket.equipment?.id || '')
                  setEditUrgency(ticket.urgency)
                  setEditRequesterName(ticket.requesterName || '')
                  setEditRequesterPhone(ticket.requesterPhone || '')
                  setEditAddress(ticket.address || '')
                  setEditPointName(ticket.pointName || '')
                  setEditComment('')
                  setEditOpen(false)
                  setUpdateError(null)
                }}
                disabled={updateTicketM.isPending}
              >
                Отмена
              </button>
            </div>
          </div>
          <InlineError message={(categoriesQ.error as any)?.message || (locationsQ.error as any)?.message || (equipmentQ.error as any)?.message || updateError} />
        </div>
      ) : null}

      {ticket && canCreateChildTicket && showChildCreateForm ? (
        <div className="panel uiCard" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Новая дополнительная работа</h3>
          <div className="muted small" style={{ marginBottom: 10 }}>
            Локация и контакт наследуются от текущей заявки. Для MVP фото в child-ticket не прикрепляется на этапе создания.
          </div>
          <div className="form">
            <label>
              Категория *
              <select
                value={childCategoryId}
                onChange={(e) => setChildCategoryId(e.target.value)}
                disabled={createChildM.isPending}
              >
                <option value="">Выберите категорию</option>
                {(categoriesQ.data || []).filter((row) => row.isActive !== false).map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </label>
            <label>
              Описание проблемы *
              <textarea
                value={childProblemText}
                onChange={(e) => setChildProblemText(e.target.value)}
                rows={4}
                disabled={createChildM.isPending}
                placeholder="Кратко опишите дополнительную работу"
              />
            </label>
            <label>
              Срочность
              <select
                value={childUrgency}
                onChange={(e) => setChildUrgency(e.target.value as api.TicketUrgency)}
                disabled={createChildM.isPending}
              >
                <option value="NOT_URGENT">Не срочно</option>
                <option value="URGENT">Срочно</option>
              </select>
              <div className="fieldHint">Для доп. работы выберите срочность отдельно от родительской заявки.</div>
            </label>
            <div className="uiActions">
              <button onClick={() => createChildM.mutate()} disabled={createChildM.isPending || !childCategoryId || !childProblemText.trim()}>
                {createChildM.isPending ? 'Создаём…' : 'Создать доп. работу'}
              </button>
              <button
                className="ghost"
                onClick={() => {
                  setShowChildCreateForm(false)
                  setChildCreateError(null)
                }}
                disabled={createChildM.isPending}
              >
                Отмена
              </button>
            </div>
          </div>
          <InlineError message={(categoriesQ.error as any)?.message || childCreateError} />
        </div>
      ) : null}

      {ticket && canAssign && !isClientRole ? (
        <div className="panel uiCard" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Исполнитель</h3>
          <div className="uiCard" style={{ marginBottom: 10, padding: 10 }}>
            {hasAssignedTechnician ? (
              <div style={{ display: 'grid', gap: 6 }}>
                <div>
                  <b>Ответственный:</b>{' '}
                  {[ticket.assignedTechnician?.firstName, ticket.assignedTechnician?.lastName].filter(Boolean).join(' ') || ticket.assignedTechnician?.email}
                </div>
                {ticket.assignedTechnician?.phone ? <div className="muted small">{ticket.assignedTechnician.phone}</div> : null}
                <div className="muted small">Заявка закреплена за техником.</div>
                {assignmentDecisionQ.data ? (
                  <div className="uiCard" style={{ padding: 10, marginTop: 6 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>Назначение</div>
                    <div className="muted small">
                      Исполнитель: {ticket.assignedTechnician?.email || '—'}
                    </div>
                    <div className="muted small">
                      Причина: {mapReason(assignmentDecisionQ.data.reason)}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                <div><b>Ответственный:</b> не назначен</div>
                <div className="muted small">Назначьте техника, чтобы зафиксировать ответственность по заявке.</div>
              </div>
            )}
            <div className="uiActions" style={{ marginTop: 8 }}>
              <button className="ghost" type="button" onClick={() => setShowAssignmentEditor((value) => !value)}>
                {showAssignmentEditor ? 'Скрыть назначение' : hasAssignedTechnician ? 'Переназначить' : 'Назначить техника'}
              </button>
            </div>
          </div>
          {assignmentCandidatesQ.isLoading ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <Skeleton w={240} h={16} />
              <Skeleton w={320} h={36} />
            </div>
          ) : assignmentCandidatesQ.isError ? (
            <div className="alert">{(assignmentCandidatesQ.error as any)?.message || String(assignmentCandidatesQ.error)}</div>
          ) : assignmentData && showAssignmentEditor ? (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <Tag>Текущий: {ticket.assignedTechnician?.email || 'не назначен'}</Tag>
                <Tag>Подходящих: {assignmentData.matched.length}</Tag>
              </div>
              <div className="uiActions" style={{ marginTop: 10 }}>
                <select
                  value={selectedTechnicianId}
                  onChange={(e) => setSelectedTechnicianId(e.target.value)}
                  style={{ width: '100%', maxWidth: 420, minWidth: 0 }}
                >
                  <option value="">Выберите техника</option>
                  {assignmentData.matched.length > 0 ? (
                    <optgroup label="Подходящие техники">
                      {assignmentData.matched.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.email}{item.id === assignmentData.currentAssigneeId ? ' · текущий' : ''}{item.matchedBy.length ? ` · подходит: ${item.matchedBy.join(', ')}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {assignmentData.others.length > 0 ? (
                    <optgroup label="Остальные техники">
                      {assignmentData.others.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.email}{item.id === assignmentData.currentAssigneeId ? ' · текущий' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
                <button onClick={() => assignM.mutate()} disabled={assignM.isPending || !selectedTechnicianId}>
                  {assignM.isPending ? 'Назначаем…' : 'Назначить'}
                </button>
              </div>
              <details style={{ marginTop: 10 }}>
                <summary className="muted small" style={{ cursor: 'pointer' }}>Показать рекомендации по специализациям</summary>
                <div className="assignmentHintBox" style={{ marginTop: 8 }}>
                  <div className="assignmentHintTitle">Рекомендация</div>
                  <div className="muted small">Сначала показаны техники, которые подходят по специализациям категории. Ниже — остальные техники компании.</div>
                  <div className="muted small" style={{ marginTop: 6 }}>
                    Категория: {assignmentData.category.name} · Требуемые: {assignmentData.requiredSpecializations.length ? assignmentData.requiredSpecializations.map((item) => item.name).join(', ') : 'не заданы'}
                  </div>
                </div>
              </details>
              {selectedCandidate ? (
                <div className="assignmentSelectedBox">
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Выбранный техник</div>
                  <div style={{ marginBottom: 6 }}>{selectedCandidate.email}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <RecommendationBadge matched={selectedCandidate.matched} matchedBy={selectedCandidate.matchedBy} />
                    {selectedIsCurrent ? <span className="uxBadge uxBadgeNeutral">Текущий исполнитель</span> : null}
                  </div>
                  {!selectedIsMatched ? <div className="assignmentWarning">Внимание: выбран техник, который не входит в рекомендованный список по специализациям категории.</div> : null}
                </div>
              ) : null}
              <InlineError message={assignError} />
            </>
          ) : null}
          {!showAssignmentEditor && !assignmentCandidatesQ.isLoading && !assignmentCandidatesQ.isError ? (
            <div className="muted small">Блок назначения свернут для компактного просмотра.</div>
          ) : null}
        </div>
      ) : null}

      {ticket && canUploadPhoto && !isTechnicianRole ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Фото</h3>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} disabled={uploadM.isPending} />
            <button onClick={handleUploadClick} disabled={uploadM.isPending}>
              {uploadM.isPending ? 'Загружаем…' : selectedFile ? 'Загрузить фото' : 'Выбрать фото'}
            </button>
            <div className="muted small">{selectedFile ? `${selectedFile.name} · ${fmtBytes(selectedFile.size)}` : 'Выберите изображение до 10 МБ'}</div>
          </div>
          <InlineError message={fileError || uploadError} />
        </div>
      ) : null}

      {ticket && canChangeStatus && !isTechnicianRole ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Комментарий</h3>
          <div className="form">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              placeholder="Добавьте комментарий по выполненным действиям"
              disabled={addCommentM.isPending}
            />
            <div className="uiActions">
              <button onClick={() => addCommentM.mutate()} disabled={addCommentM.isPending || !newComment.trim()}>
                {addCommentM.isPending ? 'Сохраняем…' : 'Добавить комментарий'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {ticket ? (
        <>
          <TicketContextPanel ticket={ticket} />

          <TicketPhotosPanel
            loading={attachmentsQ.isLoading}
            isError={attachmentsQ.isError}
            error={attachmentsQ.error}
            requestAttachments={requestAttachments}
            workReportAttachments={workReportAttachments}
            canDeletePhoto={canDeletePhoto}
            deletePending={deleteAttachmentM.isPending}
            onDelete={(attachmentId) => deleteAttachmentM.mutate(attachmentId)}
            deleteAttachmentError={deleteAttachmentError}
            fmt={fmt}
            fmtBytes={fmtBytes}
          />

          <TicketChildTicketsPanel
            childTickets={childTickets}
            fmt={fmt}
            getChildHref={buildTicketHref}
            renderStatusPill={(status) => <StatusPill status={status} />}
          />

          <TicketChatPanel
            messages={chatMessages}
            loading={timelineQ.isLoading}
            canSend={canMutateTicket}
            onSend={async (text) => {
              await api.addTicketComment(ticketId, text, effectiveTicketScope)
              await refreshAll()
            }}
          />

          <TicketTimelinePanel
            loading={timelineQ.isLoading}
            isError={timelineQ.isError}
            error={timelineQ.error}
            items={timelineItems}
            previewItems={timelinePreviewItems}
            showFullTimeline={showFullTimeline}
            onToggleShowFull={() => setShowFullTimeline((value) => !value)}
            fmt={fmt}
            sourceLabel={sourceLabel}
            timelineTypeLabel={timelineTypeLabel}
          />
        </>
      ) : null}
    </div>
  )
}
