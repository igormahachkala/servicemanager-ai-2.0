import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../lib/ticketChat'

type Props = {
  messages: ChatMessage[]
  loading: boolean
  canSend: boolean
  onSend: (text: string) => Promise<void>
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export function TicketChatPanel({ messages, loading, canSend, onSend }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSendError(null)
    setSending(true)
    try {
      await onSend(trimmed)
      setText('')
    } catch (e: any) {
      setSendError(e?.message || String(e))
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="panel uiCard" style={{ marginBottom: 12, display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ marginBottom: 10, flexShrink: 0 }}>Чат заявки</h3>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxHeight: 400,
          overflowY: 'auto',
          marginBottom: 12,
          paddingRight: 4,
        }}
      >
        {loading ? (
          <div className="muted small">Загрузка…</div>
        ) : messages.length === 0 ? (
          <div className="muted small">Комментариев пока нет</div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.isOwn ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '75%',
                  background: msg.isOwn ? '#4f46e5' : '#f3f4f6',
                  color: msg.isOwn ? '#fff' : '#111827',
                  borderRadius: msg.isOwn ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  padding: '8px 12px',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.9rem',
                }}
              >
                {msg.text}
              </div>
              <div className="muted small" style={{ marginTop: 2, fontSize: '0.72rem' }}>
                {msg.authorEmail || 'система'} · {fmt(msg.at)}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {canSend && (
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Написать комментарий… (Ctrl+Enter для отправки)"
            disabled={sending}
            rows={2}
            style={{
              flex: 1,
              resize: 'vertical',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              padding: '8px 10px',
              fontSize: '0.9rem',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !text.trim()}
            style={{ alignSelf: 'flex-end', flexShrink: 0 }}
          >
            {sending ? 'Отправка…' : 'Отправить'}
          </button>
        </div>
      )}

      {sendError && (
        <div className="alert" style={{ marginTop: 8 }}>
          {sendError}
        </div>
      )}
    </div>
  )
}
