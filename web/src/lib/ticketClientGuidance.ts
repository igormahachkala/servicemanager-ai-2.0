import type { Me, TicketGetOne, TicketStatus } from './api'

/** Подсказка для заказчика: только свой tenant и режим карточки «tenant», не техник и не просмотр чужого контура провайдером. */
export function shouldShowClientTicketLifecycleHint(
  me: Me | null | undefined,
  ticket: TicketGetOne | null | undefined,
): boolean {
  if (!me || !ticket) return false
  if (!['NEW', 'ASSIGNED', 'IN_PROGRESS', 'DONE'].includes(ticket.status)) return false
  if (me.role === 'TECHNICIAN') return false
  const vm = ticket.meta?.visibilityMode
  if (vm && vm !== 'tenant') return false
  const tc = (ticket.companyId || '').trim()
  const mc = (me.companyId || '').trim()
  return !!tc && !!mc && tc === mc
}

export function clientTicketLifecycleHintText(status: TicketStatus): string {
  if (status === 'NEW') {
    return 'Заявка ожидает назначения. Мы уведомим вас, когда техник будет назначен.'
  }
  if (status === 'ASSIGNED') {
    return 'Техник назначен. Подготовьте доступ к месту работ.'
  }
  if (status === 'IN_PROGRESS') {
    return 'Техник уже выполняет работы.'
  }
  if (status === 'DONE') {
    return 'Работы завершены. Проверьте результат и фото отчёта.'
  }
  return ''
}
