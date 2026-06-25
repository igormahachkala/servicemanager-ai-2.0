import { Panel } from '../ui'
import { ProfileEmptyBlock } from '../ProfileEmptyBlock'
import { useI18n } from '../../../i18n'

export function WorkspaceKnowledge() {
  const { t } = useI18n()

  return (
    <Panel title={t.workspaces.tabs.knowledge}>
      <div className="mcProfilePanelBody">
        <ProfileEmptyBlock
          badge={t.workspaces.futureBadge}
          title={t.workspaces.knowledge.title}
          description={t.workspaces.knowledge.description}
        />
      </div>
    </Panel>
  )
}
