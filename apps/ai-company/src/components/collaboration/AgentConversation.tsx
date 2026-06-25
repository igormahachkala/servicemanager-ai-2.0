import type { CollaborationMessage } from '../../domain/collaboration/collaborationMessage'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  messages: CollaborationMessage[]
}

export function AgentConversation({ messages }: Props) {
  const { t } = useI18n()

  return (
    <Panel title={t.collaborationEngine.sections.conversation}>
      <div className="mcProfilePanelBody">
        {messages.length === 0 ? (
          <div className="mcCollabEmpty">{t.collaborationEngine.empty.messages}</div>
        ) : (
          <div className="mcCollabConversation">
            {messages.map((message) => (
              <article key={message.id} className="mcCollabMessage">
                <header className="mcCollabMessageHead">
                  <span className="mcCollabMessageAuthor">{message.authorCodename}</span>
                  <span className="mcCollabMessageRole mcMuted">{message.authorRole}</span>
                  <span className={`mcCollabMessageKind mcCollabMessageKind${message.kind}`}>
                    {t.collaborationEngine.messageKinds[message.kind]}
                  </span>
                  <time className="mcCollabMessageTime mcMono" dateTime={message.createdAt}>
                    {message.createdAt.slice(11, 16)}
                  </time>
                </header>
                <p className="mcCollabMessageContent">{message.content}</p>
                {message.replyToId ? (
                  <div className="mcCollabMessageReply mcMuted">
                    {t.collaborationEngine.inReplyTo} {message.replyToId.replace('cmsg-', '').replace(/-/g, ' ')}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}
