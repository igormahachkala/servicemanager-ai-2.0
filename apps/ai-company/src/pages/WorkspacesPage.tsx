import { Link } from 'react-router-dom'
import { PageHeader } from '../mission-control/components/ui'
import { WorkspaceCard } from '../components/workspaces/WorkspaceCard'
import { WorkspaceEmptyState } from '../components/workspaces/WorkspaceEmptyState'
import { useWorkspaces } from '../hooks/useWorkspaces'
import { useAssignments } from '../hooks/useAssignments'
import { useI18n } from '../i18n'

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
        <>
          <WorkspaceEmptyState
            action={
              <Link to="/ops/workspaces/new" className="mcBtn mcBtnPrimary">
                {t.workspaces.newWorkspace}
              </Link>
            }
          />
          <p className="mcMemoryLocalNote">{t.workspaces.localOnly}</p>
        </>
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
