import type { Chat } from '../../domain/chats/chat'
import { ChatListItem } from './ChatListItem'
import { useI18n } from '../../i18n'

export function ChatList(props: { chats: Chat[]; activeChatId?: string }) {
  const { t } = useI18n()

  if (props.chats.length === 0) {
    return <div className="mcChatListEmpty">{t.chats.emptyListDescription}</div>
  }

  return (
    <div className="mcChatList">
      {props.chats.map((chat) => (
        <ChatListItem key={chat.id} chat={chat} active={chat.id === props.activeChatId} />
      ))}
    </div>
  )
}
