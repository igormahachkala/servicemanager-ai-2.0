import { Link } from 'react-router-dom'
import type { Project } from '../../domain/projects'
import { useI18n } from '../../i18n'

export function ProjectCard(props: { project: Project; milestoneCount: number }) {
  const { t } = useI18n()
  const { project, milestoneCount } = props

  return (
    <article className="acProjectCard">
      <div className="acProjectCardHead">
        <h3 className="acProjectCardTitle">{project.title}</h3>
        <span className={`acProjectStatus acProjectStatus${capitalize(project.status)}`}>
          {t.projects.status[project.status]}
        </span>
      </div>
      <p className="acProjectCardDesc">{project.description || t.projects.noDescription}</p>
      <div className="acProjectProgressBar acProjectProgressBarSmall" aria-hidden>
        <div className="acProjectProgressFill" style={{ width: `${project.progress}%` }} />
      </div>
      <div className="acProjectCardMeta mcMono mcMuted">
        {t.projects.priority[project.priority]} · {project.progress}% · {milestoneCount}{' '}
        {t.projects.milestones.short} · {t.projects.updated}{' '}
        {new Date(project.updatedAt).toLocaleDateString()}
      </div>
      <Link to={`/ops/projects/${project.id}`} className="mcBtn mcBtnSecondary mcBtnSmall">
        {t.projects.openProject}
      </Link>
    </article>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
