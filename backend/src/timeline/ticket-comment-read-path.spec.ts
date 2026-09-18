import { ServiceContractsService } from '../service-contracts/service-contracts.service'

import { TimelineService } from './timeline.service'

/**
 * SMA-TICKET-REPLY-READ-PATH-120R.
 *
 * Лента заявки должна отдавать устойчивую личность нового комментария
 * и разрешённый предпросмотр исходного сообщения — не создавая ни запроса
 * на сообщение, ни возможности заглянуть за пределы уже разрешённой заявки.
 *
 * Разграничение: timeline.service.spec.ts проверяет саму сборку ленты,
 * ticket-comment-reply.spec.ts — запись ответа. Здесь только чтение.
 */

const CLIENT_ID = 'client-1'
const TICKET_ID = 'ticket-1'
const OTHER_TICKET_ID = 'ticket-2'

const AUTHOR = {
  id: 'u-tech',
  email: 'tech@example.com',
  firstName: 'Иван',
  lastName: 'Петров',
  role: 'TECHNICIAN',
  companyId: 'provider-1',
  company: { id: 'provider-1', name: 'ИП Ермаков', legalName: null, brandName: null, type: 'PROVIDER' },
}

const MASTER = {
  id: 'u-master',
  email: 'master@example.com',
  firstName: 'Сергей',
  lastName: 'Иванов',
  role: 'MASTER',
  companyId: 'provider-1',
  company: { id: 'provider-1', name: 'ИП Ермаков', legalName: null, brandName: null, type: 'PROVIDER' },
}

type CommentRow = {
  id: string
  replyTo: {
    id: string
    ticketId: string
    companyId: string
    body: string
    author: typeof AUTHOR | null
  } | null
}

function makeSuite(options: {
  events?: any[]
  comments?: CommentRow[]
  history?: any[]
} = {}) {
  /** Счётчик обращений: пакетность доказывается числом запросов, не отзывами о коде. */
  const calls = { ticketComment: 0, user: 0, domainEvent: 0, ticketStatusHistory: 0 }

  const prisma: any = {
    ticketStatusHistory: {
      findMany: jest.fn(async () => {
        calls.ticketStatusHistory += 1
        return options.history ?? []
      }),
    },
    domainEvent: {
      findMany: jest.fn(async () => {
        calls.domainEvent += 1
        return options.events ?? []
      }),
    },
    user: {
      findMany: jest.fn(async ({ where }: any) => {
        calls.user += 1
        const ids: string[] = where?.id?.in ?? []
        return [AUTHOR, MASTER].filter((u) => ids.includes(u.id))
      }),
    },
    ticketComment: {
      findMany: jest.fn(async ({ where }: any) => {
        calls.ticketComment += 1
        const ids: string[] = where?.id?.in ?? []
        return (options.comments ?? []).filter(
          (row) =>
            ids.includes(row.id) &&
            where.ticketId === TICKET_ID &&
            where.companyId === CLIENT_ID,
        )
      }),
    },
    ticket: { findFirst: jest.fn() },
  }

  const serviceContracts = new ServiceContractsService({
    serviceContract: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
  } as any)

  const svc = new TimelineService(prisma, serviceContracts)

  /**
   * Доступ к заявке решает канонический resolveReadableTicketAccess. Он здесь
   * подменён: предмет проверки — форма чтения и границы предпросмотра, а не
   * повторная проверка уже доказанного доступа.
   */
  jest.spyOn(require('../tickets/ticket-access.utils'), 'resolveReadableTicketAccess').mockResolvedValue({
    ticket: { id: TICKET_ID, companyId: CLIENT_ID },
    visibilityMode: 'tenant',
  } as any)

  return { svc, prisma, calls }
}

function commentEvent(params: { id: string; commentId?: string | null; comment: string; at: string; actorUserId?: string }) {
  return {
    id: params.id,
    entityId: TICKET_ID,
    type: 'ticket.comment_added',
    actorUserId: params.actorUserId ?? AUTHOR.id,
    payload: {
      comment: params.comment,
      source: 'manual_comment',
      ...(params.commentId === undefined ? {} : { commentId: params.commentId }),
    },
    createdAt: new Date(params.at),
  }
}

const USER_CTX = { id: AUTHOR.id, role: 'TECHNICIAN', companyId: 'provider-1' } as any

afterEach(() => jest.restoreAllMocks())

