import { Link } from 'react-router-dom'
import type { AiPhotoLabControlRoomSnapshot } from '../../../domain/projects/aiPhotoLabControlRoom'
import { Panel } from '../../../mission-control/components/ui'
import { useI18n } from '../../../i18n'

type Props = {
  snapshot: AiPhotoLabControlRoomSnapshot
}

function TaskRows({
  items,
  empty,
}: {
  items: AiPhotoLabControlRoomSnapshot['workNow']['currentlyWorking']
  empty: string
}) {
  if (items.length === 0) return <div className="mcControlRoomEmpty">{empty}</div>
  return (
    <ul className="mcControlRoomWorkList">
      {items.map(({ task, execution }) => (
        <li key={task.id}>
          <span className="mcControlRoomWorkTitle">{task.title}</span>
          <span className="mcControlRoomBadge">{task.status}</span>
          {execution ? <span className="mcMono mcMuted">{execution.status}</span> : null}
        </li>
      ))}
    </ul>
  )
}

export function TaskQueuePanel({ snapshot }: Props) {
  const { t } = useI18n()
  const { workNow, tasks } = snapshot

  return (
    <Panel
      title={t.photoLabControlRoom.sections.workNow}
      right={
        <Link to={`/ops/execution?project=${encodeURIComponent(snapshot.project.id)}`} className="mcLink">
          {t.photoLabControlRoom.openExecution}
        </Link>
      }
    >
      <div className="mcProfilePanelBody mcControlRoomWorkGrid">
        <div>
          <h4 className="mcControlRoomSubhead">{t.photoLabControlRoom.workNow.currentlyWorking}</h4>
          <TaskRows items={workNow.currentlyWorking} empty={t.photoLabControlRoom.empty.working} />
        </div>
        <div>
          <h4 className="mcControlRoomSubhead">{t.photoLabControlRoom.workNow.waitingApproval}</h4>
          <TaskRows items={workNow.waitingApproval} empty={t.photoLabControlRoom.empty.waiting} />
        </div>
        <div>
          <h4 className="mcControlRoomSubhead">{t.photoLabControlRoom.workNow.blocked}</h4>
          {workNow.blocked.length === 0 ? (
            <div className="mcControlRoomEmpty">{t.photoLabControlRoom.empty.blocked}</div>
          ) : (
            <ul className="mcControlRoomWorkList">
              {workNow.blocked.map((task) => (
                <li key={task.id}>{task.title}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="mcControlRoomSubhead">{t.photoLabControlRoom.workNow.doneToday}</h4>
          <TaskRows items={workNow.doneToday} empty={t.photoLabControlRoom.empty.doneToday} />
        </div>
      </div>
      <div className="mcControlRoomTaskTableWrap">
        <h4 className="mcControlRoomSubhead">{t.photoLabControlRoom.sections.deliveryTasks}</h4>
        <table className="mcControlRoomTaskTable">
          <thead>
            <tr>
              <th>{t.labels.title}</th>
              <th>{t.labels.assignee}</th>
              <th>{t.labels.priority}</th>
              <th>{t.labels.status}</th>
              <th>{t.projects.tasks.expectedOutput}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>
                  <div className="mcControlRoomWorkTitle">{task.title}</div>
                  <div className="mcMono mcMuted">{task.id}</div>
                </td>
                <td className="mcMono">{task.assigneeId}</td>
                <td>{task.priority}</td>
                <td>{task.status}</td>
                <td className="mcMuted">{task.expectedOutput}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
