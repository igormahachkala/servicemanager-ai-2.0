import type { CollaborationMessage, CollaborationMessageKind } from '../../domain/collaboration/collaborationMessage'
import type { CollaborationParticipant } from '../../domain/collaboration/collaborationSession'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

type Props = {
  participants: CollaborationParticipant[]
  messages: CollaborationMessage[]
}

export function DiscussionGraph({ participants, messages }: Props) {
  const { t } = useI18n()

  const edges = messages
    .filter((message) => message.replyToId)
    .map((message) => {
      const source = messages.find((item) => item.id === message.replyToId)
      return source
        ? {
            from: source.authorCodename,
            to: message.authorCodename,
            kind: message.kind,
          }
        : null
    })
    .filter((item): item is { from: string; to: string; kind: CollaborationMessageKind } => item !== null)

  return (
    <Panel title={t.collaborationEngine.sections.graph}>
      <div className="mcProfilePanelBody">
        <div className="mcCollabGraph">
          <div className="mcCollabGraphNodes">
            {participants.map((participant) => (
              <div key={participant.employeeId} className="mcCollabGraphNode">
                <span className="mcCollabGraphNodeName">{participant.codename}</span>
                <span className="mcCollabGraphNodeRole">{participant.role}</span>
              </div>
            ))}
          </div>
          {edges.length > 0 ? (
            <ul className="mcCollabGraphEdges">
              {edges.map((edge, index) => (
                <li key={`${edge.from}-${edge.to}-${index}`}>
                  <span className="mcMono">{edge.from}</span>
                  <span className="mcCollabGraphArrow">→</span>
                  <span className="mcMono">{edge.to}</span>
                  <span className="mcCollabGraphEdgeKind">{edge.kind}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mcCollabEmpty">{t.collaborationEngine.empty.graph}</p>
          )}
        </div>
      </div>
    </Panel>
  )
}
