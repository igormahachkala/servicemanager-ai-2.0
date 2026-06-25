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
            <div className="mcListRowTitle">{project.title}</div>
            <div className="mcMuted">{project.description || t.companyEngine.noDescription}</div>
          </div>
          <span className="mcBadge">{t.companyEngine.projectStatus[project.status]}</span>
        </article>
      ))}
      <p className="mcMuted mcFootnote">{t.companyEngine.projects.footnote}</p>
    </div>
  )
}
