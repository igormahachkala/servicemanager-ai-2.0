import { Link, useParams } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { ApprovalActions } from '../components/approval/ApprovalActions'
import { ApprovalPolicyBadge } from '../components/approval/ApprovalPolicyBadge'
import { ApprovalTimeline } from '../components/approval/ApprovalTimeline'
import { useApprovalDetails } from '../hooks/useApprovals'
import { resolveEmployee } from '../mission-control/data/conversation'
import { useI18n } from '../i18n'

export function ApprovalDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { approval, actions, applyAction, cancel } = useApprovalDetails(id)

  if (!approval) {
    return (
      <>
        <PageHeader
          title={t.approvalEngine.notFoundTitle}
          description={t.approvalEngine.notFoundDescription}
        />
        <div className="mcApprovalEmpty">
          <Link to="/ops/approvals" className="mcBtn mcBtnPrimary">
            {t.approvalEngine.backToList}
          </Link>
        </div>
      </>
    )
  }

  const employee = resolveEmployee(approval.employeeId)

  return (
    <>
      <div className="mcOrgPageTop">
        <Link to="/ops/approvals" className="mcBtn mcBtnSecondary mcBtnSmall">
          {t.approvalEngine.backToList}
        </Link>
      </div>

      <PageHeader title={approval.title} description={approval.description} />

      <div className="mcApprovalDetailGrid">
        <Panel title={t.approvalEngine.detailsOverview}>
          <div className="mcProfilePanelBody">
            <div className="mcProfileFieldGrid">
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.labels.status}</div>
                <div className="mcProfileFieldValue">
                  {t.approvalEngine.statuses[approval.status]}
                </div>
              </div>
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.labels.priority}</div>
                <div className="mcProfileFieldValue">
                  {t.approvalEngine.priorities[approval.priority]}
                </div>
              </div>
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.approvalEngine.filters.actionType}</div>
                <div className="mcProfileFieldValue">
                  {t.approvalEngine.actionTypes[approval.actionType]}
                </div>
              </div>
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.approvalEngine.policyRule}</div>
                <div className="mcProfileFieldValue">
                  <ApprovalPolicyBadge rule={approval.policyRule} />
                </div>
              </div>
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.labels.agent}</div>
                <div className="mcProfileFieldValue mcMono">
                  {employee?.codename ?? approval.employeeId}
                </div>
              </div>
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.approvalEngine.filters.workspace}</div>
                <div className="mcProfileFieldValue mcMono">
                  {approval.workspaceId ?? t.common.empty}
                </div>
              </div>
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.approvalEngine.createdAt}</div>
                <div className="mcProfileFieldValue">
                  {new Date(approval.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="mcProfileField">
                <div className="mcProfileFieldLabel">{t.approvalEngine.updatedAt}</div>
                <div className="mcProfileFieldValue">
                  {new Date(approval.updatedAt).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title={t.approvalEngine.ownerActionsTitle}>
          <ApprovalActions
            approval={approval}
            onApprove={(comment) => applyAction({ approvalId: approval.id, kind: 'approve', comment })}
            onReject={(comment) => applyAction({ approvalId: approval.id, kind: 'reject', comment })}
            onDelegate={(delegateToId, comment) =>
              applyAction({ approvalId: approval.id, kind: 'delegate', delegateToId, comment })
            }
            onComment={(comment) =>
              applyAction({ approvalId: approval.id, kind: 'comment', comment })
            }
            onCancel={() => cancel(approval.id)}
          />
        </Panel>

        <Panel title={t.approvalEngine.timelineTitle}>
          <ApprovalTimeline actions={actions} />
        </Panel>
      </div>

      <p className="mcReportPrincipleNote">{t.approvalEngine.runtimeNote}</p>
      <p className="mcMemoryLocalNote">{t.approvalEngine.localOnly}</p>
    </>
  )
}
