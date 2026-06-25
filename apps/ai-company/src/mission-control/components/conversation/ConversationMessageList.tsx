import type { ConversationMessage as ConversationMessageType } from '../../data/conversation'
import { ConversationMessage } from './ConversationMessage'
import { ConversationEmptyState } from './ConversationEmptyState'
import { useI18n } from '../../../i18n'

export function ConversationMessageList({ messages }: { messages: ConversationMessageType[] }) {
  const { t } = useI18n()

  const dialogueMessages = messages.filter(
    (message) => message.type === 'message' || message.type === 'note' || message.type === 'summary',
  )

  if (messages.length === 0) {
    return (
      <ConversationEmptyState
        title={t.conversations.noMessagesTitle}
        description={t.conversations.noMessagesDescription}
      />
    )
  }

  return (
    <div className="mcConversationMessageList">
      {messages.map((message) => (
        <ConversationMessage key={message.id} message={message} />
      ))}
      {dialogueMessages.length === 0 ? (
        <div className="mcConversationEmptyInline">
          <div className="mcConversationEmptyTitle">{t.conversations.noMessagesTitle}</div>
          <p className="mcConversationEmptyDesc">{t.conversations.noMessagesDescription}</p>
        </div>
      ) : null}
    </div>
  )
}
