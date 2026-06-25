import { useState, type FormEvent } from 'react'
import type { Approval } from '../../domain/approval/approval'
import { useI18n } from '../../i18n'

type Props = {
  approval: Approval
  onApprove: (comment: string) => void
  onReject: (comment: string) => void
  onDelegate: (delegateToId: string, comment: string) => void
  onComment: (comment: string) => void
  onCancel: () => void
}

export function ApprovalActions({
  approval,
  onApprove,
  onReject,
  onDelegate,
  onComment,
  onCancel,
}: Props) {
  const { t } = useI18n()
  const [comment, setComment] = useState('')
  const [delegateToId, setDelegateToId] = useState('')
  const isPending = approval.status === 'pending'

  const handleComment = (event: FormEvent) => {
    event.preventDefault()
    if (!comment.trim()) return
    onComment(comment.trim())
    setComment('')
  }

  if (!isPending) {
    return (
      <div className="mcApprovalActionsClosed mcMuted">
        {t.approvalEngine.closedMessage.replace('{status}', t.approvalEngine.statuses[approval.status])}
      </div>
    )
  }

  return (
    <div className="mcApprovalActions">
      <p className="mcApprovalActionsLead">{t.approvalEngine.ownerReviewLead}</p>

      <form className="mcApprovalCommentForm" onSubmit={handleComment}>
        <label className="mcField">
          <span className="mcFieldLabel">{t.approvalEngine.commentLabel}</span>
          <textarea
            className="mcTextarea"
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t.approvalEngine.commentPlaceholder}
          />
        </label>
        <div className="mcApprovalActionRow">
          <button type="submit" className="mcBtn mcBtnSecondary mcBtnSmall">
            {t.approvalEngine.actionKinds.comment}
          </button>
        </div>
      </form>

      <div className="mcApprovalActionRow">
        <button
          type="button"
          className="mcBtn mcBtnPrimary mcBtnSmall"
          onClick={() => onApprove(comment.trim())}
        >
          {t.approvalEngine.actionKinds.approve}
        </button>
        <button
          type="button"
          className="mcBtn mcBtnSecondary mcBtnSmall"
          onClick={() => onReject(comment.trim())}
        >
          {t.approvalEngine.actionKinds.reject}
        </button>
        <button
          type="button"
          className="mcBtn mcBtnSecondary mcBtnSmall"
          onClick={onCancel}
        >
          {t.approvalEngine.cancelRequest}
        </button>
      </div>

      <div className="mcApprovalDelegateBlock">
        <label className="mcField">
          <span className="mcFieldLabel">{t.approvalEngine.delegateLabel}</span>
          <input
            className="mcInput"
            value={delegateToId}
            onChange={(event) => setDelegateToId(event.target.value)}
            placeholder={t.approvalEngine.delegatePlaceholder}
          />
        </label>
        <button
          type="button"
          className="mcBtn mcBtnSecondary mcBtnSmall"
          disabled={!delegateToId.trim()}
          onClick={() => {
            onDelegate(delegateToId.trim(), comment.trim())
            setDelegateToId('')
          }}
        >
          {t.approvalEngine.actionKinds.delegate}
        </button>
      </div>
    </div>
  )
}
