import { Panel } from '../ui'
import { DiscussionParticipants } from './DiscussionParticipants'
import type { Discussion } from '../../data/discussion'
import { useI18n } from '../../../i18n'

function SidebarPlaceholder(props: { title: string; description: string }) {
  const { t } = useI18n()

  return (
    <div className="mcDiscussionSidebarPlaceholder">
      <div className="mcDiscussionSidebarPlaceholderTitle">{props.title}</div>
      <p className="mcDiscussionSidebarPlaceholderDesc">{props.description}</p>
      <span className="mcDiscussionFutureBadge">{t.discussions.futureBadge}</span>
    </div>
  )
}

export function DiscussionSidebar({ discussion }: { discussion: Discussion }) {
  const { t } = useI18n()

  return (
    <aside className="mcDiscussionSidebar">
      <Panel title={t.discussions.sidebar.participants}>
        <div className="mcProfilePanelBody">
          <DiscussionParticipants participants={discussion.participants} />
        </div>
      </Panel>

      <Panel title={t.discussions.sidebar.pinnedNotes}>
        <div className="mcProfilePanelBody">
          <SidebarPlaceholder
            title={t.discussions.sidebar.pinnedNotes}
            description={t.discussions.sidebar.pinnedNotesDesc}
          />
        </div>
      </Panel>

      <Panel title={t.discussions.sidebar.decision}>
        <div className="mcProfilePanelBody">
          <SidebarPlaceholder
            title={t.discussions.sidebar.decision}
            description={t.discussions.sidebar.decisionDesc}
          />
        </div>
      </Panel>

      <Panel title={t.discussions.sidebar.relatedTasks}>
        <div className="mcProfilePanelBody">
          <SidebarPlaceholder
            title={t.discussions.sidebar.relatedTasks}
            description={t.discussions.sidebar.relatedTasksDesc}
          />
        </div>
      </Panel>

      <Panel title={t.discussions.sidebar.artifacts}>
        <div className="mcProfilePanelBody">
          <SidebarPlaceholder
            title={t.discussions.sidebar.artifacts}
            description={t.discussions.sidebar.artifactsDesc}
          />
        </div>
      </Panel>
    </aside>
  )
}
