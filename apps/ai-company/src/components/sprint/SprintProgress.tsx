import type { SprintSnapshot } from '../../domain/sprint/sprintStorage'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  snapshot: SprintSnapshot
}

export function SprintProgress({ snapshot }: Props) {
  const { t } = useI18n()
  const { stats } = snapshot

  return (
    <Panel title={t.sprintEngine.sections.progress}>
      <div className="mcProfilePanelBody">
        <div className="mcSprintStatsGrid">
          <div className="mcSprintStat">
            <span className="mcSprintStatValue">{stats.completed}</span>
            <span className="mcSprintStatLabel">{t.sprintEngine.metrics.completed}</span>
          </div>
          <div className="mcSprintStat">
            <span className="mcSprintStatValue">{stats.remaining}</span>
            <span className="mcSprintStatLabel">{t.sprintEngine.metrics.remaining}</span>
          </div>
          <div className="mcSprintStat">
            <span className="mcSprintStatValue">{stats.blocked}</span>
            <span className="mcSprintStatLabel">{t.sprintEngine.metrics.blocked}</span>
          </div>
          <div className="mcSprintStat">
            <span className="mcSprintStatValue">{stats.progressPercent}%</span>
            <span className="mcSprintStatLabel">{t.sprintEngine.metrics.progress}</span>
          </div>
          <div className="mcSprintStat">
            <span className="mcSprintStatValue">{stats.velocity}</span>
            <span className="mcSprintStatLabel">{t.sprintEngine.metrics.velocity}</span>
          </div>
          <div className="mcSprintStat">
            <span className={`mcSprintStatValue mcSprintHealth${stats.health}`}>
              {t.sprintEngine.health[stats.health]}
            </span>
            <span className="mcSprintStatLabel">{t.sprintEngine.metrics.health}</span>
          </div>
        </div>
        <div className="mcSprintProgressBar">
          <div className="mcSprintProgressFill" style={{ width: `${stats.progressPercent}%` }} />
        </div>
        <p className="mcMuted mcSprintProgressNote">
          {t.sprintEngine.dayProgress
            .replace('{elapsed}', String(stats.daysElapsed))
            .replace('{total}', String(stats.daysTotal))}
        </p>
      </div>
    </Panel>
  )
}
