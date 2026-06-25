import { Panel } from '../../mission-control/components/ui'
import type { Project } from '../../domain/projects'
import { useEvents } from '../../hooks/useEvents'
import { useI18n } from '../../i18n'
import { formatFeedTime } from '../../mission-control/components/ui'

export function ProjectActivity({ project }: { project: Project }) {
  const { t } = useI18n()
  const { grouped } = useEvents()

  const events = grouped
    .flatMap((group) => group.events)
    .filter((event) => event.workspaceId === project.workspaceId)
    .slice(0, 10)

  return (
    <Panel title={t.projects.activity.title}>
      <p className="acMuted" style={{ marginBottom: 12 }}>
        {t.projects.activity.description}
      </p>
      {events.length === 0 ? (
        <p className="acMuted">{t.projects.activity.empty}</p>
      ) : (
        <div className="acProjectActivityList">
          {events.map((event) => (
            <div key={event.id} className="acProjectActivityRow">
              <span className="acMono acMuted">{formatFeedTime(event.createdAt)}</span>
              <span>
                {typeof event.metadata.message === 'string'
                  ? event.metadata.message
                  : typeof event.metadata.title === 'string'
                    ? event.metadata.title
                    : event.type}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
