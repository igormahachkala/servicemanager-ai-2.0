import { Link } from 'react-router-dom'
import type { TaskRunnerStartResult } from '../../domain/taskRunner'
import { getRuntimeRunById } from '../../domain/runtime/runtimeOrchestrator'
import { TASK_RUNNER_EMPLOYEES } from '../../domain/taskRunner'
import { useI18n } from '../../i18n'

type Props = {
  result: TaskRunnerStartResult | null
}

export function TaskRunnerResult({ result }: Props) {
  const { t } = useI18n()

  if (!result) {
    return <div className="mcMuted">{t.taskRunner.result.empty}</div>
  }

  const run = getRuntimeRunById(result.run.id) ?? result.run
  const employee = TASK_RUNNER_EMPLOYEES.find((item) => item.id === result.record.employeeId)
  const response = run.result?.responseText?.trim()

  return (
    <div className="mcTaskRunnerResult">
      <div className="mcTaskRunnerResultHead">
        <div>
          <div className="mcTaskRunnerResultTitle">{result.record.title}</div>
          <div className="mcMuted">
            {employee?.codename ?? result.record.employeeId} · {t.taskRunner.modes[result.record.mode]} ·{' '}
            {run.status}
          </div>
        </div>
        <div className="mcTaskRunnerResultLinks">
          <Link
            to={`/ops/runtime/live?runId=${encodeURIComponent(run.id)}`}
            className="mcBtn mcBtnPrimary mcBtnSmall"
          >
            {t.taskRunner.result.openLive}
          </Link>
          <Link to={`/ops/runtime/runs/${encodeURIComponent(run.id)}`} className="mcBtn mcBtnSecondary mcBtnSmall">
            {t.taskRunner.result.openRun}
          </Link>
          {run.reportId ? (
            <Link to={`/ops/reports/${encodeURIComponent(run.reportId)}`} className="mcBtn mcBtnSecondary mcBtnSmall">
              {t.taskRunner.result.openReport}
            </Link>
          ) : null}
        </div>
      </div>

      {response ? (
        <pre className="mcTaskRunnerResultBody">{response}</pre>
      ) : (
        <div className="mcMuted">
          {run.result?.warnings?.[0]?.message ?? t.taskRunner.result.noResponse}
        </div>
      )}
    </div>
  )
}
