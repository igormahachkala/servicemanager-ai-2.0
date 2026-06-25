import type { ChatMessage as ChatMessageType } from '../../domain/chats/chatMessage'
import { useI18n } from '../../i18n'

export function ChatMessage(props: { message: ChatMessageType; authorName: string }) {
  const { t } = useI18n()
  const { message, authorName } = props
  const isOwner = message.authorType === 'owner'
  const isSystem = message.authorType === 'system'
  const isNote = message.type === 'note'
  const isSummary = message.type === 'summary'
  const isDecision = message.type === 'decision'

  if (isSystem) {
    return (
      <div className="mcChatMessage mcChatMessageSystem">
        <span className="mcChatMessageMeta">{t.chats.messageTypes.system}</span>
        <span>{message.content}</span>
      </div>
    )
  }

  if (isSummary) {
    return (
      <div className="mcChatMessage mcChatMessageSummary">
        <div className="mcChatMessageHead">
          <span className="mcChatMessageMeta">{t.chats.messageTypes.summary}</span>
          <span className="mcChatMessageTime">
            {new Date(message.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="mcChatMessageBody">{message.content}</div>
        <PromoteActions />
      </div>
    )
  }

  if (isDecision) {
    return (
      <div className="mcChatMessage mcChatMessageDecision">
        <div className="mcChatMessageHead">
          <span className="mcChatMessageMeta">{t.chats.messageTypes.decision}</span>
          <span className="mcChatMessageTime">
            {new Date(message.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="mcChatMessageBody">{message.content}</div>
        <PromoteActions />
      </div>
    )
  }

  const className = isOwner
    ? 'mcChatMessage mcChatMessageOwner'
    : isNote
      ? 'mcChatMessage mcChatMessageNote'
      : 'mcChatMessage mcChatMessageEmployee'

  return (
    <div className={className}>
      <div className="mcChatMessageHead">
        <span className="mcChatMessageAuthor">{authorName}</span>
        <span className="mcChatMessageTime">
          {new Date(message.createdAt).toLocaleString()}
          {message.status !== 'sent' ? (
            <span className="mcChatMessageStatus"> · {t.chats.messageStatus[message.status]}</span>
          ) : null}
        </span>
      </div>
      {isNote ? <span className="mcChatMessageMeta">{t.chats.messageTypes.note}</span> : null}
      <div className="mcChatMessageBody">{message.content}</div>
      {!isSystem ? <PromoteActions /> : null}
    </div>
  )
}

function PromoteActions() {
  const { t } = useI18n()

  return (
    <div className="mcChatPromoteActions">
      <span className="mcChatFutureBadge">{t.chats.futureBadge}</span>
      <button type="button" className="mcBtn mcBtnSecondary mcBtnSmall" disabled>
        {t.chats.promote.createTask}
      </button>
      <button type="button" className="mcBtn mcBtnSecondary mcBtnSmall" disabled>
        {t.chats.promote.createReport}
      </button>
      <button type="button" className="mcBtn mcBtnSecondary mcBtnSmall" disabled>
        {t.chats.promote.createAdr}
      </button>
      <button type="button" className="mcBtn mcBtnSecondary mcBtnSmall" disabled>
        {t.chats.promote.createDocument}
      </button>
    </div>
  )
}
