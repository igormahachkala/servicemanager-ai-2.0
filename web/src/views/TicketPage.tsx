import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import { TicketAttachments } from './ticket-page/TicketAttachments'
import { TicketHeader } from './ticket-page/TicketHeader'

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

const MANAGEMENT_ROLES: api.Role[] = ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR']
const EDIT_ROLES: api.Role[] = ['ADMIN', 'MASTER', 'DISPATCHER']
const STATUS_CHANGE_ROLES: api.Role[] = ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR', 'TECHNICIAN']
const PHOTO_ROLES: api.Role[] = ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR', 'TECHNICIAN']

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
  if (status === 'DONE') return 'Завершена'
  if (status === 'CANCELED') return 'Отменена'
  return status
}

function urgencyLabel(urgency: api.TicketUrgency) {
  if (urgency === 'URGENT') return 'Срочно'
  if (urgency === 'NOT_URGENT') return 'Не срочно'
  return urgency
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
  if (status === 'DONE') Object.assign(style, { background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' })
  if (status === 'CANCELED') Object.assign(style, { background: '#f3f4f6', borderColor: '#e5e7eb', color: '#6b7280' })

  return <span className="uiStatusBadge" style={style}>{statusLabel(status)}</span>
}

function SlaSignal({ hasSla, isBreached, isAtRisk }: { hasSla: boolean; isBreached: boolean; isAtRisk: boolean }) {
  const baseStyle: Record<string, string | number> = {
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
    border: '1px solid #d1d5db',
    background: '#f3f4f6',
    color: '#374151',
    display: 'inline-flex',
    alignItems: 'center',
  }
  if (!hasSla) {
    return <span style={baseStyle}>SLA не задан</span>
  }
  if (isBreached) {
    return <span style={{ ...baseStyle, borderColor: '#fecdd3', background: '#fff1f2', color: '#9f1239' }}>SLA просрочен</span>
  }
  if (isAtRisk) {
    return <span style={{ ...baseStyle, borderColor: '#fde68a', background: '#fffbeb', color: '#92400e' }}>SLA близко</span>
  }
  return <span style={{ ...baseStyle, background: '#f9fafb' }}>SLA в норме</span>
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
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const observerCompanyId = (searchParams.get('companyId') || '').trim()
  const linkedClientCompanyId = (searchParams.get('linkedClientCompanyId') || '').trim()

  const ticketScope = useMemo<api.TicketScopeParams>(
    () => ({
      companyId: observerCompanyId || undefined,
      linkedClientCompanyId: linkedClientCompanyId || undefined,
    }),
    [observerCompanyId, linkedClientCompanyId],
  )

  const contextMode = observerCompanyId ? 'observer' : linkedClientCompanyId ? 'provider' : 'tenant'
  const backToBoardHref = observerCompanyId
    ? `/board?companyId=${observerCompanyId}`
    : linkedClientCompanyId
      ? `/board?linkedClientCompanyId=${linkedClientCompanyId}`
      : '/board'

  const [editOpen, setEditOpen] = useState(false)
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deleteAttachmentError, setDeleteAttachmentError] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [showFullTimeline, setShowFullTimeline] = useState(false)
  const [showAssignmentEditor, setShowAssignmentEditor] = useState(false)

  const [editProblemCategoryId, setEditProblemCategoryId] = useState('')
  const [editProblemText, setEditProblemText] = useState('')
  const [editEquipmentId, setEditEquipmentId] = useState('')
  const [editUrgency, setEditUrgency] = useState<api.TicketUrgency>('NOT_URGENT')
  const [editRequesterName, setEditRequesterName] = useState('')
  const [editRequesterPhone, setEditRequesterPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editPointName, setEditPointName] = useState('')

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const ticketQ = useQuery({
    enabled: !!ticketId,
    queryKey: ['ticket', ticketId, observerCompanyId, linkedClientCompanyId],
    queryFn: () => api.getTicket(ticketId, ticketScope),
  })

  const timelineQ = useQuery({
    enabled: !!ticketId,
    queryKey: ['timeline', ticketId, observerCompanyId, linkedClientCompanyId],
    queryFn: () => api.timeline(ticketId, ticketScope),
  })

  const attachmentsQ = useQuery({
    enabled: !!ticketId,
    queryKey: ['ticket-attachments', ticketId, observerCompanyId, linkedClientCompanyId],
    queryFn: () => api.ticketAttachments(ticketId, ticketScope),
  })

  const categoriesQ = useQuery({
    queryKey: ['problem-categories'],
    queryFn: api.problemCategories,
  })
  const equipmentQ = useQuery({
    queryKey: ['equipment-by-location', ticketQ.data?.location?.id || ''],
    queryFn: () => api.equipmentByLocation(ticketQ.data?.location?.id || ''),
    enabled: !!ticketQ.data?.location?.id && roleCanEdit(meQ.data?.role) && editOpen,
  })

  const role = meQ.data?.role
  const isClientRole = role === 'CLIENT'
  const readOnlyByVisibilityMode = contextMode !== 'tenant'
  const canMutateTicket = !readOnlyByVisibilityMode

  const canAssign = canMutateTicket && !isClientRole && roleCanAssign(role)
  const canEditTicket = canMutateTicket && roleCanEdit(role)
  const canChangeStatus = canMutateTicket && roleCanChangeStatus(role)
  const canUploadPhoto = canMutateTicket && roleCanUploadPhoto(role)
  const canDeletePhoto = canMutateTicket && roleCanUploadPhoto(role)

  const assignmentCandidatesQ = useQuery({
    enabled: !!ticketId && canAssign,
    queryKey: ['ticket-assignment-candidates', ticketId, observerCompanyId, linkedClientCompanyId],
    queryFn: () => api.getTicketAssignmentCandidates(ticketId, ticketScope),
  })

  const refreshAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['ticket', ticketId] }),
      qc.invalidateQueries({ queryKey: ['timeline', ticketId] }),
      qc.invalidateQueries({ queryKey: ['ticket-attachments', ticketId] }),
      qc.invalidateQueries({ queryKey: ['ticket-assignment-candidates', ticketId] }),
      qc.invalidateQueries({ queryKey: ['board'] }),
    ])
  }

  useEffect(() => {
    const t = ticketQ.data
    if (!t) return

    setEditProblemCategoryId(t.problemCategory?.id || '')
    setEditProblemText(t.problemText || '')
    setEditEquipmentId(t.equipment?.id || '')
    setEditUrgency(t.urgency)
    setEditRequesterName(t.requesterName || '')
    setEditRequesterPhone(t.requesterPhone || '')
    setEditAddress(t.address || '')
    setEditPointName(t.pointName || '')
  }, [ticketQ.data])

  useEffect(() => {
    if (!editOpen) return
    if (!ticketQ.data?.location?.id) {
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
      return api.claim(ticketId, ticketScope)
    },
    onSuccess: async () => {
      setClaimError(null)
      clearActionErrors()
      await refreshAll()
    },
    onError: (e: any) => setClaimError(e?.message || String(e)),
  })

  const assignM = useMutation({
    mutationFn: () => {
      if (isClientRole) throw new Error('Клиент не может назначать техников')
      if (!canMutateTicket) throw new Error('Изменение заявки запрещено в текущем режиме видимости')
      if (!selectedTechnicianId) throw new Error('Сначала выберите техника')
      return api.assignTicket(ticketId, selectedTechnicianId, ticketScope)
    },
    onSuccess: async () => {
      setAssignError(null)
      clearActionErrors()
      await refreshAll()
    },
    onError: (e: any) => setAssignError(e?.message || String(e)),
  })

  const statusM = useMutation({
    mutationFn: (status: api.TicketStatus) => {
      if (!canMutateTicket) throw new Error('Изменение заявки запрещено в текущем режиме видимости')
      return api.updateTicketStatus(ticketId, { status }, ticketScope)
    },
    onSuccess: async () => {
      setStatusError(null)
      clearActionErrors()
      await refreshAll()
    },
    onError: (e: any) => setStatusError(e?.message || String(e)),
  })

  const uploadM = useMutation({
    mutationFn: () => {
      if (!canMutateTicket) throw new Error('Изменение заявки запрещено в текущем режиме видимости')
      if (!selectedFile) throw new Error('Сначала выберите файл')
      return api.uploadTicketAttachment(ticketId, selectedFile, ticketScope)
    },
    onSuccess: async () => {
      setUploadError(null)
      setFileError(null)
      clearActionErrors()
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      await refreshAll()
    },
    onError: (e: any) => setUploadError(e?.message || String(e)),
  })

  const deleteAttachmentM = useMutation({
    mutationFn: (attachmentId: string) => {
      if (!canMutateTicket) throw new Error('Изменение заявки запрещено в текущем режиме видимости')
      return api.deleteTicketAttachment(ticketId, attachmentId, ticketScope)
    },
    onSuccess: async () => {
      setDeleteAttachmentError(null)
      clearActionErrors()
      await refreshAll()
    },
    onError: (e: any) => setDeleteAttachmentError(e?.message || String(e)),
  })

  const updateTicketM = useMutation({
    mutationFn: () =>
      {
        if (!canMutateTicket) throw new Error('Изменение заявки запрещено в текущем режиме видимости')
        return api.updateTicket(
          ticketId,
          {
            problemCategoryId: editProblemCategoryId,
            equipmentId: editEquipmentId || null,
            problemText: editProblemText,
            urgency: editUrgency,
            requesterName: editRequesterName || null,
            requesterPhone: editRequesterPhone || null,
            address: editAddress || null,
            pointName: editPointName || null,
          },
          ticketScope,
        )
      },
    onSuccess: async () => {
      setUpdateError(null)
      clearActionErrors()
      setEditOpen(false)
      setSelectedTechnicianId('')
      await refreshAll()
    },
    onError: (e: any) => setUpdateError(e?.message || String(e)),
  })

  const ticket = ticketQ.data
  const hasAssignedTechnician = !!ticket?.assignedTechnician
  const canClaim = useMemo(() => {
    if (role !== 'TECHNICIAN' || !ticket) return false
    if (!canMutateTicket) return false
    return ticket.meta?.canClaimByCurrentUser === true
  }, [role, ticket, canMutateTicket])

  const assignmentData = assignmentCandidatesQ.data
  const availableStatusTransitions = ticket?.meta?.availableStatusTransitions || []
  const canTransitionTo = (status: api.TicketStatus) => availableStatusTransitions.includes(status)
  const primaryAction = useMemo(() => {
    if (!ticket) return null as null | { kind: 'claim' | 'in_progress' | 'done'; label: string }
    if (ticket.status === 'DONE') return null

    if (ticket.status === 'NEW') {
      if (canClaim) return { kind: 'claim', label: 'Взять в работу' }
      if (canChangeStatus && canTransitionTo('IN_PROGRESS')) return { kind: 'in_progress', label: 'Взять в работу' }
      return null
    }
    if (ticket.status === 'ASSIGNED') {
      if (canChangeStatus && canTransitionTo('IN_PROGRESS')) return { kind: 'in_progress', label: 'Начать выполнение' }
      return null
    }
    if (ticket.status === 'IN_PROGRESS') {
      if (canChangeStatus && canTransitionTo('DONE')) return { kind: 'done', label: 'Завершить' }
      return null
    }
    return null
  }, [ticket, canClaim, canChangeStatus, availableStatusTransitions])

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
  const timelineItems = timelineQ.data?.items || []
  const timelinePreviewItems = useMemo(
    () => (showFullTimeline ? timelineItems : timelineItems.slice(0, 5)),
    [showFullTimeline, timelineItems],
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

  return (
    <div>
      <TicketHeader
        ticket={ticket}
        ticketId={ticketId}
        isFetching={ticketQ.isFetching}
        observerCompanyId={observerCompanyId}
        linkedClientCompanyId={linkedClientCompanyId}
        contextBadge={contextBadge}
        backToBoardHref={backToBoardHref}
        canEditTicket={false}
        editOpen={editOpen}
        onToggleEdit={() => setEditOpen((value) => !value)}
        role={role}
        canClaim={false}
        claimPending={claimM.isPending}
        meUserId={meQ.data?.id}
        onClaim={() => claimM.mutate()}
      />

      <InlineError message={claimError} />
      {ticketQ.isError ? <div className="alert">{(ticketQ.error as any)?.message || String(ticketQ.error)}</div> : null}
      {readOnlyByVisibilityMode ? (
        <div className="panel uiCard" style={{ marginBottom: 12 }}>
          <div className="muted small">
            Режим только просмотра: изменение заявки доступно только в tenant-контуре.
          </div>
        </div>
      ) : null}

      {ticket ? (
        <div className="panel uiCard" style={{ marginBottom: 12 }}>
          <div className="row" style={{ marginBottom: 0 }}>
            <div style={{ minWidth: 0 }}>
              <div className="muted small">Карточка заявки</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {ticket.id}
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>
                создана: {fmt(ticket.createdAt)} · обновлена: {fmt(ticket.updatedAt)}
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

      {ticket ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Кратко по заявке</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <div><b>Категория:</b> {ticket.problemCategory?.name || '—'}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <b>Статус:</b> <StatusPill status={ticket.status} />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <b>Приоритет:</b>
              <span
                className="tag"
                style={
                  ticket.urgency === 'URGENT'
                    ? { background: '#fff1f2', borderColor: '#fecdd3', color: '#9f1239', fontWeight: 700 }
                    : { background: '#f3f4f6', borderColor: '#e5e7eb', color: '#374151', fontWeight: 700 }
                }
              >
                {urgencyLabel(ticket.urgency)}
              </span>
              <SlaSignal hasSla={slaState.hasSla} isBreached={slaState.isBreached} isAtRisk={slaState.isAtRisk} />
              {ticket.slaDueAt ? <span className="muted small">срок {fmt(ticket.slaDueAt)}</span> : null}
            </div>
            <div>
              <b>Локация:</b>{' '}
              {ticket.location
                ? [ticket.location.name, ticket.location.city, ticket.location.address].filter(Boolean).join(' · ')
                : '—'}
            </div>
            <div><b>Описание:</b> {shortProblemText || '—'}</div>
            <div className="muted small"><b>Создана:</b> {fmt(ticket.createdAt)}</div>
          </div>
        </div>
      ) : null}

      {ticket ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Действия</h3>
          {primaryAction ? (
            <div style={{ marginBottom: 8 }}>
              {primaryAction.kind === 'claim' ? (
                <button
                  onClick={() => claimM.mutate()}
                  disabled={claimM.isPending}
                  style={{ width: '100%' }}
                >
                  {claimM.isPending ? 'Сохраняем…' : primaryAction.label}
                </button>
              ) : null}
              {primaryAction.kind === 'in_progress' ? (
                <button
                  onClick={() => statusM.mutate('IN_PROGRESS')}
                  disabled={statusM.isPending || !canTransitionTo('IN_PROGRESS')}
                  style={{ width: '100%' }}
                >
                  {statusM.isPending ? 'Сохраняем…' : primaryAction.label}
                </button>
              ) : null}
              {primaryAction.kind === 'done' ? (
                <button
                  onClick={() => statusM.mutate('DONE')}
                  disabled={statusM.isPending || !canTransitionTo('DONE')}
                  style={{ width: '100%' }}
                >
                  {statusM.isPending ? 'Сохраняем…' : primaryAction.label}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="uiActions">
            <a href={backToBoardHref} style={{ textDecoration: 'none' }}>
              <button className="ghost">← Назад к доске</button>
            </a>
            {canEditTicket ? (
              <button className="ghost" onClick={() => setEditOpen((value) => !value)}>
                {editOpen ? 'Скрыть редактирование' : 'Редактировать заявку'}
              </button>
            ) : null}
            {canClaim && primaryAction?.kind !== 'claim' ? (
              <button className="ghost" onClick={() => claimM.mutate()} disabled={claimM.isPending}>
                {claimM.isPending ? 'Забираем…' : 'Взять заявку'}
              </button>
            ) : null}
            {canChangeStatus ? (
              <>
                {primaryAction?.kind !== 'in_progress' ? (
                  <button className="ghost" disabled={statusM.isPending || !canTransitionTo('IN_PROGRESS')} onClick={() => statusM.mutate('IN_PROGRESS')}>
                    {statusM.isPending ? 'Сохраняем…' : 'В работу'}
                  </button>
                ) : null}
                {primaryAction?.kind !== 'done' ? (
                  <button className="ghost" disabled={statusM.isPending || !canTransitionTo('DONE')} onClick={() => statusM.mutate('DONE')}>
                    {statusM.isPending ? 'Сохраняем…' : 'Завершить'}
                  </button>
                ) : null}
                <button className="ghost" disabled={statusM.isPending || !canTransitionTo('CANCELED')} onClick={() => statusM.mutate('CANCELED')}>
                  {statusM.isPending ? 'Сохраняем…' : 'Отменить'}
                </button>
              </>
            ) : null}
          </div>
          <InlineError message={statusError} />
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => updateTicketM.mutate()} disabled={updateTicketM.isPending}>
                {updateTicketM.isPending ? 'Сохраняем…' : 'Сохранить изменения'}
              </button>
              <button
                className="ghost"
                onClick={() => {
                  if (!ticket) return
                  setEditProblemCategoryId(ticket.problemCategory?.id || '')
                  setEditProblemText(ticket.problemText || '')
                  setEditEquipmentId(ticket.equipment?.id || '')
                  setEditUrgency(ticket.urgency)
                  setEditRequesterName(ticket.requesterName || '')
                  setEditRequesterPhone(ticket.requesterPhone || '')
                  setEditAddress(ticket.address || '')
                  setEditPointName(ticket.pointName || '')
                  setEditOpen(false)
                  setUpdateError(null)
                }}
                disabled={updateTicketM.isPending}
              >
                Отмена
              </button>
            </div>
          </div>
          <InlineError message={(categoriesQ.error as any)?.message || (equipmentQ.error as any)?.message || updateError} />
        </div>
      ) : null}

      {ticket && canAssign && !isClientRole ? (
        <div className="panel uiCard" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Исполнитель</h3>
          <div className="uiCard" style={{ marginBottom: 10, padding: 10 }}>
            {hasAssignedTechnician ? (
              <div style={{ display: 'grid', gap: 6 }}>
                <div><b>Ответственный:</b> {ticket.assignedTechnician?.email}</div>
                <div className="muted small">Заявка закреплена за техником.</div>
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

      {ticket && canUploadPhoto ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Фото</h3>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} disabled={uploadM.isPending} />
            <button onClick={() => uploadM.mutate()} disabled={uploadM.isPending || !selectedFile}>
              {uploadM.isPending ? 'Загружаем…' : 'Загрузить фото'}
            </button>
            <div className="muted small">{selectedFile ? `${selectedFile.name} · ${fmtBytes(selectedFile.size)}` : 'Выберите изображение до 10 МБ'}</div>
          </div>
          <InlineError message={fileError || uploadError} />
        </div>
      ) : null}

      {ticket ? (
        <>
          <div className="panel uiCard" style={{ marginBottom: 12 }}>
            <h3 style={{ marginBottom: 10 }}>Дополнительно</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <details open>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Детали</summary>
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  <div><b>Категория:</b> {ticket.problemCategory?.name || '—'}</div>
                  <div><b>Срочность:</b> {urgencyLabel(ticket.urgency)}</div>
                  <div><b>SLA статус:</b> {slaState.isBreached ? 'Нарушен' : slaState.isAtRisk ? 'В риске' : ticket.slaDueAt ? 'В норме' : 'Не задан'}</div>
                  <div>
                    <b>Описание проблемы:</b>
                    <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{ticket.problemText || '—'}</div>
                  </div>
                </div>
              </details>

              <details>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Заявитель / контакт</summary>
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  <div><b>Заявитель:</b> {ticket.requesterName || '—'}</div>
                  <div><b>Телефон:</b> {ticket.requesterPhone || '—'}</div>
                  <div><b>Точка:</b> {ticket.pointName || '—'}</div>
                  <div><b>Адрес:</b> {ticket.address || '—'}</div>
                </div>
              </details>

              <details>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Оборудование / локация</summary>
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  <div>
                    <b>Локация:</b>{' '}
                    {ticket.location
                      ? [ticket.location.name, ticket.location.city, ticket.location.address].filter(Boolean).join(' · ')
                      : '—'}
                  </div>
                  <div>
                    <b>Оборудование / Asset:</b>{' '}
                    {ticket.equipment
                      ? [ticket.equipment.name, ticket.equipment.type, ticket.equipment.status].filter(Boolean).join(' · ')
                      : '—'}
                  </div>
                </div>
              </details>

              <details>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Extra info</summary>
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  {ticket.location?.platformCode || ticket.location?.externalCode ? (
                    <div className="muted small">
                      {ticket.location?.platformCode ? `platformCode: ${ticket.location.platformCode}` : ''}
                      {ticket.location?.platformCode && ticket.location?.externalCode ? ' · ' : ''}
                      {ticket.location?.externalCode ? `externalCode: ${ticket.location.externalCode}` : ''}
                    </div>
                  ) : (
                    <div className="muted small">Коды локации не заданы</div>
                  )}
                  <div><b>Назначен:</b> {ticket.assignedTechnician?.email || '—'}</div>
                  {ticket.problemCategory?.instructions ? (
                    <div>
                      <b>Инструкции категории:</b>
                      <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{ticket.problemCategory.instructions}</div>
                    </div>
                  ) : null}
                </div>
              </details>
            </div>
          </div>

          <TicketAttachments
            loading={attachmentsQ.isLoading}
            isError={attachmentsQ.isError}
            error={attachmentsQ.error}
            data={attachmentsQ.data}
            canDeletePhoto={canDeletePhoto}
            deletePending={deleteAttachmentM.isPending}
            onDelete={(attachmentId) => deleteAttachmentM.mutate(attachmentId)}
            deleteAttachmentError={deleteAttachmentError}
            fmt={fmt}
            fmtBytes={fmtBytes}
          />

          <div className="panel uiCard" style={{ marginBottom: 12 }}>
            <h3 style={{ marginBottom: 10 }}>История</h3>
            {timelineQ.isLoading ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <Skeleton w={320} h={16} />
                <Skeleton w={360} h={16} />
                <Skeleton w={300} h={16} />
              </div>
            ) : timelineQ.isError ? (
              <div className="alert">{(timelineQ.error as any)?.message || String(timelineQ.error)}</div>
            ) : timelineItems.length ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {timelinePreviewItems.map((item, idx) => (
                  <div key={`${item.at}-${item.type}-${idx}`} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <b>{item.title}</b>
                      <Tag>{sourceLabel(item.source)}</Tag>
                      <Tag>{timelineTypeLabel(item.type || item.domainType || item.timelineEvent || 'event')}</Tag>
                    </div>
                    <div className="muted small">{fmt(item.at)} · {item.actor?.email || 'система'}</div>
                    {item.payload ? (
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, fontSize: 12 }}>
                        {JSON.stringify(item.payload, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))}
                {timelineItems.length > 5 ? (
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => setShowFullTimeline((value) => !value)}
                  >
                    {showFullTimeline ? 'Скрыть полный таймлайн' : `Показать полный таймлайн (${timelineItems.length})`}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="muted small">Событий пока нет</div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
