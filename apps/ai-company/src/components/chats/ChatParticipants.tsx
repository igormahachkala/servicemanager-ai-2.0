import type { ChatParticipant } from '../../domain/chats/chatParticipant'
import { useI18n } from '../../i18n'

export function ChatParticipants(props: { participants: ChatParticipant[] }) {
  const { t } = useI18n()

  return (
    <div className="mcChatParticipants">
      {props.participants.map((participant) => (
        <div key={participant.id} className="mcChatParticipantRow">
          <div>
            <div className="mcChatParticipantName">{participant.displayName}</div>
            <div className="mcChatParticipantRole mcMono mcMuted">{participant.role}</div>
          </div>
          <span className="mcChatTypeBadge mcChatTypeBadgeDirect">{participant.type}</span>
        </div>
      ))}

      <div className="mcChatParticipantActions">
        <button type="button" className="mcBtn mcBtnSecondary mcBtnSmall" disabled>
          {t.chats.addParticipant}
        </button>
        <button type="button" className="mcBtn mcBtnSecondary mcBtnSmall" disabled>
          {t.chats.removeParticipant}
        </button>
        <span className="mcChatFutureBadge">{t.chats.futureBadge}</span>
      </div>
    </div>
  )
}
