import { Link } from 'react-router-dom'
import type { Execution } from '../../domain/execution'
import { taskTitle } from '../../domain/execution'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { getProjectById } from '../../domain/projects'
import { getWorkspaceById } from '../../domain/workspaces/workspace'
import { useI18n } from '../../i18n'
import { ExecutionStatus } from './ExecutionStatus'
import { ExecutionTimeline } from './ExecutionTimeline'

type ExecutionInspectorProps = {
  execution: Execution | null
  onCancel: (id: string) => void
  onRetry: (id: string) => void
  onComplete: (id: string) => void
}

function formatWhen(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

export function ExecutionInspector({
  execution,
  onCancel,
  onRetry,
  onComplete,
}: ExecutionInspectorProps) {
  const { t } = useI18n()

  if (!execution) {
    return (
      <div className="mcExecInspector mcExecInspectorEmpty">
        <div className="mcExecEmptyTitle">{t.executionEngine.inspectorEmptyTitle}</div>
        <p className="mcExecEmptyDesc">{t.executionEngine.inspectorEmptyDescription}</p>
      </div>
    )
  }

  const employee = resolveEmployee(execution.employeeId)
  const project = execution.projectId ? getProjectById(execution.projectId) : null
  const workspace = execution.workspaceId ? getWorkspaceById(execution.workspaceId) : null
  const canCancel =
    execution.status !== 'completed' &&
    execution.status !== 'failed' &&
    execution.status !== 'cancelled'
  const canRetry = execution.status === 'failed' || execution.status === 'cancelled'
  const canComplete =
    execution.status !== 'completed' &&
    execution.status !== 'failed' &&
    execution.status !== 'cancelled'

  return (
    <div className="mcExecInspector">
      <div className="mcExecInspectorHeader">
        <div>
          <h3 className="mcExecInspectorTitle">{taskTitle(execution.taskId)}</h3>
          <div className="mcMono mcMuted">{execution.id}</div>
        </div>
        <ExecutionStatus status={execution.status} />
      </div>

      <dl className="mcExecInspectorMeta">
        <div>
          <dt>{t.labels.assignee}</dt>
          <dd>
            <Link to={`/ops/employees/${encodeURIComponent(execution.employeeId)}`}>
              {employee?.codename ?? execution.employeeId}
            </Link>
          </dd>
        </div>
        <div>
          <dt>{t.executionEngine.taskId}</dt>
          <dd className="mcMono">{execution.taskId}</dd>
        </div>
        <div>
          <dt>{t.executionEngine.priority}</dt>
          <dd>{t.executionEngine.priorities[execution.priority]}</dd>
        </div>
        <div>
          <dt>{t.executionEngine.queuePosition}</dt>
          <dd>{execution.queuePosition > 0 ? `#${execution.queuePosition}` : '—'}</dd>
        </div>
        <div>
          <dt>{t.executionEngine.startedAt}</dt>
          <dd>{formatWhen(execution.startedAt)}</dd>
        </div>
        <div>
          <dt>{t.executionEngine.finishedAt}</dt>
          <dd>{formatWhen(execution.finishedAt)}</dd>
        </div>
        <div>
          <dt>{t.executionEngine.estimatedDuration}</dt>
          <dd>
            {execution.estimatedDuration}
            {t.executionEngine.minutesShort}
          </dd>
        </div>
        <div>
          <dt>{t.pages.projects}</dt>
          <dd>
            {project ? (
              <Link to={`/ops/projects/${encodeURIComponent(project.id)}`}>{project.title}</Link>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt>{t.pages.workspaces}</dt>
          <dd>{workspace?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>{t.executionEngine.linkedRun}</dt>
          <dd>
            {execution.runtimeRunId ? (
              <Link to={`/ops/runs/${encodeURIComponent(execution.runtimeRunId)}`}>
                {execution.runtimeRunId}
              </Link>
            ) : (
              t.executionEngine.noRuntimeRun
            )}
          </dd>
        </div>
      </dl>

      <div className="mcExecInspectorActions">
        {canComplete ? (
          <button
            type="button"
            className="mcBtn mcBtnPrimary mcBtnSmall"
            onClick={() => onComplete(execution.id)}
          >
            {t.executionEngine.actions.complete}
          </button>
        ) : null}
        {canCancel ? (
          <button
            type="button"
            className="mcBtn mcBtnSecondary mcBtnSmall"
            onClick={() => onCancel(execution.id)}
          >
            {t.executionEngine.actions.cancel}
          </button>
        ) : null}
        {canRetry ? (
          <button
            type="button"
            className="mcBtn mcBtnSecondary mcBtnSmall"
            onClick={() => onRetry(execution.id)}
          >
            {t.executionEngine.actions.retry}
          </button>
        ) : null}
      </div>

      <div className="mcExecInspectorTimeline">
        <h4 className="mcExecSectionTitle">{t.executionEngine.timelineTitle}</h4>
        <ExecutionTimeline execution={execution} />
      </div>
    </div>
  )
}
