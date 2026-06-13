import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { SUPPORT_MAX_URL, SUPPORT_TELEGRAM_URL } from '../lib/supportUrls'
import { useLinkedBoardScope } from '../hooks/useLinkedBoardScope'
import { mobilePath } from './mobileRoute'
import { isMineTicketForRole } from './mobileHomeBoardFilters'
import {
  mobileTicketCategoryLocationFromDetail,
  mobileTicketDetailGetOneScopes,
  mobileTicketNumberTitle,
  mobileTicketStatusLabelRu,
  resolveMobileTicketResourceScope,
} from './mobileTicketDisplay'
import { MobileTicketPhotoGallery } from './MobileTicketPhotoGallery'
import { FullscreenPhotoViewer, type PhotoViewerItem } from '../components/FullscreenPhotoViewer'
import { toChatMessages } from '../lib/ticketChat'

type ChatsFilter = 'all' | 'mine' | 'active' | 'with_photo'
type ChatTab = 'chat' | 'info' | 'files' | 'history'

type ChatsListItem = api.TicketCard & {
  lastActivityAt: string
}

type ChatsCompanyItem = {
  id: string
  title: string
  preview: string
  iconTone: string
}

type ChatsPromoItem = {
  id: string
  title: string
  description: string
  actionLabel: string
  href: string
  iconTone: string
}

type ChatsSectionId = 'my_work' | 'objects' | 'company' | 'max' | 'support' | 'archive'

const ACTIVE_STATUSES = new Set<api.TicketStatus>(['NEW', 'ASSIGNED', 'IN_PROGRESS'])
const ARCHIVE_STATUSES = new Set<api.TicketStatus>(['DONE', 'CANCELED'])

const CHAT_FILTERS: Array<{ id: ChatsFilter; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'mine', label: 'Мои' },
  { id: 'active', label: 'Активные' },
  { id: 'with_photo', label: 'С фото' },
]

function normalizeSearchText(value: string): string {
  return (value || '').trim().toLowerCase()
}

