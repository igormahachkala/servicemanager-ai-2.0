import type { ApprovalStats } from '../../domain/approval/approvalStorage'
import { useI18n } from '../../i18n'

export function ApprovalSummary({ stats }: { stats: ApprovalStats }) {
  const { t } = useI18n()

  const items = [
    { label: t.approvalEngine.stats.total, value: stats.total },
    { label: t.approvalEngine.stats.pending, value: stats.pending, highlight: stats.pending > 0 },
    { label: t.approvalEngine.stats.approved, value: stats.approved },
    { label: t.approvalEngine.stats.rejected, value: stats.rejected },
    { label: t.approvalEngine.stats.critical, value: stats.critical },
    { label: t.approvalEngine.stats.expired, value: stats.expired },
  ]

  return (
    <div className="mcApprovalStatsGrid">
      {items.map((item) => (
        <div
          key={item.label}
          className={item.highlight ? 'mcApprovalStatCard mcApprovalStatCardHighlight' : 'mcApprovalStatCard'}
        >
          <div className="mcApprovalStatValue">{item.value}</div>
          <div className="mcApprovalStatLabel mcMuted">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
