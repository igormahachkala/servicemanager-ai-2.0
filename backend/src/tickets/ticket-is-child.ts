import { BadRequestException } from '@nestjs/common'
import { TicketStatus } from '@prisma/client'

export function isChildTicket(row: { parentId?: string | null }): boolean {
  return row.parentId != null
}

export const CHILD_TICKET_CANNOT_ACCEPT_CODE = 'CHILD_TICKET_CANNOT_ACCEPT'
export const CHILD_TICKET_CANNOT_ACCEPT_MESSAGE = 'Child ticket cannot be accepted separately'

export const CHILD_TICKET_CANNOT_SUBMIT_ACCEPTANCE_CODE = 'CHILD_TICKET_CANNOT_SUBMIT_ACCEPTANCE'
export const CHILD_TICKET_CANNOT_SUBMIT_ACCEPTANCE_MESSAGE =
  'Child ticket cannot be submitted for acceptance'

export const CHILD_TICKET_DONE_ONLY_VIA_PARENT_CODE = 'CHILD_TICKET_DONE_ONLY_VIA_PARENT'
export const CHILD_TICKET_DONE_ONLY_VIA_PARENT_MESSAGE = 'DONE только через приёмку родителя'

export const CHILD_TICKET_CANNOT_AWAIT_ACCEPTANCE_CODE = 'CHILD_TICKET_CANNOT_AWAIT_ACCEPTANCE'
export const CHILD_TICKET_CANNOT_AWAIT_ACCEPTANCE_MESSAGE =
  'Child ticket cannot enter AWAITING_ACCEPTANCE'

export function assertChildTicketCannotBeAccepted(row: { parentId?: string | null }) {
  if (!isChildTicket(row)) return
  throw new BadRequestException({
    code: CHILD_TICKET_CANNOT_ACCEPT_CODE,
    message: CHILD_TICKET_CANNOT_ACCEPT_MESSAGE,
  })
}

export function assertChildTicketCannotSubmitAcceptance(row: { parentId?: string | null }) {
  if (!isChildTicket(row)) return
  throw new BadRequestException({
    code: CHILD_TICKET_CANNOT_SUBMIT_ACCEPTANCE_CODE,
    message: CHILD_TICKET_CANNOT_SUBMIT_ACCEPTANCE_MESSAGE,
  })
}

export function resolveChildRequestedStatus(requested: TicketStatus): TicketStatus {
  if (requested === TicketStatus.DONE) {
    throw new BadRequestException({
      code: CHILD_TICKET_DONE_ONLY_VIA_PARENT_CODE,
      message: CHILD_TICKET_DONE_ONLY_VIA_PARENT_MESSAGE,
    })
  }
  if (requested === TicketStatus.AWAITING_ACCEPTANCE) {
    throw new BadRequestException({
      code: CHILD_TICKET_CANNOT_AWAIT_ACCEPTANCE_CODE,
      message: CHILD_TICKET_CANNOT_AWAIT_ACCEPTANCE_MESSAGE,
    })
  }
  return requested
}

export function filterChildAvailableStatusTransitions(transitions: TicketStatus[]): TicketStatus[] {
  return transitions.filter(
    (status) => status !== TicketStatus.AWAITING_ACCEPTANCE && status !== TicketStatus.DONE,
  )
}
