import { Link } from 'react-router-dom'
import type { Execution } from '../../domain/execution'
import { taskTitle } from '../../domain/execution'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { getProjectById } from '../../domain/projects'
import { useI18n } from '../../i18n'
import { ExecutionStatus } from './ExecutionStatus'

type ExecutionCardProps = {
  execution: Execution
  selected?: boolean
  onSelect?: (id: string) => void
}

export function ExecutionCard({ execution, selected = false, onSelect }: ExecutionCardProps) {
  const { t } = useI18n()
  const employee = resolveEmployee(execution.employeeId)
  const project = execution.projectId ? getProjectById(execution.projectId) : null
  const title = taskTitle(execution.taskId)

  const className = [
    'mcExecCard',
    onSelect ? 'mcExecCardSelectable' : '',
    selected ? 'mcExecCardSelected' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const body = (
    <>
      <div className="mcExecCardHeader">
        <h3 className="mcExecCardTitle">{title}</h3>
        <ExecutionStatus status={execution.status} compact />
      </div>
      <div className="mcExecCardMeta mcMuted">
        <span className="mcMono">{execution.id}</span>
        <span>{employee?.codename ?? execution.employeeId}</span>
      </div>
      <div className="mcExecCardStats">
        <span>
          {t.executionEngine.priority}: {t.executionEngine.priorities[execution.priority]}
        </span>
        {execution.queuePosition > 0 ? (
          <span>
            {t.executionEngine.queuePosition}: #{execution.queuePosition}
          </span>
        ) : null}
        <span>
          {t.executionEngine.estimatedDuration}: {execution.estimatedDuration}
          {t.executionEngine.minutesShort}
        </span>
      </div>
      <div className="mcExecCardFooter mcMuted">
        <span>{project?.title ?? t.executionEngine.noProject}</span>
        {execution.runtimeRunId ? (
          <Link
            to={`/ops/runs/${encodeURIComponent(execution.runtimeRunId)}`}
            className="mcExecCardLink"
            onClick={(event) => event.stopPropagation()}
          >
            {t.executionEngine.linkedRun}
          </Link>
        ) : (
          <span>{t.executionEngine.noRuntimeRun}</span>
        )}
      </div>
    </>
  )

  if (onSelect) {
    return (
      <button type="button" className={className} onClick={() => onSelect(execution.id)}>
        {body}
      </button>
    )
  }

  return <article className={className}>{body}</article>
}
