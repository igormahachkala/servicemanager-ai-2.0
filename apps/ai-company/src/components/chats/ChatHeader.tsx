import { Link } from 'react-router-dom'
import type { Chat } from '../../domain/chats/chat'
import { useI18n } from '../../i18n'

export function ChatHeader({ chat }: { chat: Chat }) {
  const { t } = useI18n()
  const employeeCount = chat.participants.filter((item) => item.type === 'employee').length

  return (
    <header className="mcChatHeader">
      <div className="mcChatHeaderTop">
        <Link to="/ops/chats" className="mcProfileBack">
          ← {t.chats.backToList}
        </Link>
        <span className={`mcChatStatus mcChatStatus${capitalize(chat.status)}`}>
          {t.chats.status[chat.status]}
        </span>
      </div>
      <div className="mcChatHeaderMain">
        <h1 className="mcChatTitle">{chat.title}</h1>
        <span className={`mcChatTypeBadge mcChatTypeBadge${capitalize(chat.type)}`}>
          {t.chats.types[chat.type]}
        </span>
      </div>
      <div className="mcChatHeaderMeta mcMono mcMuted">
        {chat.workspaceId ? (
          <>
            {t.chats.workspaceLinked}: {chat.workspaceId} ·{' '}
          </>
        ) : null}
        {employeeCount} {t.chats.participants} · {t.chats.updated}{' '}
        {new Date(chat.updatedAt).toLocaleString()}
      </div>
    </header>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
