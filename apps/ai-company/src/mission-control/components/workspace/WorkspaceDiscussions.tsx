import { Link } from 'react-router-dom'
import { Panel } from '../ui'
import { ProfileEmptyBlock } from '../ProfileEmptyBlock'
import { useI18n } from '../../../i18n'

export function WorkspaceDiscussions() {
  const { t } = useI18n()

  return (
    <Panel title={t.workspaces.tabs.discussions}>
      <div className="mcProfilePanelBody">
        <ProfileEmptyBlock
          badge={t.workspaces.futureBadge}
          title={t.workspaces.discussions.title}
          description={t.workspaces.discussions.description}
        />
        <div className="mcWorkspaceTabAction">
          <Link to="/ops/discussions" className="mcBtn mcBtnSecondary mcBtnSmall">
            {t.workspaces.discussions.openGlobal}
          </Link>
        </div>
      </div>
    </Panel>
  )
}
