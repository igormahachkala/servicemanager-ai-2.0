import type { ToolExecution } from '../../domain/toolExecution'
import { useI18n } from '../../i18n'

export function ToolApprovalPanel(props: {
  execution: ToolExecution
  onApprove: (executionId: string) => void
  onReject: (executionId: string, reason: string) => void
  onCancel: (executionId: string) => void
}) {
  const { t } = useI18n()

  if (props.execution.status !== 'waiting_approval') {
    return (
      <div className="acToolApprovalPanel">
        <div className="acToolApprovalPanelTitle">{t.toolExecutionEngine.approval.stateTitle}</div>
        <div className="mcMuted">{t.toolExecutionEngine.approval.noAction}</div>
      </div>
    )
  }

  return (
    <div className="acToolApprovalPanel">
      <div className="acToolApprovalPanelTitle">{t.toolExecutionEngine.approval.requiredTitle}</div>
      <div className="mcMuted">
        {t.toolExecutionEngine.approval.waitingNote
          .replace('{toolId}', props.execution.request.toolId)
          .replace('{action}', props.execution.request.action)}
      </div>
      <div className="acToolApprovalPanelActions">
        <button className="mcBtn mcBtnPrimary" type="button" onClick={() => props.onApprove(props.execution.id)}>
          {t.toolExecutionEngine.approval.approve}
        </button>
        <button
          className="mcBtn mcBtnDanger"
          type="button"
          onClick={() =>
            props.onReject(props.execution.id, t.toolExecutionEngine.approval.rejectReason)
          }
        >
          {t.toolExecutionEngine.approval.reject}
        </button>
        <button className="mcBtn mcBtnSecondary" type="button" onClick={() => props.onCancel(props.execution.id)}>
          {t.toolExecutionEngine.approval.cancel}
        </button>
      </div>
    </div>
  )
}
