import { Link } from 'react-router-dom'
import type { Approval } from '../../domain/approval/approval'
import { resolveEmployee } from '../../mission-control/data/conversation'
import { ApprovalPolicyBadge } from './ApprovalPolicyBadge'
import { useI18n } from '../../i18n'

function statusClass(status: Approval['status']): string {
  if (status === 'pending') return 'mcApprovalStatusPending'
  if (status === 'approved') return 'mcApprovalStatusApproved'
  if (status === 'rejected') return 'mcApprovalStatusRejected'
  if (status === 'cancelled') return 'mcApprovalStatusCancelled'
  return 'mcApprovalStatusExpired'
}

function priorityClass(priority: Approval['priority']): string {
  if (priority === 'critical') return 'mcApprovalPriorityCritical'
  if (priority === 'high') return 'mcApprovalPriorityHigh'
  return 'mcApprovalPriorityNormal'
}

export function ApprovalCard({ approval }: { approval: Approval }) {
  const { t } = useI18n()
  const employee = resolveEmployee(approval.employeeId)

  return (
    <Link to={`/ops/approvals/${approval.id}`} className="mcApprovalCard mcApprovalCardLink">
      <div className="mcApprovalCardHeader">
        <h3 className="mcApprovalCardTitle">{approval.title}</h3>
        <span className={`mcApprovalStatusBadge ${statusClass(approval.status)}`}>
          {t.approvalEngine.statuses[approval.status]}
        </span>
      </div>
      <p className="mcApprovalCardDesc mcMuted">{approval.description}</p>
      <div className="mcApprovalCardMeta">
        <span className={`mcApprovalPriorityBadge ${priorityClass(approval.priority)}`}>
          {t.approvalEngine.priorities[approval.priority]}
        </span>
        <span className="mcMono mcMuted">{t.approvalEngine.actionTypes[approval.actionType]}</span>
        <ApprovalPolicyBadge rule={approval.policyRule} />
      </div>
      <div className="mcApprovalCardFooter">
        <span className="mcMono">{employee?.codename ?? approval.employeeId}</span>
        <span className="mcMuted">
          {new Date(approval.updatedAt).toLocaleString()}
        </span>
      </div>
    </Link>
  )
}
