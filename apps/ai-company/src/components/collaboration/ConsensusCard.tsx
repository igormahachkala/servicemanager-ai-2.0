import type { CollaborationDecision } from '../../domain/collaboration/collaborationDecision'
import { countApprovals } from '../../domain/collaboration/collaborationDecision'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  decision: CollaborationDecision | null
}

export function ConsensusCard({ decision }: Props) {
  const { t } = useI18n()

  if (!decision) {
    return (
      <Panel title={t.collaborationEngine.sections.consensus}>
        <div className="mcProfilePanelBody">
          <div className="mcCollabEmpty">{t.collaborationEngine.empty.consensus}</div>
        </div>
      </Panel>
    )
  }

  return (
    <Panel title={t.collaborationEngine.sections.consensus}>
      <div className="mcProfilePanelBody">
        <div className="mcCollabConsensusCard">
          <div className="mcCollabConsensusBadge">{t.collaborationEngine.finalDecision}</div>
          <div className="mcCollabDecisionTitle">{decision.title}</div>
          <p className="mcCollabDecisionSummary">{decision.summary}</p>
          <div className="mcCollabConsensusMeta">
            <span className="mcMono">{decision.proposedByCodename}</span>
            <span className="mcMuted">
              {countApprovals(decision)}/{decision.votes.length} {t.collaborationEngine.approvals}
            </span>
          </div>
          <ul className="mcCollabVoteList">
            {decision.votes.map((vote) => (
              <li key={`${decision.id}-${vote.employeeId}`}>
                <span>{vote.codename}</span>
                <span className={`mcCollabVote mcCollabVote${vote.vote}`}>
                  {t.collaborationEngine.vote[vote.vote]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  )
}
