import { BadRequestException, ConflictException } from '@nestjs/common'
import { TicketStatus } from '@prisma/client'

import {
  PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS_CODE,
  PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS_MESSAGE,
  PARENT_CLOSE_UNKNOWN_CHILD_RESOLUTION_MESSAGE,
  ParentCloseRequiresChildResolutionsException,
  applyChildResolutionsInTx,
  assertChildResolutionsForParentClose,
  filterUnresolvedDescendants,
  loadTicketDescendants,
  loadUnresolvedDescendants,
  prepareParentClose,
  stampFieldCompleteDescendantsDoneInTx,
  type CloseTreeTicketRow,
} from './ticket-close-tree'

const COMPANY_ID = 'client-1'
const OTHER_COMPANY_ID = 'other-client'
const ROOT_ID = 'parent-1'

function row(overrides: Partial<CloseTreeTicketRow> & { id: string; parentId: string | null }): CloseTreeTicketRow {
  return {
    ticketNumber: 200,
    problemText: 'Child work',
    status: TicketStatus.IN_PROGRESS,
    problemCategory: { name: 'Электрика' },
    ...overrides,
  }
}

function makeDb(rows: Array<CloseTreeTicketRow & { companyId: string }>) {
  const findMany = jest.fn(async ({ where }: { where: { parentId: { in: string[] }; companyId: string } }) => {
    const parentIds = where.parentId.in
    return rows.filter((item) => item.companyId === where.companyId && parentIds.includes(item.parentId ?? ''))
  })
  return { ticket: { findMany }, rows }
}

function makeWriter() {
  return {
    ticket: { update: jest.fn().mockResolvedValue({}) },
    ticketStatusHistory: { create: jest.fn().mockResolvedValue({}) },
  }
}

function makeTimeline() {
  return { recordTx: jest.fn().mockResolvedValue({ id: 'ev-child' }) }
}

describe('loadTicketDescendants', () => {
  it('walks the tree by parentId inside companyId and keeps grandchildren', async () => {
    const db = makeDb([
      { ...row({ id: 'c1', parentId: ROOT_ID, ticketNumber: 11 }), companyId: COMPANY_ID },
      { ...row({ id: 'c2', parentId: ROOT_ID, ticketNumber: 12, status: TicketStatus.FIELD_COMPLETE }), companyId: COMPANY_ID },
      { ...row({ id: 'g1', parentId: 'c1', ticketNumber: 13, status: TicketStatus.NEW }), companyId: COMPANY_ID },
      { ...row({ id: 'foreign', parentId: ROOT_ID, ticketNumber: 99 }), companyId: OTHER_COMPANY_ID },
    ])

    const descendants = await loadTicketDescendants(db, { rootTicketId: ROOT_ID, companyId: COMPANY_ID })

    expect(descendants.map((item) => item.id)).toEqual(['c1', 'c2', 'g1'])
    expect(db.ticket.findMany.mock.calls.every(([args]) => (
      typeof args.where.companyId === 'string' && Array.isArray(args.where.parentId.in)
    ))).toBe(true)
    expect(db.ticket.findMany.mock.calls.some(([args]) => args.where.parentId === undefined)).toBe(false)
  })

  it('stops a parentId cycle without pulling the whole company', async () => {
    const db = makeDb([
      { ...row({ id: 'c1', parentId: ROOT_ID }), companyId: COMPANY_ID },
      { ...row({ id: 'c1', parentId: 'c1' }), companyId: COMPANY_ID },
    ])

    await expect(loadTicketDescendants(db, { rootTicketId: ROOT_ID, companyId: COMPANY_ID })).resolves.toEqual([
      expect.objectContaining({ id: 'c1' }),
    ])
  })
})

