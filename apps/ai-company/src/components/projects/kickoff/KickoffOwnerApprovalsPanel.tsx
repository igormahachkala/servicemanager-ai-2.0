import { Link } from 'react-router-dom'
import type { AiPhotoLabKickoffSnapshot } from '../../../domain/projects/aiPhotoLabKickoff'
import { Panel } from '../../../mission-control/components/ui'
import { useI18n } from '../../../i18n'
import { approvalPriorityLabel } from '../../../i18n/uiLabels'

type Props = {
  snapshot: AiPhotoLabKickoffSnapshot
}

export function KickoffOwnerApprovalsPanel({ snapshot }: Props) {
  const { t } = useI18n()

  return (
    <Panel title={t.photoLabKickoff.sections.ownerApprovals}>
      <div className="acKickoffPanelBody">
        <h3 className="acKickoffSubhead">{t.photoLabKickoff.owner.decisions}</h3>
        {snapshot.ownerDecisions.length === 0 ? (
          <p className="acMuted">{t.photoLabKickoff.owner.noDecisions}</p>
        ) : (
          <ul className="acKickoffDecisionList">
            {snapshot.ownerDecisions.map((item) => (
              <li key={item.id} className="acKickoffDecisionRow">
                <div>
                  <strong>{item.title}</strong>
                  <p className="acMuted">{item.description}</p>
                </div>
                <span className="acKickoffBadge">{approvalPriorityLabel(t, item.priority)}</span>
                {item.href ? (
                  <Link to={item.href} className="mcLink">
                    {t.photoLabKickoff.actions.review}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <h3 className="acKickoffSubhead">{t.photoLabKickoff.owner.approvals}</h3>
        {snapshot.pendingApprovals.length === 0 ? (
          <p className="acMuted">{t.photoLabKickoff.owner.noApprovals}</p>
        ) : (
          <ul className="acKickoffDecisionList">
            {snapshot.pendingApprovals.map((item) => (
              <li key={item.id} className="acKickoffDecisionRow">
                <div>
                  <strong>{item.title}</strong>
                  <p className="acMuted">{item.description}</p>
                </div>
                <Link to={`/ops/approvals/${encodeURIComponent(item.id)}`} className="mcLink">
                  {t.photoLabKickoff.actions.review}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <ul className="acKickoffBulletList">
          {snapshot.ctoPlan.ownerMustApprove.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <Link to="/ops/approvals" className="mcLink">
          {t.pages.approvals}
        </Link>
      </div>
    </Panel>
  )
}
