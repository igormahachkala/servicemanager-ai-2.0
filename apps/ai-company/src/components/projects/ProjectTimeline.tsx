import { Link } from 'react-router-dom'
import { Panel } from '../../mission-control/components/ui'
import type { Project } from '../../domain/projects'
import { useEvents } from '../../hooks/useEvents'
import { useI18n } from '../../i18n'
import { formatFeedTime } from '../../mission-control/components/ui'

function eventLabel(event: ReturnType<typeof useEvents>['grouped'][number]['events'][number]): string {
  if (typeof event.metadata.message === 'string') return event.metadata.message
  if (typeof event.metadata.title === 'string') return event.metadata.title
  if (typeof event.metadata.preview === 'string') return event.metadata.preview
  return event.type
}

export function ProjectTimeline({ project }: { project: Project }) {
  const { t } = useI18n()
  const { grouped } = useEvents({ scope: 'workspace', scopeId: project.workspaceId })

  const events = grouped.flatMap((group) => group.events).slice(0, 12)

  const milestoneEvents = project.milestones.map((item) => ({
    id: item.id,
    at: item.dueDate ?? project.updatedAt,
    label: `${item.title} — ${item.progress}%`,
  }))

  return (
    <Panel title={t.projects.timeline.title}>
      <p className="acMuted" style={{ marginBottom: 16 }}>
        {t.projects.timeline.description}
      </p>
      <div className="acProjectTimeline">
        {milestoneEvents.map((item) => (
          <div key={item.id} className="acProjectTimelineRow">
            <span className="acMono acMuted">{new Date(item.at).toLocaleDateString()}</span>
            <span>{item.label}</span>
          </div>
        ))}
        {events.map((event) => (
          <div key={event.id} className="acProjectTimelineRow">
            <span className="acMono acMuted">{formatFeedTime(event.createdAt)}</span>
            <span>{eventLabel(event)}</span>
          </div>
        ))}
      </div>
      <Link to="/ops/timeline" className="mcBtn mcBtnSecondary mcBtnSmall" style={{ marginTop: 12 }}>
        {t.projects.timeline.viewCompany}
      </Link>
    </Panel>
  )
}
