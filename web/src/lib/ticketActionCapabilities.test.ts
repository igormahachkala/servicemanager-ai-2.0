import { describe, expect, it } from 'vitest'
import { getPrimaryActionLabel } from '../mobile/home/utils'
import { canOfferTicketClaimAction, readBackendCanClaim } from './ticketActionCapabilities'
import { computePrimaryTicketAction } from './ticketOperationalModel'

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    status: 'NEW',
    assignedTechnician: null,
    assignedTechnicianId: null,
    canClaim: undefined,
    canClaimByCurrentUser: undefined,
    assignmentRequestedByCurrentUser: false,
    meta: {
      canClaim: undefined,
      canClaimByCurrentUser: undefined,
      assignmentRequestedByCurrentUser: false,
      availableActions: {
        canClaim: false,
        canStart: false,
        canComplete: false,
        canClose: false,
        canRequestAssignment: false,
      },
    },
    ...overrides,
  }
}

describe('ticket claim capabilities', () => {
  it('does not offer claim when backend forbids it and prefers start', () => {
    const providerAdminOwnNewTicket = ticket({
      meta: {
        availableActions: {
          canClaim: false,
          canStart: true,
          canComplete: false,
          canClose: false,
          canRequestAssignment: false,
        },
        canClaim: false,
        canClaimByCurrentUser: false,
        canRequestAssignment: false,
      },
    })
    expect(readBackendCanClaim(providerAdminOwnNewTicket)).toBe(false)
    expect(canOfferTicketClaimAction(providerAdminOwnNewTicket)).toBe(false)
    expect(
      computePrimaryTicketAction({
        ticket: providerAdminOwnNewTicket as never,
        canClaim: false,
        canChangeStatus: true,
        availableStatusTransitions: ['IN_PROGRESS'],
      })?.kind,
    ).toBe('in_progress')
  })

  it('offers claim when availableActions.canClaim is true', () => {
    const eligibleTechnician = ticket({ meta: { availableActions: { canClaim: true } } })
    expect(readBackendCanClaim(eligibleTechnician)).toBe(true)
    expect(canOfferTicketClaimAction(eligibleTechnician)).toBe(true)
    expect(
      computePrimaryTicketAction({
        ticket: eligibleTechnician as never,
        canClaim: true,
        canChangeStatus: false,
        availableStatusTransitions: [],
      })?.kind,
    ).toBe('claim')
  })

  it('labels home claim from the card flag when meta is absent', () => {
    const eligibleMaster = ticket({ canClaim: true, meta: null })
    expect(getPrimaryActionLabel(eligibleMaster as never, 'master-user', 'MASTER')).toBe('Взять')
    const blockedMaster = ticket({ canClaim: false, meta: null })
    expect(getPrimaryActionLabel(blockedMaster as never, 'master-user', 'MASTER')).toBe(null)
  })

  it('does not offer claim when a technician is already assigned', () => {
    const alreadyAssigned = ticket({
      assignedTechnicianId: 'tech-1',
      assignedTechnician: { id: 'tech-1' },
      meta: { availableActions: { canClaim: true } },
    })
    expect(canOfferTicketClaimAction(alreadyAssigned)).toBe(false)
  })

  it('follows availableActions even when a hint explains the block', () => {
    const shiftPolicyBlocked = ticket({
      meta: {
        availableActions: { canClaim: false },
        availableActionHints: { canClaim: 'Откройте смену' },
      },
    })
    expect(canOfferTicketClaimAction(shiftPolicyBlocked)).toBe(false)

    const shiftPolicyAllowed = ticket({
      meta: {
        availableActions: { canClaim: true },
        availableActionHints: { canClaim: null },
      },
    })
    expect(canOfferTicketClaimAction(shiftPolicyAllowed)).toBe(true)
  })

  it('fail-closes when availableActions.canClaim is false', () => {
    const legacyMetaAllowed = ticket({ meta: { canClaimByCurrentUser: true } })
    expect(canOfferTicketClaimAction(legacyMetaAllowed)).toBe(true)

    const failClosedOverride = ticket({
      canClaim: true,
      meta: { canClaim: true, availableActions: { canClaim: false } },
    })
    expect(canOfferTicketClaimAction(failClosedOverride)).toBe(false)
  })

  it('shows request-assignment only for a technician', () => {
    const requestOnly = ticket({ canRequestAssignment: true, meta: null })
    expect(getPrimaryActionLabel(requestOnly as never, 'tech-user', 'TECHNICIAN')).toBe('Запросить назначение')
    expect(getPrimaryActionLabel(requestOnly as never, 'admin-user', 'ADMIN')).toBe(null)
  })
})
