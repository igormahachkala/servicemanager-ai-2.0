import type { MobileEmployeeChatDelegationProposal } from '../chat/mobileEmployeeChat'
import { formatDelegationConfidence } from '../chat/mobileChatDelegation'
import { useI18n } from '../../i18n'

type Props = {
  proposal: MobileEmployeeChatDelegationProposal
  onApprove: () => void
  onChangeAssignee: () => void
  onKeepMax: () => void
  onCancel: () => void
}

export function MobileChatDelegationProposalCard({
  proposal,
  onApprove,
  onChangeAssignee,
  onKeepMax,
  onCancel,
}: Props) {
  const { t } = useI18n()
  const copy = t.mobile.maxChat.delegation

  if (proposal.status !== 'pending') return null

  return (
    <div className="acMobileChatDelegationCard">
      <p className="acMobileChatDelegationEyebrow">{copy.cardTitle}</p>

      <dl className="acMobileChatProposalMeta">
        <div className="acMobileChatProposalRow">
          <dt>{copy.fields.employee}</dt>
          <dd>{proposal.recommendedDisplayName}</dd>
        </div>
        <div className="acMobileChatProposalRow">
          <dt>{copy.fields.title}</dt>
          <dd>{proposal.recommendedTitle}</dd>
        </div>
        <div className="acMobileChatProposalRow">
          <dt>{copy.fields.reason}</dt>
          <dd>{proposal.reason}</dd>
        </div>
        <div className="acMobileChatProposalRow">
          <dt>{copy.fields.confidence}</dt>
          <dd>{formatDelegationConfidence(proposal.confidence)}</dd>
        </div>
        {proposal.expectedResult ? (
          <div className="acMobileChatProposalRow">
            <dt>{copy.fields.expectedResult}</dt>
            <dd>{proposal.expectedResult}</dd>
          </div>
        ) : null}
      </dl>

      {proposal.alternatives.length > 0 ? (
        <div className="acMobileChatDelegationAlternatives">
          <p className="acMobileChatDelegationAlternativesTitle">{copy.fields.alternatives}</p>
          <ul className="acMobileChatDelegationAlternativesList">
            {proposal.alternatives.slice(0, 3).map((item) => (
              <li key={item.employeeId}>
                <strong>{item.displayName}</strong>
                {item.whyNotChosen ? ` — ${item.whyNotChosen}` : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="acMobileChatDelegationAfterConfirm">{proposal.afterConfirmSummary}</p>
      <p className="acMobileChatProposalTask">{proposal.taskProposal.taskText}</p>

      <div className="acMobileChatBubbleActions">
        <button type="button" className="acMobilePrimaryBtn acMobileChatActionBtn" onClick={onApprove}>
          {copy.actions.approve}
        </button>
        <button type="button" className="acMobileSecondaryBtn acMobileChatActionBtn" onClick={onChangeAssignee}>
          {copy.actions.changeAssignee}
        </button>
        <button type="button" className="acMobileSecondaryBtn acMobileChatActionBtn" onClick={onKeepMax}>
          {copy.actions.keepMax}
        </button>
        <button type="button" className="acMobileTertiaryLinkBtn acMobileChatActionBtn" onClick={onCancel}>
          {copy.actions.cancel}
        </button>
      </div>

      <p className="acMobileChatProposalHint">{copy.hint}</p>
    </div>
  )
}
