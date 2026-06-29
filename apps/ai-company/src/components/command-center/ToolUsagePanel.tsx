import { Link } from 'react-router-dom'
import type { CommandCenterToolUsageSummary } from '../../domain/commandCenter'
import { Badge, Card } from '../layout'
import { useI18n } from '../../i18n'
import { toolExecutionStatusLabel } from '../../i18n/uiLabels'

type Props = {
  toolUsage: CommandCenterToolUsageSummary
}

export function ToolUsagePanel({ toolUsage }: Props) {
  const { t } = useI18n()

  return (
    <Card
      title={t.commandCenter.sections.toolUsage}
      action={<Link to="/ops/tool-executions" className="acLink">{t.executiveDashboard.viewAll}</Link>}
    >
      <div className="mcCommandCenterInlineStats">
        <div>
          <span className="mcCommandCenterInlineStatValue">{toolUsage.completed}</span>
          <span className="mcCommandCenterInlineStatLabel">{t.commandCenter.toolCompleted}</span>
        </div>
        <div>
          <span className="mcCommandCenterInlineStatValue">{toolUsage.failed}</span>
          <span className="mcCommandCenterInlineStatLabel">{t.commandCenter.toolFailed}</span>
        </div>
        <div>
          <span className="mcCommandCenterInlineStatValue">{toolUsage.pendingApproval}</span>
          <span className="mcCommandCenterInlineStatLabel">{t.commandCenter.toolPending}</span>
        </div>
      </div>
      {toolUsage.recent.length === 0 ? (
        <div className="acMuted">{t.commandCenter.empty.tools}</div>
      ) : (
        toolUsage.recent.map((item) => (
          <div key={item.id} className="acListRow">
            <span>{item.request.toolId}</span>
            <Badge variant={item.status === 'failed' ? 'danger' : item.status === 'completed' ? 'success' : 'default'}>
              {toolExecutionStatusLabel(t, item.status)}
            </Badge>
            <span className="acMono acMuted">{item.request.provider}</span>
          </div>
        ))
      )}
    </Card>
  )
}
