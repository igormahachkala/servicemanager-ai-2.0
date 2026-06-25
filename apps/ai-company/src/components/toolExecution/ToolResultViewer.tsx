import type { ToolExecution } from '../../domain/toolExecution'

export function ToolResultViewer(props: { execution: ToolExecution }) {
  const { execution } = props
  const response = execution.response

  return (
    <div className="acToolResultViewer">
      <div className="acToolResultSummary">
        <strong>Execution ID:</strong>
        <span className="mcMono">{execution.id}</span>
        <span>
          Status:{' '}
          {execution.status === 'completed' ? (
            <span className="acToolResultOk">completed</span>
          ) : execution.status === 'failed' ? (
            <span className="acToolResultError">failed</span>
          ) : (
            <span className="mcMuted">{execution.status}</span>
          )}
        </span>
      </div>

      {execution.error ? <div className="acToolResultErrorBox">{execution.error}</div> : null}

      {response ? (
        <>
          <div className="mcMuted">
            elapsed: {response.elapsedMs} ms · completed: {new Date(response.completedAt).toLocaleString()}
          </div>
          <pre className="acToolResultOutput">{JSON.stringify(response.output, null, 2)}</pre>
        </>
      ) : (
        <div className="mcMuted">No response yet. Awaiting execution result.</div>
      )}
    </div>
  )
}
