import { Link } from 'react-router-dom'
import type { MobileEmployeeChatDelegationReviewSnapshot } from '../chat/mobileEmployeeChat'
import { mobileEmployeeProfilePath } from '../../domain/mobileEmployee'
import { mobileReportHref } from '../navigation/mobileHrefResolver'
import { useI18n } from '../../i18n'

type Props = {
  review: MobileEmployeeChatDelegationReviewSnapshot
  onAccept: () => void
  onRework: () => void
}

export function MobileChatDelegationReviewCard({ review, onAccept, onRework }: Props) {
  const { t } = useI18n()
  const copy = t.mobile.maxChat.review

  if (review.status !== 'awaiting_review') return null

  return (
    <div className="acMobileChatDelegationCard acMobileChatDelegationReviewCard">
      <p className="acMobileChatDelegationEyebrow">{copy.cardTitle}</p>
      <p className="acMobileChatDelegationExecutionIntro">
        {copy.intro.replace('{employee}', review.builderDisplayName)}
      </p>

      <dl className="acMobileChatProposalMeta">
        <div className="acMobileChatProposalRow">
          <dt>{copy.fields.task}</dt>
          <dd>{review.taskTitle}</dd>
        </div>
        <div className="acMobileChatProposalRow">
          <dt>{copy.fields.builder}</dt>
          <dd>{review.builderDisplayName}</dd>
        </div>
      </dl>

      <div className="acMobileChatBubbleActions">
        <button type="button" className="acMobilePrimaryBtn acMobileChatActionBtn" onClick={onAccept}>
          {copy.actions.accept}
        </button>
        <button type="button" className="acMobileSecondaryBtn acMobileChatActionBtn" onClick={onRework}>
          {copy.actions.rework}
        </button>
        {review.reportId ? (
          <Link to={mobileReportHref(review.reportId)} className="acMobileSecondaryBtn acMobileChatActionBtn">
            {copy.actions.openReport}
          </Link>
        ) : null}
        <Link
          to={mobileEmployeeProfilePath(review.builderEmployeeId)}
          className="acMobileSecondaryBtn acMobileChatActionBtn"
        >
          {copy.actions.openBuilder}
        </Link>
      </div>

      <p className="acMobileChatProposalHint">{copy.hint}</p>
    </div>
  )
}
