import type * as api from './api'

export function inspectionRunStatusLabel(status: api.InspectionRunStatus): string {
  if (status === 'IN_PROGRESS') return 'В процессе'
  if (status === 'COMPLETED') return 'Завершён'
  return 'Статус не определён'
}

export function inspectionItemStatusLabel(status: api.InspectionRunItemStatus): string {
  if (status === 'PENDING') return 'Не заполнено'
  if (status === 'OK') return 'Норма'
  if (status === 'ISSUE') return 'Проблема'
  if (status === 'CRITICAL') return 'Критично'
  if (status === 'SKIPPED') return 'Пропущено'
  return 'Статус не определён'
}

export function inspectionReportStatusLabel(status: api.InspectionReportStatus): string {
  if (status === 'DRAFT') return 'Отчёт: черновик'
  if (status === 'SUBMITTED') return 'Отчёт отправлен на проверку'
  if (status === 'APPROVED') return 'Отчёт утверждён'
  if (status === 'REJECTED') return 'Отчёт возвращён'
  return 'Статус отчёта не определён'
}

export function inspectionTicketUrgencyLabel(status: 'ISSUE' | 'CRITICAL'): string {
  return status === 'CRITICAL' ? 'Срочная заявка' : 'Обычная заявка'
}

export function ticketUrgencyLabel(urgency?: api.TicketUrgency | null): string | null {
  if (urgency === 'URGENT') return 'Срочная заявка'
  if (urgency === 'NOT_URGENT') return 'Обычная заявка'
  return null
}

export function ticketStatusLabel(status: api.TicketStatus): string {
  if (status === 'NEW') return 'Новая'
  if (status === 'ASSIGNED') return 'Назначена'
  if (status === 'IN_PROGRESS') return 'В работе'
  if (status === 'AWAITING_ACCEPTANCE') return 'Ожидает приёмки'
  if (status === 'DONE') return 'Завершена'
  if (status === 'CANCELED') return 'Отменена'
  return 'Статус не определён'
}
