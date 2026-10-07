import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../../lib/api'
import { canOfferTicketClaimAction } from '../../lib/ticketActionCapabilities'
import {
  compactTicketScope,
  mobileTicketCategoryLocationFromCard,
  mobileTicketNavState,
  mobileTicketNumberTitle,
  stripMobileHomeRestoreFromNavState,
  type MobileTicketNavState,
  scopeForMobileTicketLink,
} from '../mobileTicketDisplay'
import {
  dedupeBoardCards,
  filterTicketsForMobileHomeTab,
  isAwaitingAcceptanceTicket,
  isMobileHomeBoardFilterTab,
  mobileHomeBoardTabCounts,
  ticketRequiresMyAction,
  MOBILE_HOME_BOARD_CHIP_IDS,
  MOBILE_HOME_BOARD_CHIP_LABELS,
  type MobileHomeBoardChipId,
  type MobileHomeBoardFilterTab,
} from '../mobileHomeBoardFilters'
import {
  buildMobileHomeVisibleTickets,
  formatActiveMobileHomeFiltersSummary,
  readPersistedMobileHomeBoardUi,
  writePersistedMobileHomeBoardUi,
} from '../mobileHomeListUtils'
import { formatMobileMutationError } from '../mobileActionErrors'
import { readCachedBoard, saveBoardCache } from '../offline/boardCache'
import { queueOffline, useOfflineStatus } from '../offline/useOffline'
import { deliverTicketStatus } from '../offline/statusDelivery'
import { ONLINE_ONLY_ACTION_MESSAGE } from '../offline/onlineOnlyMessage'
import { getMobileMaterialsEntry } from '../mobileMaterialsEntry'
import { mobilePath } from '../mobileRoute'
import { HomeHeader } from './HomeHeader'
import { HomeTabs } from './HomeTabs'
import { HomeChips } from './HomeChips'
import { HomeList, type TicketCloseModalState } from './HomeList'
import { HomeQuickCards, type MobileHomeQuickFilter } from './HomeQuickCards'
import { HomeUrgentCard } from './HomeUrgentCard'
import { HomeShiftStatus } from './HomeShiftStatus'
import { isHomeUrgentTicket, selectHomeUrgentTickets } from './homeUrgent'
import { HomeOfflineCachePanel } from './HomeOfflineCachePanel'
import { useTicketOfflineCache } from './useTicketOfflineCache'

