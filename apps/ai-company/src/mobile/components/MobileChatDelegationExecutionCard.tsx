import type { MobileEmployeeChatDelegationProposal } from '../chat/mobileEmployeeChat'
import { useI18n } from '../../i18n'

type Props = {
  proposal: MobileEmployeeChatDelegationProposal
  onExecute: () => void
}

export function MobileChatDelegationExecutionCard({ proposal, onExecute }: Props) {
  const { t } = useI18n()
  const copy = t.mobile.maxChat.delegation

  if (proposal.status !== 'awaiting_execution') return null

  return (
    <div className="acMobileChatDelegationCard acMobileChatDelegationExecutionCard">
      <p className="acMobileChatDelegationEyebrow">{copy.execution.cardTitle}</p>
      <p className="acMobileChatDelegationExecutionIntro">
        {copy.execution.intro.replace('{employee}', proposal.recommendedDisplayName)}
      </p>
      <p className="acMobileChatProposalTask">{proposal.taskProposal.taskText}</p>
      <div className="acMobileChatBubbleActions">
        <button type="button" className="acMobilePrimaryBtn acMobileChatActionBtn" onClick={onExecute}>
          {copy.execution.execute}
        </button>
      </div>
      <p className="acMobileChatProposalHint">{copy.execution.hint}</p>
    </div>
  )
}