function formatLastActivity(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) {
    return `Вчера, ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
  }
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

function ticketLastActivity(ticket: api.TicketCard): string {
  const maybeUpdated = (ticket as api.TicketCard & { updatedAt?: string }).updatedAt
  return maybeUpdated || ticket.createdAt
}

function ticketSearchBlob(ticket: api.TicketCard): string {
  const statusLabel = mobileTicketStatusLabelRu(ticket.status)
  const locationText = ticket.location?.name || ticket.pointName || ''
  return normalizeSearchText(
    [
      ticket.ticketNumber != null ? `заявка ${ticket.ticketNumber}` : 'заявка',
      ticket.ticketNumber != null ? String(ticket.ticketNumber) : '',
      ticket.title || '',
      ticket.description || '',
      ticket.location?.name || '',
      ticket.location?.address || '',
      ticket.pointName || '',
      ticket.status || '',
      statusLabel,
      ticket.category?.name || '',
      locationText,
    ]
      .filter(Boolean)
      .join(' '),
  )
}

function ticketHasPhoto(ticket: api.TicketCard): boolean {
  return !!ticket.attachmentPreviewUrl || (ticket.imageAttachmentCount ?? 0) > 0
}

function isUrgentTicket(ticket: api.TicketCard): boolean {
  return ticket.urgency === 'URGENT' || ticket.priority === 'URGENT' || ticket.slaBreached === true
}

function ticketChatTitle(ticket: api.TicketCard): string {
  return (ticket.title || ticket.description || ticket.category?.name || 'Без темы').trim()
}

function ticketChatPreview(ticket: api.TicketCard): string {
  return (ticket.description || 'Обсуждение по заявке').trim()
}

function ticketLocationLabel(ticket: api.TicketCard): string {
  return (ticket.location?.name || ticket.pointName || 'Без локации').trim()
}

function isMyWorkTicket(ticket: api.TicketCard, meId?: string, role?: api.Role | null): boolean {
  const directMine = isMineTicketForRole(ticket, meId, role)
  const assignedToMe = !!meId && (ticket.assignedTechnicianId || ticket.assignedTechnician?.id || '').trim() === meId.trim()
  return directMine || assignedToMe || ACTIVE_STATUSES.has(ticket.status) || isUrgentTicket(ticket)
}

function ticketWorkTags(ticket: api.TicketCard, meId?: string, role?: api.Role | null): string[] {
  const tags: string[] = []
  if (isMineTicketForRole(ticket, meId, role)) tags.push('Моя')
  if (meId && (ticket.assignedTechnicianId || ticket.assignedTechnician?.id || '').trim() === meId.trim()) tags.push('Назначена мне')
  if (isUrgentTicket(ticket)) tags.push('Срочная')
  if (ticket.status === 'NEW') tags.push('Новая')
  if (ticket.status === 'ASSIGNED') tags.push('Назначена')
  if (ticket.status === 'IN_PROGRESS') tags.push('В работе')
  return Array.from(new Set(tags))
}

function ticketStatusTone(status: api.TicketStatus): string {
  if (status === 'NEW') return 'orange'
  if (status === 'ASSIGNED') return 'blue'
  if (status === 'IN_PROGRESS') return 'violet'
  if (status === 'DONE') return 'green'
  return 'green'
}

function ticketDetailTitle(ticket: api.TicketGetOne): string {
  return (ticket.description || ticket.title || ticket.problemText || ticket.problemCategory?.name || 'Заявка').trim()
}

function ticketDetailLocation(ticket: api.TicketGetOne): string {
  const loc = ticket.location
  const parts: string[] = []
  const name = (loc?.name || ticket.pointName || '').trim()
  if (name) parts.push(name)
  const addr = (loc?.address || ticket.address || '').trim()
  if (addr) parts.push(addr)
  return parts.length ? parts.join(' · ') : 'Без локации'
}

function isNotFoundGetTicketError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /\b404\b/i.test(msg) || /not\s*found/i.test(msg) || /не\s+найден/i.test(msg)
}

function chatListIconClass(status: api.TicketStatus) {
  return `mobileChatsRoomIcon mobileChatsRoomIcon--${ticketStatusTone(status)}`
}

export function MobileChatsPage() {
  const location = useLocation()
  const { ticketId = '' } = useParams()
  const { me, isMeReady, boardParams } = useLinkedBoardScope()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ChatsFilter>('all')
  const [composerText, setComposerText] = useState('')
  const [composerError, setComposerError] = useState('')
  const [activeTab, setActiveTab] = useState<ChatTab>('chat')
  const [viewer, setViewer] = useState<{ items: PhotoViewerItem[]; index: number } | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Partial<Record<ChatsSectionId, boolean>>>({})
  const [expandedObjectIds, setExpandedObjectIds] = useState<Record<string, boolean>>({})

  const boardQ = useQuery({
    queryKey: ['mobile-chats-board', boardParams.companyId || '', boardParams.linkedClientCompanyId || ''],
    queryFn: () =>
      api.board({
        companyId: boardParams.companyId || undefined,
        linkedClientCompanyId: boardParams.linkedClientCompanyId || undefined,
        take: 200,
        includeArchived: true,
      }),
    enabled: isMeReady,
  })

  const allTickets = useMemo<ChatsListItem[]>(() => {
    const flattened = (boardQ.data?.columns || []).flatMap((col) => col.cards || [])
    const seen = new Set<string>()
    const out: ChatsListItem[] = []
    for (const ticket of flattened) {
      if (seen.has(ticket.id)) continue
      seen.add(ticket.id)
      out.push({ ...ticket, lastActivityAt: ticketLastActivity(ticket) })
    }
    out.sort((a, b) => {
      const at = new Date(a.lastActivityAt).getTime()
      const bt = new Date(b.lastActivityAt).getTime()
      return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0)
    })
    return out
  }, [boardQ.data])

  const visibleTickets = useMemo(() => {
    const q = normalizeSearchText(search)
    return allTickets.filter((ticket) => {
      if (filter === 'mine' && !isMineTicketForRole(ticket, me?.id, me?.role)) return false
      if (filter === 'active' && !ACTIVE_STATUSES.has(ticket.status)) return false
      if (filter === 'with_photo' && !ticketHasPhoto(ticket)) return false
      if (!q) return true
      return ticketSearchBlob(ticket).includes(q)
    })
  }, [allTickets, filter, me?.id, me?.role, search])

  const myWorkTickets = useMemo(() => {
    const q = normalizeSearchText(search)
    return visibleTickets
      .filter((ticket) => isMyWorkTicket(ticket, me?.id, me?.role))
      .filter((ticket) => !q || ticketSearchBlob(ticket).includes(q))
  }, [me?.id, me?.role, search, visibleTickets])

  const archiveTickets = useMemo(() => {
    return visibleTickets.filter((ticket) => ARCHIVE_STATUSES.has(ticket.status))
  }, [visibleTickets])

  const objectRows = useMemo(() => {
    const map = new Map<string, {
      id: string
      title: string
      activeCount: number
      preview: string
      timeLabel: string
      lastActivityAt: string
      tickets: ChatsListItem[]
      iconTone: string
    }>()

    for (const ticket of myWorkTickets) {
      const key = ticket.location?.id || ticket.location?.name || ticket.pointName || `ticket:${ticket.id}`
      const title = ticket.location?.name || ticket.pointName || ticket.location?.address || 'Без объекта'
      const current = map.get(key)
      const lastActivityAt = ticket.lastActivityAt
      const tickets = current ? [...current.tickets, ticket] : [ticket]
      const currentPreview = ticket.description || ticket.title || ticket.category?.name || 'Обсуждение по заявке'
      const nextPreview = current && current.lastActivityAt >= lastActivityAt ? current.preview : currentPreview
      const nextLast = current && current.lastActivityAt > lastActivityAt ? current.lastActivityAt : lastActivityAt
      map.set(key, {
        id: key,
        title,
        activeCount: tickets.filter((row) => ACTIVE_STATUSES.has(row.status)).length,
        preview: nextPreview,
        timeLabel: formatLastActivity(nextLast),
        lastActivityAt: nextLast,
        tickets,
        iconTone: ticketStatusTone(ticket.status),
      })
    }

    return Array.from(map.values())
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())
  }, [myWorkTickets])

  const companyRows = useMemo<ChatsCompanyItem[]>(() => {
    const rows: ChatsCompanyItem[] = [
      {
        id: 'dispatch',
        title: 'Диспетчерская',
        preview: 'Внутренний чат компании',
        iconTone: 'violet',
      },
      {
        id: 'contractors',
        title: 'Подрядчики',
        preview: 'Координация подрядных работ',
        iconTone: 'teal',
      },
    ]
    const q = normalizeSearchText(search)
    if (!q) return rows
    return rows.filter((row) => normalizeSearchText([row.title, row.preview].join(' ')).includes(q))
  }, [search])

  const maxCard = useMemo<ChatsPromoItem>(
    () => ({
      id: 'max',
      title: 'MAX',
      description: 'Перейти к ассистенту ServiceManager.AI в MAX.',
      actionLabel: 'Открыть MAX',
      href: '/max',
      iconTone: 'violet',
    }),
    [],
  )

  const supportCard = useMemo<ChatsPromoItem>(
    () => ({
      id: 'support',
      title: 'Поддержка',
      description: 'Быстрая связь с командой поддержки в Telegram или MAX.',
      actionLabel: 'Написать в поддержку',
      href: SUPPORT_MAX_URL,
      iconTone: 'green',
    }),
    [],
  )

  const searchQuery = normalizeSearchText(search)

  const sectionCounts = useMemo(
    () => ({
      my_work: myWorkTickets.length,
      objects: objectRows.length,
      company: companyRows.length,
      max: 1,
      support: 1,
      archive: archiveTickets.length,
    }),
    [archiveTickets.length, companyRows.length, myWorkTickets.length, objectRows.length],
  )

  const sectionDefaults = useMemo(
    () => ({
      my_work: true,
      objects: objectRows.length > 3 ? false : true,
      company: false,
      max: true,
      support: true,
      archive: false,
    }),
    [objectRows.length],
  )

  const sectionIsExpanded = (section: ChatsSectionId): boolean => {
    const hasSearchMatches = searchQuery.length > 0 && sectionCounts[section] > 0
    if (hasSearchMatches) return true
    const explicit = collapsedSections[section]
    if (typeof explicit === 'boolean') return !explicit
    return sectionDefaults[section]
  }

  const toggleSection = (section: ChatsSectionId) => {
    const nextExpanded = !sectionIsExpanded(section)
    setCollapsedSections((current) => ({
      ...current,
      [section]: !nextExpanded,
    }))
  }

  const toggleObject = (id: string) => {
    setExpandedObjectIds((current) => ({
      ...current,
      [id]: !current[id],
    }))
  }

  const objectIsExpanded = (id: string): boolean => {
    if (searchQuery.length > 0) return true
    return !!expandedObjectIds[id]
  }

  function renderTicketRow(ticket: ChatsListItem, href: string, variant: 'work' | 'nested' | 'archive' = 'work') {
    const badges = variant === 'work' ? ticketWorkTags(ticket, me?.id, me?.role) : []
    const compact = variant !== 'work'
    return (
      <Link key={ticket.id} className={`mobileChatsItem${compact ? ' mobileChatsItem--compact' : ''}`} to={href}>
        <div className={chatListIconClass(ticket.status)} aria-hidden="true">
          <span className="mobileChatsRoomIconEmoji">💬</span>
        </div>

        <div className="mobileChatsItemBody">
          <div className="mobileChatsItemTop">
            <div className="mobileChatsItemTopLeft">
              <div className="mobileChatsItemTitle">{mobileTicketNumberTitle(ticket.ticketNumber)}</div>
              <span className={`mobileChatsIndicator mobileChatsIndicator--${ticket.status}`} aria-hidden="true" />
            </div>
            <div className="mobileChatsItemTime">{formatLastActivity(ticket.lastActivityAt)}</div>
          </div>

          <div className="mobileChatsItemTitleSecondary">{ticketChatTitle(ticket)}</div>
          <div className="mobileChatsItemPreview">{ticketChatPreview(ticket)}</div>

          <div className="mobileChatsItemMeta">
            <div className="mobileChatsItemMetaLeft">{ticketLocationLabel(ticket)}</div>
            <div className="mobileChatsItemMetaRight">
              {ticketHasPhoto(ticket) ? <span className="mobileChatsPhotoChip">Фото</span> : null}
              <span className={`mobileTicketStatus mobileTicketStatus--${ticket.status}`}>
                {mobileTicketStatusLabelRu(ticket.status)}
              </span>
            </div>
          </div>

          {badges.length ? (
            <div className="mobileChatsBadges">
              {badges.map((badge) => (
                <span key={badge} className="mobileChatsBadge">{badge}</span>
              ))}
            </div>
          ) : null}
        </div>
      </Link>
    )
  }

  const ticketReadScopes = useMemo(
    () =>
      ticketId
        ? mobileTicketDetailGetOneScopes({
            urlCompanyId: boardParams.companyId || '',
            urlLinkedClientCompanyId: boardParams.linkedClientCompanyId || '',
            stateTicketOwnerCompanyId: '',
            persistedCompanyId: api.getObserverCompanyId(me),
            persistedLinkedClientCompanyId: api.getLinkedClientCompanyId(me),
            meRole: me?.role,
          })
        : [],
    [boardParams.companyId, boardParams.linkedClientCompanyId, me, ticketId],
  )

  const ticketQ = useQuery({
    queryKey: ['mobile-chats-ticket', ticketId, boardParams.companyId || '', boardParams.linkedClientCompanyId || ''],
    queryFn: async () => {
      if (!ticketId) throw new Error('ticketId is empty')
      let lastErr: unknown = null
      for (const scope of ticketReadScopes) {
        try {
          return await api.getTicket(ticketId, scope)
        } catch (err) {
          lastErr = err
          if (!isNotFoundGetTicketError(err)) throw err
        }
      }
      throw lastErr || new Error('Ticket not found')
    },
    enabled: !!ticketId && isMeReady,
  })

  const ticketResourceScope = useMemo(
    () =>
      ticketQ.data
        ? resolveMobileTicketResourceScope(me, ticketQ.data, {
            observerCompanyId: boardParams.companyId,
            urlLinkedClientCompanyId: boardParams.linkedClientCompanyId,
          })
        : undefined,
    [boardParams.companyId, boardParams.linkedClientCompanyId, me, ticketQ.data],
  )

  const timelineQ = useQuery({
    queryKey: ['mobile-chats-timeline', ticketId, ticketResourceScope?.companyId || '', ticketResourceScope?.linkedClientCompanyId || ''],
    queryFn: () => api.ticketTimeline(ticketId, ticketResourceScope),
    enabled: !!ticketQ.data,
  })

  const attachmentsQ = useQuery({
    queryKey: ['mobile-chats-attachments', ticketId, ticketResourceScope?.companyId || '', ticketResourceScope?.linkedClientCompanyId || ''],
    queryFn: () => api.ticketAttachments(ticketId, ticketResourceScope),
    enabled: !!ticketQ.data,
  })

  const timelineItems = useMemo(() => {
    const items = timelineQ.data?.timeline || timelineQ.data?.items || timelineQ.data?.events || []
    const seen = new Set<string>()
    return items.filter((item) => {
      const key = `${item.at}|${item.timelineEvent || item.type || item.domainType || item.title}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [timelineQ.data])

  const chatMessages = useMemo(() => toChatMessages(timelineItems, me?.id ?? ''), [timelineItems, me?.id])
  const photoAttachments = useMemo(
    () => (attachmentsQ.data || []).filter((a) => (a.mimeType || '').toLowerCase().startsWith('image/')),
    [attachmentsQ.data],
  )
  const photoViewerItems = useMemo<PhotoViewerItem[]>(
    () =>
      photoAttachments.map((a) => ({
        src: api.resolveTicketAttachmentUrl(a),
        alt: a.originalName || a.filename || 'Фото',
      })),
    [photoAttachments],
  )

  const sendCommentM = useMutation({
    mutationFn: (comment: string) => {
      if (!ticketQ.data) throw new Error('Ticket not loaded')
      return api.addTicketComment(ticketId, comment, ticketResourceScope)
    },
    onMutate: () => setComposerError(''),
    onSuccess: async () => {
      setComposerText('')
      await queryClient.invalidateQueries({ queryKey: ['mobile-chats-timeline', ticketId] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-chats-ticket', ticketId] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-chats-board'] })
    },
    onError: (err: any) => {
      setComposerError(err?.message || 'Не удалось отправить сообщение')
    },
  })

  useEffect(() => {
    if (!ticketId) {
      setActiveTab('chat')
      setComposerText('')
      setComposerError('')
      setViewer(null)
    }
  }, [ticketId])

  if (!isMeReady || (!boardQ.data && !ticketId)) {
    return (
      <div className="mobileSection mobileChatsScreen">
        <div className="mobileChatsTop">
          <div>
            <h1 className="mobileTitle mobileChatsAppTitle">Чаты</h1>
            <div className="mobileSubtitle">Загрузка заявок…</div>
          </div>
        </div>
        <div className="mobileCard mobileMeta">Подтягиваем список чатов.</div>
      </div>
    )
  }

  if (ticketId) {
    if (ticketQ.isLoading) {
      return (
        <div className="mobileSection mobileChatsDialog">
          <div className="mobileCard mobileMeta">Открываем чат…</div>
        </div>
      )
    }

    if (ticketQ.isError || !ticketQ.data) {
      const reason = isNotFoundGetTicketError(ticketQ.error)
        ? 'Чат по этой заявке не найден или недоступен в текущем контексте.'
        : (ticketQ.error instanceof Error ? ticketQ.error.message : 'Не удалось загрузить чат.')
      return (
        <div className="mobileSection mobileChatsDialog">
          <div className="mobileChatsDialogHeader">
            <Link className="mobileChatsDialogBack" to={`${mobilePath(location.pathname, '/chats')}${location.search}`}>
              ←
            </Link>
            <div className="mobileChatsDialogHeaderMain">
              <div className="mobileChatsDialogTitleRow">
                <h1 className="mobileChatsDialogTitle">Чат не найден</h1>
              </div>
              <div className="mobileChatsDialogSubtitle">Заявка недоступна в текущем контуре</div>
            </div>
            <span className="mobileChatsDialogMenu" aria-hidden="true">⋯</span>
          </div>
          <div className="mobileEmptyState mobileCard">
            <p className="mobileEmptyStateTitle">Не удалось открыть чат</p>
            <p className="mobileEmptyStateHint">{reason}</p>
            <Link className="mobileChatsDialogBack" to={`${mobilePath(location.pathname, '/chats')}${location.search}`}>
              Назад
            </Link>
          </div>
        </div>
      )
    }

    const currentTicket = ticketQ.data
    const currentTicketTitle = ticketDetailTitle(currentTicket)
    const currentTicketStatus = mobileTicketStatusLabelRu(currentTicket.status)
    const commentMessages = chatMessages
    const fallbackMessage = currentTicket.problemText || currentTicket.description || currentTicket.title || 'Обсуждение по заявке'
    const messages = commentMessages.length
      ? commentMessages
      : [
          {
            id: `${currentTicket.id}-fallback`,
            at: currentTicket.createdAt,
            text: fallbackMessage,
            authorId: currentTicket.assignedTechnicianId || null,
            authorEmail: currentTicket.assignedTechnician?.email || null,
            isOwn: false,
          },
        ]

    const systemRows = timelineItems.filter((item) => !(item.type === 'ticket.comment_added' || item.timelineEvent === 'COMMENT_ADDED'))
    const hasPhotos = photoAttachments.length > 0
    const composerDisabled = sendCommentM.isPending || !composerText.trim()

    return (
      <div className="mobileSection mobileChatsDialog">
        {viewer ? (
          <FullscreenPhotoViewer items={viewer.items} initialIndex={viewer.index} onClose={() => setViewer(null)} />
        ) : null}

        <div className="mobileChatsDialogHeader">
          <Link className="mobileChatsDialogBack" to={`${mobilePath(location.pathname, '/chats')}${location.search}`}>
            ←
          </Link>
          <div className="mobileChatsDialogHeaderMain">
            <div className="mobileChatsDialogTitleRow">
              <h1 className="mobileChatsDialogTitle">{mobileTicketNumberTitle(currentTicket.ticketNumber)}</h1>
              <span className={`mobileTicketStatus mobileTicketStatus--${currentTicket.status}`}>
                {currentTicketStatus}
              </span>
            </div>
            <div className="mobileChatsDialogSubtitle">
              {currentTicketTitle}
              {(currentTicket.location?.name || currentTicket.pointName)
                ? ` · ${(currentTicket.location?.name || currentTicket.pointName || '').trim()}`
                : null}
            </div>
          </div>
          <Link
            className="mobileChatsDialogMenu"
            to={`${mobilePath(location.pathname, `/tickets/${currentTicket.id}`)}${location.search}`}
            aria-label="Открыть заявку"
          >
            →
          </Link>
        </div>

        <div className="mobileChatsDialogTabs">
          {(['chat', 'info', 'files', 'history'] as ChatTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`mobileChatsDialogTab${activeTab === tab ? ' mobileChatsDialogTab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'chat' ? 'Чат' : tab === 'info' ? 'Инфо' : tab === 'files' ? 'Файлы' : 'История'}
            </button>
          ))}
        </div>

        <div className="mobileChatsRelationCard">
          <div className="mobileChatsRelationTop">
            <div className="mobileChatsRelationLabel">{mobileTicketNumberTitle(currentTicket.ticketNumber)}</div>
            <Link className="mobileChatsRelationLink" to={`${mobilePath(location.pathname, `/tickets/${currentTicket.id}`)}${location.search}`}>
              Открыть
            </Link>
          </div>
          <div className="mobileChatsRelationHint">{mobileTicketCategoryLocationFromDetail(currentTicket)}</div>
          <div className="mobileChatsRelationHint">
            <span className={`mobileTicketStatus mobileTicketStatus--${currentTicket.status}`}>{currentTicketStatus}</span>
            <span style={{ marginLeft: 8 }}>{ticketDetailLocation(currentTicket)}</span>
          </div>
        </div>

        {activeTab === 'chat' ? (
          <>
            <div className="mobileChatsDatePill">{formatLastActivity(currentTicket.updatedAt || currentTicket.createdAt)}</div>

            <div className="mobileChatsMessages">
              {messages.map((msg) => {
                const own = !!msg.isOwn
                return (
                  <div className={`mobileChatsBubbleRow${own ? ' mobileChatsBubbleRow--own' : ''}`} key={msg.id}>
                    {!own ? <div className="mobileChatsAvatar" aria-hidden="true">💬</div> : null}
                    <div className={`mobileChatsBubble${own ? ' mobileChatsBubble--own' : ''}`}>
                      <div className="mobileChatsBubbleAuthor">
                        {own ? 'Вы' : (currentTicket.requesterName || 'Клиент')}
                        <span>{own ? ' · Исполнитель' : ' · Заявка'}</span>
                      </div>
                      <div className="mobileChatsBubbleText">{msg.text}</div>
                      <div className="mobileChatsBubbleFooter">
                        <span>{formatLastActivity(msg.at)}</span>
                        {own ? <span className="mobileChatsBubbleRead">✓✓</span> : null}
                      </div>
                    </div>
                  </div>
                )
              })}

              {!commentMessages.length ? (
                <div className="mobileChatsSystemRow">
                  <div className="mobileChatsSystemPill">
                    <div className="mobileChatsSystemText">Обсуждение по заявке</div>
                    <div className="mobileChatsSystemTime">
                      {currentTicket.problemText || currentTicket.description || currentTicket.title || 'Без описания'}
                    </div>
                  </div>
                </div>
              ) : null}

              {systemRows.map((item) => (
                <div className="mobileChatsSystemRow" key={`${item.at}-${item.timelineEvent || item.type || item.title}`}>
                  <div className="mobileChatsSystemPill">
                    <div className="mobileChatsSystemText">{item.title || 'Системное событие'}</div>
                    <div className="mobileChatsSystemTime">{formatLastActivity(item.at)}</div>
                  </div>
                </div>
              ))}
            </div>

            {hasPhotos ? (
              <div className="mobileCard">
                <MobileTicketPhotoGallery
                  title="Фото"
                  photos={photoAttachments}
                  emptyText="Фото к заявке пока нет"
                  onOpen={(index) => {
                    setViewer({
                      index,
                      items: photoViewerItems,
                    })
                  }}
                />
              </div>
            ) : null}

            <div className="mobileChatsComposer">
              <button className="mobileChatsComposerButton" type="button" aria-label="Вложение">
                +
              </button>
              <button className="mobileChatsComposerButton" type="button" aria-label="Фото">
                📷
              </button>
              <textarea
                className="mobileChatsComposerInput"
                placeholder="Сообщение..."
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (!composerDisabled) sendCommentM.mutate(composerText.trim())
                  }
                }}
                rows={1}
                disabled={sendCommentM.isPending}
              />
              <button
                className="mobileChatsComposerSend"
                type="button"
                aria-label="Отправить"
                onClick={() => sendCommentM.mutate(composerText.trim())}
                disabled={composerDisabled}
              >
                {sendCommentM.isPending ? '…' : '➤'}
              </button>
            </div>
            {composerError ? <div className="mobileNotice mobileNoticeError">{composerError}</div> : null}
          </>
        ) : null}

        {activeTab === 'info' ? (
          <div className="mobileCard mobileChatsPlaceholder">
            <div className="mobileChatsSectionTitle" style={{ padding: 0, marginBottom: 8 }}>
              Информация
            </div>
            <div style={{ display: 'grid', gap: 6, fontSize: '0.88rem', lineHeight: 1.4 }}>
              <div><strong>Статус:</strong> {currentTicketStatus}</div>
              <div><strong>Локация:</strong> {ticketDetailLocation(currentTicket)}</div>
              <div><strong>Заявка:</strong> {currentTicketTitle}</div>
              <div><strong>Комментарий:</strong> {currentTicket.problemText || currentTicket.description || '—'}</div>
            </div>
          </div>
        ) : null}

        {activeTab === 'files' ? (
          <div className="mobileCard">
            <MobileTicketPhotoGallery
              title="Файлы"
              photos={photoAttachments}
              emptyText="Файлов и фото пока нет"
              onOpen={(index) => {
                setViewer({
                  index,
                  items: photoViewerItems,
                })
              }}
            />
          </div>
        ) : null}

        {activeTab === 'history' ? (
          <div className="mobileChatsMessages">
            {timelineItems.length ? (
              timelineItems.map((item) => (
                <div className="mobileChatsSystemRow" key={`${item.at}-${item.timelineEvent || item.type || item.title}`}>
                  <div className="mobileChatsSystemPill">
                    <div className="mobileChatsSystemText">{item.title || 'Событие'}</div>
                    <div className="mobileChatsSystemTime">{formatLastActivity(item.at)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="mobileEmptyState mobileCard">
                <p className="mobileEmptyStateTitle">История пуста</p>
                <p className="mobileEmptyStateHint">Системные события появятся, когда по заявке начнётся работа.</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    )
  }

  // --- List view ---

  const myWorkEmptyTitle = visibleTickets.length > 0 ? 'Нет чатов по фильтру' : 'Заявок пока нет'
  const myWorkEmptyHint = visibleTickets.length > 0
    ? 'Измените поиск или фильтр, чтобы увидеть рабочие чаты.'
    : 'Когда заявки появятся, они отобразятся здесь как рабочие чаты.'

  const archiveEmptyTitle = archiveTickets.length > 0 ? 'Нет архивных чатов' : 'Архив пуст'
  const archiveEmptyHint = archiveTickets.length > 0
    ? 'Измените поиск или фильтр, чтобы увидеть архив.'
    : 'Завершённые и отменённые заявки появятся здесь.'

  const sectionRows: Array<{ id: ChatsSectionId; title: string; count: number }> = [
    { id: 'my_work', title: '🔥 Моя работа', count: sectionCounts.my_work },
    { id: 'objects', title: '🏢 Объекты', count: sectionCounts.objects },
    { id: 'company', title: '🏢 Компания', count: sectionCounts.company },
    { id: 'max', title: '🤖 MAX', count: sectionCounts.max },
    { id: 'support', title: '🛟 Поддержка', count: sectionCounts.support },
  ]

  return (
    <div className="mobileSection mobileChatsScreen">
      <div className="mobileChatsTop">
        <div>
          <h1 className="mobileTitle mobileChatsAppTitle">Чаты</h1>
          <div className="mobileSubtitle">Рабочие каналы по заявкам, объектам, компании и поддержке</div>
        </div>

        <div className="mobileChatsSearchRow">
          <input
            className="mobileChatsSearchInput"
            placeholder="Поиск по заявкам, объектам, статусам"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mobileChatsFilters" role="tablist" aria-label="Фильтры чатов">
          {CHAT_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`mobileChatsFilterChip${filter === item.id ? ' mobileChatsFilterChip--active' : ''}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mobileChatsHintCard mobileCard">
          Чаты сгруппированы как рабочий мессенджер: моя работа, объекты, внутренние каналы и переходы в MAX и поддержку.
        </div>
      </div>

      <div className="mobileChatsSections">
        {sectionRows.map((section) => (
          <section className="mobileChatsSection" aria-label={section.title} key={section.id}>
            <button
              type="button"
              className="mobileChatsSectionHeader"
              aria-expanded={sectionIsExpanded(section.id)}
              onClick={() => toggleSection(section.id)}
            >
              <span className="mobileChatsSectionHeaderLabel">{section.title}</span>
              <span className="mobileChatsSectionHeaderMeta">
                <span className="mobileChatsSectionHeaderCount">{section.count}</span>
                <span className={`mobileChatsSectionHeaderChevron${sectionIsExpanded(section.id) ? ' mobileChatsSectionHeaderChevron--open' : ''}`}>▼</span>
              </span>
            </button>

            {section.id === 'my_work' ? (
              section.count === 0 ? (
                <div className="mobileEmptyState mobileCard">
                  <p className="mobileEmptyStateTitle">{myWorkEmptyTitle}</p>
                  <p className="mobileEmptyStateHint">{myWorkEmptyHint}</p>
                  {search || filter !== 'all' ? (
                    <button
                      type="button"
                      className="mobileChatsDialogBack"
                      onClick={() => {
                        setSearch('')
                        setFilter('all')
                      }}
                    >
                      Сбросить
                    </button>
                  ) : null}
                </div>
              ) : sectionIsExpanded(section.id) ? (
                <div className="mobileChatsList">
                  {myWorkTickets.map((ticket) =>
                    renderTicketRow(ticket, `${mobilePath(location.pathname, `/chats/${ticket.id}`)}${location.search}`, 'work'),
                  )}
                </div>
              ) : null
            ) : null}

            {section.id === 'objects' ? (
              section.count === 0 ? (
                <div className="mobileEmptyState mobileCard">
                  <p className="mobileEmptyStateTitle">Объекты не найдены</p>
                  <p className="mobileEmptyStateHint">По текущему фильтру нет рабочих заявок, сгруппированных по объектам.</p>
                </div>
              ) : sectionIsExpanded(section.id) ? (
                <div className="mobileChatsList">
                  {objectRows.map((item) => (
                    <div key={item.id} className="mobileChatsObjectGroup">
                      <button
                        type="button"
                        className="mobileChatsItem mobileChatsItem--object mobileChatsObjectRow"
                        onClick={() => toggleObject(item.id)}
                        aria-expanded={objectIsExpanded(item.id)}
                      >
                        <div className={`mobileChatsRoomIcon mobileChatsRoomIcon--${item.iconTone}`} aria-hidden="true">
                          <span className="mobileChatsRoomIconEmoji">🏢</span>
                        </div>
                        <div className="mobileChatsItemBody">
                          <div className="mobileChatsItemTop">
                            <div className="mobileChatsItemTitle">{item.title}</div>
                            <div className="mobileChatsItemTime">
                              {item.timeLabel}
                              <span className="mobileChatsItemCount">{item.activeCount}</span>
                              <span className={`mobileChatsSectionHeaderChevron${objectIsExpanded(item.id) ? ' mobileChatsSectionHeaderChevron--open' : ''}`}>▼</span>
                            </div>
                          </div>
                          <div className="mobileChatsItemPreview mobileChatsItemPreview--strong">
                            {item.activeCount > 0 ? `${item.activeCount} активных заявок` : 'Нет активных заявок'}
                          </div>
                          <div className="mobileChatsItemPreview mobileChatsItemPreview--muted">{item.preview}</div>
                        </div>
                      </button>

                      {objectIsExpanded(item.id) ? (
                        <div className="mobileChatsNestedList">
                          {item.tickets.map((ticket) =>
                            renderTicketRow(ticket, `${mobilePath(location.pathname, `/chats/${ticket.id}`)}${location.search}`, 'nested'),
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null
            ) : null}

            {section.id === 'company' ? (
              section.count === 0 ? (
                <div className="mobileEmptyState mobileCard">
                  <p className="mobileEmptyStateTitle">Внутренних каналов пока нет</p>
                  <p className="mobileEmptyStateHint">Компания не содержит доступных внутренних каналов в этом контуре.</p>
                </div>
              ) : sectionIsExpanded(section.id) ? (
                <div className="mobileChatsList">
                  {companyRows.map((item) => (
                    <div key={item.id} className="mobileChatsItem mobileChatsItem--static mobileChatsCompanyRow" aria-disabled="true">
                      <div className={`mobileChatsRoomIcon mobileChatsRoomIcon--${item.iconTone}`} aria-hidden="true">
                        <span className="mobileChatsRoomIconEmoji">💬</span>
                      </div>
                      <div className="mobileChatsItemBody">
                        <div className="mobileChatsItemTop">
                          <div className="mobileChatsItemTitle">{item.title}</div>
                          <div className="mobileChatsItemTime">Канал</div>
                        </div>
                        <div className="mobileChatsItemTitleSecondary">{item.preview}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null
            ) : null}

            {section.id === 'max' ? (
              sectionIsExpanded(section.id) ? (
                <div className="mobileChatsPromoCard mobileCard">
                  <div className="mobileChatsPromoTop">
                    <div className={`mobileChatsRoomIcon mobileChatsRoomIcon--${maxCard.iconTone}`} aria-hidden="true">
                      <span className="mobileChatsRoomIconEmoji">🤖</span>
                    </div>
                    <div className="mobileChatsPromoBody">
                      <div className="mobileChatsPromoTitle">{maxCard.title}</div>
                      <div className="mobileChatsPromoText">{maxCard.description}</div>
                    </div>
                  </div>
                  <Link className="mobileChatsPromoAction" to={maxCard.href}>
                    {maxCard.actionLabel}
                  </Link>
                </div>
              ) : null
            ) : null}

            {section.id === 'support' ? (
              sectionIsExpanded(section.id) ? (
                <div className="mobileChatsPromoCard mobileCard">
                  <div className="mobileChatsPromoTop">
                    <div className={`mobileChatsRoomIcon mobileChatsRoomIcon--${supportCard.iconTone}`} aria-hidden="true">
                      <span className="mobileChatsRoomIconEmoji">🛟</span>
                    </div>
                    <div className="mobileChatsPromoBody">
                      <div className="mobileChatsPromoTitle">{supportCard.title}</div>
                      <div className="mobileChatsPromoText">{supportCard.description}</div>
                    </div>
                  </div>
                  <div className="mobileChatsPromoActions">
                    <a className="mobileChatsPromoAction mobileChatsPromoAction--secondary" href={SUPPORT_TELEGRAM_URL} target="_blank" rel="noreferrer">
                      Telegram
                    </a>
                    <a className="mobileChatsPromoAction" href={SUPPORT_MAX_URL} target="_blank" rel="noreferrer">
                      MAX
                    </a>
                  </div>
                </div>
              ) : null
            ) : null}
          </section>
        ))}

        {archiveTickets.length > 0 ? (
          <section className="mobileChatsSection" aria-label="Архив">
            <button
              type="button"
              className="mobileChatsSectionHeader"
              aria-expanded={sectionIsExpanded('archive')}
              onClick={() => toggleSection('archive')}
            >
              <span className="mobileChatsSectionHeaderLabel">Архив</span>
              <span className="mobileChatsSectionHeaderMeta">
                <span className="mobileChatsSectionHeaderCount">{sectionCounts.archive}</span>
                <span className={`mobileChatsSectionHeaderChevron${sectionIsExpanded('archive') ? ' mobileChatsSectionHeaderChevron--open' : ''}`}>▼</span>
              </span>
            </button>

            {sectionIsExpanded('archive') ? (
              archiveTickets.length ? (
                <div className="mobileChatsList">
                  {archiveTickets.map((ticket) =>
                    renderTicketRow(ticket, `${mobilePath(location.pathname, `/chats/${ticket.id}`)}${location.search}`, 'archive'),
                  )}
                </div>
              ) : (
                <div className="mobileEmptyState mobileCard">
                  <p className="mobileEmptyStateTitle">{archiveEmptyTitle}</p>
                  <p className="mobileEmptyStateHint">{archiveEmptyHint}</p>
                </div>
              )
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}
