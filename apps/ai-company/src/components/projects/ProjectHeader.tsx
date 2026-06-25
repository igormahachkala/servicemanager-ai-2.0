import { Link } from 'react-router-dom'
import type { Project } from '../../domain/projects'
import { useI18n } from '../../i18n'

export function ProjectHeader({ project }: { project: Project }) {
  const { t } = useI18n()

  return (
    <header className="acProjectHeader">
      <div className="acProjectHeaderTop">
        <Link to="/ops/projects" className="mcProfileBack">
          ← {t.projects.backToList}
        </Link>
        <div className="acProjectHeaderBadges">
          <span className={`acProjectPriority acProjectPriority${capitalize(project.priority)}`}>
            {t.projects.priority[project.priority]}
          </span>
          <span className={`acProjectStatus acProjectStatus${capitalize(project.status)}`}>
            {t.projects.status[project.status]}
          </span>
        </div>
      </div>
      <h1 className="acProjectTitle">{project.title}</h1>
      {project.description ? <p className="acProjectHeaderDesc">{project.description}</p> : null}
      <div className="acProjectHeaderMeta mcMono mcMuted">
        {project.owner ? (
          <>
            {t.projects.owner}: {project.owner} ·{' '}
          </>
        ) : null}
        {t.projects.progress}: {project.progress}% ·{' '}
        {project.deadline ? (
          <>
            {t.projects.deadline}: {new Date(project.deadline).toLocaleDateString()} ·{' '}
          </>
        ) : null}
        {t.projects.updated} {new Date(project.updatedAt).toLocaleString()}
      </div>
      <div className="acProjectProgressBar" aria-hidden>
        <div className="acProjectProgressFill" style={{ width: `${project.progress}%` }} />
      </div>
    </header>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
