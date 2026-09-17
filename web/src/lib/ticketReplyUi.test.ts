import { describe, expect, it } from 'vitest'

import { buildAddTicketCommentBody } from './api'
import type { ChatMessage } from './ticketChat'
import {
  UNAVAILABLE_REPLY_PREVIEW_TEXT,
  actorReplyLabel,
  buildAddTicketCommentOptions,
  canReplyToChatMessage,
  messageReplyContext,
  replyPreviewPresentation,
  selectReplyTarget,
} from './ticketReplyUi'

const AUTHOR = {
  id: 'u-tech',
  email: 'tech@example.com',
  firstName: 'Иван',
  lastName: 'Петров',
  role: 'TECHNICIAN',
  companyId: 'provider-1',
  company: { id: 'provider-1', name: 'ИП Ермаков', legalName: null, brandName: null, type: 'PROVIDER' },
} as any

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'tc-1',
    at: '2026-09-17T10:00:00.000Z',
    text: 'Не работает холодильник',
    authorId: 'u-tech',
    authorEmail: 'tech@example.com',
    actor: AUTHOR,
    isOwn: false,
    kind: 'comment',
    attachmentId: null,
    commentId: 'tc-1',
    replyTo: null,
    ...overrides,
  }
}

describe('desktop ticket reply UI helpers', () => {
  it('allows reply only for new-style durable comments when commenting is allowed', () => {
    expect(canReplyToChatMessage(message({ commentId: 'tc-1' }), true)).toBe(true)
    expect(canReplyToChatMessage(message({ commentId: null }), true)).toBe(false)
    expect(canReplyToChatMessage(message({ kind: 'system', commentId: null }), true)).toBe(false)
    expect(canReplyToChatMessage(message({ commentId: 'tc-1' }), false)).toBe(false)
  })

  it('selects the exact durable comment id and rejects historical comments', () => {
    const replyable = message({ commentId: 'tc-real' })
    expect(selectReplyTarget(replyable, true)?.commentId).toBe('tc-real')
    expect(selectReplyTarget(message({ commentId: null }), true)).toBeNull()
  })

  it('builds composer context with actor name, role, company, and bounded preview', () => {
    const context = messageReplyContext(message({ text: 'Слишком длинное сообщение '.repeat(20) }))

    expect(context.author).toContain('Петров Иван')
    expect(context.author).toContain('Техник подрядчика')
    expect(context.author).toContain('ИП Ермаков')
    expect(context.preview).toMatch(/^«Слишком длинное сообщение/)
    expect(context.preview.length).toBeLessThanOrEqual(163)
  })

  it('sends normal comments without replyToId and replies with the exact selected replyToId', () => {
    expect(buildAddTicketCommentBody('Обычный комментарий')).toEqual({ comment: 'Обычный комментарий' })
    expect(buildAddTicketCommentOptions(null)).toBeUndefined()

    const options = buildAddTicketCommentOptions(message({ commentId: 'tc-target' }))
    expect(options).toEqual({ replyToId: 'tc-target' })
    expect(buildAddTicketCommentBody('Ответ', options)).toEqual({ comment: 'Ответ', replyToId: 'tc-target' })
  })

  it('renders backend-provided reply preview and does not infer access from frontend role', () => {
    const presentation = replyPreviewPresentation({
      id: 'tc-source',
      author: AUTHOR,
      bodyPreview: 'Проверил компрессор',
      unavailable: false,
    })

    expect(actorReplyLabel(AUTHOR)).toContain('Техник подрядчика')
    expect(presentation.author).toContain('Петров Иван')
    expect(presentation.preview).toBe('«Проверил компрессор»')
    // The helper only receives the existing canSend result, not a role matrix.
    expect(canReplyToChatMessage(message({ actor: { ...AUTHOR, role: 'ADMIN' } as any }), false)).toBe(false)
  })

  it('never leaks an unavailable or foreign preview body', () => {
    const presentation = replyPreviewPresentation({
      id: 'tc-foreign',
      author: AUTHOR,
      bodyPreview: 'Секретный текст чужой компании',
      unavailable: true,
    })

    expect(presentation.unavailable).toBe(true)
    expect(presentation.author).toBeNull()
    expect(presentation.preview).toBe(UNAVAILABLE_REPLY_PREVIEW_TEXT)
    expect(presentation.preview).not.toContain('Секретный')
  })
})
