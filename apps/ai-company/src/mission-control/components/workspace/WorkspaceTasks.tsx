import { Panel } from '../ui'
import { ProfileEmptyBlock } from '../ProfileEmptyBlock'
import { useI18n } from '../../../i18n'

export function WorkspaceTasks() {
  const { t } = useI18n()

  return (
    <Panel title={t.workspaces.tabs.tasks}>
      <div className="mcProfilePanelBody">
        <ProfileEmptyBlock
          badge={t.workspaces.futureBadge}
          title={t.workspaces.tasks.title}
          description={t.workspaces.tasks.description}
        />
      </div>
    </Panel>
  )
}
