import { useState, useEffect, useCallback, useRef } from 'react'
import { IconChevronLeft, IconSend } from '@tabler/icons-react'
import * as api from '../api/client'
import { timelineEventFromApi, ticketStatusLabel, type ChatItem } from '../api/mappers'

function fmtTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function shortAuthor(email: string | null): string {
  if (!email) return 'Система'
  return email.split('@')[0]
}

// Тред заявки: timeline → пузыри сообщений + системные строки; отправка через POST /comments.
export function ChatDetailScreen({ ticketId, ticketTitle, currentUserId, onBack }: {
  ticketId: string
  ticketTitle: string
  currentUserId: string | null
  onBack: () => void
}) {
  const [items, setItems] = useState<ChatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = () => { requestAnimationFrame(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight }) }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const r = await api.getTicketTimeline(ticketId)
      const list = Array.isArray(r?.timeline) ? r.timeline : []
      setItems(list.map(timelineEventFromApi))
      scrollToBottom()
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить чат')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [ticketId])
  useEffect(() => { load() }, [load])

  async function send() {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    try {
      await api.addComment(ticketId, t)
      setText('')
      await load(true) // рефетч ленты
    } catch (e: any) {
      setError(e?.message || 'Не удалось отправить')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="bg-white border-b border-slate-100 flex-shrink-0 flex items-center gap-2 px-3 py-2.5">
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 active:bg-slate-200"><IconChevronLeft size={18} className="text-slate-700" /></button>
        <h1 className="text-[14px] font-bold text-slate-900 truncate">{ticketTitle}</h1>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50 flex flex-col gap-2" style={{ scrollbarWidth: 'none' }}>
        {loading && <div className="flex flex-col items-center gap-2 py-12"><span className="text-[28px] animate-pulse">⏳</span><p className="text-[13px] text-slate-500">Загрузка…</p></div>}
        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-10">
            <span className="text-[36px]">⚠️</span>
            <p className="text-[13px] text-slate-600 text-center px-6">{error}</p>
            <button onClick={() => load()} className="text-[12px] font-bold text-white bg-blue-600 px-4 py-2 rounded-xl">Повторить</button>
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12"><span className="text-[32px]">💬</span><p className="text-[13px] text-slate-500">Сообщений пока нет</p></div>
        )}
        {!loading && !error && items.map((it, i) => {
          if (it.type === 'comment') {
            const mine = !!currentUserId && it.authorId === currentUserId
            return (
              <div key={i} className={`flex flex-col max-w-[80%] ${mine ? 'self-end items-end' : 'self-start items-start'}`}>
                {!mine && <span className="text-[10px] text-slate-400 mb-0.5 px-1">{shortAuthor(it.author)}</span>}
                <div className={`px-3.5 py-2 rounded-2xl text-[13px] leading-snug ${mine ? 'bg-blue-600 text-white rounded-br-md' : 'bg-slate-100 text-slate-800 rounded-bl-md'}`}>{it.text}</div>
                <span className="text-[9px] text-slate-300 mt-0.5 px-1">{fmtTime(it.at)}</span>
              </div>
            )
          }
          if (it.type === 'status') {
            return <p key={i} className="self-center text-[11px] text-slate-400 py-1">Статус: {it.from ? ticketStatusLabel(it.from) + ' → ' : ''}{ticketStatusLabel(it.to || '')} · {fmtTime(it.at)}</p>
          }
          if (it.type === 'created') {
            return <p key={i} className="self-center text-[11px] text-slate-400 py-1">Заявка создана · {fmtTime(it.at)}</p>
          }
          return <p key={i} className="self-center text-[11px] text-slate-400 py-1">{it.title} · {fmtTime(it.at)}</p>
        })}
      </div>

      <div className="flex-shrink-0 bg-white border-t border-slate-100 px-3 py-2.5 flex items-center gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          placeholder="Сообщение…"
          className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-[13px] text-slate-800 outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button onClick={send} disabled={sending || text.trim().length === 0} className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-95 transition-transform">
          <IconSend size={18} className="text-white" />
        </button>
      </div>
    </div>
  )
}

export default ChatDetailScreen
