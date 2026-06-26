import { Link } from 'react-router-dom'
import type { SprintSnapshot } from '../../domain/sprint/sprintStorage'
import { AI_PHOTO_LAB_SPRINT_PATH } from '../../domain/sprint/sprintStorage'
import { Card } from '../layout'
import { useI18n } from '../../i18n'

type Props = {
  sprint: SprintSnapshot | null
}

export function TodaysSprintPanel({ sprint }: Props) {
  const { t } = useI18n()

  if (!sprint) {
    return (
      <Card title={t.commandCenter.sections.todaysSprint}>
        <div className="acMuted">{t.commandCenter.empty.sprint}</div>
      </Card>
    )
  }

  const { stats } = snapshotMeta(sprint)

  return (
    <Card
      title={t.commandCenter.sections.todaysSprint}
      action={
        <Link to={AI_PHOTO_LAB_SPRINT_PATH} className="acLink">
          {t.sprintEngine.openSprint}
        </Link>
      }
    >
      <div className="mcCommandCenterSprintGoal">{sprint.sprint.goal}</div>
      <div className="mcCommandCenterSprintMeta">
        <span className="mcMono">{sprint.sprint.name}</span>
        <span className={`mcSprintBadge mcSprintStatus${sprint.sprint.status}`}>
          {t.sprintEngine.status[sprint.sprint.status]}
        </span>
        <span className={`mcSprintBadge mcSprintHealth${stats.health}`}>
          {t.sprintEngine.health[stats.health]}
        </span>
      </div>
      <div className="mcControlRoomProgressBar" style={{ marginTop: 12 }}>
        <div
          className="mcControlRoomProgressFill"
          style={{ width: `${stats.progressPercent}%` }}
        />
      </div>
      <div className="mcControlRoomProgressMeta">
        <span>{stats.progressPercent}%</span>
        <span>
          {stats.completed}/{stats.completed + stats.remaining} {t.commandCenter.sprintTasks}
        </span>
        <span>
          {stats.capacityUsed}/{stats.capacityTotal} {t.commandCenter.sprintPoints}
        </span>
      </div>
    </Card>
  )
}

function snapshotMeta(snapshot: SprintSnapshot) {
  return { stats: snapshot.stats }
}
