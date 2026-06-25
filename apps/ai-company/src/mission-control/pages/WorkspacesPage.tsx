import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui'
import { WorkspaceCard } from '../components/workspace/WorkspaceCard'
import { WorkspaceEmptyState } from '../components/workspace/WorkspaceEmptyState'
import { useWorkspaces } from '../hooks/useWorkspaces'
import { useAssignments } from '../hooks/useAssignments'
import { useI18n } from '../../i18n'

export function WorkspacesPage() {
  const { t } = useI18n()
  const { workspaces } = useWorkspaces()
  const { assignments } = useAssignments()

  const countByWorkspace = (workspaceId: string) =>
    assignments.filter((item) => item.workspaceId === workspaceId).length

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.pages.workspaces} description={t.workspaces.listDescription} />
        <Link to="/ops/workspaces/new" className="mcBtn mcBtnPrimary">
          {t.workspaces.newWorkspace}
        </Link>
      </div>

      {workspaces.length === 0 ? (
        <WorkspaceEmptyState
          title={t.workspaces.emptyListTitle}
          description={t.workspaces.emptyListDescription}
          action={
            <Link to="/ops/workspaces/new" className="mcBtn mcBtnPrimary">
              {t.workspaces.newWorkspace}
            </Link>
          }
        />
      ) : (
        <div className="mcWorkspaceGrid">
          {workspaces.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              assignmentCount={countByWorkspace(workspace.id)}
            />
          ))}
        </div>
      )}
    </>
  )
}
