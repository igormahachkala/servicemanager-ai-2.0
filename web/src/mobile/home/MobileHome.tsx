import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../../lib/api'
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
  filterTicketsForMobileHomeTab,
  isMobileHomeBoardFilterTab,
  mobileHomeBoardTabCounts,
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
import { getOnlineStatus, loadBoardCache, saveBoardCache, useOnlineStatus } from '../offlineQueue'
import { readMobileHomeIntroDismissed } from '../MobileUxHints'
import { mobilePath } from '../mobileRoute'
import { HomeHeader } from './HomeHeader'
import { HomeTabs } from './HomeTabs'
import { HomeChips } from './HomeChips'
import { HomeList, type TicketCloseModalState } from './HomeList'
import { HomeFAB } from './HomeFAB'

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
  const isOnline = useOnlineStatus()
  const linkedClientCompanyId = (search.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
  const companyId = (search.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
  const pageScope = { linkedClientCompanyId: linkedClientCompanyId || undefined, companyId: companyId || undefined }
  const queryClient = useQueryClient()
  const [mobileActionToast, setMobileActionToast] = useState('')

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
  })

  useEffect(() => {
    if (meQ.data?.role !== 'TECHNICIAN' || linkedClientCompanyId || !techBoundDefaultsQ.isSuccess) return
    const picked = api.pickFirstTechnicianBoundLinkedClientCompanyId(techBoundDefaultsQ.data || [])
    if (!picked) return
    api.persistScopeFromSearchParams(new URLSearchParams({ linkedClientCompanyId: picked }), meQ.data)
    const nextPath = api.appendScopeToPath(location.pathname || mobilePath(location.pathname, ''), { linkedClientCompanyId: picked, companyId: companyId || undefined }, meQ.data)
    if (nextPath !== `${location.pathname}${location.search}`) navigate(nextPath, { replace: true })
  }, [meQ.data, linkedClientCompanyId, techBoundDefaultsQ.isSuccess, techBoundDefaultsQ.data, navigate, companyId, location.pathname, location.search])

  const boardQ = useQuery({
    queryKey: ['mobile-home-board', linkedClientCompanyId, companyId],
    queryFn: async () => {
      if (!getOnlineStatus()) {
        const cached = loadBoardCache(pageScope)
        if (cached?.data) return cached.data
        throw new Error('Нет сохранённых заявок. Откройте главную при подключении к сети хотя бы раз.')
      }
      const data = await api.board({ linkedClientCompanyId: pageScope.linkedClientCompanyId, companyId: pageScope.companyId, take: 100 })
      saveBoardCache(pageScope, data)
      return data
    },
    enabled:
      providerContextKnown &&
      ((!isOnline || !!meQ.data) && (!meQ.data || meQ.data.role !== 'TECHNICIAN' || !!linkedClientCompanyId)) &&
      !providerNeedsLinkedClient,
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
  const [activeChips, setActiveChips] = useState<Set<MobileHomeBoardChipId>>(() => new Set(persistedBoardUi.chips))
  const [searchQuery, setSearchQuery] = useState('')
  const [homeIntroDismissed, setHomeIntroDismissed] = useState(() => readMobileHomeIntroDismissed())
  const [filtersExpanded, setFiltersExpanded] = useState(false)

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
    writePersistedMobileHomeBoardUi(boardTab, activeChips)
  }, [boardTab, activeChips])

  const tabCounts = useMemo(() => mobileHomeBoardTabCounts(cards, meQ.data?.id, meQ.data?.role), [cards, meQ.data?.id, meQ.data?.role])
  const atRiskThresholdMinutes = boardQ.data?.meta.atRiskThresholdMinutes ?? 60

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

  const EXTRA_TABS: MobileHomeBoardFilterTab[] = ['in_work', 'overdue', 'done']

  function toggleFiltersExpanded() {
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
    setActiveChips((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function resetHomeListFilters() {
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
        if (role !== 'TECHNICIAN') {
          throw new Error('Полевое действие «Взять» доступно только технику')
        }
        if (ticket.canClaimByCurrentUser === false) {
          if (ticket.assignmentRequestedByCurrentUser) return
          await api.requestTicketAssignment(ticket.id, pageScope)
          return
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
          err: '',
        })
      }
    },
    onMutate: () => setHomeActionErr(''),
    onSuccess: async (_data, ticket) => {
      if (ticket.status === 'IN_PROGRESS') return
      if (ticket.status === 'NEW' && meQ.data?.role === 'TECHNICIAN' && ticket.canClaimByCurrentUser === false) {
        setMobileActionToast('Запрос отправлен')
      }
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
    },
    onError: (e: unknown, ticket) => {
      const op =
        ticket.status === 'NEW' &&
        meQ.data?.role === 'TECHNICIAN' &&
        ticket.canClaimByCurrentUser === false
          ? 'request_assignment'
          : ticket.status === 'NEW'
            ? 'claim'
            : ticket.status === 'ASSIGNED'
              ? 'start'
              : 'other'
      setHomeActionErr(formatMobileMutationError(e, { operation: op }))
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
    onSuccess: async () => {
      if (closeModal?.previewUrl) URL.revokeObjectURL(closeModal.previewUrl)
      setCloseModal(null)
      if (closeCameraInputRef.current) closeCameraInputRef.current.value = ''
      if (closeGalleryInputRef.current) closeGalleryInputRef.current.value = ''
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
    },
    onError: (e: unknown) => {
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
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-ticket-detail'] })
    },
    onError: (e: unknown) => setAssignErr(formatMobileMutationError(e, { operation: 'assign' })),
  })

  const closeBusy = closeM.isPending
  const assignBusy = assignM.isPending
  const ticketHref = (ticket: api.TicketCard) => {
    if (!meQ.data) return `/m/tickets/${ticket.id}`
    const linkScope = scopeForMobileTicketLink(meQ.data, pageScope, ticket)
    return api.appendScopeToPath(mobilePath(location.pathname, `/tickets/${ticket.id}`), compactTicketScope(linkScope), meQ.data)
  }
  const ticketLinkState = (ticket: api.TicketCard) => mobileTicketNavState('home', ticket.companyId, { tab: boardTab, chips: [...activeChips], search: searchQuery.trim() || undefined })
  const closeCanSubmit = !!closeModal?.file && closeModal.comment.trim().length >= 3 && !closeBusy

  const techWillRedirectForScope = techNoLinked && techBoundDefaultsQ.isSuccess && (techBoundDefaultsQ.data?.length ?? 0) > 0
  const technicianScopeGateReady = !techNoLinked || techBoundDefaultsQ.isFetched || techBoundDefaultsQ.isError
  const showMobileHomeTicketBoard = technicianScopeGateReady && !techWillRedirectForScope && !boardQ.isError && (meQ.data || (!!boardQ.data && !isOnline))

  if (providerNeedsLinkedClient) {
    return (
      <div className="mobileSection">
        <div>
          <h1 className="mobileTitle">Главная</h1>
          <div className="mobileSubtitle">Операционный экран без desktop-шумов</div>
        </div>
        <div className="mobileNotice" role="status">
          Выберите клиентский контур в верхней панели, чтобы открыть заявки.
        </div>
      </div>
    )
  }

  return (
    <div className="mobileSection">
      <HomeHeader
        me={meQ.data}
        isOnline={isOnline}
        boardHasData={!!boardQ.data}
        boardError={boardQ.isError ? boardQ.error : null}
        companyPrimaryLine={companyPrimaryLine}
        linkedClientCompanyId={linkedClientCompanyId}
        linkedClientDisplayName={linkedClientDisplayName}
        techNoLinked={meQ.data?.role === 'TECHNICIAN' && !linkedClientCompanyId}
        techBoundPending={techBoundDefaultsQ.isPending}
        techWillRedirectForScope={techWillRedirectForScope}
        techBoundError={techBoundDefaultsQ.isError ? techBoundDefaultsQ.error : null}
        techBoundEmpty={!techBoundDefaultsQ.isPending && !techBoundDefaultsQ.isError && techBoundDefaultsQ.isSuccess && (techBoundDefaultsQ.data?.length ?? 0) === 0}
      />
      {showMobileHomeTicketBoard ? (
        <>
          <div className="mobileHomeBoardSticky">
            <HomeTabs
              role={meQ.data?.role}
              boardTab={boardTab}
              setBoardTab={setBoardTab}
              tabCounts={tabCounts}
              homeIntroDismissed={homeIntroDismissed}
              setHomeIntroDismissed={setHomeIntroDismissed}
              collapsed={!filtersExpanded}
            />
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
              <button
                type="button"
                className="mobileBtn mobileBtnSecondary"
                style={{ fontSize: '0.78rem', padding: '4px 14px', minHeight: 32 }}
                onClick={toggleFiltersExpanded}
              >
                {filtersExpanded ? 'Скрыть фильтры' : 'Показать фильтры'}
              </button>
            </div>
            {filtersExpanded ? (
              <HomeChips
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                activeChips={activeChips}
                toggleChip={toggleChip}
                visibleCount={visibleTickets.length}
                filterSummary={filterSummary}
                onResetAll={resetHomeListFilters}
                hasActiveFilters={boardTab !== 'all' || !!searchQuery.trim() || activeChips.size > 0}
              />
            ) : null}
          </div>
          <HomeList
            boardIsLoading={boardQ.isLoading}
            visibleTickets={visibleTickets}
            tabOnlyTickets={tabOnlyTickets}
            boardTab={boardTab}
            role={meQ.data?.role}
            meId={meQ.data?.id}
            boardTotal={tabCounts.all}
            hasHomeListFilters={hasHomeListFilters}
            filterSummary={filterSummary}
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
            onAction={(ticket) => actionM.mutate(ticket)}
            setAssignErr={setAssignErr}
            setAssignTicket={setAssignTicket}
            assignCandidatesQ={assignCandidatesQ}
            assignTechOptions={assignTechOptions}
            assignTechId={assignTechId}
            setAssignTechId={setAssignTechId}
            assignErr={assignErr}
            assignM={assignM}
            closeCameraInputRef={closeCameraInputRef}
            closeGalleryInputRef={closeGalleryInputRef}
            setCloseModal={setCloseModal}
            closeCanSubmit={closeCanSubmit}
            closeM={closeM}
            mobileActionToast={mobileActionToast}
          />
        </>
      ) : null}
      <HomeFAB me={meQ.data} pageScope={pageScope} />
    </div>
  )
}
