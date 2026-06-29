import type { AiPhotoLabControlRoomSnapshot } from '../../../domain/projects/aiPhotoLabControlRoom'
import { Panel } from '../../../mission-control/components/ui'
import { useI18n } from '../../../i18n'
import { milestoneStatusLabel } from '../../../i18n/uiLabels'

type Props = {
  snapshot: AiPhotoLabControlRoomSnapshot
}

export function DeliveryProgress({ snapshot }: Props) {
  const { t } = useI18n()
  const done = snapshot.tasks.filter((item) => item.status === 'done').length
  const active = snapshot.tasks.filter(
    (item) => item.status === 'in_progress' || item.status === 'review',
  ).length

  return (
    <Panel title={t.photoLabControlRoom.sections.deliveryProgress}>
      <div className="mcProfilePanelBody">
        <div className="mcControlRoomProgressBar">
          <div className="mcControlRoomProgressFill" style={{ width: `${snapshot.progress}%` }} />
        </div>
        <div className="mcControlRoomProgressMeta">
          <span>{snapshot.progress}% {t.photoLabControlRoom.mvpReady}</span>
          <span className="mcMuted">
            {done}/{snapshot.tasks.length} {t.photoLabControlRoom.tasksDone} · {active}{' '}
            {t.photoLabControlRoom.tasksActive}
          </span>
        </div>
        {snapshot.project.milestones.length > 0 ? (
          <ul className="mcControlRoomMilestoneList">
            {snapshot.project.milestones.map((milestone) => (
              <li key={milestone.id}>
                <span className="mcControlRoomMilestoneTitle">{milestone.title}</span>
                <span className={`mcControlRoomBadge mcControlRoomMilestone${milestone.status}`}>
                  {milestoneStatusLabel(t, milestone.status)}
                </span>
                <span className="mcMuted">{milestone.progress}%</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Panel>
  )
}
