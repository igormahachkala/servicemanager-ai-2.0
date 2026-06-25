import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../components/ui'
import { ConversationHeader } from '../components/conversation/ConversationHeader'
import { ConversationMessageList } from '../components/conversation/ConversationMessageList'
import { ConversationComposer } from '../components/conversation/ConversationComposer'
import { ConversationSidebar } from '../components/conversation/ConversationSidebar'
import { ConversationEmptyState } from '../components/conversation/ConversationEmptyState'
import { useConversation } from '../hooks/useConversation'
import { useI18n } from '../../i18n'

export function ConversationPage() {
  const { id: employeeId } = useParams<{ id: string }>()
  const { t } = useI18n()
  const [sending, setSending] = useState(false)

  const labels = useMemo(
    () => ({
      systemWelcome: (name: string) => t.conversations.systemWelcome.replace('{name}', name),
      ownerName: t.conversations.ownerName,
      mockReplies: t.conversations.mockReplies,
    }),
    [t],
  )

  const { conversation, employee, sendOwnerMessage } = useConversation(employeeId, labels)

  if (!employeeId || !employee) {
    return (
      <>
        <PageHeader
          title={t.conversations.notFoundTitle}
          description={t.conversations.notFoundDescription}
        />
        <ConversationEmptyState
          title={t.conversations.notFoundTitle}
          description={t.conversations.notFoundDescription}
          action={
            <Link to="/ops/employees" className="mcBtn mcBtnPrimary">
              {t.conversations.backToEmployees}
            </Link>
          }
        />
      </>
    )
  }

  if (!conversation) {
    return (
      <ConversationEmptyState
        title={t.conversations.notFoundTitle}
        description={t.conversations.notFoundDescription}
      />
    )
  }

  const handleSend = (content: string) => {
    setSending(true)
    sendOwnerMessage(content)
    setSending(false)
  }

  return (
    <div className="mcConversationPage">
      <ConversationHeader conversation={conversation} employee={employee} />

      <div className="mcConversationLayout">
        <section className="mcConversationMain">
          <ConversationMessageList messages={conversation.messages} />
          <ConversationComposer disabled={sending} onSend={handleSend} />
        </section>
        <ConversationSidebar employee={employee} />
      </div>
    </div>
  )
}
