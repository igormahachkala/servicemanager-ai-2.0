import { Link } from 'react-router-dom'
import type { Discussion } from '../../data/discussion'
import { useI18n } from '../../../i18n'

export function DiscussionHeader({ discussion }: { discussion: Discussion }) {
  const { t } = useI18n()

  return (
    <header className="mcDiscussionHeader">
      <div className="mcDiscussionHeaderTop">
        <Link to="/ops/discussions" className="mcProfileBack">
          ← {t.discussions.backToList}
        </Link>
        <span className={`mcDiscussionStatus mcDiscussionStatus${discussion.status === 'open' ? 'Open' : 'Closed'}`}>
          {t.discussions.status[discussion.status]}
        </span>
      </div>
      <h1 className="mcDiscussionTitle">{discussion.title}</h1>
      <div className="mcDiscussionHeaderMeta mcMono mcMuted">
        {discussion.participants.length} {t.discussions.participantsCount} ·{' '}
        {t.discussions.updated} {new Date(discussion.updatedAt).toLocaleString()}
      </div>
    </header>
  )
}
