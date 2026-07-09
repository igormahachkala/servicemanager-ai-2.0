import type { MobileMaxChatStatus } from '../hooks/useMobileMaxChat'

type Props = {
  status: MobileMaxChatStatus
}

export function MobileChatStatusBar({ status }: Props) {
  return (
    <div className={`acMobileChatStatus acMobileChatStatus${capitalize(status.tone)}`} role="status">
      <span className="acMobileChatStatusDot" aria-hidden />
      <div className="acMobileChatStatusBody">
        <span className="acMobileChatStatusLabel">{status.label}</span>
        {status.detail ? <span className="acMobileChatStatusDetail">{status.detail}</span> : null}
      </div>
    </div>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
