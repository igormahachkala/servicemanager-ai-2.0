import { explainClaimUnavailable, genericTechnicianBoardClaimHint } from '../lib/claimAvailabilityHints'

export function MobileClaimReasonHintBox(props: { reason: string | null | undefined; className?: string }) {
  const { title, detail } = explainClaimUnavailable(props.reason)
  return (
    <div className={`mobileUxHintReason${props.className ? ` ${props.className}` : ''}`} role="status">
      <div className="mobileUxHintReasonTitle">{title}</div>
      {detail ? <div className="mobileUxHintReasonDetail">{detail}</div> : null}
    </div>
  )
}

export function MobileBoardClaimFallbackHint() {
  return (
    <div className="mobileUxHintReason mobileUxHintReason--compact" role="status">
      <div className="mobileUxHintReasonDetail">{genericTechnicianBoardClaimHint()}</div>
    </div>
  )
}