describe('unresolved descendants', () => {
  it('includes FIELD_COMPLETE and open rows, excludes DONE and CANCELED', () => {
    const unresolved = filterUnresolvedDescendants([
      row({ id: 'open', parentId: ROOT_ID, status: TicketStatus.IN_PROGRESS }),
      row({ id: 'field', parentId: ROOT_ID, status: TicketStatus.FIELD_COMPLETE }),
      row({ id: 'done', parentId: ROOT_ID, status: TicketStatus.DONE }),
      row({ id: 'canceled', parentId: ROOT_ID, status: TicketStatus.CANCELED }),
    ])

    expect(unresolved.map((item) => item.id)).toEqual(['open', 'field'])
    expect(unresolved[1]).toEqual({
      id: 'field',
      ticketNumber: 200,
      problemText: 'Child work',
      status: TicketStatus.FIELD_COMPLETE,
      categoryName: 'Электрика',
    })
  })

  it('loadUnresolvedDescendants returns the same payload shape', async () => {
    const db = makeDb([
      { ...row({ id: 'c1', parentId: ROOT_ID, status: TicketStatus.FIELD_COMPLETE }), companyId: COMPANY_ID },
      { ...row({ id: 'c2', parentId: ROOT_ID, status: TicketStatus.DONE }), companyId: COMPANY_ID },
    ])

    await expect(loadUnresolvedDescendants(db, { rootTicketId: ROOT_ID, companyId: COMPANY_ID })).resolves.toEqual([
      {
        id: 'c1',
        ticketNumber: 200,
        problemText: 'Child work',
        status: TicketStatus.FIELD_COMPLETE,
        categoryName: 'Электрика',
      },
    ])
  })
})

describe('assertChildResolutionsForParentClose', () => {
  const unresolved = [
    {
      id: 'c1',
      ticketNumber: 11,
      problemText: 'A',
      status: TicketStatus.FIELD_COMPLETE,
      categoryName: 'Cat',
    },
    {
      id: 'c2',
      ticketNumber: 12,
      problemText: 'B',
      status: TicketStatus.NEW,
      categoryName: null,
    },
  ]

  it('does not require a draft when every descendant is already resolved', () => {
    expect(assertChildResolutionsForParentClose([])).toBeNull()
    expect(assertChildResolutionsForParentClose([], [])).toBeNull()
  })

  it('refuses a missing draft with an explicit conflict code and unresolved rows', () => {
    try {
      assertChildResolutionsForParentClose(unresolved)
      throw new Error('expected refusal')
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException)
      expect(err).toBeInstanceOf(ParentCloseRequiresChildResolutionsException)
      expect((err as ConflictException).getResponse()).toEqual({
        code: PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS_CODE,
        message: PARENT_CLOSE_REQUIRES_CHILD_RESOLUTIONS_MESSAGE,
        unresolved,
      })
    }
  })

  it('refuses a draft whose id set is missing a descendant', () => {
    expect(() =>
      assertChildResolutionsForParentClose(unresolved, [
        { ticketId: 'c1', resolution: 'FIELD_COMPLETE' },
      ]),
    ).toThrow(ParentCloseRequiresChildResolutionsException)
  })

  it('refuses an extra ticketId with 400', () => {
    expect(() =>
      assertChildResolutionsForParentClose(unresolved, [
        { ticketId: 'c1', resolution: 'FIELD_COMPLETE' },
        { ticketId: 'c2', resolution: 'CANCELED' },
        { ticketId: 'ghost', resolution: 'CANCELED' },
      ]),
    ).toThrow(new BadRequestException(PARENT_CLOSE_UNKNOWN_CHILD_RESOLUTION_MESSAGE))
  })

  it('refuses leftover draft ids when there is nothing unresolved', () => {
    expect(() =>
      assertChildResolutionsForParentClose([], [{ ticketId: 'c1', resolution: 'CANCELED' }]),
    ).toThrow(new BadRequestException(PARENT_CLOSE_UNKNOWN_CHILD_RESOLUTION_MESSAGE))
  })

  it('accepts a matching draft', () => {
    const draft = [
      { ticketId: 'c2', resolution: 'CANCELED' as const },
      { ticketId: 'c1', resolution: 'FIELD_COMPLETE' as const },
    ]
    expect(assertChildResolutionsForParentClose(unresolved, draft)).toEqual(draft)
  })
})

