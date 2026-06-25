import { Link } from 'react-router-dom'
import type { Workspace } from '../../data/workspace'
import { useI18n } from '../../../i18n'

export function WorkspaceCard(props: { workspace: Workspace; assignmentCount: number }) {
  const { t } = useI18n()
  const { workspace, assignmentCount } = props

  return (
    <article className="mcWorkspaceCard">
      <div className="mcWorkspaceCardHead">
        <h3 className="mcWorkspaceCardTitle">{workspace.name}</h3>
        <span className={`mcWorkspaceStatus mcWorkspaceStatus${capitalize(workspace.status)}`}>
          {t.workspaces.status[workspace.status]}
        </span>
      </div>
      <p className="mcWorkspaceCardDesc">
        {workspace.description || t.workspaces.noDescription}
      </p>
      <div className="mcWorkspaceCardMeta mcMono mcMuted">
        {assignmentCount} {t.workspaces.assignmentCount} ·{' '}
        {t.workspaces.updated} {new Date(workspace.updatedAt).toLocaleDateString()}
      </div>
      <Link to={`/ops/workspaces/${workspace.id}`} className="mcBtn mcBtnSecondary mcBtnSmall">
        {t.workspaces.openWorkspace}
      </Link>
    </article>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
