import type { ApprovalActionRecord } from '../../domain/approval/approvalAction'
import { useI18n } from '../../i18n'

export function ApprovalTimeline({ actions }: { actions: ApprovalActionRecord[] }) {
  const { t } = useI18n()

  if (actions.length === 0) {
    return (
      <div className="mcApprovalEmpty">
        <div className="mcApprovalEmptyTitle">{t.approvalEngine.emptyTimelineTitle}</div>
        <p className="mcApprovalEmptyDesc">{t.approvalEngine.emptyTimelineDescription}</p>
      </div>
    )
  }

  return (
    <div className="mcApprovalTimeline">
      {actions.map((action) => (
        <div key={action.id} className="mcApprovalTimelineItem">
          <div className="mcApprovalTimelineHead">
            <span className={`mcApprovalActionKind mcApprovalActionKind${action.kind}`}>
              {t.approvalEngine.actionKinds[action.kind]}
            </span>
            <span className="mcApprovalTimelineActor mcMono">
              {action.actorType === 'owner'
                ? t.approvalEngine.owner
                : action.actorId}
            </span>
            <span className="mcApprovalTimelineTime mcMuted">
              {new Date(action.createdAt).toLocaleString()}
            </span>
          </div>
          {action.comment ? (
            <p className="mcApprovalTimelineComment">{action.comment}</p>
          ) : null}
          {action.delegateToId ? (
            <p className="mcApprovalTimelineDelegate mcMuted">
              {t.approvalEngine.delegatedTo}: {action.delegateToId}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
}
