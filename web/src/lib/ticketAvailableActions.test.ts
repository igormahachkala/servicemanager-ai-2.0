import { describe, expect, it } from 'vitest'

import { buildTicketAvailableActionDescriptors } from './ticketAvailableActions'

describe('ticket available action descriptors', () => {
  it('maps enabled actions exactly from backend availableActions keys', () => {
    const descriptors = buildTicketAvailableActionDescriptors({
      meta: {
        availableActions: {
          canClaim: true,
          canAssignSelf: true,
          canStart: true,
          canComplete: true,
          canClose: true,
          canAccept: true,
          canReject: true,
          canRequestAssignment: true,
        },
      },
    } as never)

    expect(descriptors.map((item) => item.key)).toEqual([
      'canClaim',
      'canAssignSelf',
      'canRequestAssignment',
      'canStart',
      'canComplete',
      'canAccept',
      'canReject',
      'canClose',
    ])
    expect(descriptors.every((item) => item.enabled)).toBe(true)
  })

  it('hides false actions without backend hints', () => {
    const descriptors = buildTicketAvailableActionDescriptors({
      meta: {
        availableActions: {
          canClaim: false,
          canAssignSelf: false,
          canStart: false,
          canComplete: false,
          canClose: false,
          canAccept: false,
          canReject: false,
          canRequestAssignment: false,
        },
      },
    } as never)

    expect(descriptors).toEqual([])
  })

  it('preserves meaningful backend hints as disabled actions', () => {
    const descriptors = buildTicketAvailableActionDescriptors({
      meta: {
        availableActions: {
          canClaim: false,
          canAssignSelf: false,
          canStart: false,
          canComplete: false,
          canClose: false,
          canAccept: false,
          canReject: false,
          canRequestAssignment: false,
        },
        availableActionHints: {
          canStart: 'Откройте смену',
          canComplete: 'Добавьте фото',
        },
      },
    } as never)

    expect(descriptors).toEqual([
      { key: 'canStart', label: 'Начать работу', enabled: false, hint: 'Откройте смену' },
      { key: 'canComplete', label: 'Отправить на приёмку', enabled: false, hint: 'Добавьте фото' },
    ])
  })

  it('does not infer actions from frontend roles or legacy flags when availableActions is missing', () => {
    expect(
      buildTicketAvailableActionDescriptors({
        canClaim: true,
        role: 'ADMIN',
        meta: { canClaim: true },
      } as never),
    ).toEqual([])
  })
})
