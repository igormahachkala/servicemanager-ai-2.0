import { Link } from 'react-router-dom'
import type { MobileEmployeeChatCursorToolReviewSnapshot } from '../chat/mobileEmployeeChat'
import { mobileReportHref } from '../navigation/mobileHrefResolver'
import { useI18n } from '../../i18n'

type Props = {
  review: MobileEmployeeChatCursorToolReviewSnapshot
  onAccept: () => void
  onRework: () => void
  onReject?: () => void
}

export function MobileBuilderCursorToolReviewCard({
  review,
  onAccept,
  onRework,
  onReject,
}: Props) {
  const { t } = useI18n()
  const copy = t.mobile.employeeChat.builder.cursorReview

  if (review.status !== 'awaiting_employee_review') return null

  return (
    <div className="acMobileChatDelegationCard acMobileBuilderCursorToolReviewCard">
      <p className="acMobileChatDelegationEyebrow">{copy.cardTitle}</p>
      <p className="acMobileChatDelegationExecutionIntro">{copy.intro}</p>

      <dl className="acMobileChatProposalMeta">
        <div className="acMobileChatProposalRow">
          <dt>{copy.fields.task}</dt>
          <dd>{review.taskTitle}</dd>
        </div>
        <div className="acMobileChatProposalRow">
          <dt>{copy.fields.summary}</dt>
          <dd>{review.summary}</dd>
        </div>
        {review.changedFiles.length > 0 ? (
          <div className="acMobileChatProposalRow">
            <dt>{copy.fields.changedFiles}</dt>
            <dd>
              <ul className="acMobileBuilderCursorReviewFileList">
                {review.changedFiles.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {review.checks.length > 0 ? (
          <div className="acMobileChatProposalRow">
            <dt>{copy.fields.checks}</dt>
            <dd>
              <ul className="acMobileBuilderCursorReviewCheckList">
                {review.checks.map((check) => (
                  <li key={check.name} data-passed={check.passed ? 'true' : 'false'}>
                    {check.name}: {check.status} — {check.outputSummary}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {review.commitMessage || review.commitSha ? (
          <div className="acMobileChatProposalRow">
            <dt>{copy.fields.commit}</dt>
            <dd>
              {[review.commitSha, review.commitMessage, review.commitBranch]
                .filter(Boolean)
                .join(' · ')}
            </dd>
          </div>
        ) : null}
        {review.warnings.length > 0 ? (
          <div className="acMobileChatProposalRow">
            <dt>{copy.fields.warnings}</dt>
            <dd>{review.warnings.join('; ')}</dd>
          </div>
        ) : null}
        {review.errors.length > 0 ? (
          <div className="acMobileChatProposalRow">
            <dt>{copy.fields.errors}</dt>
            <dd>{review.errors.join('; ')}</dd>
          </div>
        ) : null}
        {review.unfinishedItems.length > 0 ? (
          <div className="acMobileChatProposalRow">
            <dt>{copy.fields.unfinished}</dt>
            <dd>{review.unfinishedItems.join('; ')}</dd>
          </div>
        ) : null}
      </dl>

      {review.evaluationNotes.length > 0 ? (
        <p className="acMobileChatProposalHint">{review.evaluationNotes.join(' ')}</p>
      ) : null}

      <div className="acMobileChatBubbleActions">
        <button type="button" className="acMobilePrimaryBtn acMobileChatActionBtn" onClick={onAccept}>
          {copy.actions.acceptAndSendToMax}
        </button>
        <button type="button" className="acMobileSecondaryBtn acMobileChatActionBtn" onClick={onRework}>
          {copy.actions.rework}
        </button>
        {onReject ? (
          <button type="button" className="acMobileTertiaryLinkBtn acMobileChatActionBtn" onClick={onReject}>
            {copy.actions.reject}
          </button>
        ) : null}
        {review.reportId ? (
          <Link to={mobileReportHref(review.reportId)} className="acMobileSecondaryBtn acMobileChatActionBtn">
            {copy.actions.openReport}
          </Link>
        ) : null}
        <Link
          to={`/mobile/tasks?highlight=${encodeURIComponent(review.workItemId)}`}
          className="acMobileSecondaryBtn acMobileChatActionBtn"
        >
          {copy.actions.openTask}
        </Link>
      </div>

      <p className="acMobileChatProposalHint">{copy.hint}</p>
    </div>
  )
}

export function MobileBuilderCursorToolReviewProfileCard({
  review,
  onOpenChat,
}: {
  review: MobileEmployeeChatCursorToolReviewSnapshot
  onOpenChat?: () => void
}) {
  const { t } = useI18n()
  const copy = t.mobile.employeeChat.builder.cursorReview

  if (review.status !== 'awaiting_employee_review') return null

  return (
    <div className="acMobileBuilderToolStatus acMobileBuilderToolStatus--warning">
      <p className="acMobileBuilderToolStatusEyebrow">{copy.cardTitle}</p>
      <p className="acMobileBuilderToolStatusTitle">{review.taskTitle}</p>
      <p className="acMobileBuilderToolStatusState">{review.summary}</p>
      {onOpenChat ? (
        <button type="button" className="acMobilePrimaryBtn" onClick={onOpenChat}>
          {copy.actions.openChat}
        </button>
      ) : null}
    </div>
  )
}
