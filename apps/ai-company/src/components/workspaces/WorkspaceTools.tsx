import { Link } from 'react-router-dom'
import { Panel } from '../../mission-control/components/ui'
import { ProfileEmptyBlock } from '../../mission-control/components/ProfileEmptyBlock'
import { useI18n } from '../../i18n'

export function WorkspaceTools() {
  const { t } = useI18n()

  return (
    <Panel title={t.workspaces.tabs.tools}>
      <div className="mcProfilePanelBody">
        <ProfileEmptyBlock
          badge={t.workspaces.futureBadge}
          title={t.workspaces.tools.title}
          description={t.workspaces.tools.description}
        />
        <Link to="/ops/tools" className="mcBtn mcBtnSecondary mcBtnSmall mcWorkspaceTabAction">
          {t.workspaces.tools.openCatalog}
        </Link>
      </div>
    </Panel>
  )
}
