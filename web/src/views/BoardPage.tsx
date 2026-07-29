import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { mapReason } from '../lib/assignmentExplain'
import {
  applyBoardNavigationContextToSearchParams,
  appendBoardNavigationContextToPath,
  readBoardNavigationContextFromSearch,
  sanitizeBoardNavigationContext,
  type BoardSourcePath,
  type BoardTicketNavState,
} from '../lib/boardNavigationContext'
import { pushToast } from '../lib/appToast'
import { logTicketActionError, mapTicketActionError } from '../lib/ticketOperationalErrors'
import { OperationsViewSwitcher, type OperationsViewMode } from '../components/operations/OperationsViewSwitcher'
import { compactTicketAssigneeLabel, compactTicketCreatorLabel } from '../lib/ticketActorIdentity'

function fmt(dt?: string | null) {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString('ru-RU')
  } catch {
    return dt
  }
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function statusLabel(status: api.TicketStatus) {
  if (status === 'NEW') return 'Новые'
  if (status === 'ASSIGNED') return 'Назначенные'
  if (status === 'IN_PROGRESS') return 'В работе'
  if (status === 'DONE') return 'Завершённые'
  if (status === 'CANCELED') return 'Отменённые'
  return status
}

function urgencyLabel(urgency: api.TicketUrgency) {
  if (urgency === 'URGENT') return 'Срочно'
  if (urgency === 'NOT_URGENT') return 'Не срочно'
  return urgency
}

function compactServiceContext(ticket: api.TicketCard) {
  const locationText = [ticket.location?.name, ticket.location?.city].filter(Boolean).join(' · ')
  const equipmentText = [ticket.equipment?.name, ticket.equipment?.type].filter(Boolean).join(' · ')
  if (locationText && equipmentText) return `${locationText} · ${equipmentText}`
  if (locationText) return locationText
  if (equipmentText) return equipmentText
  return ticket.pointName || ''
}

function providerScopeLabel(role?: api.ServiceContractRole) {
  if (role === 'PRIMARY') return 'PRIMARY provider'
  if (role === 'SECONDARY') return 'SECONDARY provider'
  return ''
}

function UrgencyTag({ urgency }: { urgency: api.TicketUrgency }) {
  const style =
    urgency === 'URGENT'
      ? { background: '#fff1f2', borderColor: '#fecdd3', color: '#9f1239' }
      : { background: '#f3f4f6', borderColor: '#e5e7eb', color: '#374151' }

  return (
    <span className="tag" style={style}>
      {urgencyLabel(urgency)}
    </span>
  )
}

function SkeletonBox({ w, h }: { w: number | string; h: number }) {
  return <div style={{ width: w, height: h, borderRadius: 10, background: '#eef2ff', border: '1px solid #e6e8f0' }} />
}

