import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../components/ui'
import { DiscussionHeader } from '../components/discussion/DiscussionHeader'
import { DiscussionMessageList } from '../components/discussion/DiscussionMessageList'
import { DiscussionComposer } from '../components/discussion/DiscussionComposer'
import { DiscussionSidebar } from '../components/discussion/DiscussionSidebar'
import { DiscussionEmptyState } from '../components/discussion/DiscussionEmptyState'
import { useDiscussions } from '../hooks/useDiscussion'
import { useI18n } from '../../i18n'

export function DiscussionPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { discussions, sendOwnerMessage } = useDiscussions()
  const [sending, setSending] = useState(false)

  const discussion = useMemo(
    () => discussions.find((item) => item.id === id) ?? null,
    [discussions, id],
  )

  if (!discussion) {
    return (
      <>
        <PageHeader
          title={t.discussions.notFoundTitle}
          description={t.discussions.notFoundDescription}
        />
        <DiscussionEmptyState
          title={t.discussions.notFoundTitle}
          description={t.discussions.notFoundDescription}
          action={
            <Link to="/ops/discussions" className="mcBtn mcBtnPrimary">
              {t.discussions.backToList}
            </Link>
          }
        />
      </>
    )
  }

  const handleSend = (content: string) => {
    if (discussion.status !== 'open') return
    setSending(true)
    sendOwnerMessage(discussion.id, content, t.discussions.ownerName, {
      mockReplies: t.discussions.mockReplies,
    })
    setSending(false)
  }

  return (
    <div className="mcDiscussionPage">
      <DiscussionHeader discussion={discussion} />

      <div className="mcDiscussionLayout">
        <section className="mcDiscussionMain">
          <DiscussionMessageList messages={discussion.messages} />
          <DiscussionComposer
            disabled={discussion.status !== 'open' || sending}
            onSend={handleSend}
          />
        </section>
        <DiscussionSidebar discussion={discussion} />
      </div>
    </div>
  )
}
