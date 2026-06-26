import { Link } from 'react-router-dom'
import type { FeedEvent } from '../../mission-control/data/types'
import { Card } from '../layout'
import { StatusDot, formatFeedTime } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  alerts: FeedEvent[]
}

export function CriticalAlertsPanel({ alerts }: Props) {
  const { t } = useI18n()

  return (
    <Card
      title={t.commandCenter.sections.criticalAlerts}
      action={<Link to="/ops/approvals" className="acLink">{t.executiveDashboard.viewAll}</Link>}
    >
      {alerts.length === 0 ? (
        <div className="acMuted">{t.dashboard.noActiveAlerts}</div>
      ) : (
        alerts.map((alert) => (
          <div key={alert.id} className="acListRow">
            <StatusDot kind={alert.severity === 'error' ? 'red' : 'amber'} />
            <span className="acMono acMuted">{formatFeedTime(alert.at)}</span>
            <span>{alert.message}</span>
          </div>
        ))
      )}
    </Card>
  )
}
