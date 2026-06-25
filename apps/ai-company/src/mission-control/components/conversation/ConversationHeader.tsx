import { Link } from 'react-router-dom'
import type { Conversation, EmployeeRef } from '../../data/conversation'
import { useI18n } from '../../../i18n'

export function ConversationHeader(props: {
  conversation: Conversation
  employee: EmployeeRef
}) {
  const { t } = useI18n()
  const { conversation, employee } = props

  return (
    <header className="mcConversationHeader">
      <div className="mcConversationHeaderTop">
        <Link to="/ops/employees" className="mcProfileBack">
          ← {t.conversations.backToEmployees}
        </Link>
        <span className="mcConversationBadge">{t.conversations.personalDialog}</span>
      </div>
      <div className="mcConversationHeaderMain">
        <div className="mcProfileAvatar" aria-hidden>
          {employee.codename.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h1 className="mcConversationTitle">{employee.name}</h1>
          <div className="mcConversationHeaderMeta">
            <span className="mcMono">{employee.codename}</span>
            <span className="mcMuted"> · </span>
            <span>{employee.role}</span>
            <span className="mcMuted"> · </span>
            <span className="mcMono mcMuted">
              {t.conversations.updated} {new Date(conversation.updatedAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
      <p className="mcConversationSubtitle">{t.conversations.subtitle}</p>
    </header>
  )
}
