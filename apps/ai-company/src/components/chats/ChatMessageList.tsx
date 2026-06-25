import type { ChatMessage as ChatMessageType } from '../../domain/chats/chatMessage'
import type { ChatParticipant } from '../../domain/chats/chatParticipant'
import { ChatMessage } from './ChatMessage'
import { useI18n } from '../../i18n'

export function ChatMessageList(props: {
  messages: ChatMessageType[]
  participants: ChatParticipant[]
}) {
  const { t } = useI18n()
  const names = new Map(props.participants.map((item) => [item.id, item.displayName]))

  if (props.messages.length === 0) {
    return (
      <div className="mcChatMessageList mcChatMessageListEmpty">
        <div className="mcChatEmptyInline">
          <div className="mcChatEmptyTitle">{t.chats.noMessagesTitle}</div>
          <p className="mcChatEmptyDesc">{t.chats.noMessagesDescription}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mcChatMessageList">
      {props.messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          authorName={names.get(message.authorId) ?? message.authorId}
        />
      ))}
    </div>
  )
}
