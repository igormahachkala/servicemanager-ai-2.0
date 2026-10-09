import { describe, expect, it } from 'vitest'

import type { TimelineItem } from './api'
import { toChatMessages } from './ticketChat'

const AUTHOR = {
  id: 'u-tech',
  email: 'tech@example.com',
  firstName: 'Иван',
  lastName: 'Петров',
  role: 'TECHNICIAN',
  companyId: 'provider-1',
  company: { id: 'provider-1', name: 'ИП Ермаков', legalName: null, brandName: null, type: 'PROVIDER' },
} as any

function timeline(overrides: Partial<TimelineItem> & Pick<TimelineItem, 'timelineEvent'>): TimelineItem {
  return {
    at: '2026-10-08T10:00:00.000Z',
    source: 'event',
    domainType: 'ticket.created',
    title: overrides.timelineEvent,
    actor: AUTHOR,
    payload: {},
    commentId: null,
    replyTo: null,
    ...overrides,
  }
}

describe('капсулы подзадачи в чате заявки', () => {
  it('на родителе CHILD_TICKET_CREATED даёт текст и ссылку на ребёнка', () => {
    const msgs = toChatMessages(
      [
        timeline({
          timelineEvent: 'CHILD_TICKET_CREATED',
          domainType: 'ticket.child_created',
          payload: { childTicketId: 'child-1', childTicketNumber: 12 },
        }),
      ],
      'u-tech',
    )

    const capsule = msgs.find((m) => m.kind === 'system')
    expect(capsule?.text).toBe('Создана подзадача #12')
    expect(capsule?.link).toEqual({ ticketId: 'child-1', href: '/tickets/child-1' })
  })

  it('ticket.child_created без childTicketId оставляет текст и не ставит link', () => {
    const msgs = toChatMessages(
      [
        timeline({
          timelineEvent: undefined,
          type: 'ticket.child_created',
          domainType: 'ticket.child_created',
          payload: { childTicketNumber: 12 },
        }),
      ],
      'u-tech',
    )

    const capsule = msgs.find((m) => m.text === 'Создана подзадача #12')
    expect(capsule?.kind).toBe('system')
    expect(capsule?.link ?? null).toBeNull()
  })

  it('на ребёнке с живым parent капсула ссылается на родителя', () => {
    const msgs = toChatMessages(
      [
        timeline({
          timelineEvent: 'TICKET_CREATED',
          payload: { parentId: 'parent-1', parentTicketNumber: 7 },
        }),
      ],
      'u-tech',
      {
        parent: { id: 'parent-1', ticketNumber: 7 },
        ticketHref: (id) => `/scope/tickets/${id}`,
      },
    )

    const created = msgs.find((m) => m.text.startsWith('Заявку создал'))
    const fromParent = msgs.filter((m) => m.text === 'Создана из заявки #7')

    expect(created?.kind).toBe('system')
    expect(created?.link).toBeUndefined()
    expect(fromParent).toHaveLength(1)
    expect(fromParent[0].link).toEqual({ ticketId: 'parent-1', href: '/scope/tickets/parent-1' })
  })

  it('после отвязки текст «из заявки» остаётся без link', () => {
    const msgs = toChatMessages(
      [
        timeline({
          timelineEvent: 'TICKET_CREATED',
          payload: { parentId: 'parent-1', parentTicketNumber: 7 },
        }),
      ],
      'u-tech',
      { parent: null },
    )

    const fromParent = msgs.filter((m) => m.text === 'Создана из заявки #7')
    expect(fromParent).toHaveLength(1)
    expect(fromParent[0].link).toBeNull()
  })

  it('TICKET_CREATED без parent по-прежнему «Заявку создал» и без второй капсулы', () => {
    const msgs = toChatMessages(
      [timeline({ timelineEvent: 'TICKET_CREATED', payload: {} })],
      'u-tech',
    )

    expect(msgs).toHaveLength(1)
    expect(msgs[0].text.startsWith('Заявку создал')).toBe(true)
    expect(msgs.some((m) => m.text.startsWith('Создана из заявки #'))).toBe(false)
    expect(msgs[0].link).toBeUndefined()
  })

  it('старый ребёнок без TICKET_CREATED получает одну капсулу из живого parent', () => {
    const comment: TimelineItem = {
      at: '2026-10-08T11:00:00.000Z',
      source: 'event',
      timelineEvent: 'COMMENT_ADDED',
      domainType: 'ticket.comment_added',
      title: 'Comment added',
      actor: AUTHOR,
      payload: { comment: 'Проверил компрессор', source: 'manual_comment' },
      commentId: 'tc-1',
      replyTo: null,
    }

    const msgs = toChatMessages([comment], 'u-tech', {
      parent: { id: 'parent-9', ticketNumber: 9 },
    })

    const fromParent = msgs.filter((m) => m.text === 'Создана из заявки #9')
    expect(fromParent).toHaveLength(1)
    expect(fromParent[0].link).toEqual({ ticketId: 'parent-9', href: '/tickets/parent-9' })
    expect(msgs.filter((m) => m.kind === 'comment')).toHaveLength(1)
  })

  it('TICKET_DETACHED_FROM_PARENT даёт текст с номером и без link', () => {
    for (const timelineEvent of ['TICKET_DETACHED_FROM_PARENT', 'TICKET.DETACHED_FROM_PARENT'] as const) {
      const msgs = toChatMessages(
        [
          timeline({
            timelineEvent,
            payload: { parentId: 'parent-1', parentTicketNumber: 7 },
          }),
        ],
        'u-tech',
      )

      const capsule = msgs.find((m) => m.kind === 'system')
      expect(capsule?.text).toBe('Была подзадачей заявки #7')
      expect(capsule?.link).toBeUndefined()
    }
  })

  it('капсула отвязки не ломает «Создана из заявки» без ссылки', () => {
    const msgs = toChatMessages(
      [
        timeline({
          timelineEvent: 'TICKET_CREATED',
          payload: { parentId: 'parent-1', parentTicketNumber: 7 },
        }),
        timeline({
          at: '2026-10-08T12:00:00.000Z',
          timelineEvent: 'TICKET_DETACHED_FROM_PARENT',
          payload: { parentTicketNumber: 7 },
        }),
      ],
      'u-tech',
      { parent: null },
    )

    const fromParent = msgs.filter((m) => m.text === 'Создана из заявки #7')
    const detached = msgs.filter((m) => m.text === 'Была подзадачей заявки #7')
    expect(fromParent).toHaveLength(1)
    expect(fromParent[0].link).toBeNull()
    expect(detached).toHaveLength(1)
    expect(detached[0].link).toBeUndefined()
  })
})
