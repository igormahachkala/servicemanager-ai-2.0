import type { DiscussionMessage as DiscussionMessageType } from '../../data/discussion'
import { DiscussionMessage } from './DiscussionMessage'
import { DiscussionEmptyState } from './DiscussionEmptyState'
import { useI18n } from '../../../i18n'

export function DiscussionMessageList({ messages }: { messages: DiscussionMessageType[] }) {
  const { t } = useI18n()

  if (messages.length === 0) {
    return (
      <DiscussionEmptyState
        title={t.discussions.noMessagesTitle}
        description={t.discussions.noMessagesDescription}
      />
    )
  }

  return (
    <div className="mcDiscussionMessageList">
      {messages.map((message) => (
        <DiscussionMessage key={message.id} message={message} />
      ))}
    </div>
  )
}
