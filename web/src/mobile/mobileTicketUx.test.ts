import { describe, expect, it } from 'vitest'

import { appendBoardNavigationContextToPath, readBoardNavigationContextFromSearch } from '../lib/boardNavigationContext'
import {
  buildMobileTicketBackContext,
  buildMobileTicketBackLabel,
  buildMobileTicketOperationalActions,
  canQueueMobileTicketOperationalAction,
} from './mobileTicketUx'

const UUID = '6d0640da-6470-4f4e-a052-34a5c9ab2cf8'

describe('mobile ticket source context', () => {
  it('uses safe Russian fallbacks for every mobile source', () => {
    expect(buildMobileTicketBackLabel(buildMobileTicketBackContext(undefined))).toBe('← Назад к заявкам')
    expect(buildMobileTicketBackLabel(buildMobileTicketBackContext({ mobileListOrigin: 'my' }))).toBe('← Назад к моим заявкам')
    expect(buildMobileTicketBackLabel(buildMobileTicketBackContext({ mobileListOrigin: 'chat' }))).toBe('← Назад к чату')
    expect(buildMobileTicketBackLabel(buildMobileTicketBackContext({ mobileListOrigin: 'notifications' }))).toBe('← Назад к уведомлениям')
  })

  it('describes overdue context with a human location label', () => {
    const ticket = { location: { id: 'location-1', name: 'Уфа 5' }, equipment: null, pointName: null } as never
    const context = buildMobileTicketBackContext({ mobileListOrigin: 'home', homeBoardTab: 'overdue' }, ticket)
    expect(buildMobileTicketBackLabel(context, ticket)).toBe('← Назад к просроченным · Уфа 5')
  })

  it('keeps the mobile source and filters after a full reload', () => {
    const context = buildMobileTicketBackContext({
      mobileListOrigin: 'home',
      homeBoardTab: 'overdue',
      homeBoardChips: ['urgent'],
      homeBoardSearch: 'котельная',
    })
    const href = appendBoardNavigationContextToPath('/m/tickets/ticket-1', context)
    const restored = readBoardNavigationContextFromSearch(new URLSearchParams(href.split('?')[1]))

    expect(restored).toMatchObject({
      sourcePath: '/m',
      tab: 'overdue',
      chips: ['urgent'],
      search: 'котельная',
    })
    expect(buildMobileTicketBackLabel(restored)).toBe('← Назад к просроченным')
  })

  it('never exposes UUID-like source or location labels', () => {
    const ticket = { location: { id: UUID, name: UUID }, equipment: null, pointName: UUID } as never
    const context = buildMobileTicketBackContext({ mobileListOrigin: 'home', homeBoardTab: 'overdue' }, ticket)
    const label = buildMobileTicketBackLabel({ ...context, scopeLabel: UUID }, ticket)
    expect(label).toBe('← Назад к заявкам')
    expect(label).not.toContain(UUID)
  })
})

describe('mobile ticket operational actions', () => {
  it('maps descriptors one-to-one from backend capability keys', () => {
    const actions = buildMobileTicketOperationalActions({
      meta: {
        availableActions: {
          canClaim: true,
          canAssignSelf: true,
          canRequestAssignment: true,
          canStart: true,
          canComplete: true,
          canAccept: true,
          canReject: true,
          canClose: true,
        },
      },
    } as never)

    expect(actions.map((action) => action.key)).toEqual([
      'canClaim',
      'canAssignSelf',
      'canRequestAssignment',
      'canStart',
      'canComplete',
      'canAccept',
      'canReject',
      'canClose',
    ])
  })

  it('hides false actions without hints and preserves backend reasons', () => {
    const actions = buildMobileTicketOperationalActions({
      meta: {
        availableActions: { canClaim: false, canStart: false },
        availableActionHints: { canStart: 'Откройте смену' },
      },
    } as never)

    expect(actions).toEqual([{
      key: 'canStart',
      label: 'Начать работу',
      enabled: false,
      hint: 'Откройте смену',
      icon: 'bolt',
      offline: 'queue-start',
    }])
  })

  it('does not infer actions from roles or legacy flags', () => {
    expect(buildMobileTicketOperationalActions({ role: 'ADMIN', canClaim: true, meta: { canClaim: true } } as never)).toEqual([])
  })

  it('queues only the existing offline start transition', () => {
    expect(canQueueMobileTicketOperationalAction('canStart')).toBe(true)
    for (const key of ['canClaim', 'canAssignSelf', 'canRequestAssignment', 'canComplete', 'canAccept', 'canReject', 'canClose'] as const) {
      expect(canQueueMobileTicketOperationalAction(key)).toBe(false)
    }
  })
})
