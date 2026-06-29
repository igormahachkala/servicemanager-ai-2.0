import { Link } from 'react-router-dom'
import { TASK_RUNNER_EMPLOYEES, type TaskRunnerRecord } from '../../domain/taskRunner'
import { useI18n } from '../../i18n'

type Props = {
  items: TaskRunnerRecord[]
}

export function TaskRunnerHistory({ items }: Props) {
  const { t } = useI18n()

  if (!items.length) {
    return <div className="mcMuted">{t.taskRunner.history.empty}</div>
  }

  return (
    <ul className="mcTaskRunnerHistoryList">
      {items.slice(0, 12).map((item) => {
        const employee = TASK_RUNNER_EMPLOYEES.find((entry) => entry.id === item.employeeId)
        return (
          <li key={item.id} className="mcTaskRunnerHistoryItem">
            <div className="mcTaskRunnerHistoryTop">
              <div>
                <div className="title">{item.title}</div>
                <div className="mcMuted">
                  {employee?.codename ?? item.employeeId} · {t.taskRunner.modes[item.mode]} · {item.status}
                </div>
              </div>
              <div className="mcTaskRunnerHistoryActions">
                <Link
                  to={`/ops/runtime/live?runId=${encodeURIComponent(item.runtimeRunId)}`}
                  className="mcBtn mcBtnSecondary mcBtnSmall"
                >
                  {t.taskRunner.history.live}
                </Link>
                {item.reportId ? (
                  <Link
                    to={`/ops/reports/${encodeURIComponent(item.reportId)}`}
                    className="mcBtn mcBtnSecondary mcBtnSmall"
                  >
                    {t.taskRunner.history.report}
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
