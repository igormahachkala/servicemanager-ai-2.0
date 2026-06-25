import type { DiscussionMessage as DiscussionMessageType } from '../../data/discussion'
import { useI18n } from '../../../i18n'

export function DiscussionMessage({ message }: { message: DiscussionMessageType }) {
  const { t } = useI18n()
  const isOwner = message.author.type === 'owner'
  const isSystem = message.author.type === 'system'

  if (isSystem) {
    return (
      <div className="mcDiscussionMessage mcDiscussionMessageSystem">
        <span className="mcDiscussionMessageMeta">{t.discussions.messageTypes.system}</span>
        <span>{message.content}</span>
      </div>
    )
  }

  return (
    <div
      className={
        isOwner ? 'mcDiscussionMessage mcDiscussionMessageOwner' : 'mcDiscussionMessage mcDiscussionMessageEmployee'
      }
    >
      <div className="mcDiscussionMessageHead">
        <span className="mcDiscussionMessageAuthor">{message.author.displayName}</span>
        <span className="mcDiscussionMessageTime">
          {new Date(message.createdAt).toLocaleString()}
        </span>
      </div>
      <div className="mcDiscussionMessageBody">{message.content}</div>
    </div>
  )
}
