import { Panel } from '../../mission-control/components/ui'
import type { Project } from '../../domain/projects'
import { useI18n } from '../../i18n'

export function Milestones({ project }: { project: Project }) {
  const { t } = useI18n()

  return (
    <Panel title={t.projects.milestones.title}>
      <div className="mcProfilePanelBody">
        {project.milestones.length === 0 ? (
          <p className="acMuted">{t.projects.milestones.empty}</p>
        ) : (
          <div className="acProjectMilestoneList">
            {project.milestones.map((item) => (
              <div key={item.id} className="acProjectMilestoneRow">
                <div className="acProjectMilestoneMain">
                  <div className="acProjectMilestoneTitle">{item.title}</div>
                  {item.description ? (
                    <div className="acMuted" style={{ fontSize: 13 }}>
                      {item.description}
                    </div>
                  ) : null}
                </div>
                <div className="acProjectMilestoneMeta">
                  <span className={`acProjectMilestoneStatus acProjectMilestoneStatus${capitalize(item.status)}`}>
                    {t.projects.milestones.status[item.status]}
                  </span>
                  <span className="acMono acMuted">{item.progress}%</span>
                  {item.dueDate ? (
                    <span className="acMono acMuted">
                      {new Date(item.dueDate).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
                <div className="acProjectProgressBar acProjectProgressBarSmall" aria-hidden>
                  <div className="acProjectProgressFill" style={{ width: `${item.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
