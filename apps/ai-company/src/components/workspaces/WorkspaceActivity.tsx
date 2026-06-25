import { Panel } from '../../mission-control/components/ui'
import { ProfileEmptyBlock } from '../../mission-control/components/ProfileEmptyBlock'
import { useI18n } from '../../i18n'

export function WorkspaceActivity() {
  const { t } = useI18n()

  return (
    <Panel title={t.workspaces.tabs.activity}>
      <div className="mcProfilePanelBody">
        <ProfileEmptyBlock
          badge={t.workspaces.futureBadge}
          title={t.workspaces.activity.title}
          description={t.workspaces.activity.description}
        />
      </div>
    </Panel>
  )
}
