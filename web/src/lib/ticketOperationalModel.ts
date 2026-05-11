import type { TicketGetOne, TicketStatus } from './api'

export type PrimaryTicketActionKind = 'claim' | 'in_progress' | 'done'

export type PrimaryTicketAction = { kind: PrimaryTicketActionKind; label: string }

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

  if (ticket.status === 'DONE') return null

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
    if (aa?.canComplete || (!aa && canChangeStatus && canTransitionTo('DONE')))
      return { kind: 'done', label: 'Завершить' }
    return null
  }
  return null
}
