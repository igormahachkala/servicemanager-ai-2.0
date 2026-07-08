import type { OwnerHomeCompanyStatus, OwnerHomeOperatingStatus } from '../../domain/ownerHome'
import { useI18n } from '../../i18n'

type MobileCompanyStatusCardProps = {
  status: OwnerHomeCompanyStatus
}

const STATUS_TONE: Record<OwnerHomeOperatingStatus, 'success' | 'warning' | 'default'> = {
  ready: 'default',
  operating: 'success',
  attention: 'warning',
  idle: 'default',
}

export function MobileCompanyStatusCard({ status }: MobileCompanyStatusCardProps) {
  const { t } = useI18n()
  const m = t.mobile.ownerHome.metrics
  const copy = t.mobile.ownerHome.companyStatus
  const statusLabel = t.ownerHome.companyStatus.operatingStatus[status.operatingStatus]
  const hint =
    status.operatingStatus === 'ready'
      ? t.ownerHome.companyStatus.readyHint
      : status.operatingStatus === 'attention'
        ? t.ownerHome.companyStatus.attentionHint
        : status.isOperating
          ? copy.operatingHint
          : copy.idleHint

  return (
    <article className="acMobileCompanyStatusCard">
      <header className="acMobileCompanyStatusHead">
        <h2 className="acMobileCompanyStatusTitle">{copy.title}</h2>
        <span className={`acMobileCompanyStatusBadge acMobileCompanyStatusBadge--${STATUS_TONE[status.operatingStatus]}`}>
          {statusLabel}
        </span>
      </header>
      <dl className="acMobileCompanyStatusMetrics">
        <div className="acMobileCompanyStatusMetric">
          <dt>{m.activeEmployees}</dt>
          <dd>{status.activeEmployeesCount}</dd>
        </div>
        <div className="acMobileCompanyStatusMetric">
          <dt>{m.tasksInProgress}</dt>
          <dd>{status.tasksInProgress}</dd>
        </div>
        <div className="acMobileCompanyStatusMetric">
          <dt>{m.tasksCompletedToday}</dt>
          <dd>{status.tasksCompletedToday}</dd>
        </div>
        <div className="acMobileCompanyStatusMetric">
          <dt>{m.pendingDecisions}</dt>
          <dd>{status.pendingOwnerDecisions}</dd>
        </div>
      </dl>
      <p className="acMobileCompanyStatusHint">{hint}</p>
    </article>
  )
}
