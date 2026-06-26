import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../mission-control/components/ui'
import { AI_PHOTO_LAB_PROJECT_ID } from '../domain/projects/aiPhotoLabIds'
import {
  Milestones,
  ProjectActivity,
  ProjectBoard,
  ProjectChats,
  ProjectEmptyState,
  ProjectHeader,
  ProjectHandoffs,
  ProjectKnowledge,
  ProjectOverview,
  ProjectReports,
  ProjectRuntime,
  ProjectTasks,
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
  | 'tasks'
  | 'board'
  | 'milestones'
  | 'roadmap'
  | 'timeline'
  | 'assignments'
  | 'handoffs'
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
    'tasks',
    'board',
    'milestones',
    'roadmap',
    'timeline',
    'assignments',
    'runtime',
    'handoffs',
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
      <div className="mcPageHeaderRow" style={{ marginBottom: 12 }}>
        {project.id === AI_PHOTO_LAB_PROJECT_ID ? (
          <Link
            to={`/ops/projects/${encodeURIComponent(project.id)}/control-room`}
            className="mcBtn mcBtnPrimary mcBtnSmall"
          >
            {t.photoLabControlRoom.openControlRoom}
          </Link>
        ) : null}
        <Link
          to={`/ops/collaboration?project=${encodeURIComponent(project.id)}`}
          className="mcBtn mcBtnSecondary mcBtnSmall"
        >
          {t.collaborationEngine.openProjectCollaborations}
        </Link>
      </div>

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
        {section === 'tasks' ? <ProjectTasks project={project} /> : null}
        {section === 'board' ? <ProjectBoard project={project} /> : null}
        {section === 'milestones' ? <Milestones project={project} /> : null}
        {section === 'roadmap' ? <Roadmap project={project} /> : null}
        {section === 'timeline' ? <ProjectTimeline project={project} /> : null}
        {section === 'assignments' ? (
          <WorkspaceAssignments workspaceId={project.workspaceId} />
        ) : null}
        {section === 'runtime' ? <ProjectRuntime project={project} /> : null}
        {section === 'handoffs' ? <ProjectHandoffs project={project} /> : null}
        {section === 'reports' ? <ProjectReports project={project} /> : null}
        {section === 'activity' ? <ProjectActivity project={project} /> : null}
        {section === 'chats' ? <ProjectChats project={project} /> : null}
        {section === 'knowledge' ? <ProjectKnowledge project={project} /> : null}
      </div>
    </div>
  )
}
