import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../components/ui'
import { WorkspaceHeader } from '../components/workspace/WorkspaceHeader'
import { WorkspaceOverview } from '../components/workspace/WorkspaceOverview'
import { WorkspaceAssignments } from '../components/workspace/WorkspaceAssignments'
import { WorkspaceKnowledge } from '../components/workspace/WorkspaceKnowledge'
import { WorkspaceDocuments } from '../components/workspace/WorkspaceDocuments'
import { WorkspaceDiscussions } from '../components/workspace/WorkspaceDiscussions'
import { WorkspaceTasks } from '../components/workspace/WorkspaceTasks'
import { WorkspaceEmptyState } from '../components/workspace/WorkspaceEmptyState'
import { useWorkspaces } from '../hooks/useWorkspaces'
import { useAssignments } from '../hooks/useAssignments'
import { useI18n } from '../../i18n'

type WorkspaceSection =
  | 'overview'
  | 'assignments'
  | 'knowledge'
  | 'documents'
  | 'discussions'
  | 'tasks'

export function WorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { workspaces } = useWorkspaces()
  const { byWorkspace } = useAssignments()
  const [section, setSection] = useState<WorkspaceSection>('overview')

  const workspace = useMemo(
    () => workspaces.find((item) => item.id === id) ?? null,
    [workspaces, id],
  )

  const sections: WorkspaceSection[] = [
    'overview',
    'assignments',
    'knowledge',
    'documents',
    'discussions',
    'tasks',
  ]

  if (!workspace) {
    return (
      <>
        <PageHeader
          title={t.workspaces.notFoundTitle}
          description={t.workspaces.notFoundDescription}
        />
        <WorkspaceEmptyState
          title={t.workspaces.notFoundTitle}
          description={t.workspaces.notFoundDescription}
          action={
            <Link to="/ops/workspaces" className="mcBtn mcBtnPrimary">
              {t.workspaces.backToList}
            </Link>
          }
        />
      </>
    )
  }

  const assignmentCount = byWorkspace(workspace.id).length

  return (
    <div className="mcWorkspacePage">
      <WorkspaceHeader workspace={workspace} />

      <nav className="mcProfileNav" aria-label={t.workspaces.navLabel}>
        {sections.map((key) => (
          <button
            key={key}
            type="button"
            className={section === key ? 'mcProfileNavItem mcProfileNavItemActive' : 'mcProfileNavItem'}
            onClick={() => setSection(key)}
          >
            {t.workspaces.tabs[key]}
          </button>
        ))}
      </nav>

      <div className="mcProfileContent">
        {section === 'overview' ? (
          <WorkspaceOverview workspace={workspace} assignmentCount={assignmentCount} />
        ) : null}
        {section === 'assignments' ? <WorkspaceAssignments workspaceId={workspace.id} /> : null}
        {section === 'knowledge' ? <WorkspaceKnowledge /> : null}
        {section === 'documents' ? <WorkspaceDocuments /> : null}
        {section === 'discussions' ? <WorkspaceDiscussions /> : null}
        {section === 'tasks' ? <WorkspaceTasks /> : null}
      </div>
    </div>
  )
}
