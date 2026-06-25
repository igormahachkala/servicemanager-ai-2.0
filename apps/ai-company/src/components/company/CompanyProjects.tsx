import { Link } from 'react-router-dom'
import type { Project } from '../../domain/projects'
import { useI18n } from '../../i18n'

export function CompanyProjects(props: { projects: Project[] }) {
  const { t } = useI18n()

  if (props.projects.length === 0) {
    return <div className="mcEmpty">{t.companyEngine.projects.empty}</div>
  }

  return (
    <div className="mcStack">
      {props.projects.map((project) => (
        <article key={project.id} className="mcListRow">
          <div>
            <Link to={`/ops/projects/${project.id}`} className="mcListRowTitle acLink">
              {project.title}
            </Link>
            <div className="mcMuted">{project.description || t.companyEngine.noDescription}</div>
          </div>
          <span className="mcBadge">{t.companyEngine.projectStatus[project.status]}</span>
        </article>
      ))}
      <p className="mcMuted mcFootnote">{t.companyEngine.projects.footnote}</p>
    </div>
  )
}
