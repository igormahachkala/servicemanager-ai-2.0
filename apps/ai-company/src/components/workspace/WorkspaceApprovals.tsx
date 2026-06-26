import { Link } from 'react-router-dom'
import { ApprovalCard } from '../approval/ApprovalCard'
import type { EmployeeWorkspaceSnapshot } from '../../hooks/useEmployeeWorkspace'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

export function WorkspaceApprovals({ snapshot }: { snapshot: EmployeeWorkspaceSnapshot }) {
  const { t } = useI18n()

  return (
    <Panel
      title={t.employeeWorkspace.sections.approvals}
      right={
        <Link to="/ops/approvals" className="mcBtn mcBtnSecondary mcBtnSm">
          {t.employeeWorkspace.openApprovals}
        </Link>
      }
    >
      <div className="mcProfilePanelBody acWorkspaceApprovalList">
        {snapshot.approvals.length === 0 ? (
          <p className="mcMuted">{t.employeeWorkspace.empty.approvals}</p>
        ) : (
          snapshot.approvals.map((approval) => (
            <Link key={approval.id} to={`/ops/approvals/${approval.id}`} className="acWorkspaceApprovalLink">
              <ApprovalCard approval={approval} />
            </Link>
          ))
        )}
      </div>
    </Panel>
  )
}
