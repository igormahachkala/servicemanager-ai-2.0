export { MobileHome } from './home/MobileHome'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import {
  compactTicketScope,
  mobileTicketCategoryLocationFromCard,
  mobileTicketNavState,
  mobileTicketNumberTitle,
  mobileTicketPriorityIsUrgent,
  mobileTicketSlaCountdownLabel,
  mobileTicketStatusLabelRu,
  stripMobileHomeRestoreFromNavState,
  type MobileTicketNavState,
  scopeForMobileTicketLink,
} from './mobileTicketDisplay'
import {
  filterTicketsForMobileHomeTab,
  mobileHomeBoardTabCounts,
  mobileHomeTabEmptyCopy,
  MOBILE_HOME_BOARD_CHIP_IDS,
  MOBILE_HOME_BOARD_CHIP_LABELS,
  type MobileHomeBoardChipId,
  type MobileHomeBoardFilterTab,
} from './mobileHomeBoardFilters'
import {
  buildMobileHomeVisibleTickets,
  formatActiveMobileHomeFiltersSummary,
  getSlaState,
  readPersistedMobileHomeBoardUi,
  writePersistedMobileHomeBoardUi,
} from './mobileHomeListUtils'
import {
  MobileBoardClaimFallbackHint,
  MobileClaimReasonHintBox,
  MobileHomeTabsIntroBanner,
  MobileRoleContextStrip,
  MobileTechnicianFirstStepsCard,
  dismissMobileHomeIntro,
  readMobileHomeIntroDismissed,
} from './MobileUxHints'
import { formatMobileMutationError } from './mobileActionErrors'
import { getOnlineStatus, loadBoardCache, saveBoardCache, useOnlineStatus } from './offlineQueue'

const MOBILE_HOME_TAB_LABELS: Record<MobileHomeBoardFilterTab, string> = {
  all: 'Все',
  mine: 'Мои',
  in_work: 'В работе',
}

const MOBILE_HOME_TABS: MobileHomeBoardFilterTab[] = ['all', 'mine', 'in_work']

function getPrimaryActionLabel(
  ticket: api.TicketCard,
  meId: string | undefined,
  role: api.Role | undefined,
): 'Взять в работу' | 'Запросить назначение' | 'Начать' | 'Завершить' | null {
  if (!api.allowMobileHomeFieldTicketActions(role) || !meId) return null
  if (ticket.status === 'NEW' && !ticket.assignedTechnician) {
    if (role === 'TECHNICIAN' && ticket.assignmentRequestedByCurrentUser) return null
    if (role === 'TECHNICIAN' && ticket.canClaimByCurrentUser === false) return 'Запросить назначение'
    return 'Взять в работу'
  }
  if (ticket.status === 'ASSIGNED' && ticket.assignedTechnician?.id === meId) return 'Начать'
  if (ticket.status === 'IN_PROGRESS' && ticket.assignedTechnician?.id === meId) return 'Завершить'
  return null
}

function assignedTechnicianDisplay(ticket: api.TicketCard): string {
  const t = ticket.assignedTechnician
  if (!t) return 'Не назначен'
  const fullName = [t.firstName?.trim(), t.lastName?.trim()].filter(Boolean).join(' ').trim()
  if (fullName) return fullName
  const email = (t.email || '').trim()
  if (email) return email
  return (t.id || '').trim() || 'Не назначен'
}

function homeTicketActionProgressLabel(
  ticket: api.TicketCard,
  actionM: { isPending: boolean; variables?: api.TicketCard },
  closeBusy: boolean,
  closeModalTicketId: string | undefined,
  assignBusy: boolean,
  assignTicketId: string | undefined,
): string | null {
  if (closeBusy && closeModalTicketId === ticket.id) return 'Завершаем…'
  if (assignBusy && assignTicketId === ticket.id) return 'Назначаем…'
  if (actionM.isPending && actionM.variables?.id === ticket.id) {
    if (ticket.status === 'NEW') {
      if (ticket.canClaimByCurrentUser === false && !ticket.assignmentRequestedByCurrentUser)
        return 'Отправляем запрос…'
      return 'Берём заявку…'
    }
    if (ticket.status === 'ASSIGNED') return 'Начинаем…'
  }
  return null
}

function patchBoardCards(
  board: api.BoardResponse | undefined,
  ticketId: string,
  patch: (ticket: api.TicketCard) => api.TicketCard,
): api.BoardResponse | undefined {
  if (!board) return board
  return {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      cards: column.cards.map((ticket) => (ticket.id === ticketId ? patch(ticket) : ticket)),
    })),
  }
}

