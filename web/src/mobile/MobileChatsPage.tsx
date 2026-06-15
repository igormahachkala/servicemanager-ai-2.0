import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
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
type ChatsView = 'active' | 'archive'
type ChatTab = 'chat' | 'info' | 'files' | 'history'

type UnifiedFeedEntry =
  | { kind: 'comment'; id: string; at: string; text: string; isOwn: boolean }
  | { kind: 'system'; key: string; at: string; text: string }

type ChatsListItem = api.TicketCard & {
  lastActivityAt: string
}

type ChatsObjectTicket = {
  id: string
  ticketNumber: number | null
  status: api.TicketStatus
  lastActivityAt: string
  href: string
  title: string
}

type ChatsObjectItem = {
  id: string
  title: string
  activeCount: number
  timeLabel: string
  lastActivityAt: string
  iconTone: string
  tickets: ChatsObjectTicket[]
}

type ChatsInternalItem = {
  id: string
  title: string
  preview: string
  timeLabel: string
  iconTone: string
}

type ChatsSectionId = 'tickets' | 'objects' | 'internal'

const ACTIVE_STATUSES = new Set<api.TicketStatus>(['NEW', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_ACCEPTANCE'])
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

function ticketChatTitle(ticket: api.TicketCard): string {
  return (ticket.title || ticket.description || ticket.category?.name || 'Без темы').trim()
}

function ticketChatPreview(ticket: api.TicketCard): string {
  return (ticket.description || 'Обсуждение по заявке').trim()
}

function ticketLocationLabel(ticket: api.TicketCard): string {
  return (ticket.location?.name || ticket.pointName || 'Без локации').trim()
}

function ticketStatusTone(status: api.TicketStatus): string {
  if (status === 'NEW') return 'orange'
  if (status === 'ASSIGNED') return 'blue'
  if (status === 'IN_PROGRESS') return 'violet'
  if (status === 'AWAITING_ACCEPTANCE') return 'orange'
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
  const [chatView, setChatView] = useState<ChatsView>('active')
  const [composerText, setComposerText] = useState('')
  const [composerError, setComposerError] = useState('')
  const [activeTab, setActiveTab] = useState<ChatTab>('chat')
  const [viewer, setViewer] = useState<{ items: PhotoViewerItem[]; index: number } | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Partial<Record<ChatsSectionId, boolean>>>({})
  const [expandedObjects, setExpandedObjects] = useState<Set<string>>(new Set())

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

  const filteredTickets = useMemo(() => {
    const q = normalizeSearchText(search)
    return allTickets.filter((ticket) => {
      if (chatView === 'active' && !ACTIVE_STATUSES.has(ticket.status)) return false
      if (chatView === 'archive' && !ARCHIVE_STATUSES.has(ticket.status)) return false
      if (filter === 'mine' && !isMineTicketForRole(ticket, me?.id, me?.role)) return false
      if (filter === 'active' && !ACTIVE_STATUSES.has(ticket.status)) return false
      if (filter === 'with_photo' && !ticketHasPhoto(ticket)) return false
      if (!q) return true
      return ticketSearchBlob(ticket).includes(q)
    })
  }, [allTickets, chatView, filter, me?.id, me?.role, search])

  const ticketRows = useMemo(() => {
    return filteredTickets.map((ticket) => ({
      ticket,
      href: `${mobilePath(location.pathname, `/chats/${ticket.id}`)}${location.search}`,
      preview: ticketChatPreview(ticket),
    }))
  }, [filteredTickets, location.pathname, location.search])

  const objectRows = useMemo<ChatsObjectItem[]>(() => {
    const q = normalizeSearchText(search)
    const map = new Map<
      string,
      { title: string; tickets: ChatsObjectTicket[]; iconTone: string; lastActivityAt: string }
    >()

    for (const ticket of filteredTickets) {
      const key = ticket.location?.id || ticket.location?.name || ticket.pointName || `ticket:${ticket.id}`
      const title = ticket.location?.name || ticket.pointName || ticket.location?.address || 'Без объекта'
      const lastActivityAt = ticket.lastActivityAt
      const ticketHref = `${mobilePath(location.pathname, `/chats/${ticket.id}`)}${location.search}`
      const ticketTitle = (ticket.title || ticket.description || ticket.category?.name || 'Без темы').trim()
      const current = map.get(key)
      const nextLastActivity = current && current.lastActivityAt > lastActivityAt ? current.lastActivityAt : lastActivityAt
      const nextTone = current && current.lastActivityAt >= lastActivityAt ? current.iconTone : ticketStatusTone(ticket.status)
      map.set(key, {
        title,
        tickets: [
          ...(current?.tickets || []),
          { id: ticket.id, ticketNumber: ticket.ticketNumber ?? null, status: ticket.status, lastActivityAt, href: ticketHref, title: ticketTitle },
        ],
        iconTone: nextTone,
        lastActivityAt: nextLastActivity,
      })
    }

    return Array.from(map.entries())
      .map(([id, item]) => ({
        id,
        title: item.title,
        activeCount: item.tickets.length,
        timeLabel: formatLastActivity(item.lastActivityAt),
        lastActivityAt: item.lastActivityAt,
        iconTone: item.iconTone,
        tickets: [...item.tickets].sort((a, b) => {
          const at = new Date(a.lastActivityAt).getTime()
          const bt = new Date(b.lastActivityAt).getTime()
          return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0)
        }),
      }))
      .filter((item) => {
        if (!q) return true
        const blob = normalizeSearchText([item.title, ...item.tickets.map((t) => t.title), String(item.activeCount)].join(' '))
        return blob.includes(q)
      })
      .sort((a, b) => {
        const at = new Date(a.lastActivityAt).getTime()
        const bt = new Date(b.lastActivityAt).getTime()
        return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0)
      })
  }, [filteredTickets, location.pathname, location.search, search])

  function toggleObjectExpanded(id: string) {
    setExpandedObjects((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const internalRows = useMemo<ChatsInternalItem[]>(() => {
    const rows: ChatsInternalItem[] = [
      { id: 'dispatch', title: 'Диспетчерская', preview: 'Внутренний чат', timeLabel: 'Сейчас', iconTone: 'violet' },
      { id: 'contractors', title: 'Подрядчики', preview: 'Чаты с подрядчиками', timeLabel: 'Скоро', iconTone: 'teal' },
    ]
    const q = normalizeSearchText(search)
    if (!q) return rows
    return rows.filter((row) => normalizeSearchText([row.title, row.preview, row.timeLabel].join(' ')).includes(q))
  }, [search])

  const searchQuery = normalizeSearchText(search)

  const sectionCounts = useMemo(
    () => ({ tickets: ticketRows.length, objects: objectRows.length, internal: internalRows.length }),
    [internalRows.length, objectRows.length, ticketRows.length],
  )

  const sectionDefaults = useMemo(
    () => ({ tickets: false, objects: sectionCounts.objects > 3, internal: true }),
    [sectionCounts.objects],
  )

  const sectionIsExpanded = (section: ChatsSectionId): boolean => {
    const hasSearchMatches = searchQuery.length > 0 && sectionCounts[section] > 0
    if (hasSearchMatches) return true
    const explicit = collapsedSections[section]
    if (typeof explicit === 'boolean') return !explicit
    return !sectionDefaults[section]
  }

  const toggleSection = (section: ChatsSectionId) => {
    const nextExpanded = !sectionIsExpanded(section)
    setCollapsedSections((current) => ({ ...current, [section]: !nextExpanded }))
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
    () => photoAttachments.map((a) => ({ src: api.resolveTicketAttachmentUrl(a), alt: a.originalName || a.filename || 'Фото' })),
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

  useEffect(() => {
    setFilter('all')
  }, [chatView])

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
        : ticketQ.error instanceof Error
          ? ticketQ.error.message
          : 'Не удалось загрузить чат.'
      return (
        <div className="mobileSection mobileChatsDialog">
          <div className="mobileChatsDialogHeader">
            <Link className="mobileChatsDialogBack" to={`${mobilePath(location.pathname, '/chats')}${location.search}`}>←</Link>
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
            <Link className="mobileChatsDialogBack" to={`${mobilePath(location.pathname, '/chats')}${location.search}`}>Назад</Link>
          </div>
        </div>
      )
    }

    const currentTicket = ticketQ.data
    const currentTicketTitle = ticketDetailTitle(currentTicket)
    const currentTicketStatus = mobileTicketStatusLabelRu(currentTicket.status)

    // Unified chronological feed: comments + system events merged and sorted by time
    const unifiedFeed: UnifiedFeedEntry[] = []
    for (const msg of chatMessages) {
      unifiedFeed.push({ kind: 'comment', id: msg.id, at: msg.at, text: msg.text, isOwn: msg.isOwn })
    }
    for (const item of timelineItems) {
      const isComment = item.type === 'ticket.comment_added' || item.timelineEvent === 'COMMENT_ADDED'
      if (!isComment) {
        unifiedFeed.push({
          kind: 'system',
          key: `${item.at}-${item.timelineEvent || item.type || item.title}`,
          at: item.at,
          text: item.title || 'Системное событие',
        })
      }
    }
    unifiedFeed.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

    const hasPhotos = photoAttachments.length > 0
    const composerDisabled = sendCommentM.isPending || !composerText.trim()

    return (
      <div className="mobileSection mobileChatsDialog">
        {viewer ? (
          <FullscreenPhotoViewer items={viewer.items} initialIndex={viewer.index} onClose={() => setViewer(null)} />
        ) : null}

        <div className="mobileChatsDialogHeader">
          <Link className="mobileChatsDialogBack" to={`${mobilePath(location.pathname, '/chats')}${location.search}`}>←</Link>
          <div className="mobileChatsDialogHeaderMain">
            <div className="mobileChatsDialogTitleRow">
              <h1 className="mobileChatsDialogTitle">{mobileTicketNumberTitle(currentTicket.ticketNumber)}</h1>
              <span className={`mobileTicketStatus mobileTicketStatus--${currentTicket.status}`}>{currentTicketStatus}</span>
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
              {unifiedFeed.length === 0 ? (
                <div className="mobileChatsSystemRow">
                  <div className="mobileChatsSystemPill">
                    <div className="mobileChatsSystemText">Заявка создана</div>
                    <div className="mobileChatsSystemTime">{formatLastActivity(currentTicket.createdAt)}</div>
                  </div>
                </div>
              ) : null}

              {unifiedFeed.map((entry) => {
                if (entry.kind === 'comment') {
                  const own = !!entry.isOwn
                  return (
                    <div className={`mobileChatsBubbleRow${own ? ' mobileChatsBubbleRow--own' : ''}`} key={entry.id}>
                      {!own ? <div className="mobileChatsAvatar" aria-hidden="true">💬</div> : null}
                      <div className={`mobileChatsBubble${own ? ' mobileChatsBubble--own' : ''}`}>
                        <div className="mobileChatsBubbleAuthor">
                          {own ? 'Вы' : currentTicket.requesterName || 'Клиент'}
                          <span>{own ? ' · Исполнитель' : ' · Заявка'}</span>
                        </div>
                        <div className="mobileChatsBubbleText">{entry.text}</div>
                        <div className="mobileChatsBubbleFooter">
                          <span>{formatLastActivity(entry.at)}</span>
                          {own ? <span className="mobileChatsBubbleRead">✓✓</span> : null}
                        </div>
                      </div>
                    </div>
                  )
                }
                return (
                  <div className="mobileChatsSystemRow" key={entry.key}>
                    <div className="mobileChatsSystemPill">
                      <div className="mobileChatsSystemText">{entry.text}</div>
                      <div className="mobileChatsSystemTime">{formatLastActivity(entry.at)}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {hasPhotos ? (
              <div className="mobileCard">
                <MobileTicketPhotoGallery
                  title="Фото"
                  photos={photoAttachments}
                  emptyText="Фото к заявке пока нет"
                  onOpen={(index) => setViewer({ index, items: photoViewerItems })}
                />
              </div>
            ) : null}

            <div className="mobileChatsComposer">
              <button className="mobileChatsComposerButton" type="button" aria-label="Вложение">+</button>
              <button className="mobileChatsComposerButton" type="button" aria-label="Фото">📷</button>
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
            <div className="mobileChatsSectionTitle" style={{ padding: 0, marginBottom: 8 }}>Информация</div>
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
              onOpen={(index) => setViewer({ index, items: photoViewerItems })}
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

  const emptyTitle =
    chatView === 'archive'
      ? 'Нет архивных чатов'
      : (boardQ.data?.columns || []).some((col) => (col.cards || []).length > 0)
        ? 'Нет заявок по фильтру'
        : 'Заявок пока нет'
  const emptyHint =
    chatView === 'archive'
      ? 'Завершённые и отменённые заявки появятся здесь.'
      : filteredTickets.length === 0 && allTickets.length > 0
        ? 'Измените поиск или фильтр, чтобы увидеть чаты.'
        : 'Когда заявки появятся, они отобразятся здесь как чаты по заявкам.'

  const visibleFilters = chatView === 'archive' ? CHAT_FILTERS.filter((f) => f.id !== 'active') : CHAT_FILTERS

  return (
    <div className="mobileSection mobileChatsScreen">
      <div className="mobileChatsTop">
        <div>
          <h1 className="mobileTitle mobileChatsAppTitle">Чаты</h1>
          <div className="mobileSubtitle">
            {chatView === 'active' ? 'Разговоры по заявкам, объектам и внутренним группам' : 'Завершённые и отменённые заявки'}
          </div>
        </div>

        <div className="mobileScreenTabs">
          <button
            type="button"
            className={`mobileScreenTab${chatView === 'active' ? ' mobileScreenTab--active' : ''}`}
            onClick={() => setChatView('active')}
          >
            Активные
          </button>
          <button
            type="button"
            className={`mobileScreenTab${chatView === 'archive' ? ' mobileScreenTab--active' : ''}`}
            onClick={() => setChatView('archive')}
          >
            Архив
          </button>
        </div>

        <div className="mobileChatsSearchRow">
          <input
            className="mobileChatsSearchInput"
            placeholder="Поиск по заявкам, локациям и статусам"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mobileChatsFilters" role="tablist" aria-label="Фильтры чатов">
          {visibleFilters.map((item) => (
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
      </div>

      <div className="mobileChatsSections">
        <section className="mobileChatsSection" aria-label="Заявки">
          <button
            type="button"
            className="mobileChatsSectionHeader"
            aria-expanded={sectionIsExpanded('tickets')}
            onClick={() => toggleSection('tickets')}
          >
            <span className="mobileChatsSectionHeaderLabel">Заявки</span>
            <span className="mobileChatsSectionHeaderMeta">
              <span className="mobileChatsSectionHeaderCount">{sectionCounts.tickets}</span>
              <span className={`mobileChatsSectionHeaderChevron${sectionIsExpanded('tickets') ? ' mobileChatsSectionHeaderChevron--open' : ''}`}>▼</span>
            </span>
          </button>

          {sectionCounts.tickets === 0 ? (
            <div className="mobileEmptyState mobileCard">
              <p className="mobileEmptyStateTitle">{emptyTitle}</p>
              <p className="mobileEmptyStateHint">{emptyHint}</p>
              {search || filter !== 'all' ? (
                <button type="button" className="mobileChatsDialogBack" onClick={() => { setSearch(''); setFilter('all') }}>
                  Сбросить
                </button>
              ) : null}
            </div>
          ) : sectionIsExpanded('tickets') ? (
            <div className="mobileChatsList">
              {ticketRows.map(({ ticket, href, preview }) => (
                <Link key={ticket.id} className="mobileChatsItem" to={href}>
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
                    <div className="mobileChatsItemPreview">{preview}</div>
                    <div className="mobileChatsItemMeta">
                      <div className="mobileChatsItemMetaLeft">{ticketLocationLabel(ticket)}</div>
                      <div className="mobileChatsItemMetaRight">
                        {ticketHasPhoto(ticket) ? <span className="mobileChatsPhotoChip">Фото</span> : null}
                        <span className={`mobileTicketStatus mobileTicketStatus--${ticket.status}`}>
                          {mobileTicketStatusLabelRu(ticket.status)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mobileChatsSection" aria-label="Объекты">
          <button
            type="button"
            className="mobileChatsSectionHeader"
            aria-expanded={sectionIsExpanded('objects')}
            onClick={() => toggleSection('objects')}
          >
            <span className="mobileChatsSectionHeaderLabel">Объекты</span>
            <span className="mobileChatsSectionHeaderMeta">
              <span className="mobileChatsSectionHeaderCount">{sectionCounts.objects}</span>
              <span className={`mobileChatsSectionHeaderChevron${sectionIsExpanded('objects') ? ' mobileChatsSectionHeaderChevron--open' : ''}`}>▼</span>
            </span>
          </button>

          {sectionCounts.objects === 0 ? (
            <div className="mobileEmptyState mobileCard">
              <p className="mobileEmptyStateTitle">Объекты не найдены</p>
              <p className="mobileEmptyStateHint">По текущему фильтру нет заявок, сгруппированных по объектам.</p>
            </div>
          ) : sectionIsExpanded('objects') ? (
            <div className="mobileChatsList">
              {objectRows.map((item) => {
                const isExpanded = expandedObjects.has(item.id)
                return (
                  <div key={item.id} className="mobileChatsObjectGroup">
                    <button
                      type="button"
                      className="mobileChatsItem mobileChatsItem--object mobileChatsItem--accordion"
                      onClick={() => toggleObjectExpanded(item.id)}
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
                          </div>
                        </div>
                        <div className="mobileChatsItemPreview mobileChatsItemPreview--strong">
                          {chatView === 'active' ? `${item.activeCount} активных заявок` : `${item.activeCount} в архиве`}
                        </div>
                      </div>
                      <span className={`mobileChatsSectionHeaderChevron mobileChatsObjectChevron${isExpanded ? ' mobileChatsSectionHeaderChevron--open' : ''}`}>▼</span>
                    </button>
                    {isExpanded ? (
                      <div className="mobileChatsObjectTickets">
                        {item.tickets.map((t) => (
                          <Link key={t.id} className="mobileChatsObjectTicketRow" to={t.href}>
                            <span className={`mobileChatsIndicator mobileChatsIndicator--${t.status}`} />
                            <span className="mobileChatsObjectTicketTitle">{mobileTicketNumberTitle(t.ticketNumber)}</span>
                            <span className="mobileChatsObjectTicketSubtitle">{t.title}</span>
                            <span className="mobileChatsObjectTicketTime">{formatLastActivity(t.lastActivityAt)}</span>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}
        </section>

        {chatView === 'active' ? (
          <section className="mobileChatsSection" aria-label="Внутренние">
            <button
              type="button"
              className="mobileChatsSectionHeader"
              aria-expanded={sectionIsExpanded('internal')}
              onClick={() => toggleSection('internal')}
            >
              <span className="mobileChatsSectionHeaderLabel">Внутренние</span>
              <span className="mobileChatsSectionHeaderMeta">
                <span className="mobileChatsSectionHeaderCount">{sectionCounts.internal}</span>
                <span className={`mobileChatsSectionHeaderChevron${sectionIsExpanded('internal') ? ' mobileChatsSectionHeaderChevron--open' : ''}`}>▼</span>
              </span>
            </button>

            {sectionCounts.internal === 0 ? (
              <div className="mobileEmptyState mobileCard">
                <p className="mobileEmptyStateTitle">Ничего не найдено</p>
                <p className="mobileEmptyStateHint">Попробуйте другой поисковый запрос.</p>
              </div>
            ) : sectionIsExpanded('internal') ? (
              <div className="mobileChatsList">
                {internalRows.map((item) => (
                  <div key={item.id} className="mobileChatsItem mobileChatsItem--static" aria-disabled="true">
                    <div className={`mobileChatsRoomIcon mobileChatsRoomIcon--${item.iconTone}`} aria-hidden="true">
                      <span className="mobileChatsRoomIconEmoji">{item.id === 'dispatch' ? '👥' : '🤝'}</span>
                    </div>
                    <div className="mobileChatsItemBody">
                      <div className="mobileChatsItemTop">
                        <div className="mobileChatsItemTitle">{item.title}</div>
                        <div className="mobileChatsItemTime">{item.timeLabel}</div>
                      </div>
                      <div className="mobileChatsItemPreview mobileChatsItemPreview--strong">{item.preview}</div>
                      <div className="mobileChatsItemPreview mobileChatsItemPreview--muted">Внутренний контур</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}
