import type { ToolExecution } from '../../domain/toolExecution'

export function ToolApprovalPanel(props: {
  execution: ToolExecution
  onApprove: (executionId: string) => void
  onReject: (executionId: string, reason: string) => void
  onCancel: (executionId: string) => void
}) {
  if (props.execution.status !== 'waiting_approval') {
    return (
      <div className="acToolApprovalPanel">
        <div className="acToolApprovalPanelTitle">Approval state</div>
        <div className="mcMuted">No approval action available for current status.</div>
      </div>
    )
  }

  return (
    <div className="acToolApprovalPanel">
      <div className="acToolApprovalPanelTitle">Approval required</div>
      <div className="mcMuted">
        This request is waiting owner decision: {props.execution.request.toolId} · {props.execution.request.action}
      </div>
      <div className="acToolApprovalPanelActions">
        <button className="mcBtn mcBtnPrimary" type="button" onClick={() => props.onApprove(props.execution.id)}>
          Approve
        </button>
        <button
          className="mcBtn mcBtnDanger"
          type="button"
          onClick={() => props.onReject(props.execution.id, 'Rejected in Tool Approval panel')}
        >
          Reject
        </button>
        <button className="mcBtn mcBtnSecondary" type="button" onClick={() => props.onCancel(props.execution.id)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
