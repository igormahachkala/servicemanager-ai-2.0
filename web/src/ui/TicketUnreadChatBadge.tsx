import type { TicketCard } from '../lib/api'

export const UNREAD_CHAT_LABEL = 'Есть непрочитанные сообщения'

/** 💬 на карточке списка, пока в чате заявки есть непрочитанные сообщения. */
export function TicketUnreadChatBadge({ ticket }: { ticket: Pick<TicketCard, 'hasUnreadChat'> }) {
  if (!ticket.hasUnreadChat) return null
  return (
    <span className="ticketUnreadChat" role="img" aria-label={UNREAD_CHAT_LABEL} title={UNREAD_CHAT_LABEL}>
      💬
    </span>
  )
}
