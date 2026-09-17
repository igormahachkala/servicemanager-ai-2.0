import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { AddTicketCommentOptions } from '../../lib/api'
import type { ChatMessage } from '../../lib/ticketChat'
import {
  buildAddTicketCommentOptions,
  canReplyToChatMessage,
  messageReplyContext,
  replyPreviewPresentation,
  selectReplyTarget,
} from '../../lib/ticketReplyUi'

type Props = {
  messages: ChatMessage[]
  loading: boolean
  canSend: boolean
  onSend: (text: string, options?: AddTicketCommentOptions) => Promise<void>
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
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null)
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
      await onSend(trimmed, buildAddTicketCommentOptions(replyTarget))
      setText('')
      setReplyTarget(null)
    } catch (e: any) {
      setSendError(e?.message || String(e))
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleReply(message: ChatMessage) {
    setReplyTarget(selectReplyTarget(message, canSend))
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
          messages.map((msg) => {
            if (msg.kind === 'system') {
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: 'center' }}>
                  <div
                    style={{
                      maxWidth: '85%',
                      background: '#f3f4f6',
                      color: '#374151',
                      borderRadius: 999,
                      padding: '8px 12px',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.85rem',
                      textAlign: 'center',
                      lineHeight: 1.4,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{msg.text}</div>
                    <div className="muted small" style={{ marginTop: 2, fontSize: '0.72rem' }}>
                      {fmt(msg.at)}
                    </div>
                  </div>
                </div>
              )
            }

            const replyTo = msg.replyTo ? replyPreviewPresentation(msg.replyTo) : null
            const authorContext = messageReplyContext(msg)
            const canReply = canReplyToChatMessage(msg, canSend)

            return (
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
                  {replyTo && (
                    <div
                      style={{
                        borderLeft: `3px solid ${msg.isOwn ? 'rgba(255,255,255,0.65)' : '#9ca3af'}`,
                        paddingLeft: 8,
                        marginBottom: 8,
                        opacity: replyTo.unavailable ? 0.85 : 1,
                      }}
                    >
                      {replyTo.author && (
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 2 }}>{replyTo.author}</div>
                      )}
                      <div style={{ fontSize: '0.82rem' }}>{replyTo.preview}</div>
                    </div>
                  )}
                  {msg.text}
                </div>
                <div
                  className="muted small"
                  style={{
                    marginTop: 2,
                    fontSize: '0.72rem',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    justifyContent: msg.isOwn ? 'flex-end' : 'flex-start',
                  }}
                >
                  <span>
                    {authorContext.author} · {fmt(msg.at)}
                  </span>
                  {canReply && (
                    <button
                      type="button"
                      onClick={() => handleReply(msg)}
                      style={{
                        border: 0,
                        background: 'transparent',
                        color: '#4f46e5',
                        padding: 0,
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                      }}
                    >
                      Ответить
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {canSend && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          {replyTarget && (
            <div
              style={{
                border: '1px solid #dbeafe',
                background: '#eff6ff',
                borderRadius: 8,
                padding: '8px 10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e40af' }}>Ответ на сообщение</div>
                  <div className="muted small" style={{ marginTop: 2 }}>
                    {messageReplyContext(replyTarget).author}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTarget(null)}
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: '#1e40af',
                    padding: 0,
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  Отменить ответ
                </button>
              </div>
              <div style={{ marginTop: 6, fontSize: '0.85rem', color: '#1f2937' }}>{messageReplyContext(replyTarget).preview}</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
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
