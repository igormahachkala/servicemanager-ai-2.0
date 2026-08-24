import * as api from '../../lib/api'
import { compactTicketAssigneeLabel } from '../../lib/ticketActorIdentity'

export type HomePrimaryActionLabel = 'Взять' | 'Запросить назначение' | 'Начать' | 'Закрыть' | null

export function getPrimaryActionLabel(
  ticket: api.TicketCard,
  meId: string | undefined,
  role: api.Role | undefined,
): HomePrimaryActionLabel {
  if (role !== 'TECHNICIAN' || !meId) return null

  if (ticket.status === 'NEW' && !ticket.assignedTechnician) {
    if (ticket.assignmentRequestedByCurrentUser) return null
    if (ticket.canClaim === true || ticket.canClaimByCurrentUser === true) return 'Взять'
    if (ticket.canRequestAssignment === true) return 'Запросить назначение'
    return null
  }

  if (ticket.status === 'ASSIGNED' && ticket.assignedTechnician?.id === meId) return 'Начать'
  if (ticket.status === 'IN_PROGRESS' && ticket.assignedTechnician?.id === meId) return 'Закрыть'
  return null
}

export function assignedTechnicianDisplay(ticket: api.TicketCard): string {
  const t = ticket.assignedTechnician
  if (!t) return 'Не назначен'
  return compactTicketAssigneeLabel(ticket)
}

export function homeTicketActionProgressLabel(
  ticket: api.TicketCard,
  actionM: { isPending: boolean; variables?: api.TicketCard },
  closeBusy: boolean,
  closeModalTicketId: string | undefined,
  assignBusy: boolean,
  assignTicketId: string | undefined,
): string | null {
  if (closeBusy && closeModalTicketId === ticket.id) return 'Завершаем…'
  if (assignBusy && assignTicketId === ticket.id) return 'Назначаем…'
  if (actionM.isPending && actionM.variables?.id === ticket.id) {
    if (ticket.status === 'NEW') {
      if (ticket.canRequestAssignment === true && !ticket.assignmentRequestedByCurrentUser) {
        return 'Отправляем запрос…'
      }
      return 'Берём заявку…'
    }
    if (ticket.status === 'ASSIGNED') return 'Начинаем…'
  }
  return null
}