describe('prepareParentClose', () => {
  it('returns a null draft when the tree has no unresolved rows', async () => {
    const db = makeDb([
      { ...row({ id: 'c1', parentId: ROOT_ID, status: TicketStatus.DONE }), companyId: COMPANY_ID },
    ])

    const prepared = await prepareParentClose(db, { rootTicketId: ROOT_ID, companyId: COMPANY_ID })
    expect(prepared.draft).toBeNull()
    expect(prepared.unresolved).toEqual([])
  })
})

describe('applyChildResolutionsInTx', () => {
  it('writes CANCELED and FIELD_COMPLETE, and skips an already FIELD_COMPLETE row', async () => {
    const tx = makeWriter()
    const timeline = makeTimeline()
    const descendants = [
      row({ id: 'keep-fc', parentId: ROOT_ID, status: TicketStatus.FIELD_COMPLETE }),
      row({ id: 'to-fc', parentId: ROOT_ID, status: TicketStatus.IN_PROGRESS }),
      row({ id: 'to-cancel', parentId: ROOT_ID, status: TicketStatus.NEW }),
    ]

    const next = await applyChildResolutionsInTx(tx, {
      timeline,
      parentCompanyId: COMPANY_ID,
      actorUserId: 'actor-1',
      descendants,
      draft: [
        { ticketId: 'keep-fc', resolution: 'FIELD_COMPLETE' },
        { ticketId: 'to-fc', resolution: 'FIELD_COMPLETE' },
        { ticketId: 'to-cancel', resolution: 'CANCELED' },
      ],
    })

    const updatedIds = tx.ticket.update.mock.calls.map((call) => call[0].where.id)
    expect(updatedIds).toEqual(['to-fc', 'to-cancel'])
    expect(tx.ticketStatusHistory.create).toHaveBeenCalledTimes(2)
    expect(timeline.recordTx).toHaveBeenCalledTimes(2)
    expect(timeline.recordTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        event: 'STATUS_CHANGED',
        companyId: COMPANY_ID,
        ticketId: 'to-fc',
        actorUserId: 'actor-1',
        payload: { fromStatus: TicketStatus.IN_PROGRESS, toStatus: TicketStatus.FIELD_COMPLETE },
      }),
    )
    expect(next.map((item) => [item.id, item.status])).toEqual([
      ['keep-fc', TicketStatus.FIELD_COMPLETE],
      ['to-fc', TicketStatus.FIELD_COMPLETE],
      ['to-cancel', TicketStatus.CANCELED],
    ])
  })
})

describe('stampFieldCompleteDescendantsDoneInTx', () => {
  it('stamps FIELD_COMPLETE to DONE with closedAt and leaves CANCELED children alone', async () => {
    const tx = makeWriter()
    const timeline = makeTimeline()
    const descendants = [
      row({ id: 'fc', parentId: ROOT_ID, status: TicketStatus.FIELD_COMPLETE }),
      row({ id: 'canceled', parentId: ROOT_ID, status: TicketStatus.CANCELED }),
    ]

    await stampFieldCompleteDescendantsDoneInTx(tx, {
      timeline,
      parentCompanyId: COMPANY_ID,
      actorUserId: 'actor-1',
      descendants,
    })

    expect(tx.ticket.update).toHaveBeenCalledTimes(1)
    expect(tx.ticket.update).toHaveBeenCalledWith({
      where: { id: 'fc' },
      data: expect.objectContaining({
        status: TicketStatus.DONE,
        closedAt: expect.any(Date),
      }),
    })
    expect(tx.ticket.update.mock.calls.some((call) => call[0].where.id === 'canceled')).toBe(false)
    expect(timeline.recordTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        companyId: COMPANY_ID,
        ticketId: 'fc',
        payload: { fromStatus: TicketStatus.FIELD_COMPLETE, toStatus: TicketStatus.DONE },
      }),
    )
  })
})
