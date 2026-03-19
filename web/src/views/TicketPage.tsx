import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

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
  if (source === 'status_history') return 'История статусов'
  if (source === 'domain_event') return 'Событие системы'
  return source
}

function timelineTypeLabel(type: string) {
  if (type === 'ticket.sla_warning') return 'SLA warning'
  if (type === 'ticket.sla_breached') return 'SLA breached'
  return type
}

function StatusPill({ status }: { status: api.TicketStatus }) {
  const style: React.CSSProperties = {
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 12,
    border: '1px solid #e5e7eb',
    background: '#f3f4f6',
    color: '#374151',
  }

  if (status === 'NEW') Object.assign(style, { background: '#eef2ff', borderColor: '#c7d2fe', color: '#3730a3' })
  if (status === 'ASSIGNED') {
    Object.assign(style, { background: '#ecfeff', borderColor: '#a5f3fc', color: '#155e75' })
  }
  if (status === 'IN_PROGRESS') {
    Object.assign(style, { background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' })
  }
  if (status === 'DONE') Object.assign(style, { background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' })
  if (status === 'CANCELED') {
    Object.assign(style, { background: '#f3f4f6', borderColor: '#e5e7eb', color: '#6b7280' })
  }

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

function Tag({ children }: { children: React.ReactNode }) {
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

function RecommendationBadge({
  matched,
  matchedBy,
}: {
  matched: boolean
  matchedBy: string[]
}) {
  if (matched) {
    return (
      <span className="uxBadge uxBadgeSuccess">
        Подходит{matchedBy.length ? `: ${matchedBy.join(', ')}` : ''}
      </span>
    )
  }

  return <span className="uxBadge uxBadgeWarn">Не подходит по специализациям</span>
}

export function TicketPage() {
  const { id } = useParams()
  const ticketId = id || ''
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [err, setErr] = useState<string | null>(null)
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const [editOpen, setEditOpen] = useState(false)
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
    queryKey: ['ticket', ticketId],
    queryFn: () => api.getTicket(ticketId),
  })

  const timelineQ = useQuery({
    enabled: !!ticketId,
    queryKey: ['timeline', ticketId],
    queryFn: () => api.timeline(ticketId),
  })

  const attachmentsQ = useQuery({
    enabled: !!ticketId,
    queryKey: ['ticket-attachments', ticketId],
    queryFn: () => api.ticketAttachments(ticketId),
  })

  const categoriesQ = useQuery({
    queryKey: ['problem-categories'],
    queryFn: api.problemCategories,
  })

  const canAssign = useMemo(() => {
    const me = meQ.data
    return me?.role === 'ADMIN' || me?.role === 'MASTER' || me?.role === 'DISPATCHER'
  }, [meQ.data])

  const assignmentCandidatesQ = useQuery({
    enabled: !!ticketId && canAssign,
    queryKey: ['ticket-assignment-candidates', ticketId],
    queryFn: () => api.getTicketAssignmentCandidates(ticketId),
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

    const current = data.currentAssigneeId
    if (current) {
      setSelectedTechnicianId(current)
      return
    }

    if (data.matched.length > 0) {
      setSelectedTechnicianId(data.matched[0].id)
    }
  }, [assignmentCandidatesQ.data, selectedTechnicianId])

  const claimM = useMutation({
    mutationFn: () => api.claim(ticketId),
    onSuccess: async () => {
      setErr(null)
      await refreshAll()
    },
    onError: (e: any) => setErr(e?.message || String(e)),
  })

  const assignM = useMutation({
    mutationFn: () => {
      if (!selectedTechnicianId) throw new Error('Сначала выбери техника')
      return api.assignTicket(ticketId, selectedTechnicianId)
    },
    onSuccess: async () => {
      setErr(null)
      await refreshAll()
    },
    onError: (e: any) => setErr(e?.message || String(e)),
  })

  const statusM = useMutation({
    mutationFn: (status: api.TicketStatus) => api.updateTicketStatus(ticketId, { status }),
    onSuccess: async () => {
      setErr(null)
      await refreshAll()
    },
    onError: (e: any) => setErr(e?.message || String(e)),
  })

  const uploadM = useMutation({
    mutationFn: () => {
      if (!selectedFile) throw new Error('Сначала выбери файл')
      return api.uploadTicketAttachment(ticketId, selectedFile)
    },
    onSuccess: async () => {
      setErr(null)
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      await refreshAll()
    },
    onError: (e: any) => setErr(e?.message || String(e)),
  })

  const deleteAttachmentM = useMutation({
    mutationFn: (attachmentId: string) => api.deleteTicketAttachment(ticketId, attachmentId),
    onSuccess: async () => {
      setErr(null)
      await refreshAll()
    },
    onError: (e: any) => setErr(e?.message || String(e)),
  })

  const updateTicketM = useMutation({
    mutationFn: () =>
      api.updateTicket(ticketId, {
        problemCategoryId: editProblemCategoryId,
        problemText: editProblemText,
        urgency: editUrgency,
        requesterName: editRequesterName || null,
        requesterPhone: editRequesterPhone || null,
        address: editAddress || null,
        pointName: editPointName || null,
      }),
    onSuccess: async () => {
      setErr(null)
      setEditOpen(false)
      setSelectedTechnicianId('')
      await refreshAll()
    },
    onError: (e: any) => setErr(e?.message || String(e)),
  })

  const canClaim = useMemo(() => {
    const me = meQ.data
    const t = ticketQ.data
    if (!me || !t) return false
    return me.role === 'TECHNICIAN' && t.status === 'NEW' && !t.assignedTechnicianId
  }, [meQ.data, ticketQ.data])

  const canEditTicket = canAssign

  const canChangeStatus = useMemo(() => {
    const me = meQ.data
    if (!me) return false
    return (
      me.role === 'ADMIN' ||
      me.role === 'MASTER' ||
      me.role === 'DISPATCHER' ||
      me.role === 'NETWORK_DIRECTOR' ||
      me.role === 'TECHNICIAN'
    )
  }, [meQ.data])

  const canUploadPhoto = canChangeStatus
  const canDeletePhoto = canChangeStatus

  const ticket = ticketQ.data
  const isLoading = ticketQ.isFetching && !ticketQ.data
  const assignmentData = assignmentCandidatesQ.data

  const selectedCandidate = useMemo(() => {
    if (!assignmentData || !selectedTechnicianId) return null
    return [...assignmentData.matched, ...assignmentData.others].find((x) => x.id === selectedTechnicianId) || null
  }, [assignmentData, selectedTechnicianId])

  const selectedIsMatched = !!selectedCandidate?.matched
  const selectedIsCurrent = !!assignmentData?.currentAssigneeId && assignmentData.currentAssigneeId === selectedTechnicianId

  const slaState = useMemo(() => {
    if (!ticket?.slaDueAt) {
      return {
        hasSla: false,
        isBreached: false,
        isAtRisk: false,
      }
    }

    const nowMs = Date.now()
    const dueMs = new Date(ticket.slaDueAt).getTime()
    const warningWindowMs = 60 * 60_000

    const isBreached = !!ticket.slaBreachedAt || nowMs > dueMs
    const isAtRisk = !isBreached && nowMs >= dueMs - warningWindowMs

    return {
      hasSla: true,
      isBreached,
      isAtRisk,
    }
  }, [ticket?.slaDueAt, ticket?.slaBreachedAt])

  const header = useMemo(() => {
    if (!ticket) return null
    return (
      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="row" style={{ marginBottom: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div className="muted small">Заявка</div>
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
            {ticket.slaDueAt ? <span className="tag">срок: {fmt(ticket.slaDueAt)}</span> : <span className="tag">срок: —</span>}
          </div>
        </div>
      </div>
    )
  }, [ticket, slaState.isAtRisk, slaState.isBreached])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setErr(null)

    const file = e.target.files?.[0] || null
    if (!file) {
      setSelectedFile(null)
      return
    }

    if (!file.type.startsWith('image/')) {
      setSelectedFile(null)
      e.target.value = ''
      setErr('Можно загружать только изображения')
      return
    }

    if (file.size <= 0) {
      setSelectedFile(null)
      e.target.value = ''
      setErr('Файл пустой')
      return
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setSelectedFile(null)
      e.target.value = ''
      setErr('Изображение слишком большое (максимум 10 МБ)')
      return
    }

    setSelectedFile(file)
  }

  return (
    <div>
      <div className="row">
        <h2>Заявка</h2>
        <div className="muted small">{ticketQ.isFetching ? 'Загрузка…' : ticket ? ticket.id : '—'}</div>
      </div>

      <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Link to="/board">
          <button className="ghost">← Назад к доске</button>
        </Link>

        {canEditTicket ? (
          <button className="ghost" onClick={() => setEditOpen((v) => !v)}>
            {editOpen ? 'Скрыть редактирование' : 'Редактировать заявку'}
          </button>
        ) : null}

        {canClaim ? (
          <button onClick={() => claimM.mutate()} disabled={claimM.isPending}>
            {claimM.isPending ? 'Забираем…' : 'Взять заявку'}
          </button>
        ) : null}

        {canChangeStatus ? (
          <>
            <button
              className="ghost"
              disabled={statusM.isPending || !ticket || ticket.status === 'IN_PROGRESS'}
              onClick={() => statusM.mutate('IN_PROGRESS')}
            >
              {statusM.isPending ? 'Сохраняем…' : 'Начать работу'}
            </button>

            <button
              className="ghost"
              disabled={statusM.isPending || !ticket || ticket.status === 'DONE'}
              onClick={() => statusM.mutate('DONE')}
            >
              {statusM.isPending ? 'Сохраняем…' : 'Завершить'}
            </button>

            <button
              className="ghost"
              disabled={statusM.isPending || !ticket || ticket.status === 'CANCELED'}
              onClick={() => statusM.mutate('CANCELED')}
            >
              {statusM.isPending ? 'Сохраняем…' : 'Отменить'}
            </button>
          </>
        ) : null}
      </div>

      {canEditTicket && editOpen ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Редактирование заявки</h3>

          <div className="form">
            <label>
              Категория
              <select
                value={editProblemCategoryId}
                onChange={(e) => setEditProblemCategoryId(e.target.value)}
                disabled={updateTicketM.isPending}
              >
                <option value="">Выбери категорию</option>
                {(categoriesQ.data || [])
                  .filter((row) => row.isActive !== false)
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Описание проблемы
              <textarea
                value={editProblemText}
                onChange={(e) => setEditProblemText(e.target.value)}
                rows={5}
                disabled={updateTicketM.isPending}
              />
            </label>

            <label>
              Срочность
              <select
                value={editUrgency}
                onChange={(e) => setEditUrgency(e.target.value as api.TicketUrgency)}
                disabled={updateTicketM.isPending}
              >
                <option value="NOT_URGENT">Не срочно</option>
                <option value="URGENT">Срочно</option>
              </select>
            </label>

            <label>
              Заявитель
              <input
                value={editRequesterName}
                onChange={(e) => setEditRequesterName(e.target.value)}
                disabled={updateTicketM.isPending}
              />
            </label>

            <label>
              Телефон
              <input
                value={editRequesterPhone}
                onChange={(e) => setEditRequesterPhone(e.target.value)}
                disabled={updateTicketM.isPending}
              />
            </label>

            <label>
              Точка
              <input
                value={editPointName}
                onChange={(e) => setEditPointName(e.target.value)}
                disabled={updateTicketM.isPending}
              />
            </label>

            <label>
              Адрес
              <input
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                disabled={updateTicketM.isPending}
              />
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
                  setEditUrgency(ticket.urgency)
                  setEditRequesterName(ticket.requesterName || '')
                  setEditRequesterPhone(ticket.requesterPhone || '')
                  setEditAddress(ticket.address || '')
                  setEditPointName(ticket.pointName || '')
                  setEditOpen(false)
                }}
                disabled={updateTicketM.isPending}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {canAssign ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Назначить техника</h3>

          {assignmentCandidatesQ.isLoading ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <Skeleton w={240} h={16} />
              <Skeleton w={320} h={36} />
            </div>
          ) : assignmentData ? (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <Tag>Категория: {assignmentData.category.name}</Tag>
                <Tag>
                  Требуемые специализации:{' '}
                  {assignmentData.requiredSpecializations.length
                    ? assignmentData.requiredSpecializations.map((x) => x.name).join(', ')
                    : 'не заданы'}
                </Tag>
                <Tag>Подходящих: {assignmentData.matched.length}</Tag>
                <Tag>Остальных: {assignmentData.others.length}</Tag>
              </div>

              <div className="assignmentHintBox">
                <div className="assignmentHintTitle">Рекомендация</div>
                <div className="muted small">
                  Сначала показаны техники, которые подходят по специализациям категории. Ниже — остальные техники компании.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                <select
                  value={selectedTechnicianId}
                  onChange={(e) => setSelectedTechnicianId(e.target.value)}
                  style={{ minWidth: 420 }}
                >
                  <option value="">Выбери техника</option>

                  {assignmentData.matched.length > 0 ? (
                    <optgroup label="Подходящие техники">
                      {assignmentData.matched.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.email}
                          {t.id === assignmentData.currentAssigneeId ? ' · текущий' : ''}
                          {t.matchedBy.length ? ` · подходит: ${t.matchedBy.join(', ')}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}

                  {assignmentData.others.length > 0 ? (
                    <optgroup label="Остальные техники">
                      {assignmentData.others.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.email}
                          {t.id === assignmentData.currentAssigneeId ? ' · текущий' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>

                <button onClick={() => assignM.mutate()} disabled={assignM.isPending || !selectedTechnicianId}>
                  {assignM.isPending ? 'Назначаем…' : 'Назначить'}
                </button>

                <div className="muted small">Текущий: {ticket?.assignedTechnician?.email || '—'}</div>
              </div>

              {selectedCandidate ? (
                <div className="assignmentSelectedBox">
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Выбранный техник</div>
                  <div style={{ marginBottom: 6 }}>{selectedCandidate.email}</div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <RecommendationBadge matched={selectedCandidate.matched} matchedBy={selectedCandidate.matchedBy} />
                    {selectedIsCurrent ? <span className="uxBadge uxBadgeNeutral">Текущий исполнитель</span> : null}
                  </div>

                  {!selectedIsMatched ? (
                    <div className="assignmentWarning">
                      Внимание: выбран техник, который не входит в рекомендованный список по специализациям категории.
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {canUploadPhoto ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 10 }}>Фото</h3>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploadM.isPending}
            />
            <button onClick={() => uploadM.mutate()} disabled={uploadM.isPending || !selectedFile}>
              {uploadM.isPending ? 'Загружаем…' : 'Загрузить фото'}
            </button>
            <div className="muted small">
              {selectedFile ? `${selectedFile.name} · ${fmtBytes(selectedFile.size)}` : 'Выбери изображение до 10 МБ'}
            </div>
          </div>
        </div>
      ) : null}

      {err ? <div className="alert">{err}</div> : null}
      {ticketQ.isError ? <div className="alert">{(ticketQ.error as any)?.message || String(ticketQ.error)}</div> : null}
      {timelineQ.isError ? (
        <div className="alert">{(timelineQ.error as any)?.message || String(timelineQ.error)}</div>
      ) : null}
      {attachmentsQ.isError ? (
        <div className="alert">{(attachmentsQ.error as any)?.message || String(attachmentsQ.error)}</div>
      ) : null}
      {assignmentCandidatesQ.isError ? (
        <div className="alert">{(assignmentCandidatesQ.error as any)?.message || String(assignmentCandidatesQ.error)}</div>
      ) : null}
      {categoriesQ.isError ? (
        <div className="alert">{(categoriesQ.error as any)?.message || String(categoriesQ.error)}</div>
      ) : null}

      {isLoading ? (
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
      ) : (
        header
      )}

      {ticket ? (
        <>
          <div className="panel" style={{ marginBottom: 12 }}>
            <h3 style={{ marginBottom: 10 }}>Детали заявки</h3>

            <div style={{ display: 'grid', gap: 10 }}>
              <div><b>Категория:</b> {ticket.problemCategory?.name || '—'}</div>
              <div><b>Срочность:</b> {urgencyLabel(ticket.urgency)}</div>
              <div><b>Назначен:</b> {ticket.assignedTechnician?.email || '—'}</div>
              <div>
                <b>SLA статус:</b>{' '}
                {slaState.isBreached
                  ? 'Нарушен'
                  : slaState.isAtRisk
                    ? 'В риске'
                    : ticket.slaDueAt
                      ? 'В норме'
                      : 'Не задан'}
              </div>
              <div><b>Заявитель:</b> {ticket.requesterName || '—'}</div>
              <div><b>Телефон:</b> {ticket.requesterPhone || '—'}</div>
              <div><b>Точка:</b> {ticket.pointName || '—'}</div>
              <div><b>Адрес:</b> {ticket.address || '—'}</div>
              <div>
                <b>Описание проблемы:</b>
                <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{ticket.problemText || '—'}</div>
              </div>
              {ticket.problemCategory?.instructions ? (
                <div>
                  <b>Инструкции категории:</b>
                  <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{ticket.problemCategory.instructions}</div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 12 }}>
            <h3 style={{ marginBottom: 10 }}>Вложения</h3>

            {attachmentsQ.isLoading ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <Skeleton w={280} h={16} />
                <Skeleton w={340} h={16} />
              </div>
            ) : attachmentsQ.data && attachmentsQ.data.length > 0 ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {attachmentsQ.data.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 12,
                      display: 'grid',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <img
                        src={api.resolveFileUrl(a.url)}
                        alt={a.originalName}
                        style={{
                          width: 220,
                          maxWidth: '100%',
                          borderRadius: 10,
                          border: '1px solid #e5e7eb',
                          objectFit: 'cover',
                        }}
                      />

                      <div style={{ display: 'grid', gap: 6, minWidth: 240 }}>
                        <div><b>{a.originalName}</b></div>
                        <div className="muted small">Размер: {fmtBytes(a.sizeBytes)}</div>
                        <div className="muted small">Загружено: {fmt(a.createdAt)}</div>
                        <div className="muted small">Кем: {a.uploadedBy?.email || '—'}</div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                          <a href={api.resolveFileUrl(a.url)} target="_blank" rel="noreferrer">
                            <button className="ghost">Открыть</button>
                          </a>

                          {canDeletePhoto ? (
                            <button
                              className="ghost"
                              onClick={() => deleteAttachmentM.mutate(a.id)}
                              disabled={deleteAttachmentM.isPending}
                            >
                              {deleteAttachmentM.isPending ? 'Удаляем…' : 'Удалить'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted small">Вложений пока нет</div>
            )}
          </div>

          <div className="panel" style={{ marginBottom: 12 }}>
            <h3 style={{ marginBottom: 10 }}>Timeline</h3>

            {timelineQ.isLoading ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <Skeleton w={320} h={16} />
                <Skeleton w={360} h={16} />
                <Skeleton w={300} h={16} />
              </div>
            ) : timelineQ.data?.items?.length ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {timelineQ.data.items.map((item, idx) => (
                  <div
                    key={`${item.at}-${item.type}-${idx}`}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 12,
                      display: 'grid',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <b>{item.title}</b>
                      <Tag>{sourceLabel(item.source)}</Tag>
                      <Tag>{timelineTypeLabel(item.type || item.domainType || item.timelineEvent || 'event')}</Tag>
                    </div>

                    <div className="muted small">
                      {fmt(item.at)} · {item.actor?.email || 'system'}
                    </div>

                    {item.payload ? (
                      <pre
                        style={{
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: 10,
                          padding: 10,
                          fontSize: 12,
                        }}
                      >
                        {JSON.stringify(item.payload, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))}
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
