import { describe, expect, it } from 'vitest'

import { computePrimaryTicketAction } from './ticketOperationalModel'

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    status: 'IN_PROGRESS',
    parentId: null,
    assignedTechnician: null,
    assignedTechnicianId: null,
    meta: {
      availableActions: {
        canClaim: false,
        canStart: false,
        canComplete: true,
        canClose: false,
        canRequestAssignment: false,
      },
    },
    ...overrides,
  }
}

describe('computePrimaryTicketAction child field complete', () => {
  it('на подзадаче в работе предлагает Выполнено, не приёмку', () => {
    const action = computePrimaryTicketAction({
      ticket: ticket({ parentId: 'parent-1' }) as never,
      canClaim: false,
      canChangeStatus: true,
      availableStatusTransitions: ['AWAITING_ACCEPTANCE', 'FIELD_COMPLETE', 'CANCELED'],
    })
    expect(action).toEqual({ kind: 'done', label: 'Выполнено', completeMode: 'field' })
  })

  it('на подзадаче не предлагает AWAITING_ACCEPTANCE даже если переход есть', () => {
    const action = computePrimaryTicketAction({
      ticket: ticket({
        parentId: 'parent-1',
        meta: {
          availableActions: {
            canClaim: false,
            canStart: false,
            canComplete: true,
            canClose: false,
            canRequestAssignment: false,
          },
        },
      }) as never,
      canClaim: false,
      canChangeStatus: true,
      availableStatusTransitions: ['AWAITING_ACCEPTANCE', 'DONE'],
    })
    expect(action?.label).toBe('Выполнено')
    expect(action?.completeMode).toBe('field')
    expect(action?.label).not.toBe('Отправить на приёмку')
  })

  it('на родителе без parentId оставляет отправку на приёмку', () => {
    const action = computePrimaryTicketAction({
      ticket: ticket() as never,
      canClaim: false,
      canChangeStatus: true,
      availableStatusTransitions: ['AWAITING_ACCEPTANCE'],
    })
    expect(action).toEqual({
      kind: 'done',
      label: 'Отправить на приёмку',
      completeMode: 'acceptance',
    })
  })

  it('на подзадаче NEW по-прежнему предлагает взять себе', () => {
    const action = computePrimaryTicketAction({
      ticket: ticket({
        status: 'NEW',
        parentId: 'parent-1',
        meta: { availableActions: { canClaim: true, canStart: false, canComplete: false, canClose: false } },
      }) as never,
      canClaim: true,
      canChangeStatus: false,
      availableStatusTransitions: [],
    })
    expect(action).toEqual({ kind: 'claim', label: 'Взять себе' })
  })

  it('на подзадаче без TICKETS_STATUS_CHANGE не ставит полевой конец', () => {
    const action = computePrimaryTicketAction({
      ticket: ticket({ parentId: 'parent-1' }) as never,
      canClaim: false,
      canChangeStatus: false,
      availableStatusTransitions: ['FIELD_COMPLETE', 'CANCELED'],
    })
    expect(action).toBe(null)
  })
})
