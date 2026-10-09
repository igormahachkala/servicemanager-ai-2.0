import type { TicketGetOne, TicketStatus } from './api'
import { isChildTicket } from './ticketIsChild'

export type PrimaryTicketActionKind = 'claim' | 'in_progress' | 'done'

export type PrimaryTicketAction = {
  kind: PrimaryTicketActionKind
  label: string
  /** kind done: родитель идёт на приёмку, подзадача — полевой конец FIELD_COMPLETE. */
  completeMode?: 'acceptance' | 'field'
}

/**
 * Единая логика «главной» кнопки на карточке (совпадает с meta.availableActions с бэкенда).
 */
export function computePrimaryTicketAction(params: {
  ticket: TicketGetOne
  canClaim: boolean
  canChangeStatus: boolean
  availableStatusTransitions: TicketStatus[]
}): PrimaryTicketAction | null {
  const { ticket, canClaim, canChangeStatus, availableStatusTransitions } = params
  const canTransitionTo = (status: TicketStatus) => availableStatusTransitions.includes(status)
  const child = isChildTicket(ticket)

  if (
    ticket.status === 'DONE' ||
    ticket.status === 'AWAITING_ACCEPTANCE' ||
    ticket.status === 'FIELD_COMPLETE' ||
    ticket.status === 'CANCELED'
  ) {
    return null
  }

  const aa = ticket.meta?.availableActions

  if (ticket.status === 'NEW') {
    if (aa?.canClaim || (!aa && canClaim)) return { kind: 'claim', label: 'Взять себе' }
    if (aa?.canStart || (!aa && canChangeStatus && canTransitionTo('IN_PROGRESS')))
      return { kind: 'in_progress', label: 'Взять в работу' }
    return null
  }
  if (ticket.status === 'ASSIGNED') {
    if (aa?.canStart || (!aa && canChangeStatus && canTransitionTo('IN_PROGRESS')))
      return { kind: 'in_progress', label: 'Начать выполнение' }
    return null
  }
  if (ticket.status === 'IN_PROGRESS') {
    if (child) {
      if (!canChangeStatus) return null
      if (aa?.canComplete || canTransitionTo('FIELD_COMPLETE') || !aa) {
        return { kind: 'done', label: 'Выполнено', completeMode: 'field' }
      }
      return null
    }
    if (aa?.canComplete || (!aa && canChangeStatus && canTransitionTo('AWAITING_ACCEPTANCE'))) {
      return { kind: 'done', label: 'Отправить на приёмку', completeMode: 'acceptance' }
    }
    return null
  }
  return null
}
