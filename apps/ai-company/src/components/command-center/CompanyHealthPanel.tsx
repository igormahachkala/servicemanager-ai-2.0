import { Link } from 'react-router-dom'
import type { CommandCenterSnapshot } from '../../domain/commandCenter'
import { Badge, Card } from '../layout'
import { StatusDot, healthDot } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  healthScore: number
  systemHealth: CommandCenterSnapshot['systemHealth']
}

export function CompanyHealthPanel({ healthScore, systemHealth }: Props) {
  const { t } = useI18n()

  return (
    <Card
      title={t.commandCenter.sections.companyHealth}
      action={<Link to="/ops/tools" className="acLink">{t.executiveDashboard.viewAll}</Link>}
    >
      <div className="mcCommandCenterHealthScore">
        <span className="mcCommandCenterHealthScoreValue">{healthScore}</span>
        <span className="mcCommandCenterHealthScoreLabel">{t.commandCenter.healthScoreLabel}</span>
      </div>
      <div className="acHealthRow">
        {systemHealth.map((item) => (
          <div key={item.id} className="acHealthItem">
            <StatusDot kind={healthDot(item.status)} />
            <div>
              <div style={{ fontWeight: 600 }}>{item.label}</div>
              <div className="acMono acMuted">{item.detail}</div>
            </div>
            <Badge variant={item.status === 'up' ? 'success' : 'warning'}>{item.status}</Badge>
          </div>
        ))}
      </div>
    </Card>
  )
}
