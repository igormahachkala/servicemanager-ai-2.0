import { Panel } from '../../mission-control/components/ui'
import type { Workspace } from '../../domain/workspaces/workspace'
import { useI18n } from '../../i18n'

export function WorkspaceOverview(props: { workspace: Workspace; assignmentCount: number }) {
  const { t } = useI18n()
  const { workspace, assignmentCount } = props

  return (
    <div className="mcProfileGrid">
      <Panel title={t.workspaces.overview.summary}>
        <div className="mcProfilePanelBody">
          <div className="mcProfileFieldGrid">
            <div className="mcProfileField">
              <div className="mcProfileFieldLabel">{t.labels.name}</div>
              <div className="mcProfileFieldValue">{workspace.name}</div>
            </div>
            <div className="mcProfileField">
              <div className="mcProfileFieldLabel">{t.workspaces.typeLabel}</div>
              <div className="mcProfileFieldValue mcMono">{t.workspaces.type[workspace.type]}</div>
            </div>
            <div className="mcProfileField">
              <div className="mcProfileFieldLabel">{t.labels.status}</div>
              <div className="mcProfileFieldValue mcMono">{t.workspaces.status[workspace.status]}</div>
            </div>
            <div className="mcProfileField">
              <div className="mcProfileFieldLabel">{t.workspaces.owner}</div>
              <div className="mcProfileFieldValue">
                {workspace.owner || t.workspaces.noOwner}
              </div>
            </div>
            <div className="mcProfileField">
              <div className="mcProfileFieldLabel">{t.workspaces.overview.employees}</div>
              <div className="mcProfileFieldValue mcMono">{assignmentCount}</div>
            </div>
            <div className="mcProfileField">
              <div className="mcProfileFieldLabel">{t.workspaces.overview.description}</div>
              <div className="mcProfileFieldValue">
                {workspace.description || t.workspaces.noDescription}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title={t.workspaces.overview.purpose}>
        <div className="mcProfilePanelBody">
          <p className="mcWorkspacePurposeText">{t.workspaces.overview.purposeText}</p>
        </div>
      </Panel>
    </div>
  )
}
