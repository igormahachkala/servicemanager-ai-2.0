import { Link } from 'react-router-dom'
import type { CollaborationDecision } from '../../domain/collaboration/collaborationDecision'
import { countApprovals } from '../../domain/collaboration/collaborationDecision'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  decisions: CollaborationDecision[]
}

export function DecisionPanel({ decisions }: Props) {
  const { t } = useI18n()
  const intermediate = decisions.filter((item) => item.status !== 'final')

  return (
    <Panel title={t.collaborationEngine.sections.decisions}>
      <div className="mcProfilePanelBody">
        {intermediate.length === 0 ? (
          <div className="mcCollabEmpty">{t.collaborationEngine.empty.decisions}</div>
        ) : (
          <div className="mcCollabDecisionList">
            {intermediate.map((decision) => (
              <div key={decision.id} className="mcCollabDecisionCard">
                <div className="mcCollabDecisionHead">
                  <span className="mcCollabDecisionAuthor mcMono">{decision.proposedByCodename}</span>
                  <span className={`mcCollabDecisionStatus mcCollabDecisionStatus${decision.status}`}>
                    {t.collaborationEngine.decisionStatus[decision.status]}
                  </span>
                </div>
                <div className="mcCollabDecisionTitle">{decision.title}</div>
                <p className="mcCollabDecisionSummary">{decision.summary}</p>
                <div className="mcCollabDecisionMeta mcMuted">
                  {countApprovals(decision)} {t.collaborationEngine.approvals} ·{' '}
                  {decision.votes.length} {t.collaborationEngine.votes}
                </div>
              </div>
            ))}
          </div>
        )}
        {decisions.some((item) => item.status === 'final') ? (
          <Link to="#consensus" className="mcBtn mcBtnGhost mcBtnSmall" style={{ marginTop: 12 }}>
            {t.collaborationEngine.viewConsensus}
          </Link>
        ) : null}
      </div>
    </Panel>
  )
}
