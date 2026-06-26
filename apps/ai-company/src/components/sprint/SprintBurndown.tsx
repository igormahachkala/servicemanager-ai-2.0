import type { SprintSnapshot } from '../../domain/sprint/sprintStorage'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  snapshot: SprintSnapshot
}

export function SprintBurndown({ snapshot }: Props) {
  const { t } = useI18n()
  const { sprint } = snapshot
  const max = sprint.burndown[0]?.remaining ?? sprint.commitment.storyPoints

  return (
    <Panel title={t.sprintEngine.sections.burndown}>
      <div className="mcProfilePanelBody">
        <p className="mcMuted mcSprintBurndownNote">{t.sprintEngine.burndownNote}</p>
        <div className="mcSprintBurndownChart">
          {sprint.burndown.map((point) => (
            <div key={point.day} className="mcSprintBurndownDay">
              <div className="mcSprintBurndownBars">
                <div
                  className="mcSprintBurndownActual"
                  style={{ height: `${max ? (point.remaining / max) * 100 : 0}%` }}
                  title={`${point.remaining} SP`}
                />
                <div
                  className="mcSprintBurndownIdeal"
                  style={{ height: `${max ? (point.ideal / max) * 100 : 0}%` }}
                  title={`${point.ideal} SP ideal`}
                />
              </div>
              <span className="mcSprintBurndownLabel">{point.label}</span>
            </div>
          ))}
        </div>
        <div className="mcSprintBurndownLegend">
          <span className="mcSprintLegendActual">{t.sprintEngine.remaining}</span>
          <span className="mcSprintLegendIdeal">{t.sprintEngine.ideal}</span>
        </div>
      </div>
    </Panel>
  )
}
