import { Link } from 'react-router-dom'
import { PageHeader, Panel } from '../components/ui'
import { DiscussionEmptyState } from '../components/discussion/DiscussionEmptyState'
import { resolveRosterEntry } from '../data/discussion'
import { useDiscussions } from '../hooks/useDiscussion'
import { useI18n } from '../../i18n'

export function DiscussionListPage() {
  const { t } = useI18n()
  const { discussions } = useDiscussions()

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.pages.discussions} description={t.discussions.listDescription} />
        <Link to="/ops/discussions/new" className="mcBtn mcBtnPrimary">
          {t.discussions.newDiscussion}
        </Link>
      </div>

      {discussions.length === 0 ? (
        <DiscussionEmptyState
          title={t.discussions.emptyListTitle}
          description={t.discussions.emptyListDescription}
          action={
            <Link to="/ops/discussions/new" className="mcBtn mcBtnPrimary">
              {t.discussions.newDiscussion}
            </Link>
          }
        />
      ) : (
        <Panel
          title={t.discussions.allDiscussions}
          right={
            <span className="mcMono mcMuted">
              {discussions.length} {t.discussions.discussionCount}
            </span>
          }
        >
          <table className="mcTable">
            <thead>
              <tr>
                <th>{t.labels.title}</th>
                <th>{t.discussions.participants}</th>
                <th>{t.labels.status}</th>
                <th>{t.discussions.messages}</th>
                <th>{t.discussions.updated}</th>
                <th>{t.employees.actions}</th>
              </tr>
            </thead>
            <tbody>
              {discussions.map((discussion) => {
                const names = discussion.participants
                  .filter((participant) => participant.role !== 'owner')
                  .map((participant) => resolveRosterEntry(participant.employeeId)?.codename)
                  .filter(Boolean)
                  .join(', ')

                return (
                  <tr key={discussion.id}>
                    <td style={{ fontWeight: 600 }}>{discussion.title}</td>
                    <td className="mcMuted">{names || t.common.empty}</td>
                    <td className="mcMono">{t.discussions.status[discussion.status]}</td>
                    <td className="mcMono">{discussion.messages.length}</td>
                    <td className="mcMono mcMuted">
                      {new Date(discussion.updatedAt).toLocaleString()}
                    </td>
                    <td>
                      <Link to={`/ops/discussions/${discussion.id}`} className="mcBtn mcBtnSecondary mcBtnSmall">
                        {t.discussions.openDiscussion}
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  )
}
