import { describe, expect, it } from 'vitest'

import { toChatMessages } from './ticketChat'

const actor = {
  id: 'actor-1',
  email: 'ivan@example.test',
  firstName: 'Иван',
  lastName: 'Иванов',
  role: 'MASTER',
  companyId: 'provider-1',
  company: {
    id: 'provider-1',
    name: 'Provider',
    legalName: 'ООО «Подрядчик»',
    brandName: 'Подрядчик',
    type: 'PROVIDER',
  },
}

describe('ticket chat identity mapping', () => {
  it('preserves author name, role and company for comments', () => {
    const [message] = toChatMessages([
      {
        at: '2026-09-17T10:00:00.000Z',
        source: 'event',
        timelineEvent: 'COMMENT_ADDED',
        domainType: 'ticket.comment_added',
        type: 'ticket.comment_added',
        title: 'Комментарий',
        actor,
        payload: { comment: 'Готово' },
      },
    ], 'other-user')

    expect(message?.authorIdentity).toEqual({
      name: 'Иванов Иван',
      role: 'Мастер подрядчика',
      organization: 'ООО «Подрядчик»',
    })
  })

  it('falls back when actor identity is missing', () => {
    const [message] = toChatMessages([
      {
        at: '2026-09-17T10:00:00.000Z',
        source: 'event',
        timelineEvent: 'COMMENT_ADDED',
        domainType: 'ticket.comment_added',
        type: 'ticket.comment_added',
        title: 'Комментарий',
        actor: null,
        payload: { comment: 'Без автора' },
      },
    ], 'other-user')

    expect(message?.authorIdentity).toBeNull()
    expect(message?.authorEmail).toBeNull()
  })
})
