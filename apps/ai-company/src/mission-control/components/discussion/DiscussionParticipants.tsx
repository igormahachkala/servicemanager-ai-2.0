import { resolveRosterEntry, type DiscussionParticipant } from '../../data/discussion'
import { useI18n } from '../../../i18n'

export function DiscussionParticipants({ participants }: { participants: DiscussionParticipant[] }) {
  const { t } = useI18n()

  return (
    <div className="mcDiscussionParticipants">
      {participants.map((participant) => {
        const entry = resolveRosterEntry(participant.employeeId)
        const label = entry?.codename ?? participant.employeeId
        const roleLabel =
          participant.role === 'owner'
            ? t.discussions.roles.owner
            : participant.role === 'observer'
              ? t.discussions.roles.observer
              : t.discussions.roles.member

        return (
          <div key={participant.employeeId} className="mcDiscussionParticipantRow">
            <span className="mcDiscussionParticipantName">{label}</span>
            <span className="mcDiscussionParticipantRole mcMono">{roleLabel}</span>
          </div>
        )
      })}
    </div>
  )
}
