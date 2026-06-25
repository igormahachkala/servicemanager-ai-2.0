import { buildExecutionTimeline, type Execution } from '../../domain/execution'
import { useI18n } from '../../i18n'
import { ExecutionStatus } from './ExecutionStatus'

type ExecutionTimelineProps = {
  execution: Execution
}

export function ExecutionTimeline({ execution }: ExecutionTimelineProps) {
  const { t } = useI18n()
  const steps = buildExecutionTimeline(execution)

  return (
    <ol className="mcExecTimeline" aria-label={t.executionEngine.timelineTitle}>
      {steps.map((step) => (
        <li
          key={step.id}
          className={`mcExecTimelineStep${step.done ? ' mcExecTimelineStepDone' : ''}`}
        >
          <div className="mcExecTimelineMarker" aria-hidden />
          <div className="mcExecTimelineBody">
            <div className="mcExecTimelineHeader">
              <ExecutionStatus status={step.status} compact />
              <span className="mcExecTimelineLabel">
                {t.executionEngine.statuses[step.status]}
              </span>
            </div>
            {step.at ? (
              <time className="mcMuted mcMono" dateTime={step.at}>
                {new Date(step.at).toLocaleString()}
              </time>
            ) : (
              <span className="mcMuted">{t.executionEngine.pendingStep}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
