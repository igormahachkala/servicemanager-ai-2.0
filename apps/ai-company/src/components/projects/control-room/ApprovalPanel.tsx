import { Link } from 'react-router-dom'
import type { AiPhotoLabControlRoomSnapshot } from '../../../domain/projects/aiPhotoLabControlRoom'
import { Panel } from '../../../mission-control/components/ui'
import { useI18n } from '../../../i18n'
import { approvalPriorityLabel, ownerDecisionKindLabel } from '../../../i18n/uiLabels'

type Props = {
  snapshot: AiPhotoLabControlRoomSnapshot
}

export function ApprovalPanel({ snapshot }: Props) {
  const { t } = useI18n()

  return (
    <Panel
      title={t.photoLabControlRoom.sections.decisions}
      right={
        <Link to="/ops/approvals" className="mcLink">
          {t.photoLabControlRoom.openApprovals}
        </Link>
      }
    >
      <div className="mcProfilePanelBody">
        <h4 className="mcControlRoomSubhead">{t.photoLabControlRoom.ownerDecisions}</h4>
        {snapshot.ownerDecisions.length === 0 ? (
          <div className="mcControlRoomEmpty">{t.photoLabControlRoom.empty.decisions}</div>
        ) : (
          <ul className="mcControlRoomDecisionList">
            {snapshot.ownerDecisions.map((decision) => (
              <li key={decision.id} className="mcControlRoomDecisionCard">
                <div className="mcControlRoomDecisionHead">
                  <span className="mcControlRoomDecisionKind">{ownerDecisionKindLabel(t, decision.kind)}</span>
                  <span className={`mcControlRoomBadge mcControlRoomPriority${decision.priority}`}>
                    {approvalPriorityLabel(t, decision.priority)}
                  </span>
                </div>
                <div className="mcControlRoomDecisionTitle">{decision.title}</div>
                <p className="mcMuted">{decision.description}</p>
                {decision.href ? (
                  <Link to={decision.href} className="mcLink">
                    {t.photoLabControlRoom.reviewDecision}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {snapshot.pendingApprovals.length > 0 ? (
          <>
            <h4 className="mcControlRoomSubhead">{t.photoLabControlRoom.pendingApprovals}</h4>
            <ul className="mcControlRoomApprovalList">
              {snapshot.pendingApprovals.map((approval) => (
                <li key={approval.id}>
                  <Link to={`/ops/approvals/${encodeURIComponent(approval.id)}`} className="mcLink">
                    {approval.title}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </Panel>
  )
}
