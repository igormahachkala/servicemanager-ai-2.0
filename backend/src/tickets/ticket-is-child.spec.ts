import { BadRequestException } from '@nestjs/common'
import { TicketStatus } from '@prisma/client'

import {
  CHILD_TICKET_CANNOT_ACCEPT_CODE,
  CHILD_TICKET_CANNOT_ACCEPT_MESSAGE,
  CHILD_TICKET_CANNOT_AWAIT_ACCEPTANCE_CODE,
  CHILD_TICKET_CANNOT_SUBMIT_ACCEPTANCE_CODE,
  CHILD_TICKET_DONE_ONLY_VIA_PARENT_CODE,
  CHILD_TICKET_DONE_ONLY_VIA_PARENT_MESSAGE,
  assertChildTicketCannotBeAccepted,
  assertChildTicketCannotSubmitAcceptance,
  filterChildAvailableStatusTransitions,
  isChildTicket,
  resolveChildRequestedStatus,
} from './ticket-is-child'

describe('isChildTicket', () => {
  it('is true when parentId is set', () => {
    expect(isChildTicket({ parentId: 'parent-1' })).toBe(true)
  })

  it('is false when parentId is null', () => {
    expect(isChildTicket({ parentId: null })).toBe(false)
  })

  it('is false when parentId is omitted', () => {
    expect(isChildTicket({})).toBe(false)
  })
})

describe('child acceptance guards', () => {
  it('does not throw for a parent ticket', () => {
    expect(() => assertChildTicketCannotBeAccepted({ parentId: null })).not.toThrow()
    expect(() => assertChildTicketCannotSubmitAcceptance({ parentId: null })).not.toThrow()
  })

  it('rejects decide on a child with an explicit code', () => {
    try {
      assertChildTicketCannotBeAccepted({ parentId: 'parent-1' })
      throw new Error('expected refusal')
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException)
      expect((err as BadRequestException).getResponse()).toEqual({
        code: CHILD_TICKET_CANNOT_ACCEPT_CODE,
        message: CHILD_TICKET_CANNOT_ACCEPT_MESSAGE,
      })
    }
  })

  it('rejects submit-acceptance on a child with an explicit code', () => {
    try {
      assertChildTicketCannotSubmitAcceptance({ parentId: 'parent-1' })
      throw new Error('expected refusal')
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException)
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({
          code: CHILD_TICKET_CANNOT_SUBMIT_ACCEPTANCE_CODE,
        }),
      )
    }
  })
})

describe('resolveChildRequestedStatus', () => {
  it('keeps explicit FIELD_COMPLETE', () => {
    expect(resolveChildRequestedStatus(TicketStatus.FIELD_COMPLETE)).toBe(TicketStatus.FIELD_COMPLETE)
  })

  it('keeps CANCELED and IN_PROGRESS', () => {
    expect(resolveChildRequestedStatus(TicketStatus.CANCELED)).toBe(TicketStatus.CANCELED)
    expect(resolveChildRequestedStatus(TicketStatus.IN_PROGRESS)).toBe(TicketStatus.IN_PROGRESS)
  })

  it('refuses DONE as a final status', () => {
    try {
      resolveChildRequestedStatus(TicketStatus.DONE)
      throw new Error('expected refusal')
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException)
      expect((err as BadRequestException).getResponse()).toEqual({
        code: CHILD_TICKET_DONE_ONLY_VIA_PARENT_CODE,
        message: CHILD_TICKET_DONE_ONLY_VIA_PARENT_MESSAGE,
      })
    }
  })

  it('refuses AWAITING_ACCEPTANCE', () => {
    try {
      resolveChildRequestedStatus(TicketStatus.AWAITING_ACCEPTANCE)
      throw new Error('expected refusal')
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException)
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({
          code: CHILD_TICKET_CANNOT_AWAIT_ACCEPTANCE_CODE,
        }),
      )
    }
  })
})

describe('filterChildAvailableStatusTransitions', () => {
  it('drops acceptance and DONE, keeps FIELD_COMPLETE', () => {
    expect(
      filterChildAvailableStatusTransitions([
        TicketStatus.IN_PROGRESS,
        TicketStatus.AWAITING_ACCEPTANCE,
        TicketStatus.DONE,
        TicketStatus.FIELD_COMPLETE,
        TicketStatus.CANCELED,
      ]),
    ).toEqual([TicketStatus.IN_PROGRESS, TicketStatus.FIELD_COMPLETE, TicketStatus.CANCELED])
  })
})
