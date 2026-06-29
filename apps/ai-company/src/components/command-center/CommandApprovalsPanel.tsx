import { Link } from 'react-router-dom'
import type { Approval } from '../../domain/approval/approval'
import type { ApprovalStats } from '../../domain/approval/approvalStorage'
import { Badge, Card } from '../layout'
import { formatFeedTime } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'
import { approvalPriorityLabel } from '../../i18n/uiLabels'

type Props = {
  pending: Approval[]
  stats: ApprovalStats
}

export function CommandApprovalsPanel({ pending, stats }: Props) {
  const { t } = useI18n()

  return (
    <Card
      title={t.commandCenter.sections.approvals}
      action={<Link to="/ops/approvals" className="acLink">{t.executiveDashboard.viewAll}</Link>}
    >
      <div className="mcCommandCenterInlineStats">
        <div>
          <span className="mcCommandCenterInlineStatValue">{stats.pending}</span>
          <span className="mcCommandCenterInlineStatLabel">{t.commandCenter.approvalsPending}</span>
        </div>
        <div>
          <span className="mcCommandCenterInlineStatValue">{stats.approved}</span>
          <span className="mcCommandCenterInlineStatLabel">{t.commandCenter.approvalsApproved}</span>
        </div>
      </div>
      {pending.length === 0 ? (
        <div className="acMuted">{t.commandCenter.empty.approvals}</div>
      ) : (
        pending.map((item) => (
          <div key={item.id} className="acListRow">
            <Link to={`/ops/approvals/${encodeURIComponent(item.id)}`} className="acLink">
              {item.title}
            </Link>
            <Badge variant={item.priority === 'critical' ? 'danger' : item.priority === 'high' ? 'warning' : 'default'}>
              {approvalPriorityLabel(t, item.priority)}
            </Badge>
            <span className="acMono acMuted">{formatFeedTime(item.createdAt)}</span>
          </div>
        ))
      )}
    </Card>
  )
}
