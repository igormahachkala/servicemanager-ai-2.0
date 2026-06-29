import { Link } from 'react-router-dom'
import { Card } from '../layout'
import { useRuntimeMonitor } from '../../hooks/useRuntimeMonitor'
import { useI18n } from '../../i18n'
import { RuntimeCostDashboard } from './RuntimeCostDashboard'

export function RuntimeCostMonitorPanel() {
  const { t } = useI18n()
  const { dashboard } = useRuntimeMonitor()

  return (
    <Card
      title={t.runtimeMonitor.title}
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/ops/runtime" className="acLink">{t.pages.runtimeSettings}</Link>
          <Link to="/ops/runs" className="acLink">{t.pages.runs}</Link>
        </div>
      }
    >
      <RuntimeCostDashboard dashboard={dashboard} compact showRecentRuns={false} />
    </Card>
  )
}
