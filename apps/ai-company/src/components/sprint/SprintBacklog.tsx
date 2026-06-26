import { Link } from 'react-router-dom'
import type { SprintSnapshot } from '../../domain/sprint/sprintStorage'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  snapshot: SprintSnapshot
}

export function SprintBacklog({ snapshot }: Props) {
  const { t } = useI18n()

  return (
    <Panel title={t.sprintEngine.sections.backlog}>
      <div className="mcProfilePanelBody">
        <table className="mcSprintTaskTable">
          <thead>
            <tr>
              <th>#</th>
              <th>{t.labels.title}</th>
              <th>{t.labels.assignee}</th>
              <th>SP</th>
              <th>{t.labels.priority}</th>
              <th>{t.labels.status}</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.tasks.map(({ entry, task, assigneeCodename }) => (
              <tr key={task.id}>
                <td className="mcMono">{entry.order}</td>
                <td>
                  <div className="mcSprintTaskTitle">{task.title}</div>
                  <div className="mcMuted">{task.expectedOutput}</div>
                </td>
                <td>
                  <Link to={`/ops/employees/${encodeURIComponent(task.assigneeId)}`} className="mcLink">
                    {assigneeCodename}
                  </Link>
                </td>
                <td className="mcMono">{entry.storyPoints}</td>
                <td>{task.priority}</td>
                <td>
                  <span className={`mcSprintBadge mcSprintColumn${entry.boardColumn}`}>
                    {t.sprintEngine.columns[entry.boardColumn]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
