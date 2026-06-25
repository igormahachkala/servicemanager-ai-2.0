import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../mission-control/components/ui'
import {
  Milestones,
  ProjectActivity,
  ProjectBoard,
  ProjectEmptyState,
  ProjectHeader,
  ProjectOverview,
  ProjectReports,
  ProjectRuntime,
  ProjectTeam,
  ProjectTimeline,
  Roadmap,
} from '../components/projects'
import { WorkspaceAssignments } from '../components/workspaces/WorkspaceAssignments'
import { useProjects } from '../hooks/useProjects'
import { useI18n } from '../i18n'

type ProjectSection =
  | 'overview'
  | 'team'
  | 'board'
  | 'milestones'
  | 'roadmap'
  | 'timeline'
  | 'assignments'
  | 'runtime'
  | 'reports'
  | 'activity'
  | 'chats'
  | 'knowledge'

export function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { projects } = useProjects()
  const [section, setSection] = useState<ProjectSection>('overview')

  const project = useMemo(
    () => projects.find((item) => item.id === id) ?? null,
    [projects, id],
  )

  const sections: ProjectSection[] = [
    'overview',
    'team',
    'board',
    'milestones',
    'roadmap',
    'timeline',
    'assignments',
    'runtime',
    'reports',
    'activity',
    'chats',
    'knowledge',
  ]

  if (!project) {
    return (
      <>
        <PageHeader title={t.projects.notFoundTitle} description={t.projects.notFoundDescription} />
        <ProjectEmptyState
          title={t.projects.notFoundTitle}
          description={t.projects.notFoundDescription}
          action={
            <Link to="/ops/projects" className="mcBtn mcBtnPrimary">
              {t.projects.backToList}
            </Link>
          }
        />
      </>
    )
  }

  return (
    <div className="acProjectPage">
      <ProjectHeader project={project} />

      <nav className="mcProfileNav acProjectNav" aria-label={t.projects.navLabel}>
        {sections.map((key) => (
          <button
            key={key}
            type="button"
            className={section === key ? 'mcProfileNavItem mcProfileNavItemActive' : 'mcProfileNavItem'}
            onClick={() => setSection(key)}
          >
            {t.projects.tabs[key]}
          </button>
        ))}
      </nav>

      <div className="mcProfileContent">
        {section === 'overview' ? <ProjectOverview project={project} /> : null}
        {section === 'team' ? <ProjectTeam project={project} /> : null}
        {section === 'board' ? <ProjectBoard project={project} /> : null}
        {section === 'milestones' ? <Milestones project={project} /> : null}
        {section === 'roadmap' ? <Roadmap project={project} /> : null}
        {section === 'timeline' ? <ProjectTimeline project={project} /> : null}
        {section === 'assignments' ? (
          <WorkspaceAssignments workspaceId={project.workspaceId} />
        ) : null}
        {section === 'runtime' ? <ProjectRuntime project={project} /> : null}
        {section === 'reports' ? <ProjectReports project={project} /> : null}
        {section === 'activity' ? <ProjectActivity project={project} /> : null}
        {section === 'chats' ? (
          <div className="acProjectPlaceholder">
            <p>{t.projects.chats.description}</p>
            <Link to="/ops/chats" className="mcBtn mcBtnSecondary mcBtnSmall">
              {t.projects.chats.open}
            </Link>
          </div>
        ) : null}
        {section === 'knowledge' ? (
          <div className="acProjectPlaceholder">
            <p>{t.projects.knowledge.description}</p>
            <Link
              to={`/ops/workspaces/${encodeURIComponent(project.workspaceId)}`}
              className="mcBtn mcBtnSecondary mcBtnSmall"
            >
              {t.projects.knowledge.openWorkspace}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}