function TicketCard(props: {
  ticket: api.TicketCard
  ticketHref: string
  linkState?: MobileTicketNavState
  actionLabel?: 'Взять в работу' | 'Запросить назначение' | 'Начать' | 'Завершить' | null
  onAction?: (ticket: api.TicketCard) => void
  actionProgressLabel?: string | null
  assignFooter?: { onOpen: () => void; disabled: boolean } | null
  inlineError?: string | null
  inlineSuccess?: string | null
  disabledOverlay?: boolean
}) {
  const {
    ticket,
    ticketHref,
    linkState,
    actionLabel = null,
    onAction,
    actionProgressLabel = null,
    assignFooter = null,
    inlineError = null,
    inlineSuccess = null,
    disabledOverlay = false,
  } = props
  const claimReason = (ticket.claimAvailabilityReason || '').trim()
  const actionBusy = !!actionProgressLabel
  const slaLine = mobileTicketSlaCountdownLabel({
    slaDueAt: ticket.slaDueAt,
    slaBreached: ticket.slaBreached,
    status: ticket.status,
  })
  const urgent = mobileTicketPriorityIsUrgent(ticket.priority ?? 'NORMAL')
  const overdue = ticket.slaBreached
  const slaState = getSlaState(ticket, Date.now())
  const problemPreview = (() => {
    const t = (ticket.description || '').trim()
    if (t) return t
    return (ticket.title || '').trim() || '—'
  })()
  const statusClass = `mobileTicketStatus mobileTicketStatus--${ticket.status}`
  const cardClass = [
    'mobileCard',
    'mobileTicketCard',
    `mobileTicketCard--${ticket.status}`,
    overdue ? 'mobileTicketCardSlaOverdue' : '',
    slaState === 'warning' ? 'mobileTicketCardSlaWarning' : '',
    slaState === 'ok' ? 'mobileTicketCardSlaOk' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cardClass} style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
      <Link to={ticketHref} state={linkState ?? mobileTicketNavState('home')} className="mobileCardClickable" style={{ borderRadius: 0 }}>
        <div style={{ padding: 12 }}>
          <div className="mobileRow">
            <strong>{mobileTicketNumberTitle(ticket.ticketNumber)}</strong>
            <span className={statusClass}>{mobileTicketStatusLabelRu(ticket.status)}</span>
          </div>
          {slaState === 'breached' ? (
            <div className="mobileSlaBadgeRow">
              <span className="mobileSlaStateBadge mobileSlaStateBadge--breached">Просрочено</span>
            </div>
          ) : null}
          {slaState === 'warning' ? (
            <div className="mobileSlaBadgeRow">
              <span className="mobileSlaStateBadge mobileSlaStateBadge--warning">Скоро дедлайн</span>
            </div>
          ) : null}
          <div className="mobileTicketCardPriorityRow" style={{ marginTop: 6 }}>
            {urgent ? (
              <span className="mobileSlaUrgentPill">Срочный приоритет</span>
            ) : (
              <span className="mobileMeta">Приоритет: обычный</span>
            )}
            {ticket.urgency === 'URGENT' && !urgent ? <span className="mobileSlaUrgentPill">Срочная заявка</span> : null}
          </div>
          {ticket.assignmentRequestedByCurrentUser ? (
            <div className="mobileAssignmentRequestedRow" style={{ marginTop: 8 }}>
              <span className="mobileAssignmentRequestedBadge">Запрос отправлен</span>
              <span className="mobileMeta mobileAssignmentRequestedRowHint">Ожидайте назначение диспетчером</span>
            </div>
          ) : null}
          <div className="mobileMeta" style={{ marginTop: 4 }}>Локация: {ticket.location?.name || ticket.pointName || 'Не указана'}</div>
          <div className="mobileMeta" style={{ marginTop: 4 }}>Категория: {ticket.category?.name || ticket.title || 'Без категории'}</div>
          {(ticket.requesterName || '').trim() ? (
            <div className="mobileMeta" style={{ marginTop: 4 }}>
              Заявитель: {(ticket.requesterName || '').trim()}
            </div>
          ) : null}
          <div className="mobileTicketProblemPreview">{problemPreview}</div>
          <div className="mobileMeta" style={{ marginTop: 6 }}>
            Исполнитель: {assignedTechnicianDisplay(ticket)}
          </div>
          {slaLine ? (
            <div className="mobileTicketSlaRow" style={{ marginTop: 6 }}>
              <span className="mobileTicketSlaCountdown">{slaLine}</span>
            </div>
          ) : null}
        </div>
      </Link>
      {assignFooter ? (
        <div style={{ padding: '0 12px 12px' }}>
          <button
            type="button"
            className="mobileBtn mobileBtnSecondary"
            style={{ width: '100%' }}
            disabled={assignFooter.disabled}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              assignFooter.onOpen()
            }}
          >
            Назначить
          </button>
        </div>
      ) : null}
      {actionLabel === 'Запросить назначение' ? (
        <div style={{ padding: '8px 12px 0' }}>
          {claimReason ? (
            <MobileClaimReasonHintBox reason={claimReason} className="mobileUxHintReason--compact" />
          ) : (
            <MobileBoardClaimFallbackHint />
          )}
        </div>
      ) : null}
      {actionLabel ? (
        <div style={{ padding: '0 12px 12px' }}>
          <button
            type="button"
            className={`mobileBtn${
              actionLabel === 'Взять в работу'
                ? ' mobileBtn--claim'
                : actionLabel === 'Запросить назначение'
                  ? ' mobileBtnSecondary'
                  : actionLabel === 'Начать'
                    ? ' mobileBtn--start'
                    : ' mobileBtn--done'
            }`}
            style={{ width: '100%' }}
            disabled={actionBusy}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onAction?.(ticket)
            }}
          >
            {actionProgressLabel ? (
              <span className="mobileBtnBusy">
                <span className="mobileBtnSpinner" aria-hidden="true" />
                {actionProgressLabel}
              </span>
            ) : (
              actionLabel
            )}
          </button>
        </div>
      ) : null}
      {inlineSuccess ? <div className="mobileCardInlineSuccess">{inlineSuccess}</div> : null}
      {inlineError ? <div className="mobileCardInlineError">{inlineError}</div> : null}
      {disabledOverlay ? (
        <div className="mobileCardBusyOverlay" aria-hidden="true">
          <span className="mobileCardBusyOverlaySpinner" />
        </div>
      ) : null}
    </div>
  )
}

