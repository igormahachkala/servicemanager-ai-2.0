import { Link } from 'react-router-dom'
import type { CommandCenterRuntimeSummary } from '../../domain/commandCenter'
import { resolveLivingActivityFromRun } from '../../domain/living'
import { Badge, Card } from '../layout'
import { LivingActivityLine } from '../living'
import { formatFeedTime } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  runtime: CommandCenterRuntimeSummary
}

export function RuntimePanel({ runtime }: Props) {
  const { t } = useI18n()

  return (
    <Card
      title={t.commandCenter.sections.runtime}
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/ops/runtime/live" className="acLink">{t.pages.runtimeLive}</Link>
          <Link to="/ops/runtime" className="acLink">{t.executiveDashboard.viewAll}</Link>
        </div>
      }
    >
      <div className="mcCommandCenterInlineStats">
        <div>
          <span className="mcCommandCenterInlineStatValue">{runtime.total}</span>
          <span className="mcCommandCenterInlineStatLabel">{t.commandCenter.runtimeTotal}</span>
        </div>
        <div>
          <span className="mcCommandCenterInlineStatValue">{runtime.waitingApproval}</span>
          <span className="mcCommandCenterInlineStatLabel">{t.commandCenter.runtimeWaiting}</span>
        </div>
      </div>
      {runtime.recentRuns.length === 0 ? (
        <div className="acMuted">{t.commandCenter.empty.runtime}</div>
      ) : (
        runtime.recentRuns.map((run) => {
          const living = resolveLivingActivityFromRun(run)
          return (
            <div key={run.id} className="acListRow acListRowLiving">
              <div className="acListRowLivingMain">
                <Link to={`/ops/runtime/runs/${encodeURIComponent(run.id)}`} className="acLink">
                  {run.taskId ?? run.runtimeProfileId}
                </Link>
                <LivingActivityLine
                  snapshot={living}
                  compact
                  showProgress={living.progress !== null && run.status !== 'completed'}
                  showSince={false}
                />
              </div>
              <Badge variant={run.status === 'failed' ? 'danger' : run.status === 'completed' ? 'success' : 'default'}>
                {run.status}
              </Badge>
              <span className="acMono acMuted">{formatFeedTime(run.startedAt)}</span>
            </div>
          )
        })
      )}
    </Card>
  )
}
