import { describe, expect, it } from 'vitest'

import { toChatMessages } from './ticketChat'
import type { TimelineItem } from './api'

/**
 * SMA-TICKET-REPLY-READ-PATH-120R.
 *
 * Общий маппер один на десктоп и мобильный, поэтому проверяется он, а не два
 * экрана. Предмет — личность сообщения и предпросмотр ответа; кнопки
 * «Ответить» здесь ещё нет и быть не должно.
 */

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

function comment(params: {
  at: string
  text: string
  commentId?: string | null
  actor?: any
  replyTo?: TimelineItem['replyTo']
}): TimelineItem {
  return {
    at: params.at,
    source: 'event',
    timelineEvent: 'COMMENT_ADDED',
    domainType: 'ticket.comment_added',
    title: 'Comment added',
    actor: params.actor ?? AUTHOR,
    payload: { comment: params.text, source: 'manual_comment' },
    commentId: params.commentId ?? null,
    replyTo: params.replyTo ?? null,
  }
}

const created: TimelineItem = {
  at: '2026-09-17T09:00:00.000Z',
  source: 'event',
  timelineEvent: 'TICKET_CREATED',
  domainType: 'ticket.created',
  title: 'Ticket created',
  actor: AUTHOR,
  payload: {},
  commentId: null,
  replyTo: null,
}

describe('120R личность сообщения в общем маппере', () => {
  it('комментарий с TicketComment получает устойчивую личность вместо номера в массиве', () => {
    const msgs = toChatMessages([comment({ at: '2026-09-17T10:00:00.000Z', text: 'Не работает холодильник', commentId: 'tc-1' })], 'u-tech')
    const msg = msgs.find((m) => m.kind === 'comment')!

    expect(msg.commentId).toBe('tc-1')
    expect(msg.id).toBe('tc-1')
    // Прежний вид ключа — время и индекс — больше не используется.
    expect(msg.id).not.toContain('2026-09-17T10:00:00.000Z-')
  })

  it('личность не сдвигается от появления более ранней записи', () => {
    const later = comment({ at: '2026-09-17T10:00:00.000Z', text: 'Проверил компрессор', commentId: 'tc-2' })

    const before = toChatMessages([later], 'u-tech').find((m) => m.kind === 'comment')!
    const after = toChatMessages([created, later], 'u-tech').find((m) => m.kind === 'comment')!

    expect(before.id).toBe('tc-2')
    expect(after.id).toBe('tc-2')
    expect(before.id).toBe(after.id)
  })

  it('исторический комментарий остаётся читаемым, а его ключ детерминирован', () => {
    const historical = comment({ at: '2026-09-01T10:00:00.000Z', text: 'Старое сообщение', commentId: null })

    const a = toChatMessages([historical], 'u-tech').find((m) => m.kind === 'comment')!
    const b = toChatMessages([historical], 'u-tech').find((m) => m.kind === 'comment')!

    expect(a.text).toBe('Старое сообщение')
    // Ответить нельзя: личности нет. Именно это отличает историю от нового.
    expect(a.commentId).toBeNull()
    expect(a.replyTo).toBeNull()
    // Ключ отрисовки при одинаковом входе одинаков.
    expect(a.id).toBe(b.id)
    expect(a.id).toContain('2026-09-01T10:00:00.000Z')
  })

  it('поля от старого бэкенда, который их не присылает, не ломают маппер', () => {
    const legacy = {
      at: '2026-09-01T10:00:00.000Z',
      source: 'event',
      timelineEvent: 'COMMENT_ADDED',
      domainType: 'ticket.comment_added',
      title: 'Comment added',
      actor: AUTHOR,
      payload: { comment: 'Без новых полей' },
    } as TimelineItem

    const msg = toChatMessages([legacy], 'u-tech').find((m) => m.kind === 'comment')!

    expect(msg.text).toBe('Без новых полей')
    expect(msg.commentId).toBeNull()
    expect(msg.replyTo).toBeNull()
  })
})

describe('120R предпросмотр ответа в общем маппере', () => {
  it('предпросмотр переносится целиком, вместе с личностью автора', () => {
    const msgs = toChatMessages(
      [
        comment({ at: '2026-09-17T10:00:00.000Z', text: 'Не работает холодильник', commentId: 'tc-1' }),
        comment({
          at: '2026-09-17T11:00:00.000Z',
          text: 'Проверил компрессор, нужна замена.',
          commentId: 'tc-2',
          actor: MASTER,
          replyTo: { id: 'tc-1', author: AUTHOR, bodyPreview: 'Не работает холодильник', unavailable: false },
        }),
      ],
      'u-master',
    )

    const reply = msgs.find((m) => m.commentId === 'tc-2')!
    expect(reply.replyTo).toMatchObject({ id: 'tc-1', bodyPreview: 'Не работает холодильник', unavailable: false })
    // Роль и организация исходного автора сохранены — из них строится блок «Техник · ИП Ермаков».
    expect(reply.replyTo?.author).toMatchObject({ role: 'TECHNICIAN', company: expect.objectContaining({ name: 'ИП Ермаков' }) })
    expect(reply.isOwn).toBe(true)
  })

  it('недоступное исходное сообщение переносится как недоступное и без текста', () => {
    const msgs = toChatMessages(
      [
        comment({
          at: '2026-09-17T11:00:00.000Z',
          text: 'Проверил компрессор',
          commentId: 'tc-2',
          replyTo: { id: 'tc-gone', author: null, bodyPreview: '', unavailable: true },
        }),
      ],
      'u-tech',
    )

    const reply = msgs.find((m) => m.commentId === 'tc-2')!
    expect(reply.replyTo?.unavailable).toBe(true)
    expect(reply.replyTo?.bodyPreview).toBe('')
    expect(reply.replyTo?.author).toBeNull()
    // Сам ответ при этом читается как обычное сообщение.
    expect(reply.text).toBe('Проверил компрессор')
  })

  it('системные и фото-сообщения ответом не являются', () => {
    const photo: TimelineItem = {
      at: '2026-09-17T10:30:00.000Z',
      source: 'event',
      timelineEvent: 'TICKET_ATTACHMENT_UPLOADED',
      domainType: 'ticket.attachment_uploaded',
      title: 'Attachment uploaded',
      actor: AUTHOR,
      payload: { attachmentId: 'att-1' },
      commentId: null,
      replyTo: null,
    }

    const msgs = toChatMessages([created, photo], 'u-tech')

    for (const m of msgs) {
      expect(m.commentId).toBeNull()
      expect(m.replyTo).toBeNull()
    }
    expect(msgs.map((m) => m.kind)).toContain('photo')
  })
})
