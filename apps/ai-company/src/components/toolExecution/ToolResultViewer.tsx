import type { ToolExecution } from '../../domain/toolExecution'
import { useI18n } from '../../i18n'
import { toolExecutionStatusLabel } from '../../i18n/uiLabels'

export function ToolResultViewer(props: { execution: ToolExecution }) {
  const { t } = useI18n()
  const { execution } = props
  const response = execution.response

  return (
    <div className="acToolResultViewer">
      <div className="acToolResultSummary">
        <strong>{t.toolExecutionEngine.result.executionId}</strong>
        <span className="mcMono">{execution.id}</span>
        <span>
          {t.toolExecutionEngine.result.status}{' '}
          {execution.status === 'completed' ? (
            <span className="acToolResultOk">{toolExecutionStatusLabel(t, execution.status)}</span>
          ) : execution.status === 'failed' ? (
            <span className="acToolResultError">{toolExecutionStatusLabel(t, execution.status)}</span>
          ) : (
            <span className="mcMuted">{toolExecutionStatusLabel(t, execution.status)}</span>
          )}
        </span>
      </div>

      {execution.error ? <div className="acToolResultErrorBox">{execution.error}</div> : null}

      {response ? (
        <>
          <div className="mcMuted">
            {t.toolExecutionEngine.result.elapsed
              .replace('{ms}', String(response.elapsedMs))
              .replace('{at}', new Date(response.completedAt).toLocaleString())}
          </div>
          <pre className="acToolResultOutput">{JSON.stringify(response.output, null, 2)}</pre>
        </>
      ) : (
        <div className="mcMuted">{t.toolExecutionEngine.result.noResponse}</div>
      )}
    </div>
  )
}
