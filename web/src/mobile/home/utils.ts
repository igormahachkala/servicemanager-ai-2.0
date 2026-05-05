import * as api from '../../lib/api'

export type HomePrimaryActionLabel = 'Взять' | 'Запросить назначение' | 'Начать' | 'Закрыть' | null

export function getPrimaryActionLabel(
  ticket: api.TicketCard,
  meId: string | undefined,
  role: api.Role | undefined,
): HomePrimaryActionLabel {
  if (!api.allowMobileHomeFieldTicketActions(role) || !meId) return null
  if (ticket.status === 'NEW' && !ticket.assignedTechnician) {
    if (role === 'TECHNICIAN' && ticket.assignmentRequestedByCurrentUser) return null
    if (role === 'TECHNICIAN' && ticket.canClaimByCurrentUser === false) return 'Запросить назначение'
    return 'Взять'
  }
  if (ticket.status === 'ASSIGNED' && ticket.assignedTechnician?.id === meId) return 'Начать'
  if (ticket.status === 'IN_PROGRESS' && ticket.assignedTechnician?.id === meId) return 'Закрыть'
  return null
}

export function assignedTechnicianDisplay(ticket: api.TicketCard): string {
  const t = ticket.assignedTechnician
  if (!t) return 'Не назначен'
  const email = (t.email || '').trim()
  if (email) return email
  return (t.id || '').trim() || 'Не назначен'
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
      if (ticket.canClaimByCurrentUser === false && !ticket.assignmentRequestedByCurrentUser) {
        return 'Отправляем запрос…'
      }
      return 'Берём заявку…'
    }
    if (ticket.status === 'ASSIGNED') return 'Начинаем…'
  }
  return null
}
