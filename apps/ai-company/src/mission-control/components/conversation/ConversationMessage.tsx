import type { ConversationMessage as ConversationMessageType } from '../../data/conversation'
import { useI18n } from '../../../i18n'

export function ConversationMessage({ message }: { message: ConversationMessageType }) {
  const { t } = useI18n()
  const isOwner = message.author.type === 'owner'
  const isSystem = message.author.type === 'system'
  const isNote = message.type === 'note'
  const isSummary = message.type === 'summary'

  if (isSystem) {
    return (
      <div className="mcConversationMessage mcConversationMessageSystem">
        <span className="mcConversationMessageMeta">{t.conversations.messageTypes.system}</span>
        <span>{message.content}</span>
      </div>
    )
  }

  if (isSummary) {
    return (
      <div className="mcConversationMessage mcConversationMessageSummary">
        <div className="mcConversationMessageHead">
          <span className="mcConversationMessageMeta">{t.conversations.messageTypes.summary}</span>
          <span className="mcConversationMessageTime">
            {new Date(message.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="mcConversationMessageBody">{message.content}</div>
      </div>
    )
  }

  const className = isOwner
    ? 'mcConversationMessage mcConversationMessageOwner'
    : isNote
      ? 'mcConversationMessage mcConversationMessageNote'
      : 'mcConversationMessage mcConversationMessageEmployee'

  return (
    <div className={className}>
      <div className="mcConversationMessageHead">
        <span className="mcConversationMessageAuthor">{message.author.displayName}</span>
        <span className="mcConversationMessageTime">
          {new Date(message.createdAt).toLocaleString()}
          {message.status !== 'sent' ? (
            <span className="mcConversationMessageStatus"> · {t.conversations.messageStatus[message.status]}</span>
          ) : null}
        </span>
      </div>
      {isNote ? (
        <span className="mcConversationMessageMeta">{t.conversations.messageTypes.note}</span>
      ) : null}
      <div className="mcConversationMessageBody">{message.content}</div>
    </div>
  )
}
