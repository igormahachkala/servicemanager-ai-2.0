export type MobileTicketDetailTab = 'chat' | 'info' | 'photos' | 'actions'

/**
 * SMA-MOBILE-SERVICE-OS Phase 0+1: маппинг ?section → активная вкладка заявки.
 *
 * Обычное открытие заявки (без section) приземляется на рабочий «Инфо», а не
 * в «Чат». Deep-link в чат сохраняется: уведомление о комментарии приходит с
 * section=comments и по-прежнему открывает чат.
 */
export function notificationSectionToDetailTab(value?: string | null): MobileTicketDetailTab {
  switch ((value || '').trim()) {
    case 'attachments':
      return 'photos'
    case 'actions':
    case 'acceptance':
      return 'actions'
    case 'comments':
      return 'chat'
    case 'overview':
    case 'history':
    default:
      return 'info'
  }
}
