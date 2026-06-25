import { Panel } from '../ui'
import { ProfileEmptyBlock } from '../ProfileEmptyBlock'
import { useI18n } from '../../../i18n'

export function WorkspaceDocuments() {
  const { t } = useI18n()

  return (
    <Panel title={t.workspaces.tabs.documents}>
      <div className="mcProfilePanelBody">
        <ProfileEmptyBlock
          badge={t.workspaces.futureBadge}
          title={t.workspaces.documents.title}
          description={t.workspaces.documents.description}
        />
      </div>
    </Panel>
  )
}
