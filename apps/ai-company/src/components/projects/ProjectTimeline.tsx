import { Link } from 'react-router-dom'
import { Panel } from '../../mission-control/components/ui'
import type { Project } from '../../domain/projects'
import { useEvents } from '../../hooks/useEvents'
import { useI18n } from '../../i18n'
import { formatFeedTime } from '../../mission-control/components/ui'

export function ProjectTimeline({ project }: { project: Project }) {
  const { t } = useI18n()
  const { grouped } = useEvents()

  const events = grouped
    .flatMap((group) => group.events)
    .slice(0, 12)

  const milestoneEvents = project.milestones.map((item) => ({
    id: item.id,
    at: item.dueDate ?? project.updatedAt,
    label: `${item.title} — ${item.progress}%`,
    kind: item.status === 'done' ? 'success' : 'default',
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
        {events.slice(0, 5).map((event) => (
          <div key={event.id} className="acProjectTimelineRow">
            <span className="acMono acMuted">{formatFeedTime(event.createdAt)}</span>
            <span>
              {typeof event.metadata.message === 'string'
                ? event.metadata.message
                : event.type}
            </span>
          </div>
        ))}
      </div>
      <Link to="/ops/timeline" className="mcBtn mcBtnSecondary mcBtnSmall" style={{ marginTop: 12 }}>
        {t.projects.timeline.viewCompany}
      </Link>
    </Panel>
  )
}