describe('120R чтение: личность нового комментария', () => {
  it('новый комментарий появляется один раз и несёт устойчивую личность', async () => {
    const { svc } = makeSuite({
      events: [commentEvent({ id: 'ev-1', commentId: 'tc-1', comment: 'Не работает холодильник', at: '2026-09-17T10:00:00Z' })],
      comments: [{ id: 'tc-1', replyTo: null }],
    })

    const res: any = await svc.getTicketTimeline(USER_CTX, TICKET_ID)

    const comments = res.timeline.filter((e: any) => e.timelineEvent === 'COMMENT_ADDED')
    expect(comments).toHaveLength(1)
    expect(comments[0].commentId).toBe('tc-1')
    expect(comments[0].replyTo).toBeNull()
  })

  it('личность не зависит от позиции в ленте: добавление более ранней записи её не сдвигает', async () => {
    const later = commentEvent({ id: 'ev-2', commentId: 'tc-2', comment: 'Проверил компрессор', at: '2026-09-17T11:00:00Z' })

    const a: any = await makeSuite({
      events: [later],
      comments: [{ id: 'tc-2', replyTo: null }],
    }).svc.getTicketTimeline(USER_CTX, TICKET_ID)

    const b: any = await makeSuite({
      events: [
        commentEvent({ id: 'ev-1', commentId: 'tc-1', comment: 'Раньше', at: '2026-09-17T09:00:00Z' }),
        later,
      ],
      comments: [{ id: 'tc-1', replyTo: null }, { id: 'tc-2', replyTo: null }],
    }).svc.getTicketTimeline(USER_CTX, TICKET_ID)

    const pick = (res: any) => res.timeline.find((e: any) => e.commentId === 'tc-2')
    expect(pick(a).commentId).toBe('tc-2')
    expect(pick(b).commentId).toBe('tc-2')
  })

  it('исторический комментарий остаётся читаемым и неотвечаемым', async () => {
    const { svc, calls } = makeSuite({
      // Событие без commentId — ровно то, что лежит в базе до этого релиза.
      events: [commentEvent({ id: 'ev-old', comment: 'Старое сообщение', at: '2026-09-01T10:00:00Z' })],
      comments: [],
    })

    const res: any = await svc.getTicketTimeline(USER_CTX, TICKET_ID)
    const entry = res.timeline.find((e: any) => e.timelineEvent === 'COMMENT_ADDED')

    expect(entry.payload.comment).toBe('Старое сообщение')
    expect(entry.commentId).toBeNull()
    expect(entry.replyTo).toBeNull()
    // Незачем и спрашивать: идентификаторов нет — запроса нет.
    expect(calls.ticketComment).toBe(0)
  })
})

