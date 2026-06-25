import { Link } from 'react-router-dom'
import { PageHeader } from '../mission-control/components/ui'
import { ProjectCard, ProjectEmptyState } from '../components/projects'
import { useProjects } from '../hooks/useProjects'
import { useI18n } from '../i18n'

export function ProjectsPage() {
  const { t } = useI18n()
  const { projects } = useProjects()

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.pages.projects} description={t.projects.listDescription} />
        <Link to="/ops/projects/new" className="mcBtn mcBtnPrimary">
          {t.projects.newProject}
        </Link>
      </div>

      {projects.length === 0 ? (
        <ProjectEmptyState
          title={t.projects.emptyListTitle}
          description={t.projects.emptyListDescription}
          action={
            <Link to="/ops/projects/new" className="mcBtn mcBtnPrimary">
              {t.projects.newProject}
            </Link>
          }
        />
      ) : (
        <div className="acProjectGrid">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              milestoneCount={project.milestones.length}
            />
          ))}
        </div>
      )}
    </>
  )
}
