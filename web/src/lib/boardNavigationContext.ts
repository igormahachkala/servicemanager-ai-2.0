import type { TicketStatus } from './api'

export type BoardNavigationContext = {
  selectedLocationId?: string
  selectedEquipmentId?: string
  selectedStatus?: TicketStatus | ''
  includeArchived?: boolean
}

export type BoardTicketNavState = {
  boardContext?: BoardNavigationContext
}

export function sanitizeBoardNavigationContext(
  ctx: BoardNavigationContext | null | undefined,
): BoardNavigationContext | undefined {
  if (!ctx) return undefined
  const next: BoardNavigationContext = {}
  const locationId = (ctx.selectedLocationId || '').trim()
  const equipmentId = (ctx.selectedEquipmentId || '').trim()
  const status = (ctx.selectedStatus || '').trim() as TicketStatus | ''
  if (locationId) next.selectedLocationId = locationId
  if (equipmentId) next.selectedEquipmentId = equipmentId
  if (status === 'NEW' || status === 'ASSIGNED' || status === 'IN_PROGRESS' || status === 'DONE' || status === 'CANCELED') {
    next.selectedStatus = status
  }
  if (ctx.includeArchived) next.includeArchived = true
  if (!next.selectedLocationId && !next.selectedEquipmentId && !next.selectedStatus && !next.includeArchived) {
    return undefined
  }
  return next
}