describe('120R чтение: предпросмотр ответа', () => {
  it('ответ отдаёт предпросмотр с личностью автора исходного сообщения', async () => {
    const { svc } = makeSuite({
      events: [
        commentEvent({ id: 'ev-1', commentId: 'tc-1', comment: 'Не работает холодильник', at: '2026-09-17T10:00:00Z' }),
        commentEvent({ id: 'ev-2', commentId: 'tc-2', comment: 'Проверил компрессор', at: '2026-09-17T11:00:00Z', actorUserId: MASTER.id }),
      ],
      comments: [
        { id: 'tc-1', replyTo: null },
        {
          id: 'tc-2',
          replyTo: { id: 'tc-1', ticketId: TICKET_ID, companyId: CLIENT_ID, body: 'Не работает холодильник', author: AUTHOR },
        },
      ],
    })

    const res: any = await svc.getTicketTimeline(USER_CTX, TICKET_ID)
    const reply = res.timeline.find((e: any) => e.commentId === 'tc-2')

    expect(reply.replyTo).toMatchObject({
      id: 'tc-1',
      bodyPreview: 'Не работает холодильник',
      unavailable: false,
    })
    // Личность берётся целиком — роль и организация нужны для блока автора.
    expect(reply.replyTo.author).toMatchObject({
      id: AUTHOR.id,
      role: 'TECHNICIAN',
      company: expect.objectContaining({ name: 'ИП Ермаков' }),
    })
  })

  it('длинное исходное сообщение обрезается, полный текст не уходит', async () => {
    const long = 'a'.repeat(400)
    const { svc } = makeSuite({
      events: [commentEvent({ id: 'ev-2', commentId: 'tc-2', comment: 'ответ', at: '2026-09-17T11:00:00Z' })],
      comments: [
        { id: 'tc-2', replyTo: { id: 'tc-1', ticketId: TICKET_ID, companyId: CLIENT_ID, body: long, author: AUTHOR } },
      ],
    })

    const res: any = await svc.getTicketTimeline(USER_CTX, TICKET_ID)
    const preview = res.timeline.find((e: any) => e.commentId === 'tc-2').replyTo

    expect(preview.bodyPreview.length).toBeLessThan(long.length)
    expect(preview.bodyPreview.endsWith('…')).toBe(true)
    expect(preview.unavailable).toBe(false)
  })

  it('цель из другой заявки не попадает в предпросмотр и тела не раскрывает', async () => {
    const { svc } = makeSuite({
      events: [commentEvent({ id: 'ev-2', commentId: 'tc-2', comment: 'ответ', at: '2026-09-17T11:00:00Z' })],
      comments: [
        {
          id: 'tc-2',
          replyTo: {
            id: 'tc-foreign',
            ticketId: OTHER_TICKET_ID,
            companyId: CLIENT_ID,
            body: 'СЕКРЕТ ДРУГОЙ ЗАЯВКИ',
            author: AUTHOR,
          },
        },
      ],
    })

    const res: any = await svc.getTicketTimeline(USER_CTX, TICKET_ID)
    const preview = res.timeline.find((e: any) => e.commentId === 'tc-2').replyTo

    expect(preview.unavailable).toBe(true)
    expect(preview.bodyPreview).toBe('')
    expect(preview.author).toBeNull()
    expect(JSON.stringify(res)).not.toContain('СЕКРЕТ ДРУГОЙ ЗАЯВКИ')
  })

  it('цель другого арендатора закрыта так же', async () => {
    const { svc } = makeSuite({
      events: [commentEvent({ id: 'ev-2', commentId: 'tc-2', comment: 'ответ', at: '2026-09-17T11:00:00Z' })],
      comments: [
        {
          id: 'tc-2',
          replyTo: {
            id: 'tc-other',
            ticketId: TICKET_ID,
            companyId: 'client-999',
            body: 'ЧУЖОЙ АРЕНДАТОР',
            author: AUTHOR,
          },
        },
      ],
    })

    const res: any = await svc.getTicketTimeline(USER_CTX, TICKET_ID)
    const preview = res.timeline.find((e: any) => e.commentId === 'tc-2').replyTo

    expect(preview.unavailable).toBe(true)
    expect(JSON.stringify(res)).not.toContain('ЧУЖОЙ АРЕНДАТОР')
  })

  it('снятое содержимое исходного сообщения даёт недоступность, а не пустую цитату', async () => {
    const { svc } = makeSuite({
      events: [commentEvent({ id: 'ev-2', commentId: 'tc-2', comment: 'ответ', at: '2026-09-17T11:00:00Z' })],
      comments: [
        { id: 'tc-2', replyTo: { id: 'tc-1', ticketId: TICKET_ID, companyId: CLIENT_ID, body: '   ', author: AUTHOR } },
      ],
    })

    const res: any = await svc.getTicketTimeline(USER_CTX, TICKET_ID)
    const preview = res.timeline.find((e: any) => e.commentId === 'tc-2').replyTo

    expect(preview.unavailable).toBe(true)
    expect(preview.bodyPreview).toBe('')
  })

  it('запрос комментариев сужен заявкой и компанией, и ни то ни другое не приходит от клиента', async () => {
    const { svc, prisma } = makeSuite({
      events: [commentEvent({ id: 'ev-1', commentId: 'tc-1', comment: 'x', at: '2026-09-17T10:00:00Z' })],
      comments: [{ id: 'tc-1', replyTo: null }],
    })

    await svc.getTicketTimeline(USER_CTX, TICKET_ID)

    expect(prisma.ticketComment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['tc-1'] },
          ticketId: TICKET_ID,
          companyId: CLIENT_ID,
        }),
      }),
    )
  })
})

describe('120R чтение: пакетность', () => {
  it('двадцать сообщений с ответами читаются одним запросом комментариев', async () => {
    const events: any[] = []
    const comments: CommentRow[] = []
    for (let i = 0; i < 20; i += 1) {
      const id = `tc-${i}`
      events.push(commentEvent({ id: `ev-${i}`, commentId: id, comment: `сообщение ${i}`, at: `2026-09-17T10:${String(i).padStart(2, '0')}:00Z` }))
      comments.push({
        id,
        replyTo:
          i === 0
            ? null
            : { id: 'tc-0', ticketId: TICKET_ID, companyId: CLIENT_ID, body: 'сообщение 0', author: AUTHOR },
      })
    }

    const { svc, calls } = makeSuite({ events, comments })
    const res: any = await svc.getTicketTimeline(USER_CTX, TICKET_ID)

    expect(res.timeline.filter((e: any) => e.commentId)).toHaveLength(20)
    // Главное утверждение задачи: один запрос, а не по одному на сообщение.
    expect(calls.ticketComment).toBe(1)
    expect(calls.user).toBe(1)
    expect(calls.domainEvent).toBe(1)
  })

  it('повторяющиеся идентификаторы не размножают запросы', async () => {
    const { svc, prisma, calls } = makeSuite({
      events: [
        commentEvent({ id: 'ev-1', commentId: 'tc-1', comment: 'a', at: '2026-09-17T10:00:00Z' }),
        // Одно и то же сообщение в двух событиях — в базу идёт один идентификатор.
        commentEvent({ id: 'ev-2', commentId: 'tc-1', comment: 'a', at: '2026-09-17T10:00:01Z' }),
      ],
      comments: [{ id: 'tc-1', replyTo: null }],
    })

    await svc.getTicketTimeline(USER_CTX, TICKET_ID)

    expect(calls.ticketComment).toBe(1)
    expect(prisma.ticketComment.findMany.mock.calls[0][0].where.id.in).toEqual(['tc-1'])
  })
})