export function MobileHome() {
  const location = useLocation()
  const navigate = useNavigate()
  const search = new URLSearchParams(location.search)
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const isOnline = useOnlineStatus()
  const linkedClientCompanyId = (search.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
  const companyId = (search.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
  const pageScope = {
    linkedClientCompanyId: linkedClientCompanyId || undefined,
    companyId: companyId || undefined,
  }
  const queryClient = useQueryClient()
  const [mobileActionToast, setMobileActionToast] = useState('')
  useEffect(() => {
    if (!mobileActionToast) return
    const tid = window.setTimeout(() => setMobileActionToast(''), 2800)
    return () => window.clearTimeout(tid)
  }, [mobileActionToast])

  const techNoLinked = meQ.data?.role === 'TECHNICIAN' && !linkedClientCompanyId
  const techBoundDefaultsQ = useQuery({
    queryKey: ['technician-bound-defaults', meQ.data?.id],
    queryFn: () => api.getTechnicianBoundContexts(),
    enabled: !!meQ.data && meQ.data.role === 'TECHNICIAN' && !linkedClientCompanyId,
  })

  useEffect(() => {
    if (meQ.data?.role !== 'TECHNICIAN') return
    if (linkedClientCompanyId) return
    if (!techBoundDefaultsQ.isSuccess) return
    const picked = api.pickFirstTechnicianBoundLinkedClientCompanyId(techBoundDefaultsQ.data || [])
    if (!picked) return
    api.persistScopeFromSearchParams(new URLSearchParams({ linkedClientCompanyId: picked }), meQ.data)
    const nextPath = api.appendScopeToPath(
      location.pathname || '/m',
      { linkedClientCompanyId: picked, companyId: companyId || undefined },
      meQ.data,
    )
    if (nextPath !== `${location.pathname}${location.search}`) {
      navigate(nextPath, { replace: true })
    }
  }, [
    meQ.data,
    linkedClientCompanyId,
    techBoundDefaultsQ.isSuccess,
    techBoundDefaultsQ.data,
    navigate,
    companyId,
    location.pathname,
    location.search,
  ])

  const boardQ = useQuery({
    queryKey: ['mobile-home-board', linkedClientCompanyId, companyId],
    queryFn: async () => {
      if (!getOnlineStatus()) {
        const cached = loadBoardCache(pageScope)
        if (cached?.data) return cached.data
        throw new Error('Нет сохранённых заявок. Откройте главную при подключении к сети хотя бы раз.')
      }
      const data = await api.board({
        linkedClientCompanyId: pageScope.linkedClientCompanyId,
        companyId: pageScope.companyId,
        take: 100,
      })
      saveBoardCache(pageScope, data)
      return data
    },
    enabled:
      (!isOnline || !!meQ.data) &&
      (!meQ.data || meQ.data.role !== 'TECHNICIAN' || !!linkedClientCompanyId),
  })

  const linkedClientsQ = useQuery({
    queryKey: ['mobile-home-linked-clients'],
    queryFn: api.getLinkedClients,
    enabled: !!linkedClientCompanyId && !!meQ.data && meQ.data.role !== 'TECHNICIAN',
  })

  const cards = boardQ.data?.columns.flatMap((col) => col.cards || []) || []
  const canAssignProvider = api.isProviderTicketAssignRole(meQ.data?.role)

  const persistedBoardUi = useMemo(() => readPersistedMobileHomeBoardUi(), [])
  const [boardTab, setBoardTab] = useState<MobileHomeBoardFilterTab>(persistedBoardUi.tab)
  const [activeChips, setActiveChips] = useState<Set<MobileHomeBoardChipId>>(
    () => new Set(persistedBoardUi.chips),
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [homeIntroDismissed, setHomeIntroDismissed] = useState(() => readMobileHomeIntroDismissed())

  useLayoutEffect(() => {
    const s = location.state as MobileTicketNavState | null | undefined
    if (!s || typeof s !== 'object') return
    const hasTab = !!(s.homeBoardTab && MOBILE_HOME_TABS.includes(s.homeBoardTab))
    const hasChips = Array.isArray(s.homeBoardChips)
    const hasSearch = typeof s.homeBoardSearch === 'string'
    if (!hasTab && !hasChips && !hasSearch) return
    if (hasTab && s.homeBoardTab) setBoardTab(s.homeBoardTab)
    if (hasChips) {
      setActiveChips(
        new Set(
          s.homeBoardChips!.filter((c): c is MobileHomeBoardChipId =>
            MOBILE_HOME_BOARD_CHIP_IDS.includes(c as MobileHomeBoardChipId),
          ),
        ),
      )
    }
    if (hasSearch) setSearchQuery((s.homeBoardSearch || '').slice(0, 240))
    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: stripMobileHomeRestoreFromNavState(s) ?? undefined,
    })
  }, [location.key, location.pathname, location.search, navigate])

  useEffect(() => {
    writePersistedMobileHomeBoardUi(boardTab, activeChips)
  }, [boardTab, activeChips])

  const tabCounts = useMemo(
    () => mobileHomeBoardTabCounts(cards, meQ.data?.id, meQ.data?.role),
    [cards, meQ.data?.id, meQ.data?.role],
  )
  const atRiskThresholdMinutes = boardQ.data?.meta.atRiskThresholdMinutes ?? 60

  const visibleTickets = useMemo(
    () =>
      buildMobileHomeVisibleTickets({
        cards,
        tab: boardTab,
        meId: meQ.data?.id,
        meRole: meQ.data?.role,
        chips: activeChips,
        searchQuery,
        atRiskThresholdMinutes,
      }),
    [cards, boardTab, meQ.data?.id, meQ.data?.role, activeChips, searchQuery, atRiskThresholdMinutes],
  )

  const tabOnlyTickets = useMemo(
    () => filterTicketsForMobileHomeTab(cards, boardTab, meQ.data?.id, meQ.data?.role),
    [cards, boardTab, meQ.data?.id, meQ.data?.role],
  )

  const hasHomeListFilters = !!searchQuery.trim() || activeChips.size > 0
  const filterSummary = useMemo(
    () =>
      formatActiveMobileHomeFiltersSummary({
        searchQuery,
        chips: activeChips,
        chipLabels: MOBILE_HOME_BOARD_CHIP_LABELS,
      }),
    [searchQuery, activeChips],
  )

  function toggleChip(id: MobileHomeBoardChipId) {
    setActiveChips((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function resetHomeListFilters() {
    setSearchQuery('')
    setActiveChips(new Set())
  }

  const [assignTicket, setAssignTicket] = useState<api.TicketCard | null>(null)
  const [assignTechId, setAssignTechId] = useState('')
  const [assignErr, setAssignErr] = useState('')
  const [homeActionErr, setHomeActionErr] = useState('')
  const [actionErrorByTicketId, setActionErrorByTicketId] = useState<Record<string, string>>({})
  const [actionSuccessByTicketId, setActionSuccessByTicketId] = useState<Record<string, string>>({})

  function showActionSuccess(ticketId: string, message: string) {
    if (!ticketId) return
    setActionSuccessByTicketId((prev) => ({ ...prev, [ticketId]: message }))
    window.setTimeout(() => {
      setActionSuccessByTicketId((prev) => {
        if (!prev[ticketId]) return prev
        const next = { ...prev }
        delete next[ticketId]
        return next
      })
    }, 2800)
  }

  const mobileHomeBoardKey = ['mobile-home-board', linkedClientCompanyId, companyId] as const
  const mobileMyBoardKey = ['mobile-my-board', linkedClientCompanyId, companyId] as const

  useEffect(() => {
    setHomeActionErr('')
    setActionErrorByTicketId({})
    setActionSuccessByTicketId({})
  }, [boardTab, activeChips, searchQuery])

  const assignCandidatesQ = useQuery({
    queryKey: ['mobile-home-assign-candidates', assignTicket?.id, linkedClientCompanyId, companyId],
    queryFn: () => api.assignmentCandidates(assignTicket!.id, pageScope),
    enabled: !!assignTicket && canAssignProvider,
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

  const companyPrimaryLine = useMemo(() => {
    const fromMe = (meQ.data?.companyName || '').trim()
    if (fromMe) return fromMe
    return (api.getCompanyLabel(meQ.data) || '').trim() || (!isOnline ? 'Профиль недоступен (офлайн)' : '—')
  }, [meQ.data, isOnline])

  const techBoundLabelQ = useQuery({
    queryKey: ['mobile-home-technician-bound-label', linkedClientCompanyId, meQ.data?.id],
    queryFn: () => api.getTechnicianBoundContexts(linkedClientCompanyId),
    enabled: !!linkedClientCompanyId && meQ.data?.role === 'TECHNICIAN',
  })

  const linkedClientDisplayName = useMemo(() => {
    if (!linkedClientCompanyId) return ''
    if (meQ.data?.role === 'TECHNICIAN') {
      const rows = techBoundLabelQ.data || []
      const hit = rows.find((x) => (x.clientCompany?.id || '').trim() === linkedClientCompanyId)
      return (hit?.clientCompany?.name || '').trim()
    }
    const row = linkedClientsQ.data?.find((x) => x.clientCompany.id === linkedClientCompanyId)
    return (row?.clientCompany?.name || '').trim()
  }, [linkedClientCompanyId, linkedClientsQ.data, meQ.data?.role, techBoundLabelQ.data])

  const closeCameraInputRef = useRef<HTMLInputElement | null>(null)
  const closeGalleryInputRef = useRef<HTMLInputElement | null>(null)
  const [closeModal, setCloseModal] = useState<{
    ticketId: string
    title: string
    file: File | null
    previewUrl: string
    comment: string
    err: string
  } | null>(null)

  useEffect(() => {
    return () => {
      if (closeModal?.previewUrl) {
        URL.revokeObjectURL(closeModal.previewUrl)
      }
    }
  }, [closeModal?.previewUrl])

  const actionM = useMutation({
    mutationFn: async (ticket: api.TicketCard) => {
      if (ticket.status === 'NEW') {
        if (meQ.data?.role === 'TECHNICIAN' && ticket.canClaimByCurrentUser === false) {
          if (ticket.assignmentRequestedByCurrentUser) return
          await api.requestTicketAssignment(ticket.id, pageScope)
          return
        }
        await api.claim(ticket.id, pageScope)
        return
      }
      if (ticket.status === 'ASSIGNED') {
        await api.updateTicketStatus(ticket.id, { status: 'IN_PROGRESS' }, pageScope)
        return
      }
      if (ticket.status === 'IN_PROGRESS') {
        if (!window.confirm('Завершить заявку?')) return
        if (
          !api.allowMobileHomeFieldTicketActions(meQ.data?.role) ||
          ticket.assignedTechnician?.id !== meQ.data?.id
        ) {
          throw new Error('Закрытие недоступно для этой заявки')
        }
        setCloseModal({
          ticketId: ticket.id,
          title: `${mobileTicketNumberTitle(ticket.ticketNumber)} — ${mobileTicketCategoryLocationFromCard(ticket)}`,
          file: null,
          previewUrl: '',
          comment: '',
          err: '',
        })
        return
      }
    },
    onMutate: async (ticket) => {
      await queryClient.cancelQueries({ queryKey: mobileHomeBoardKey })
      await queryClient.cancelQueries({ queryKey: mobileMyBoardKey })

      const previousHomeBoard = queryClient.getQueryData<api.BoardResponse>(mobileHomeBoardKey)
      const previousMyBoard = queryClient.getQueryData<api.BoardResponse>(mobileMyBoardKey)

      if (ticket.status === 'NEW' && meQ.data?.id) {
        const patchedAssignee: api.TicketCard['assignedTechnician'] = {
          id: meQ.data.id,
          email: (meQ.data.email || '').trim(),
          firstName: meQ.data.firstName,
          lastName: meQ.data.lastName,
        }
        queryClient.setQueryData<api.BoardResponse>(mobileHomeBoardKey, (current) =>
          patchBoardCards(current, ticket.id, (item) => ({
            ...item,
            status: 'ASSIGNED',
            assignedTechnicianId: meQ.data!.id,
            assignedTechnician: patchedAssignee,
          })),
        )
        queryClient.setQueryData<api.BoardResponse>(mobileMyBoardKey, (current) =>
          patchBoardCards(current, ticket.id, (item) => ({
            ...item,
            status: 'ASSIGNED',
            assignedTechnicianId: meQ.data!.id,
            assignedTechnician: patchedAssignee,
          })),
        )
      } else if (ticket.status === 'ASSIGNED') {
        queryClient.setQueryData<api.BoardResponse>(mobileHomeBoardKey, (current) =>
          patchBoardCards(current, ticket.id, (item) => ({ ...item, status: 'IN_PROGRESS' })),
        )
        queryClient.setQueryData<api.BoardResponse>(mobileMyBoardKey, (current) =>
          patchBoardCards(current, ticket.id, (item) => ({ ...item, status: 'IN_PROGRESS' })),
        )
      }

      setHomeActionErr('')
      if (ticket?.id) {
        setActionErrorByTicketId((prev) => {
          if (!prev[ticket.id]) return prev
          const next = { ...prev }
          delete next[ticket.id]
          return next
        })
      }
      return { previousHomeBoard, previousMyBoard, ticketId: ticket.id }
    },
    onSuccess: async (_data, ticket) => {
      if (ticket.status === 'IN_PROGRESS') return
      if (
        ticket.status === 'NEW' &&
        meQ.data?.role === 'TECHNICIAN' &&
        ticket.canClaimByCurrentUser === false
      ) {
        setMobileActionToast('Запрос отправлен')
        showActionSuccess(ticket.id, 'Запрос назначения отправлен')
      } else if (ticket.status === 'NEW') {
        setMobileActionToast('Взято в работу')
        showActionSuccess(ticket.id, 'Взято в работу')
      } else if (ticket.status === 'ASSIGNED') {
        setMobileActionToast('Работы начаты')
        showActionSuccess(ticket.id, 'Работы начаты')
      }
    },
    onError: (e: unknown, ticket, context) => {
      if (context?.previousHomeBoard) {
        queryClient.setQueryData(mobileHomeBoardKey, context.previousHomeBoard)
      }
      if (context?.previousMyBoard) {
        queryClient.setQueryData(mobileMyBoardKey, context.previousMyBoard)
      }
      const op =
        ticket.status === 'NEW' && meQ.data?.role === 'TECHNICIAN' && ticket.canClaimByCurrentUser === false
          ? 'request_assignment'
          : ticket.status === 'NEW'
            ? 'claim'
            : ticket.status === 'ASSIGNED'
              ? 'start'
              : 'other'
      const msg = formatMobileMutationError(e, { operation: op })
      setHomeActionErr(msg)
      setMobileActionToast(msg)
      if (ticket?.id) {
        setActionErrorByTicketId((prev) => ({ ...prev, [ticket.id]: msg }))
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
    },
  })

  const closeM = useMutation({
    mutationFn: async () => {
      if (!closeModal) throw new Error('Нет данных для закрытия')
      if (!closeModal.file) throw new Error('Нужно фото отчёта')
      const comment = closeModal.comment.trim()
      if (comment.length < 3) throw new Error('Нужен короткий комментарий (backend требует комментарий для DONE)')

      await api.uploadTicketAttachment(closeModal.ticketId, closeModal.file, pageScope)
      await api.addTicketComment(closeModal.ticketId, comment, pageScope)
      await api.updateTicketStatus(closeModal.ticketId, { status: 'DONE' }, pageScope)
    },
    onMutate: async () => {
      if (!closeModal?.ticketId) return { ticketId: '' }
      await queryClient.cancelQueries({ queryKey: mobileHomeBoardKey })
      await queryClient.cancelQueries({ queryKey: mobileMyBoardKey })
      const previousHomeBoard = queryClient.getQueryData<api.BoardResponse>(mobileHomeBoardKey)
      const previousMyBoard = queryClient.getQueryData<api.BoardResponse>(mobileMyBoardKey)
      queryClient.setQueryData<api.BoardResponse>(mobileHomeBoardKey, (current) =>
        patchBoardCards(current, closeModal.ticketId, (item) => ({ ...item, status: 'DONE' })),
      )
      queryClient.setQueryData<api.BoardResponse>(mobileMyBoardKey, (current) =>
        patchBoardCards(current, closeModal.ticketId, (item) => ({ ...item, status: 'DONE' })),
      )
      setActionErrorByTicketId((prev) => {
        if (!prev[closeModal.ticketId]) return prev
        const next = { ...prev }
        delete next[closeModal.ticketId]
        return next
      })
      return { previousHomeBoard, previousMyBoard, ticketId: closeModal.ticketId }
    },
    onSuccess: async (_data, _vars, context) => {
      if (closeModal?.previewUrl) {
        URL.revokeObjectURL(closeModal.previewUrl)
      }
      if (context?.ticketId) {
        setMobileActionToast('Заявка завершена')
        showActionSuccess(context.ticketId, 'Заявка завершена')
      }
      setCloseModal(null)
      if (closeCameraInputRef.current) closeCameraInputRef.current.value = ''
      if (closeGalleryInputRef.current) closeGalleryInputRef.current.value = ''
    },
    onError: (e: unknown, _vars, context) => {
      if (context?.previousHomeBoard) {
        queryClient.setQueryData(mobileHomeBoardKey, context.previousHomeBoard)
      }
      if (context?.previousMyBoard) {
        queryClient.setQueryData(mobileMyBoardKey, context.previousMyBoard)
      }
      const text = formatMobileMutationError(e, { operation: 'close' })
      setCloseModal((prev) => (prev ? { ...prev, err: text } : prev))
      setMobileActionToast(text)
      if (context?.ticketId) {
        setActionErrorByTicketId((prev) => ({ ...prev, [context.ticketId]: text }))
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
    },
  })

  const assignM = useMutation({
    mutationFn: async (params: { ticketId: string; technicianId: string }) => {
      await api.assignTicket(params.ticketId, params.technicianId, pageScope)
    },
    onMutate: () => {
      setAssignErr('')
    },
    onSuccess: async (_data, params) => {
      const assigned = assignTechOptions.find((x) => x.id === params.technicianId)
      const techLabel = (assigned?.email || '').trim() || (assigned?.id || '').trim() || 'исполнитель'
      setMobileActionToast(`Назначен: ${techLabel}`)
      showActionSuccess(params.ticketId, `Назначен: ${techLabel}`)
      setAssignTicket(null)
      setAssignTechId('')
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-ticket-detail'] })
    },
    onError: (e: unknown) => {
      setAssignErr(formatMobileMutationError(e, { operation: 'assign' }))
    },
  })

  const closeBusy = closeM.isPending
  const assignBusy = assignM.isPending

  const ticketHref = (ticket: api.TicketCard) => {
    if (!meQ.data) return `/m/tickets/${ticket.id}`
    const linkScope = scopeForMobileTicketLink(meQ.data, pageScope, ticket)
    return api.appendScopeToPath(`/m/tickets/${ticket.id}`, compactTicketScope(linkScope), meQ.data)
  }

  const ticketLinkState = (ticket: api.TicketCard) =>
    mobileTicketNavState('home', ticket.companyId, {
      tab: boardTab,
      chips: [...activeChips],
      search: searchQuery.trim() || undefined,
    })

  const closeCanSubmit = useMemo(() => {
    if (!closeModal) return false
    return !!closeModal.file && closeModal.comment.trim().length >= 3 && !closeBusy
  }, [closeBusy, closeModal])

  const techWillRedirectForScope =
    techNoLinked &&
    techBoundDefaultsQ.isSuccess &&
    (techBoundDefaultsQ.data?.length ?? 0) > 0

  const technicianScopeGateReady =
    !techNoLinked || techBoundDefaultsQ.isFetched || techBoundDefaultsQ.isError

  const showMobileHomeTicketBoard =
    technicianScopeGateReady &&
    !techWillRedirectForScope &&
    !boardQ.isError &&
    (meQ.data || (!!boardQ.data && !isOnline))

  return (
    <div className="mobileSection">
      <div>
        <h1 className="mobileTitle">Главная</h1>
        <div className="mobileSubtitle">Операционный экран без desktop-шумов</div>
        {meQ.data ? <MobileRoleContextStrip role={meQ.data.role} /> : null}
        {!isOnline && boardQ.isSuccess && boardQ.data ? (
          <div className="mobileStaleDataBanner" role="status">
            Показаны сохранённые данные
          </div>
        ) : null}
      </div>

      <div className="mobileCard" style={{ padding: 12 }}>
        <div className="mobileMeta">
          <div>
            <span className="mobileContextLabel">Компания:</span> {companyPrimaryLine}
          </div>
          {linkedClientCompanyId ? (
            <div style={{ marginTop: 6 }}>
              <span className="mobileContextLabel">Клиент:</span> {linkedClientDisplayName || '—'}
            </div>
          ) : null}
        </div>
        <Link
          to={api.appendScopeToPath('/m/create', pageScope, meQ.data)}
          className="mobileBtn mobileCreateTicketLink"
        >
          Создать заявку
        </Link>
      </div>

      {boardQ.isError ? (
        <div className="mobileNotice mobileNoticeError">
          {formatMobileMutationError(boardQ.error, { operation: 'other' })}
        </div>
      ) : null}

      {meQ.data?.role === 'TECHNICIAN' && !linkedClientCompanyId ? (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          {techBoundDefaultsQ.isPending ? <div className="mobileNotice">Определяем клиентский контур…</div> : null}
          {techWillRedirectForScope ? <div className="mobileNotice">Подключаем клиентский контур…</div> : null}
          {techBoundDefaultsQ.isError ? (
            <div className="mobileNotice mobileNoticeError">
              {(techBoundDefaultsQ.error as any)?.message || String(techBoundDefaultsQ.error)}
            </div>
          ) : null}
          {!techBoundDefaultsQ.isPending &&
          !techBoundDefaultsQ.isError &&
          techBoundDefaultsQ.isSuccess &&
          (techBoundDefaultsQ.data?.length ?? 0) === 0 ? (
            <div
              className="mobileNotice"
              style={{
                border: '1px solid #fcd34d',
                background: '#fffbeb',
                color: '#92400e',
              }}
            >
              Не выбран клиентский контур
            </div>
          ) : null}
        </div>
      ) : null}

      {showMobileHomeTicketBoard ? (
        <>
          <div className="mobileHomeBoardSticky">
            <div className="mobileFilterTabs mobileHomeStatusTabs" role="tablist" aria-label="Статус заявок">
              {MOBILE_HOME_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={boardTab === tab}
                  className={`mobileFilterTab${boardTab === tab ? ' mobileFilterTabActive' : ''}`}
                  onClick={() => setBoardTab(tab)}
                  title={
                    tab === 'mine'
                      ? meQ.data?.role === 'TECHNICIAN'
                        ? 'Техник: назначенные на вас'
                        : 'Клиент: созданные вами'
                      : undefined
                  }
                >
                  {tab === 'mine' && meQ.data?.role !== 'TECHNICIAN' ? 'Мои заявки' : MOBILE_HOME_TAB_LABELS[tab]}
                  <span className="mobileFilterTabCount">{tabCounts[tab]}</span>
                </button>
              ))}
            </div>
            <label className="mobileHomeSearchWrap">
              <span className="mobileVisuallyHidden">Поиск заявок по загруженному списку</span>
              <input
                className="mobileHomeSearchInput"
                type="search"
                enterKeyHint="search"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="Поиск: номер, адрес, точка, проблема"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
            <div className="mobileChipRow" role="group" aria-label="Быстрые фильтры">
              {MOBILE_HOME_BOARD_CHIP_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`mobileFilterChip${activeChips.has(id) ? ' mobileFilterChipActive' : ''}`}
                  aria-pressed={activeChips.has(id)}
                  onClick={() => toggleChip(id)}
                >
                  {MOBILE_HOME_BOARD_CHIP_LABELS[id]}
                </button>
              ))}
            </div>
            <div className="mobileHomeResultRow">
              <span className="mobileMeta">Найдено: {visibleTickets.length}</span>
              {filterSummary ? (
                <span className="mobileMeta mobileHomeResultFilters" title={filterSummary}>
                  {filterSummary}
                </span>
              ) : null}
            </div>
          </div>
          {meQ.data?.role === 'TECHNICIAN' && !homeIntroDismissed ? (
            <MobileHomeTabsIntroBanner
              role={meQ.data.role}
              onDismiss={() => {
                dismissMobileHomeIntro()
                setHomeIntroDismissed(true)
              }}
            />
          ) : null}
          {meQ.data?.role === 'TECHNICIAN' && tabCounts.mine === 0 ? <MobileTechnicianFirstStepsCard show /> : null}
          {meQ.data?.role !== 'TECHNICIAN' ? (
            <div className="mobilePageHint">
              Все — полный список. Мои заявки — созданные вами. В работе — назначенные и в активной работе.
            </div>
          ) : homeIntroDismissed ? (
            <div className="mobilePageHint">
              Вкладки: все заявки · назначенные на вас · в работе по контуру.
            </div>
          ) : null}

          <section className="mobileSection">
            {homeActionErr ? (
              <div className="mobileNotice mobileNoticeError" style={{ marginBottom: 8 }}>
                {homeActionErr}
              </div>
            ) : null}
            {boardQ.isLoading ? (
              <div className="mobileCard mobileMeta">Загрузка заявок…</div>
            ) : tabOnlyTickets.length === 0 && !hasHomeListFilters ? (
              (() => {
                const empty = mobileHomeTabEmptyCopy(boardTab, {
                  role: meQ.data?.role,
                  boardTotal: tabCounts.all,
                })
                return (
                  <div className="mobileCard mobileEmptyState" role="status">
                    <div className="mobileEmptyStateTitle">{empty.title}</div>
                    <p className="mobileEmptyStateHint">{empty.hint}</p>
                  </div>
                )
              })()
            ) : visibleTickets.length === 0 ? (
              <div className="mobileCard mobileEmptyState" role="status">
                <div className="mobileEmptyStateTitle">Ничего не найдено</div>
                <p className="mobileEmptyStateHint">
                  Активные условия: {filterSummary || '—'}
                </p>
                <button type="button" className="mobileBtn mobileBtnSecondary" onClick={resetHomeListFilters}>
                  Сбросить фильтры
                </button>
              </div>
            ) : (
              visibleTickets.map((ticket) => {
                const showAssignFooter =
                  canAssignProvider && ticket.status === 'NEW' && !ticket.assignedTechnician
                const actionProgressLabel = homeTicketActionProgressLabel(
                  ticket,
                  actionM,
                  closeBusy,
                  closeModal?.ticketId,
                  assignBusy,
                  assignTicket?.id,
                )
                const cardBusy =
                  !!actionProgressLabel ||
                  (assignBusy && assignTicket?.id === ticket.id && showAssignFooter)
                return (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    ticketHref={ticketHref(ticket)}
                    linkState={ticketLinkState(ticket)}
                    actionLabel={getPrimaryActionLabel(ticket, meQ.data?.id, meQ.data?.role)}
                    actionProgressLabel={actionProgressLabel}
                    onAction={(next) => actionM.mutate(next)}
                    inlineError={actionErrorByTicketId[ticket.id] || null}
                    inlineSuccess={actionSuccessByTicketId[ticket.id] || null}
                    disabledOverlay={cardBusy}
                    assignFooter={
                      showAssignFooter
                        ? {
                            onOpen: () => {
                              setAssignErr('')
                              setAssignTicket(ticket)
                            },
                            disabled: cardBusy,
                          }
                        : null
                    }
                  />
                )
              })
            )}
          </section>
        </>
      ) : null}

      {assignTicket ? (
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
                  {mobileTicketNumberTitle(assignTicket.ticketNumber)} · {mobileTicketCategoryLocationFromCard(assignTicket)}
                </div>
              </div>
              <button
                type="button"
                className="mobileBtn mobileBtnSecondary"
                disabled={assignBusy}
                onClick={() => {
                  setAssignTicket(null)
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
                {(assignCandidatesQ.error as any)?.message || String(assignCandidatesQ.error)}
              </div>
            ) : null}
            {assignErr ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>{assignErr}</div> : null}

            {assignCandidatesQ.data && assignTechOptions.length > 0 ? (
              <div className="mobileForm" style={{ marginTop: 12 }}>
                <label className="mobileFormFieldAfterPhoto">
                  Техник
                  <select
                    value={assignTechId}
                    disabled={assignBusy}
                    onChange={(e) => setAssignTechId(e.target.value)}
                  >
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
                    onClick={() =>
                      assignM.mutate({ ticketId: assignTicket.id, technicianId: assignTechId })
                    }
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

      {closeModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(17, 24, 39, 0.55)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 12,
          }}
        >
          <div className="mobileCard" style={{ width: '100%', maxWidth: 720, marginBottom: 12 }}>
            <div className="mobileRow" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 900 }}>Закрыть заявку</div>
                <div className="mobileMeta" style={{ marginTop: 4 }}>
                  {closeModal.title}
                </div>
              </div>
              <button
                type="button"
                className="mobileBtn mobileBtnSecondary"
                disabled={closeBusy}
                onClick={() => {
                  if (closeModal?.previewUrl) {
                    URL.revokeObjectURL(closeModal.previewUrl)
                  }
                  setCloseModal(null)
                  if (closeCameraInputRef.current) closeCameraInputRef.current.value = ''
                  if (closeGalleryInputRef.current) closeGalleryInputRef.current.value = ''
                }}
              >
                Отмена
              </button>
            </div>

            {closeModal.err ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>{closeModal.err}</div> : null}

            <div className="mobileForm" style={{ marginTop: 12 }}>
              <div className="mobilePhotoCardBlock">
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Фото отчёта *</div>
                <p className="mobileHint">Фото отчёта обязательно для закрытия заявки.</p>

                <input
                  ref={closeCameraInputRef}
                  className="mobileHiddenFileInput"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={closeBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setCloseModal((prev) => {
                      if (!prev) return prev
                      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl)
                      const previewUrl = file ? URL.createObjectURL(file) : ''
                      return { ...prev, file, previewUrl, err: '' }
                    })
                  }}
                />
                <input
                  ref={closeGalleryInputRef}
                  className="mobileHiddenFileInput"
                  type="file"
                  accept="image/*"
                  disabled={closeBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setCloseModal((prev) => {
                      if (!prev) return prev
                      if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl)
                      const previewUrl = file ? URL.createObjectURL(file) : ''
                      return { ...prev, file, previewUrl, err: '' }
                    })
                  }}
                />

                <div className="mobilePhotoSourceRow">
                  <button
                    type="button"
                    className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn"
                    disabled={closeBusy}
                    onClick={() => closeCameraInputRef.current?.click()}
                  >
                    Сделать фото отчёта
                  </button>
                  <button
                    type="button"
                    className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn"
                    disabled={closeBusy}
                    onClick={() => closeGalleryInputRef.current?.click()}
                  >
                    Выбрать фото из телефона
                  </button>
                </div>

                {closeModal.previewUrl ? (
                  <div className="mobilePhotoPreview">
                    <img
                      src={closeModal.previewUrl}
                      alt={closeModal.file?.name || 'preview'}
                      style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, border: '1px solid #e5e7eb' }}
                    />
                  </div>
                ) : null}
                {closeModal.file ? <div className="mobileMeta" style={{ marginTop: 10 }}>Файл: {closeModal.file.name}</div> : null}
              </div>

              <label className="mobileFormFieldAfterPhoto">
                Комментарий к закрытию *
                <textarea
                  rows={3}
                  value={closeModal.comment}
                  disabled={closeBusy}
                  placeholder="Коротко: что сделали / результат"
                  onChange={(e) => setCloseModal((prev) => (prev ? { ...prev, comment: e.target.value, err: '' } : prev))}
                />
              </label>

              <div className="mobileFormSubmitStack">
                <button type="button" className="mobileBtn mobileBtn--done" disabled={!closeCanSubmit} onClick={() => closeM.mutate()}>
                  {closeBusy ? 'Завершаем…' : 'Завершить'}
                </button>
                <p className="mobileHint" style={{ marginBottom: 0 }}>
                  Комментарий не короче трёх символов. Сначала сохранится фото отчёта на заявку, затем она закроется.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {mobileActionToast ? (
        <div className="mobileToastHost" role="status">
          <div className="mobileToast">{mobileActionToast}</div>
        </div>
      ) : null}
    </div>
  )
}
