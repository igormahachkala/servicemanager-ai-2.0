import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'
import { toChatMessages } from '../lib/ticketChat'
import { mobilePath } from './mobileRoute'

function formatRealChatTime(at: string): string {
  try {
    const d = new Date(at)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

type ChatKind = 'ticket' | 'object' | 'company' | 'private'
type ChatFilter = 'all' | 'unread' | ChatKind

type ChatMessage = {
  id: string
  author: string
  role: string
  text: string
  time: string
  own?: boolean
  system?: boolean
  photo?: boolean
}

type ChatThread = {
  headerTitle: string
  headerSubtitle: string
  ticketLinkLabel: string
  ticketLinkId: string
  relationLabel: string
  relationHint: string
  messages: ChatMessage[]
  photoLabel?: string
}

type ChatRoom = {
  id: string
  section: 'Заявки' | 'Объекты' | 'Компания'
  kind: ChatKind
  color: 'orange' | 'blue' | 'teal' | 'violet' | 'green'
  icon: string
  title: string
  preview: string
  speaker: string
  time: string
  unread: number
  meta: string
  pinned?: boolean
  thread: ChatThread
}

const MOCK_THREADS: Record<string, ChatThread> = {
  '251': {
    headerTitle: 'Заявка #251',
    headerSubtitle: 'Не работает кондиционер',
    ticketLinkLabel: 'Открыть заявку',
    ticketLinkId: '251',
    relationLabel: 'Заявка #251 · ТЦ Мега',
    relationHint: 'Чат привязан к заявке, фото и история видны в одном месте.',
    photoLabel: 'Фото наружного блока',
    messages: [
      { id: 'm1', author: 'Иван (Клиент)', role: 'Клиент', text: 'Добрый день. Кондиционер не охлаждает, дует тёплым воздухом.', time: '10:32' },
      { id: 'm2', author: 'Петров (Исполнитель)', role: 'Исполнитель', text: 'Добрый день! Принял заявку, выезжаю.', time: '10:35', own: true },
      { id: 's1', author: 'Система', role: 'Событие', text: 'Заявка взята в работу', time: '10:35', system: true },
      { id: 'm3', author: 'Иван (Клиент)', role: 'Клиент', text: 'Хорошо, жду.', time: '10:36' },
      { id: 'm4', author: 'Иван (Клиент)', role: 'Клиент', text: 'Вот фото наружного блока.', time: '11:25', photo: true },
      { id: 'm5', author: 'Петров (Исполнитель)', role: 'Исполнитель', text: 'Понял, проблема в компрессоре. Заказываю запчасть.', time: '11:27', own: true },
      { id: 'm6', author: 'Иван (Клиент)', role: 'Клиент', text: 'Хорошо, спасибо!', time: '11:28' },
    ],
  },
  '248': {
    headerTitle: 'Заявка #248',
    headerSubtitle: 'Протечка в санузле',
    ticketLinkLabel: 'Открыть заявку',
    ticketLinkId: '248',
    relationLabel: 'Заявка #248 · Ленина 5',
    relationHint: 'Сообщения, фото и договорённости по заявке собраны в одном чате.',
    photoLabel: 'Фото протечки',
    messages: [
      { id: 'm1', author: 'Клиент', role: 'Клиент', text: 'Вода течёт из-под раковины.', time: '09:12' },
      { id: 'm2', author: 'Петров', role: 'Исполнитель', text: 'Принял. Буду через 20 минут.', time: '09:14', own: true },
      { id: 's1', author: 'Система', role: 'Событие', text: 'Статус изменён: ASSIGNED → IN_PROGRESS', time: '09:15', system: true },
      { id: 'm3', author: 'Клиент', role: 'Клиент', text: 'Спасибо, жду.', time: '09:16' },
    ],
  },
  '243': {
    headerTitle: 'ТЦ Мега',
    headerSubtitle: 'Групповой чат объекта',
    ticketLinkLabel: 'Открыть объект',
    ticketLinkId: '243',
    relationLabel: 'Объект · ТЦ Мега',
    relationHint: 'Внутри объекта обсуждают несколько заявок и общие вопросы доступа.',
    messages: [
      { id: 'm1', author: 'Диспетчер', role: 'Диспетчер', text: 'Доброе утро, у объекта сегодня плановый обход.', time: '08:05' },
      { id: 'm2', author: 'Анна', role: 'Сотрудник', text: 'Нужен водитель на 11:00.', time: '08:11' },
      { id: 'm3', author: 'Иван', role: 'Клиент', text: 'Фото отправил в карточку заявки #243.', time: '08:19', photo: true },
    ],
  },
  '241': {
    headerTitle: 'Диспетчерская',
    headerSubtitle: 'Внутренняя группа компании',
    ticketLinkLabel: 'Открыть чат',
    ticketLinkId: '241',
    relationLabel: 'Компания · Диспетчерская',
    relationHint: 'Внутренний чат для коротких операционных сообщений.',
    messages: [
      { id: 'm1', author: 'Анна', role: 'Сотрудник', text: 'Нужен водитель сегодня.', time: '09:41' },
      { id: 'm2', author: 'Сергей', role: 'Сотрудник', text: 'Понял, передал на смену.', time: '09:43', own: true },
      { id: 'm3', author: 'Система', role: 'Событие', text: 'Уведомление прочитано 3 участниками', time: '09:44', system: true },
    ],
  },
  'team-1': {
    headerTitle: 'Техподдержка',
    headerSubtitle: 'Чат подрядчика',
    ticketLinkLabel: 'Открыть заявку',
    ticketLinkId: '251',
    relationLabel: 'Подрядчик · Техподдержка',
    relationHint: 'Подрядчики видят только свои заявки и связанные фото/отчёты.',
    messages: [
      { id: 'm1', author: 'Координатор', role: 'Координатор', text: 'Нужен выезд на объект до 15:00.', time: '12:04' },
      { id: 'm2', author: 'Подрядчик', role: 'Подрядчик', text: 'Принял, специалист уже в пути.', time: '12:08', own: true },
    ],
  },
}

const STATIC_ROOMS: ChatRoom[] = [
  {
    id: '251',
    section: 'Заявки',
    kind: 'ticket',
    color: 'orange',
    icon: '🛠',
    title: 'Не работает кондиционер',
    preview: 'Иван: Фото отправил',
    speaker: 'Иван',
    time: '13:42',
    unread: 2,
    meta: 'ТЦ Мега',
    pinned: true,
    thread: MOCK_THREADS['251'],
  },
  {
    id: '248',
    section: 'Заявки',
    kind: 'ticket',
    color: 'blue',
    icon: '💧',
    title: 'Протечка в санузле',
    preview: 'Петров: Выезжаю на объект',
    speaker: 'Петров',
    time: '12:15',
    unread: 1,
    meta: 'Ленина 5',
    thread: MOCK_THREADS['248'],
  },
  {
    id: '243',
    section: 'Объекты',
    kind: 'object',
    color: 'teal',
    icon: '🏢',
    title: 'ТЦ Мега',
    preview: 'Диспетчер: Всем доброе утро!',
    speaker: 'Диспетчер',
    time: 'Пн',
    unread: 0,
    meta: 'Группа объектов',
    thread: MOCK_THREADS['243'],
  },
  {
    id: '241',
    section: 'Компания',
    kind: 'company',
    color: 'violet',
    icon: '👥',
    title: 'Диспетчерская',
    preview: 'Анна: Нужен водитель сегодня',
    speaker: 'Анна',
    time: 'Пн',
    unread: 3,
    meta: 'Внутренняя группа',
    thread: MOCK_THREADS['241'],
  },
  {
    id: 'team-1',
    section: 'Компания',
    kind: 'private',
    color: 'green',
    icon: '💬',
    title: 'Техподдержка',
    preview: 'Координатор: Нужен выезд до 15:00',
    speaker: 'Координатор',
    time: '10:03',
    unread: 0,
    meta: 'Чат подрядчика',
    thread: MOCK_THREADS['team-1'],
  },
]

const FILTERS: Array<{ id: ChatFilter; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'unread', label: 'Непрочит.' },
  { id: 'ticket', label: 'Заявки' },
  { id: 'object', label: 'Объекты' },
  { id: 'company', label: 'Компания' },
]

const MOCK_PHOTO_SRC =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 360">
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0" stop-color="#dfe7ef"/>
          <stop offset="1" stop-color="#f8fafc"/>
        </linearGradient>
      </defs>
      <rect width="540" height="360" rx="24" fill="url(#g)"/>
      <rect x="108" y="68" width="324" height="236" rx="18" fill="#f3f4f6" stroke="#cbd5e1" stroke-width="4"/>
      <circle cx="270" cy="186" r="64" fill="#fff" stroke="#94a3b8" stroke-width="10"/>
      <circle cx="270" cy="186" r="22" fill="#e2e8f0"/>
      <path d="M270 122c16 10 28 30 28 64s-12 54-28 64c-16-10-28-30-28-64s12-54 28-64Z" fill="#cbd5e1"/>
      <path d="M206 186c10-16 30-28 64-28s54 12 64 28c-10 16-30 28-64 28s-54-12-64-28Z" fill="#cbd5e1"/>
      <rect x="95" y="41" width="350" height="286" rx="24" fill="none" stroke="#cbd5e1" stroke-width="4" opacity="0.45"/>
    </svg>
  `)

function roomToneClass(color: ChatRoom['color']): string {
  return `mobileChatsRoomIcon mobileChatsRoomIcon--${color}`
}

function roomMatchesFilter(room: ChatRoom, filter: ChatFilter, search: string): boolean {
  const query = search.trim().toLowerCase()
  const haystack = [room.title, room.preview, room.meta, room.speaker, room.thread.headerSubtitle, room.thread.headerTitle]
    .join(' ')
    .toLowerCase()
  const filterOk =
    filter === 'all' ||
    (filter === 'unread' ? room.unread > 0 : room.kind === filter)
  return filterOk && (!query || haystack.includes(query))
}

function fmtSectionTitle(section: ChatRoom['section']): string {
  return section
}

export function MobileChatsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams()
  const ticketId = (params.ticketId || '').trim()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ChatFilter>('all')
  const [composerText, setComposerText] = useState('')
  const [composerError, setComposerError] = useState('')

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const queryClient = useQueryClient()
  const chatScope = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    return {
      linkedClientCompanyId: (sp.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim() || undefined,
      companyId: (sp.get('companyId') || api.getObserverCompanyId(meQ.data)).trim() || undefined,
    }
  }, [location.search, meQ.data])
  const timelineQ = useQuery({
    queryKey: ['mobile-chats-timeline', ticketId, chatScope.linkedClientCompanyId, chatScope.companyId],
    queryFn: () => api.timeline(ticketId, chatScope),
    enabled: !!ticketId,
  })
  const sendM = useMutation({
    mutationFn: (text: string) => api.addTicketComment(ticketId, text, chatScope),
    onMutate: () => setComposerError(''),
    onSuccess: async () => {
      setComposerText('')
      await queryClient.invalidateQueries({ queryKey: ['mobile-chats-timeline', ticketId] })
    },
    onError: (e: any) => setComposerError(e?.message || 'Не удалось отправить сообщение'),
  })

  const selectedRoom = useMemo(() => {
    if (!ticketId) return null
    return STATIC_ROOMS.find((room) => room.id === ticketId) || STATIC_ROOMS[0]
  }, [ticketId])

  const filteredRooms = useMemo(() => {
    return STATIC_ROOMS.filter((room) => roomMatchesFilter(room, filter, search))
  }, [filter, search])

  const sections = useMemo(() => {
    const ordered: ChatRoom['section'][] = ['Заявки', 'Объекты', 'Компания']
    return ordered
      .map((section) => ({
        section,
        rooms: filteredRooms.filter((room) => room.section === section),
      }))
      .filter((entry) => entry.rooms.length > 0)
  }, [filteredRooms])

  const activeRoom = selectedRoom ? { ...selectedRoom, thread: selectedRoom.thread } : null
  // SMA-CHAT-127: реальные сообщения = комментарии заявки из timeline.
  const threadMessages = useMemo<ChatMessage[]>(() => {
    const items = timelineQ.data?.timeline || timelineQ.data?.items || []
    return toChatMessages(items, meQ.data?.id ?? '').map((m, i) => ({
      id: m.id || `msg-${i}`,
      author: m.isOwn ? 'Вы' : (m.authorEmail || 'Участник'),
      role: '',
      text: m.text,
      time: formatRealChatTime(m.at),
      own: m.isOwn,
    }))
  }, [timelineQ.data, meQ.data?.id])

  function openRoom(room: ChatRoom) {
    navigate(mobilePath(location.pathname, `/chats/${room.id}`))
  }

  function sendLocalMessage() {
    const trimmed = composerText.trim()
    if (!trimmed || !ticketId || sendM.isPending) return
    sendM.mutate(trimmed)
  }

  if (ticketId && activeRoom) {
    return (
      <div className="mobileSection mobileChatsDialog">
        <div className="mobileChatsDialogHeader">
          <Link to={mobilePath(location.pathname, '/chats')} className="mobileChatsDialogBack">
            ←
          </Link>
          <div className="mobileChatsDialogHeaderMain">
            <div className="mobileChatsDialogTitleRow">
              <h1 className="mobileChatsDialogTitle">{activeRoom.thread.headerTitle}</h1>
              <span className="mobileChatsStatusDot" aria-hidden />
            </div>
            <div className="mobileChatsDialogSubtitle">{activeRoom.thread.headerSubtitle}</div>
          </div>
          <button type="button" className="mobileChatsDialogMenu" aria-label="Меню">
            ⋯
          </button>
        </div>

        <div className="mobileChatsDialogTabs" role="tablist" aria-label="Разделы чата">
          <button type="button" className="mobileChatsDialogTab mobileChatsDialogTab--active" aria-selected="true">
            Чат
          </button>
          <button type="button" className="mobileChatsDialogTab" aria-selected="false">
            Инфо
          </button>
          <button type="button" className="mobileChatsDialogTab" aria-selected="false">
            Файлы
          </button>
          <button type="button" className="mobileChatsDialogTab" aria-selected="false">
            История
          </button>
        </div>

        <div className="mobileChatsRelationCard">
          <div className="mobileChatsRelationTop">
            <div className="mobileChatsRelationLabel">{activeRoom.thread.relationLabel}</div>
            <Link to={mobilePath(location.pathname, `/tickets/${activeRoom.thread.ticketLinkId}`)} className="mobileChatsRelationLink">
              {activeRoom.thread.ticketLinkLabel}
            </Link>
          </div>
          <div className="mobileChatsRelationHint">{activeRoom.thread.relationHint}</div>
        </div>

        <div className="mobileChatsDatePill">12 июня</div>

        <div className="mobileChatsMessages">
          {timelineQ.isError ? (
            <div className="mobileNotice mobileNoticeError">Не удалось загрузить сообщения.</div>
          ) : null}
          {timelineQ.isLoading && threadMessages.length === 0 ? (
            <div className="mobileMeta" style={{ textAlign: 'center' }}>Загрузка сообщений…</div>
          ) : null}
          {!timelineQ.isLoading && !timelineQ.isError && threadMessages.length === 0 ? (
            <div className="mobileMeta" style={{ textAlign: 'center' }}>Пока нет сообщений. Напишите первое.</div>
          ) : null}
          {threadMessages.map((msg) => {
            if (msg.system) {
              return (
                <div key={msg.id} className="mobileChatsSystemRow">
                  <div className="mobileChatsSystemPill">
                    <div className="mobileChatsSystemText">{msg.text}</div>
                    <div className="mobileChatsSystemTime">{msg.time}</div>
                  </div>
                </div>
              )
            }

            const own = !!msg.own
            return (
              <div key={msg.id} className={own ? 'mobileChatsBubbleRow mobileChatsBubbleRow--own' : 'mobileChatsBubbleRow'}>
                {!own ? <div className="mobileChatsAvatar">{msg.author.slice(0, 1).toUpperCase()}</div> : null}
                <div className={own ? 'mobileChatsBubble mobileChatsBubble--own' : 'mobileChatsBubble'}>
                  <div className="mobileChatsBubbleAuthor">{msg.author} <span>{msg.role}</span></div>
                  <div className="mobileChatsBubbleText">{msg.text}</div>
                  {msg.photo ? (
                    <div className="mobileChatsPhotoBlock">
                      <div className="mobileChatsPhotoPreview" style={{ backgroundImage: `url(${MOCK_PHOTO_SRC})` }} aria-label={activeRoom.thread.photoLabel || 'Фото'} role="img" />
                      <div className="mobileChatsPhotoCaption">{activeRoom.thread.photoLabel || 'Фото'}</div>
                    </div>
                  ) : null}
                  <div className="mobileChatsBubbleFooter">
                    <span className="mobileChatsBubbleTime">{msg.time}</span>
                    {own ? <span className="mobileChatsBubbleRead">✓✓</span> : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {composerError ? (
          <div className="mobileNotice mobileNoticeError" style={{ margin: '0 12px 6px' }}>{composerError}</div>
        ) : null}
        <div className="mobileChatsComposer">
          <button type="button" className="mobileChatsComposerButton" aria-label="Вложение">＋</button>
          <button type="button" className="mobileChatsComposerButton" aria-label="Фото">📷</button>
          <textarea
            className="mobileChatsComposerInput"
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendLocalMessage()
              }
            }}
            placeholder="Сообщение..."
            rows={1}
            disabled={sendM.isPending}
          />
          <button
            type="button"
            className="mobileChatsComposerSend"
            onClick={sendLocalMessage}
            disabled={!composerText.trim() || sendM.isPending}
          >
            {sendM.isPending ? '…' : '➤'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mobileSection mobileChatsScreen">
      <div className="mobileChatsTop">
        <div className="mobileChatsAppTitleRow">
          <h1 className="mobileTitle mobileChatsAppTitle">Чаты</h1>
        </div>
        <div className="mobileChatsSearchRow">
          <input
            className="mobileChatsSearchInput"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по чату, заявке, объекту"
            aria-label="Поиск по чатам"
          />
        </div>
      </div>

      <div className="mobileChatsFilters" role="tablist" aria-label="Фильтры чатов">
        {FILTERS.map((item) => {
          const active = filter === item.id
          return (
            <button
              key={item.id}
              type="button"
              className={active ? 'mobileChatsFilterChip mobileChatsFilterChip--active' : 'mobileChatsFilterChip'}
              aria-selected={active}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <div className="mobileChatsHintCard mobileCard">
        Чаты скоро появятся. Пока это визуальный MVP: заявки, объекты, компания и подрядчики.
      </div>

      <div className="mobileChatsSections">
        {sections.map((group) => (
          <section key={group.section} className="mobileChatsSection">
            <div className="mobileChatsSectionTitle">{fmtSectionTitle(group.section)}</div>
            <div className="mobileChatsList">
              {group.rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  className="mobileChatsRow"
                  onClick={() => openRoom(room)}
                >
                  <div className={roomToneClass(room.color)} aria-hidden>
                    <span className="mobileChatsRoomIconEmoji">{room.icon}</span>
                  </div>
                  <div className="mobileChatsRowBody">
                    <div className="mobileChatsRowTop">
                      <div className="mobileChatsRowTitle">
                        {room.kind === 'ticket' ? `Заявка #${room.id}` : room.title}
                      </div>
                      <div className="mobileChatsRowTime">{room.time}</div>
                    </div>
                    <div className="mobileChatsRowMiddle">{room.title}</div>
                    <div className="mobileChatsRowBottom">
                      <div className="mobileChatsRowPreview">
                        <span className="mobileChatsRowSpeaker">{room.speaker}:</span> {room.preview}
                      </div>
                      {room.unread > 0 ? <span className="mobileChatsUnread">{room.unread}</span> : null}
                    </div>
                    <div className="mobileChatsRowMeta">{room.meta}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
