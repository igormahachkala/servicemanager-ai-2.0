import type { SprintSnapshot } from '../../domain/sprint/sprintStorage'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  snapshot: SprintSnapshot
}

export function SprintGoal({ snapshot }: Props) {
  const { t } = useI18n()
  const { sprint, stats } = snapshot

  return (
    <Panel title={t.sprintEngine.sections.goal}>
      <div className="mcProfilePanelBody mcSprintGoal">
        <div className="mcSprintGoalText">{sprint.goal}</div>
        <div className="mcSprintGoalMeta">
          <span className="mcMono">{sprint.name}</span>
          <span className={`mcSprintBadge mcSprintStatus${sprint.status}`}>
            {t.sprintEngine.status[sprint.status]}
          </span>
          <span className={`mcSprintBadge mcSprintHealth${stats.health}`}>
            {t.sprintEngine.health[stats.health]}
          </span>
        </div>
        <div className="mcSprintDates">
          <span>
            {t.sprintEngine.start}: {new Date(sprint.startDate).toLocaleDateString()}
          </span>
          <span>
            {t.sprintEngine.end}: {new Date(sprint.endDate).toLocaleDateString()}
          </span>
          <span>
            {sprint.durationDays} {t.sprintEngine.workingDays}
          </span>
        </div>
      </div>
    </Panel>
  )
}
