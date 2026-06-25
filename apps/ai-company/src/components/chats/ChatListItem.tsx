import { Link } from 'react-router-dom'
import type { Chat } from '../../domain/chats/chat'
import { getLastMessagePreview } from '../../domain/chats/chat'
import { useI18n } from '../../i18n'

export function ChatListItem(props: { chat: Chat; active?: boolean }) {
  const { t } = useI18n()
  const { chat, active } = props
  const preview = getLastMessagePreview(chat)
  const participantCount = chat.participants.filter((item) => item.type === 'employee').length

  return (
    <Link
      to={`/ops/chats/${encodeURIComponent(chat.id)}`}
      className={active ? 'mcChatListItem mcChatListItemActive' : 'mcChatListItem'}
    >
      <div className="mcChatListItemHead">
        <span className="mcChatListItemTitle">{chat.title}</span>
        <span className={`mcChatTypeBadge mcChatTypeBadge${capitalize(chat.type)}`}>
          {t.chats.types[chat.type]}
        </span>
      </div>
      <div className="mcChatListItemMeta mcMono mcMuted">
        {participantCount} {t.chats.participants} · {new Date(chat.updatedAt).toLocaleString()}
      </div>
      {preview ? <div className="mcChatListItemPreview">{preview}</div> : null}
    </Link>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
