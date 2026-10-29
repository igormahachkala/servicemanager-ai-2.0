import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { BoardResponse, TicketCard } from './api'
import { applyChatReadToLists } from '../hooks/useTicketChatReadMark'
import {
  CHAT_UNREAD_LIST_QUERY_KEYS,
  clearUnreadChatInBoard,
  latestChatMessageAt,
  shouldMarkChatRead,
} from './ticketChatUnread'

function card(id: string, hasUnreadChat: boolean): TicketCard {
  return {
    id,
    companyId: 'c1',
    title: id,
    status: 'NEW',
    urgency: 'NORMAL',
    createdAt: '2026-10-29T10:00:00.000Z',
    slaDueAt: null,
    slaBreached: false,
    isChild: false,
    category: { id: 'cat', name: 'cat' },
    assignedTechnician: null,
    hasUnreadChat,
  } as TicketCard
}

function board(cards: TicketCard[]): BoardResponse {
  return {
    columns: [{ status: 'NEW', total: cards.length, sla: { breached: 0, atRisk: 0 }, cards }],
    meta: { totalTickets: cards.length, atRiskThresholdMinutes: 60, limitedToLast: 500 },
  } as BoardResponse
}

describe('latestChatMessageAt', () => {
  it('пустая лента — null', () => {
    expect(latestChatMessageAt([])).toBeNull()
  })

  it('берёт самое позднее время, а не последнее по порядку', () => {
    expect(
      latestChatMessageAt([
        { at: '2026-10-29T10:00:00.000Z' },
        { at: '2026-10-29T12:00:00.000Z' },
        { at: '2026-10-29T11:00:00.000Z' },
      ]),
    ).toBe('2026-10-29T12:00:00.000Z')
  })

  it('пропускает неразборчивое время', () => {
    expect(latestChatMessageAt([{ at: '' }, { at: 'x' }, { at: '2026-10-29T10:00:00.000Z' }])).toBe('2026-10-29T10:00:00.000Z')
  })
})

describe('shouldMarkChatRead', () => {
  it('без ленты отметку не шлём', () => {
    expect(shouldMarkChatRead({ latestAt: null, lastMarkedAt: null })).toBe(false)
  })

  it('первое открытие — шлём', () => {
    expect(shouldMarkChatRead({ latestAt: '2026-10-29T10:00:00.000Z', lastMarkedAt: null })).toBe(true)
  })

  it('та же лента повторно не шлётся, новое сообщение — шлётся', () => {
    const at = '2026-10-29T10:00:00.000Z'
    expect(shouldMarkChatRead({ latestAt: at, lastMarkedAt: at })).toBe(false)
    expect(shouldMarkChatRead({ latestAt: '2026-10-29T09:00:00.000Z', lastMarkedAt: at })).toBe(false)
    expect(shouldMarkChatRead({ latestAt: '2026-10-29T10:00:00.001Z', lastMarkedAt: at })).toBe(true)
  })
})

describe('clearUnreadChatInBoard', () => {
  it('гасит только нужную заявку', () => {
    const next = clearUnreadChatInBoard(board([card('a', true), card('b', true)]), 'a')
    expect(next.columns[0].cards.map((c) => [c.id, c.hasUnreadChat])).toEqual([
      ['a', false],
      ['b', true],
    ])
  })

  it('без изменений и чужую форму возвращает тем же объектом', () => {
    const data = board([card('a', false)])
    expect(clearUnreadChatInBoard(data, 'a')).toBe(data)
    const other = { items: [{ id: 'a', hasUnreadChat: true }] }
    expect(clearUnreadChatInBoard(other, 'a')).toBe(other)
    expect(clearUnreadChatInBoard(undefined, 'a')).toBeUndefined()
  })
})

describe('applyChatReadToLists', () => {
  it('гасит 💬 во всех закэшированных списках и помечает их устаревшими', () => {
    const qc = new QueryClient()
    for (const [prefix] of CHAT_UNREAD_LIST_QUERY_KEYS) {
      qc.setQueryData([prefix, 'scope'], board([card('a', true), card('b', true)]))
    }
    qc.setQueryData(['unrelated'], board([card('a', true)]))

    applyChatReadToLists(qc, 'a')

    for (const [prefix] of CHAT_UNREAD_LIST_QUERY_KEYS) {
      const data = qc.getQueryData<BoardResponse>([prefix, 'scope'])!
      expect(data.columns[0].cards.find((c) => c.id === 'a')?.hasUnreadChat).toBe(false)
      expect(data.columns[0].cards.find((c) => c.id === 'b')?.hasUnreadChat).toBe(true)
      expect(qc.getQueryState([prefix, 'scope'])?.isInvalidated).toBe(true)
    }
    expect(qc.getQueryData<BoardResponse>(['unrelated'])!.columns[0].cards[0].hasUnreadChat).toBe(true)
  })
})

/**
 * Ключи CHAT_UNREAD_LIST_QUERY_KEYS должны совпадать с ключами настоящих
 * списков: опечатка в ключе молча оставит 💬 гореть после прочтения.
 * Мир закрыт: каждый экран, который рисует значок, обязан держать свой
 * ключ списка в перечне, и наоборот.
 */
describe('списки с 💬', () => {
  const src = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8')
  const screens: Array<[string, string[]]> = [
    ['views/BoardPage.tsx', ['board']],
    ['views/ArchivePage.tsx', ['archive-board']],
    ['mobile/home/MobileHome.tsx', ['mobile-home-board', 'mobile-home-completed-board']],
    ['mobile/MobileMyTickets.tsx', ['mobile-my-board']],
    ['mobile/MobileChatsPage.tsx', ['mobile-chats-board']],
  ]

  it('перечень ключей ровно тот, что у экранов', () => {
    expect(CHAT_UNREAD_LIST_QUERY_KEYS.map(([k]) => k).sort()).toEqual(screens.flatMap(([, keys]) => keys).sort())
  })

  it.each(screens)('%s читает доску под своими ключами', (file, keys) => {
    const code = src(file)
    for (const key of keys) {
      expect(code).toMatch(new RegExp(`queryKey: \\['${key}',[^\\]]*\\],\\s*\\n?\\s*queryFn: (async )?\\(\\) =>[\\s\\S]{0,700}?api\\.board\\(`))
    }
  })
})