function TicketSkeleton() {
  return (
    <div className="ticket" style={{ pointerEvents: 'none' }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <SkeletonBox w="85%" h={14} />
        <div style={{ display: 'flex', gap: 8 }}>
          <SkeletonBox w={70} h={18} />
          <SkeletonBox w={90} h={18} />
        </div>
        <SkeletonBox w="60%" h={12} />
      </div>
    </div>
  )
}

function ColumnSkeleton({ title }: { title: string }) {
  return (
    <div className="col">
      <div className="colhead">
        <div className="coltitle">{title}</div>
        <div className="pill">—</div>
      </div>
      <div className="muted small" style={{ marginBottom: 8 }}>
        SLA: —
      </div>
      <div className="cards">
        <TicketSkeleton />
        <TicketSkeleton />
        <TicketSkeleton />
      </div>
    </div>
  )
}

function isProviderBoardRole(role?: api.Role) {
  return role === 'ADMIN' || role === 'MASTER' || role === 'DISPATCHER' || role === 'NETWORK_DIRECTOR'
}

function canCreateTickets(role?: api.Role) {
  return (
    role === 'ADMIN' ||
    role === 'MASTER' ||
    role === 'DISPATCHER' ||
    role === 'NETWORK_DIRECTOR' ||
    role === 'CLIENT' ||
    role === 'TERRITORIAL_MANAGER' ||
    role === 'TECHNICIAN'
  )
}

function canViewAnalytics(role?: api.Role) {
  return (
    role === 'ADMIN' ||
    role === 'MASTER' ||
    role === 'DISPATCHER' ||
    role === 'NETWORK_DIRECTOR' ||
    role === 'TECHNICIAN' ||
    role === 'PLATFORM_ADMIN'
  )
}

function canRunBulkOperationalActions(role?: api.Role) {
  return role === 'ADMIN' || role === 'MASTER' || role === 'DISPATCHER' || role === 'NETWORK_DIRECTOR' || role === 'TECHNICIAN'
}

function canReadCompanyContext(role?: api.Role) {
  return role === 'ADMIN' || role === 'MASTER' || role === 'DISPATCHER' || role === 'NETWORK_DIRECTOR'
}

function normalizeOperationsViewMode(value?: string | null): OperationsViewMode | null {
  if (value === 'registry' || value === 'board') return value
  return null
}

function defaultOperationsViewMode(pathname: string): OperationsViewMode {
  return pathname === '/tickets' ? 'registry' : 'board'
}

function defaultOperationsSourcePath(pathname: string): BoardSourcePath {
  return pathname === '/tickets' ? '/tickets' : '/board'
}

function buildCreateTicketLink(linkedClientCompanyId?: string | null) {
  if (!linkedClientCompanyId) return '/tickets/new'
  return `/tickets/new?linkedClientCompanyId=${linkedClientCompanyId}`
}

function buildAnalyticsLink(params: { observerCompanyId?: string | null; linkedClientCompanyId?: string | null }) {
  if (params.observerCompanyId) return `/analytics?companyId=${params.observerCompanyId}`
  if (params.linkedClientCompanyId) return `/analytics?linkedClientCompanyId=${params.linkedClientCompanyId}`
  return '/analytics'
}

function buildCompanyLink(params: { observerCompanyId?: string | null; linkedClientCompanyId?: string | null }) {
  if (params.observerCompanyId) return `/company?companyId=${params.observerCompanyId}`
  if (params.linkedClientCompanyId) return `/company?linkedClientCompanyId=${params.linkedClientCompanyId}`
  return '/company'
}

export function BoardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [take, setTake] = useState(120)
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<api.TicketStatus | ''>('')
  const [includeArchived, setIncludeArchived] = useState(false)
  function resetBoardFilters() {
    setSelectedLocationId('')
    setSelectedEquipmentId('')
    setSelectedStatus('')
    setIncludeArchived(false)
  }

  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const boardDataRef = useRef<{ scopeKey: string; data: api.BoardResponse } | null>(null)
  const autoSelectedPrimaryRef = useRef(false)
  const activeOperationsView = useMemo<OperationsViewMode>(() => {
    const sp = new URLSearchParams(location.search)
    return normalizeOperationsViewMode(sp.get('boardTab')) ?? defaultOperationsViewMode(location.pathname)
  }, [location.pathname, location.search])

  useLayoutEffect(() => {
    const navState = location.state as BoardTicketNavState | null | undefined
    const restore = sanitizeBoardNavigationContext(navState?.boardContext)
    if (!restore) return
    setSelectedLocationId(restore.selectedLocationId || '')
    setSelectedEquipmentId(restore.selectedEquipmentId || '')
    setSelectedStatus(restore.selectedStatus || '')
    setIncludeArchived(!!restore.includeArchived)
    if (restore.take) setTake(restore.take)
    navigate(appendBoardNavigationContextToPath(`${location.pathname}${location.search}`, restore), { replace: true, state: undefined })
  }, [location.key, location.pathname, location.search, navigate])

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const requestedCompanyId = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    return (sp.get('companyId')?.trim() || api.getObserverCompanyId()).trim()
  }, [location.search])
  const requestedLinkedClientCompanyId = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    return (sp.get('linkedClientCompanyId')?.trim() || api.getLinkedClientCompanyId()).trim()
  }, [location.search])

  useEffect(() => {
    api.persistScopeFromSearchParams(new URLSearchParams(location.search), meQ.data)
  }, [location.search, meQ.data])

  const observerCompanyId = meQ.data?.role === 'PLATFORM_ADMIN' ? requestedCompanyId : ''
  const isObserverMode = !!observerCompanyId && observerCompanyId !== meQ.data?.companyId

  const observerCompanyQ = useQuery({
    queryKey: ['observer-company', observerCompanyId],
    queryFn: () => api.company(observerCompanyId),
    enabled: !!observerCompanyId && meQ.data?.role === 'PLATFORM_ADMIN',
  })

  const canLoadOwnCompanyContext = useMemo(
    () => !!meQ.data && meQ.data.role !== 'PLATFORM_ADMIN' && canReadCompanyContext(meQ.data.role),
    [meQ.data],
  )

  const ownCompanyQ = useQuery({
    queryKey: ['board-company-context'],
    queryFn: () => api.company(),
    enabled: !observerCompanyId && canLoadOwnCompanyContext,
  })

  const isProviderCompany = !observerCompanyId && ownCompanyQ.data?.type === 'PROVIDER'
  const isTerritorialManager = meQ.data?.role === 'TERRITORIAL_MANAGER'
  const canShowLinkedClients = !isTerritorialManager && isProviderCompany && isProviderBoardRole(meQ.data?.role)

  const linkedClientsQ = useQuery({
    queryKey: ['linked-clients'],
    queryFn: api.getLinkedClients,
    enabled: canShowLinkedClients,
  })

  const linkedClients = linkedClientsQ.data || []
  const primaryLinkedClients = useMemo(() => linkedClients.filter((item) => item.role === 'PRIMARY'), [linkedClients])
  const linkedClientsLoaded = !canShowLinkedClients || linkedClientsQ.isSuccess || linkedClientsQ.isError
  const selectedLinkedClient = useMemo(
    () => linkedClients.find((item) => item.clientCompany.id === requestedLinkedClientCompanyId) || null,
    [linkedClients, requestedLinkedClientCompanyId],
  )

  const resolvedLinkedClientCompanyId = selectedLinkedClient?.role === 'PRIMARY' ? selectedLinkedClient.clientCompany.id : ''
  const effectiveLinkedClientCompanyId = canShowLinkedClients ? resolvedLinkedClientCompanyId : requestedLinkedClientCompanyId
  const isClientTenantCompany = !observerCompanyId && !effectiveLinkedClientCompanyId && ownCompanyQ.data?.type === 'CLIENT'
  const providerHasNoLinkedClients = canShowLinkedClients && linkedClientsLoaded && linkedClients.length === 0
  const providerRestrictedSelection = canShowLinkedClients && !!selectedLinkedClient && selectedLinkedClient.role !== 'PRIMARY'

  function buildOperationsPath(options?: {
    linkedClientCompanyId?: string | null
    view?: OperationsViewMode
  }) {
    const searchParams = new URLSearchParams(location.search)
    const existingBoardContext = readBoardNavigationContextFromSearch(searchParams)
    if (options && Object.prototype.hasOwnProperty.call(options, 'linkedClientCompanyId')) {
      const nextLinkedClientCompanyId = (options.linkedClientCompanyId || '').trim()
      if (nextLinkedClientCompanyId) searchParams.set('linkedClientCompanyId', nextLinkedClientCompanyId)
      else searchParams.delete('linkedClientCompanyId')
    }
    applyBoardNavigationContextToSearchParams(searchParams, {
      selectedLocationId: existingBoardContext?.selectedLocationId || selectedLocationId,
      selectedEquipmentId: existingBoardContext?.selectedEquipmentId || selectedEquipmentId,
      selectedStatus: existingBoardContext?.selectedStatus || selectedStatus,
      includeArchived: !!existingBoardContext?.includeArchived || includeArchived,
      take: existingBoardContext?.take || take,
      tab: options?.view ?? activeOperationsView,
      chips: existingBoardContext?.chips,
      search: existingBoardContext?.search,
      scopeLabel: existingBoardContext?.scopeLabel,
    })
    const query = searchParams.toString()
    return `${location.pathname}${query ? `?${query}` : ''}`
  }

  useEffect(() => {
    if (!canShowLinkedClients) {
      autoSelectedPrimaryRef.current = false
    }
  }, [canShowLinkedClients])

  useEffect(() => {
    const sp = new URLSearchParams(location.search)
    if (!sp.get('linkedClientCompanyId') && requestedLinkedClientCompanyId && !observerCompanyId) {
      navigate(buildOperationsPath({ linkedClientCompanyId: requestedLinkedClientCompanyId }), { replace: true })
      return
    }
    if (!canShowLinkedClients) return
    if (requestedLinkedClientCompanyId) return
    if (!primaryLinkedClients.length) return
    if (autoSelectedPrimaryRef.current) return

    autoSelectedPrimaryRef.current = true
    navigate(buildOperationsPath({ linkedClientCompanyId: primaryLinkedClients[0].clientCompany.id }), { replace: true })
  }, [canShowLinkedClients, requestedLinkedClientCompanyId, primaryLinkedClients, navigate, observerCompanyId, location.search])

  const providerContextResolved = isObserverMode
    ? true
    : !canShowLinkedClients
      ? true
      : !linkedClientsLoaded
        ? false
        : providerHasNoLinkedClients || providerRestrictedSelection
          ? true
          : !!effectiveLinkedClientCompanyId

  const boardEnabled = isObserverMode
    ? true
    : !canShowLinkedClients
      ? true
      : providerContextResolved && !providerHasNoLinkedClients && !providerRestrictedSelection && !!effectiveLinkedClientCompanyId

  const boardScopeKey = observerCompanyId
    ? `observer:${observerCompanyId}`
    : canShowLinkedClients
      ? `provider:${effectiveLinkedClientCompanyId || 'pending'}`
      : 'tenant:self'

  const boardQ = useQuery({
    queryKey: ['board', { take, observerCompanyId, effectiveLinkedClientCompanyId, selectedLocationId, selectedEquipmentId, selectedStatus, includeArchived }],
    queryFn: () =>
      api.board({
        take,
        linkedClientCompanyId: effectiveLinkedClientCompanyId || undefined,
        companyId: observerCompanyId || undefined,
        locationId: selectedLocationId || undefined,
        equipmentId: selectedEquipmentId || undefined,
        status: selectedStatus || undefined,
        includeArchived,
      }),
    enabled: boardEnabled,
  })
  const contextAnalyticsQ = useQuery({
    queryKey: ['board-context-analytics', { observerCompanyId, effectiveLinkedClientCompanyId, selectedLocationId, selectedEquipmentId }],
    queryFn: () =>
      api.ticketContextAnalytics({
        linkedClientCompanyId: effectiveLinkedClientCompanyId || undefined,
        companyId: observerCompanyId || undefined,
        locationId: selectedLocationId || undefined,
        equipmentId: selectedEquipmentId || undefined,
      }),
    enabled: boardEnabled && canViewAnalytics(meQ.data?.role),
  })

  useEffect(() => {
    if (boardQ.data) {
      boardDataRef.current = { scopeKey: boardScopeKey, data: boardQ.data }
    }
  }, [boardQ.data, boardScopeKey])

  const boardData = boardQ.data ?? (boardDataRef.current?.scopeKey === boardScopeKey ? boardDataRef.current.data : null)
  const columns = boardData?.columns || []
  const cardsAll = useMemo(() => columns.flatMap((c) => c.cards || []), [columns])
  const locationOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const card of cardsAll) {
      if (card.location?.id) {
        map.set(card.location.id, [card.location.name, card.location.city].filter(Boolean).join(' · '))
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [cardsAll])
  const equipmentOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const card of cardsAll) {
      if (selectedLocationId && card.location?.id !== selectedLocationId) continue
      if (card.equipment?.id) {
        map.set(card.equipment.id, [card.equipment.name, card.equipment.type].filter(Boolean).join(' · '))
      }
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [cardsAll, selectedLocationId])

  useEffect(() => {
    if (selectedLocationId && !locationOptions.some((item) => item.id === selectedLocationId)) {
      setSelectedLocationId('')
      setSelectedEquipmentId('')
      return
    }
    if (selectedEquipmentId && !equipmentOptions.some((item) => item.id === selectedEquipmentId)) {
      setSelectedEquipmentId('')
    }
  }, [selectedLocationId, selectedEquipmentId, locationOptions, equipmentOptions])

  const stats = useMemo(() => {
    const now = new Date()
    const open = cardsAll.filter((c) => c.status !== 'DONE' && c.status !== 'CANCELED').length
    const today = cardsAll.filter((c) => sameDay(new Date(c.createdAt), now)).length
    const urgent = cardsAll.filter((c) => c.urgency === 'URGENT').length
    const breachedByCol = columns.reduce((sum, col) => sum + (col.sla?.breached || 0), 0)
    const atRiskByCol = columns.reduce((sum, col) => sum + (col.sla?.atRisk || 0), 0)
    return { open, today, urgent, breachedByCol, atRiskByCol }
  }, [cardsAll, columns])

  const isResolvingProviderContext = canShowLinkedClients && !providerContextResolved
  const initialBoardLoading = boardEnabled && !boardData && (boardQ.isLoading || boardQ.isFetching)
  const statsLoading = isResolvingProviderContext || initialBoardLoading
  const isEmpty =
    providerContextResolved &&
    boardEnabled &&
    !boardQ.isFetching &&
    !boardQ.isError &&
    !!boardData &&
    columns.length > 0 &&
    columns.every((column) => (column.cards?.length || 0) === 0)

  const observerLabel = observerCompanyQ.data?.name || observerCompanyId
  const providerHeaderLabel = selectedLinkedClient?.clientCompany.name || primaryLinkedClients[0]?.clientCompany.name || ''
  const isTechnician = meQ.data?.role === 'TECHNICIAN'
  const isProviderTechnician = isProviderCompany && isTechnician
  const canBulkOperate = canRunBulkOperationalActions(meQ.data?.role) && !isClientTenantCompany
  const providerCanCreateTicket = !isObserverMode && canCreateTickets(meQ.data?.role)
  const analyticsVisible = canViewAnalytics(meQ.data?.role)
  const analyticsLink = buildAnalyticsLink({ observerCompanyId, linkedClientCompanyId: effectiveLinkedClientCompanyId })
  const companyLink = buildCompanyLink({ observerCompanyId, linkedClientCompanyId: effectiveLinkedClientCompanyId })
  const ticketScope = useMemo(
    () =>
      observerCompanyId
        ? ({ companyId: observerCompanyId } satisfies api.TicketScopeParams)
        : effectiveLinkedClientCompanyId
          ? ({ linkedClientCompanyId: effectiveLinkedClientCompanyId } satisfies api.TicketScopeParams)
          : undefined,
    [observerCompanyId, effectiveLinkedClientCompanyId],
  )
  const allVisibleTicketIds = useMemo(() => columns.flatMap((c) => c.cards.map((card) => card.id)), [columns])
  const allVisibleSelected = allVisibleTicketIds.length > 0 && allVisibleTicketIds.every((id) => selectedTicketIds.includes(id))
  const [quickActionError, setQuickActionError] = useState('')
  const [quickActionSuccess, setQuickActionSuccess] = useState('')
  const [smartAssignByTicket, setSmartAssignByTicket] = useState<
    Record<string, { technicianName: string; reason: string }>
  >({})

  const quickActionM = useMutation<
    void | api.SmartAssignResult,
    unknown,
    { ticket: api.TicketCard; action: 'open' | 'claim' | 'start' | 'done' | 'assign' }
  >({
    mutationFn: async (payload) => {
      const { ticket, action } = payload
      if (action === 'open') return
      if (action === 'claim') {
        await api.claimTicket(ticket.id, ticketScope)
        return
      }
      if (action === 'start') {
        await api.updateTicketStatus(ticket.id, { status: 'IN_PROGRESS' }, ticketScope)
        return
      }
      if (action === 'done') {
        await api.updateTicketStatus(ticket.id, { status: 'AWAITING_ACCEPTANCE' }, ticketScope)
        return
      }
      if (action === 'assign') {
        return api.smartAssignTicket(ticket.id, ticketScope)
      }
    },
    onMutate: () => setQuickActionError(''),
    onSuccess: async (result, payload) => {
      if (payload.action === 'claim') {
        setQuickActionSuccess('✔ Взято в работу')
        pushToast('Заявка закреплена за вами', 'success')
      } else if (payload.action === 'start') {
        setQuickActionSuccess('✔ Работы начаты')
        pushToast('Работы начаты', 'success')
      } else if (payload.action === 'done') {
        setQuickActionSuccess('✔ Отправлено на приёмку')
        pushToast('Заявка отправлена на приёмку', 'success')
      }
      if (payload.action === 'assign' && result && typeof result === 'object') {
        const assignRes = result as api.SmartAssignResult
        if (assignRes.assigned && assignRes.technicianId) {
          const readableReason = mapReason(assignRes.reason)
          const techName = (
            (assignRes.ticket?.assignedTechnician ? compactTicketAssigneeLabel(assignRes.ticket) : assignRes.technicianName) ||
            assignRes.technicianId ||
            'исполнитель'
          ).trim()
          setSmartAssignByTicket((prev) => ({
            ...prev,
            [payload.ticket.id]: {
              technicianName: techName,
              reason: readableReason,
            },
          }))
          setQuickActionSuccess(`✔ Назначен: ${techName}`)
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['board'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] }),
        queryClient.invalidateQueries({ queryKey: ['mobile-ticket-detail'] }),
      ])
    },
    onError: (e: any) => {
      const raw = e?.message || String(e)
      logTicketActionError('board_quick_action', raw)
      setQuickActionError(mapTicketActionError(raw))
    },
  })

  useEffect(() => {
    if (!quickActionSuccess) return
    const t = window.setTimeout(() => setQuickActionSuccess(''), 3000)
    return () => window.clearTimeout(t)
  }, [quickActionSuccess])

  useEffect(() => {
    if (!allVisibleTicketIds.length) {
      setSelectedTicketIds([])
      return
    }
    setSelectedTicketIds((prev) => prev.filter((id) => allVisibleTicketIds.includes(id)))
  }, [allVisibleTicketIds])

  async function runBulkAction(action: 'claim' | 'IN_PROGRESS' | 'AWAITING_ACCEPTANCE') {
    if (!selectedTicketIds.length || bulkBusy) return
    setBulkBusy(true)
    setBulkError('')
    try {
      if (action === 'claim') {
        await Promise.all(selectedTicketIds.map((ticketId) => api.claimTicket(ticketId, ticketScope)))
      } else {
        await Promise.all(
          selectedTicketIds.map((ticketId) =>
            api.updateTicketStatus(ticketId, { status: action }, ticketScope),
          ),
        )
      }
      setSelectedTicketIds([])
      await Promise.all([boardQ.refetch(), contextAnalyticsQ.refetch()])
    } catch (error: any) {
      setBulkError(error?.message || String(error))
    } finally {
      setBulkBusy(false)
    }
  }

  function onSelectLinkedClient(nextLinkedClientCompanyId: string) {
    if (!nextLinkedClientCompanyId) return
    navigate(buildOperationsPath({ linkedClientCompanyId: nextLinkedClientCompanyId }), { replace: false })
  }

  function onOperationsViewChange(nextView: OperationsViewMode) {
    if (nextView === activeOperationsView) return
    navigate(buildOperationsPath({ view: nextView }), { replace: false })
  }

  function buildTicketLink(ticket: api.TicketCard) {
    if (observerCompanyId) {
      return `/tickets/${ticket.id}?companyId=${observerCompanyId}`
    }
    if (effectiveLinkedClientCompanyId) {
      return `/tickets/${ticket.id}?linkedClientCompanyId=${effectiveLinkedClientCompanyId}`
    }
    const isProviderPrimaryBoard = boardData?.meta?.visibilityMode === 'provider_primary'
    const actorCompanyId = meQ.data?.companyId || ''
    if (isProviderPrimaryBoard && ticket.companyId && ticket.companyId !== actorCompanyId) {
      return `/tickets/${ticket.id}?linkedClientCompanyId=${ticket.companyId}`
    }
    return `/tickets/${ticket.id}`
  }

  function buildTicketLinkState(): BoardTicketNavState | undefined {
    const boardContext = sanitizeBoardNavigationContext({
      selectedLocationId,
      selectedEquipmentId,
      selectedStatus,
      includeArchived,
      take,
      tab: activeOperationsView,
    })
    const sourcePath = defaultOperationsSourcePath(location.pathname)
    return boardContext ? { boardContext, sourcePath } : { sourcePath }
  }

  const subtitle = (() => {
    if (isResolvingProviderContext) return 'Подбираем связанного клиента для provider board…'
    if (isProviderTechnician) {
      return boardData
        ? `Ваш operational scope: ${boardData.meta.totalTickets} заявок`
        : 'Показываем назначенные вам и доступные для claim заявки в provider operational scope.'
    }
    if (isTechnician) {
      return boardData
        ? `Ваш operational scope: ${boardData.meta.totalTickets} заявок`
        : 'Показываем ваши назначенные заявки и доступные для claim в текущем контуре.'
    }
    if (!boardEnabled && canShowLinkedClients) return 'Выберите связанного клиента, чтобы открыть operational board.'
    if (boardData) return `Всего: ${boardData.meta.totalTickets} · лимит последних: ${boardData.meta.limitedToLast}`
    return '—'
  })()

  return (
    <div className="managementPage">
      <div className="managementPageContext">
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>{activeOperationsView === 'registry' ? 'Заявки' : 'Доска заявок'}</h2>
          <div className="muted small">{subtitle}</div>
          {selectedLinkedClient ? (
            <div className="muted small" style={{ marginTop: 4 }}>
              Provider mode · Клиент: {selectedLinkedClient.clientCompany.name} · {providerScopeLabel(selectedLinkedClient.role)}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="ghost" onClick={() => boardEnabled && boardQ.refetch()} disabled={!boardEnabled || boardQ.isFetching}>
            Обновить
          </button>
          {analyticsVisible ? (
            <Link to={analyticsLink}>
              <button className="ghost">Аналитика</button>
            </Link>
          ) : null}
          <Link to={companyLink}>
            <button className="ghost">Компания</button>
          </Link>
          {providerCanCreateTicket ? (
            <Link to={buildCreateTicketLink(effectiveLinkedClientCompanyId)}>
              <button className="ghost">Создать заявку</button>
            </Link>
          ) : (
            <button className="ghost" disabled>
              Read-only режим
            </button>
          )}
        </div>
      </div>

      <OperationsViewSwitcher value={activeOperationsView} onChange={onOperationsViewChange} />

      <div className="pageHint">
        {activeOperationsView === 'registry'
          ? 'Компактный реестр заявок будет добавлен следующим этапом.'
          : 'Здесь отображаются заявки по статусам. Откройте карточку, чтобы назначить исполнителя или изменить статус.'}
      </div>
      </div>

      {activeOperationsView === 'registry' ? (
        <div className="panel uiCard operationsRegistryPlaceholder">
          <h3>Реестр заявок</h3>
          <div className="muted">Компактный реестр заявок будет добавлен следующим этапом</div>
        </div>
      ) : (
        <>
      <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
        <div className="panel" style={{ minHeight: 64, display: 'grid', alignContent: 'center' }}>
          {isObserverMode ? (
            <div>
              <div style={{ fontWeight: 700 }}>Режим просмотра компании: {observerLabel}</div>
              <div className="muted small">PLATFORM_ADMIN видит operational board компании как наблюдатель, без tenant impersonation.</div>
            </div>
          ) : isResolvingProviderContext ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <SkeletonBox w={260} h={14} />
              <SkeletonBox w={420} h={12} />
            </div>
          ) : canShowLinkedClients ? (
            <div>
              <div style={{ fontWeight: 700 }}>Provider mode</div>
              <div className="muted small">
                {providerHeaderLabel
                  ? `Сейчас открыт клиент: ${providerHeaderLabel}`
                  : 'Выберите связанного клиента, чтобы открыть его board в provider scope.'}
              </div>
            </div>
          ) : isProviderTechnician ? (
            <div>
              <div style={{ fontWeight: 700 }}>Provider operational mode</div>
              <div className="muted small">Техник видит назначенные ему заявки и, если это разрешено настройками компании, доступные заявки для claim.</div>
            </div>
          ) : isTechnician ? (
            <div>
              <div style={{ fontWeight: 700 }}>Режим техника</div>
              <div className="muted small">Вы видите только заявки из вашего operational scope: назначенные вам и доступные для claim.</div>
            </div>
          ) : ownCompanyQ.isLoading ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <SkeletonBox w={260} h={14} />
              <SkeletonBox w={420} h={12} />
            </div>
          ) : (
            <div className="muted small">Операционный обзор текущего контура заявок.</div>
          )}
        </div>

        {canShowLinkedClients ? (
          <div className="panel" style={{ minHeight: 172 }}>
            <div className="row" style={{ marginBottom: 10, alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600 }}>Мои клиенты</div>
                <div className="muted small">PRIMARY клиенты доступны для полного board visibility. SECONDARY показываются как ограниченный контур.</div>
              </div>
              <div style={{ width: '100%', maxWidth: 320, minWidth: 0 }}>
                <select
                  value={requestedLinkedClientCompanyId}
                  onChange={(e) => onSelectLinkedClient(e.target.value)}
                  style={{ width: '100%' }}
                  disabled={!linkedClientsLoaded || linkedClients.length === 0}
                >
                  {!requestedLinkedClientCompanyId ? <option value="">Выберите клиента</option> : null}
                  {linkedClients.map((item) => (
                    <option key={item.clientCompany.id} value={item.clientCompany.id}>
                      {item.clientCompany.name} · {item.role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!linkedClientsLoaded ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <SkeletonBox w="100%" h={52} />
                <SkeletonBox w="100%" h={52} />
              </div>
            ) : providerHasNoLinkedClients ? (
              <div className="muted small">У этой provider company пока нет активных связанных клиентов.</div>
            ) : providerRestrictedSelection && selectedLinkedClient ? (
              <div className="card" style={{ padding: 12, borderRadius: 12 }}>
                <div style={{ fontWeight: 600 }}>{selectedLinkedClient.clientCompany.name}</div>
                <div className="muted small" style={{ marginTop: 4 }}>
                  {selectedLinkedClient.role} · полный board visibility для этого клиента пока недоступен.
                </div>
              </div>
            ) : isResolvingProviderContext ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <SkeletonBox w="100%" h={56} />
                <SkeletonBox w="100%" h={56} />
              </div>
            ) : selectedLinkedClient ? (
              <div className="card" style={{ padding: 12, borderRadius: 12, border: '1px solid #c7d2fe', background: '#eef2ff' }}>
                <div className="row" style={{ marginBottom: 0, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{selectedLinkedClient.clientCompany.name}</div>
                    <div className="muted small" style={{ marginTop: 4 }}>
                      {providerScopeLabel(selectedLinkedClient.role)} · открытые заявки: {selectedLinkedClient.summary.openTickets} · локации: {selectedLinkedClient.summary.locations}
                    </div>
                    <div className="muted small" style={{ marginTop: 4 }}>
                      Public intake: {selectedLinkedClient.summary.publicRequestEnabled ? 'включён' : 'выключен'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="ghost" type="button" onClick={() => onSelectLinkedClient(selectedLinkedClient.clientCompany.id)}>
                      Открыть доску
                    </button>
                    <Link to={buildAnalyticsLink({ linkedClientCompanyId: selectedLinkedClient.clientCompany.id })}>
                      <button className="ghost" type="button">Открыть аналитику</button>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {linkedClients.map((item) => (
                  <div
                    key={item.clientCompany.id}
                    className="card"
                    style={{
                      border: '1px solid #e5e7eb',
                      background: '#fff',
                      borderRadius: 12,
                      padding: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{item.clientCompany.name}</div>
                      <div className="muted small">
                        {item.role} · открытые заявки: {item.summary.openTickets} · локации: {item.summary.locations}
                      </div>
                      <div className="muted small">Public intake: {item.summary.publicRequestEnabled ? 'включён' : 'выключен'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="ghost" type="button" onClick={() => onSelectLinkedClient(item.clientCompany.id)}>
                        Открыть доску
                      </button>
                      {item.role === 'PRIMARY' ? (
                        <Link to={buildAnalyticsLink({ linkedClientCompanyId: item.clientCompany.id })}>
                          <button className="ghost" type="button">Аналитика</button>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {boardQ.isError ? <div className="alert">{(boardQ.error as any)?.message || String(boardQ.error)}</div> : null}
      {observerCompanyQ.isError ? <div className="alert">{(observerCompanyQ.error as any)?.message || String(observerCompanyQ.error)}</div> : null}
      {ownCompanyQ.isError ? <div className="alert">{(ownCompanyQ.error as any)?.message || String(ownCompanyQ.error)}</div> : null}
      {linkedClientsQ.isError ? <div className="alert">{(linkedClientsQ.error as any)?.message || String(linkedClientsQ.error)}</div> : null}

      <div className="panel uiCard" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 12, minHeight: 92 }}>
        <div>
          <div className="muted small">Заявок сегодня</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{statsLoading ? <SkeletonBox w={44} h={24} /> : stats.today}</div>
        </div>
        <div>
          <div className="muted small">Открытые заявки</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{statsLoading ? <SkeletonBox w={44} h={24} /> : stats.open}</div>
        </div>
        <div>
          <div className="muted small">SLA нарушения</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{statsLoading ? <SkeletonBox w={44} h={24} /> : stats.breachedByCol}</div>
          <div className="muted small" style={{ marginTop: 2 }}>
            Под риском: {statsLoading ? '…' : stats.atRiskByCol}
          </div>
        </div>
        <div>
          <div className="muted small">Срочные</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>{statsLoading ? <SkeletonBox w={44} h={24} /> : stats.urgent}</div>
        </div>
      </div>

      {analyticsVisible ? (
      <div className="panel uiCard managementStickyPanel" style={{ marginBottom: 12 }}>
        <div className="row" style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>Service context аналитика</div>
          <div className="muted small">
            {contextAnalyticsQ.isFetching ? 'Обновляем…' : `Тикетов в срезе: ${contextAnalyticsQ.data?.meta.totalTickets ?? '—'}`}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <div>
            <div className="muted small" style={{ marginBottom: 6 }}>По локациям</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {(contextAnalyticsQ.data?.byLocation || []).slice(0, 5).map((row) => (
                <div key={row.locationId} className="muted small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => {
                      setSelectedLocationId(row.locationId)
                      setSelectedEquipmentId('')
                    }}
                    style={{ padding: '2px 6px' }}
                  >
                    {row.locationName}
                  </button>
                  <span>
                    всего: {row.total} ·
                    <button className="ghost" type="button" onClick={() => setSelectedStatus('NEW')} style={{ padding: '2px 4px' }}> NEW: {row.NEW}</button> ·
                    <button className="ghost" type="button" onClick={() => setSelectedStatus('IN_PROGRESS')} style={{ padding: '2px 4px' }}> IN_PROGRESS: {row.IN_PROGRESS}</button> ·
                    <button className="ghost" type="button" onClick={() => setSelectedStatus('DONE')} style={{ padding: '2px 4px' }}> DONE: {row.DONE}</button>
                  </span>
                </div>
              ))}
              {!contextAnalyticsQ.isFetching && (contextAnalyticsQ.data?.byLocation?.length || 0) === 0 ? (
                <div className="muted small">Нет данных</div>
              ) : null}
            </div>
          </div>
          <div>
            <div className="muted small" style={{ marginBottom: 6 }}>По оборудованию</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {(contextAnalyticsQ.data?.byEquipment || []).slice(0, 5).map((row) => (
                <div key={row.equipmentId} className="muted small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => {
                      if (row.locationId) setSelectedLocationId(row.locationId)
                      setSelectedEquipmentId(row.equipmentId)
                    }}
                    style={{ padding: '2px 6px' }}
                  >
                    {row.equipmentName}
                  </button>
                  <span>
                    всего: {row.total} ·
                    <button className="ghost" type="button" onClick={() => setSelectedStatus('NEW')} style={{ padding: '2px 4px' }}> NEW: {row.NEW}</button> ·
                    <button className="ghost" type="button" onClick={() => setSelectedStatus('IN_PROGRESS')} style={{ padding: '2px 4px' }}> IN_PROGRESS: {row.IN_PROGRESS}</button> ·
                    <button className="ghost" type="button" onClick={() => setSelectedStatus('DONE')} style={{ padding: '2px 4px' }}> DONE: {row.DONE}</button>
                  </span>
                </div>
              ))}
              {!contextAnalyticsQ.isFetching && (contextAnalyticsQ.data?.byEquipment?.length || 0) === 0 ? (
                <div className="muted small">Нет данных</div>
              ) : null}
            </div>
          </div>
        </div>
        {(selectedLocationId || selectedEquipmentId || selectedStatus || includeArchived) ? (
          <div className="muted small" style={{ marginTop: 10 }}>
            Активные quick filters:
            {selectedLocationId ? ` location=${selectedLocationId}` : ''}
            {selectedEquipmentId ? ` equipment=${selectedEquipmentId}` : ''}
            {selectedStatus ? ` status=${selectedStatus}` : ''}
            {includeArchived ? ' includeArchived=true' : ''}
            {' · '}
            <button
              className="ghost"
              type="button"
              onClick={() => {
                setSelectedLocationId('')
                setSelectedEquipmentId('')
                setSelectedStatus('')
                setIncludeArchived(false)
              }}
              style={{ padding: '2px 6px' }}
            >
              Без фильтров
            </button>
          </div>
        ) : null}
        {contextAnalyticsQ.isError ? <div className="alert" style={{ marginTop: 10 }}>{(contextAnalyticsQ.error as any)?.message || String(contextAnalyticsQ.error)}</div> : null}
      </div>
      ) : null}

      <div className="panel uiCard" style={{ marginBottom: 12 }}>
        <div className="row" style={{ marginBottom: 0 }}>
          <div className="muted small">Пагинация</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <label className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              take
              <input style={{ width: '100%', maxWidth: 110, minWidth: 0 }} value={String(take)} onChange={(e) => setTake(Math.max(20, Math.min(1000, Number(e.target.value) || 0)))} />
            </label>
            <div className="muted small">Для демо можно увеличить take, например до 300.</div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 10, marginBottom: 0, alignItems: 'center' }}>
          <div className="muted small">Service context фильтры</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              Локация
              <select
                value={selectedLocationId}
                onChange={(e) => {
                  setSelectedLocationId(e.target.value)
                  setSelectedEquipmentId('')
                }}
                style={{ width: '100%', maxWidth: 320, minWidth: 0 }}
              >
                <option value="">Все</option>
                {locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>{location.label}</option>
                ))}
              </select>
            </label>
            <label className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              Оборудование
              <select
                value={selectedEquipmentId}
                onChange={(e) => setSelectedEquipmentId(e.target.value)}
                style={{ width: '100%', maxWidth: 320, minWidth: 0 }}
              >
                <option value="">Все</option>
                {equipmentOptions.map((equipment) => (
                  <option key={equipment.id} value={equipment.id}>{equipment.label}</option>
                ))}
              </select>
            </label>
            <label className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
              />
              Архив (DONE {'>'} 7 дней)
            </label>
            <button className="ghost" type="button" onClick={resetBoardFilters}>
              Без фильтров
            </button>
          </div>
        </div>
      </div>

      {canBulkOperate ? (
        <div className="panel uiCard" style={{ marginBottom: 12 }}>
        <div className="row" style={{ marginBottom: 0, alignItems: 'center' }}>
          <div className="muted small">Bulk actions</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                disabled={!allVisibleTicketIds.length || bulkBusy}
                onChange={(e) => setSelectedTicketIds(e.target.checked ? allVisibleTicketIds : [])}
              />
              Выбрать все на доске
            </label>
            <span className="muted small">Выбрано: {selectedTicketIds.length}</span>
            {isTechnician ? (
              <button
                className="ghost"
                type="button"
                disabled={!selectedTicketIds.length || bulkBusy}
                onClick={() => runBulkAction('claim')}
              >
                Взять себе
              </button>
            ) : null}
            <button
              className="ghost"
              type="button"
              disabled={!selectedTicketIds.length || bulkBusy}
              onClick={() => runBulkAction('IN_PROGRESS')}
            >
              В работу
            </button>
            <button
              className="ghost"
              type="button"
              disabled={!selectedTicketIds.length || bulkBusy}
              onClick={() => runBulkAction('AWAITING_ACCEPTANCE')}
            >
              Отправить на приёмку
            </button>
            <button
              className="ghost"
              type="button"
              disabled={!selectedTicketIds.length || bulkBusy}
              onClick={() => setSelectedTicketIds([])}
            >
              Сбросить выбор
            </button>
          </div>
        </div>
        {bulkError ? <div className="alert" style={{ marginTop: 10 }}>{bulkError}</div> : null}
        </div>
      ) : null}
      {quickActionSuccess ? (
        <div className="panel" style={{ marginBottom: 12, border: '1px solid #86efac', background: '#f0fdf4', color: '#166534' }}>
          {quickActionSuccess}
        </div>
      ) : null}
      {quickActionError ? <div className="alert" style={{ marginBottom: 12 }}>{quickActionError}</div> : null}

      {providerHasNoLinkedClients ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 6 }}>Нет связанных клиентов</h3>
          <div className="muted small">Когда у provider company появится ACTIVE PRIMARY ServiceContract, здесь откроется клиентская operational board.</div>
        </div>
      ) : null}

      {providerRestrictedSelection && selectedLinkedClient ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <h3 style={{ marginBottom: 6 }}>Ограниченный доступ</h3>
          <div className="muted small">
            Для клиента {selectedLinkedClient.clientCompany.name} связь имеет роль SECONDARY, поэтому полный board visibility на этом этапе недоступен.
          </div>
        </div>
      ) : null}

      {isEmpty ? (
        <div className="panel">
          <h3 style={{ marginBottom: 6 }}>Заявок пока нет</h3>
          <div className="muted small" style={{ marginBottom: 10 }}>
            {canShowLinkedClients && selectedLinkedClient
              ? `У клиента ${selectedLinkedClient.clientCompany.name} пока нет заявок.`
              : isTechnician
                ? 'Нет назначенных заявок и доступных заявок для claim в вашем operational scope.'
                : 'Создайте тестовую заявку, чтобы доска стала живой для демонстрации.'}
          </div>
          <div className="emptyStateNote">
            Колонки «Новые» и далее показывают этапы жизненного цикла. Пустая колонка — нормально, если заявок в этом статусе нет.
          </div>
          {providerCanCreateTicket ? (
            <Link to={buildCreateTicketLink(effectiveLinkedClientCompanyId)}>
              <button>Создать заявку</button>
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="kanban">
        {initialBoardLoading || isResolvingProviderContext ? (
          <>
            <ColumnSkeleton title="Новые" />
            <ColumnSkeleton title="Назначенные" />
            <ColumnSkeleton title="В работе" />
            <ColumnSkeleton title="Завершённые" />
            <ColumnSkeleton title="Отменённые" />
          </>
        ) : boardEnabled && boardData ? (
          columns.map((col) => (
            <div key={col.status} className="col">
              <div className="colhead">
                <div className="coltitle">{statusLabel(col.status)}</div>
                <div className="pill">{col.total}</div>
              </div>

              <div className="muted small" style={{ marginBottom: 8 }}>
                SLA: нарушено {col.sla.breached}, под риском {col.sla.atRisk}
              </div>

              <div className="cards">
                {col.cards.map((ticket) => (
                  <div key={ticket.id} className="ticket">
                    <div className="row" style={{ marginBottom: 4, alignItems: 'flex-start', gap: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', marginTop: 2 }}>
                        <input
                          type="checkbox"
                          checked={selectedTicketIds.includes(ticket.id)}
                          disabled={bulkBusy}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setSelectedTicketIds((prev) =>
                              checked ? (prev.includes(ticket.id) ? prev : [...prev, ticket.id]) : prev.filter((id) => id !== ticket.id),
                            )
                          }}
                        />
                      </label>
                      <Link
                        to={buildTicketLink(ticket)}
                        state={buildTicketLinkState()}
                        style={{ textDecoration: 'none', flex: 1, minWidth: 0 }}
                      >
                        <div className="ticketTitle">{ticket.title}</div>
                      </Link>
                    </div>
                      {compactServiceContext(ticket) ? (
                        <div className="muted small" style={{ marginTop: 4, marginBottom: 2 }}>
                          {compactServiceContext(ticket)}
                        </div>
                      ) : null}
                      <div className="muted small" style={{ marginTop: 4, marginBottom: 2 }}>
                        Создал: {compactTicketCreatorLabel(ticket)}
                      </div>

                      <div className="ticketMeta">
                        <UrgencyTag urgency={ticket.urgency} />
                        {ticket.isChild ? <span className="tag">Доп. работа</span> : null}
                        {ticket.slaBreached ? <span className="tag danger">SLA нарушен</span> : null}
                        {isTechnician && ticket.status === 'NEW' && !ticket.assignedTechnician ? <span className="tag">Можно взять</span> : null}
                        {isTechnician && ticket.assignedTechnician?.id === meQ.data?.id ? <span className="tag">Моя заявка</span> : null}
                        {ticket.assignedTechnician ? <span className="tag">{compactTicketAssigneeLabel(ticket)}</span> : <span className="tag">Не назначено</span>}
                      </div>

                      <div className="muted small" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <span>{fmt(ticket.createdAt)}</span>
                        <span title="Срок SLA">{ticket.slaDueAt ? `Срок: ${fmt(ticket.slaDueAt)}` : 'Срок: —'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        {meQ.data?.role === 'TECHNICIAN' ? (
                          <>
                            {ticket.status === 'NEW' && !ticket.assignedTechnician && ticket.canClaimByCurrentUser === true ? (
                              <button
                                type="button"
                                className="ghost"
                                disabled={quickActionM.isPending}
                                onClick={() =>
                                  quickActionM.mutate({
                                    ticket,
                                    action: 'claim',
                                  })
                                }
                              >
                                Взять заявку
                              </button>
                            ) : null}
                            {ticket.status === 'ASSIGNED' && ticket.assignedTechnician?.id === meQ.data?.id ? (
                              <button
                                type="button"
                                className="ghost"
                                disabled={quickActionM.isPending}
                                onClick={() =>
                                  quickActionM.mutate({
                                    ticket,
                                    action: 'start',
                                  })
                                }
                              >
                                Начать выполнение
                              </button>
                            ) : null}
                            {ticket.status === 'IN_PROGRESS' && ticket.assignedTechnician?.id === meQ.data?.id ? (
                              <button
                                type="button"
                                className="ghost"
                                disabled={quickActionM.isPending}
                                onClick={() => quickActionM.mutate({ ticket, action: 'done' })}
                              >
                                Отправить на приёмку
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {meQ.data?.role === 'CLIENT' ? (
                          <Link to={buildTicketLink(ticket)} state={buildTicketLinkState()}>
                            <button type="button" className="ghost">Открыть</button>
                          </Link>
                        ) : null}
                        {meQ.data?.role === 'DISPATCHER' && ticket.status === 'NEW' && !ticket.assignedTechnician ? (
                          <>
                            <button
                              type="button"
                              className="ghost"
                              disabled={quickActionM.isPending}
                              onClick={() => quickActionM.mutate({ ticket, action: 'assign' })}
                            >
                              Назначить
                            </button>
                            {smartAssignByTicket[ticket.id] ? (
                              <div className="muted small" style={{ marginTop: 6 }}>
                                <div>Назначен: {smartAssignByTicket[ticket.id].technicianName}</div>
                                <div>Причина: {smartAssignByTicket[ticket.id].reason}</div>
                                <Link
                                  to={buildTicketLink(ticket)}
                                  state={buildTicketLinkState()}
                                  style={{ textDecoration: 'none' }}
                                >
                                  <button type="button" className="ghost" style={{ marginTop: 6 }}>
                                    Сменить
                                  </button>
                                </Link>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                  </div>
                ))}
                {col.cards.length === 0 ? (
                  <div className="muted small">
                    Нет заявок
                    <div className="emptyStateNote" style={{ marginTop: 4 }}>
                      Заявки появятся здесь после создания или смены статуса.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <div className="muted small">
              {canShowLinkedClients
                ? 'Доска откроется после выбора доступного linked client.'
                : 'Не удалось загрузить доску. Проверьте права доступа и попробуйте обновить страницу.'}
            </div>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  )
}
