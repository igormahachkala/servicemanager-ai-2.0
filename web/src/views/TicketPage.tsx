import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

const MANAGEMENT_ROLES: api.Role[] = ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR']
const EDIT_ROLES: api.Role[] = ['ADMIN', 'MASTER', 'DISPATCHER']
const STATUS_CHANGE_ROLES: api.Role[] = ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR', 'TECHNICIAN']
const PHOTO_ROLES: api.Role[] = ['ADMIN', 'MASTER', 'DISPATCHER', 'NETWORK_DIRECTOR', 'TECHNICIAN']

function fmt(dt?: string | null) {
  if (!dt) return 'вЂ”'
  try {
    return new Date(dt).toLocaleString('ru-RU')
  } catch {
    return dt
  }
}

function fmtBytes(v?: number | null) {
  if (!v || v <= 0) return 'вЂ”'
  if (v < 1024) return `${v} Р‘`
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} РљР‘`
  return `${(v / (1024 * 1024)).toFixed(1)} РњР‘`
}

function statusLabel(status: api.TicketStatus) {
  if (status === 'NEW') return 'РќРѕРІР°СЏ'
  if (status === 'ASSIGNED') return 'РќР°Р·РЅР°С‡РµРЅР°'
  if (status === 'IN_PROGRESS') return 'Р’ СЂР°Р±РѕС‚Рµ'
  if (status === 'DONE') return 'Р—Р°РІРµСЂС€РµРЅР°'
  if (status === 'CANCELED') return 'РћС‚РјРµРЅРµРЅР°'
  return status
}

function urgencyLabel(urgency: api.TicketUrgency) {
  if (urgency === 'URGENT') return 'РЎСЂРѕС‡РЅРѕ'
  if (urgency === 'NOT_URGENT') return 'РќРµ СЃСЂРѕС‡РЅРѕ'
  return urgency
}

function sourceLabel(source: api.TimelineItem['source']) {
  if (source === 'history' || source === 'status_history') return 'РСЃС‚РѕСЂРёСЏ СЃС‚Р°С‚СѓСЃРѕРІ'
  if (source === 'event' || source === 'domain_event') return 'РЎРѕР±С‹С‚РёРµ СЃРёСЃС‚РµРјС‹'
  return source
}

function timelineTypeLabel(type: string) {
  if (type === 'ticket.sla_warning') return 'РџСЂРµРґСѓРїСЂРµР¶РґРµРЅРёРµ SLA'
  if (type === 'ticket.sla_breached') return 'РќР°СЂСѓС€РµРЅРёРµ SLA'
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
    padding: '4px 10px',
    fontSize: 12,
    border: '1px solid #e5e7eb',
    background: '#f3f4f6',
    color: '#374151',
  }

  if (status === 'NEW') Object.assign(style, { background: '#eef2ff', borderColor: '#c7d2fe', color: '#3730a3' })
  if (status === 'ASSIGNED') Object.assign(style, { background: '#ecfeff', borderColor: '#a5f3fc', color: '#155e75' })
  if (status === 'IN_PROGRESS') Object.assign(style, { background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' })
  if (status === 'DONE') Object.assign(style, { background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' })
  if (status === 'CANCELED') Object.assign(style, { background: '#f3f4f6', borderColor: '#e5e7eb', color: '#6b7280' })

  return <span style={style}>{statusLabel(status)}</span>
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
    return <span className="uxBadge uxBadgeSuccess">РџРѕРґС…РѕРґРёС‚{matchedBy.length ? `: ${matchedBy.join(', ')}` : ''}</span>
  }

  return <span className="uxBadge uxBadgeWarn">РќРµ РїРѕРґС…РѕРґРёС‚ РїРѕ СЃРїРµС†РёР°Р»РёР·Р°С†РёСЏРј</span>
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

  const [editProblemCategoryId, setEditProblemCategoryId] = useState('')
  const [editProblemText, setEditProblemText] = useState('')
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

  const role = meQ.data?.role
  const canAssign = roleCanAssign(role)
  const canEditTicket = roleCanEdit(role)
  const canChangeStatus = roleCanChangeStatus(role)
  const canUploadPhoto = roleCanUploadPhoto(role)
  const canDeletePhoto = roleCanUploadPhoto(role)

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
    setEditUrgency(t.urgency)
    setEditRequesterName(t.requesterName || '')
    setEditRequesterPhone(t.requesterPhone || '')
    setEditAddress(t.address || '')
    setEditPointName(t.pointName || '')
  }, [ticketQ.data])

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
    mutationFn: () => api.claim(ticketId, ticketScope),
    onSuccess: async () => {
      setClaimError(null)
      clearActionErrors()
      await refreshAll()
    },
    onError: (e: any) => setClaimError(e?.message || String(e)),
  })

  const assignM = useMutation({
    mutationFn: () => {
      if (!selectedTechnicianId) throw new Error('РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРёС‚Рµ С‚РµС…РЅРёРєР°')
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
    mutationFn: (status: api.TicketStatus) => api.updateTicketStatus(ticketId, { status }, ticketScope),
    onSuccess: async () => {
      setStatusError(null)
      clearActionErrors()
      await refreshAll()
    },
    onError: (e: any) => setStatusError(e?.message || String(e)),
  })

  const uploadM = useMutation({
    mutationFn: () => {
      if (!selectedFile) throw new Error('РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРёС‚Рµ С„Р°Р№Р»')
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
    mutationFn: (attachmentId: string) => api.deleteTicketAttachment(ticketId, attachmentId, ticketScope),
    onSuccess: async () => {
      setDeleteAttachmentError(null)
      clearActionErrors()
      await refreshAll()
    },
    onError: (e: any) => setDeleteAttachmentError(e?.message || String(e)),
  })

  const updateTicketM = useMutation({
    mutationFn: () =>
      api.updateTicket(
        ticketId,
        {
          problemCategoryId: editProblemCategoryId,
          problemText: editProblemText,
          urgency: editUrgency,
          requesterName: editRequesterName || null,
          requesterPhone: editRequesterPhone || null,
          address: editAddress || null,
          pointName: editPointName || null,
        },
        ticketScope,
      ),
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
  const canClaim = useMemo(() => {
    if (role !== 'TECHNICIAN' || !ticket) return false
    return ticket.status === 'NEW' && !ticket.assignedTechnicianId
  }, [role, ticket])

  const assignmentData = assignmentCandidatesQ.data

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
    if (contextMode === 'observer') return 'Р РµР¶РёРј РЅР°Р±Р»СЋРґРµРЅРёСЏ'
    if (contextMode === 'provider') return 'Р РµР¶РёРј РїРѕРґСЂСЏРґС‡РёРєР°'
    return 'РљРѕРЅС‚РµРєСЃС‚ РєРѕРјРїР°РЅРёРё'
  }, [contextMode])

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
      setFileError('РњРѕР¶РЅРѕ Р·Р°РіСЂСѓР¶Р°С‚СЊ С‚РѕР»СЊРєРѕ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ')
      return
    }

    if (file.size <= 0) {
      setSelectedFile(null)
      e.target.value = ''
      setFileError('Р¤Р°Р№Р» РїСѓСЃС‚РѕР№')
      return
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setSelectedFile(null)
      e.target.value = ''
      setFileError('РР·РѕР±СЂР°Р¶РµРЅРёРµ СЃР»РёС€РєРѕРј Р±РѕР»СЊС€РѕРµ. РњР°РєСЃРёРјСѓРј 10 РњР‘.')
      return
    }

    setSelectedFile(file)
  }

  return (
    <div>
      <div className="row">
        <h2>Р—Р°СЏРІРєР°</h2>
        <div className="muted small">{ticketQ.isFetching && !ticket ? 'Р—Р°РіСЂСѓР·РєР°вЂ¦' : ticket?.id || 'вЂ”'}</div>
      </div>

      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="row" style={{ marginBottom: 0 }}>
          <div>
            <div className="muted small">РљРѕРЅС‚РµРєСЃС‚ РґРѕСЃС‚СѓРїР°</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
              <Tag>{contextBadge}</Tag>
              {observerCompanyId ? <Tag>companyId: {observerCompanyId}</Tag> : null}
              {linkedClientCompanyId ? <Tag>linkedClientCompanyId: {linkedClientCompanyId}</Tag> : null}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to={backToBoardHref}>
              <button className="ghost">в†ђ РќР°Р·Р°Рґ Рє РґРѕСЃРєРµ</button>
            </Link>

            {canEditTicket ? (
              <button className="ghost" onClick={() => setEditOpen((value) => !value)}>
                {editOpen ? 'РЎРєСЂС‹С‚СЊ СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ' : 'Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ Р·Р°СЏРІРєСѓ'}
              </button>
            ) : null}

            {canClaim ? (
              <button onClick={() => claimM.mutate()} disabled={claimM.isPending}>
                {claimM.isPending ? 'Р—Р°Р±РёСЂР°РµРјвЂ¦' : 'Р’Р·СЏС‚СЊ Р·Р°СЏРІРєСѓ'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <InlineError message={claimError} />
      {ticketQ.isError ? <div className="alert">{(ticketQ.error as any)?.message || String(ticketQ.error)}</div> : null}

      {ticket ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="row" style={{ marginBottom: 0 }}>
            <div style={{ minWidth: 0 }}>
              <div className="muted small">РљР°СЂС‚РѕС‡РєР° Р·Р°СЏРІРєРё</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {ticket.id}
              </div>
              <div className="muted small" style={{ marginTop: 4 }}>
                СЃРѕР·РґР°РЅР°: {fmt(ticket.createdAt)} В· РѕР±РЅРѕРІР»РµРЅР°: {fmt(ticket.updatedAt)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <StatusPill status={ticket.status} />
              {slaState.isBreached ? <span className="tag danger">SLA РЅР°СЂСѓС€РµРЅ</span> : null}
              {!slaState.isBreached && slaState.isAtRisk ? <span className="tag">SLA РІ СЂРёСЃРєРµ</span> : null}
              <span className="tag">СЃСЂРѕРє: {ticket.slaDueAt ? fmt(ticket.slaDueAt) : 'вЂ”'}</span>
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

      {ticket && canChangeStatus ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Р”РµР№СЃС‚РІРёСЏ РїРѕ Р·Р°СЏРІРєРµ</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="ghost" disabled={statusM.isPending || ticket.status === 'IN_PROGRESS'} onClick={() => statusM.mutate('IN_PROGRESS')}>
              {statusM.isPending ? 'РЎРѕС…СЂР°РЅСЏРµРјвЂ¦' : 'РќР°С‡Р°С‚СЊ СЂР°Р±РѕС‚Сѓ'}
            </button>
            <button className="ghost" disabled={statusM.isPending || ticket.status === 'DONE'} onClick={() => statusM.mutate('DONE')}>
              {statusM.isPending ? 'РЎРѕС…СЂР°РЅСЏРµРјвЂ¦' : 'Р—Р°РІРµСЂС€РёС‚СЊ'}
            </button>
            <button className="ghost" disabled={statusM.isPending || ticket.status === 'CANCELED'} onClick={() => statusM.mutate('CANCELED')}>
              {statusM.isPending ? 'РЎРѕС…СЂР°РЅСЏРµРјвЂ¦' : 'РћС‚РјРµРЅРёС‚СЊ'}
            </button>
          </div>
          <InlineError message={statusError} />
        </div>
      ) : null}

      {ticket && canEditTicket && editOpen ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ Р·Р°СЏРІРєРё</h3>
          <div className="form">
            <label>
              РљР°С‚РµРіРѕСЂРёСЏ
              <select value={editProblemCategoryId} onChange={(e) => setEditProblemCategoryId(e.target.value)} disabled={updateTicketM.isPending}>
                <option value="">Р’С‹Р±РµСЂРёС‚Рµ РєР°С‚РµРіРѕСЂРёСЋ</option>
                {(categoriesQ.data || []).filter((row) => row.isActive !== false).map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </label>
            <label>
              РћРїРёСЃР°РЅРёРµ РїСЂРѕР±Р»РµРјС‹
              <textarea value={editProblemText} onChange={(e) => setEditProblemText(e.target.value)} rows={5} disabled={updateTicketM.isPending} />
            </label>
            <label>
              РЎСЂРѕС‡РЅРѕСЃС‚СЊ
              <select value={editUrgency} onChange={(e) => setEditUrgency(e.target.value as api.TicketUrgency)} disabled={updateTicketM.isPending}>
                <option value="NOT_URGENT">РќРµ СЃСЂРѕС‡РЅРѕ</option>
                <option value="URGENT">РЎСЂРѕС‡РЅРѕ</option>
              </select>
            </label>
            <label>
              Р—Р°СЏРІРёС‚РµР»СЊ
              <input value={editRequesterName} onChange={(e) => setEditRequesterName(e.target.value)} disabled={updateTicketM.isPending} />
            </label>
            <label>
              РўРµР»РµС„РѕРЅ
              <input value={editRequesterPhone} onChange={(e) => setEditRequesterPhone(e.target.value)} disabled={updateTicketM.isPending} />
            </label>
            <label>
              РўРѕС‡РєР°
              <input value={editPointName} onChange={(e) => setEditPointName(e.target.value)} disabled={updateTicketM.isPending} />
            </label>
            <label>
              РђРґСЂРµСЃ
              <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} disabled={updateTicketM.isPending} />
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => updateTicketM.mutate()} disabled={updateTicketM.isPending}>
                {updateTicketM.isPending ? 'РЎРѕС…СЂР°РЅСЏРµРјвЂ¦' : 'РЎРѕС…СЂР°РЅРёС‚СЊ РёР·РјРµРЅРµРЅРёСЏ'}
              </button>
              <button
                className="ghost"
                onClick={() => {
                  if (!ticket) return
                  setEditProblemCategoryId(ticket.problemCategory?.id || '')
                  setEditProblemText(ticket.problemText || '')
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
                РћС‚РјРµРЅР°
              </button>
            </div>
          </div>
          <InlineError message={(categoriesQ.error as any)?.message || updateError} />
        </div>
      ) : null}

      {ticket && canAssign ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 10 }}>РќР°Р·РЅР°С‡РёС‚СЊ С‚РµС…РЅРёРєР°</h3>
          {assignmentCandidatesQ.isLoading ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <Skeleton w={240} h={16} />
              <Skeleton w={320} h={36} />
            </div>
          ) : assignmentCandidatesQ.isError ? (
            <div className="alert">{(assignmentCandidatesQ.error as any)?.message || String(assignmentCandidatesQ.error)}</div>
          ) : assignmentData ? (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <Tag>РљР°С‚РµРіРѕСЂРёСЏ: {assignmentData.category.name}</Tag>
                <Tag>
                  РўСЂРµР±СѓРµРјС‹Рµ СЃРїРµС†РёР°Р»РёР·Р°С†РёРё: {assignmentData.requiredSpecializations.length ? assignmentData.requiredSpecializations.map((item) => item.name).join(', ') : 'РЅРµ Р·Р°РґР°РЅС‹'}
                </Tag>
                <Tag>РџРѕРґС…РѕРґСЏС‰РёС…: {assignmentData.matched.length}</Tag>
                <Tag>РћСЃС‚Р°Р»СЊРЅС‹С…: {assignmentData.others.length}</Tag>
              </div>
              <div className="assignmentHintBox">
                <div className="assignmentHintTitle">Р РµРєРѕРјРµРЅРґР°С†РёСЏ</div>
                <div className="muted small">РЎРЅР°С‡Р°Р»Р° РїРѕРєР°Р·Р°РЅС‹ С‚РµС…РЅРёРєРё, РєРѕС‚РѕСЂС‹Рµ РїРѕРґС…РѕРґСЏС‚ РїРѕ СЃРїРµС†РёР°Р»РёР·Р°С†РёСЏРј РєР°С‚РµРіРѕСЂРёРё. РќРёР¶Рµ вЂ” РѕСЃС‚Р°Р»СЊРЅС‹Рµ С‚РµС…РЅРёРєРё РєРѕРјРїР°РЅРёРё.</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                <select value={selectedTechnicianId} onChange={(e) => setSelectedTechnicianId(e.target.value)} style={{ minWidth: 420 }}>
                  <option value="">Р’С‹Р±РµСЂРёС‚Рµ С‚РµС…РЅРёРєР°</option>
                  {assignmentData.matched.length > 0 ? (
                    <optgroup label="РџРѕРґС…РѕРґСЏС‰РёРµ С‚РµС…РЅРёРєРё">
                      {assignmentData.matched.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.email}{item.id === assignmentData.currentAssigneeId ? ' В· С‚РµРєСѓС‰РёР№' : ''}{item.matchedBy.length ? ` В· РїРѕРґС…РѕРґРёС‚: ${item.matchedBy.join(', ')}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {assignmentData.others.length > 0 ? (
                    <optgroup label="РћСЃС‚Р°Р»СЊРЅС‹Рµ С‚РµС…РЅРёРєРё">
                      {assignmentData.others.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.email}{item.id === assignmentData.currentAssigneeId ? ' В· С‚РµРєСѓС‰РёР№' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
                <button onClick={() => assignM.mutate()} disabled={assignM.isPending || !selectedTechnicianId}>
                  {assignM.isPending ? 'РќР°Р·РЅР°С‡Р°РµРјвЂ¦' : 'РќР°Р·РЅР°С‡РёС‚СЊ'}
                </button>
                <div className="muted small">РўРµРєСѓС‰РёР№: {ticket.assignedTechnician?.email || 'вЂ”'}</div>
              </div>
              {selectedCandidate ? (
                <div className="assignmentSelectedBox">
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Р’С‹Р±СЂР°РЅРЅС‹Р№ С‚РµС…РЅРёРє</div>
                  <div style={{ marginBottom: 6 }}>{selectedCandidate.email}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <RecommendationBadge matched={selectedCandidate.matched} matchedBy={selectedCandidate.matchedBy} />
                    {selectedIsCurrent ? <span className="uxBadge uxBadgeNeutral">РўРµРєСѓС‰РёР№ РёСЃРїРѕР»РЅРёС‚РµР»СЊ</span> : null}
                  </div>
                  {!selectedIsMatched ? <div className="assignmentWarning">Р’РЅРёРјР°РЅРёРµ: РІС‹Р±СЂР°РЅ С‚РµС…РЅРёРє, РєРѕС‚РѕСЂС‹Р№ РЅРµ РІС…РѕРґРёС‚ РІ СЂРµРєРѕРјРµРЅРґРѕРІР°РЅРЅС‹Р№ СЃРїРёСЃРѕРє РїРѕ СЃРїРµС†РёР°Р»РёР·Р°С†РёСЏРј РєР°С‚РµРіРѕСЂРёРё.</div> : null}
                </div>
              ) : null}
              <InlineError message={assignError} />
            </>
          ) : null}
        </div>
      ) : null}

      {ticket && canUploadPhoto ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Р¤РѕС‚Рѕ</h3>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} disabled={uploadM.isPending} />
            <button onClick={() => uploadM.mutate()} disabled={uploadM.isPending || !selectedFile}>
              {uploadM.isPending ? 'Р—Р°РіСЂСѓР¶Р°РµРјвЂ¦' : 'Р—Р°РіСЂСѓР·РёС‚СЊ С„РѕС‚Рѕ'}
            </button>
            <div className="muted small">{selectedFile ? `${selectedFile.name} В· ${fmtBytes(selectedFile.size)}` : 'Р’С‹Р±РµСЂРёС‚Рµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ РґРѕ 10 РњР‘'}</div>
          </div>
          <InlineError message={fileError || uploadError} />
        </div>
      ) : null}

      {ticket ? (
        <>
          <div className="panel" style={{ marginBottom: 12 }}>
            <h3 style={{ marginBottom: 10 }}>Р”РµС‚Р°Р»Рё Р·Р°СЏРІРєРё</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <div><b>РљР°С‚РµРіРѕСЂРёСЏ:</b> {ticket.problemCategory?.name || 'вЂ”'}</div>
              <div><b>РЎСЂРѕС‡РЅРѕСЃС‚СЊ:</b> {urgencyLabel(ticket.urgency)}</div>
              <div><b>РќР°Р·РЅР°С‡РµРЅ:</b> {ticket.assignedTechnician?.email || 'вЂ”'}</div>
              <div><b>SLA СЃС‚Р°С‚СѓСЃ:</b> {slaState.isBreached ? 'РќР°СЂСѓС€РµРЅ' : slaState.isAtRisk ? 'Р’ СЂРёСЃРєРµ' : ticket.slaDueAt ? 'Р’ РЅРѕСЂРјРµ' : 'РќРµ Р·Р°РґР°РЅ'}</div>
              <div><b>Р—Р°СЏРІРёС‚РµР»СЊ:</b> {ticket.requesterName || 'вЂ”'}</div>
              <div><b>РўРµР»РµС„РѕРЅ:</b> {ticket.requesterPhone || 'вЂ”'}</div>
              <div><b>РўРѕС‡РєР°:</b> {ticket.pointName || 'вЂ”'}</div>
              <div><b>РђРґСЂРµСЃ:</b> {ticket.address || 'вЂ”'}</div>
              <div>
                <b>РћРїРёСЃР°РЅРёРµ РїСЂРѕР±Р»РµРјС‹:</b>
                <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{ticket.problemText || 'вЂ”'}</div>
              </div>
              {ticket.problemCategory?.instructions ? (
                <div>
                  <b>РРЅСЃС‚СЂСѓРєС†РёРё РєР°С‚РµРіРѕСЂРёРё:</b>
                  <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{ticket.problemCategory.instructions}</div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 12 }}>
            <h3 style={{ marginBottom: 10 }}>Р’Р»РѕР¶РµРЅРёСЏ</h3>
            {attachmentsQ.isLoading ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <Skeleton w={280} h={16} />
                <Skeleton w={340} h={16} />
              </div>
            ) : attachmentsQ.isError ? (
              <div className="alert">{(attachmentsQ.error as any)?.message || String(attachmentsQ.error)}</div>
            ) : attachmentsQ.data && attachmentsQ.data.length > 0 ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {attachmentsQ.data.map((attachment) => (
                  <div key={attachment.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <img src={api.resolveFileUrl(attachment.url)} alt={attachment.originalName} style={{ width: 220, maxWidth: '100%', borderRadius: 10, border: '1px solid #e5e7eb', objectFit: 'cover' }} />
                      <div style={{ display: 'grid', gap: 6, minWidth: 240 }}>
                        <div><b>{attachment.originalName}</b></div>
                        <div className="muted small">Р Р°Р·РјРµСЂ: {fmtBytes(attachment.sizeBytes)}</div>
                        <div className="muted small">Р—Р°РіСЂСѓР¶РµРЅРѕ: {fmt(attachment.createdAt)}</div>
                        <div className="muted small">РљРµРј: {attachment.uploadedBy?.email || 'вЂ”'}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                          <a href={api.resolveFileUrl(attachment.url)} target="_blank" rel="noreferrer">
                            <button className="ghost">РћС‚РєСЂС‹С‚СЊ</button>
                          </a>
                          {canDeletePhoto ? (
                            <button className="ghost" onClick={() => deleteAttachmentM.mutate(attachment.id)} disabled={deleteAttachmentM.isPending}>
                              {deleteAttachmentM.isPending ? 'РЈРґР°Р»СЏРµРјвЂ¦' : 'РЈРґР°Р»РёС‚СЊ'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted small">Р’Р»РѕР¶РµРЅРёР№ РїРѕРєР° РЅРµС‚</div>
            )}
            <InlineError message={deleteAttachmentError} />
          </div>

          <div className="panel" style={{ marginBottom: 12 }}>
            <h3 style={{ marginBottom: 10 }}>РСЃС‚РѕСЂРёСЏ</h3>
            {timelineQ.isLoading ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <Skeleton w={320} h={16} />
                <Skeleton w={360} h={16} />
                <Skeleton w={300} h={16} />
              </div>
            ) : timelineQ.isError ? (
              <div className="alert">{(timelineQ.error as any)?.message || String(timelineQ.error)}</div>
            ) : timelineQ.data?.items?.length ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {timelineQ.data.items.map((item, idx) => (
                  <div key={`${item.at}-${item.type}-${idx}`} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <b>{item.title}</b>
                      <Tag>{sourceLabel(item.source)}</Tag>
                      <Tag>{timelineTypeLabel(item.type || item.domainType || item.timelineEvent || 'event')}</Tag>
                    </div>
                    <div className="muted small">{fmt(item.at)} В· {item.actor?.email || 'СЃРёСЃС‚РµРјР°'}</div>
                    {item.payload ? (
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, fontSize: 12 }}>
                        {JSON.stringify(item.payload, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted small">РЎРѕР±С‹С‚РёР№ РїРѕРєР° РЅРµС‚</div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
