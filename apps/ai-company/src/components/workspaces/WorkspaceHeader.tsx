import { Link } from 'react-router-dom'
import type { Workspace } from '../../domain/workspaces/workspace'
import { useI18n } from '../../i18n'

export function WorkspaceHeader({ workspace }: { workspace: Workspace }) {
  const { t } = useI18n()

  return (
    <header className="mcWorkspaceHeader">
      <div className="mcWorkspaceHeaderTop">
        <Link to="/ops/workspaces" className="mcProfileBack">
          ← {t.workspaces.backToList}
        </Link>
        <div className="mcWorkspaceHeaderBadges">
          <span className="mcWorkspaceTypeBadge">{t.workspaces.type[workspace.type]}</span>
          <span className={`mcWorkspaceStatus mcWorkspaceStatus${capitalize(workspace.status)}`}>
            {t.workspaces.status[workspace.status]}
          </span>
        </div>
      </div>
      <h1 className="mcWorkspaceTitle">{workspace.name}</h1>
      {workspace.description ? (
        <p className="mcWorkspaceHeaderDesc">{workspace.description}</p>
      ) : null}
      <div className="mcWorkspaceHeaderMeta mcMono mcMuted">
        {workspace.owner ? (
          <>
            {t.workspaces.owner}: {workspace.owner} ·{' '}
          </>
        ) : null}
        {t.workspaces.created} {new Date(workspace.createdAt).toLocaleString()} ·{' '}
        {t.workspaces.updated} {new Date(workspace.updatedAt).toLocaleString()}
      </div>
    </header>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
