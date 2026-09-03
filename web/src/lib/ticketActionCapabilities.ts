import type { TicketStatus } from './api'

type TicketClaimCapabilitySource = {
  status?: TicketStatus
  assignedTechnician?: unknown | null
  assignedTechnicianId?: string | null
  canClaim?: boolean
  canClaimByCurrentUser?: boolean
  assignmentRequestedByCurrentUser?: boolean
  meta?: {
    canClaim?: boolean
    canClaimByCurrentUser?: boolean
    assignmentRequestedByCurrentUser?: boolean
    availableActions?: {
      canClaim?: boolean
    } | null
  } | null
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

export function readBackendCanClaim(ticket: TicketClaimCapabilitySource | null | undefined): boolean {
  if (!ticket) return false

  const actionCanClaim = readBoolean(ticket.meta?.availableActions?.canClaim)
  if (actionCanClaim !== null) return actionCanClaim

  const metaCanClaim = readBoolean(ticket.meta?.canClaim)
  if (metaCanClaim !== null) return metaCanClaim

  const metaCanClaimAlias = readBoolean(ticket.meta?.canClaimByCurrentUser)
  if (metaCanClaimAlias !== null) return metaCanClaimAlias

  const cardCanClaim = readBoolean(ticket.canClaim)
  if (cardCanClaim !== null) return cardCanClaim

  const cardCanClaimAlias = readBoolean(ticket.canClaimByCurrentUser)
  if (cardCanClaimAlias !== null) return cardCanClaimAlias

  return false
}

export function canOfferTicketClaimAction(
  ticket: TicketClaimCapabilitySource | null | undefined,
  options: { executorActionsAllowed?: boolean } = {},
): boolean {
  if (!ticket) return false
  if (options.executorActionsAllowed === false) return false
  if (ticket.status !== 'NEW') return false
  if (ticket.assignedTechnicianId || ticket.assignedTechnician) return false
  if (ticket.assignmentRequestedByCurrentUser === true) return false
  if (ticket.meta?.assignmentRequestedByCurrentUser === true) return false
  return readBackendCanClaim(ticket)
}