export function MobileHome() {
  const location = useLocation()
  const navigate = useNavigate()
  const search = new URLSearchParams(location.search)
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const companyQ = useQuery({
    queryKey: ['mobile-home-company'],
    queryFn: () => api.company(),
    enabled: !!meQ.data && meQ.data.role !== 'CLIENT' && meQ.data.role !== 'TECHNICIAN',
  })
  const offline = useOfflineStatus()
  const isOnline = offline.online
  const liveApiAllowed = offline.liveApiAllowed
  const cacheUiOpen = offline.connectivity !== 'offline'
  const [startQueuedIds, setStartQueuedIds] = useState<Set<string>>(() => new Set())
  const linkedClientCompanyId = (search.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
  const companyId = (search.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
  const pageScope = useMemo(
    () => ({
      linkedClientCompanyId: linkedClientCompanyId || undefined,
      companyId: companyId || undefined,
    }),
    [companyId, linkedClientCompanyId],
  )
  const queryClient = useQueryClient()
  const [mobileActionToast, setMobileActionToast] = useState('')
  const persistedBoardUi = useMemo(() => readPersistedMobileHomeBoardUi(), [])
  const [boardTab, setBoardTab] = useState<MobileHomeBoardFilterTab>(persistedBoardUi.tab)
  const [activeChips, setActiveChips] = useState<Set<MobileHomeBoardChipId>>(() => new Set(persistedBoardUi.chips))
  const [searchQuery, setSearchQuery] = useState('')
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  // E3: быстрая карта персистится (как tab+chips) — вернулся из заявки → карта осталась активной; сброс её гасит.
  const [quickFilter, setQuickFilter] = useState<MobileHomeQuickFilter>(persistedBoardUi.quickFilter)

  const providerContextKnown =
    !meQ.data || meQ.data.role === 'CLIENT' || meQ.data.role === 'TECHNICIAN' || companyQ.isSuccess || companyQ.isError
  const providerNeedsLinkedClient = !!meQ.data && companyQ.data?.type === 'PROVIDER' && meQ.data.role !== 'TECHNICIAN' && !linkedClientCompanyId

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
    networkMode: 'always',
  })
  const boardEnabled =
    providerContextKnown &&
    ((!isOnline || !!meQ.data) &&
      (!meQ.data ||
        meQ.data.role !== 'TECHNICIAN' ||
        !!linkedClientCompanyId ||
        (techBoundDefaultsQ.isSuccess && (techBoundDefaultsQ.data || []).length === 0))) &&
    !providerNeedsLinkedClient

  useEffect(() => {
    if (meQ.data?.role !== 'TECHNICIAN' || linkedClientCompanyId || !techBoundDefaultsQ.isSuccess) return
    const picked = api.pickFirstTechnicianBoundLinkedClientCompanyId(techBoundDefaultsQ.data || [])
    if (!picked) return
    api.persistScopeFromSearchParams(new URLSearchParams({ linkedClientCompanyId: picked }), meQ.data)
    const nextPath = api.appendScopeToPath(location.pathname || mobilePath(location.pathname, ''), { linkedClientCompanyId: picked, companyId: companyId || undefined }, meQ.data)
    if (nextPath !== `${location.pathname}${location.search}`) navigate(nextPath, { replace: true })
  }, [meQ.data, linkedClientCompanyId, techBoundDefaultsQ.isSuccess, techBoundDefaultsQ.data, navigate, companyId, location.pathname, location.search])

  const boardQ = useQuery({
    queryKey: ['mobile-home-board', linkedClientCompanyId, companyId, offline.ready, offline.connectivity],
    queryFn: async () => {
      const cachedBoard = async () => readCachedBoard<api.BoardResponse>(pageScope)
      if (offline.connectivity === 'offline') {
        const cached = await cachedBoard()
        if (cached) return cached
        throw new Error('Нет сохранённых заявок. Откройте главную при подключении к сети хотя бы раз.')
      }
      try {
        const data = await api.board({ linkedClientCompanyId: pageScope.linkedClientCompanyId, companyId: pageScope.companyId, take: 500 })
        await saveBoardCache<api.BoardResponse>(pageScope, data)
        return data
      } catch (error) {
        const cached = await cachedBoard()
        if (cached) return cached
        throw error
      }
    },
    networkMode: 'always',
    placeholderData: keepPreviousData,
    // Техник без контура (субподрядчик SECONDARY: bound-contexts=[], [0] нет) тоже грузит board —
    // бэкенд скоупит по assignedTechnicianId + PRIMARY∪SECONDARY. Empty-scope разрешаем только когда
    // bound-contexts отстрелялся пустым, чтобы у PRIMARY-техника не было лишнего фетча до выбора [0].
    enabled: boardEnabled,
  })

  const completedBoardQ = useQuery({
    queryKey: ['mobile-home-completed-board', linkedClientCompanyId, companyId],
    queryFn: () =>
      api.board({
        linkedClientCompanyId: pageScope.linkedClientCompanyId,
        companyId: pageScope.companyId,
        take: 500,
        status: 'DONE',
        includeArchived: true,
      }),
    enabled: boardEnabled && isOnline && boardTab === 'done',
  })

  const linkedClientsQ = useQuery({
    queryKey: ['mobile-home-linked-clients'],
    queryFn: api.getLinkedClients,
    enabled: !!linkedClientCompanyId && !!meQ.data && meQ.data.role !== 'TECHNICIAN',
  })

  const baseCards = useMemo(
    () => boardQ.data?.columns.flatMap((col) => col.cards || []) || [],
    [boardQ.data],
  )
  const completedCards = useMemo(
    () => completedBoardQ.data?.columns.flatMap((col) => col.cards || []) || [],
    [completedBoardQ.data],
  )
  const cards = boardTab === 'done' && completedBoardQ.data ? completedCards : baseCards
  // SMA-MOBILE-SERVICE-OS Phase 0+1: срочные берём из основной доски (не из done-среза),
  // чтобы блок не зависел от выбранной вкладки.
  const urgentTickets = useMemo(() => selectHomeUrgentTickets(baseCards), [baseCards])
  const canAssignProvider = api.isProviderTicketAssignRole(meQ.data?.role)
  // E4: быстрая приёмка на карте — тот же гейт, что «Принять» в карточке (MobileTicketPage canShowClientAcceptance):
  // своя client-компания (не наблюдатель) + клиент-управленческая роль (ADMIN/TM/ND, не CLIENT-заявитель).
  const canAcceptOnCard = !companyId && companyQ.data?.type === 'CLIENT' && api.isClientAcceptanceRole(meQ.data?.role)

  // E2: «Требуют доработки» — заявки, возвращённые на доработку. Детект дёшев (E2.1): 1 запрос нотификаций
  // ∩ board-заявки IN_PROGRESS. Только для того, кому вернули работу (TECHNICIAN/MASTER). Промежуточно до
  // backend-поля lastRejectedAt (см. память E2-backend). Провал/пустой запрос → count 0 → карта скрыта.
  const isReworkRole = meQ.data?.role === 'TECHNICIAN' || meQ.data?.role === 'MASTER'
  const reworkNotificationsQ = useQuery({
    queryKey: ['mobile-notifications'],
    queryFn: api.fetchNotifications,
    enabled: !!meQ.data && isReworkRole && isOnline,
    staleTime: 30_000,
  })
  const reworkTicketIds = useMemo(() => {
    const ids = new Set<string>()
    for (const n of reworkNotificationsQ.data?.items || []) {
      if (n.type === 'ticket.rejected' && n.entityId) ids.add(n.entityId)
    }
    return ids
  }, [reworkNotificationsQ.data])

  useLayoutEffect(() => {
    const s = location.state as MobileTicketNavState | null | undefined
    if (!s || typeof s !== 'object') return
    const hasTab = isMobileHomeBoardFilterTab(s.homeBoardTab)
    const hasChips = Array.isArray(s.homeBoardChips)
    const hasSearch = typeof s.homeBoardSearch === 'string'
    if (!hasTab && !hasChips && !hasSearch) return
    if (hasTab && s.homeBoardTab) setBoardTab(s.homeBoardTab)
    if (hasChips) {
      setActiveChips(new Set(s.homeBoardChips!.filter((c): c is MobileHomeBoardChipId => MOBILE_HOME_BOARD_CHIP_IDS.includes(c as MobileHomeBoardChipId))))
    }
    if (hasSearch) setSearchQuery((s.homeBoardSearch || '').slice(0, 240))
    navigate(`${location.pathname}${location.search}`, { replace: true, state: stripMobileHomeRestoreFromNavState(s) ?? undefined })
  }, [location.key, location.pathname, location.search, navigate])

  useEffect(() => {
    writePersistedMobileHomeBoardUi(boardTab, activeChips, quickFilter)
  }, [boardTab, activeChips, quickFilter])

  const tabCounts = useMemo(() => {
    const counts = mobileHomeBoardTabCounts(baseCards, meQ.data?.id, meQ.data?.role)
    if (completedBoardQ.data) {
      counts.done = filterTicketsForMobileHomeTab(completedCards, 'done', meQ.data?.id, meQ.data?.role).length
    }
    return counts
  }, [baseCards, completedBoardQ.data, completedCards, meQ.data?.id, meQ.data?.role])
  const atRiskThresholdMinutes =
    boardTab === 'done' && completedBoardQ.data
      ? completedBoardQ.data.meta.atRiskThresholdMinutes
      : boardQ.data?.meta.atRiskThresholdMinutes ?? 60
  const activeBoardIsLoading = boardTab === 'done' ? completedBoardQ.isLoading : boardQ.isLoading
  const activeBoardError = boardTab === 'done' ? completedBoardQ.error : boardQ.error
  const activeBoardHasData = boardTab === 'done' ? !!completedBoardQ.data : !!boardQ.data

  const visibleTickets = useMemo(
    () => buildMobileHomeVisibleTickets({ cards, tab: boardTab, meId: meQ.data?.id, meRole: meQ.data?.role, chips: activeChips, searchQuery, atRiskThresholdMinutes }),
    [cards, boardTab, meQ.data?.id, meQ.data?.role, activeChips, searchQuery, atRiskThresholdMinutes],
  )

  const tabOnlyTickets = useMemo(() => filterTicketsForMobileHomeTab(cards, boardTab, meQ.data?.id, meQ.data?.role), [cards, boardTab, meQ.data?.id, meQ.data?.role])
  const hasHomeListFilters = !!searchQuery.trim() || activeChips.size > 0
  const filterSummary = useMemo(
    () => formatActiveMobileHomeFiltersSummary({ searchQuery, chips: activeChips, chipLabels: MOBILE_HOME_BOARD_CHIP_LABELS }),
    [searchQuery, activeChips],
  )

  // Быстрые карты Figma HomeScreen: счётчики + эксклюзивный фильтр списка.
  const awaitingCount = useMemo(() => dedupeBoardCards(cards).filter(isAwaitingAcceptanceTicket).length, [cards])
  const myActionCount = useMemo(
    () => dedupeBoardCards(cards).filter((t) => ticketRequiresMyAction(t, meQ.data?.id, meQ.data?.role, canAssignProvider)).length,
    [cards, meQ.data?.id, meQ.data?.role, canAssignProvider],
  )
  const reworkCount = useMemo(
    () => (isReworkRole ? dedupeBoardCards(cards).filter((t) => t.status === 'IN_PROGRESS' && reworkTicketIds.has(t.id)).length : 0),
    [isReworkRole, cards, reworkTicketIds],
  )
  const quickTickets = useMemo(() => {
    if (!quickFilter) return null
    const list = dedupeBoardCards(cards)
    if (quickFilter === 'urgent') return list.filter(isHomeUrgentTicket)
    if (quickFilter === 'awaiting') return list.filter(isAwaitingAcceptanceTicket)
    if (quickFilter === 'rework') return list.filter((t) => t.status === 'IN_PROGRESS' && reworkTicketIds.has(t.id))
    return list.filter((t) => ticketRequiresMyAction(t, meQ.data?.id, meQ.data?.role, canAssignProvider))
  }, [quickFilter, cards, meQ.data?.id, meQ.data?.role, canAssignProvider, reworkTicketIds])
  const quickFilterLabel =
    quickFilter === 'urgent' ? 'Срочные заявки' : quickFilter === 'awaiting' ? 'На приёмке' : quickFilter === 'myaction' ? 'Требует моего действия' : quickFilter === 'rework' ? 'Требуют доработки' : ''
  const renderedTickets = quickFilter ? quickTickets ?? [] : visibleTickets
  const homeListTickets = useMemo(
    () =>
      buildMobileHomeVisibleTickets({
        cards: baseCards,
        tab: 'all',
        meId: meQ.data?.id,
        meRole: meQ.data?.role,
        chips: new Set(),
        searchQuery: '',
        atRiskThresholdMinutes,
      }),
    [atRiskThresholdMinutes, baseCards, meQ.data?.id, meQ.data?.role],
  )
  const ticketOfflineCache = useTicketOfflineCache({
    allTickets: baseCards,
    homeListTickets,
    visibleTickets: renderedTickets,
    meId: meQ.data?.id,
    scope: pageScope,
    enabled: meQ.data?.role === 'TECHNICIAN',
    online: cacheUiOpen,
    storageReady: offline.ready,
  })

  // При активной быстрой карте список показывает её выборку и обычные фильтры/вкладки очищаются.
  function activateQuickFilter(next: Exclude<MobileHomeQuickFilter, null>) {
    setQuickFilter((prev) => {
      const value = prev === next ? null : next
      if (value) {
        setBoardTab('all')
        setActiveChips(new Set())
        setSearchQuery('')
        setFiltersExpanded(false)
      }
      return value
    })
  }
  const selectBoardTab = (tab: MobileHomeBoardFilterTab) => {
    setQuickFilter(null)
    setBoardTab(tab)
  }
  const changeSearchQuery = (value: string) => {
    if (value) setQuickFilter(null)
    setSearchQuery(value)
  }

  const EXTRA_TABS: MobileHomeBoardFilterTab[] = ['in_work', 'overdue', 'done']

  function toggleFiltersExpanded() {
    setQuickFilter(null)
    setFiltersExpanded((prev) => {
      if (prev) {
        // collapse: reset extra tabs to 'all'
        if (EXTRA_TABS.includes(boardTab)) setBoardTab('all')
        setSearchQuery('')
        setActiveChips(new Set())
      }
      return !prev
    })
  }

  function toggleChip(id: MobileHomeBoardChipId) {
    setQuickFilter(null)
    setActiveChips((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function resetHomeListFilters() {
    setQuickFilter(null)
    setBoardTab('all')
    setSearchQuery('')
    setActiveChips(new Set())
  }

  const [assignTicket, setAssignTicket] = useState<api.TicketCard | null>(null)
  const [assignTechId, setAssignTechId] = useState('')
  const [assignErr, setAssignErr] = useState('')
  const [homeActionErr, setHomeActionErr] = useState('')

  useEffect(() => {
    setHomeActionErr('')
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
    if (!assignTechOptions.length) return setAssignTechId('')
    setAssignTechId((prev) => (prev && assignTechOptions.some((r) => r.id === prev) ? prev : assignTechOptions[0]!.id))
  }, [assignTechOptions])

  const materialsEntry = getMobileMaterialsEntry(meQ.data, location.pathname)
  const materialsHomeHref = materialsEntry && meQ.data
    ? api.appendScopeToPath(materialsEntry.href, pageScope, meQ.data)
    : materialsEntry?.href
  const materialsHomeHint = meQ.data?.role === 'TECHNICIAN'
    ? 'Остатки, покупки и история движений'
    : 'Склад, техники, выдача и справочник'
  const materialsHomeCard = materialsEntry && materialsHomeHref ? (
    <div className="mobileHomeQuickCards">
      <button
        type="button"
        className="mobileHomeQuickCard mobileHomeQuickCard--blue"
        onClick={() => navigate(materialsHomeHref)}
        aria-label={materialsEntry.label}
      >
        <span className="mobileHomeQuickCardIcon" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 8l-9 5l-9 -5" />
            <path d="M3 8l9 -5l9 5v8l-9 5l-9 -5z" />
            <path d="M12 13v8" />
          </svg>
        </span>
        <span className="mobileHomeQuickCardBody">
          <span className="mobileHomeQuickCardTitle">{materialsEntry.label}</span>
          <span className="mobileHomeQuickCardSub">{materialsHomeHint}</span>
        </span>
        <span className="mobileHomeQuickCardChevron" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </button>
    </div>
  ) : null

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
  const [closeModal, setCloseModal] = useState<TicketCloseModalState>(null)

  useEffect(() => {
    return () => {
      if (closeModal?.previewUrl) URL.revokeObjectURL(closeModal.previewUrl)
    }
  }, [closeModal?.previewUrl])

  const actionM = useMutation({
    mutationFn: async (ticket: api.TicketCard) => {
      const role = meQ.data?.role
      if (ticket.status === 'NEW') {
        if (role === 'TECHNICIAN' && ticket.canRequestAssignment === true) {
          if (ticket.assignmentRequestedByCurrentUser) return
          await api.requestTicketAssignment(ticket.id, pageScope)
          return
        }
        if (!canOfferTicketClaimAction(ticket)) {
          throw new Error('Действие недоступно для этой заявки')
        }
        await api.claim(ticket.id, pageScope)
        return
      }
      if (ticket.status === 'ASSIGNED') {
        if (role !== 'TECHNICIAN' || ticket.assignedTechnician?.id !== meQ.data?.id) {
          throw new Error('Начать работу может только назначенный техник')
        }
        await api.updateTicketStatus(ticket.id, { status: 'IN_PROGRESS' }, pageScope)
        return
      }
      if (ticket.status === 'IN_PROGRESS') {
        if (role !== 'TECHNICIAN' || ticket.assignedTechnician?.id !== meQ.data?.id) {
          throw new Error('Закрытие недоступно для этой заявки')
        }
        setCloseModal({
          ticketId: ticket.id,
          title: `${mobileTicketNumberTitle(ticket.ticketNumber)} — ${mobileTicketCategoryLocationFromCard(ticket)}`,
          file: null,
          previewUrl: '',
          comment: '',
          failureCauseId: '',
          err: '',
        })
      }
    },
    onMutate: () => setHomeActionErr(''),
    onSuccess: async (_data, ticket) => {
      if (ticket.status === 'IN_PROGRESS') return
      if (ticket.status === 'NEW' && meQ.data?.role === 'TECHNICIAN' && ticket.canRequestAssignment === true) {
        setMobileActionToast('Запрос отправлен')
      }
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-completed-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
    },
    onError: (e: unknown, ticket) => {
      const op =
        ticket.status === 'NEW' &&
        meQ.data?.role === 'TECHNICIAN' &&
        ticket.canRequestAssignment === true
          ? 'request_assignment'
          : ticket.status === 'NEW'
            ? 'claim'
            : ticket.status === 'ASSIGNED'
              ? 'start'
              : 'other'
      setHomeActionErr(formatMobileMutationError(e, { operation: op }))
    },
  })

  async function handlePrimaryAction(ticket: api.TicketCard) {
    // Claim и request assignment — только при liveApiAllowed.
    if (!liveApiAllowed && ticket.status === 'NEW') {
      setHomeActionErr(ONLINE_ONLY_ACTION_MESSAGE)
      return
    }
    if (ticket.status === 'ASSIGNED') {
      const role = meQ.data?.role
      if (role !== 'TECHNICIAN' || ticket.assignedTechnician?.id !== meQ.data?.id) {
        setHomeActionErr('Начать работу может только назначенный техник')
        return
      }
      const delivery = await deliverTicketStatus({
        reportedOnline: liveApiAllowed,
        queueInput: {
          kind: 'ticket.status',
          target: { ticketId: ticket.id },
          payload: { status: 'IN_PROGRESS', scope: pageScope },
        },
        send: async () => api.updateTicketStatus(ticket.id, { status: 'IN_PROGRESS' }, pageScope),
        enqueue: queueOffline,
      })
      if (delivery.kind === 'queue-failed') {
        setHomeActionErr(delivery.message)
        return
      }
      if (delivery.kind === 'queued') {
        setHomeActionErr('')
        setStartQueuedIds((prev) => new Set(prev).add(ticket.id))
        setMobileActionToast('Сохранено на устройстве. Будет отправлено после восстановления сети.')
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      return
    }
    actionM.mutate(ticket)
  }

  const closeM = useMutation({
    mutationFn: async () => {
      if (!liveApiAllowed) {
        setCloseModal((prev) => (prev ? { ...prev, err: ONLINE_ONLY_ACTION_MESSAGE } : prev))
        throw new Error(ONLINE_ONLY_ACTION_MESSAGE)
      }
      if (!closeModal) throw new Error('Нет данных для закрытия')
      if (!closeModal.file) throw new Error('Нужно фото или видео отчёта')
      const comment = closeModal.comment.trim()
      if (comment.length < 3) throw new Error('Нужен короткий комментарий (backend требует комментарий для DONE)')
      const failureCauseId = closeModal.failureCauseId.trim()
      if (!failureCauseId) throw new Error('Выберите причину неисправности')
      const uploaded = await api.uploadTicketAttachment(closeModal.ticketId, closeModal.file, pageScope)
      await api.submitTicketAcceptance(
        closeModal.ticketId,
        {
          failureCauseId,
          comment,
          attachmentIds: uploaded?.id ? [uploaded.id] : undefined,
        },
        pageScope,
      )
    },
    onSuccess: async () => {
      if (closeModal?.previewUrl) URL.revokeObjectURL(closeModal.previewUrl)
      setCloseModal(null)
      if (closeCameraInputRef.current) closeCameraInputRef.current.value = ''
      if (closeGalleryInputRef.current) closeGalleryInputRef.current.value = ''
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-completed-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
    },
    onError: (e: unknown) => {
      const raw = e instanceof Error ? e.message : ''
      if (raw === ONLINE_ONLY_ACTION_MESSAGE) return
      setCloseModal((prev) => (prev ? { ...prev, err: formatMobileMutationError(e, { operation: 'close' }) } : prev))
    },
  })

  const assignM = useMutation({
    mutationFn: async (params: { ticketId: string; technicianId: string }) => api.assignTicket(params.ticketId, params.technicianId, pageScope),
    onMutate: () => setAssignErr(''),
    onSuccess: async () => {
      setAssignTicket(null)
      setAssignTechId('')
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-completed-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-ticket-detail'] })
    },
    onError: (e: unknown) => setAssignErr(formatMobileMutationError(e, { operation: 'assign' })),
  })

  // E4: быстрая приёмка на карте (accept одним тапом, POST /tickets/:id/acceptance decision=ACCEPT → DONE).
  // reject НЕ здесь — требует комментарий, ведёт в карточку (как раньше). После accept список инвалидируется.
  const acceptM = useMutation({
    mutationFn: async (ticket: api.TicketCard) => {
      await api.decideTicketAcceptance(ticket.id, { decision: 'ACCEPT' }, pageScope)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-completed-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-ticket-detail'] })
    },
    onError: (e: unknown) => setHomeActionErr(formatMobileMutationError(e, { operation: 'other' })),
  })

  const closeBusy = closeM.isPending
  const assignBusy = assignM.isPending
  const ticketHref = (ticket: api.TicketCard) => {
    if (!meQ.data) return mobilePath(location.pathname, `/tickets/${ticket.id}`)
    const linkScope = scopeForMobileTicketLink(meQ.data, pageScope, ticket)
    return api.appendScopeToPath(mobilePath(location.pathname, `/tickets/${ticket.id}`), compactTicketScope(linkScope), meQ.data)
  }
  const ticketLinkState = (ticket: api.TicketCard) => mobileTicketNavState('home', ticket.companyId, { tab: boardTab, chips: [...activeChips], search: searchQuery.trim() || undefined })
  const closeCanSubmit =
    !!closeModal?.file &&
    closeModal.comment.trim().length >= 3 &&
    !!closeModal.failureCauseId.trim() &&
    !closeBusy

  const closeFailureCausesQ = useQuery({
    queryKey: ['ticket-failure-causes', closeModal?.ticketId, pageScope],
    queryFn: () => api.ticketFailureCauses(closeModal!.ticketId, pageScope),
    enabled: !!closeModal?.ticketId && liveApiAllowed,
  })

  const techWillRedirectForScope = techNoLinked && techBoundDefaultsQ.isSuccess && (techBoundDefaultsQ.data?.length ?? 0) > 0
  const technicianScopeGateReady = !techNoLinked || techBoundDefaultsQ.isFetched || techBoundDefaultsQ.isError
  const showMobileHomeTicketBoard = technicianScopeGateReady && !techWillRedirectForScope && (!activeBoardError || activeBoardHasData) && (meQ.data || (!!boardQ.data && !isOnline))

  if (providerNeedsLinkedClient) {
    return (
      <div className="mobileSection">
        <div>
          <h1 className="mobileTitle">Главная</h1>
          <div className="mobileSubtitle">Операционный экран без desktop-шумов</div>
        </div>
        <HomeShiftStatus role={meQ.data?.role} />
        <div className="mobileNotice" role="status">
          Выберите клиентский контур в верхней панели, чтобы открыть заявки.
        </div>
        {materialsHomeCard}
      </div>
    )
  }

  return (
    <div className="mobileSection">
      <HomeHeader
        me={meQ.data}
        isOnline={isOnline}
        connectivity={offline.connectivity}
        boardHasData={activeBoardHasData}
        boardError={activeBoardError}
        companyPrimaryLine={companyPrimaryLine}
        linkedClientCompanyId={linkedClientCompanyId}
        linkedClientDisplayName={linkedClientDisplayName}
        techNoLinked={meQ.data?.role === 'TECHNICIAN' && !linkedClientCompanyId}
        techBoundPending={techBoundDefaultsQ.isPending}
        techWillRedirectForScope={techWillRedirectForScope}
        techBoundError={techBoundDefaultsQ.isError ? techBoundDefaultsQ.error : null}
        techBoundEmpty={!techBoundDefaultsQ.isPending && !techBoundDefaultsQ.isError && techBoundDefaultsQ.isSuccess && (techBoundDefaultsQ.data?.length ?? 0) === 0}
        tabCounts={tabCounts}
        onStatClick={selectBoardTab}
        activeBoardTab={quickFilter ? undefined : boardTab}
        searchQuery={searchQuery}
        setSearchQuery={changeSearchQuery}
      />
      <HomeShiftStatus role={meQ.data?.role} />
      <HomeUrgentCard tickets={urgentTickets} ticketHref={ticketHref} ticketLinkState={ticketLinkState} onViewAll={() => activateQuickFilter('urgent')} />
      {materialsHomeCard}
      {showMobileHomeTicketBoard ? (
        <>
          <HomeQuickCards
            awaitingCount={awaitingCount}
            myActionCount={myActionCount}
            reworkCount={reworkCount}
            activeQuickFilter={quickFilter}
            onToggleAwaiting={() => activateQuickFilter('awaiting')}
            onToggleMyAction={() => activateQuickFilter('myaction')}
            onToggleRework={() => activateQuickFilter('rework')}
          />
          <div className="mobileHomeBoardSticky" data-mobile-tour="ticket-filters">
            <HomeTabs
              boardTab={boardTab}
              setBoardTab={selectBoardTab}
              tabCounts={tabCounts}
              collapsed={!filtersExpanded}
              activeSuppressed={!!quickFilter}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 0' }}>
              <button
                type="button"
                className={`mobileFiltersToggleBtn${filtersExpanded ? ' mobileFiltersToggleBtn--active' : ''}`}
                onClick={toggleFiltersExpanded}
              >
                {filtersExpanded ? (
                  <span className="mobileFiltersToggleDot" />
                ) : null}
                {filtersExpanded ? 'Скрыть фильтры' : 'Фильтры'}
              </button>
            </div>
            {filtersExpanded ? (
              <HomeChips
                activeChips={activeChips}
                toggleChip={toggleChip}
                visibleCount={visibleTickets.length}
                filterSummary={filterSummary}
                onResetAll={resetHomeListFilters}
                hasActiveFilters={boardTab !== 'all' || !!searchQuery.trim() || activeChips.size > 0}
              />
            ) : null}
          </div>
          <HomeOfflineCachePanel
            enabled={meQ.data?.role === 'TECHNICIAN'}
            online={cacheUiOpen}
            storageReady={offline.ready}
            selectedCount={ticketOfflineCache.selectedIds.size}
            busy={ticketOfflineCache.busy}
            progress={ticketOfflineCache.progress}
            error={ticketOfflineCache.error}
            onCacheSelected={() => void ticketOfflineCache.cacheSelected()}
          />
          <HomeList
            boardIsLoading={activeBoardIsLoading}
            visibleTickets={renderedTickets}
            tabOnlyTickets={tabOnlyTickets}
            boardTab={boardTab}
            role={meQ.data?.role}
            meId={meQ.data?.id}
            boardTotal={tabCounts.all}
            hasHomeListFilters={quickFilter ? true : hasHomeListFilters}
            filterSummary={quickFilter ? quickFilterLabel : filterSummary}
            homeActionErr={homeActionErr}
            resetHomeListFilters={resetHomeListFilters}
            canAssignProvider={canAssignProvider}
            actionM={actionM}
            closeBusy={closeBusy}
            closeModal={closeModal}
            assignBusy={assignBusy}
            assignTicket={assignTicket}
            ticketHref={ticketHref}
            ticketLinkState={ticketLinkState}
            onAction={handlePrimaryAction}
            startQueuedIds={startQueuedIds}
            setAssignErr={setAssignErr}
            setAssignTicket={setAssignTicket}
            assignCandidatesQ={assignCandidatesQ}
            assignTechOptions={assignTechOptions}
            assignTechId={assignTechId}
            setAssignTechId={setAssignTechId}
            assignErr={assignErr}
            assignM={assignM}
            canAcceptOnCard={canAcceptOnCard}
            acceptM={acceptM}
            onAccept={(ticket) => {
              if (!liveApiAllowed) {
                setHomeActionErr(ONLINE_ONLY_ACTION_MESSAGE)
                return
              }
              setHomeActionErr('')
              acceptM.mutate(ticket)
            }}
            closeCameraInputRef={closeCameraInputRef}
            closeGalleryInputRef={closeGalleryInputRef}
            setCloseModal={setCloseModal}
            closeCanSubmit={closeCanSubmit}
            closeM={closeM}
            closeFailureCauses={closeFailureCausesQ.data || []}
            closeFailureCausesLoading={closeFailureCausesQ.isFetching}
            closeFailureCausesError={closeFailureCausesQ.isError ? formatMobileMutationError(closeFailureCausesQ.error, { operation: 'other' }) : ''}
            mobileActionToast={mobileActionToast}
            cacheStates={ticketOfflineCache.states}
            cacheSelectedIds={ticketOfflineCache.selectedIds}
            onToggleCache={cacheUiOpen ? ticketOfflineCache.toggleSelected : undefined}
            onRefreshCache={cacheUiOpen ? ticketOfflineCache.refreshTicket : undefined}
          />
          {boardQ.data && boardQ.data.meta.totalTickets >= boardQ.data.meta.limitedToLast && boardQ.data.meta.limitedToLast >= 500 ? (
            <div className="mobileNotice" style={{ textAlign: 'center', fontSize: '0.82rem', marginTop: 4 }}>
              Показано 500 заявок. Используйте фильтры для поиска нужной.
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
