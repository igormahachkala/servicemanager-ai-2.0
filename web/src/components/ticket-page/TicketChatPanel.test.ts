import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { ChatMessage } from '../../lib/ticketChat'
import { UNAVAILABLE_REPLY_PREVIEW_TEXT } from '../../lib/ticketReplyUi'
import { TicketChatPanel } from './TicketChatPanel'

const AUTHOR = {
  id: 'u-tech',
  email: 'tech@example.com',
  firstName: 'Иван',
  lastName: 'Петров',
  role: 'TECHNICIAN',
  companyId: 'provider-1',
  company: { id: 'provider-1', name: 'ИП Ермаков', legalName: null, brandName: null, type: 'PROVIDER' },
} as any

const MASTER = { ...AUTHOR, id: 'u-master', email: 'master@example.com', firstName: 'Сергей', lastName: 'Иванов', role: 'MASTER' }

function comment(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'tc-1',
    at: '2026-09-17T10:00:00.000Z',
    text: 'Не работает холодильник',
    authorId: AUTHOR.id,
    authorEmail: AUTHOR.email,
    actor: AUTHOR,
    isOwn: false,
    kind: 'comment',
    attachmentId: null,
    commentId: 'tc-1',
    replyTo: null,
    ...overrides,
  }
}

function render(messages: ChatMessage[], canSend = true): string {
  return renderToStaticMarkup(
    createElement(TicketChatPanel, {
      messages,
      loading: false,
      canSend,
      onSend: async () => {},
    }),
  )
}

describe('TicketChatPanel desktop reply presentation', () => {
  it('shows Reply only for durable new-style comments', () => {
    const html = render([
      comment({ id: 'tc-1', commentId: 'tc-1', text: 'Новое сообщение' }),
      comment({ id: 'historical', commentId: null, text: 'Историческое сообщение' }),
    ])

    expect(html.match(/Ответить/g)).toHaveLength(1)
    expect(html).toContain('Новое сообщение')
    expect(html).toContain('Историческое сообщение')
  })

  it('hides Reply when the existing comment permission is absent', () => {
    const html = render([comment({ commentId: 'tc-1' })], false)

    expect(html).not.toContain('Ответить')
    expect(html).not.toContain('Написать комментарий')
  })

  it('renders actor role and company next to chat messages', () => {
    const html = render([comment()])

    expect(html).toContain('Петров Иван')
    expect(html).toContain('Техник подрядчика')
    expect(html).toContain('ИП Ермаков')
  })

  it('uses backend-provided reply preview instead of local original message text', () => {
    const html = render([
      comment({ id: 'tc-source', commentId: 'tc-source', text: 'Локальный текст исходника, который не должен использоваться' }),
      comment({
        id: 'tc-reply',
        commentId: 'tc-reply',
        text: 'Ответ мастера',
        actor: MASTER,
        authorId: MASTER.id,
        authorEmail: MASTER.email,
        replyTo: {
          id: 'tc-source',
          author: AUTHOR,
          bodyPreview: 'Серверный предпросмотр исходника',
          unavailable: false,
        },
      }),
    ])

    expect(html).toContain('Серверный предпросмотр исходника')
    expect(html).toContain('Локальный текст исходника')
  })

  it('does not leak unavailable or foreign reply preview body', () => {
    const html = render([
      comment({
        id: 'tc-reply',
        commentId: 'tc-reply',
        text: 'Ответ на недоступное',
        replyTo: {
          id: 'tc-foreign',
          author: AUTHOR,
          bodyPreview: 'Секретный текст чужой компании',
          unavailable: true,
        },
      }),
    ])

    expect(html).toContain(UNAVAILABLE_REPLY_PREVIEW_TEXT)
    expect(html).not.toContain('Секретный текст чужой компании')
  })
})
